/**
 * POST /api/a2a/mcp
 *
 * MCP JSON-RPC 2.0 endpoint. Implements `tools/list` and `tools/call`.
 * Also accepts the A2A JSON-RPC `SendMessage` method as a compatibility
 * bridge for early A2A clients pointed at the historical `/api/a2a/mcp` URL.
 * Single business action: `purchase_free_bundle`.
 *
 * Tool result shape: the canonical PurchaseReceipt plus a `markdown_summary`
 * string field for human-readable presentation in MCP clients.
 */

import { NextResponse } from "next/server";
import {
  buildMarkdownSummary,
  runPurchase,
  type PurchaseReceipt,
} from "@/lib/a2a-purchase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOOL_NAME = "purchase_free_bundle";

const TOOL_SCHEMA = {
  name: TOOL_NAME,
  description:
    "Request the Adotob Agent Reliability Kit free-trial bundle. Returns an audit-trail receipt with download URL. Requires first_name and email. " +
    "Strongly recommended for production agents: supply an idempotency_key (or send an Idempotency-Key HTTP header) so a retry on timeout returns the original receipt instead of double-issuing the bundle.",
  inputSchema: {
    type: "object",
    properties: {
      first_name: { type: "string", minLength: 1, maxLength: 100 },
      email: { type: "string", format: "email" },
      bundle: {
        type: "string",
        enum: ["free-trial-sample"],
        default: "free-trial-sample",
      },
      idempotency_key: {
        type: "string",
        minLength: 8,
        maxLength: 128,
        pattern: "^[A-Za-z0-9._-]+$",
        description:
          "Optional but recommended. A caller-generated unique value (e.g. UUIDv4). If the same key is supplied with the same email twice, the original receipt is returned instead of re-running the flow. Closes NEXUM-004 (IdempotencyMissing) from the Nexum trust-manifest.",
      },
    },
    required: ["first_name", "email"],
  },
} as const;

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc?: unknown;
  id?: JsonRpcId;
  method?: unknown;
  params?: unknown;
}

interface ToolCallParams {
  name?: unknown;
  tool?: unknown;
  toolName?: unknown;
  arguments?: unknown;
  args?: unknown;
  input?: unknown;
}

interface PurchaseArgs {
  first_name?: unknown;
  firstName?: unknown;
  email?: unknown;
  bundle?: unknown;
  idempotency_key?: unknown;
  idempotencyKey?: unknown;
}

interface A2aPart {
  text?: unknown;
}

interface A2aMessage {
  parts?: unknown;
  messageId?: unknown;
  contextId?: unknown;
}

interface A2aSendMessageParams {
  message?: unknown;
  metadata?: unknown;
  purchase?: unknown;
}

function jsonRpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
  httpStatus = 200,
): Response {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id,
      error: { code, message, ...(data !== undefined ? { data } : {}) },
    },
    { status: httpStatus },
  );
}

function jsonRpcResult(id: JsonRpcId, result: unknown): Response {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function buildToolCallResult(receipt: PurchaseReceipt) {
  const markdown = buildMarkdownSummary(receipt);
  return {
    ...receipt,
    markdown_summary: markdown,
    // MCP-style content array so clients that look for `content` see something.
    content: [
      {
        type: "text",
        text: markdown,
      },
    ],
    isError: receipt.result.status === "failure",
  };
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") {
    return objectOrEmpty(value);
  }

  try {
    return objectOrEmpty(JSON.parse(value));
  } catch {
    return {};
  }
}

