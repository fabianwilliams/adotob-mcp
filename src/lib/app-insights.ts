/**
 * Server-side Application Insights wrapper.
 *
 * Initialized once on first import (when APPLICATIONINSIGHTS_CONNECTION_STRING
 * is present). All entry points are no-ops when the SDK is not configured —
 * the demo must keep working without observability if the conn string is
 * unset locally.
 *
 * Hard rule: NEVER include secret values in properties. Only metadata —
 * receipt IDs, status codes, check names, IP-buckets (counts not raw IPs
 * where avoidable). Per `feedback_secret_inspection_redaction.md`.
 */

import type { TelemetryClient } from "applicationinsights";

type Properties = Record<string, string | number | boolean | undefined>;

let client: TelemetryClient | null = null;
let initAttempted = false;

function initIfNeeded(): TelemetryClient | null {
  if (initAttempted) return client;
  initAttempted = true;

  const connStr = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!connStr) {
    // Quiet no-op locally. Don't log the env-var name beyond this comment.
    return null;
  }

  try {
    // Lazy require so the SDK isn't pulled into edge bundles.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const appi = require("applicationinsights") as typeof import("applicationinsights");
    appi
      .setup(connStr)
      .setAutoCollectRequests(false)
      .setAutoCollectPerformance(false, false)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(false)
      .setAutoCollectConsole(false, false)
      .setUseDiskRetryCaching(true)
      .start();
    client = appi.defaultClient;
  } catch {
    // Swallow — observability must never break the app.
    client = null;
  }
  return client;
}

function safeProps(p?: Properties): Record<string, string> {
  if (!p) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null) continue;
    // Defensive: never propagate huge strings. Truncate at 256.
    out[k] = String(v).slice(0, 256);
  }
  return out;
}

export const appInsights = {
  trackEvent(name: string, properties?: Properties): void {
    const c = initIfNeeded();
    if (!c) return;
    try {
      c.trackEvent({ name, properties: safeProps(properties) });
    } catch {
      // never throw out of observability
    }
  },
  trackException(error: Error, properties?: Properties): void {
    const c = initIfNeeded();
    if (!c) return;
    try {
      c.trackException({
        exception: error,
        properties: safeProps(properties),
      });
    } catch {
      // never throw out of observability
    }
  },
  trackMetric(name: string, value: number): void {
    const c = initIfNeeded();
    if (!c) return;
    try {
      c.trackMetric({ name, value });
    } catch {
      // never throw out of observability
    }
  },
};
