/**
 * POST /api/a2a/purchase
 *
 * Raw HTTP equivalent of the MCP tool. Accepts JSON
 *   { first_name, email, bundle? }
 * Returns the receipt JSON directly.
 *
 * Rate-limit + cost-ceiling middleware (sub-agent #3) runs in middleware.ts
 * upstream — this handler ALSO calls the stub functions defensively so the
 * receipt's checks reflect the result instead of being skipped.
 */

import { NextResponse } from "next/server";
import { runPurchase } from "@/lib/a2a-purchase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PurchaseBody {
  first_name?: unknown;
  email?: unknown;
  bundle?: unknown;
}

export async function POST(req: Request): Promise<Response> {
  let body: PurchaseBody;
  try {
    body = (await req.json()) as PurchaseBody;
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "request body is not valid JSON" },
      { status: 400 },
    );
  }

  const first_name = typeof body.first_name === "string" ? body.first_name : "";
  const email = typeof body.email === "string" ? body.email : "";
  const bundle = typeof body.bundle === "string" ? body.bundle : undefined;

  const ua = req.headers.get("user-agent") ?? "";

  const receipt = await runPurchase({
    first_name,
    email,
    bundle,
    source: "raw_http",
    user_agent: ua,
    request: req,
  });

  const httpStatus = receipt.result.status === "success" ? 200 : 422;
  return NextResponse.json(receipt, { status: httpStatus });
}

export async function GET(): Promise<Response> {
  return NextResponse.json(
    { error: "method_not_allowed", message: "POST only" },
    { status: 405 },
  );
}
