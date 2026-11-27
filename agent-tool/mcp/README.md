# BeCounted `is_human` — read-only MCP server

An MCP (Model Context Protocol) server that lets any MCP-compatible AI
agent answer one question before it acts:

> **Is the BNB Chain address I'm dealing with backed by a unique human?**

It wraps the same check as the sibling CLI (`../is-human.mjs`) as a
single MCP tool, so agents in Claude Code, Codex, and other MCP clients
can call it natively instead of shelling out.

## The tool

**`is_human`** — one tool, the only tool.

| Parameter | Required | Meaning |
| --- | --- | --- |
| `address` | yes | BNB Chain address to check (`0x…`, 40 hex chars). |
| `gate` | no | A BeCounted contract address. When given, the check calls that contract's `isHuman(address)`; when omitted, the Agent ID registry is read directly. |

How it works: the server issues an `eth_call` against the Binance
Agent ID registry on BSC mainnet
(`0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`, the SPACE ID Agent ID
contract) and reads `balanceOf(address)`. A balance above zero means
the address holds an Agent ID — issued one-per-KYC and
non-transferable — so exactly one KYC-anchored human stands behind it.
Reads fall back across three public BSC RPC endpoints.

Example result:

```json
{
  "address": "0x119B2Bf71856155b234f818476ae0610634A2aB9",
  "isHuman": true,
  "agentIdBalance": "1",
  "source": "agent-id-registry",
  "registry": "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F",
  "chain": "BNB Chain (56)",
  "meaning": "holds an Agent ID: a unique KYC-anchored human is behind this address (the ID itself proves uniqueness, not trustworthiness)"
}
```

## Read-only — permanently

This server is **read-only by design and forever** (project red-line
discipline #1: skills/MCP never carry write operations):

- It only ever performs `eth_call` reads against public RPC endpoints.
- It has **no** private keys, signing, session, or wallet logic, and
  exposes **no** write tools — there is nothing to approve or confirm
  because nothing can be sent.
- `isHuman: true` proves **uniqueness** ("the same one person, and only
  one of them"), never **trustworthiness**.
- There is deliberately **no reverse lookup** (name → wallet). The tool
  answers address → human?, nothing else.

## Run it

Zero dependencies — any Node.js 18+ (uses global `fetch`):

```bash
node server.mjs
```

It speaks MCP over stdio and waits for a client; normally you don't
run it by hand — your MCP client launches it (below). Diagnostics go
to stderr; stdout is the protocol channel.

## Connect an MCP client

Use the absolute path to `server.mjs` on your machine.

### Claude Code

```bash
claude mcp add becounted-is-human -- node /path/to/agentid-hackathon/agent-tool/mcp/server.mjs
```

or in `.mcp.json` / settings:

```json
{
  "mcpServers": {
    "becounted-is-human": {
      "command": "node",
      "args": ["/path/to/agentid-hackathon/agent-tool/mcp/server.mjs"]
    }
  }
}
```

### Codex

In `~/.codex/config.toml`:

```toml
[mcp_servers.becounted-is-human]
command = "node"
args = ["/path/to/agentid-hackathon/agent-tool/mcp/server.mjs"]
```

Then ask your agent something like: *"Before interacting with
0x…, check with is_human whether it's backed by a unique human."*
