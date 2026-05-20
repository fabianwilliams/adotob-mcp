# Auth0 Integration Sample: Adotob MCP Storefront

> A reference implementation for partners deploying their own Agent Reliability Kit-shaped storefront behind Auth0. Closes the identity control point per Nate B Jones's [Five Agent Control Points](https://github.com/fabianwilliams/agentic-engineering-toolkit/blob/main/agents/where-the-kit-fits/README.md) framework.

> **Status: SAMPLE.** Not wired into the live `mcp.adotob.com` storefront. Partners adapt this pattern to their own Auth0 tenant + MCP-server deployment.

---

## What this sample is

This folder contains the reference pattern for plugging **Auth0 AI Agents** (OAuth 2.1 + PKCE with delegated-authority-with-constraints) in front of an MCP-callable storefront that follows the Agent Reliability Kit's announce-intent-before-action discipline.

The pattern is borrowed from the production OAuth 2.1 + PKCE implementation that runs at `mcp.conferencehaven.com` (also Apache 2.0, also Auth0-backed). ConferenceHaven uses the same primitives to gate analytics access for conference organizers; this sample translates the pattern to TypeScript / Next.js 16 and shows how it slots in front of `purchase_free_bundle`.

## Why this sample exists

The public `mcp.adotob.com` demo runs with **zero auth** on the free-trial bundle endpoint, gated only by rate-limit + cost-ceiling. That is fine for a public demo. It is **not** fine for:

- A partner running a paid version of the storefront (MVP-2 with Stripe-via-MCP)
- A partner deploying the methodology inside a client's network where per-user / per-engagement scoping is required
- Any production deployment where the buyer's compliance review will ask *"who is the agent acting for?"*

For all of those, the partner needs the identity control point. Auth0 (and the Auth0-owned Okta for AI Agents product) is the reference operator. This sample shows what the wiring looks like.

## What this sample is NOT

- **Not a production drop-in.** Auth0 tenant config, scope design, and consent flows are partner-specific.
- **Not wired into the live storefront.** The `purchase_free_bundle` tool at `mcp.adotob.com/api/a2a/mcp` remains open. This sample is for partners forking the repo.
- **Not the only way.** Okta for AI Agents, WorkOS, Microsoft Entra Agent ID, and AWS AgentCore Identity all solve the same problem with similar primitives. The pattern in this sample is portable.

---

## The architectural pattern

```
┌─────────────────────────────────────────────────────────────────┐
│ Caller (agent on behalf of a partner's user)                    │
│   1. Discovers /.well-known/oauth-protected-resource (RFC 9728) │
│   2. Redirects to Auth0 /authorize with PKCE S256 challenge     │
│   3. User grants consent for specific scopes                    │
│   4. Auth0 issues an access token scoped to those grants        │
│   5. Agent calls /api/a2a/mcp with Authorization: Bearer <jwt>  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Middleware (samples/auth0/middleware-auth0.ts)                  │
│   - Validates JWT against Auth0 JWKS                            │
│   - Checks issuer + audience match                              │
│   - Confirms required scope is present on the token             │
│   - Attaches the validated principal to the request context     │
│   - Returns 401 / 403 with WWW-Authenticate header on failure   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ MCP route handler (src/app/api/a2a/mcp/route.ts)                │
│   - Already exists                                              │
│   - Reads the principal from request context                    │
│   - Passes principal_id into PurchaseInput for receipt rendering│
│   - Per-call scope check happens before each side-effecting step│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Receipt (existing audit-trail discipline)                       │
│   - Receipt now includes principal_id alongside the 6 checks    │
│   - "Who the agent was acting for" becomes part of the audit    │
│     trail, not just a server-internal fact                      │
└─────────────────────────────────────────────────────────────────┘
```

## Scope design: mapping the announce-intent-before-action 7 categories onto Auth0 scopes

