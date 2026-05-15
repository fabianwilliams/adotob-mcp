/**
 * Rate-limit — real implementation backed by Azure Table Storage.
 *
 * Per-IP counters: 5 calls/hour, 10 calls/24h.
 *
 * Storage layout: one table `RateLimitCounters` in the `stadotobmcp`
 * storage account (we reuse AZURE_STORAGE_CONNECTION_STRING_RECEIPTS).
 *
 * Each entity:
 *   PartitionKey: sanitized-IP (colons replaced — Azure rejects ':' in keys)
 *   RowKey:       "<windowKind>_<windowBucket>"   e.g. "h_2026051403" or "d_20260514"
 *   Count:        int32, incremented per call
 *   ExpiresAt:    ISO string for janitorial reaping (optional cosmetic)
 *
 * On each request we increment the current hour-bucket and the current
 * day-bucket. If either exceeds its cap, the request is rejected. Past
 * buckets are simply ignored (their rows can be reaped by an out-of-band
 * cron; functionally they're inert).
 *
 * Bot/abuse note: the IP is read from `x-forwarded-for[0]`. Behind Azure
 * Front Door / SWA this is the client IP. Locally it falls back to
 * "unknown" — which means all unknown-IP traffic shares one bucket, which
 * is the safer failure mode (errs toward rate-limiting).
 *
 * Never log secret values. The connection string is read by name only.
 */

import {
  AzureNamedKeyCredential,
  TableClient,
  TableServiceClient,
  odata,
} from "@azure/data-tables";

export interface RateLimitResult {
  passed: boolean;
  /** Human-readable, safe-to-log summary for the audit trail. */
  details: string;
}

const TABLE_NAME = "RateLimitCounters";
const HOURLY_CAP = 5;
const DAILY_CAP = 10;

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
    // "TableAlreadyExists" is the success-equivalent — anything else we re-raise.
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

function readClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

/** Azure Table partition/row keys cannot contain '/', '\\', '#', '?', or control chars.
 *  IPv6 contains ':'. We replace anything non-safe with '-'. */
function sanitizeKey(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 200);
}

function hourBucket(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  return `h_${y}${m}${day}${h}`;
}

function dayBucket(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `d_${y}${m}${day}`;
}

interface CounterEntity {
  partitionKey: string;
  rowKey: string;
  Count?: number;
}

async function incrementBucket(
  client: TableClient,
  partitionKey: string,
  rowKey: string,
): Promise<number> {
  // Read-modify-write. For a 5-rps demo this is safe enough; a heavier
  // hammer would use entity-merge with etag, but the demo's traffic budget
  // doesn't justify the complexity.
  let current = 0;
  try {
    const existing = await client.getEntity<CounterEntity>(partitionKey, rowKey);
    current = typeof existing.Count === "number" ? existing.Count : 0;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status !== 404) throw err;
  }
  const next = current + 1;
  await client.upsertEntity(
    { partitionKey, rowKey, Count: next },
    "Replace",
  );
  return next;
}

/** Peek without incrementing — used for the receipt audit-trail string when
 *  the middleware has already counted the request. Currently unused; kept
 *  for future receipts-after-middleware composition. */
export async function peekCounts(
  ip: string,
): Promise<{ hourly: number; daily: number }> {
  await ensureTable();
  const client = getTableClient();
  const now = new Date();
  const pk = sanitizeKey(ip);
  const hRow = hourBucket(now);
  const dRow = dayBucket(now);
  let hourly = 0;
  let daily = 0;
  try {
    const e = await client.getEntity<CounterEntity>(pk, hRow);
    hourly = typeof e.Count === "number" ? e.Count : 0;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status !== 404) throw err;
  }
  try {
    const e = await client.getEntity<CounterEntity>(pk, dRow);
    daily = typeof e.Count === "number" ? e.Count : 0;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status !== 404) throw err;
  }
  // Touch the odata import so it stays — useful for future janitorial filters.
  void odata;
  return { hourly, daily };
}

/**
 * Check-and-increment. Each call counts as one request against both the
 * hourly and daily windows for this IP.
 */
export async function checkRateLimit(req: Request): Promise<RateLimitResult> {
  const ip = readClientIp(req);
  try {
    await ensureTable();
    const client = getTableClient();
    const now = new Date();
    const pk = sanitizeKey(ip);
    const hRow = hourBucket(now);
    const dRow = dayBucket(now);

    const hourly = await incrementBucket(client, pk, hRow);
    const daily = await incrementBucket(client, pk, dRow);

    if (hourly > HOURLY_CAP) {
      return {
        passed: false,
        details: `${hourly}/${HOURLY_CAP} calls/hour from this IP — hourly cap exceeded`,
      };
    }
    if (daily > DAILY_CAP) {
      return {
        passed: false,
        details: `${daily}/${DAILY_CAP} calls/24h from this IP — daily cap exceeded`,
      };
    }
    return {
      passed: true,
      details: `${hourly}/${HOURLY_CAP} calls/hour from this IP`,
    };
  } catch (err: unknown) {
    // Fail-open on storage outage so the demo keeps working, but record
    // the fact in the receipt's details so the audit trail is honest.
    const msg = err instanceof Error ? err.message : "unknown error";
    return {
      passed: true,
      details: `rate-limit store unavailable (${msg.slice(0, 80)}); allowed`,
    };
  }
}
