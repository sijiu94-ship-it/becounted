// Finish the BeCounted stack trial: tally readback for vote id 0
// (tally is per-option: tally(id, option)), QuestPass day-0 stamp,
// GatedClaim share claim. The binding + vote casting already completed
// in trial-becounted.js.
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const READ_RPC = "https://bsc-testnet-rpc.publicnode.com";
const SEND_RPCS = [
  "https://bsc-testnet-rpc.publicnode.com",
  "https://bnb-testnet.api.onfinality.io/public",
  "https://bsc-testnet.publicnode.com",
];
const GAS_PRICE = 1000000000n;

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
async function send(wallet, provider, to, data, value = 0n) {
  const nonce = await provider.getTransactionCount(wallet.address, "pending");
  const tx = { to, data, value, nonce, gasLimit: 500000n, gasPrice: GAS_PRICE, chainId: 97, type: 0 };
  const raw = await wallet.signTransaction(tx);
  const hash = await broadcast(raw);
  const rc = await waitReceipt(hash);
  if (rc.status !== "0x1") throw new Error("tx reverted: " + hash);
  return { hash, block: parseInt(rc.blockNumber, 16) };
}
function artifact(name, sub) {
  const p = path.join(__dirname, "..", "artifacts", "contracts", sub || "", name + ".sol", name + ".json");
  return JSON.parse(fs.readFileSync(p, "utf8")).abi;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const stack = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "becounted-stack-address.json"), "utf8"));
  const provider = new ethers.JsonRpcProvider(READ_RPC, 97, { staticNetwork: true });
  const deployer = new ethers.Wallet(fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim());

  const apps = new ethers.Contract(stack.appsV8, artifact("OneIDCampaignsV8"), provider);
  const t = [await apps.tally(0, 0), await apps.tally(0, 1), await apps.tally(0, 2)];
  console.log("tally(0):", t.map((x) => x.toString()).join("/"));
  if (!(t[0] === 2n && t[1] === 0n && t[2] === 1n)) throw new Error("tally mismatch");

  const questAbi = artifact("QuestPass");
  const quest = new ethers.Contract(stack.questPass, questAbi, provider);
  const startAt = Number(await quest.startAt());
  const wait = startAt - Math.floor(Date.now() / 1000) + 3;
  if (wait > 0) { console.log("waiting", wait, "s for season start..."); await sleep(wait * 1000); }
  const qIface = new ethers.Interface(questAbi);
  const cs = await send(deployer, provider, stack.questPass, qIface.encodeFunctionData("claimStamp", []));
  console.log("claimStamp tx:", cs.hash, "stampCount(deployer):", (await quest.stampCount(deployer.address)).toString(), "dayPaid(0):", ethers.formatEther(await quest.dayPaid(0)));

  const tplAbi = artifact("GatedClaim", "templates");
  const tpl = new ethers.Contract(stack.gatedClaimDemo, tplAbi, provider);
  const tIface = new ethers.Interface(tplAbi);
  const cl = await send(deployer, provider, stack.gatedClaimDemo, tIface.encodeFunctionData("claim", []));
  console.log("GatedClaim claim tx:", cl.hash, "claimedCount:", (await tpl.claimedCount()).toString());

  console.log("TRIAL BECOUNTED DONE");
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
