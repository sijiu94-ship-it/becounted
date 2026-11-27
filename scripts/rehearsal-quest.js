// QuestPass season phase machine — safe to run any time: it reads the
// season phase first and does exactly the one step the season is
// currently waiting for (claim today's stamp / enter the finale / lock
// the seed / draw / claim the prize). Every branch re-checks state
// before sending, so re-runs are idempotent.
//
// Default target: the TESTNET rehearsal season (QuestPass
// 0x90c3320557db7540a5899e7d3bc0577e399ec378 on BSC testnet, chainId
// 97) — this is what the daily rehearsal cron runs, unchanged.
//
// The same machine drives the MAINNET finale via
// scripts/mainnet-quest.js (which injects the env below from
// mainnet-address.json). Env overrides:
//   QUEST_ADDRESS  QuestPass contract (default: rehearsal season)
//   CHAIN_ID       97 (testnet) / 56 (mainnet)
//   READ_RPC       single read endpoint
//   SEND_RPCS      comma-separated broadcast endpoints
//   GAS_PRICE      fixed gas price in wei (default: chain fee data,
//                  falling back to 1 gwei)
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const CHAIN_ID = Number(process.env.CHAIN_ID || 97);
const READ_RPC = process.env.READ_RPC || "https://bsc-testnet-rpc.publicnode.com";
const SEND_RPCS = (process.env.SEND_RPCS ||
  "https://bsc-testnet-rpc.publicnode.com,https://bnb-testnet.api.onfinality.io/public,https://bsc-testnet.publicnode.com"
).split(",").map((s) => s.trim()).filter(Boolean);
const QUEST = process.env.QUEST_ADDRESS || "0x90c3320557db7540a5899e7d3bc0577e399ec378";
const GAS_PRICE_FALLBACK = 1000000000n;
// Prize token label for logs: rehearsal pays tBNB, the mainnet season
// pays BSC USDC (also 18 decimals, so formatEther reads correctly).
const UNIT = CHAIN_ID === 56 ? "USDC" : "BNB";

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
async function gasPriceNow(provider) {
  if (process.env.GAS_PRICE) return BigInt(process.env.GAS_PRICE);
  try { return (await provider.getFeeData()).gasPrice ?? GAS_PRICE_FALLBACK; } catch { return GAS_PRICE_FALLBACK; }
}
async function send(wallet, provider, to, data, value = 0n) {
  const nonce = await provider.getTransactionCount(wallet.address, "pending");
  // Estimate per call (the mainnet finale draw loops over every entry —
  // a fixed cap would be wrong there); fall back to the historical cap.
  let gasLimit = 500000n;
  try { gasLimit = (await provider.estimateGas({ from: wallet.address, to, data, value })) * 130n / 100n; } catch { /* keep fallback */ }
  const tx = { to, data, value, nonce, gasLimit, gasPrice: await gasPriceNow(provider), chainId: CHAIN_ID, type: 0 };
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
  // QuestPass season phase machine. Safe to run any time:
  // it does exactly the one step the season is currently waiting for.
  const provider = new ethers.JsonRpcProvider(READ_RPC, CHAIN_ID, { staticNetwork: true });
  const deployer = new ethers.Wallet(fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim());
  const qAbi = artifact("QuestPass");
  const q = new ethers.Contract(QUEST, qAbi, provider);
  const qIface = new ethers.Interface(qAbi);
  const me = deployer.address;
  const phase = Number(await q.phase());
  const stamps = Number(await q.stampCount(me));
  console.log(`quest=${QUEST} chainId=${CHAIN_ID} phase=${phase} stamps=${stamps} minStamps=${(await q.minStamps()).toString()} finaleDrawn=${await q.finaleDrawn()}`);
  if (phase === 1) {
    const day = Number(await q.currentDay());
    if (await q.hasStampedOn(me, day)) { console.log(`day ${day}: already stamped, nothing to do`); return; }
    const r = await send(deployer, provider, QUEST, qIface.encodeFunctionData("claimStamp", []));
    console.log(`day ${day}: claimStamp tx ${r.hash} -> stamps now ${(await q.stampCount(me)).toString()}`);
    return;
  }
  if (phase === 2) {
    if (!(await q.eligible(me))) { console.log("phase 2 but NOT eligible (not enough stamps) — finale will have no deployer entry"); return; }
    if (await q.hasEnteredFinale(me)) { console.log("phase 2: already entered finale"); return; }
    const r = await send(deployer, provider, QUEST, qIface.encodeFunctionData("enterFinale", []));
    console.log(`phase 2: enterFinale tx ${r.hash} -> finale entries ${(await q.finaleEntryCount()).toString()}`);
    return;
  }
  if (phase === 3) {
    let seedBlock = await q.finaleSeedBlock();
    if (seedBlock === 0n) {
      const r = await send(deployer, provider, QUEST, qIface.encodeFunctionData("lockFinaleSeed", []));
      seedBlock = await q.finaleSeedBlock();
      console.log(`phase 3: lockFinaleSeed tx ${r.hash} -> seed block ${seedBlock.toString()}`);
    }
    const nowBlock = await provider.getBlockNumber();
    if (BigInt(nowBlock) <= seedBlock) { console.log(`phase 3: waiting for seed block ${seedBlock.toString()} (now ${nowBlock}) — rerun shortly`); return; }
    const rd = await send(deployer, provider, QUEST, qIface.encodeFunctionData("drawFinale", []));
    console.log(`phase 3: drawFinale tx ${rd.hash}`);
    const winners = await q.getWinners();
    console.log("winners:", JSON.stringify(winners), "prizePerWinner:", ethers.formatEther(await q.prizePerWinner()), UNIT);
    if (await q.isWinner(me)) {
      if (await q.prizeClaimed(me)) { console.log("deployer won and already claimed"); return; }
      const before = await provider.getBalance(me);
      const rc = await send(deployer, provider, QUEST, qIface.encodeFunctionData("claimPrize", []));
      const after = await provider.getBalance(me);
      console.log(`claimPrize tx ${rc.hash} -> deployer balance delta (incl. gas): ${ethers.formatEther(after - before)} BNB`);
    } else {
      console.log("deployer did not win the finale (fine — the flow is what matters)");
    }
    console.log(`FINALE COMPLETE: finalePaidTotal=${ethers.formatEther(await q.finalePaidTotal())} ${UNIT}`);
    return;
  }
  if (phase === 4) { console.log("phase 4: finale already drawn — season complete"); return; }
  console.log("phase 0: season not started yet");
}
main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
