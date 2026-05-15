/**
 * Core A2A purchase flow.
 *
 * Orchestrates the 6 supervision checks in canonical order, captures audit
 * trail, persists receipt to Azure Blob, returns receipt JSON.
 *
 * The 6 checks (in order, always present in every receipt):
 *   1. input_validation
 *   2. rate_limit
 *   3. cost_ceiling
 *   4. brevo_contact_upsert
 *   5. download_token_mint
 *   6. fulfillment_dispatch
 *
 * Hard rules:
 *  - Never log secret values.
 *  - Never fabricate a check result — if a step throws, that check is `fail`
 *    and downstream steps emit `skip` with a reference to the upstream failure.
 *  - Never write or mention LinkedIn anywhere.
 */

import {
  buildCheck,
  CHECK_LABELS,
  type AuditCheck,
  type CheckId,
  deriveResultStatus,
  nowIso,
} from "./audit-trail";
import { checkRateLimit } from "./rate-limit";
import { checkCostCeiling } from "./cost-ceiling";
import { sendOnboardingEmail, upsertContact, type BrevoSource } from "./brevo-mcp";
import { buildDownloadUrl, mintDownloadToken } from "./download-tokens";
import { newReceiptId, saveReceipt } from "./receipt-store";

export type PurchaseSource = "mcp" | "raw_http";

export interface PurchaseInput {
  first_name: string;
  email: string;
  bundle?: string;
  source: PurchaseSource;
  user_agent?: string;
  request?: Request;
}

export interface PurchaseReceipt {
  receipt_id: string;
  created_at_iso: string;
  request: {
    first_name: string;
    bundle: string;
    source: PurchaseSource;
    user_agent_partial: string;
  };
  checks: AuditCheck[];
  result: {
    status: "success" | "failure";
    download_url: string;
    shareable_receipt_url: string;
  };
}

const DEFAULT_BUNDLE = "free-trial-sample";
const VALID_BUNDLES = new Set([DEFAULT_BUNDLE]);
// RFC 5322 simplified — good enough for upstream-gate validation.
const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

function sanitizeFirstName(raw: string): string {
  return raw.trim().slice(0, 100);
}

function siteBase(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://mcp.adotob.com"
  ).replace(/\/+$/, "");
}

function brevoSourceFor(s: PurchaseSource): BrevoSource {
  return s === "mcp" ? "mcp" : "mcp-raw";
}

function skipReason(prevFailedId: CheckId): AuditCheck {
  return {
    id: prevFailedId,
    name: CHECK_LABELS[prevFailedId],
    status: "skip",
    at_iso: nowIso(),
    details: "skipped due to upstream failure",
  };
}

/**
 * Runs the 6-step flow and returns the receipt JSON.
 * NEVER throws under normal-failure conditions — failures become `fail`
 * checks and `result.status: "failure"` instead.
 */
