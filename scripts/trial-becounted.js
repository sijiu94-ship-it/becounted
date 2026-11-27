// Live trial of the renamed BeCounted testnet stack:
//   1) isHuman for deployer / w1 / w2 on the new gate
//   2) register the @becounted_demo X binding on the new IdentityBindings
//      (statement now starts "BeCounted X binding") and verify it
//   3) labelled vote on the new OneIDCampaignsV8: 3 votes, tally 2/0/1,
//      optionLabelsOf readback
//   4) day-0 stamp claim on the new QuestPass rehearsal season
//   5) one share claim on the new GatedClaim demo
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
const NO_COND = [false, ethers.ZeroAddress, 0n, false, ethers.MaxUint256, 0, ethers.ZeroAddress, ethers.ZeroHash];

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
  const wp = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "keys", "vote-proof-wallets.json"), "utf8"));
  const w1 = new ethers.Wallet(wp.wallet1);
  const w2 = new ethers.Wallet(wp.wallet2);
  console.log("deployer:", deployer.address, "\nw1:", w1.address, "\nw2:", w2.address);

  // 1) isHuman on the new gate
  const gate = new ethers.Contract(stack.gate, artifact("BeCounted"), provider);
  for (const [n, w] of [["deployer", deployer], ["w1", w1], ["w2", w2]]) {
    console.log("isHuman(" + n + "):", await gate.isHuman(w.address));
  }

  // 2) X binding with the new statement
  const bindAbi = artifact("IdentityBindings");
  const bindings = new ethers.Contract(stack.bindings, bindAbi, provider);
  const stmt = await bindings.statementFor("becounted_demo", deployer.address);
  console.log("statement:", JSON.stringify(stmt));
  const sig = await deployer.signMessage(stmt);
  const bIface = new ethers.Interface(bindAbi);
  const rb = await send(deployer, provider, stack.bindings, bIface.encodeFunctionData("registerBinding", ["becounted_demo", sig]));
  console.log("registerBinding tx:", rb.hash);
  console.log("isBindingValid(deployer):", await bindings.isBindingValid(deployer.address));
  const bo = await bindings.bindingOf(deployer.address);
  console.log("bindingOf handle:", bo[0]);

  // 3) labelled vote on the new V8
  const appsAbi = artifact("OneIDCampaignsV8");
  const apps = new ethers.Contract(stack.appsV8, appsAbi, provider);
  const aIface = new ethers.Interface(appsAbi);
  const now = Math.floor(Date.now() / 1000);
  const labels = ["支持", "反对", "再想想"];
  const cv = await send(deployer, provider, stack.appsV8, aIface.encodeFunctionData("createVote", ["BeCounted launch check — labelled vote", now - 5, now + 3600, 3, ethers.ZeroAddress, 0n, 0, 0, NO_COND, labels]));
  console.log("createVote tx:", cv.hash, "campaignCount:", (await apps.campaignCount()).toString());
  const id = (await apps.campaignCount()) - 1n;
  console.log("optionLabelsOf:", JSON.stringify(await apps.optionLabelsOf(id)));
  await send(deployer, provider, stack.appsV8, aIface.encodeFunctionData("castVote", [id, 0, []]));
  await send(w1, provider, stack.appsV8, aIface.encodeFunctionData("castVote", [id, 0, []]));
  await send(w2, provider, stack.appsV8, aIface.encodeFunctionData("castVote", [id, 2, []]));
  console.log("tally:", (await apps.tally(id)).map((x) => x.toString()).join("/"));

  // 4) QuestPass day-0 stamp
  const questAbi = artifact("QuestPass");
  const quest = new ethers.Contract(stack.questPass, questAbi, provider);
  const startAt = Number(await quest.startAt());
  const wait = startAt - Math.floor(Date.now() / 1000) + 3;
  if (wait > 0) { console.log("waiting", wait, "s for season start..."); await sleep(wait * 1000); }
  const qIface = new ethers.Interface(questAbi);
  const balBefore = await provider.getBalance(deployer.address);
  const cs = await send(deployer, provider, stack.questPass, qIface.encodeFunctionData("claimStamp", []));
  console.log("claimStamp tx:", cs.hash, "stampCount(deployer):", (await quest.stampCount(deployer.address)).toString(), "dayPaid(0):", ethers.formatEther(await quest.dayPaid(0)));

  // 5) GatedClaim share
  const tplAbi = artifact("GatedClaim", "templates");
  const tpl = new ethers.Contract(stack.gatedClaimDemo, tplAbi, provider);
  const tIface = new ethers.Interface(tplAbi);
  const cl = await send(deployer, provider, stack.gatedClaimDemo, tIface.encodeFunctionData("claim", []));
  console.log("GatedClaim claim tx:", cl.hash, "claimedCount:", (await tpl.claimedCount()).toString());

  console.log("TRIAL BECOUNTED DONE");
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
