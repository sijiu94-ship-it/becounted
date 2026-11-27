// trial-v8.js — TESTNET-ONLY live trial for OneIDCampaignsV8.
// Proves on BSC testnet:
//   A) labelled vote — option labels are stored on-chain at creation,
//      read back exactly, and votes tally against the labelled options.
//   B) labelled prize vote — escrowed pool, draw after the end, the
//      sole winner claims the whole pool; labels survive the flow.
// Uses the deployer + the two vote-proof wallets (Mock-ID holders).
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const READ_RPC = "https://bsc-testnet-rpc.publicnode.com";
const SEND_RPCS = [
  "https://bsc-testnet-rpc.publicnode.com",
  "https://bnb-testnet.api.onfinality.io/public",
  "https://bsc-testnet.publicnode.com",
];
const APPS = "0xc1673134d18ac881bd4c61ecf82e5e35a32c9a56";

function artifact(name) {
  const p = path.join(__dirname, "..", "artifacts", "contracts", name + ".sol", name + ".json");
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
const provider = new ethers.JsonRpcProvider(READ_RPC, 97, { staticNetwork: true });
async function send(wallet, to, data, value = 0n, gasLimit = 900000n) {
  const nonce = await provider.getTransactionCount(wallet.address, "pending");
  const gasPrice = 1000000000n; // pinned 1 gwei, same as trial-v7
  const raw = await wallet.signTransaction({ to, data, value, nonce, gasLimit, gasPrice, chainId: 97, type: 0 });
  const hash = await broadcast(raw);
  const rc = await waitReceipt(hash);
  if (rc.status !== "0x1") throw new Error("tx reverted: " + hash);
  return rc;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const NO_COND = [false, ethers.ZeroAddress, 0n, false, ethers.MaxUint256, 0, ethers.ZeroAddress, ethers.ZeroHash];

async function main() {
  const abi = artifact("OneIDCampaignsV8");
  const iface = new ethers.Interface(abi);
  const read = new ethers.Contract(APPS, abi, provider);
  const dkey = fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim();
  const deployer = new ethers.Wallet(dkey);
  const proofKeys = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "keys", "vote-proof-wallets.json"), "utf8"));
  const w1 = new ethers.Wallet(proofKeys.wallet1);
  const w2 = new ethers.Wallet(proofKeys.wallet2);
  const now = Math.floor(Date.now() / 1000);

  // ---- A) labelled plain vote ----
  const labelsA = ["支持", "反对", "再想想"];
  let rc = await send(deployer, APPS, iface.encodeFunctionData("createVote", ["V8 trial — labelled vote", now - 5, now + 3600, 3, ethers.ZeroAddress, 0n, 0, 0, NO_COND, labelsA]));
  let ev = rc.logs.map(l => { try { return iface.parseLog(l); } catch { return null; } }).find(e => e && e.name === "CampaignCreated");
  const idA = Number(ev.args.id);
  console.log("A: vote id", idA);
  await send(deployer, APPS, iface.encodeFunctionData("castVote", [idA, 0, []]));
  await send(w1, APPS, iface.encodeFunctionData("castVote", [idA, 2, []]));
  await send(w2, APPS, iface.encodeFunctionData("castVote", [idA, 0, []]));
  const backA = await read.optionLabelsOf(idA);
  if (JSON.stringify(backA) !== JSON.stringify(labelsA)) throw new Error("A: labels mismatch " + JSON.stringify(backA));
  const t0 = await read.tally(idA, 0), t1 = await read.tally(idA, 1), t2 = await read.tally(idA, 2);
  if (!(t0 === 2n && t1 === 0n && t2 === 1n)) throw new Error(`A: tally mismatch ${t0}/${t1}/${t2}`);
  if (Number(await read.voteOf(idA, w1.address)) !== 2) throw new Error("A: voteOf mismatch");
  console.log("A OK: labels on-chain, tally 2/0/1 against 支持/反对/再想想");

  // ---- B) labelled prize vote, full flow ----
  const labelsB = ["红方", "蓝方"];
  const pool = ethers.parseEther("0.001");
  const blk = await provider.getBlockNumber();
  const endB = now + 100;
  rc = await send(deployer, APPS, iface.encodeFunctionData("createVote", ["V8 trial — prize vote", now - 5, endB, 2, ethers.ZeroAddress, pool, 1, blk + 200, NO_COND, labelsB]), pool);
  ev = rc.logs.map(l => { try { return iface.parseLog(l); } catch { return null; } }).find(e => e && e.name === "CampaignCreated");
  const idB = Number(ev.args.id);
  console.log("B: prize vote id", idB);
  await send(deployer, APPS, iface.encodeFunctionData("castVote", [idB, 0, []]));
  await send(w1, APPS, iface.encodeFunctionData("castVote", [idB, 1, []]));
  const waitS = endB - Math.floor(Date.now() / 1000) + 4;
  console.log(`B: waiting ${waitS}s for the vote to end…`);
  await sleep(waitS * 1000);
  await send(deployer, APPS, iface.encodeFunctionData("draw", [idB]));
  const cB = await read.getCampaign(idB);
  if (!cB.drawn) throw new Error("B: not drawn");
  if (cB.prizePerWinner !== pool) throw new Error("B: prizePerWinner " + cB.prizePerWinner);
  const winners = await read.getWinners(idB);
  if (winners.length !== 1) throw new Error("B: winners " + winners.length);
  const w = winners[0].toLowerCase() === deployer.address.toLowerCase() ? deployer : w1;
  const before = await provider.getBalance(w.address);
  const rcClaim = await send(w, APPS, iface.encodeFunctionData("claimPrize", [idB]), 0n, 300000n);
  const gasCost = BigInt(rcClaim.gasUsed) * 1000000000n;
  const after = await provider.getBalance(w.address);
  if (after - before + gasCost !== pool) throw new Error("B: claim delta mismatch");
  const backB = await read.optionLabelsOf(idB);
  if (JSON.stringify(backB) !== JSON.stringify(labelsB)) throw new Error("B: labels mismatch");
  console.log("B OK: prize vote drawn, sole winner claimed 0.001 tBNB, labels intact");
  console.log("TRIAL V8 DONE");
}

main().catch(e => { console.error("TRIAL V8 FAILED:", e.message); process.exit(1); });
