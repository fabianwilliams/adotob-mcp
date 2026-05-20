/**
 * Auth0 OAuth 2.1 configuration for an Adotob-MCP-shaped storefront.
 *
 * Direct TypeScript translation of the production oauth_config.py used at
 * mcp.conferencehaven.com (also Apache 2.0). Same primitives, same RFC 9728
 * OAuth Protected Resource Metadata shape, ported to Node.js.
 *
 * This file is a SAMPLE. The live mcp.adotob.com storefront does NOT use
 * Auth0 today. Partners deploying the kit behind Auth0 import these helpers
 * into their own runtime.
 *
 * Reference: knowledge/wiki/concepts/delegated-authority-with-constraints.md
 *            agents/announce-intent-before-action/README.md (the 7 categories)
 */

const env = (name: string): string | undefined => {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
};

export const AUTH0_DOMAIN = env("AUTH0_DOMAIN");
export const AUTH0_AUDIENCE = env("AUTH0_AUDIENCE");
export const AUTH0_REQUIRED_SCOPES = (env("AUTH0_REQUIRED_SCOPES") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const AUTHORIZATION_ENDPOINT = AUTH0_DOMAIN
  ? `https://${AUTH0_DOMAIN}/authorize`
  : null;
export const TOKEN_ENDPOINT = AUTH0_DOMAIN
  ? `https://${AUTH0_DOMAIN}/oauth/token`
  : null;
export const JWKS_URI = AUTH0_DOMAIN
  ? `https://${AUTH0_DOMAIN}/.well-known/jwks.json`
  : null;
export const ISSUER = AUTH0_DOMAIN ? `https://${AUTH0_DOMAIN}/` : null;

/**
 * Map of side-effect category (from announce-intent-before-action) to the
 * Auth0 scope that gates it. Partner adapts the scope strings to their
 * tenant naming; keys must stay aligned with the discipline's 7 categories.
 */
export const SIDE_EFFECT_SCOPE_MAP = {
  data: "read:bundles",
  identity: "write:contacts",
  communication: "send:transactional-email",
  issuance: "mint:download-token",
  public: "publish:receipt-url",
  money: "charge:trial", // change to "charge:paid" for paid flows
  trigger: "enqueue:async-fulfillment",
} as const;

export type SideEffectCategory = keyof typeof SIDE_EFFECT_SCOPE_MAP;

/**
 * RFC 9728 OAuth Protected Resource Metadata.
 *
 * Serve this from /.well-known/oauth-protected-resource so MCP clients
 * (and the OAuth discovery flows in ChatGPT, Claude Desktop, etc.) can
 * find the authorization server and the supported scopes.
 *
 * Throws if AUTH0_DOMAIN or AUTH0_AUDIENCE are unset. Configure them in
 * the runtime's secret manager (Key Vault / Secrets Manager / Workers
 * Secrets / etc.) before deploying.
 */
export function getOAuthMetadata(): Record<string, unknown> {
  if (!AUTH0_DOMAIN || !AUTH0_AUDIENCE) {
    throw new Error(
      "Auth0 configuration incomplete. Set AUTH0_DOMAIN and AUTH0_AUDIENCE.",
    );
  }
  return {
    resource: AUTH0_AUDIENCE,
    authorization_servers: [ISSUER],
    bearer_methods_supported: ["header"],
    resource_documentation:
      "https://github.com/fabianwilliams/adotob-mcp/blob/main/docs/HAPPY-PATH-SOP.md",
    resource_signing_alg_values_supported: ["RS256"],
    authorization_server_metadata: {
      issuer: ISSUER,
      authorization_endpoint: AUTHORIZATION_ENDPOINT,
      token_endpoint: TOKEN_ENDPOINT,
      jwks_uri: JWKS_URI,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"], // public client (PKCE)
      scopes_supported: AUTH0_REQUIRED_SCOPES.length
        ? AUTH0_REQUIRED_SCOPES
        : Object.values(SIDE_EFFECT_SCOPE_MAP),
    },
  };
}
