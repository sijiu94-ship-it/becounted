// Deploy a NEW-source QuestPass trial instance on BSC testnet and run
// its new seed state machine end to end. Does NOT touch the running
// rehearsal season (0x90c3320557db7540a5899e7d3bc0577e399ec378, pre-V11
// source) — this is a separate, fast, small-parameter season on the
// V11 trial stack's gate (BeCounted 0x2464F1…4296 over MockRegistryV2
// 0xd7617C…2782), purely to prove the new mechanics live:
//
//   claimStamp -> (season end) -> enterFinale -> (entry window ends)
//   -> lockFinaleSeed -> WAIT until the seed block ages out of the
//      256-block blockhash window -> lockFinaleSeed AGAIN (re-lock must
//      succeed; the pre-V11 contract reverted here forever)
//   -> drawFinale (fresh seed, usedFallbackSeed must stay false)
//   -> claimPrize (sole entrant = deployer, prize asserted to the wei)
//
// Fast-season trick: STAMP_DAYS is a contract constant (7) and days are
// 86400s, so startAt is backdated to day 6 — stampEnd lands ~4 minutes
// after deployment, entryWindow is 150s, and minStamps is 1 so the one
// stamp claimed on day 6 qualifies for the finale. Prize token is BNB
// (token = address(0)); escrow is 7 x 0.0003 + 0.001 = 0.0031 tBNB.
// Results are merged into v11-address.json under questNew / questTrial.
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
const GATE = "0x2464F16146EA45C8b30fe3FED5E8f536C5344296";
const MOCK = "0xd7617CB77d5626D9131d3195776350cA69D02782";

