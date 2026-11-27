#!/usr/bin/env node
// is-human — check whether a BNB Chain address is backed by a unique
// human, i.e. holds a Binance Agent ID (one per KYC, non-transferable).
//
// The evidence lives on-chain in the Agent ID registry; this tool only
// reads it. It issues no trust of its own: anyone can repeat the same
// read and get the same answer.
//
// Usage:
//   node is-human.mjs 0xYourAddress
//   node is-human.mjs 0xA 0xB 0xC        (batch)
// Exit code 0 if all addresses are human, 1 otherwise, 2 on usage/RPC error.

const REGISTRY = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F"; // SPACE ID Agent ID, BSC mainnet
const RPCS = [
  "https://bsc-dataseed.binance.org",
  "https://bsc.publicnode.com",
  "https://bsc-dataseed1.defibit.io",
];

const BALANCE_OF = "0x70a08231"; // balanceOf(address)
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const RPC_TIMEOUT_MS = 10000;

async function balanceOf(address) {
  // The registry's balanceOf reverts for the zero address (ERC-721 spec:
  // the zero address can never own a token), so answer that one locally —
  // 0x0 definitionally holds no Agent ID.
  if (address.toLowerCase() === ZERO_ADDRESS) return 0n;
  const data = BALANCE_OF + address.slice(2).toLowerCase().padStart(64, "0");
  let rpcErr; // a JSON-RPC error is an on-chain conclusion — prefer reporting it
  let netErr; // a network failure only says that endpoint was unreachable
  for (const rpc of RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to: REGISTRY, data }, "latest"],
        }),
        signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
      });
      const json = await res.json();
      if (json.result) return BigInt(json.result);
      rpcErr = new Error(JSON.stringify(json.error ?? json));
    } catch (e) {
      netErr = e;
    }
  }
  throw rpcErr ?? netErr ?? new Error("all RPCs failed");
}

const addrs = process.argv.slice(2);
if (addrs.length === 0 || addrs.some((a) => !/^0x[0-9a-fA-F]{40}$/.test(a))) {
  console.error("usage: node is-human.mjs 0xAddress [0xAddress...]");
  process.exit(2);
}

let allHuman = true;
let hadError = false;
for (const a of addrs) {
  try {
    const bal = await balanceOf(a);
    const human = bal > 0n;
    allHuman &&= human;
    console.log(
      JSON.stringify({
        address: a,
        isHuman: human,
        agentIdBalance: bal.toString(),
        registry: REGISTRY,
        chain: "BNB Chain (56)",
        meaning: human
          ? "holds an Agent ID: a unique KYC-anchored human is behind this address (the ID itself proves uniqueness, not trustworthiness)"
          : "no Agent ID: cannot be confirmed as a unique human via Agent ID",
      })
    );
  } catch (e) {
    // One bad address must not abort the batch: report it and move on;
    // the exit code reflects the failure at the end.
    hadError = true;
    console.error(`error checking ${a}: ${e.message}`);
  }
}
process.exit(hadError ? 2 : allHuman ? 0 : 1);
