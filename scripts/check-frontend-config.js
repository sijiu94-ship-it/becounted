// Regression: extract the address config from web/assets/app.js itself
// and verify it against the live testnet stack; then refresh the
// deployer's on-chain demo profile to the new brand.
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const READ_RPC = "https://bsc-testnet-rpc.publicnode.com";
const SEND_RPCS = [READ_RPC, "https://bnb-testnet.api.onfinality.io/public", "https://bsc-testnet.publicnode.com"];

function extract(appJs, name) {
  const m = appJs.match(new RegExp("const " + name + "\\s*=\\s*\"(0x[0-9a-fA-F]+)\""));
  if (!m) throw new Error("const not found: " + name);
  return m[1];
}
function artifact(name, sub) {
  const p = path.join(__dirname, "..", "artifacts", "contracts", sub || "", name + ".sol", name + ".json");
  return JSON.parse(fs.readFileSync(p, "utf8")).abi;
}
async function rpc(url, method, params) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await res.json();
  if (j.error) throw new Error(method + ": " + JSON.stringify(j.error));
  return j.result;
}
async function broadcast(raw) {
  let last;
  for (const url of SEND_RPCS) {
    try { return await rpc(url, "eth_sendRawTransaction", [raw]); }
    catch (e) { last = e; if (/already known/i.test(e.message)) return ethers.keccak256(raw); if (/nonce too low/i.test(e.message)) throw e; }
  }
  throw last ?? new Error("broadcast failed");
}
async function waitReceipt(hash) {
  for (let i = 0; i < 40; i++) { const rc = await rpc(READ_RPC, "eth_getTransactionReceipt", [hash]); if (rc) return rc; await new Promise(r => setTimeout(r, 3000)); }
  throw new Error("receipt timeout " + hash);
}

async function main() {
  const appJs = fs.readFileSync(path.join(__dirname, "..", "web", "assets", "app.js"), "utf8");
  const GATE = extract(appJs, "GATE_TESTNET");
  const APPS = extract(appJs, "APPS_TESTNET");
  const BIND = extract(appJs, "BINDINGS_TESTNET");
  const QUEST = extract(appJs, "QUEST_TESTNET");
  const PROFILE = extract(appJs, "PROFILE_TESTNET");
  const blockM = appJs.match(/const APPS_DEPLOY_BLOCK = (\d+)/);
  console.log("config:", { GATE, APPS, BIND, QUEST, PROFILE, APPS_DEPLOY_BLOCK: blockM[1] });

  const provider = new ethers.JsonRpcProvider(READ_RPC, 97, { staticNetwork: true });
  const deployer = new ethers.Wallet(fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim());

  const gate = new ethers.Contract(GATE, artifact("BeCounted"), provider);
  console.log("gate.isHuman(deployer):", await gate.isHuman(deployer.address));
  const apps = new ethers.Contract(APPS, artifact("OneIDCampaignsV10"), provider);
  console.log("apps.campaignCount:", (await apps.campaignCount()).toString());
  console.log("apps.optionLabelsOf(0):", JSON.stringify(await apps.optionLabelsOf(0)));
  console.log("apps.gate():", await apps.gate());
  const bindings = new ethers.Contract(BIND, artifact("IdentityBindings"), provider);
  console.log("bindings.isBindingValid(deployer):", await bindings.isBindingValid(deployer.address));
  const quest = new ethers.Contract(QUEST, artifact("QuestPass"), provider);
  console.log("quest.stampCount(deployer):", (await quest.stampCount(deployer.address)).toString());

  // Refresh the demo profile to the new brand
  const profAbi = artifact("IdentityProfile");
  const prof = new ethers.Contract(PROFILE, profAbi, provider);
  const before = await prof.profileOf(deployer.address);
  console.log("profile before:", JSON.stringify(before[0]));
  const iface = new ethers.Interface(profAbi);
  const data = iface.encodeFunctionData("setProfile", ["BeCounted demo account", [["BeCounted", "https://becounted.9nosing.com/"]]]);
  const nonce = await provider.getTransactionCount(deployer.address, "pending");
  const tx = { to: PROFILE, data, value: 0n, nonce, gasLimit: 400000n, gasPrice: 1000000000n, chainId: 97, type: 0 };
  const raw = await deployer.signTransaction(tx);
  const hash = await broadcast(raw);
  const rc = await waitReceipt(hash);
  if (rc.status !== "0x1") throw new Error("setProfile reverted");
  const after = await prof.profileOf(deployer.address);
  console.log("profile after:", JSON.stringify(after[0]), "links:", JSON.stringify(after[1]));
  console.log("FRONTEND CONFIG CHECK DONE");
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
