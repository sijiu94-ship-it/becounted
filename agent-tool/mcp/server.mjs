#!/usr/bin/env node
// becounted-is-human — a READ-ONLY MCP server exposing exactly one tool:
//
//   is_human(address, gate?)
//
// It answers one question: "is this BNB Chain address backed by a unique
// human?" Evidence is the Binance Agent ID registry on BSC mainnet
// (0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F): an address holding an
// Agent ID is anchored to exactly one KYC'd human, because Agent IDs are
// issued one-per-KYC and are non-transferable. Optionally, the check can
// be routed through a BeCounted contract (isHuman(address)) instead of
// reading the registry directly.
//
// PERMANENTLY READ-ONLY (project red-line discipline #1): this server
// only ever issues eth_call reads. It has no private keys, no signing,
// no sessions, and no write tools — and never will. Anyone can repeat
// the same public on-chain read and get the same answer.
//
// Transport: MCP over stdio (newline-delimited JSON-RPC 2.0), zero
// dependencies — plain Node 18+ (global fetch), same approach as the
// sibling is-human.mjs CLI, including multi-RPC fallback.
//
// Usage (normally launched by an MCP client, see README.md):
//   node server.mjs

const REGISTRY = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F"; // SPACE ID Agent ID, BSC mainnet
const RPCS = [
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.bnbchain.org",
  "https://bsc-dataseed2.bnbchain.org",
];
const RPC_TIMEOUT_MS = 10000;

const BALANCE_OF = "0x70a08231"; // balanceOf(address)
const IS_HUMAN = "0xf72c436f"; //   isHuman(address)

const SERVER_INFO = { name: "becounted-is-human", version: "1.0.0" };
const DEFAULT_PROTOCOL_VERSION = "2024-11-05";
// Only these protocol versions are actually implemented/tested here.
// initialize answers with the client's version when it is one of them,
// and falls back to DEFAULT_PROTOCOL_VERSION otherwise — never echo a
// version this server does not support.
const SUPPORTED_PROTOCOL_VERSIONS = ["2024-11-05"];
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/* ---------------- chain reads (eth_call only, multi-RPC fallback) ---------------- */

async function ethCall(to, data) {
  let lastErr;
  for (const rpc of RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to, data }, "latest"],
        }),
        signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
      });
      const json = await res.json();
      if (typeof json.result === "string") return json.result;
      lastErr = new Error(JSON.stringify(json.error ?? json));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("all RPCs failed");
}

const encodeAddress = (selector, address) =>
  selector + address.slice(2).toLowerCase().padStart(64, "0");

const MEANING_HUMAN =
  "holds an Agent ID: a unique KYC-anchored human is behind this address (the ID itself proves uniqueness, not trustworthiness)";
const MEANING_NOT =
  "no Agent ID: cannot be confirmed as a unique human via Agent ID";

function wordToBigInt(raw, what) {
  if (typeof raw !== "string" || !/^0x[0-9a-fA-F]+$/.test(raw)) {
    throw new Error(`empty or malformed result for ${what} — is the target a contract on BNB Chain mainnet?`);
  }
  return BigInt(raw);
}

async function checkIsHuman(address, gate) {
  // Zero-address short-circuit BEFORE either path: 0x0 definitionally
  // holds no Agent ID, and both underlying reads misbehave for it — the
  // registry's balanceOf reverts (ERC-721 spec: the zero address can
  // never own a token), and the BeCounted primitive reverts as well
  // when its registry does. One question must give one answer,
  // regardless of which path is asked.
  if (address.toLowerCase() === ZERO_ADDRESS) {
    return gate
      ? {
          address,
          isHuman: false,
          source: "becounted",
          gate,
          chain: "BNB Chain (56)",
          meaning: MEANING_NOT,
        }
      : {
          address,
          isHuman: false,
          agentIdBalance: "0",
          source: "agent-id-registry",
          registry: REGISTRY,
          chain: "BNB Chain (56)",
          meaning: MEANING_NOT,
        };
  }
  if (gate) {
    const raw = await ethCall(gate, encodeAddress(IS_HUMAN, address));
    const human = wordToBigInt(raw, "isHuman(address)") !== 0n;
    return {
      address,
      isHuman: human,
      source: "becounted",
      gate,
      chain: "BNB Chain (56)",
      meaning: human ? MEANING_HUMAN : MEANING_NOT,
    };
  }
  const bal = wordToBigInt(
    await ethCall(REGISTRY, encodeAddress(BALANCE_OF, address)),
    "balanceOf(address)"
  );
  const human = bal > 0n;
  return {
    address,
    isHuman: human,
    agentIdBalance: bal.toString(),
    source: "agent-id-registry",
    registry: REGISTRY,
    chain: "BNB Chain (56)",
    meaning: human ? MEANING_HUMAN : MEANING_NOT,
  };
}