The 7 side-effect categories from the [announce-intent-before-action discipline](https://github.com/fabianwilliams/agentic-engineering-toolkit/tree/main/agents/announce-intent-before-action) become the scope language Auth0 enforces:

| Side-effect category | Auth0 scope | What the scope grants |
|---|---|---|
| Data | `read:bundles` | Read the bundle catalog and pricing |
| Identity | `write:contacts` | Upsert the caller's contact into the CRM |
| Communication | `send:transactional-email` | Dispatch the fulfillment email |
| Issuance | `mint:download-token` | Issue a JOSE HS256 download token |
| Public | `publish:receipt-url` | Persist a public-readable receipt to blob storage |
| Money | `charge:trial` or `charge:paid` | Run the payment side-effect (MVP-2; `charge:trial` = no charge but still a scoped grant) |
| Trigger | `enqueue:async-fulfillment` | Enqueue any async follow-on work |

A partner's Auth0 tenant defines these scopes, and the consent screen the caller sees enumerates exactly what the agent is being granted. **The agent's scopes ARE the announce-intent contract enforced at the identity layer.** Same primitive, different surface.

## Files in this folder

| File | Purpose |
|---|---|
| [`oauth-config.ts`](./oauth-config.ts) | Auth0 environment variables + RFC 9728 OAuth Protected Resource Metadata endpoint. Direct translation of the production [ConferenceHaven `oauth_config.py`](https://github.com/fabianwilliams/ConferenceHaven/blob/main/mcp-server/src/oauth_config.py) into TypeScript. |
| [`middleware-auth0.ts`](./middleware-auth0.ts) | Bearer-token validation middleware. Plug into `src/middleware.ts` to gate `/api/a2a/*` behind Auth0 JWT validation. Uses `jose` (already a dependency). |
| [`route-mcp-with-auth0.ts`](./route-mcp-with-auth0.ts) | Reference variant of the MCP route handler with per-scope checks before each side-effecting step. Drop-in replacement for `src/app/api/a2a/mcp/route.ts` when the partner is ready to require auth. |
| [`.env.example`](./.env.example) | Auth0-specific env vars (`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_REQUIRED_SCOPES`). |
| [`well-known-oauth-protected-resource.ts`](./well-known-oauth-protected-resource.ts) | The discovery endpoint partners publish at `/.well-known/oauth-protected-resource` so MCP clients can find the authorization server. Equivalent to ConferenceHaven's already-shipped pattern. |

## How to adapt this for your Auth0 tenant

1. **Create an Auth0 API** for your storefront. Set the identifier to your storefront's audience URL (for example `https://mcp.yourcompany.com/api`). Enable RBAC. Set token signing algorithm to RS256.
2. **Create an Auth0 Application** (Single Page App / Regular Web App). Configure PKCE with S256.
3. **Define the 7 scopes** named in the table above (or your own naming) on the API resource. Enable each one for the Application.
4. **Set the env vars** in this folder's `.env.example` and ship them via your runtime's secret manager (Azure Key Vault, AWS Secrets Manager, Cloudflare Workers Secrets, etc.).
5. **Plug `middleware-auth0.ts`** into your `src/middleware.ts` so `/api/a2a/*` rejects unauthenticated requests.
6. **Replace `src/app/api/a2a/mcp/route.ts`** with `route-mcp-with-auth0.ts` (or merge the scope-check pattern into your existing handler).
7. **Publish the OAuth metadata** at `/.well-known/oauth-protected-resource` using `well-known-oauth-protected-resource.ts`.
8. **Update your `tools/list`** response to include scope requirements per skill so callers know which scopes to request.

## Production checklist before going live

- [ ] Auth0 tenant has the scopes defined and enabled on the Application
- [ ] All seven side-effect categories from the announce-intent-before-action discipline are mapped to scopes
- [ ] JWKS endpoint is reachable from the storefront's runtime (no firewall block)
- [ ] Middleware returns RFC-6750-compliant `WWW-Authenticate` headers with `error="insufficient_scope"` when needed
- [ ] Receipt rendering includes `principal_id` (the `sub` claim from the validated JWT) so the audit trail names who acted
- [ ] Rate-limit + cost-ceiling checks still fire (Auth0 does not replace them; they layer)
- [ ] Token-revocation flow tested: revoked tokens are rejected on the next call within 60 seconds (Auth0's default)
- [ ] Token-vault integration: secrets used by the agent are never returned to the agent context

## Why we are using this pattern (not building from scratch)

The Auth0 / Okta team has been building the identity control point publicly for the agentic era. The [Auth0 AI Agents documentation](https://auth0.com/ai/docs) and the parallel [Okta for AI Agents](https://www.okta.com/products/auth-for-ai/) launch (April 2026) define the delegated-authority-with-constraints pattern that the Reliability Kit's announce-intent-before-action discipline names at the spec layer. **The two disciplines are the same primitive at two layers**: the kit names side-effects in the tool description, Auth0 enforces them as scopes on the bearer token.

Borrowing rather than rebuilding gives partners a path that is already known to Auth0-using compliance reviewers, already documented, already tooled with consent screens, already integrated with major IdPs. The kit's contribution at this layer is the *naming convention* that maps cleanly onto Auth0's scope grants.

## Related disciplines and references

- [agents/where-the-kit-fits](https://github.com/fabianwilliams/agentic-engineering-toolkit/blob/main/agents/where-the-kit-fits/README.md): architectural map placing this sample at the identity control point
- [agents/announce-intent-before-action](https://github.com/fabianwilliams/agentic-engineering-toolkit/blob/main/agents/announce-intent-before-action/README.md): the discipline whose 7 categories become the scope vocabulary
- [knowledge wiki: delegated-authority-with-constraints](https://github.com/fabianwilliams/agentic-engineering-toolkit/blob/main/obsidian-claude-second-brain): Nate B Jones's framing of the pattern
- [ConferenceHaven OAuth Implementation Journey](https://github.com/fabianwilliams/ConferenceHaven/blob/main/mcp-server/docs/OAUTH-IMPLEMENTATION-JOURNEY.md): the production reference this sample translates

## License

Apache 2.0, same as the parent repo.

## Credits

- The Auth0 AI Agents team for building the identity control point publicly and documenting the delegated-authority-with-constraints pattern.
- The Okta for AI Agents launch (April 2026) for converging on the same primitive at the parent-company scale.
- Nate B Jones for naming "five control points" and "supervision debt" in his 2026-05-20 video.
- The production ConferenceHaven OAuth 2.1 + PKCE implementation from December 2025 that proved the pattern at scale before agent-card discovery was a named primitive.
