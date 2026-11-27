// trial-v7.js — TESTNET-ONLY live trial for OneIDCampaignsV7.
// Proves on BSC testnet:
//   A) allowlist raffle — a human NOT on the list is rejected with
//      ConditionFailed(4) (static call), listed addresses enter with
//      their Merkle proofs, and the committed root reads back.
//   B) prize vote — 3 voters, escrowed 0.0015 tBNB pool, 2 winners
//      drawn after the end, per-winner 0.00075, first winner claims.
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
const APPS = "0xfdcb5240fe2bba8d0dd7b325082dc2d8697f0a8f";

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
async function send(wallet, to, data, value = 0n, gasLimit = 600000n) {
  const nonce = await provider.getTransactionCount(wallet.address, "pending");
  const gasPrice = 1000000000n; // pinned 1 gwei: publicnode feeData spikes broke a run
  const raw = await wallet.signTransaction({ to, data, value, nonce, gasLimit, gasPrice, chainId: 97, type: 0 });
  const hash = await broadcast(raw);
  const rc = await waitReceipt(hash);
  if (rc.status !== "0x1") throw new Error("tx reverted: " + hash);
  return rc;
}

// Merkle helpers — identical construction to the contract and the site.
function leafOf(addr) { return ethers.keccak256(ethers.solidityPacked(["address"], [addr])); }
function hashPair(a, b) { const [x, y] = a < b ? [a, b] : [b, a]; return ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [x, y])); }
function buildLayers(addrs) {
  let level = addrs.map(leafOf); const layers = [level];
  while (level.length > 1) { const next = []; for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? hashPair(level[i], level[i + 1]) : level[i]); level = next; layers.push(level); }
  return layers;
}
function rootOf(addrs) { const l = buildLayers(addrs); return l[l.length - 1][0]; }
function proofOf(addrs, target) {
  const layers = buildLayers(addrs); let idx = addrs.findIndex(a => a.toLowerCase() === target.toLowerCase()); const proof = [];
  for (let li = 0; li < layers.length - 1; li++) { const level = layers[li]; const sib = idx % 2 === 0 ? idx + 1 : idx - 1; if (sib < level.length) proof.push(level[sib]); idx = Math.floor(idx / 2); }
  return proof;
}

const NO_COND = [false, ethers.ZeroAddress, 0n, false, ethers.MaxUint256, 0, ethers.ZeroAddress, ethers.ZeroHash];

