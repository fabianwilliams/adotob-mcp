---
title: "MCP Storefront Happy Path — How to Try the Demo From Any MCP-Capable Client"
date: 2026-05-16
audience: Partners evaluating the methodology, builders curious about MCP, security/procurement reviewers needing to see the audit-trail receipt
status: operator-verified — two worked examples below (Claude Desktop + LM Studio with local Qwen3.6 27B)
---

# How to Try the Adotob MCP Storefront — Step by Step

> The endpoint is **provider-neutral**: any client that speaks Streamable HTTP MCP can call it. The two worked examples below prove this — the same `https://mcp.adotob.com/api/a2a/mcp` URL produces an identical audit-trail receipt whether the client is **Anthropic-hosted Claude Desktop** or a **fully offline local model** (Qwen3.6 27B running inside LM Studio on a MacBook).

---

## What you are testing

A public MCP server that processes a real free-trial-bundle request, returns an audit-trail receipt showing every supervision-layer check that fired, and emails the download link.

**The artifact you walk away with:** a shareable receipt URL like `https://mcp.adotob.com/a2a/receipt/rcpt_2026-05-16_<id>` that lists the six supervision checks bucketed into three methodology phases — admission gates, processing, fulfillment — with timestamps and pass/fail badges. You can hand this URL to a colleague or security reviewer; the page is publicly readable and contains no PII beyond the requester's first name.

## What you need

- **An MCP-capable client.** Any of: Claude Desktop / Claude.ai / Claude Code, ChatGPT (Pro / Team / Enterprise — custom connectors), LM Studio (0.3.17+), Cursor, Windsurf, Cline, Continue, Zed, or custom code via the MCP SDK / OpenAI Responses API. The endpoint speaks Streamable HTTP MCP (JSON-RPC 2.0 over a single POST URL), so any conformant client works — nothing Anthropic-specific.
- An email address you can check for the download link.
- About 2 minutes.

You do **not** need: a bearer token, API key, manual tool definition, or any LLM-provider API access (unless you are doing Path B with raw HTTP).

---

## Path A — Zero-friction (any MCP-capable client)

### The flow in 5 steps (applies to every client)

1. Open your client's MCP / connector settings.
2. Paste the endpoint URL: `https://mcp.adotob.com/api/a2a/mcp`. Save.
3. Confirm the client discovered the `purchase_free_bundle` tool.
4. Ask the model to use the tool with your first name + email.
5. Check your email and open the audit-trail receipt URL.

That's it. The next two sections show this flow end-to-end with real screenshots from two very different clients.

### Where the "Add MCP server" UI lives in each client

| Client | Where the UI lives |
|---|---|
| Claude Desktop / Claude.ai | Settings → Connectors → **Add custom connector** |
| Claude Code | `claude mcp add --transport http adotob https://mcp.adotob.com/api/a2a/mcp` |
| ChatGPT (Pro / Team / Enterprise) | Settings → Connectors → **Add MCP server** |
| LM Studio (0.3.17+) | Right sidebar → **Program** → edit `mcp.json` (JSON config shown below) |
| Cursor | Settings → MCP → **Add new MCP server** (JSON config) |
| Windsurf / Cline / Continue / Zed | MCP / Tools section in the client's settings |
| Custom code (OpenAI Responses API, Anthropic SDK, etc.) | See **Path B** below |

UI labels shift between releases. The constant: paste the endpoint URL.

---

## Worked Example 1 — Claude Desktop (Anthropic-hosted)

Run captured 2026-05-16, ~10:15 AM ET. Receipt: `rcpt_2026-05-16_0a96ef3d`.

### 1. Add the custom connector

Settings → Connectors → "Add custom connector." Paste the URL, name it (any name — "ADOTOB Store" used here), click Add.

![Add custom connector dialog in Claude Desktop, URL pasted](../public/img/sop/claude_desktop_1_setupconnector.png)

### 2. Confirm the tool was discovered

After saving, the connector page shows the endpoint, the `purchase_free_bundle` tool, and a permission toggle. (Setting it to "Always allow" is optional — "Ask each time" works too.)

![purchase_free_bundle tool discovered, permission set to Always allow](../public/img/sop/claude_desktop_2_setupconnector_finishwithpermissions.png)

### 3. Compose the prompt

Open a fresh chat. Template wording:

```
Use the Adotob MCP demo to request the free-trial bundle.
My first name is [Your Name] and my email is [yourgmail]@gmail.com.
```

![Empty prompt with the template wording](../public/img/sop/claude_desktop_3_prompt_to_run_template.png)

Fill in real values. Example run uses "Keyser."