function normalizeToolCallParams(params: unknown): {
  name: string;
  args: PurchaseArgs;
} {
  const p = objectOrEmpty(params) as ToolCallParams;
  const name =
    typeof p.name === "string"
      ? p.name
      : typeof p.tool === "string"
        ? p.tool
        : typeof p.toolName === "string"
          ? p.toolName
          : "";

  const rawArgs = p.arguments ?? p.input ?? p.args ?? {};
  return { name, args: parseJsonObject(rawArgs) as PurchaseArgs };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function extractPurchaseFields(args: PurchaseArgs): {
  first_name: string;
  email: string;
  bundle?: string;
  idempotency_key?: string;
} {
  const first_name = stringValue(args.first_name || args.firstName);
  const email = stringValue(args.email);
  const bundle = stringValue(args.bundle) || undefined;
  const idempotency_key =
    stringValue(args.idempotency_key || args.idempotencyKey) || undefined;

  return { first_name, email, bundle, idempotency_key };
}

function extractA2aText(params: A2aSendMessageParams): string {
  const message = objectOrEmpty(params.message) as A2aMessage;
  const parts = Array.isArray(message.parts) ? message.parts : [];
  return parts
    .map((part) => stringValue((objectOrEmpty(part) as A2aPart).text))
    .filter(Boolean)
    .join("\n");
}

function purchaseArgsFromA2a(params: A2aSendMessageParams): PurchaseArgs {
  const purchase = objectOrEmpty(params.purchase);
  const metadata = objectOrEmpty(params.metadata);
  const text = extractA2aText(params);

  const emailFromText = text.match(
    /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/,
  )?.[0];
  const firstNameFromText =
    text.match(/\bfirst[_\s-]?name\s*[:=]\s*([A-Za-z][A-Za-z'\-]*)/i)?.[1] ??
    text.match(/\bfor\s+([A-Za-z][A-Za-z'\-]*)\s+<[A-Za-z0-9._%+\-]+@/i)?.[1];

  return {
    first_name:
      purchase.first_name ??
      purchase.firstName ??
      metadata.first_name ??
      metadata.firstName ??
      firstNameFromText,
    email: purchase.email ?? metadata.email ?? emailFromText,
    bundle: purchase.bundle ?? metadata.bundle,
    idempotency_key:
      purchase.idempotency_key ??
      purchase.idempotencyKey ??
      metadata.idempotency_key ??
      metadata.idempotencyKey,
  };
}

function buildA2aInputRequiredTask(id: JsonRpcId, params: A2aSendMessageParams) {
  const message = objectOrEmpty(params.message) as A2aMessage;
  const taskId =
    typeof message.messageId === "string"
      ? `task_${message.messageId}`
      : `task_${Date.now()}`;
  const contextId =
    typeof message.contextId === "string" ? message.contextId : undefined;

  return jsonRpcResult(id, {
    task: {
      id: taskId,
      ...(contextId ? { contextId } : {}),
      status: {
        state: "TASK_STATE_INPUT_REQUIRED",
        timestamp: new Date().toISOString(),
        message: {
          role: "ROLE_AGENT",
          parts: [
            {
              text:
                "To request the Adotob Agent Reliability Kit free-trial bundle, send first_name and email in params.purchase, params.metadata, or the user message text.",
            },
          ],
        },
      },
    },
  });
}

function buildA2aCompletedTask(receipt: PurchaseReceipt, params: A2aSendMessageParams) {
  const message = objectOrEmpty(params.message) as A2aMessage;
  const contextId =
    typeof message.contextId === "string" ? message.contextId : undefined;
  const markdown = buildMarkdownSummary(receipt);

  return {
    task: {
      id: receipt.receipt_id,
      ...(contextId ? { contextId } : {}),
      status: {
        state:
          receipt.result.status === "success"
            ? "TASK_STATE_COMPLETED"
            : "TASK_STATE_FAILED",
        timestamp: receipt.created_at_iso,
      },
      artifacts: [
        {
          artifactId: `${receipt.receipt_id}_receipt`,
          name: "Adotob Agent Reliability Kit receipt",
          parts: [
            { text: markdown },
            {
              data: {
                receipt,
                receipt_url: receipt.result.shareable_receipt_url,
                download_url: receipt.result.download_url,
              },
            },
          ],
        },
      ],
    },
  };
}

export async function POST(req: Request): Promise<Response> {
  let payload: JsonRpcRequest;
  try {
    payload = (await req.json()) as JsonRpcRequest;
  } catch {
    return jsonRpcError(null, -32700, "Parse error: invalid JSON");
  }

  const id: JsonRpcId =
    payload.id === undefined
      ? null
      : (payload.id as JsonRpcId);

  if (payload.jsonrpc !== "2.0") {
    return jsonRpcError(id, -32600, "Invalid Request: jsonrpc must be '2.0'");
  }

  const method = typeof payload.method === "string" ? payload.method : "";

  if (method === "initialize") {
    return jsonRpcResult(id, {
      protocolVersion: "2025-06-18",
      serverInfo: {
        name: "adotob-mcp-storefront",
        version: "0.1.0",
      },
      capabilities: {
        tools: {},
      },
    });
  }

  if (method === "tools/list") {
    return jsonRpcResult(id, { tools: [TOOL_SCHEMA] });
  }

  if (method === "tools/call") {
    const { name, args } = normalizeToolCallParams(payload.params ?? {});
    if (name !== TOOL_NAME) {
      return jsonRpcError(id, -32601, `Unknown tool: ${name}`);
    }
    const { first_name, email, bundle, idempotency_key } =
      extractPurchaseFields(args);

    // NEXUM-004 idempotency. Arg takes precedence; otherwise HTTP header.
    const idem = idempotency_key ?? req.headers.get("idempotency-key") ?? undefined;

    const ua = req.headers.get("user-agent") ?? "";
    const receipt = await runPurchase({
      first_name,
      email,
      bundle,
      source: "mcp",
      user_agent: ua,
      request: req,
      idempotency_key: idem,
    });

    return jsonRpcResult(id, buildToolCallResult(receipt));
  }

  if (method === "SendMessage" || method === "message/send") {
    const params = objectOrEmpty(payload.params ?? {}) as A2aSendMessageParams;
    const args = purchaseArgsFromA2a(params);
    const { first_name, email, bundle, idempotency_key } =
      extractPurchaseFields(args);

    if (!first_name || !email) {
      return buildA2aInputRequiredTask(id, params);
    }

    const ua = req.headers.get("user-agent") ?? "";
    const receipt = await runPurchase({
      first_name,
      email,
      bundle,
      source: "mcp",
      user_agent: ua,
      request: req,
      idempotency_key: idempotency_key ?? req.headers.get("idempotency-key") ?? undefined,
    });

    return jsonRpcResult(id, buildA2aCompletedTask(receipt, params));
  }

  return jsonRpcError(id, -32601, `Method not found: ${method}`);
}

export async function GET(): Promise<Response> {
  // Minimal discoverability for humans poking at the endpoint.
  return NextResponse.json(
    {
      protocol: "mcp",
      compatibility: ["a2a-json-rpc-sendmessage"],
      transport: "http",
      methods: ["initialize", "tools/list", "tools/call", "SendMessage"],
      tool: TOOL_SCHEMA,
    },
    { status: 200 },
  );
}
