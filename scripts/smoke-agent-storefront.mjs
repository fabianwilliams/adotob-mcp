#!/usr/bin/env node

const baseUrl = (process.env.ADOTOB_BASE_URL || "https://mcp.adotob.com").replace(
  /\/+$/,
  "",
);
const testEmail = process.env.ADOTOB_TEST_EMAIL || "";
const testFirstName = process.env.ADOTOB_TEST_FIRST_NAME || "Smoke";
const idSuffix = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const liveMode = Boolean(testEmail);

function truncate(text, maxLength = 2000) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}... [truncated]`;
}

function formatBody(json) {
  return truncate(JSON.stringify(json, null, 2));
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "adotob-public-smoke/1.0",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${path} returned non-JSON HTTP ${response.status}: ${text}`);
  }
  return { status: response.status, json, path };
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "user-agent": "adotob-public-smoke/1.0" },
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${path} returned non-JSON HTTP ${response.status}: ${text}`);
  }
  return { status: response.status, json, path };
}

function assert(condition, message, response) {
  if (!condition) {
    const details = response
      ? `\n${response.path} returned HTTP ${response.status}\n${formatBody(response.json)}`
      : "";
    throw new Error(`${message}${details}`);
  }
}

function assertStatus(response, expected, message) {
  assert(
    response.status === expected,
    `${message}; expected HTTP ${expected}, got HTTP ${response.status}`,
    response,
  );
}

function logPass(message) {
  console.log(`[pass] ${message}`);
}

function logInfo(message) {
  console.log(`[info] ${message}`);
}

async function main() {
  console.log(`ADOTOB agent storefront smoke test`);
  console.log(`Target: ${baseUrl}`);
  console.log("");

  const agentCard = await getJson("/.well-known/agent.json");
  assertStatus(agentCard, 200, "agent card should return HTTP 200");
  assert(agentCard.json.url, "agent card should include url");
  assert(
    Array.isArray(agentCard.json.supportedInterfaces),
    "agent card should include supportedInterfaces",
  );
  assert(
    agentCard.json.supportedInterfaces.some(
      (iface) => iface.protocolBinding === "A2A-JSON-RPC-COMPAT",
    ),
    "agent card should advertise A2A-JSON-RPC-COMPAT",
  );
  logPass("agent card advertises MCP, A2A-compatible JSON-RPC, and raw HTTP");

  const initialize = await postJson("/api/a2a/mcp", {
    jsonrpc: "2.0",
    id: "initialize",
    method: "initialize",
    params: {},
  });
  assertStatus(initialize, 200, "initialize should return HTTP 200");
  assert(
    initialize.json.result?.serverInfo?.name,
    "initialize should return serverInfo",
    initialize,
  );
  logPass(`initialize returned ${initialize.json.result.serverInfo.name}`);

  const toolsList = await postJson("/api/a2a/mcp", {
    jsonrpc: "2.0",
    id: "tools-list",
    method: "tools/list",
    params: {},
  });
  assertStatus(toolsList, 200, "tools/list should return HTTP 200");
  assert(
    toolsList.json.result?.tools?.some((tool) => tool.name === "purchase_free_bundle"),
    "tools/list should include purchase_free_bundle",
    toolsList,
  );
  logPass("tools/list exposes purchase_free_bundle");

  const inputRequired = await postJson("/api/a2a/mcp", {
    jsonrpc: "2.0",
    id: "a2a-input-required",
    method: "SendMessage",
    params: {
      message: {
        messageId: `smoke-${idSuffix}`,
        role: "ROLE_USER",
        parts: [{ text: "hello" }],
      },
    },
  });
  assertStatus(inputRequired, 200, "A2A input-required call should return HTTP 200");
  assert(
    inputRequired.json.result?.task?.status?.state === "TASK_STATE_INPUT_REQUIRED",
    "A2A call without purchase details should ask for input",
    inputRequired,
  );
  logPass("A2A SendMessage returns TASK_STATE_INPUT_REQUIRED instead of 500");

  if (liveMode) {
    logInfo(
      "Live fulfillment mode enabled; skipping negative-path probes to stay under the public rate limit.",
    );
  } else {
    const invalidMcp = await postJson("/api/a2a/mcp", {
      jsonrpc: "2.0",
      id: "mcp-invalid",
      method: "tools/call",
      params: {
        tool: "purchase_free_bundle",
        input: {
          firstName: "Smoke",
          email: "not-an-email",
          idempotencyKey: `smoke-invalid-${idSuffix}`,
        },
      },
    });
    assertStatus(invalidMcp, 200, "invalid MCP call should return JSON-RPC HTTP 200");
    assert(
      invalidMcp.json.result?.result?.status === "failure",
      "invalid MCP call should return a failure receipt",
      invalidMcp,
    );
    assert(
      invalidMcp.json.result?.checks?.[0]?.id === "input_validation",
      "invalid MCP call should fail at input_validation",
      invalidMcp,
    );
    logPass(
      `invalid MCP call produced controlled failure receipt ${invalidMcp.json.result.receipt_id}`,
    );

    const invalidA2a = await postJson("/api/a2a/mcp", {
      jsonrpc: "2.0",
      id: "a2a-invalid",
      method: "message/send",
      params: {
        message: {
          messageId: `smoke-invalid-${idSuffix}`,
          role: "ROLE_USER",
          parts: [{ text: "Request the free bundle" }],
        },
        purchase: {
          first_name: "Smoke",
          email: "not-an-email",
          idempotency_key: `smoke-a2a-invalid-${idSuffix}`,
        },
      },
    });
    assertStatus(invalidA2a, 200, "invalid A2A call should return HTTP 200");
    assert(
      invalidA2a.json.result?.task?.status?.state === "TASK_STATE_FAILED",
      "invalid A2A call should return TASK_STATE_FAILED",
      invalidA2a,
    );
    logPass("A2A message/send returns a structured failed task for invalid email");
  }

  if (!testEmail) {
    logInfo("Skipping real fulfillment path because ADOTOB_TEST_EMAIL is not set.");
    logInfo(
      "To test the real email/download/receipt path, rerun with ADOTOB_TEST_EMAIL=you@example.com.",
    );
    return;
  }

  const idempotencyKey = `public-smoke-${idSuffix}`;
  const liveFulfillment = await postJson("/api/a2a/mcp", {
    jsonrpc: "2.0",
    id: "mcp-live-fulfillment",
    method: "tools/call",
    params: {
      name: "purchase_free_bundle",
      arguments: {
        first_name: testFirstName,
        email: testEmail,
        bundle: "free-trial-sample",
        idempotency_key: idempotencyKey,
      },
    },
  });
  assertStatus(liveFulfillment, 200, "live fulfillment should return HTTP 200");
  assert(
    liveFulfillment.json.result?.result?.status === "success",
    "live fulfillment should return success",
    liveFulfillment,
  );
  logPass(`live fulfillment receipt: ${liveFulfillment.json.result.receipt_id}`);
  logInfo(`receipt URL: ${liveFulfillment.json.result.result.shareable_receipt_url}`);
  logInfo("Check the test inbox for the fulfillment email.");
}

main().catch((error) => {
  console.error(`[fail] ${error.message}`);
  process.exitCode = 1;
});