export async function runPurchase(
  input: PurchaseInput,
): Promise<PurchaseReceipt> {
  const receipt_id = newReceiptId();
  const created_at_iso = nowIso();
  const bundle =
    input.bundle && VALID_BUNDLES.has(input.bundle)
      ? input.bundle
      : DEFAULT_BUNDLE;
  const firstName = sanitizeFirstName(input.first_name ?? "");
  const ua = (input.user_agent ?? "").slice(0, 80);

  const checks: AuditCheck[] = [];

  // 1. input_validation
  const inputOk = firstName.length >= 1 && EMAIL_RE.test(input.email ?? "");
  if (!inputOk) {
    checks.push(
      buildCheck(
        "input_validation",
        "fail",
        firstName.length < 1
          ? "first_name missing or empty"
          : "email missing or malformed",
      ),
    );
    // downstream skips
    (
      [
        "rate_limit",
        "cost_ceiling",
        "brevo_contact_upsert",
        "download_token_mint",
        "fulfillment_dispatch",
      ] as CheckId[]
    ).forEach((id) => checks.push(skipReason(id)));
    return finalize(receipt_id, created_at_iso, firstName, bundle, input, ua, checks, "", "");
  }
  checks.push(
    buildCheck(
      "input_validation",
      "pass",
      "first_name and email present and well-formed",
    ),
  );

  // 2. rate_limit
  let rl;
  try {
    rl = await checkRateLimit(
      input.request ?? new Request("https://mcp.adotob.com/"),
    );
  } catch {
    rl = { passed: false, details: "rate_limit check errored" };
  }
  if (!rl.passed) {
    checks.push(buildCheck("rate_limit", "fail", rl.details));
    (
      [
        "cost_ceiling",
        "brevo_contact_upsert",
        "download_token_mint",
        "fulfillment_dispatch",
      ] as CheckId[]
    ).forEach((id) => checks.push(skipReason(id)));
    return finalize(receipt_id, created_at_iso, firstName, bundle, input, ua, checks, "", "");
  }
  checks.push(buildCheck("rate_limit", "pass", rl.details));

  // 3. cost_ceiling
  let cc;
  try {
    cc = await checkCostCeiling();
  } catch {
    cc = { passed: false, details: "cost_ceiling check errored" };
  }
  if (!cc.passed) {
    checks.push(buildCheck("cost_ceiling", "fail", cc.details));
    (
      [
        "brevo_contact_upsert",
        "download_token_mint",
        "fulfillment_dispatch",
      ] as CheckId[]
    ).forEach((id) => checks.push(skipReason(id)));
    return finalize(receipt_id, created_at_iso, firstName, bundle, input, ua, checks, "", "");
  }
  checks.push(buildCheck("cost_ceiling", "pass", cc.details));

  // 4. brevo_contact_upsert
  let upsert;
  try {
    upsert = await upsertContact({
      email: input.email,
      firstName,
      source: brevoSourceFor(input.source),
      bundle,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    upsert = { ok: false, status: 0, message: `Brevo upsert threw: ${msg}` };
  }
  if (!upsert.ok) {
    checks.push(
      buildCheck("brevo_contact_upsert", "fail", upsert.message),
    );
    (
      ["download_token_mint", "fulfillment_dispatch"] as CheckId[]
    ).forEach((id) => checks.push(skipReason(id)));
    return finalize(receipt_id, created_at_iso, firstName, bundle, input, ua, checks, "", "");
  }
  checks.push(
    buildCheck("brevo_contact_upsert", "pass", upsert.message),
  );

  // 5. download_token_mint
  let token = "";
  let downloadUrl = "";
  try {
    token = await mintDownloadToken(receipt_id);
    downloadUrl = buildDownloadUrl(token);
    checks.push(
      buildCheck("download_token_mint", "pass", "JOSE token, 24h expiry"),
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    checks.push(
      buildCheck("download_token_mint", "fail", `token mint failed: ${msg}`),
    );
    checks.push(skipReason("fulfillment_dispatch"));
    return finalize(receipt_id, created_at_iso, firstName, bundle, input, ua, checks, "", "");
  }

  // 6. fulfillment_dispatch
  const receiptUrl = `${siteBase()}/a2a/receipt/${receipt_id}`;
  let send;
  try {
    send = await sendOnboardingEmail({
      toEmail: input.email,
      toName: firstName,
      downloadUrl,
      receiptUrl,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    send = { ok: false, status: 0, message: `Brevo send threw: ${msg}` };
  }
  checks.push(
    buildCheck(
      "fulfillment_dispatch",
      send.ok ? "pass" : "fail",
      send.message,
    ),
  );

  return finalize(
    receipt_id,
    created_at_iso,
    firstName,
    bundle,
    input,
    ua,
    checks,
    downloadUrl,
    receiptUrl,
  );
}

async function finalize(
  receipt_id: string,
  created_at_iso: string,
  firstName: string,
  bundle: string,
  input: PurchaseInput,
  ua: string,
  checks: AuditCheck[],
  downloadUrl: string,
  receiptUrlIn: string,
): Promise<PurchaseReceipt> {
  const receiptUrl = receiptUrlIn || `${siteBase()}/a2a/receipt/${receipt_id}`;
  const receipt: PurchaseReceipt = {
    receipt_id,
    created_at_iso,
    request: {
      first_name: firstName,
      bundle,
      source: input.source,
      user_agent_partial: ua,
    },
    checks,
    result: {
      status: deriveResultStatus(checks),
      download_url: downloadUrl,
      shareable_receipt_url: receiptUrl,
    },
  };

  // Best-effort persist. Storage outage must not throw out of the flow —
  // we still want to return the receipt to the caller for transparency.
  try {
    await saveReceipt(receipt_id, receipt);
  } catch {
    // Intentionally swallow. The result already reflects what happened.
    // No secrets are logged here.
  }
  return receipt;
}

/** Build the markdown_summary returned alongside MCP tool results. */
export function buildMarkdownSummary(r: PurchaseReceipt): string {
  const lines: string[] = [];
  lines.push(`# Receipt ${r.receipt_id}`);
  lines.push("");
  lines.push(`**Status:** ${r.result.status}`);
  lines.push(`**Bundle:** ${r.request.bundle}`);
  lines.push(`**Source:** ${r.request.source}`);
  lines.push("");
  lines.push("## Supervision checks");
  lines.push("");
  for (const c of r.checks) {
    const mark =
      c.status === "pass"
        ? "[pass]"
        : c.status === "fail"
          ? "[fail]"
          : c.status === "warn"
            ? "[warn]"
            : "[skip]";
    lines.push(`- ${mark} **${c.name}** — ${c.details}`);
  }
  lines.push("");
  if (r.result.download_url) {
    lines.push(`**Download URL:** ${r.result.download_url}`);
  }
  lines.push(`**Receipt URL:** ${r.result.shareable_receipt_url}`);
  return lines.join("\n");
}