![Prompt with real first name + email substituted in](../public/img/sop/claude_desktop_4_prompt_to_run_actual.png)

### 4. Watch the tool call execute

Claude announces the call ("Got it — submitting your request now") and invokes `purchase_free_bundle`.

![Claude invoking the purchase_free_bundle tool](../public/img/sop/claude_desktop_5_prompt_running.png)

### 5. See the receipt summary inline

Claude renders the `markdown_summary` returned by the tool — receipt ID, status, bundle name, and direct links to the download and the full receipt page.

![Receipt summary rendered inline in the Claude conversation](../public/img/sop/claude_desktop_6_success.png)

### 6. The fulfillment email arrives

Within ~30 seconds, the email lands. It carries the signed 24h download link and the public audit-trail receipt URL.

![Gmail showing the fulfillment email with download button + receipt link](../public/img/sop/claude_desktop_7_success_emailproof.png)

### 7. The download is real

Clicking "Download bundle" pulls a real zip — architecture overview, sample-agent writer, README, HEARTBEAT.md, and the v1.0 bundle.

![Free-trial-sample bundle contents in the Downloads folder](../public/img/sop/claude_desktop_8_success_pkg_download.png)

### 8. The public audit-trail receipt — the artifact

This is what every partner conversation will reference. Header tile (requester / bundle / issued), the "your bundle is ready" CTA, then the audit trail bucketed into three methodology phases:

- **1 · Admission gates** — input validation, rate limit, daily cost ceiling
- **2 · Processing** — lead capture (Brevo), download token issued
- **3 · Fulfillment** — fulfillment email dispatched

Every check renders with a green PASS badge and a timestamp. The requester's email never appears on this page; only the first name.

![Full audit-trail receipt page with all 6 checks bucketed into 3 phases](../public/img/sop/claude_desktop_9_success_Full_EmailRecpt.png)

