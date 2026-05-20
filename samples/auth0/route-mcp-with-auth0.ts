/**
 * SAMPLE: MCP route handler variant with Auth0 per-scope checks.
 *
 * Drop-in alternative to src/app/api/a2a/mcp/route.ts for partners
 * who require Auth0-gated access. Adds:
 *
 *  1. Bearer-token extraction via the middleware (assumes middleware
 *     wired in src/middleware.ts).
 *  2. Per-side-effect scope check (one per category from the
 *     announce-intent-before-action discipline). The check uses the
 *     SIDE_EFFECT_SCOPE_MAP in oauth-config.ts.
 *  3. Receipt now records the `principal_id` (the JWT `sub` claim)
 *     so the audit trail names who acted.
 *
 * Partner adapts to their actual tool surface. This file is reference
 * code; it does not replace the live handler unless the partner is
 * ready to require auth on every call.
 */

import { NextResponse } from "next/server";
import { auth0Middleware, hasScope } from "./middleware-auth0";
import { SIDE_EFFECT_SCOPE_MAP } from "./oauth-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRpcId = string | number | null;

function rpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
  httpStatus = 200,
): Response {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id,
      error: { code, message, ...(data !== undefined ? { data } : {}) },
    },
    { status: httpStatus },
  );
}

function rpcResult(id: JsonRpcId, result: unknown): Response {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

/**
 * Per-side-effect scope gate. Returns null if all required scopes are
 * present; otherwise returns the response to short-circuit with.
 *
 * The required scope set is the categories this tool actually fires.
 * For purchase_free_bundle in MVP-1, that is: identity, communication,
 * issuance, public. (No data read in the per-call sense, no money,
 * no async trigger.)
 */
function checkSideEffectScopes(
  id: JsonRpcId,
  scopes: string[],
  requiredCategories: ReadonlyArray<keyof typeof SIDE_EFFECT_SCOPE_MAP>,
): Response | null {
  for (const cat of requiredCategories) {
    const requiredScope = SIDE_EFFECT_SCOPE_MAP[cat];
    if (!hasScope(scopes, requiredScope)) {
      return rpcError(
        id,
        -32001,
        `Insufficient scope for side-effect category "${cat}". Required scope: ${requiredScope}.`,
        {
          missing_category: cat,
          required_scope: requiredScope,
          present_scopes: scopes,
        },
        403,
      );
    }
  }
  return null;
}

export async function POST(req: Request): Promise<Response> {
  // 1. Auth0 middleware. Returns either a 401/403 response OR principal+scopes.
  const authResult = await auth0Middleware(req as never);
  if (authResult.response) {
    return authResult.response;
  }
  const { principal, scopes } = authResult;

  // 2. Parse the JSON-RPC envelope.
  let payload: { jsonrpc?: unknown; id?: JsonRpcId; method?: unknown; params?: unknown };
  try {
    payload = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error: invalid JSON");
  }
  const id: JsonRpcId =
    payload.id === undefined ? null : (payload.id as JsonRpcId);
  if (payload.jsonrpc !== "2.0") {
    return rpcError(id, -32600, "Invalid Request: jsonrpc must be '2.0'");
  }
  const method = typeof payload.method === "string" ? payload.method : "";

  // 3. Method dispatch.
  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: "2025-06-18",
      serverInfo: { name: "adotob-mcp-storefront-with-auth0", version: "1.1.0" },
      capabilities: { tools: {} },
    });
  }

  if (method === "tools/list") {
    // For brevity, only the schema fields that differ from the open variant
    // are shown here. In a partner deployment, merge with the existing
    // TOOL_SCHEMA from src/app/api/a2a/mcp/route.ts.
    return rpcResult(id, {
      tools: [
        {
          name: "purchase_free_bundle",
          description:
            "Request the Adotob Agent Reliability Kit free-trial bundle. " +
            "Per-side-effect scopes enforced: " +
            "write:contacts, send:transactional-email, mint:download-token, publish:receipt-url.",
          inputSchema: {
            type: "object",
            properties: {
              first_name: { type: "string", minLength: 1, maxLength: 100 },
              email: { type: "string", format: "email" },
              idempotency_key: {
                type: "string",
                minLength: 8,
                maxLength: 128,
                pattern: "^[A-Za-z0-9._-]+$",
              },
            },
            required: ["first_name", "email"],
          },
          requiredScopes: [
            "write:contacts",
            "send:transactional-email",
            "mint:download-token",
            "publish:receipt-url",
          ],
        },
      ],
    });
  }

  if (method === "tools/call") {
    const params = (payload.params ?? {}) as {
      name?: unknown;
      arguments?: unknown;
    };
    const name = typeof params.name === "string" ? params.name : "";
    if (name !== "purchase_free_bundle") {
      return rpcError(id, -32601, `Unknown tool: ${name}`);
    }

    // The purchase_free_bundle side-effect categories that fire:
    const requiredCategories = [
      "identity", // CRM upsert
      "communication", // transactional email
      "issuance", // download-token mint
      "public", // public-readable receipt URL
    ] as const;

    const scopeGate = checkSideEffectScopes(id, scopes, requiredCategories);
    if (scopeGate) return scopeGate;

    // Scope checks passed; invoke the runPurchase flow.
    // In the partner deployment, import runPurchase from src/lib/a2a-purchase
    // and pass `principal_id` so the receipt records who acted.
    //
    //   const receipt = await runPurchase({
    //     first_name, email, bundle, source: "mcp",
    //     user_agent: req.headers.get("user-agent") ?? "",
    //     request: req,
    //     idempotency_key,
    //     principal_id: principal,  // <-- new field on PurchaseInput
    //   });
    //   return rpcResult(id, buildToolCallResult(receipt));

    return rpcResult(id, {
      sample_only: true,
      note: "Wire runPurchase here and include principal in the receipt.",
      principal,
      scopes,
    });
  }

  return rpcError(id, -32601, `Method not found: ${method}`);
}
