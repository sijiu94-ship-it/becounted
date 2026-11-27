// mainnet-quest.js — MAINNET QuestPass driver for the season steps that
// need an operator push, above all the 2026-12-03 finale.
//
// Reads the QuestPass address from mainnet-address.json (written by
// scripts/deploy-mainnet.js) and refuses to run without a valid mainnet
// record. Self-contained phase machine (it does NOT reuse
// rehearsal-quest.js: the rehearsal season runs the pre-V11 QuestPass,
// whose seed cannot be re-locked; the mainnet contract can).
//
// Finale discipline (V11 seed state machine, LAUNCH-RUNBOOK §8):
// the finale seed is locked with lockFinaleSeed() (seed block =
// current + 2). A lock stays drawable only while its blockhash is
// inside the 256-block window. This driver is RE-LOCK AWARE:
//   - no lock yet, or the locked seed block has aged out (> seed + 256)
//     -> lockFinaleSeed() again (the contract allows re-locking exactly
//        in that state, and reverts while a lock is still valid, so a
//        fresh seed can never be shopped for);
//   - locked and the seed block has landed -> drawFinale() in the SAME
//     run (it waits in-process for the seed block instead of exiting),
//     so lock and draw stay seconds apart and the draw's internal
//     fallback seed (usedFallbackSeed) never engages.
// Every step re-checks state first — safe to re-run any number of times.
//
//   node scripts/mainnet-quest.js
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const recPath = path.join(__dirname, "..", "mainnet-address.json");
if (!fs.existsSync(recPath)) {
  console.error("mainnet-address.json not found — deploy first (scripts/deploy-mainnet.js)");
  process.exit(1);
}
const rec = JSON.parse(fs.readFileSync(recPath, "utf8"));
if (!rec.quest || rec.chainId !== 56) {
  console.error("mainnet-address.json has no mainnet quest address (chainId=" + rec.chainId + ") — refusing to run");
  process.exit(1);
}
const QUEST = rec.quest;
const CHAIN_ID = 56;
const READ_RPC = "https://bsc-rpc.publicnode.com";
const SEND_RPCS = [
  "https://bsc-rpc.publicnode.com",
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.bnbchain.org",
  "https://bsc-dataseed2.bnbchain.org",
  "https://bnbchain.api.onfinality.io/public",
];
const GAS_PRICE_FALLBACK = 1000000000n;
const UNIT = "USDC"; // mainnet season pays BSC USDC (18 decimals)

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
  const provider = new ethers.JsonRpcProvider(READ_RPC, CHAIN_ID, { staticNetwork: true });
  const deployer = new ethers.Wallet(fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim());
  const qAbi = artifact("QuestPass");
  const q = new ethers.Contract(QUEST, qAbi, provider);
  const qIface = new ethers.Interface(qAbi);
  const me = deployer.address;
  const phase = Number(await q.phase());
  const stamps = Number(await q.stampCount(me));
  console.log(`mainnet-quest: quest=${QUEST} chainId=${CHAIN_ID} phase=${phase} stamps=${stamps} minStamps=${(await q.minStamps()).toString()} finaleDrawn=${await q.finaleDrawn()}`);
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
    if (await q.finaleDrawn()) { console.log("phase 3: finale already drawn — nothing to do"); return; }
    // Re-lock aware seed handling: lock when there is no lock, RE-lock
    // when the locked seed block has aged out of the 256-block window.
    let seedBlock = await q.finaleSeedBlock();
    const nowBlock = await provider.getBlockNumber();
    const expired = seedBlock !== 0n && BigInt(nowBlock) > seedBlock + 256n;
    if (seedBlock === 0n || expired) {
      if (expired) console.log(`phase 3: locked seed block ${seedBlock.toString()} has aged out (now ${nowBlock}) — re-locking a fresh seed`);
      const r = await send(deployer, provider, QUEST, qIface.encodeFunctionData("lockFinaleSeed", []));
      seedBlock = await q.finaleSeedBlock();
      console.log(`phase 3: lockFinaleSeed tx ${r.hash} -> seed block ${seedBlock.toString()}`);
    } else {
      console.log(`phase 3: seed already locked at block ${seedBlock.toString()} (still inside its window)`);
    }
    // Wait IN-PROCESS for the seed block to land, then draw in the same
    // run — lock and draw stay seconds apart, the fallback never engages.
    const deadline = Date.now() + 180000;
    for (;;) {
      const b = await provider.getBlockNumber();
      if (BigInt(b) > seedBlock) break;
      if (Date.now() > deadline) { console.log(`phase 3: seed block ${seedBlock.toString()} not reached within 180s (now ${b}) — re-run to draw`); return; }
      await sleep(1000);
    }
    if (await q.finaleDrawn()) { console.log("phase 3: finale was drawn by someone else meanwhile — done"); return; }
    const rd = await send(deployer, provider, QUEST, qIface.encodeFunctionData("drawFinale", []));
    console.log(`phase 3: drawFinale tx ${rd.hash} · usedFallbackSeed=${await q.usedFallbackSeed()} (expect false)`);
    const winners = await q.getWinners();
    console.log("winners:", JSON.stringify(winners), "prizePerWinner:", ethers.formatEther(await q.prizePerWinner()), UNIT);
    if (await q.isWinner(me)) {
      if (await q.prizeClaimed(me)) { console.log("deployer won and already claimed"); return; }
      const rc = await send(deployer, provider, QUEST, qIface.encodeFunctionData("claimPrize", []));
      console.log(`claimPrize tx ${rc.hash} -> deployer claimed ${ethers.formatEther(await q.prizePerWinner())} ${UNIT}`);
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
