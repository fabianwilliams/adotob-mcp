/**
 * OAuth Protected Resource Metadata endpoint (RFC 9728).
 *
 * Drop this file into the partner's Next.js app at
 *   src/app/.well-known/oauth-protected-resource/route.ts
 * so MCP clients (ChatGPT, Claude Desktop, etc.) can discover the
 * authorization server via the OAuth discovery flow.
 *
 * The metadata is generated from the partner's Auth0 tenant config in
 * `oauth-config.ts`. No secrets surface in the metadata response; only
 * public endpoint URLs and supported scopes.
 *
 * Pattern borrowed verbatim from ConferenceHaven's production
 * implementation at mcp.conferencehaven.com.
 */

import { NextResponse } from "next/server";
import { getOAuthMetadata } from "./oauth-config";

export const runtime = "nodejs";
export const dynamic = "force-static"; // metadata does not change per request

export async function GET(): Promise<Response> {
  try {
    const metadata = getOAuthMetadata();
    return NextResponse.json(metadata, {
      headers: {
        "cache-control": "public, max-age=3600",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "OAuth metadata unavailable";
    return NextResponse.json(
      { error: "configuration_error", error_description: msg },
      { status: 500 },
    );
  }
}
