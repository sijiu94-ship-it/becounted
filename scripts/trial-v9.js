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
  const v9 = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "v9-address.json"), "utf8"));
  const APPS = v9.appsV9;
  const provider = new ethers.JsonRpcProvider(READ_RPC, 97, { staticNetwork: true });
  const deployer = new ethers.Wallet(fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim());
  const wp = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "keys", "vote-proof-wallets.json"), "utf8"));
  const w1 = new ethers.Wallet(wp.wallet1);
  const w2 = new ethers.Wallet(wp.wallet2);
  const appsAbi = artifact("OneIDCampaignsV9");
  const apps = new ethers.Contract(APPS, appsAbi, provider);
  const aIface = new ethers.Interface(appsAbi);
  const now = Math.floor(Date.now() / 1000);
  const blk = await provider.getBlockNumber();

  // 1) labelled vote, 7 days, tally 2/0/1 (skip creation if a prior run made it)
  let vid = 0n;
  if ((await apps.campaignCount()) == 0n) {
    const labels = ["支持", "反对", "再想想"];
    const cv = await send(deployer, provider, APPS, aIface.encodeFunctionData("createVote", ["BeCounted launch check — labelled vote", now - 5, now + 7 * 86400, 3, ethers.ZeroAddress, 0n, 0, 0, NO_COND, labels]));
    vid = (await apps.campaignCount()) - 1n;
    console.log("vote id:", vid.toString(), "tx:", cv.hash, "labels:", JSON.stringify(await apps.optionLabelsOf(vid)));
    await send(deployer, provider, APPS, aIface.encodeFunctionData("castVote", [vid, 0, []]));
    await send(w1, provider, APPS, aIface.encodeFunctionData("castVote", [vid, 0, []]));
    await send(w2, provider, APPS, aIface.encodeFunctionData("castVote", [vid, 2, []]));
  }
  console.log("tally:", (await apps.tally(vid, 0)).toString() + "/" + (await apps.tally(vid, 1)).toString() + "/" + (await apps.tally(vid, 2)).toString());

  // 2) custom-prize raffle (V9 headline feature), w1 enters
  const cr = await send(deployer, provider, APPS, aIface.encodeFunctionData("createRaffle", ["Custom prize demo — whitelist raffle", now - 5, now + 7 * 86400, 1, blk + 100, ethers.ZeroAddress, 0n, NO_COND, "白名单名额 ×1（演示）"]));
  const rid = (await apps.campaignCount()) - 1n;
  console.log("raffle id:", rid.toString(), "tx:", cr.hash);
  const c = await apps.getCampaign(rid);
  console.log("prizeLabel readback:", JSON.stringify(c.prizeLabel), "| prizePerWinner:", c.prizePerWinner.toString());
  await send(w1, provider, APPS, aIface.encodeFunctionData("enterRaffle", [rid, []]));
  console.log("raffle entries:", (await apps.getCampaign(rid)).entryCount.toString());
  console.log("campaignCount:", (await apps.campaignCount()).toString());
}
main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
