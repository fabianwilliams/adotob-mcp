---
title: SOP Screenshot Run — Reading Order + Recipe
date: 2026-05-15
audience: Operator (Fabian) running the dogfood pass that produces the 7 SOP screenshots
status: ready to run
---

# SOP Screenshot Run — Reading Order + Recipe

Two things in this doc:

1. **Reading order** through the licensing artifact set (high-level → low-level), so you know what to skim before the run.
2. **The recipe** — exactly what to click, paste, prompt, and capture for the 7 screenshots that drop into `HAPPY-PATH-SOP.md`.

> **Framing note.** `HAPPY-PATH-SOP.md` is **client-agnostic** — it explicitly tells the reader that any MCP-capable client works (Claude, ChatGPT custom connectors, LM Studio 0.3.17+, Cursor, Windsurf, Cline, OpenAI Responses API code, etc.). Your dogfood run happens to be on Claude because that's what you have at the keyboard — so the 7 screenshots are the **Claude example** of the generic flow. Caption them that way when you wire them into the SOP (Step 3 of "Post-run" below).

---

## 1. Reading order (5–10 min skim)

| # | Doc | Where | Why read it |
|---|---|---|---|
| 1 | **`mvp1-artifact-index.md`** | `vault/projects/task-flow/tasks/adotob/licensing/` | One-page index of every artifact, URL, Azure resource, Brevo list, code file. The "table of contents" for the whole MVP-1 build. |
| 2 | **`mvp1-overnight-build-report.md`** | `vault/projects/task-flow/tasks/adotob/licensing/` | The narrative: what got built overnight, what decisions were made (the 10-question grill), what worked end-to-end, what was left for you. |
| 3 | **`HAPPY-PATH-SOP.md`** | `adotob-mcp/docs/` (this repo) | The SOP itself — the doc you are about to dogfood. Read both Path A (Claude connector) and Path B (raw API). You will be running Path A. |

After those three, you have the full picture. The licensing-offer / case-study / FAQ / target-list / outreach-templates / revenue-share / term-sheet docs are for partner conversations, not for the screenshot run.

GitHub mirrors (for browser reading):

- `https://github.com/fabianwilliams/task-flow/tree/main/tasks/adotob/licensing`
- `https://github.com/fabianwilliams/adotob-mcp/tree/main/docs`

---

## 2. The recipe — 4 phases, 7 screenshots

### Pre-test setup (1 min)

| Decision | Value |
|---|---|
| Test first name | `Alex Test` (or whatever you prefer — keeps your real name out of the public receipt) |
| Test email | Your personal gmail account (the one you can check in the browser for the fulfillment email) |
| Claude surface | Claude Desktop **or** Claude.ai with custom connectors — whichever has the cleaner-looking connector UI in your install |
| Browser | Whatever — the receipt page renders identically in Safari / Chrome / Arc |

**Rate-limit awareness:** the endpoint allows 5 calls/hour per IP. You only need ONE successful run. If you want to also screenshot a failure path later (Step 7 in HAPPY-PATH-SOP.md "Try a failure path"), space it out or use a second network.

---

### Phase A — Connector setup (Screenshots 1–3, ~60 sec)

#### Screenshot 1 — Empty "Add custom connector" dialog

1. Open Claude Desktop or Claude.ai
2. Settings → Connectors → **Add custom connector** (label may vary)
3. Capture the empty dialog **before** typing anything

#### Screenshot 2 — URL pasted, ready to save

Paste exactly this into the URL field:

```
https://mcp.adotob.com/api/a2a/mcp
```

Name the connector: `Adotob MCP demo`

Capture **just before** clicking Save (URL visible, name visible, save button highlighted).

#### Screenshot 3 — Tool discovered

After saving, Claude should show `1 tool discovered` or `purchase_free_bundle`. This is Claude calling our `initialize` + `tools/list` automatically.

Capture the connectors list / connector detail view showing the discovered tool.

---

### Phase B — Tool call (Screenshots 4–5, ~30 sec)

#### Screenshot 4 — Permission prompt