function artifact(name, sub) {
  const p = path.join(__dirname, "..", "artifacts", "contracts", sub || "", name + ".sol", name + ".json");
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: j.abi, bytecode: j.bytecode, runtimeBytes: (j.deployedBytecode.length - 2) / 2 };
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
    try { const h = await rpc(url, "eth_sendRawTransaction", [raw]); console.log("  broadcast via", url); return h; }
    catch (e) { last = e; console.log("  send issue via", url, "-", e.message.slice(0, 100)); if (/nonce too low|already known/i.test(e.message)) return ethers.keccak256(raw); }
  }
  throw last ?? new Error("broadcast failed");
}
async function waitReceipt(hash) {
  for (let i = 0; i < 40; i++) { const rc = await rpc(READ_RPC, "eth_getTransactionReceipt", [hash]); if (rc) return rc; await new Promise(r => setTimeout(r, 3000)); }
  throw new Error("receipt timeout " + hash);
}
async function send(wallet, provider, to, data, value = 0n, gasLimit = 500000n) {
  const nonce = await provider.getTransactionCount(wallet.address, "pending");
  const tx = { to, data, value, nonce, gasLimit, gasPrice: GAS_PRICE, chainId: 97, type: 0 };
  const raw = await wallet.signTransaction(tx);
  const hash = await broadcast(raw);
  const rc = await waitReceipt(hash);
  return { hash, block: parseInt(rc.blockNumber, 16), status: rc.status, gasUsed: parseInt(rc.gasUsed, 16) };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const provider = new ethers.JsonRpcProvider(READ_RPC, 97, { staticNetwork: true });
  const deployer = new ethers.Wallet(fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim());
  console.log("deployer:", deployer.address, "tBNB:", ethers.formatEther(await provider.getBalance(deployer.address)));

  const mock = artifact("MockRegistryV2", "mocks");
  const mockC = new ethers.Contract(MOCK, mock.abi, provider);
  const gate = artifact("BeCounted");
  const gateC = new ethers.Contract(GATE, gate.abi, provider);

  // The deployer must hold a mock Agent ID to claim stamps / enter.
  if (!(await gateC.isHuman(deployer.address))) {
    const r = await send(deployer, provider, MOCK, mockC.interface.encodeFunctionData("issue", [deployer.address]));
    console.log("issue(deployer) on new mock:", r.hash, r.status);
    if (r.status !== "0x1") throw new Error("issue failed");
  }
  console.log("isHuman(deployer):", await gateC.isHuman(deployer.address));

  // Deploy the fast season. startAt backdated into day 6.
  const now = (await provider.getBlock("latest")).timestamp;
  const startAt = now - 7 * 86400 + 240; // stampEnd = now + 240s
  const dayPool = ethers.parseEther("0.0003");
  const finalePool = ethers.parseEther("0.001");
  const escrow = dayPool * 7n + finalePool;
  const q = artifact("QuestPass");
  const factory = new ethers.ContractFactory(q.abi, q.bytecode);
  const deployTx = await factory.getDeployTransaction(GATE, ethers.ZeroAddress, startAt, 3, dayPool, 1, 1, finalePool, 150);
  console.log(`deploying QuestPass (new source): runtime ${q.runtimeBytes} bytes, startAt=${startAt} (day 6), escrow=${ethers.formatEther(escrow)} tBNB`);
  const rd = await send(deployer, provider, null, deployTx.data, escrow, 3000000n);
  if (rd.status !== "0x1") throw new Error("QuestPass deploy reverted: " + rd.hash);
  const txObj = await provider.getTransaction(rd.hash);
  const qAddr = ethers.getCreateAddress({ from: deployer.address, nonce: txObj.nonce });
  const code = await provider.getCode(qAddr);
  console.log("  address:", qAddr, "runtime bytes:", (code.length - 2) / 2, "block:", rd.block, "gasUsed:", rd.gasUsed);
  if ((code.length - 2) / 2 !== q.runtimeBytes) throw new Error("QuestPass runtime size mismatch");
  const quest = new ethers.Contract(qAddr, q.abi, provider);
  const stampEnd = Number(await quest.stampEnd());
  const entryEnd = Number(await quest.entryEnd());
  console.log("stampEnd:", stampEnd, "entryEnd:", entryEnd, "phase:", Number(await quest.phase()), "currentDay:", Number(await quest.currentDay()));

  const trial = { quest: qAddr, deployTx: rd.hash, deployBlock: rd.block, deployGasUsed: rd.gasUsed, startAt, stampEnd, entryEnd };

  // 1) claimStamp on day 6
  let r = await send(deployer, provider, qAddr, quest.interface.encodeFunctionData("claimStamp", []));
  trial.claimStampTx = r.hash;
  if (r.status !== "0x1") throw new Error("claimStamp failed");
  trial.stampsAfterClaim = (await quest.stampCount(deployer.address)).toString();
  console.log("claimStamp:", r.hash, "-> stamps:", trial.stampsAfterClaim, "eligible:", await quest.eligible(deployer.address));
  if (trial.stampsAfterClaim !== "1" || !(await quest.eligible(deployer.address))) throw new Error("stamp/eligibility wrong");

  // 2) wait for stampEnd, enterFinale
  console.log("waiting for stampEnd", stampEnd);
  for (;;) { const t = (await provider.getBlock("latest")).timestamp; if (t >= stampEnd) break; await sleep(5000); }
  r = await send(deployer, provider, qAddr, quest.interface.encodeFunctionData("enterFinale", []));
  trial.enterFinaleTx = r.hash;
  if (r.status !== "0x1") throw new Error("enterFinale failed");
  console.log("enterFinale:", r.hash, "entries:", (await quest.finaleEntryCount()).toString());

  // 3) wait for entryEnd, lockFinaleSeed #1
  console.log("waiting for entryEnd", entryEnd);
  for (;;) { const t = (await provider.getBlock("latest")).timestamp; if (t >= entryEnd) break; await sleep(5000); }
  r = await send(deployer, provider, qAddr, quest.interface.encodeFunctionData("lockFinaleSeed", []));
  trial.lock1Tx = r.hash;
  if (r.status !== "0x1") throw new Error("lockFinaleSeed #1 failed");
  const seed1 = await quest.finaleSeedBlock();
  trial.seedBlock1 = seed1.toString();
  console.log("lockFinaleSeed #1:", r.hash, "-> seedBlock:", trial.seedBlock1);

  // 4) deliberately let the seed expire (> seedBlock + 256), then RE-lock
  const expiryBlock = Number(seed1) + 257;
  console.log("waiting for seed expiry: block >", expiryBlock);
  for (;;) { const b = await provider.getBlockNumber(); if (b > expiryBlock) break; await sleep(3000); }
  r = await send(deployer, provider, qAddr, quest.interface.encodeFunctionData("lockFinaleSeed", []));
  trial.lock2Tx = r.hash; trial.lock2Status = r.status;
  if (r.status !== "0x1") throw new Error("lockFinaleSeed #2 (RE-LOCK) FAILED — the new state machine is broken");
  const seed2 = await quest.finaleSeedBlock();
  trial.seedBlock2 = seed2.toString();
  console.log("lockFinaleSeed #2 (re-lock after expiry):", r.hash, "-> new seedBlock:", trial.seedBlock2);
  if (seed2 <= seed1) throw new Error("seed block did not advance on re-lock");

  // 5) wait for the fresh seed block, drawFinale
  for (;;) { const b = await provider.getBlockNumber(); if (BigInt(b) > seed2) break; await sleep(1500); }
  r = await send(deployer, provider, qAddr, quest.interface.encodeFunctionData("drawFinale", []), 0n, 1000000n);
  trial.drawFinaleTx = r.hash;
  if (r.status !== "0x1") throw new Error("drawFinale failed");
  trial.usedFallbackSeed = await quest.usedFallbackSeed();
  console.log("drawFinale:", r.hash, "usedFallbackSeed:", trial.usedFallbackSeed, "(expect false)");
  if (trial.usedFallbackSeed) throw new Error("draw used the fallback seed despite a fresh lock");
  const winners = await quest.getWinners();
  console.log("winners:", JSON.stringify(winners));
  if (winners.length !== 1 || winners[0].toLowerCase() !== deployer.address.toLowerCase()) throw new Error("sole entrant must be the winner");

  // 6) claimPrize — prize asserted to the wei (gas-adjusted)
  const balBefore = await provider.getBalance(deployer.address);
  r = await send(deployer, provider, qAddr, quest.interface.encodeFunctionData("claimPrize", []), 0n, 300000n);
  trial.claimPrizeTx = r.hash;
  if (r.status !== "0x1") throw new Error("claimPrize failed");
  const balAfter = await provider.getBalance(deployer.address);
  const netGain = balAfter - balBefore + BigInt(r.gasUsed) * GAS_PRICE;
  console.log("claimPrize:", r.hash, "net gain (gas-adjusted):", netGain.toString(), "expected:", finalePool.toString());
  if (netGain !== finalePool) throw new Error("finale prize amount mismatch");
  trial.prizeVerified = true;
  trial.result = "claimStamp(day 6) -> enterFinale -> lockFinaleSeed -> seed expired (>256 blocks) -> lockFinaleSeed re-lock OK -> drawFinale (usedFallbackSeed=false) -> claimPrize exact 0.001 tBNB";

  // Merge into v11-address.json (preserve everything already recorded).
  const recPath = path.join(__dirname, "..", "v11-address.json");
  const rec = JSON.parse(fs.readFileSync(recPath, "utf8"));
  rec.questNew = qAddr; rec.questNewTx = rd.hash; rec.questNewBlock = rd.block; rec.questNewDeployGasUsed = rd.gasUsed;
  rec.questTrial = trial;
  fs.writeFileSync(recPath, JSON.stringify(rec, null, 2));
  console.log("merged questNew into v11-address.json:", qAddr);
}
main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
