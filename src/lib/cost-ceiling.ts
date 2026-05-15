/**
 * Cost-ceiling — reads DEMO_PAUSED. The daily-spend integrator runs
 * out-of-band (a cron flips DEMO_PAUSED to "true" when the day's modeled
 * spend crosses DAILY_COST_CEILING_USD). This function is the cheap
 * runtime gate that every request hits.
 *
 * Backend (sub-agent #1) calls `checkCostCeiling()` from the route handlers
 * and embeds the returned `details` string in the receipt's cost_ceiling check.
 * Middleware (this file's sibling) ALSO calls it to short-circuit with 503.
 */

export interface CostCeilingResult {
  passed: boolean;
  /** Human-readable, safe-to-log summary for the audit trail. */
  details: string;
}

function isPaused(): boolean {
  return (process.env.DEMO_PAUSED ?? "false").toLowerCase() === "true";
}

export async function checkCostCeiling(): Promise<CostCeilingResult> {
  if (isPaused()) {
    return {
      passed: false,
      details:
        "Daily cost ceiling exceeded — demo paused for the day",
    };
  }
  return {
    passed: true,
    details: "DEMO_PAUSED=false",
  };
}

/** Sync variant for middleware (no need for await in the edge path). */
export function checkCostCeilingSync(): CostCeilingResult {
  if (isPaused()) {
    return {
      passed: false,
      details:
        "Daily cost ceiling exceeded — demo paused for the day",
    };
  }
  return {
    passed: true,
    details: "DEMO_PAUSED=false",
  };
}
