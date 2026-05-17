/**
 * Idempotency key store — closes NEXUM-004 IdempotencyMissing.
 *
 * Background: `purchase_free_bundle` is a mutating operation (mints a receipt,
 * sends an email, issues a download URL). An agent that retries on timeout
 * — common pattern — would double-issue the bundle and double-fire the email.
 * The runtime rate-limit (5/hr) and cost-ceiling do NOT protect against this
 * because both retries fall inside the same window.
 *
 * Fix: accept an idempotency_key (input arg) or `Idempotency-Key` HTTP
 * header. On collision (same key + same email), return the original receipt
 * instead of re-running the 6-check flow.
 *
 * Storage layout: table `IdempotencyKeys` in the same Storage Account as
 * receipts + rate-limit counters (AZURE_STORAGE_CONNECTION_STRING_RECEIPTS).
 *
 * Each entity:
 *   PartitionKey: sha256(idempotency_key) first 32 hex chars
 *   RowKey:       sha256(email_lowercase) first 32 hex chars
 *   ReceiptId:    the receipt id this mapping resolved to
 *   IssuedAtIso:  when the original request completed
 *
 * Hashing the key + email means the table never stores PII or the raw key.
 *
 * Concurrency: two parallel requests with the same key may both miss the
 * cache and both run the full flow. Last-write-wins on the table; both
 * receipts get written to Blob. This is a known v1 limitation — see PR
 * follow-ups for a future Stripe-style in-progress-lock pattern.
 *
 * Validation: idempotency_key must be 8-128 chars, [A-Za-z0-9._-]. Anything
 * outside this is treated as absent (silently — the caller still gets a
 * valid receipt, just not a deduplicated one).
 *
 * Never log secret values.
 */

import {
  AzureNamedKeyCredential,
  TableClient,
  TableServiceClient,
} from "@azure/data-tables";
import crypto from "crypto";

const TABLE_NAME = "IdempotencyKeys";

let cachedTableClient: TableClient | null = null;
let tableEnsured = false;
let tableEnsurePromise: Promise<void> | null = null;

interface ConnParts {
  accountName: string;
  accountKey: string;
  endpoint: string;
}

function parseConnectionString(connStr: string): ConnParts {
  const parts = new Map<string, string>();
  for (const seg of connStr.split(";")) {
    const eq = seg.indexOf("=");
    if (eq < 0) continue;
    const k = seg.slice(0, eq).trim();
    const v = seg.slice(eq + 1).trim();
    if (k) parts.set(k, v);
  }
  const accountName = parts.get("AccountName") ?? "";
  const accountKey = parts.get("AccountKey") ?? "";
  const protocol = parts.get("DefaultEndpointsProtocol") ?? "https";
  const suffix = parts.get("EndpointSuffix") ?? "core.windows.net";
  const explicit = parts.get("TableEndpoint");
  const endpoint = explicit
    ? explicit.replace(/\/+$/, "")
    : `${protocol}://${accountName}.table.${suffix}`;
  if (!accountName || !accountKey) {
    throw new Error(
      "AZURE_STORAGE_CONNECTION_STRING_RECEIPTS missing AccountName or AccountKey",
    );
  }
  return { accountName, accountKey, endpoint };
}

function getTableClient(): TableClient {
  if (cachedTableClient) return cachedTableClient;
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING_RECEIPTS;
  if (!connStr) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING_RECEIPTS not set");
  }
  const { accountName, accountKey, endpoint } = parseConnectionString(connStr);
  const credential = new AzureNamedKeyCredential(accountName, accountKey);
  cachedTableClient = new TableClient(endpoint, TABLE_NAME, credential);
  return cachedTableClient;
}

async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  if (tableEnsurePromise) return tableEnsurePromise;
  tableEnsurePromise = (async () => {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING_RECEIPTS;
    if (!connStr) throw new Error("AZURE_STORAGE_CONNECTION_STRING_RECEIPTS not set");
    const { accountName, accountKey, endpoint } = parseConnectionString(connStr);
    const credential = new AzureNamedKeyCredential(accountName, accountKey);
    const svc = new TableServiceClient(endpoint, credential);
    await svc.createTable(TABLE_NAME);
    tableEnsured = true;
  })().catch((err: unknown) => {
    const code = (err as { statusCode?: number; code?: string })?.code ?? "";
    const status = (err as { statusCode?: number })?.statusCode ?? 0;
    if (code === "TableAlreadyExists" || status === 409) {
      tableEnsured = true;
      return;
    }
    tableEnsurePromise = null;
    throw err;
  });
  return tableEnsurePromise;
}

const VALID_KEY_RE = /^[A-Za-z0-9._-]{8,128}$/;

/**
 * Normalize an idempotency key. Returns null if the key is missing or
 * does not satisfy validation. Callers should treat null as "no key"
 * and skip the cache.
 */
export function normalizeIdempotencyKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!VALID_KEY_RE.test(trimmed)) return null;
  return trimmed;
}

function hashTo32(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 32);
}

interface IdempotencyEntity {
  partitionKey: string;
  rowKey: string;
  ReceiptId?: string;
  IssuedAtIso?: string;
}

/**
 * Look up an existing receipt id for (key, email). Returns null if no
 * mapping exists or storage is unavailable (fail-open: we'd rather
 * occasionally double-issue under storage outage than block all calls).
 */
export async function findCachedReceiptId(
  idempotencyKey: string,
  email: string,
): Promise<string | null> {
  try {
    await ensureTable();
    const client = getTableClient();
    const pk = hashTo32(idempotencyKey);
    const rk = hashTo32(email.toLowerCase());
    const entity = await client.getEntity<IdempotencyEntity>(pk, rk);
    return typeof entity.ReceiptId === "string" ? entity.ReceiptId : null;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 404) return null;
    return null;
  }
}

/**
 * Store the (key, email) -> receiptId mapping after a successful purchase.
 * Best-effort: storage failures are swallowed so they cannot break the
 * caller's response.
 */
export async function storeIdempotencyMapping(
  idempotencyKey: string,
  email: string,
  receiptId: string,
): Promise<void> {
  try {
    await ensureTable();
    const client = getTableClient();
    const pk = hashTo32(idempotencyKey);
    const rk = hashTo32(email.toLowerCase());
    await client.upsertEntity(
      {
        partitionKey: pk,
        rowKey: rk,
        ReceiptId: receiptId,
        IssuedAtIso: new Date().toISOString(),
      },
      "Replace",
    );
  } catch {
    // intentionally swallow — never break a real success on a storage hiccup
  }
}
