# Adotob MCP Storefront

> A public MCP-callable storefront. Any MCP-capable client can call it and receive an audit-trail receipt showing every supervision-layer check that fired. The same endpoint serves two distinct buyer concerns from the same artifact: **security/audit** (was every check satisfied?) and **finance/billing** (what exactly did the agent do, when?).

**Live endpoint:** `https://mcp.adotob.com/api/a2a/mcp`

**Agent-discovery card (Google A2A `/.well-known/agent.json`):** `https://mcp.adotob.com/.well-known/agent.json`

**Try it in 2 minutes →** [Happy-Path SOP (with screenshots from two real worked examples)](docs/HAPPY-PATH-SOP.md)

**Protocol / SME test guide →** [SME Testing Guide](docs/SME-TESTING.md)

**See it produce a receipt:**
- Claude Desktop (hosted): [`rcpt_2026-05-16_0a96ef3d`](https://mcp.adotob.com/a2a/receipt/rcpt_2026-05-16_0a96ef3d)
- LM Studio + Qwen3.6 27B (fully local, no cloud): [`rcpt_2026-05-16_7f1fd149`](https://mcp.adotob.com/a2a/receipt/rcpt_2026-05-16_7f1fd149)

Same endpoint. Same six checks. Same receipt format. Different clients. That's the protocol-neutrality claim made concrete.

---

## What this is

A reference implementation of a **consumer-observable agent receipt** — a public URL that documents every supervision-layer check that ran when an agent purchased on behalf of a user.

The receipt is bucketed into three methodology phases:

1. **Admission gates** — input validation, rate limiting, daily cost ceiling
2. **Processing** — lead capture (Brevo), download token mint (JOSE HS256)
3. **Fulfillment** — fulfillment email dispatch (Brevo transactional)

Every successful purchase fires all six checks. Failure paths still produce a receipt — the audit trail is honest about partial failures.

## Why this exists

The dominant question from CISOs reviewing agent vendors is: *"show me your evals — how do you know the agent did the right thing?"*

The dominant question from CIOs / CFOs reviewing per-action agent billing is: *"when an agent transacts, what is the proof of what it did?"*

These are the same question dressed in different ledgers. This storefront answers both with one artifact: a publicly readable URL that every party — buyer, seller, partner, security reviewer, finance team, regulator — sees identically without privileged access.

The methodology behind it is in the [Agent Reliability Kit](https://github.com/fabianwilliams/agentic-engineering-toolkit) (Apache 2.0). The license is the partnership that ships it — see [estore.adotob.com/partners](https://estore.adotob.com/partners).

## Stack

- **Next.js 16** + React 19 + Tailwind v4 + TypeScript (App Router)
- **Azure Static Web Apps** (Free tier) — hosting
- **Azure Blob Storage** — receipt store (30-day public-read TTL)
- **Azure Table Storage** — per-IP rate-limit counters
- **Application Insights** — server + browser telemetry
- **Brevo** — lead capture (list 23, MCP Demo Leads) + transactional fulfillment email
- **JOSE HS256** — download-token mint (shared signing secret with eStore)

All free tier; expected burn is ~$0/month.

## Code layout

```
src/
  app/
    api/a2a/
      mcp/route.ts          JSON-RPC 2.0 MCP handler (initialize, tools/list, tools/call)
      purchase/route.ts     Raw HTTP equivalent (skips the MCP envelope)
    a2a/receipt/[id]/
      page.tsx              Public receipt page (the artifact)
      not-found.tsx         30-day expiry 404
  lib/
    a2a-purchase.ts         6-check orchestrator
    receipt-store.ts        Azure Blob read/write
    rate-limit.ts           Azure Table counter, 5/hr + 10/24h per IP
    cost-ceiling.ts         $5/day demo cap
    brevo-mcp.ts            Contact upsert + onboarding email
    download-tokens.ts      JOSE HS256 mint
    audit-trail.ts          Canonical check labels + types
    idempotency.ts          NEXUM-004 fix: (key, email) -> receipt_id Table Storage
samples/
  auth0/                    Reference Auth0 + OAuth 2.1 + PKCE integration
                            for partners. NOT wired into the live storefront.
                            Maps the 7 announce-intent-before-action side-effect
                            categories onto Auth0 scopes. Translates the
                            ConferenceHaven OAuth pattern into TypeScript.
  components/
    receipt-timeline.tsx    3-phase bucketed audit trail
    receipt-header.tsx      Requester / bundle / issued tile
    receipt-share.tsx       Copy-link + share-on-X
docs/
  HAPPY-PATH-SOP.md         Operator-verified walkthrough (16 screenshots)
  SME-TESTING.md            Public smoke-test guide + Darrel SME review note
public/
  img/sop/                  Worked-example screenshots
```

## Local development

```bash
git clone https://github.com/fabianwilliams/adotob-mcp.git
cd adotob-mcp
npm install
cp .env.example .env.local   # fill in BREVO_API_KEY, DOWNLOAD_TOKEN_SECRET, etc.
npm run dev
```

Open `http://localhost:3000`. The MCP endpoint is at `/api/a2a/mcp`.

## Deploy

GitHub Actions deploys to `swa-adotob-mcp` on every push to `main`. Workflow at [`.github/workflows/azure-static-web-apps.yml`](.github/workflows/azure-static-web-apps.yml).

## License

Apache 2.0 — matches the [Agent Reliability Kit](https://github.com/fabianwilliams/agentic-engineering-toolkit). The licensed (commercial) Kit includes the non-sanitized examples + white-label rights + partner support.

## Contributions

Issues and PRs welcome. The reference implementation deliberately stays minimal — the value is in the audit-trail shape and the consumer-readable receipt, not in framework cleverness. If you fork this for your own agent storefront, the only thing you must keep is the receipt-as-public-URL discipline. The rest is implementation detail.