**Live URL (publicly readable, no auth):** [rcpt_2026-05-16_0a96ef3d](https://mcp.adotob.com/a2a/receipt/rcpt_2026-05-16_0a96ef3d)

---

## Worked Example 2 — LM Studio + Qwen3.6 27B (fully local, no cloud)

Same flow, completely different stack. This run was driven by **Qwen3.6 27B** open-weights model loaded into **LM Studio 0.3.x** on a MacBook Pro M3 Max. No request ever left the operator's machine *except* the single MCP `tools/call` to `mcp.adotob.com`. No Anthropic, no OpenAI, no cloud-inference vendor in the path.

That is the protocol-neutrality claim made concrete.

Run captured 2026-05-16, ~10:41 AM ET. Receipt: `rcpt_2026-05-16_7f1fd149`.

### 1. Load the local model

LM Studio model loader for Qwen3.6 27B (Q4_K_M GGUF, 4096-token context, full GPU offload on M3 Max).

![LM Studio loading Qwen3.6 27B locally](../public/img/sop/LMStudio_QWEN3-6_LocalModel_1_setupconnector.png)

### 2. Configure the MCP server (JSON config, not a UI dialog)

LM Studio uses an `mcp.json` config file. The full config is three lines:

```json
{
  "mcpServers": {
    "adotob": {
      "url": "https://mcp.adotob.com/api/a2a/mcp"
    }
  }
}
```

After saving, the Integrations panel shows `mcp/adotob` enabled and `purchase_free_bundle` discovered.

![mcp.json config + purchase_free_bundle tool discovered in the LM Studio Integrations panel](../public/img/sop/LMStudio_QWEN3-6_LocalModel_2_setupconnector_done.png)

### 3. Send the prompt

Same template, different test identity ("JahMekYan").

![Prompt sent to the local Qwen model with the mcp/adotob integration enabled](../public/img/sop/LMStudio_QWEN3-6_LocalModel_3_PromptStarting.png)

### 4. The local model decides to call the tool

Qwen3.6's reasoning is visible: it parses the request, identifies the right tool, fills in the arguments. Watching a local 27B open-weights model do tool selection cleanly is the demo within the demo.

![Qwen3.6 thinking through the request and generating the tool call arguments](../public/img/sop/LMStudio_QWEN3-6_LocalModel_4_PromptRunning.png)

### 5. The tool call succeeds — same receipt schema

Response includes status, bundle, source = `mcp`, signed download URL, and the public receipt URL. The GPU dashboard in the corner confirms this ran on local Apple Silicon (no cloud inference).

![Tool call result rendered in LM Studio — receipt URL + download URL + GPU activity](../public/img/sop/LMStudio_QWEN3-6_LocalModel_5_Success.png)

### 6. The same fulfillment email lands

Identical email template, different first name.

![Gmail showing the fulfillment email for the LM Studio run](../public/img/sop/LMStudio_QWEN3-6_LocalModel_6_Success_EmailProof.png)

### 7. The same audit-trail receipt format

Same page layout, same three phases, same six checks, all green. The endpoint genuinely does not care which client called it.

![Audit-trail receipt page for the LM Studio run](../public/img/sop/LMStudio_QWEN3-6_LocalModel_7_Success_RecptProof.png)

**Live URL:** [rcpt_2026-05-16_7f1fd149](https://mcp.adotob.com/a2a/receipt/rcpt_2026-05-16_7f1fd149)

---

## Why two examples matter

A partner-facing demo gets one objection more than any other: *"Does this work in our stack? We're not on Claude."*

The two examples above are the answer. **Same endpoint. Same six supervision checks. Same audit-trail receipt format.** One run drove the tool from a hosted Anthropic frontier model; the other drove it from a 27B open-weights model running fully offline on a laptop. The integration surface is the MCP protocol, not any one vendor's SDK.

What this means in practice for a license evaluation:

- Your team's existing agent stack (OpenAI, Azure OpenAI, Bedrock, on-prem open weights, mixed) is already compatible. No rebuild.
- Your client's security review is a URL forward, not a deck.
- The audit trail is observable from the *consumer* side without any privileged access — every partner, every client, every regulator sees the same page.

---

## Path B — Raw API (custom code, any LLM provider)

Use this path if you are building tool-using code outside an off-the-shelf MCP client — for example, an internal agent your firm built on the OpenAI Responses API, the Anthropic Messages API, Azure OpenAI, Amazon Bedrock, Google Gemini's function-calling API, or any HTTP-aware runtime. The endpoint is provider-neutral; the JSON below works regardless of which model is calling it.

### Tool definition

```json
{
  "name": "purchase_free_bundle",
  "description": "Request the Adotob Agent Reliability Kit free-trial bundle. Returns an audit-trail receipt with download URL.",
  "input_schema": {
    "type": "object",
    "properties": {
      "first_name": {"type": "string", "minLength": 1, "maxLength": 100},
      "email":      {"type": "string", "format": "email"},
      "bundle":     {"type": "string", "enum": ["free-trial-sample"], "default": "free-trial-sample"}
    },
    "required": ["first_name", "email"]
  }
}
```

### MCP call shape

```http
POST https://mcp.adotob.com/api/a2a/mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "purchase_free_bundle",
    "arguments": {
      "first_name": "Your Name",
      "email":      "you@example.com"
    }
  }
}
```

### Raw HTTP variant (skip the MCP envelope)

```http
POST https://mcp.adotob.com/api/a2a/purchase
Content-Type: application/json

{"first_name": "Your Name", "email": "you@example.com"}
```

Both return the same receipt JSON shape.

---

## Honest disclosures

- **Rate limit:** 5 calls/hour per IP, 10 per 24h. Sharing across colleagues is fine; bot-blasting is not.
- **Daily cost ceiling:** $5/day. If hit, returns HTTP 503 with `{"error":"Demo paused", ...}` until the window rolls.
- **Download token expires in 24 hours.** If you let it lapse, request a fresh bundle.
- **Receipt URL expires after 30 days** to keep the public blob store bounded.
- **No PII leaks publicly.** The audit-trail receipt shows your first name, bundle, and the supervision checks — never your email, never payment info (no payment in this demo).
- **The demo runs in an isolated Azure Resource Group** (`rg-adotob-mcp`). If it falls over, the eStore is unaffected.

## What this proves

Reading the receipt is reading the methodology in production. Every supervision check named in the Reliability Kit fires on every purchase. The receipt is what a partner forwards to their client's security team when asked *"show me your evals — how do you know the agent did the right thing?"*

The answer is no longer "we monitor the LLM output" or "we have a test suite." The answer is a URL.

## What you can do next

- **Share a receipt URL** with a colleague. The pages are publicly readable; the share is the marketing.
- **Try a failure path:** call the endpoint with `"email": "not-an-email"`. The receipt still produces, with `input_validation` showing FAIL and the 5 downstream checks showing SKIP. The audit trail is honest about partial failures.
- **Read the Reliability Kit:** the eight disciplines behind this demo are at `github.com/fabianwilliams/agentic-engineering-toolkit` (Apache 2.0).
- **License the methodology:** if you build agents for clients, the licensed Kit includes the non-sanitized examples + white-label rights. See `estore.adotob.com/partners`.
