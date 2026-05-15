/**
 * POST /api/a2a/mcp
 *
 * MCP JSON-RPC 2.0 endpoint. Implements `tools/list` and `tools/call`.
 * Single tool: `purchase_free_bundle`.
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
    "Request the Adotob Agent Reliability Kit free-trial bundle. Returns an audit-trail receipt with download URL. Requires first_name and email.",
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
  arguments?: unknown;
}

interface PurchaseArgs {
  first_name?: unknown;
  email?: unknown;
  bundle?: unknown;
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
  return {
    ...receipt,
    markdown_summary: buildMarkdownSummary(receipt),
    // MCP-style content array so clients that look for `content` see something.
    content: [
      {
        type: "text",
        text: buildMarkdownSummary(receipt),
      },
    ],
    isError: receipt.result.status === "failure",
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
    const params = (payload.params ?? {}) as ToolCallParams;
    const name = typeof params.name === "string" ? params.name : "";
    if (name !== TOOL_NAME) {
      return jsonRpcError(id, -32601, `Unknown tool: ${name}`);
    }
    const args = (params.arguments ?? {}) as PurchaseArgs;
    const first_name = typeof args.first_name === "string" ? args.first_name : "";
    const email = typeof args.email === "string" ? args.email : "";
    const bundle = typeof args.bundle === "string" ? args.bundle : undefined;

    const ua = req.headers.get("user-agent") ?? "";
    const receipt = await runPurchase({
      first_name,
      email,
      bundle,
      source: "mcp",
      user_agent: ua,
      request: req,
    });

    return jsonRpcResult(id, buildToolCallResult(receipt));
  }

  return jsonRpcError(id, -32601, `Method not found: ${method}`);
}

export async function GET(): Promise<Response> {
  // Minimal discoverability for humans poking at the endpoint.
  return NextResponse.json(
    {
      protocol: "mcp",
      transport: "http",
      methods: ["initialize", "tools/list", "tools/call"],
      tool: TOOL_SCHEMA,
    },
    { status: 200 },
  );
}
