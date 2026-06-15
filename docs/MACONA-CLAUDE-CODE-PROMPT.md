# MACONA Claude Code Prompt

Use this prompt with the MACONA website agent. The goal is not to rebuild the
site in one pass. The goal is to make MACONA agent-accessible in the same
disciplined way ADOTOB is becoming agent-accessible.

```text
You are working on the MACONA website and agent-accessibility surface.

Context:
- MACONA is a community/nonprofit-style organization. Its website must remain
  useful to people first.
- The next two weeks are Claude Code only. Do not assume Codex-specific tools.
- We are applying the same learning loop from ADOTOB:
  - Proven: people already need to donate, volunteer, contact the organization,
    register interest, read programs/events, and retrieve receipts.
  - Better: make these existing actions clearer, faster, accessible,
    auditable, and easier for trusted agents to complete.
  - New: expose selected actions through agent-readable surfaces such as
    semantic HTML, structured metadata, WebMCP-style browser tools where
    available, MCP/A2A-compatible endpoints where appropriate, and deterministic
    receipt URLs.
- Do not start from "add AI." Start from "which real user action should be
  reliable for both humans and agents?"
- Local models on a Mac mini may be used for drafting, triage, classification,
  summarization, and routing. They must not perform irreversible side effects
  without deterministic validation, rate limits, logs, receipts, and, where
  appropriate, human approval.

Operating principles:
1. Preserve the existing MACONA structure unless a change is clearly required.
2. Make the human web experience better first: semantic HTML, labels,
   accessibility, fast forms, clear calls to action, and visible confirmation.
3. Add agent-accessibility second: machine-readable metadata, action schemas,
   stable URLs, receipts, and docs.
4. Every side-effecting action must produce a traceable result:
   - donation receipt
   - volunteer/intake confirmation
   - contact request confirmation
   - event registration confirmation
   - grant/outreach submission confirmation
5. Never expose secrets, private donor data, private volunteer data, or internal
   operational notes in public agent metadata.
6. Prefer narrow proof over broad ambition. Build one or two reliable flows
   before adding more.

First task:
Create an agent-accessibility audit for MACONA before coding.

Deliver:
1. A table of current human actions on the site:
   - action
   - current URL
   - user value
   - business/community value
   - current friction
   - agent-readiness score from 0 to 3
   - proposed next step
2. A second table of candidate agent-callable actions:
   - action id
   - human URL
   - proposed agent URL or metadata surface
   - required inputs
   - side effects
   - required receipt/confirmation
   - privacy risk
   - recommended phase
3. Recommend the first two flows to implement.
4. Do not implement until the audit is complete and the recommended flows are
   explicit.

Likely first flows:
- Volunteer/intake interest flow that returns a confirmation ID.
- Donate/support flow that returns or links to a receipt.

Reference ADOTOB pattern:
- Agent discovery card.
- Explicit action schema.
- Rate limit / cost ceiling where applicable.
- Idempotency key for side-effecting actions.
- Public or user-shareable receipt URL with no sensitive personal data.
- Internal logs for operators.
- Docs that let an outside SME test the surface.

SME review plan:
After we self-test, invite Darrel Miller as a protocol/API trusted advisor.
Ask him to test the agent-facing surface and focus on interoperability,
discovery, protocol shape, developer ergonomics, and where the terminology is
confusing. Do not ask him to validate the community mission or visual design.
```

## Follow-Up SME Note

Send this only after MACONA has a passing local/live self-test:

```text
Darrel, you found a useful protocol issue in the ADOTOB endpoint when your A2A
client had to fall back to raw HTTP. We fixed the compatibility path and are now
applying the same agent-accessibility pattern to MACONA.

Would you be willing to do a protocol/API sanity pass after we complete our own
self-test? The ask is narrow: please try discovery and invocation with your A2A
client and tell us where the surface is confusing, brittle, or not aligned with
how serious clients expect agent-accessible websites to behave.

We are not looking for a broad product review yet. We want you as a trusted SME
on API shape, interop, receipts, and whether the endpoint feels real rather
than demo-only.
```