In any Claude conversation, paste this prompt verbatim:

```
Use the Adotob MCP demo to request the free-trial bundle. My first name is Alex Test and my email is [your-gmail]@gmail.com.
```

(Replace `[your-gmail]` with your actual gmail.)

Claude will ask permission to use the new tool the first time. Capture the **permission prompt** showing the tool name + inputs it is about to send.

#### Screenshot 5 — Receipt summary inline

Approve. Claude calls the tool and displays the `markdown_summary` field (receipt overview + URL) inline in the conversation.

Capture the **inline response** — receipt ID, the 6 checks (or summary), and the shareable receipt URL.

---

### Phase C — Email + receipt page (Screenshots 6–7, ~30 sec)

#### Screenshot 6 — Email in inbox

Switch to your gmail in the browser. Within 30 seconds you should receive an email titled along the lines of *"Your free agent config sample is ready"*.

Capture the **inbox view** showing the email arrived (and optionally the email open with the download link visible).

#### Screenshot 7 — Receipt page (the money shot)

Click the receipt URL from either Claude's response or the email. It will look like:

```
https://mcp.adotob.com/a2a/receipt/rcpt_2026-05-15_<id>
```

Capture the **full receipt page** showing:

- Header (Alex Test / Free trial bundle / timestamp)
- The 3 bucketed phases (Admission Gates · Processing · Fulfillment)
- All 6 checks with green pass badges + timestamps
- "Download your free-trial bundle" CTA
- Copy-link + Share-on-X affordances

This is the screenshot every partner conversation will reference.

---

## 3. Post-run — wire the screenshots into the SOP

Once you have all 7 PNGs:

```bash
# Drop them into the repo
cp ~/Desktop/sop-screenshot-1.png  ~/projects/adotob-mcp/public/img/sop/
cp ~/Desktop/sop-screenshot-2.png  ~/projects/adotob-mcp/public/img/sop/
# ... through 7
```

Then edit `adotob-mcp/docs/HAPPY-PATH-SOP.md` and replace each `[SCREENSHOT N placeholder — ...]` line with:

```markdown
![Screenshot N caption (Claude example)](/img/sop/sop-screenshot-N.png)
```

(Including "Claude example" in each caption reinforces that the screenshot is one illustration of the generic flow, not a claim that Claude is required.)

Commit + push:

```bash
cd ~/projects/adotob-mcp
git add public/img/sop/ docs/HAPPY-PATH-SOP.md
git commit -m "SOP: replace 7 screenshot placeholders with real dogfood captures"
git push
```

GitHub Actions will redeploy `mcp.adotob.com` automatically.

---

## 4. Caveats / gotchas

| Thing | Why it matters |
|---|---|
| Receipt URL is public for 30 days | Public-blob read on the Azure container. Don't put sensitive emails in the test — your `[gmail]` value is captured server-side (Brevo list 23) but never rendered into the receipt HTML. |
| Rate limit: 5 calls/hour per IP | One successful run is enough. Don't blast it. |
| Cost ceiling: $5/day | Won't hit during a dogfood; just noted in case you see HTTP 503 with `DEMO_PAUSED` later. |
| Custom domain vs azurestaticapps URL | Use `mcp.adotob.com` for screenshots — looks legitimate. The `delightful-sky-…7.azurestaticapps.net` URL also works but undermines the partner-demo polish. |
| LinkedIn references in the SOP | None. LinkedIn is hibernated; don't add any. |

---

## 5. Verification after the run

After committing the screenshots:

1. Visit `https://github.com/fabianwilliams/adotob-mcp/blob/main/docs/HAPPY-PATH-SOP.md` — confirm images render in GitHub.
2. Visit `https://mcp.adotob.com/docs/happy-path` (if/when you decide to publish the SOP at a live URL) — confirm Next.js renders the same content.
3. Forward the receipt URL to one trusted partner. Their first reaction is the validation signal.

---

*This recipe pairs with `HAPPY-PATH-SOP.md` in the same folder. Read this first, run the dogfood, then update HAPPY-PATH-SOP.md with the captured PNGs.*