async function main() {
  const dkey = fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim();
  const deployer = new ethers.Wallet(dkey);
  const proofKeys = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "keys", "vote-proof-wallets.json"), "utf8"));
  const w1 = new ethers.Wallet(proofKeys.wallet1);
  const w2 = new ethers.Wallet(proofKeys.wallet2);
  for (const w of [w1, w2]) {
    const b = await provider.getBalance(w.address);
    console.log("balance", w.address, ethers.formatEther(b), "tBNB");
    if (b < ethers.parseEther("0.004")) {
      await send(deployer, w.address, "0x", ethers.parseEther("0.003"), 21000n);
      console.log("  topped up", w.address);
    }
  }
  const abi = artifact("OneIDCampaignsV7");
  const apps = new ethers.Contract(APPS, abi, provider);
  const now = (await provider.getBlock("latest")).timestamp;
  const blk = await provider.getBlockNumber();
  console.log("apps:", APPS, "| deployer:", deployer.address, "| w1:", w1.address, "| w2:", w2.address);

  // ---------- A) allowlist raffle ----------
  const list = [deployer.address, w1.address];
  const root = rootOf(list);
  const cond = [...NO_COND.slice(0, 7), root];
  let rc = await send(deployer, APPS, apps.interface.encodeFunctionData("createRaffle", ["V7 Trial — allowlist raffle", now - 5, now + 3600, 1, blk + 100, ethers.ZeroAddress, 0n, cond]));
  let ev = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } }).find(e => e && e.name === "CampaignCreated");
  const raffleId = Number(ev.args.id);
  console.log("A) allowlist raffle id:", raffleId, "root:", root);
  const cd = await apps.conditionsOf(raffleId);
  console.log("   conditionsOf.allowRoot matches:", cd.allowRoot === root);
  // w2 is a Mock-ID human but NOT on the list -> static call must revert ConditionFailed
  let rejected = false;
  try {
    await provider.call({ from: w2.address, to: APPS, data: apps.interface.encodeFunctionData("enterRaffle", [raffleId, []]) });
  } catch (e) { rejected = /ConditionFailed/.test(String(e.message)) || String(e.data ?? "").length > 2; console.log("   w2 (not listed) static enter -> reverted:", String(e.message).slice(0, 110)); }
  if (!rejected) throw new Error("w2 static enter did NOT revert");
  await send(deployer, APPS, apps.interface.encodeFunctionData("enterRaffle", [raffleId, proofOf(list, deployer.address)]), 0n, 300000n);
  await send(w1, APPS, apps.interface.encodeFunctionData("enterRaffle", [raffleId, proofOf(list, w1.address)]), 0n, 300000n);
  console.log("   deployer entered:", await apps.hasEntered(raffleId, deployer.address), "| w1 entered:", await apps.hasEntered(raffleId, w1.address), "| w2 entered:", await apps.hasEntered(raffleId, w2.address));

  // ---------- B) prize vote ----------
  const now2 = (await provider.getBlock("latest")).timestamp;
  const blk2 = await provider.getBlockNumber();
  const pool = ethers.parseEther("0.0015");
  rc = await send(deployer, APPS, apps.interface.encodeFunctionData("createVote", ["V7 Trial — prize vote", now2 - 5, now2 + 150, 2, ethers.ZeroAddress, pool, 2, blk2 + 330, NO_COND]), pool);
  ev = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } }).find(e => e && e.name === "CampaignCreated");
  const voteId = Number(ev.args.id);
  console.log("B) prize vote id:", voteId, "pool:", ethers.formatEther(pool), "tBNB, winners: 2, seedBlock:", blk2 + 330);
  await send(deployer, APPS, apps.interface.encodeFunctionData("castVote", [voteId, 0, []]), 0n, 300000n);
  await send(w1, APPS, apps.interface.encodeFunctionData("castVote", [voteId, 0, []]), 0n, 300000n);
  await send(w2, APPS, apps.interface.encodeFunctionData("castVote", [voteId, 1, []]), 0n, 300000n);
  console.log("   votes cast: tally0 =", (await apps.tally(voteId, 0)).toString(), "tally1 =", (await apps.tally(voteId, 1)).toString());
  // wait for end + seed block
  for (let i = 0; i < 40; i++) {
    const t = (await provider.getBlock("latest")).timestamp; const b = await provider.getBlockNumber();
    if (t > now2 + 155 && b > blk2 + 330) break;
    await new Promise(r => setTimeout(r, 10000));
  }
  await send(deployer, APPS, apps.interface.encodeFunctionData("draw", [voteId]), 0n, 600000n);
  const winners = await apps.getWinners(voteId);
  const camp = await apps.getCampaign(voteId);
  console.log("   drawn. winners:", winners, "| prizePerWinner:", ethers.formatEther(camp.prizePerWinner), "tBNB");
  const w0 = winners[0];
  const w0Wallet = [deployer, w1, w2].find(w => w.address.toLowerCase() === w0.toLowerCase());
  const balBefore = await provider.getBalance(w0);
  await send(w0Wallet, APPS, apps.interface.encodeFunctionData("claimPrize", [voteId]), 0n, 300000n);
  const balAfter = await provider.getBalance(w0);
  const camp2 = await apps.getCampaign(voteId);
  console.log("   winner[0] claimed. paidOut:", ethers.formatEther(camp2.paidOut), "tBNB | winner balance delta (net of gas):", ethers.formatEther(balAfter - balBefore), "tBNB | prizeClaimed:", await apps.prizeClaimed(voteId, w0));
  console.log("TRIAL V7 DONE");
}
main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
