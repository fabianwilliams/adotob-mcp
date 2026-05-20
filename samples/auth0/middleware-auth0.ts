/**
 * Auth0 bearer-token validation middleware (SAMPLE).
 *
 * Plug into the partner's src/middleware.ts to gate /api/a2a/* behind
 * Auth0 JWT validation. Uses `jose` (already a dependency of the parent
 * repo for JOSE HS256 download-token mint).
 *
 * On a valid token, attaches `x-adotob-principal` header on the request
 * for the downstream route handler to pick up the principal id and
 * include it in the audit-trail receipt.
 *
 * On a missing or invalid token, returns RFC 6750 compliant
 * `WWW-Authenticate` header with `error="invalid_token"` and a 401.
 *
 * Reference implementation only. Partner adapts caching, logging, and
 * error shaping to their runtime conventions.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import {
  AUTH0_AUDIENCE,
  AUTH0_REQUIRED_SCOPES,
  ISSUER,
  JWKS_URI,
} from "./oauth-config";

// Module-scoped JWKS cache. Re-used across requests; refreshes per `jose`
// defaults (cooldown + refresh interval). For production at scale, tune
// these per Auth0's rate-limit guidance.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(): ReturnType<typeof createRemoteJWKSet> {
  if (jwks) return jwks;
  if (!JWKS_URI) {
    throw new Error("AUTH0_DOMAIN is not set; cannot resolve JWKS endpoint");
  }
  jwks = createRemoteJWKSet(new URL(JWKS_URI));
  return jwks;
}

function bearerError(
  message: string,
  errCode: "invalid_token" | "insufficient_scope" | "invalid_request",
  status: 400 | 401 | 403,
  requiredScope?: string,
): NextResponse {
  const scopeHint = requiredScope ? `, scope="${requiredScope}"` : "";
  return new NextResponse(
    JSON.stringify({ error: errCode, error_description: message }),
    {
      status,
      headers: {
        "content-type": "application/json",
        "www-authenticate": `Bearer realm="adotob-mcp", error="${errCode}", error_description="${message}"${scopeHint}`,
      },
    },
  );
}

/**
 * Drop-in middleware. Wire into src/middleware.ts roughly like:
 *
 *   import { auth0Middleware } from "../samples/auth0/middleware-auth0";
 *   export async function middleware(req: NextRequest) {
 *     if (req.nextUrl.pathname.startsWith("/api/a2a/")) {
 *       const authResult = await auth0Middleware(req);
 *       if (authResult.response) return authResult.response;
 *       // mutate request headers if the runtime supports it, or pass
 *       // authResult.principal forward via a header rewrite
 *     }
 *     return NextResponse.next();
 *   }
 *
 * Returns either { response } on failure or { principal, scopes } on success.
 */
export async function auth0Middleware(req: NextRequest): Promise<
  | { response: NextResponse }
  | { response: null; principal: string; scopes: string[]; payload: JWTPayload }
> {
  if (!AUTH0_AUDIENCE || !ISSUER) {
    return {
      response: bearerError(
        "Auth0 not configured on this deployment",
        "invalid_request",
        400,
      ),
    };
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      response: bearerError(
        "Missing or malformed Authorization header",
        "invalid_token",
        401,
      ),
    };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { response: bearerError("Empty bearer token", "invalid_token", 401) };
  }

  let payload: JWTPayload;
  try {
    const result = await jwtVerify(token, getJWKS(), {
      issuer: ISSUER,
      audience: AUTH0_AUDIENCE,
      // Auth0 default: RS256
      algorithms: ["RS256"],
    });
    payload = result.payload;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "token validation failed";
    return {
      response: bearerError(`Token rejected: ${msg}`, "invalid_token", 401),
    };
  }

  const sub = typeof payload.sub === "string" ? payload.sub : "";
  if (!sub) {
    return {
      response: bearerError(
        "Token has no sub claim; principal cannot be determined",
        "invalid_token",
        401,
      ),
    };
  }

  // Auth0 RBAC encodes scopes on the `scope` claim (space-delimited string)
  // OR on `permissions` (array). Support both.
  const scopeStr = typeof payload.scope === "string" ? payload.scope : "";
  const permArr = Array.isArray((payload as Record<string, unknown>).permissions)
    ? ((payload as Record<string, unknown>).permissions as string[])
    : [];
  const scopes = Array.from(
    new Set([
      ...scopeStr.split(/\s+/).filter(Boolean),
      ...permArr.filter((s): s is string => typeof s === "string"),
    ]),
  );

  // If required scopes are configured, enforce them at the middleware layer
  // (per-call enforcement also happens in the route handler before each
  // side-effecting step; defense in depth).
  if (AUTH0_REQUIRED_SCOPES.length) {
    const missing = AUTH0_REQUIRED_SCOPES.filter((s) => !scopes.includes(s));
    if (missing.length) {
      return {
        response: bearerError(
          `Token missing required scope: ${missing[0]}`,
          "insufficient_scope",
          403,
          missing[0],
        ),
      };
    }
  }

  return { response: null, principal: sub, scopes, payload };
}

/**
 * Per-side-effect scope check. Call BEFORE running the side-effect step.
 * Returns true if the scope is present on the token; false otherwise.
 *
 * Pair this with the announce-intent-before-action discipline: the tool
 * description enumerates side-effects in 7 categories; this function
 * gates each category at runtime.
 */
export function hasScope(grantedScopes: string[], requiredScope: string): boolean {
  return grantedScopes.includes(requiredScope);
}
