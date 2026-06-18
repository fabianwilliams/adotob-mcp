# SME Testing Guide: ADOTOB Agent Storefront

This guide is for protocol/API reviewers testing the ADOTOB MCP storefront from
their own machine.

Live surfaces:

- Agent card: `https://mcp.adotob.com/.well-known/agent.json`
- MCP endpoint: `https://mcp.adotob.com/api/a2a/mcp`
- Raw HTTP fallback: `https://mcp.adotob.com/api/a2a/purchase`
- Source: `https://github.com/fabianwilliams/adotob-mcp`
- Methodology: `https://github.com/fabianwilliams/agentic-engineering-toolkit`

## What Changed After Darrel's Test

Darrel Miller tested the endpoint with an A2A client and found a useful
interoperability issue: the raw HTTP purchase route worked, but the A2A/MCP
protocol path could return 500s for his client shape.

The fix keeps the business action the same and hardens the protocol surface:

- `/.well-known/agent.json` now declares `supportedInterfaces` for MCP,
  A2A-compatible JSON-RPC, and raw HTTP.
- `/api/a2a/mcp` still supports MCP `initialize`, `tools/list`, and
  `tools/call`.
- `/api/a2a/mcp` now accepts A2A-style `SendMessage` and `message/send`.
- The MCP tool call parser accepts `arguments`, `input`, or `args`.
- The MCP tool name parser accepts `name`, `tool`, or `toolName`.
- Failure paths return structured receipts/tasks instead of uncaught 500s.

The goal is not to claim full A2A conformance. The goal is to make the public
storefront easier for A2A-aware clients to discover, test, and critique while
preserving the canonical MCP tool and raw HTTP fallback.

## What We Already Tested

Before pushing:

- `npm run lint`
- `npm run build`
- Local MCP `initialize`
- Local MCP `tools/list`
- Local A2A `SendMessage` with missing purchase details
- Local MCP `tools/call` variant using `tool` + `input`
- Local A2A `message/send` with invalid email, returning a structured failed
  task instead of a 500

After pushing:

- GitHub Actions deploy completed successfully:
  `https://github.com/fabianwilliams/adotob-mcp/actions/runs/27556425787`
- Live `/.well-known/agent.json` advertises `a2aJsonRpcCompatibility` and
  `supportedInterfaces`.
- Live A2A `SendMessage` returns `TASK_STATE_INPUT_REQUIRED` instead of a 500.

## Run From Any Machine

Requirements:

- Node.js 20+.
- Network access to `https://mcp.adotob.com`.
- No API key or bearer token.

Clone and run the read-only/default smoke:

```bash
git clone https://github.com/fabianwilliams/adotob-mcp.git
cd adotob-mcp
node scripts/smoke-agent-storefront.mjs
```

The default run is safe: it does not send a real fulfillment email because it
does not provide a valid email address. It checks discovery, MCP, A2A-compatible
input-required behavior, and controlled failure receipts.

The public endpoint is rate-limited at 12 calls/hour and 30 calls/24h per IP.
The default smoke stays below that cap. Live fulfillment mode skips the two
negative-path probes so a reviewer can usually run one default smoke and one
real fulfillment smoke from the same network without tripping the hourly limit.

Expected shape:

```text
[pass] agent card advertises MCP, A2A-compatible JSON-RPC, and raw HTTP
[pass] initialize returned adotob-mcp-storefront
[pass] tools/list exposes purchase_free_bundle
[pass] A2A SendMessage returns TASK_STATE_INPUT_REQUIRED instead of 500
[pass] invalid MCP call produced controlled failure receipt ...
[pass] A2A message/send returns a structured failed task for invalid email
[info] Skipping real fulfillment path because ADOTOB_TEST_EMAIL is not set.
```

## Run The Real Fulfillment Path

Use this only with an inbox you control. It upserts a lead, mints a download
token, sends an email, and returns a public receipt URL.

Use `ADOTOB_TEST_FIRST_NAME` exactly. `ADOTOB_TEST_FIRSTNAME` is ignored and the
script falls back to `Smoke`.

macOS/Linux:

```bash
ADOTOB_TEST_FIRST_NAME="Fabian" \
ADOTOB_TEST_EMAIL="you@example.com" \
node scripts/smoke-agent-storefront.mjs
```

PowerShell:

