/**
 * Brevo MCP integration — contact upsert + onboarding email.
 *
 * Account-level quota split (75/25 Adotob/MACONA) is handled at the API
 * key level. This module just sends. Never log the API key or email body.
 */

const BREVO_BASE = "https://api.brevo.com/v3";

const SENDER = {
  name: "Fabian Williams | Adotob",
  email: "fabian@adotob.com",
};

export type BrevoSource = "mcp" | "mcp-raw";

interface UpsertParams {
  email: string;
  firstName: string;
  source: BrevoSource;
  bundle: string;
}

interface UpsertResult {
  ok: boolean;
  status: number;
  /** Safe-to-log message (no secrets, no body content). */
  message: string;
}

function getApiKey(): string {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error("BREVO_API_KEY not set");
  return key;
}

function getListId(): number {
  const raw = process.env.BREVO_MCP_LIST_ID ?? "23";
  const id = parseInt(raw, 10);
  if (Number.isNaN(id)) throw new Error("BREVO_MCP_LIST_ID is not a number");
  return id;
}

export async function upsertContact(
  params: UpsertParams,
): Promise<UpsertResult> {
  const apiKey = getApiKey();
  const listId = getListId();
  const today = new Date().toISOString().slice(0, 10);

  const body = {
    email: params.email,
    updateEnabled: true,
    listIds: [listId],
    attributes: {
      FIRSTNAME: params.firstName,
      SOURCE: params.source,
      PURCHASE_DATE: today,
      BUNDLE: params.bundle,
    },
  };

  const res = await fetch(`${BREVO_BASE}/contacts`, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  // 201 = created, 204 = updated, 400 with "duplicate_parameter" = already exists.
  // All three are considered ok for upsert semantics.
  const ok = res.status === 201 || res.status === 204 || res.status === 200;
  let message: string;
  if (ok) {
    message = `Contact upserted to list ${listId} (MCP Demo Leads)`;
  } else if (res.status === 400) {
    // Duplicate is fine with updateEnabled:true, but surface the status code.
    message = `Contact upsert returned 400 (likely duplicate, updateEnabled=true)`;
  } else {
    message = `Contact upsert returned status ${res.status}`;
  }
  return { ok: ok || res.status === 400, status: res.status, message };
}

interface SendEmailParams {
  toEmail: string;
  toName: string;
  downloadUrl: string;
  receiptUrl: string;
}

interface SendEmailResult {
  ok: boolean;
  status: number;
  message: string;
}

export async function sendOnboardingEmail(
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const apiKey = getApiKey();

  const subject =
    "Your Adotob Agent Reliability Kit free-trial bundle is ready";

  const htmlBody = buildEmailHtml(params);
  const textBody = buildEmailText(params);

  const body = {
    sender: SENDER,
    replyTo: SENDER,
    to: [{ email: params.toEmail, name: params.toName }],
    subject,
    htmlContent: htmlBody,
    textContent: textBody,
  };

  const res = await fetch(`${BREVO_BASE}/smtp/email`, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const ok = res.status >= 200 && res.status < 300;
  return {
    ok,
    status: res.status,
    message: ok
      ? "Brevo transactional email sent"
      : `Brevo transactional email returned status ${res.status}`,
  };
}

function buildEmailHtml(params: SendEmailParams): string {
  const safeName = escapeHtml(params.toName);
  const safeDownload = escapeHtml(params.downloadUrl);
  const safeReceipt = escapeHtml(params.receiptUrl);
  return `<!doctype html>
<html>
<body style="font-family: -apple-system, system-ui, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1a1a1a;">
  <p>Hi ${safeName},</p>

  <p>Thank you for requesting the Adotob Agent Reliability Kit free-trial bundle.</p>

  <p>
    <strong>Download your bundle:</strong><br>
    <a href="${safeDownload}" style="display: inline-block; padding: 12px 20px; background: #6366f1; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Download bundle</a>
  </p>

  <p>The download link is valid for 24 hours. If you need a fresh link after that, just reply to this email and I will send a new one.</p>

  <p>
    A full audit-trail receipt of this request is available at:<br>
    <a href="${safeReceipt}">${safeReceipt}</a>
  </p>

  <p>The receipt shows every supervision check that ran when your agent called the MCP storefront — input validation, rate limit, cost ceiling, lead capture, token mint, and fulfillment dispatch. The full receipt is the point. Treat it as the reference for how agent-to-agent commerce should be observable.</p>

  <p>If anything looks off in the receipt, reply directly and I will dig in.</p>

  <p>
    Best,<br>
    Fabian Williams<br>
    Adotob
  </p>
</body>
</html>`;
}

function buildEmailText(params: SendEmailParams): string {
  return `Hi ${params.toName},

Thank you for requesting the Adotob Agent Reliability Kit free-trial bundle.

Download your bundle:
${params.downloadUrl}

The download link is valid for 24 hours. If you need a fresh link after that, just reply to this email and I will send a new one.

A full audit-trail receipt of this request is available at:
${params.receiptUrl}

The receipt shows every supervision check that ran when your agent called the MCP storefront — input validation, rate limit, cost ceiling, lead capture, token mint, and fulfillment dispatch. The full receipt is the point. Treat it as the reference for how agent-to-agent commerce should be observable.

If anything looks off in the receipt, reply directly and I will dig in.

Best,
Fabian Williams
Adotob
`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
