// Operator tool: register an attested X binding (IdentityBindingsV3).
// BEFORE running: the registrar (a human/agent operator) must have opened
// the public tweet and confirmed ALL of:
//   1. the tweet author is exactly @<handle>;
//   2. the tweet text contains the exact address and the exact code below;
//   3. the tweet is public and predates this registration.
// Usage: node scripts/register-attested.js <address> <handle> <tweetUrl>
//
// Target (bindings contract / chain / RPCs) resolution, in order:
//   1. env BINDINGS_ADDRESS (with env CHAIN_ID, env RPCS comma list)
//   2. mainnet-address.json, when it exists -> its bindings (the V11
//      launch deploys IdentityBindingsV3 there), chainId 56
//   3. v11-address.json -> its bindingsV3, BSC testnet, chainId 97
//      (the V11 trial stack; the pre-launch default)
//   4. bindings-v2-address.json -> BSC testnet, chainId 97 (legacy V2
//      stack, kept so old bindings stay serviceable)
// Mainnet deliberately outranks the testnet records: once the launch
// record exists, an operator run must not silently land on a testnet
// stack.
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const TESTNET_RPCS = ["https://bsc-testnet-rpc.publicnode.com", "https://bnb-testnet.api.onfinality.io/public"];
const MAINNET_RPCS = ["https://bsc-rpc.publicnode.com", "https://bsc-dataseed.binance.org", "https://bsc-dataseed1.bnbchain.org"];

function resolveTarget() {
  if (process.env.BINDINGS_ADDRESS) {
    return {
      bindings: ethers.getAddress(process.env.BINDINGS_ADDRESS),
      chainId: Number(process.env.CHAIN_ID || 97),
      rpcs: (process.env.RPCS || TESTNET_RPCS.join(",")).split(",").map((s) => s.trim()).filter(Boolean),
      source: "env BINDINGS_ADDRESS",
    };
  }
  const mainnetPath = path.join(__dirname, "..", "mainnet-address.json");
  if (fs.existsSync(mainnetPath)) {
    const rec = JSON.parse(fs.readFileSync(mainnetPath, "utf8"));
    if (!rec.bindings) throw new Error("mainnet-address.json exists but has no bindings address — refusing to guess the target");
    return { bindings: rec.bindings, chainId: 56, rpcs: MAINNET_RPCS, source: "mainnet-address.json" };
  }
  const v11Path = path.join(__dirname, "..", "v11-address.json");
  if (fs.existsSync(v11Path)) {
    const rec = JSON.parse(fs.readFileSync(v11Path, "utf8"));
    const bindings = rec.bindingsV3 || rec.bindings;
    if (!bindings) throw new Error("v11-address.json exists but has no bindingsV3 address — refusing to guess the target");
    return { bindings, chainId: 97, rpcs: TESTNET_RPCS, source: "v11-address.json (testnet trial stack)" };
  }
  const rec = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "bindings-v2-address.json"), "utf8"));
  return { bindings: rec.bindingsV2, chainId: 97, rpcs: TESTNET_RPCS, source: "bindings-v2-address.json (testnet, legacy V2)" };
}

async function rpc(url, method, params) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await res.json();
  if (j.error) throw new Error(method + ": " + JSON.stringify(j.error));
  return j.result;
}
async function main() {
  const [addrArg, handleArg, tweetUrl] = process.argv.slice(2);
  if (!addrArg || !handleArg || !tweetUrl) { console.error("usage: node scripts/register-attested.js <address> <handle> <tweetUrl>"); process.exit(1); }
  const address = ethers.getAddress(addrArg);
  const handle = handleArg.replace(/^@/, "").toLowerCase();
  const expectedCode = "BC-" + ethers.keccak256(ethers.toUtf8Bytes(address.toLowerCase() + "@" + handle)).slice(2, 8).toUpperCase();
  console.log("address:", address, "| handle: @" + handle, "| expected code in tweet:", expectedCode);
  console.log("evidence tweet:", tweetUrl);
  console.log("CHECK NOW: author == @" + handle + ", text contains the address AND code " + expectedCode + ". If anything differs, abort (Ctrl+C). Waiting 5s…");
  await new Promise(r => setTimeout(r, 5000));
  const target = resolveTarget();
  const RPCS = target.rpcs;
  const BINDINGS = target.bindings;
  console.log("target bindings:", BINDINGS, "| chainId:", target.chainId, "| source:", target.source);
  const provider = new ethers.JsonRpcProvider(RPCS[0], target.chainId, { staticNetwork: true });
  const deployer = new ethers.Wallet(fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim());
  const art = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "artifacts", "contracts", "IdentityBindingsV3.sol", "IdentityBindingsV3.json"), "utf8"));
  const iface = new ethers.Interface(art.abi);
  const c = new ethers.Contract(BINDINGS, art.abi, provider);
  console.log("current proofType:", (await c.proofTypeOf(address)).toString(), "(255 = none)");
  const data = iface.encodeFunctionData("registerByAttestation", [address, handle]);
  const nonce = await provider.getTransactionCount(deployer.address, "latest");
  const gasPrice = (await provider.getFeeData()).gasPrice ?? 1000000000n;
  const signed = await deployer.signTransaction({ to: BINDINGS, data, nonce, gasLimit: 200000n, gasPrice, chainId: target.chainId, type: 0 });
  let hash;
  for (const url of RPCS) { try { hash = await rpc(url, "eth_sendRawTransaction", [signed]); break; } catch (e) { console.log("send via", url, "failed:", e.message.slice(0, 80)); } }
  if (!hash) throw new Error("broadcast failed");
  console.log("tx:", hash);
  for (let i = 0; i < 40; i++) { const rc = await rpc(RPCS[0], "eth_getTransactionReceipt", [hash]); if (rc) { console.log("status:", rc.status); break; } await new Promise(r => setTimeout(r, 3000)); }
  console.log("proofType now:", (await c.proofTypeOf(address)).toString(), "(1 = attested) | valid:", await c.isBindingValid(address));
}
main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
