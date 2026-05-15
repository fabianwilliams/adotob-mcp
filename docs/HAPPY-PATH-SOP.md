---
title: "MCP Storefront Happy Path — How to Try the Demo From Your Own Claude"
date: 2026-05-15
audience: Partners evaluating the methodology, builders curious about MCP, the operator's own dogfood test
status: DRAFT — operator dogfood pass + screenshots pending
---

# How to Try the Adotob MCP Storefront — Step by Step

> The operator's own narrative + screenshots from a real test will replace the placeholder sections. Two paths shown: the **zero-friction Claude path** (paste the URL only) and the **raw API path** (custom code, requires a tool definition).

---

## What you are testing

A public MCP server that processes a real free-trial-bundle purchase, returns an audit-trail receipt showing every supervision-layer check that fired, and emails the download link.

**The artifact you walk away with:** a shareable receipt URL like `https://mcp.adotob.com/a2a/receipt/rcpt_2026-05-15_<id>` that lists the six supervision checks with timestamps and pass/fail badges. You can hand this URL to a colleague — it does not require auth.

## What you need

- A Claude Desktop install, Claude.ai with custom-connectors enabled, OR Claude Code with MCP support — any one is fine.
- An email address you can check for the download link (the demo sends a real email).
- About 2 minutes.

You do **not** need:
- A bearer token or API key
- To create a tool definition manually
- Anthropic API access (unless you are doing Path B below)

---

## Path A — Zero-friction (Claude Desktop / Claude.ai / Claude Code)

Use this path if you have any Claude surface with "custom connector" or "MCP server" support.

### Step 1. Open Claude's MCP / connector settings

In Claude Desktop or Claude.ai: open Settings → Connectors → "Add custom connector" (or equivalent button — the UI label may shift with releases).

*[SCREENSHOT 1 placeholder — the empty "Add custom connector" dialog]*

### Step 2. Paste the URL

Paste exactly one thing into the URL field:

```
https://mcp.adotob.com/api/a2a/mcp
```

(Or `https://delightful-sky-07f916c0f.7.azurestaticapps.net/api/a2a/mcp` if the custom domain has not propagated yet.)

Name the connector anything — "Adotob MCP demo" works. Save.

*[SCREENSHOT 2 placeholder — the URL pasted, save button about to be clicked]*

### Step 3. Confirm Claude discovers the tool

After saving, Claude should show "1 tool discovered" or "purchase_free_bundle (1 tool)." This is Claude calling our `initialize` and `tools/list` methods. No extra config from you.

*[SCREENSHOT 3 placeholder — Claude showing the tool in the connectors list]*

### Step 4. Ask Claude to run the tool

In any Claude conversation, ask:

> *"Use the Adotob MCP demo to request the free-trial bundle. My first name is [Your Name] and my email is [yourgmail]@gmail.com."*

Claude will:
1. Ask permission once to use the new tool
2. Show the inputs it is about to send (first_name + email)
3. Call the tool
4. Display the receipt summary (`markdown_summary` field) in the conversation

*[SCREENSHOT 4 placeholder — Claude asking for permission to call the tool]*

*[SCREENSHOT 5 placeholder — Claude showing the receipt summary inline]*

### Step 5. Check your email

You should receive an email titled "Your free agent config sample is ready" within 30 seconds. It contains:
- A download link valid for 24 hours
- The receipt URL (shareable)

*[SCREENSHOT 6 placeholder — the email arriving in your inbox]*

### Step 6. Open the shareable receipt URL

Click the receipt URL in the email or the conversation. It looks like:

```
https://mcp.adotob.com/a2a/receipt/rcpt_2026-05-15_<id>
```

You will see:
- The receipt header (name, bundle, timestamp)
- The 6 supervision-layer checks with timestamps and pass/fail badges
- A "Download your free-trial bundle" CTA
- A "Copy link" affordance and "Share on X" intent

The page is publicly readable. **Your email never appears in the rendered HTML** — only your first name. The receipt URL is safe to share with colleagues.

*[SCREENSHOT 7 placeholder — the receipt page rendering all 6 checks]*

### Step 7. Verify the audit trail (optional, for procurement-minded readers)

The receipt shows these checks in order — every successful purchase fires all six:

1. **Input Validation** — first_name and email present and well-formed
2. **Rate Limit Check** — under 5/hour from your IP (we cap to protect the demo from abuse)
3. **Daily Cost Ceiling** — server confirms it has not exceeded the $5/day cap
4. **Lead Capture (Brevo)** — your contact upserted to the dedicated MCP-leads list
5. **Download Token Issued** — JWT minted, 24h expiry, signed with the eStore's secret so the eStore can validate it cross-app
6. **Fulfillment Email Dispatched** — Brevo transactional API confirmed message acceptance

If any check fails, the receipt still renders the full audit trail with the failure badge — the audit trail is the demo, even on failure.

---

## Path B — Raw API (custom code, OpenAI/Anthropic SDKs)

Use this path if you are building tool-using code outside Claude Desktop — for example, an internal agent your firm built on the Anthropic or OpenAI API.

### Tool definition (paste into your code)

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

### Endpoint and call shape

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

### Or use the raw HTTP variant (skip the MCP envelope)

```http
POST https://mcp.adotob.com/api/a2a/purchase
Content-Type: application/json

{"first_name": "Your Name", "email": "you@example.com"}
```

Both return the same receipt JSON.

---

## Honest disclosures

- **The endpoint is rate-limited:** 5 calls/hour per IP, 10 calls per 24h. Sharing across colleagues is fine; bot-blasting is not.
- **The demo is on a daily cost ceiling:** $5/day. If hit, the endpoint returns HTTP 503 with `{"error":"Demo paused","details":"Daily cost ceiling exceeded — demo paused for the day"}` until the next 24h window.
- **The download token expires in 24 hours.** If you let it lapse, request a fresh bundle and a new token mints.
- **The receipt URL expires after 30 days** to keep the Azure Blob receipt store from growing without bound. Save anything you need before that.
- **No personal data is leaked publicly.** The audit-trail receipt shows your first name, bundle, and the supervision checks — never your email, never any payment info (there is no payment in MVP-1), never the download token.
- **The demo runs in a separate Azure tenant** from the eStore (own Resource Group `rg-adotob-mcp`). If anything goes wrong, the eStore remains unaffected.

## What this proves

Reading the receipt is reading the methodology in production. Every supervision check named in the Reliability Kit fires on every purchase. The receipt is what a partner forwards to their client's security team when asked *"show me your evals — how do you know the agent did the right thing?"*

The answer is no longer "we monitor the LLM output" or "we have a test suite." The answer is a URL.

## What you can do next

- **Share the receipt URL** with a colleague. The page is publicly readable; the share is the marketing.
- **Try a failure path:** call the endpoint with an invalid email like `"email": "not-an-email"`. The receipt still produces, with `input_validation` showing `fail` and the 5 downstream checks showing `skip`. The audit trail is honest about partial failures.
- **Read the Reliability Kit:** the eight disciplines behind this demo are at `github.com/fabianwilliams/agentic-engineering-toolkit` (Apache 2.0).
- **License the methodology:** if you build agents for clients, the licensed Kit gives you the non-sanitized examples + white-label rights. See `estore.adotob.com/partners`.

---

*This SOP is the operator's own dogfood run. Screenshots will replace the placeholders after the test is captured.*
