/**
 * Audit trail helpers for A2A receipts.
 *
 * Every receipt MUST contain all 6 checks in the canonical order below,
 * with a status of `pass`/`fail`/`warn`/`skip`. Do not reorder, do not skip
 * an entry — emit it with status `skip` and a `details` explanation instead.
 */

export type CheckStatus = "pass" | "fail" | "warn" | "skip";

export type CheckId =
  | "input_validation"
  | "rate_limit"
  | "cost_ceiling"
  | "brevo_contact_upsert"
  | "download_token_mint"
  | "fulfillment_dispatch";

export interface AuditCheck {
  id: CheckId;
  name: string;
  status: CheckStatus;
  at_iso: string;
  details: string;
}

/** Canonical order of checks — index matters. */
export const CHECK_ORDER: CheckId[] = [
  "input_validation",
  "rate_limit",
  "cost_ceiling",
  "brevo_contact_upsert",
  "download_token_mint",
  "fulfillment_dispatch",
];

export const CHECK_LABELS: Record<CheckId, string> = {
  input_validation: "Input Validation",
  rate_limit: "Rate Limit Check",
  cost_ceiling: "Daily Cost Ceiling",
  brevo_contact_upsert: "Lead Capture (Brevo)",
  download_token_mint: "Download Token Issued",
  fulfillment_dispatch: "Fulfillment Email Dispatched",
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function buildCheck(
  id: CheckId,
  status: CheckStatus,
  details: string,
  at_iso?: string,
): AuditCheck {
  return {
    id,
    name: CHECK_LABELS[id],
    status,
    at_iso: at_iso ?? nowIso(),
    details,
  };
}

/** Validate that a list of checks is in canonical order and complete. */
export function validateCheckOrder(checks: AuditCheck[]): boolean {
  if (checks.length !== CHECK_ORDER.length) return false;
  for (let i = 0; i < CHECK_ORDER.length; i++) {
    if (checks[i].id !== CHECK_ORDER[i]) return false;
  }
  return true;
}

/** Return "success" iff every check is pass/warn/skip (no fails). */
export function deriveResultStatus(
  checks: AuditCheck[],
): "success" | "failure" {
  return checks.some((c) => c.status === "fail") ? "failure" : "success";
}