/* ---------------- the one and only tool ---------------- */

const TOOLS = [
  {
    name: "is_human",
    description:
      "Check whether a BNB Chain address is backed by a unique human, i.e. holds a Binance Agent ID " +
      "(one per KYC, non-transferable) in the Agent ID registry on BSC mainnet. Read-only on-chain " +
      "lookup (eth_call); proves uniqueness of the human behind the address, never trustworthiness. " +
      "There is deliberately no reverse lookup (name -> wallet). Optionally pass `gate` to ask a " +
      "BeCounted contract (isHuman(address)) instead of reading the registry directly.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
          description: "The BNB Chain address to check (0x-prefixed, 40 hex chars).",
        },
        gate: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
          description:
            "Optional BeCounted contract address. When given, the check calls that contract's " +
            "isHuman(address); when omitted, the Agent ID registry's balanceOf(address) is read directly.",
        },
      },
      required: ["address"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
];

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

async function callIsHuman(args) {
  const address = args?.address;
  const gate = args?.gate;
  if (typeof address !== "string" || !ADDRESS_RE.test(address)) {
    throw new Error("invalid or missing 'address': expected a 0x-prefixed 40-hex-char address");
  }
  if (gate !== undefined && (typeof gate !== "string" || !ADDRESS_RE.test(gate))) {
    throw new Error("invalid 'gate': expected a 0x-prefixed 40-hex-char contract address");
  }
  return checkIsHuman(address, gate);
}

/* ---------------- MCP / JSON-RPC plumbing (stdio) ---------------- */

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}
const result = (id, value) => send({ jsonrpc: "2.0", id, result: value });
const error = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

async function handle(msg) {
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize":
      if (!isNotification)
        result(id, {
          protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(params?.protocolVersion)
            ? params.protocolVersion
            : DEFAULT_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
          instructions:
            "Read-only server. One tool: is_human — check whether a BNB Chain address holds a " +
            "Binance Agent ID (unique KYC-anchored human). No write operations exist.",
        });
      return;

    case "notifications/initialized":
    case "notifications/cancelled":
      return; // notifications: nothing to do, never answered

    case "ping":
      if (!isNotification) result(id, {});
      return;

    case "tools/list":
      if (!isNotification) result(id, { tools: TOOLS });
      return;

    case "tools/call": {
      if (isNotification) return;
      const name = params?.name;
      if (name !== "is_human") {
        error(id, -32602, `unknown tool: ${String(name)} (this server only exposes is_human)`);
        return;
      }
      try {
        const out = await callIsHuman(params?.arguments ?? {});
        result(id, {
          content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
          structuredContent: out,
          isError: false,
        });
      } catch (e) {
        // Tool-level failure (bad input, RPC down): reported in-band per MCP convention.
        result(id, {
          content: [{ type: "text", text: `is_human check failed: ${e.message}` }],
          isError: true,
        });
      }
      return;
    }

    default:
      if (!isNotification) error(id, -32601, `method not found: ${String(method)}`);
  }
}

let buffer = "";
let inFlight = 0;
let stdinEnded = false;
function maybeExit() {
  // Do not exit on stdin EOF while requests are still in flight — a
  // piped client that closes stdin right after writing would otherwise
  // lose the responses it is still waiting for.
  if (stdinEnded && inFlight === 0) process.exit(0);
}
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      console.error("becounted-is-human: ignoring unparseable line");
      continue;
    }
    inFlight++;
    handle(msg)
      .catch((e) => console.error("becounted-is-human: handler error:", e))
      .finally(() => {
        inFlight--;
        maybeExit();
      });
  }
});
process.stdin.on("end", () => {
  stdinEnded = true;
  maybeExit();
});
console.error(
  `${SERVER_INFO.name} v${SERVER_INFO.version} ready (read-only; tool: is_human; registry ${REGISTRY})`
);
