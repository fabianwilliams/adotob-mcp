# ADOTOB Agent-Accessibility Map

This storefront is the reference ADOTOB proof that a normal business action can
be made callable by agents without losing proof, control, or human readability.

## Thesis

ADOTOB does not sell "a model." It sells reliable business action surfaces:
discoverable actions, deterministic side effects, cost and rate controls,
receipts, and audit trails that a human can inspect after an agent acts.

This is the Proven / Better / New framing:

- Proven: websites already need lead capture, downloads, checkout, receipts,
  donations, signups, and forms.
- Better: the same flows become callable, rate-limited, idempotent, auditable,
  and inspectable by humans.
- New: MCP, A2A-compatible discovery, WebMCP-style browser tools, and local
  model clients can all reach the same business action.

## Current Surfaces

| Surface | URL | Purpose | Status |
| --- | --- | --- | --- |
| AI Catalog | `/.well-known/ai-catalog.json` | ARD/AI Catalog discovery metadata for MCP, A2A-compatible, and HTTP resources | Live in this repo |
| Agent card | `/.well-known/agent.json` | A2A-compatible discovery metadata for A2A-style clients | Live in this repo |
| MCP endpoint | `/api/a2a/mcp` | MCP JSON-RPC `initialize`, `tools/list`, `tools/call` | Live |
| A2A compatibility bridge | `/api/a2a/mcp` | Accepts `SendMessage` and `message/send` JSON-RPC calls | Live in this repo |
| Raw HTTP endpoint | `/api/a2a/purchase` | Direct POST for non-MCP clients | Live |
| Public receipt | `/a2a/receipt/{receipt_id}` | Human-readable proof of action | Live |

## Action Contract

Primary action: `purchase_free_bundle`

Required input:

- `first_name`
- `email`

Optional input:

- `bundle`, currently `free-trial-sample`
- `idempotency_key`, strongly recommended for production callers

Side effects:

- Validates input.
- Applies rate limit.
- Applies demo cost ceiling.
- Upserts lead/contact in Brevo.
- Mints a time-limited download URL.
- Sends fulfillment email.
- Returns a public receipt URL.

The receipt is the product proof. It shows every check that fired and whether
the action completed.

## Darrel Finding

Darrel Miller tested the endpoint with an A2A client. The raw HTTP route worked,
but the A2A/MCP protocol path returned 500s for his client shape. Treat this as
a high-signal interoperability bug:

- Core business action: working.
- Receipt discipline: working.
- Protocol compatibility: needed hardening.

The fix in this repo makes `/api/a2a/mcp` more tolerant:

- MCP `tools/call` can use `arguments`, `input`, or `args`.
- Tool name can come from `name`, `tool`, or `toolName`.
- A2A-style JSON-RPC can use `SendMessage` or `message/send`.
- A2A message text, `params.purchase`, or `params.metadata` can carry
  `first_name`, `email`, `bundle`, and `idempotency_key`.

## Self-Test Gate Before SME Review

Do not ask Darrel to re-test until these pass:

1. `npm run lint`
2. `npm run build`
3. Local MCP `initialize` returns server info.
4. Local MCP `tools/list` returns `purchase_free_bundle`.
5. Local MCP `tools/call` returns a receipt or a controlled failure receipt.
6. Local A2A `SendMessage` with `params.purchase` returns a completed or failed
   task object, never a 500.
7. Live `/.well-known/agent.json` resolves and points to the A2A-compatible endpoint.
8. Live `/.well-known/ai-catalog.json` resolves and lists the MCP server, A2A-compatible card, and raw HTTP fallback.
9. Live raw HTTP fallback still works.

## SME Test Ask

After self-test, ask Darrel for a protocol-focused review:

- Does the agent card expose enough for your A2A client to choose the right
  interface?
- Does the A2A compatibility response shape make sense for your client?
- Where are we mixing A2A and MCP terminology in a way that will confuse serious
  implementers?
- What would you require before calling this an agent-accessible commerce
  surface rather than a demo?

Avoid asking for a general product opinion first. Ask him to break the protocol
surface.
