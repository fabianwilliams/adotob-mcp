/**
 * Edge middleware for /api/a2a/* — rate-limit + cost-ceiling gating.
 *
 * Defense-in-depth: the lib-side checks are ALSO called from
 * `src/lib/a2a-purchase.ts` so the receipt's audit trail accurately
 * reflects what happened (a request blocked at the middleware never
 * generates a receipt, but a request that slips past the middleware
 * and is later rejected by a downstream check still produces a complete
 * receipt with the failing check recorded).
 *
 * Returns:
 *   - 503 + `{error:"Demo paused", details:"..."}` when DEMO_PAUSED=true
 *   - 429 + `{error:"Rate limit exceeded", details:"..."}` when the
 *     IP has exceeded its hourly or daily cap
 *   - otherwise next()
 *
 * Hard rule: never log secret values. We log only the IP-bucket and the
 * resulting status to App Insights — and even that is best-effort.
 *
 * The middleware needs Node-runtime APIs because Azure Table Storage's
 * SDK uses Node primitives. We pin via `export const runtime = "nodejs"`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkCostCeilingSync } from "@/lib/cost-ceiling";

export const config = {
  matcher: ["/api/a2a/:path*"],
};

export const runtime = "nodejs";

export async function middleware(req: NextRequest): Promise<NextResponse> {
  // 1. Cost ceiling — cheap synchronous env-read; check first.
  const cc = checkCostCeilingSync();
  if (!cc.passed) {
    return NextResponse.json(
      { error: "Demo paused", details: cc.details },
      { status: 503 },
    );
  }

  // 2. Rate limit — needs Azure Table Storage round-trip.
  let rl;
  try {
    rl = await checkRateLimit(req);
  } catch {
    // Fail-open on middleware errors so an outage of the counter store
    // doesn't take the demo offline. The lib-side check that runs inside
    // a2a-purchase.ts will record the situation in the receipt.
    return NextResponse.next();
  }
  if (!rl.passed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", details: rl.details },
      { status: 429 },
    );
  }

  return NextResponse.next();
}