```powershell
$env:ADOTOB_TEST_FIRST_NAME = "Fabian"
$env:ADOTOB_TEST_EMAIL = "you@example.com"
node scripts/smoke-agent-storefront.mjs
Remove-Item Env:\ADOTOB_TEST_FIRST_NAME
Remove-Item Env:\ADOTOB_TEST_EMAIL
```

Windows Command Prompt:

```bat
set ADOTOB_TEST_FIRST_NAME=Fabian
set ADOTOB_TEST_EMAIL=you@example.com
node scripts\smoke-agent-storefront.mjs
set ADOTOB_TEST_FIRST_NAME=
set ADOTOB_TEST_EMAIL=
```

Expected live-mode shape:

```text
[pass] agent card advertises MCP, A2A-compatible JSON-RPC, and raw HTTP
[pass] initialize returned adotob-mcp-storefront
[pass] tools/list exposes purchase_free_bundle
[pass] A2A SendMessage returns TASK_STATE_INPUT_REQUIRED instead of 500
[info] Live fulfillment mode enabled; skipping negative-path probes to stay under the public rate limit.
[pass] live fulfillment receipt: ...
[info] receipt URL: ...
[info] Check the test inbox for the fulfillment email.
```

If the script fails, it prints the HTTP status and compact JSON response body.
For example, a `429` response means the public demo rate limit has been hit for
that network IP; wait for the hourly window or test from a different network.

## Raw Curl Checks

Discovery:

```bash
curl -sS https://mcp.adotob.com/.well-known/agent.json
```

MCP initialize:

```bash
curl -sS https://mcp.adotob.com/api/a2a/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"init","method":"initialize","params":{}}'
```

MCP tool list:

```bash
curl -sS https://mcp.adotob.com/api/a2a/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"tools","method":"tools/list","params":{}}'
```

A2A-compatible input-required check:

```bash
curl -sS https://mcp.adotob.com/api/a2a/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"a2a-input","method":"SendMessage","params":{"message":{"messageId":"manual-smoke","role":"ROLE_USER","parts":[{"text":"hello"}]}}}'
```

Controlled failure receipt:

```bash
curl -sS https://mcp.adotob.com/api/a2a/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"invalid","method":"tools/call","params":{"tool":"purchase_free_bundle","input":{"firstName":"Smoke","email":"not-an-email","idempotencyKey":"manual-smoke-001"}}}'
```

## Suggested Note To Darrel

```text
Darrel, thank you again for trying the ADOTOB storefront with your A2A client.
Your note was useful: the raw HTTP action worked, but the protocol path was too
brittle for the client shape you used.

We pushed a fix here:
https://github.com/fabianwilliams/adotob-mcp/commit/f3a7a4e

What changed:
- The agent card now advertises MCP, A2A-compatible JSON-RPC, and raw HTTP
  interfaces.
- The MCP endpoint still supports initialize/tools/list/tools/call.
- The same endpoint now accepts A2A-style SendMessage/message/send as a
  compatibility bridge.
- Failure paths return structured tasks/receipts instead of uncaught 500s.

We tested lint/build, local MCP calls, local A2A-compatible calls, and live
read-only smoke. The deploy completed successfully.

Would you be willing to try it again with your A2A client and be blunt about
the protocol/API shape? I am especially interested in:
- whether the agent card gives your client enough information;
- whether the SendMessage response shape is useful or wrong;
- whether the MCP/A2A terminology is confusing;
- what would need to change before you would call this a serious
  agent-accessible commerce surface rather than a demo.

Public test guide:
https://github.com/fabianwilliams/adotob-mcp/blob/main/docs/SME-TESTING.md

Endpoint:
https://mcp.adotob.com/api/a2a/mcp

Agent card:
https://mcp.adotob.com/.well-known/agent.json
```

## Reviewer Notes

Known limitations:

- The primary protocol is still MCP JSON-RPC over HTTP.
- The A2A support is a compatibility bridge, not a full A2A task lifecycle
  server.
- The public demo is unauthenticated and protected by rate limits and a daily
  cost ceiling. The current public limit is 12 calls/hour and 30 calls/24h per
  IP. Partner deployments should add scoped auth.

What matters for this test:

- Discovery should be clear.
- Unsupported or incomplete calls should not produce 500s.
- Side-effecting success calls should produce a receipt URL.
- Failure calls should also produce an honest receipt/task.
