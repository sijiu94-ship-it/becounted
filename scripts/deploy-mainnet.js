// Deploy the BeCounted contracts to BSC MAINNET (chainId 56), in
// dependency order:
//   1. BeCounted         — constructor: the real Agent ID registry
//                          (0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F)
//   2. IdentityBindingsV3 — no constructor args (registrar = deployer;
//                          the role is transferable post-deploy)
//   3. OneIDCampaignsV11 — constructor: the BeCounted from step 1 AND
//                          the IdentityBindingsV3 from step 2 (two
//                          args: gate, bindings — same as V9–V10)
//   4. QuestPass         — constructor: gate, USDC token, season start,
//                          slots/day, day pool, min stamps, winners,
//                          finale pool, entry window. Its constructor
//                          escrows stampPool + finalePool (14 + 45 = 59
//                          USDC) via transferFrom FROM THE DEPLOYER, so
//                          the deployer must approve the PREDICTED
//                          QuestPass address before deploying (same
//                          pattern as test/flow8.test.js deployFunded:
//                          the approve tx consumes one nonce, the deploy
//                          lands at nonce + 1).
//   5. IdentityProfile   — no constructor args. OPTIONAL: only deployed
//                          when INCLUDE_PROFILE=1 (default: skipped).
//
// Raw-sign + multi-endpoint broadcast, same approach as deploy-v5.js /
// deploy-profile.js / deploy-quest.js. The pending nonce is re-fetched
// before EVERY transaction, sends are strictly sequential, each step
// waits for its receipt, and every deployment is verified on-chain
// (runtime size + live view calls) before moving on. Results are
// written to mainnet-address.json INCREMENTALLY — the record is saved
// after every successful step, so a mid-run failure never loses the
// addresses that already landed (appsBlock is the value the frontend
// needs for APPS_DEPLOY_BLOCK; questBlock likewise anchors quest
// scans). The post-deploy checks can be re-run on their own against an
// existing record, without deploying anything:
//   node scripts/deploy-mainnet.js --verify-only
//
// ============================ SAFETY LOCK ============================
// Default mode is DRY-RUN: this script only READS mainnet state
// (balances, pending nonce, gas price, token decimals, eth_estimateGas)
// and prints the full plan — order, constructor args, funding amounts,
// predicted addresses, estimated total BNB cost. It signs NOTHING and
// broadcasts NOTHING.
// A real deployment happens ONLY when the environment variable
// CONFIRM_MAINNET is exactly "YES":
//   CONFIRM_MAINNET=YES QUEST_START_AT=<unix seconds> \
//     node scripts/deploy-mainnet.js
// QUEST_START_AT is required in LIVE mode (season day 0 start, unix
// seconds; runbook suggests launch day 12:00 CST). In dry-run mode a
// placeholder (next 12:00 CST) is used when it is not set.
// =====================================================================
// ======================== TWO-BATCH MODES ===========================
// The launch can run in two batches when the 59 USDC escrow is not
// yet in the deployer at first-deploy time:
//   SKIP_QUEST=1 — batch 1: BeCounted, IdentityBindingsV3,
//     OneIDCampaignsV11 (+ IdentityProfile when INCLUDE_PROFILE=1).
//     No USDC is involved and none is required; the record written
//     contains NO quest keys. QUEST_START_AT is not required here.
//   QUEST_ONLY=1 — batch 2: USDC approve + QuestPass only, against
//     an existing batch-1 record (fail-closed when the record is
//     missing, not chainId 56, missing batch-1 keys, from another
//     deployer, or already carrying a QuestPass). QUEST_START_AT
//     comes from the environment, or from the record's questStartAt
//     when one was recorded. On success the quest keys are APPENDED
//     to the record; batch-1 keys are left untouched, and the full
//     post-deploy checks run against the merged record.
// With neither flag set, behavior is exactly the original one-shot
// deployment. DEPLOY_RECORD_PATH overrides the record location
// (default: ../mainnet-address.json) — for tests and recovery only.
// =====================================================================
// ====================== RESUME MODE (recovery) ======================
//   RESUME_BATCH1=1 — batch 1 was interrupted mid-run (a receipt or
//     code read hit a lagging/refusing endpoint and the run aborted
//     after some contracts had landed but before the record was
//     saved). The operator writes a seed record carrying the landed
//     PREFIX of batch 1 — the gate always, plus IdentityBindingsV3
//     and/or OneIDCampaignsV11 when they also landed (each with its
//     Tx/Block fields) — at the record path; this mode verifies
//     every recorded contract on-chain before planning (gate: code
//     size, registry, isHuman sample · bindings: code size,
//     registrar == deployer · apps: code size, gate/bindings/
//     idRegistry references), then deploys ONLY the contracts still
//     missing, in order, predicted from the live pending nonce,
//     filling the new keys in as each step lands. The record keeps
//     the batch-1 shape (NO quest keys), so QUEST_ONLY=1 remains
//     the way to add QuestPass afterwards. Mutually exclusive with
//     QUEST_ONLY=1; when set, it takes this path only.
//     QUEST_START_AT is not required.
// =====================================================================
// The deployer key is read from keys/deployer.key and never printed.
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const CHAIN_ID = 56;
const RECORD_PATH = path.join(__dirname, "..", "mainnet-address.json");
// Optional override (tests / recovery): point every record read and
// write at another file. The default path is unchanged.
const recordPath = process.env.DEPLOY_RECORD_PATH ? path.resolve(process.env.DEPLOY_RECORD_PATH) : RECORD_PATH;
const REGISTRY = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F"; // SPACE ID Agent ID registry (mainnet)
const USDC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"; // BSC mainnet USDC (18 decimals — verified by read at runtime)
const SAMPLE_HOLDER = "0x119B2Bf71856155b234f818476ae0610634A2aB9"; // 9nosing.ai — verified Agent ID holder

// QuestPass season parameters (fixed by the launch plan; see PLAN.md).
const QUEST = {
  slotsPerDay: 50,
  dayPoolUsdc: 2n,      // per-day stamp sub-pool
  stampDays: 7n,        // STAMP_DAYS in the contract
  minStamps: 5,
  winnerCount: 3,
  finalePoolUsdc: 45n,  // 3 winners x 15 USDC
  entryWindow: 86400,   // 24h finale entry window (seconds)
};

const READ_RPCS = [
  "https://bsc-rpc.publicnode.com",
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.bnbchain.org",
  "https://bsc-dataseed2.bnbchain.org",
];
const SEND_RPCS = [
  "https://bsc-rpc.publicnode.com",
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.bnbchain.org",
  "https://bsc-dataseed2.bnbchain.org",
  "https://bnbchain.api.onfinality.io/public",
];

const CONFIRM = process.env.CONFIRM_MAINNET === "YES";
const INCLUDE_PROFILE = process.env.INCLUDE_PROFILE === "1";
const SKIP_QUEST = process.env.SKIP_QUEST === "1";   // batch 1: project contracts only, no USDC
const QUEST_ONLY = process.env.QUEST_ONLY === "1";   // batch 2: approve + QuestPass onto a batch-1 record
const RESUME_BATCH1 = process.env.RESUME_BATCH1 === "1"; // recovery: finish an interrupted batch 1 (gate already on-chain)
const GAS_BUFFER_PCT = 30n; // gasLimit = estimate * 1.30
const BALANCE_SAFETY_X10 = 15n; // abort unless BNB balance >= 1.5x estimated total gas cost
// QuestPass deploy gas cannot be estimated before the escrow approve
// exists (the constructor's transferFrom reverts in simulation), so
// the plan uses this conservative figure; LIVE re-estimates after the
// approve has landed and falls back to this cap if that still fails.
const QUEST_GAS_FALLBACK = 3000000n;
// OneIDCampaignsV11 deploy gas cannot be estimated before BeCounted
// exists (its constructor reads gate.registry(), which reverts in
// simulation while the gate address still has no code), so the plan
// uses this figure: the BSC-testnet deployment of the identical
// bytecode used 4,203,733 gas (tx 0x1dfe30470b817e3d775a7f61dad6f
// bc528b753bc3bf10ccc014308cb2df5f97f, block 144405789), rounded up.
// LIVE re-estimates once the gate exists and prefers the fresh figure.
const APPS_GAS_FALLBACK = 4700000n;

function artifact(name) {
  const p = path.join(__dirname, "..", "artifacts", "contracts", name + ".sol", name + ".json");
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: j.abi, bytecode: j.bytecode, creationBytes: (j.bytecode.length - 2) / 2, runtimeBytes: (j.deployedBytecode.length - 2) / 2 };
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
    catch (e) { last = e; console.log("  send issue via", url, "-", e.message.slice(0, 100)); if (/already known/i.test(e.message)) return ethers.keccak256(raw); if (/nonce too low/i.test(e.message)) throw e; }
  }
  throw last ?? new Error("broadcast failed");
}
// Receipt polling, hardened: rotate across EVERY read endpoint
// (dataseed included) instead of trusting a single one. A
// per-endpoint error is NOT fatal — publicnode once answered a
// fresh receipt request with -32602 "Archive requests require a
// personal token", and treating that refusal as fatal aborted a
// batch-1 run after the bindings deploy had already landed but
// before its record was saved. Only give up when no endpoint
// produces the receipt inside the whole ~60s window; a receipt
// with status 0 is returned as-is and the caller (sendTx) rejects
// it as a reverted transaction.
async function waitReceipt(hash) {
  const deadline = Date.now() + 60000;
  let lastErr = null;
  for (;;) {
    for (const url of READ_RPCS) {
      try {
        const rc = await rpc(url, "eth_getTransactionReceipt", [hash]);
        if (rc) return rc;
      } catch (e) { lastErr = e; /* endpoint refusal/hiccup — try the next endpoint */ }
    }
    if (Date.now() >= deadline) break;
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error("receipt timeout " + hash + (lastErr ? " (last endpoint error: " + lastErr.message.slice(0, 140) + ")" : ""));
}

// Replica-lag patience for reads of just-written state. A receipt can
// be visible on an endpoint whose state has not caught up yet: a
// one-shot eth_getCode once read 0 bytes for a contract that HAD
// deployed, and the run aborted before the record was saved. Poll
// every read endpoint (~3s rounds, up to ~45s) until the full runtime
// shows up; the caller decides whether the final value is acceptable.
async function waitForCode(address, expectedBytes) {
  const deadline = Date.now() + 45000;
  let seen = -1;
  for (let round = 1; ; round++) {
    for (const url of READ_RPCS) {
      try {
        const code = await rpc(url, "eth_getCode", [address, "latest"]);
        const bytes = (code.length - 2) / 2;
        if (bytes === expectedBytes) {
          if (round > 1) console.log(`  code at ${address} fully visible: ${bytes} bytes (after ${round} polling rounds)`);
          return bytes;
        }
        if (bytes > seen) seen = bytes;
      } catch { /* endpoint hiccup — try the next one */ }
    }
    if (Date.now() >= deadline) return seen;
    console.log(`  code at ${address} not fully visible yet (saw ${seen < 0 ? 0 : seen} of ${expectedBytes} bytes) — replica lag, polling again in 3s…`);
    await new Promise(r => setTimeout(r, 3000));
  }
}

// Same patience for the post-approve allowance read: the approve tx
// has a receipt, but a lagging replica can still report 0 allowance
// and abort the QuestPass deploy. Returns the last value seen; the
// caller asserts equality with the expected escrow.
async function waitForAllowance(usdcContract, owner, spender, expected) {
  const deadline = Date.now() + 45000;
  let last = 0n;
  for (;;) {
    try { last = await usdcContract.allowance(owner, spender); } catch { /* keep last, retry until the deadline */ }
    if (last === expected) return last;
    if (Date.now() >= deadline) return last;
    console.log(`  allowance not yet visible (saw ${last.toString()}, expect ${expected.toString()}) — replica lag, polling again in 3s…`);
    await new Promise(r => setTimeout(r, 3000));
  }
}

// Sign, broadcast and confirm one transaction. The pending nonce is
// re-fetched immediately before signing; one retry on "nonce too low".
async function sendTx(wallet, provider, gasPrice, { to, data, gasLimit }) {
  for (let attemptNo = 1; attemptNo <= 2; attemptNo++) {
    const nonce = await provider.getTransactionCount(wallet.address, "pending");
    const tx = { to: to ?? null, data, nonce, gasLimit, gasPrice, chainId: CHAIN_ID, type: 0 };
    const raw = await wallet.signTransaction(tx);
    try {
      const hash = await broadcast(raw);
      console.log("  tx:", hash, "(nonce " + nonce + ")");
      const rc = await waitReceipt(hash);
      if (rc.status !== "0x1") throw new Error("transaction reverted: " + hash);
      return { hash, rc, nonce };
    } catch (e) {
      if (attemptNo === 1 && /nonce too low/i.test(e.message)) { console.log("  nonce too low — refetching pending nonce and retrying once"); continue; }
      throw e;
    }
  }
  throw new Error("send failed after retry");
}

async function estimateOrNull(provider, tx) {
  try { return await provider.estimateGas(tx); } catch { return null; }
}

// Next 12:00 CST (UTC+8) strictly in the future — dry-run placeholder
// for QUEST_START_AT and the runbook's suggested season start.
function nextNoonCST() {
  const now = Date.now();
  const cst = new Date(now + 8 * 3600 * 1000);
  cst.setUTCHours(12, 0, 0, 0);
  let t = cst.getTime() - 8 * 3600 * 1000;
  if (t <= now) t += 24 * 3600 * 1000;
  return Math.floor(t / 1000);
}

// Build the deployment plan. Read-only: fresh pending nonce,
// predicted CREATE addresses for the exact transaction sequence
//   full:       N+0 BeCounted · N+1 IdentityBindingsV3 ·
//               N+2 OneIDCampaignsV11 · N+3 USDC approve ·
//               N+4 QuestPass · N+5 IdentityProfile (optional)
//   SKIP_QUEST: the project contracts only (IdentityProfile takes
//               N+3 when included); no approve, no QuestPass
//   QUEST_ONLY: N+0 USDC approve · N+1 QuestPass, against the gate
//               address recorded by batch 1 (ctx.gateAddress)
// plus per-step deploy data and gas estimates.
async function buildPlan(wallet, provider, ctx) {
  const startNonce = await provider.getTransactionCount(wallet.address, "pending");
  const usdc = new ethers.Contract(USDC, ["function approve(address,uint256) returns (bool)"], provider);
  const steps = [];
  const addrAt = (offset) => ethers.getCreateAddress({ from: wallet.address, nonce: startNonce + offset });

  // The two QuestPass steps (escrow approve → deploy), shared by the
  // full plan and the QUEST_ONLY batch-2 plan. The approve targets
  // the address the deploy WILL land at: the approve consumes one
  // nonce, so the deploy lands at the next one.
  const addQuestSteps = async (gateAddr, approveOffset, questOffset) => {
    const questAddr = addrAt(questOffset);
    const approveData = usdc.interface.encodeFunctionData("approve", [questAddr, ctx.escrowRaw]);
    const approveEst = await estimateOrNull(provider, { from: wallet.address, to: USDC, data: approveData });
    steps.push({ kind: "approve", name: "USDC approve → QuestPass (escrow)", offset: approveOffset, address: questAddr, data: approveData, estGas: approveEst, argsNote: `approve(${questAddr}, ${ethers.formatUnits(ctx.escrowRaw, ctx.usdcDecimals)} USDC)` });

    const qArt = artifact("QuestPass");
    const qFactory = new ethers.ContractFactory(qArt.abi, qArt.bytecode);
    const qArgs = [gateAddr, USDC, ctx.startAt, QUEST.slotsPerDay, ctx.dayPoolRaw, QUEST.minStamps, QUEST.winnerCount, ctx.finalePoolRaw, QUEST.entryWindow];
    const qDeployTx = await qFactory.getDeployTransaction(...qArgs);
    // Expected to fail pre-approve (constructor transferFrom) — fallback.
    const qEst = await estimateOrNull(provider, { from: wallet.address, data: qDeployTx.data });
    steps.push({
      kind: "deploy", name: "QuestPass", offset: questOffset, args: qArgs, ...qArt, data: qDeployTx.data, address: questAddr,
      estGas: qEst ?? QUEST_GAS_FALLBACK, estGasIsFallback: qEst === null,
      argsNote: `gate = ${gateAddr} · token = USDC ${USDC} · startAt = ${ctx.startAt} (${new Date(ctx.startAt * 1000).toISOString()}) · slotsPerDay = ${QUEST.slotsPerDay} · dayPool = 2 USDC · minStamps = ${QUEST.minStamps} · winnerCount = ${QUEST.winnerCount} · finalePool = 45 USDC · entryWindow = ${QUEST.entryWindow}s · constructor escrows ${ethers.formatUnits(ctx.escrowRaw, ctx.usdcDecimals)} USDC via transferFrom`,
    });
  };

  if (ctx.questOnly) {
    // Batch 2: the project contracts already exist (batch 1); the
    // only transactions are the escrow approve and the QuestPass
    // deploy, built against the recorded gate address.
    await addQuestSteps(ctx.gateAddress, 0, 1);
    return { steps, startNonce };
  }

  if (ctx.resumeBatch1) {
    // Recovery: a PREFIX of batch 1 already deployed in the
    // interrupted run — the gate always, plus IdentityBindingsV3
    // and OneIDCampaignsV11 when the seed records them (each was
    // verified on-chain before planning). Plan only the contracts
    // still missing, in order, predicted from the live pending
    // nonce; the apps constructor uses the recorded gate and the
    // bindings address that will actually exist — the recorded one,
    // or the one this very plan is about to deploy.
    const defs = [];
    let offset = 0;
    let bindingsAddr = ctx.recordedBindings;
    if (!bindingsAddr) {
      bindingsAddr = addrAt(offset);
      defs.push({ kind: "deploy", name: "IdentityBindingsV3", offset, args: [], argsNote: "(no constructor args)" });
      offset++;
    }
    if (!ctx.recordedApps) {
      defs.push({
        kind: "deploy", name: "OneIDCampaignsV11", offset, args: [ctx.gateAddress, bindingsAddr], gasFallback: APPS_GAS_FALLBACK,
        argsNote: "gate = <BeCounted recorded by the interrupted run> " + ctx.gateAddress + " · bindings = " + (ctx.recordedBindings ? "<IdentityBindingsV3 recorded by the interrupted run> " : "<IdentityBindingsV3 at nonce+" + (offset - 1) + "> ") + bindingsAddr,
      });
      offset++;
    }
    for (const def of defs) {
      const art = artifact(def.name);
      const factory = new ethers.ContractFactory(art.abi, art.bytecode);
      const deployTx = await factory.getDeployTransaction(...def.args);
      let estGas = await estimateOrNull(provider, { from: wallet.address, data: deployTx.data });
      let estGasIsFallback = false;
      if (estGas === null && def.gasFallback) { estGas = def.gasFallback; estGasIsFallback = true; }
      steps.push({ ...def, ...art, data: deployTx.data, address: addrAt(def.offset), estGas, estGasIsFallback });
    }
    if (INCLUDE_PROFILE) {
      const pArt = artifact("IdentityProfile");
      const pFactory = new ethers.ContractFactory(pArt.abi, pArt.bytecode);
      const pDeployTx = await pFactory.getDeployTransaction();
      const pEst = await estimateOrNull(provider, { from: wallet.address, data: pDeployTx.data });
      steps.push({ kind: "deploy", name: "IdentityProfile", offset, args: [], argsNote: "(no constructor args)", ...pArt, data: pDeployTx.data, address: addrAt(offset), estGas: pEst });
    }
    return { steps, startNonce };
  }

  const gateAddr = addrAt(0);
  const bindingsAddr = addrAt(1);
  const defs = [
    { kind: "deploy", name: "BeCounted", offset: 0, args: [REGISTRY], argsNote: "registry = " + REGISTRY },
    { kind: "deploy", name: "IdentityBindingsV3", offset: 1, args: [], argsNote: "(no constructor args)" },
    { kind: "deploy", name: "OneIDCampaignsV11", offset: 2, args: [gateAddr, bindingsAddr], argsNote: "gate = <BeCounted at nonce+0> " + gateAddr + " · bindings = <IdentityBindingsV3 at nonce+1> " + bindingsAddr, gasFallback: APPS_GAS_FALLBACK },
  ];
  for (const def of defs) {
    const art = artifact(def.name);
    const factory = new ethers.ContractFactory(art.abi, art.bytecode);
    const deployTx = await factory.getDeployTransaction(...def.args);
    let estGas = await estimateOrNull(provider, { from: wallet.address, data: deployTx.data });
    let estGasIsFallback = false;
    if (estGas === null && def.gasFallback) { estGas = def.gasFallback; estGasIsFallback = true; }
    steps.push({ ...def, ...art, data: deployTx.data, address: addrAt(def.offset), estGas, estGasIsFallback });
  }

  if (!ctx.skipQuest) {
    // QuestPass: the approve targets the address the deploy WILL land
    // at (approve consumes nonce+3, deploy lands at nonce+4).
    await addQuestSteps(gateAddr, 3, 4);
  }

  if (INCLUDE_PROFILE) {
    // In the full plan the profile deploys last (nonce+5); in the
    // SKIP_QUEST batch-1 plan it takes the slot right after the apps
    // contract (nonce+3).
    const profileOffset = ctx.skipQuest ? 3 : 5;
    const pArt = artifact("IdentityProfile");
    const pFactory = new ethers.ContractFactory(pArt.abi, pArt.bytecode);
    const pDeployTx = await pFactory.getDeployTransaction();
    const pEst = await estimateOrNull(provider, { from: wallet.address, data: pDeployTx.data });
    steps.push({ kind: "deploy", name: "IdentityProfile", offset: profileOffset, args: [], argsNote: "(no constructor args)", ...pArt, data: pDeployTx.data, address: addrAt(profileOffset), estGas: pEst });
  }
  return { steps, startNonce };
}

function printPlan(wallet, bnbBalance, usdcBalance, gasPrice, plan, ctx) {
  console.log("deployer:", wallet.address);
  console.log("BNB balance:", ethers.formatEther(bnbBalance), "BNB (mainnet)");
  if (ctx.skipQuest) {
    console.log("USDC balance:", ethers.formatUnits(usdcBalance, ctx.usdcDecimals), "USDC · QuestPass DEFERRED (SKIP_QUEST=1) — USDC is NOT required for this run; the", ethers.formatUnits(ctx.escrowRaw, ctx.usdcDecimals), "USDC escrow is needed only later, for the QUEST_ONLY=1 batch-2 run");
  } else {
    console.log("USDC balance:", ethers.formatUnits(usdcBalance, ctx.usdcDecimals), "USDC · required escrow:", ethers.formatUnits(ctx.escrowRaw, ctx.usdcDecimals), "USDC —", usdcBalance >= ctx.escrowRaw ? "OK" : "INSUFFICIENT, top up before launch");
  }
  console.log("gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");
  console.log("season start (QUEST_START_AT):", ctx.startAt, "=", new Date(ctx.startAt * 1000).toISOString(), ctx.startAtIsPlaceholder ? "(PLACEHOLDER — next 12:00 CST; set QUEST_START_AT for the real run)" : "");
  console.log("IdentityProfile:", ctx.questOnly ? "batch 1 (already deployed — not part of this run)" : INCLUDE_PROFILE ? "INCLUDED (INCLUDE_PROFILE=1)" : "skipped (set INCLUDE_PROFILE=1 to include)");
  if (ctx.skipQuest) console.log("BATCH 1 of 2 (SKIP_QUEST=1): project contracts only — QuestPass is deferred to a later QUEST_ONLY=1 run, once the USDC escrow reaches the deployer.");
  if (ctx.questOnly) console.log("BATCH 2 of 2 (QUEST_ONLY=1): USDC approve + QuestPass only, against the batch-1 gate", ctx.gateAddress, "recorded in the deployment record.");
  if (ctx.resumeBatch1) console.log("RESUME (RESUME_BATCH1=1): the BeCounted gate already deployed at", ctx.gateAddress, "in the interrupted batch-1 run — this run plans only IdentityBindingsV3, OneIDCampaignsV11 and IdentityProfile (when included). No QuestPass, no USDC.");
  console.log("");
  let totalGas = 0n, totalCost = 0n, anyMissing = false;
  plan.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name}  [nonce +${p.offset}]`);
    console.log(`   ${p.kind === "approve" ? "spender (predicted QuestPass)" : "predicted address"}: ${p.address}`);
    console.log(`   ${p.argsNote}`);
    if (p.creationBytes) console.log(`   creation bytecode: ${p.creationBytes} bytes · expected runtime: ${p.runtimeBytes} bytes`);
    if (p.estGas !== null && p.estGas !== undefined) {
      const cost = p.estGas * gasPrice;
      totalGas += p.estGas; totalCost += cost;
      console.log(`   estimated gas: ${p.estGas.toString()}${p.estGasIsFallback ? " (fallback figure — the deploy cannot be simulated before its on-chain dependencies exist)" : ""} · estimated cost: ${ethers.formatEther(cost)} BNB`);
    } else { anyMissing = true; console.log("   estimated gas: (unavailable)"); }
  });
  console.log("");
  if (!anyMissing) {
    const buffered = totalGas * (100n + GAS_BUFFER_PCT) / 100n;
    console.log(`TOTAL estimated gas: ${totalGas.toString()} · estimated cost: ${ethers.formatEther(totalCost)} BNB`);
    console.log(`TOTAL with ${GAS_BUFFER_PCT}% buffer: ${buffered.toString()} gas · ${ethers.formatEther(buffered * gasPrice)} BNB`);
    console.log(`BNB balance check: need >= ${ethers.formatEther(totalCost * BALANCE_SAFETY_X10 / 10n)} BNB (1.5x estimate) — ${bnbBalance >= totalCost * BALANCE_SAFETY_X10 / 10n ? "OK" : "INSUFFICIENT, top up before launch"}`);
  }
  console.log("(predicted addresses assume the deployer sends no other transaction before launch)");
  return totalCost;
}

async function deployStep(wallet, provider, gasPrice, step) {
  let estGas = step.estGas;
  // By the time a step runs, its on-chain dependencies exist (the gate
  // before OneIDCampaignsV11, the escrow approve before QuestPass), so a
  // fresh estimate should succeed — prefer it over any plan-time figure,
  // including the fallback constants.
  const fresh = await estimateOrNull(provider, { from: wallet.address, data: step.data });
  if (fresh !== null) estGas = fresh;
  if (estGas === null || estGas === undefined) estGas = await provider.estimateGas({ from: wallet.address, data: step.data });
  const gasLimit = estGas * (100n + GAS_BUFFER_PCT) / 100n;
  console.log(`  ${step.name}: gasLimit ${gasLimit.toString()}`);
  const { hash, rc } = await sendTx(wallet, provider, gasPrice, { to: null, data: step.data, gasLimit });
  const addr = rc.contractAddress;
  // Do NOT one-shot this read: the receipt can come from an endpoint
  // whose state lags behind, and eth_getCode then returns 0 bytes for
  // a contract that DID deploy (this exact failure once aborted a
  // batch-1 run after the gate landed but before its record was
  // saved). Poll every read endpoint until the full runtime is
  // visible; only a mismatch that survives the patience window is
  // real.
  const seenBytes = await waitForCode(addr, step.runtimeBytes);
  console.log("  address:", addr, "runtime bytes:", seenBytes, "block:", parseInt(rc.blockNumber, 16));
  if (seenBytes !== step.runtimeBytes) throw new Error(step.name + " runtime size mismatch");
  if (addr.toLowerCase() !== step.address.toLowerCase()) throw new Error(step.name + " landed at " + addr + " but the plan predicted " + step.address + " — nonce drift, aborting");
  return { address: addr, tx: hash, block: parseInt(rc.blockNumber, 16) };
}

async function verifyAll(provider, out, ctx) {
  console.log("post-deploy checks:");
  const gate = new ethers.Contract(out.humanGate, artifact("BeCounted").abi, provider);
  console.log("  BeCounted.registry():", await gate.registry());
  if ((await gate.registry()).toLowerCase() !== REGISTRY.toLowerCase()) throw new Error("registry mismatch");
  const sample = await gate.isHuman(SAMPLE_HOLDER);
  const self = await gate.isHuman(out.deployer);
  console.log(`  BeCounted.isHuman(9nosing.ai ${SAMPLE_HOLDER}):`, sample, "(expect true)");
  console.log("  BeCounted.isHuman(deployer):", self, "(expect false)");
  if (sample !== true || self !== false) throw new Error("isHuman sanity check failed");
  const apps = new ethers.Contract(out.appsV11, artifact("OneIDCampaignsV11").abi, provider);
  const appsGate = await apps.gate();
  const appsBindings = await apps.bindings();
  const appsRegistry = await apps.idRegistry();
  console.log("  OneIDCampaignsV11.gate():", appsGate);
  console.log("  OneIDCampaignsV11.bindings():", appsBindings);
  console.log("  OneIDCampaignsV11.idRegistry():", appsRegistry);
  if (appsGate.toLowerCase() !== out.humanGate.toLowerCase()) throw new Error("apps gate mismatch");
  if (appsBindings.toLowerCase() !== out.bindings.toLowerCase()) throw new Error("apps bindings mismatch");
  if (appsRegistry.toLowerCase() !== REGISTRY.toLowerCase()) throw new Error("apps idRegistry mismatch");
  console.log("  OneIDCampaignsV11.campaignCount():", (await apps.campaignCount()).toString(), "(expect 0)");
  const bind = new ethers.Contract(out.bindings, artifact("IdentityBindingsV3").abi, provider);
  const registrar = await bind.registrar();
  console.log("  IdentityBindingsV3.registrar():", registrar, "(expect the deployer " + out.deployer + ")");
  if (registrar.toLowerCase() !== out.deployer.toLowerCase()) throw new Error("registrar mismatch — IdentityBindingsV3 registrar is not the deployer");
  const b = await bind.bindingOf(out.deployer);
  console.log("  IdentityBindingsV3.bindingOf(deployer): handle =", JSON.stringify(b[0]), "(expect empty)");
  if (!out.quest) {
    // Batch-1 record (SKIP_QUEST): QuestPass is not deployed yet, so
    // there is nothing to assert about it. Once QUEST_ONLY appends
    // the quest keys, the full checks below run against the merged
    // record.
    console.log("  QuestPass: not deployed yet (deferred to the QUEST_ONLY batch) — skipping quest checks");
  } else {
  const quest = new ethers.Contract(out.quest, artifact("QuestPass").abi, provider);
  const usdc = new ethers.Contract(USDC, ["function balanceOf(address) view returns (uint256)"], provider);
  const qGate = await quest.gate(); const qToken = await quest.token();
  const qStampPool = await quest.stampPool(); const qFinale = await quest.finalePool();
  const qPerWinner = await quest.prizePerWinner(); const qStart = await quest.startAt();
  const qCreator = await quest.creator(); const qBal = await usdc.balanceOf(out.quest);
  console.log("  QuestPass.gate():", qGate, "· token():", qToken);
  console.log(`  QuestPass pools: stampPool ${ethers.formatUnits(qStampPool, ctx.usdcDecimals)} · finalePool ${ethers.formatUnits(qFinale, ctx.usdcDecimals)} · prizePerWinner ${ethers.formatUnits(qPerWinner, ctx.usdcDecimals)} USDC · startAt ${qStart.toString()} · creator ${qCreator}`);
  console.log(`  QuestPass USDC balance: ${ethers.formatUnits(qBal, ctx.usdcDecimals)} USDC (expect ${ethers.formatUnits(ctx.escrowRaw, ctx.usdcDecimals)})`);
  if (qGate.toLowerCase() !== out.humanGate.toLowerCase() || qToken.toLowerCase() !== USDC.toLowerCase()) throw new Error("quest gate/token mismatch");
  if (qStampPool !== ctx.dayPoolRaw * QUEST.stampDays || qFinale !== ctx.finalePoolRaw || qBal !== ctx.escrowRaw) throw new Error("quest escrow mismatch");
  // Winner structure is asserted, not just printed: a constructor-arg
  // typo here would mis-split the finale pool while the totals still
  // added up, so verifyAll refuses a wrong shape outright.
  const qWinnerCount = await quest.winnerCount();
  const expectedPerWinner = ctx.finalePoolRaw / BigInt(QUEST.winnerCount);
  console.log(`  QuestPass winnerCount: ${qWinnerCount.toString()} (expect ${QUEST.winnerCount}) · prizePerWinner expected: ${ethers.formatUnits(expectedPerWinner, ctx.usdcDecimals)} USDC`);
  if (Number(qWinnerCount) !== QUEST.winnerCount || qPerWinner !== expectedPerWinner) throw new Error("quest winnerCount/prizePerWinner mismatch");
  if (Number(qStart) !== ctx.startAt || qCreator.toLowerCase() !== out.deployer.toLowerCase()) throw new Error("quest startAt/creator mismatch");
  }
  if (out.profile) {
    const prof = new ethers.Contract(out.profile, artifact("IdentityProfile").abi, provider);
    const pr = await prof.profileOf(out.deployer);
    console.log("  IdentityProfile.profileOf(deployer): bio =", JSON.stringify(pr[0]), "links =", pr[1].length, "(expect empty / 0)");
  }
}

// RESUME_BATCH1 proofs: the seed record claims a prefix of batch 1
// already landed in the interrupted run. Believe nothing — check
// every recorded contract on-chain before planning anything against
// it. Gate proof: the code size, the registry it points at, and the
// isHuman sample.
async function verifyRecordedGate(provider, gateAddress) {
  const art = artifact("BeCounted");
  const code = await provider.getCode(gateAddress);
  const bytes = (code.length - 2) / 2;
  console.log("  recorded gate:", gateAddress, "· runtime bytes:", bytes, "(expect " + art.runtimeBytes + ")");
  if (bytes !== art.runtimeBytes) throw new Error("recorded gate code size mismatch — the seed record does not point at the deployed BeCounted; refusing to resume");
  const gate = new ethers.Contract(gateAddress, art.abi, provider);
  const reg = await gate.registry();
  console.log("  recorded gate registry():", reg);
  if (reg.toLowerCase() !== REGISTRY.toLowerCase()) throw new Error("recorded gate registry mismatch — refusing to resume");
  const sample = await gate.isHuman(SAMPLE_HOLDER);
  console.log(`  recorded gate isHuman(9nosing.ai ${SAMPLE_HOLDER}):`, sample, "(expect true)");
  if (sample !== true) throw new Error("recorded gate fails the isHuman sanity check — refusing to resume");
}

// Bindings proof: exact runtime size, and the registrar must be the
// deployer (set at construction; the apps flow and verifyAll rely
// on it).
async function verifyRecordedBindings(provider, bindingsAddress, deployer) {
  const art = artifact("IdentityBindingsV3");
  const code = await provider.getCode(bindingsAddress);
  const bytes = (code.length - 2) / 2;
  console.log("  recorded bindings:", bindingsAddress, "· runtime bytes:", bytes, "(expect " + art.runtimeBytes + ")");
  if (bytes !== art.runtimeBytes) throw new Error("recorded bindings code size mismatch — the seed record does not point at the deployed IdentityBindingsV3; refusing to resume");
  const bind = new ethers.Contract(bindingsAddress, art.abi, provider);
  const registrar = await bind.registrar();
  console.log("  recorded bindings registrar():", registrar, "(expect the deployer " + deployer + ")");
  if (registrar.toLowerCase() !== deployer.toLowerCase()) throw new Error("recorded bindings registrar mismatch — refusing to resume");
}

// Apps proof: exact runtime size, and the contract must reference
// the recorded gate, the recorded bindings and the real Agent ID
// registry (the same reads verifyAll asserts post-deploy).
async function verifyRecordedApps(provider, appsAddress, gateAddress, bindingsAddress) {
  const art = artifact("OneIDCampaignsV11");
  const code = await provider.getCode(appsAddress);
  const bytes = (code.length - 2) / 2;
  console.log("  recorded apps:", appsAddress, "· runtime bytes:", bytes, "(expect " + art.runtimeBytes + ")");
  if (bytes !== art.runtimeBytes) throw new Error("recorded apps code size mismatch — the seed record does not point at the deployed OneIDCampaignsV11; refusing to resume");
  const apps = new ethers.Contract(appsAddress, art.abi, provider);
  const aGate = await apps.gate();
  const aBindings = await apps.bindings();
  const aRegistry = await apps.idRegistry();
  console.log("  recorded apps gate():", aGate, "· bindings():", aBindings, "· idRegistry():", aRegistry);
  if (aGate.toLowerCase() !== gateAddress.toLowerCase()) throw new Error("recorded apps gate mismatch — refusing to resume");
  if (aBindings.toLowerCase() !== bindingsAddress.toLowerCase()) throw new Error("recorded apps bindings mismatch — refusing to resume");
  if (aRegistry.toLowerCase() !== REGISTRY.toLowerCase()) throw new Error("recorded apps idRegistry mismatch — refusing to resume");
}

async function main() {
  // --verify-only: re-run the post-deploy checks against an existing
  // mainnet-address.json. Read-only, needs no deployer key, deploys
  // nothing — use it to re-check a completed (or partially recorded)
  // launch without touching the deploy flow.
  if (process.argv.includes("--verify-only")) {
    if (!fs.existsSync(recordPath)) throw new Error("deployment record not found at " + recordPath + " — nothing to verify");
    const rec = JSON.parse(fs.readFileSync(recordPath, "utf8"));
    if (rec.chainId !== CHAIN_ID) throw new Error("record chainId is " + rec.chainId + ", expected 56");
    const provider = new ethers.FallbackProvider(
      READ_RPCS.map(u => new ethers.JsonRpcProvider(u, CHAIN_ID, { staticNetwork: true })),
      CHAIN_ID, { quorum: 1 }
    );
    const usdcRead = new ethers.Contract(USDC, ["function decimals() view returns (uint8)"], provider);
    const usdcDecimals = Number(await usdcRead.decimals());
    const unit = 10n ** BigInt(usdcDecimals);
    const ctx = {
      startAt: rec.questStartAt, usdcDecimals,
      dayPoolRaw: QUEST.dayPoolUsdc * unit,
      finalePoolRaw: QUEST.finalePoolUsdc * unit,
    };
    ctx.escrowRaw = ctx.dayPoolRaw * QUEST.stampDays + ctx.finalePoolRaw;
    console.log("=== BeCounted mainnet launch — VERIFY-ONLY (read-only, no deployment) ===");
    console.log("record:", recordPath);
    await verifyAll(provider, rec, ctx);
    console.log("VERIFY-ONLY: all post-deploy checks passed against the existing record.");
    return;
  }

  // ---- Batch-mode gates ----------------------------------------------
  // QUEST_ONLY builds on a batch-1 record, so validate that record
  // before anything else happens — fail closed, with the reason.
  if (SKIP_QUEST && QUEST_ONLY) throw new Error("SKIP_QUEST=1 and QUEST_ONLY=1 are mutually exclusive — pick one batch mode");
  let existingRec = null;
  if (QUEST_ONLY) {
    if (!fs.existsSync(recordPath)) throw new Error("QUEST_ONLY=1 needs an existing batch-1 record at " + recordPath + " — none found. Run batch 1 first (SKIP_QUEST=1).");
    existingRec = JSON.parse(fs.readFileSync(recordPath, "utf8"));
    if (existingRec.chainId !== CHAIN_ID) throw new Error("record chainId is " + existingRec.chainId + ", expected 56 — refusing QUEST_ONLY against a non-mainnet record");
    for (const k of ["humanGate", "appsV11", "bindings", "profile"]) {
      if (!existingRec[k]) throw new Error("batch-1 record is missing " + k + " — QUEST_ONLY=1 requires a complete batch 1 (humanGate / appsV11 / bindings / profile). Refusing.");
    }
    if (existingRec.quest) throw new Error("record already contains a QuestPass at " + existingRec.quest + " — refusing to deploy a second one");
  }
  // RESUME_BATCH1 builds on a seed record written by hand after an
  // interrupted batch-1 run: it must carry the gate that already
  // landed, plus optionally the bindings and apps contracts when
  // they landed too — the recorded contracts must form a PREFIX of
  // [gate, bindings, apps], each with its Tx/Block fields. A
  // recorded profile means batch 1 is complete (nothing to resume),
  // and a quest key means this is not an interrupted batch 1 at
  // all. Fail closed, with the reason. (The deployer match is
  // checked once the key is loaded, and every recorded contract is
  // verified on-chain before planning.)
  let seedRec = null;
  if (RESUME_BATCH1) {
    if (QUEST_ONLY) throw new Error("RESUME_BATCH1=1 and QUEST_ONLY=1 are mutually exclusive — resume finishes batch 1; QUEST_ONLY starts batch 2");
    if (!fs.existsSync(recordPath)) throw new Error("RESUME_BATCH1=1 needs a seed record at " + recordPath + " carrying the already-deployed prefix of batch 1 (chainId / deployer / humanGate / humanGateTx / humanGateBlock, plus bindings/appsV11 with their Tx/Block fields when they landed) — none found. Nothing to resume from.");
    seedRec = JSON.parse(fs.readFileSync(recordPath, "utf8"));
    if (seedRec.chainId !== CHAIN_ID) throw new Error("seed record chainId is " + seedRec.chainId + ", expected 56 — refusing to resume against a non-mainnet record");
    for (const k of ["deployer", "humanGate", "humanGateTx"]) {
      if (!seedRec[k]) throw new Error("seed record is missing " + k + " — RESUME_BATCH1=1 requires chainId / deployer / humanGate / humanGateTx / humanGateBlock from the interrupted batch-1 run. Refusing.");
    }
    if (seedRec.humanGateBlock === undefined || seedRec.humanGateBlock === null) throw new Error("seed record is missing humanGateBlock — RESUME_BATCH1=1 requires chainId / deployer / humanGate / humanGateTx / humanGateBlock from the interrupted batch-1 run. Refusing.");
    if (seedRec.bindings) {
      if (!seedRec.bindingsTx) throw new Error("seed record carries bindings but is missing bindingsTx — refusing to resume");
      if (seedRec.bindingsBlock === undefined || seedRec.bindingsBlock === null) throw new Error("seed record carries bindings but is missing bindingsBlock — refusing to resume");
    }
    if (seedRec.appsV11) {
      if (!seedRec.bindings) throw new Error("seed record carries appsV11 without bindings — the recorded contracts must be a prefix of [gate, bindings, apps]; refusing to resume");
      if (!seedRec.appsTx) throw new Error("seed record carries appsV11 but is missing appsTx — refusing to resume");
      if (seedRec.appsBlock === undefined || seedRec.appsBlock === null) throw new Error("seed record carries appsV11 but is missing appsBlock — refusing to resume");
    }
    if (seedRec.profile) throw new Error("seed record already carries profile — batch 1 looks complete; nothing to resume");
    if (seedRec.quest) throw new Error("seed record contains a QuestPass — that is not an interrupted batch 1; refusing to resume (use QUEST_ONLY=1 only against a batch-1 record without quest keys)");
  }

  const key = fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim();
  const wallet = new ethers.Wallet(key);
  const provider = new ethers.FallbackProvider(
    READ_RPCS.map(u => new ethers.JsonRpcProvider(u, CHAIN_ID, { staticNetwork: true })),
    CHAIN_ID, { quorum: 1 }
  );

  console.log("=== BeCounted mainnet launch — BSC chainId 56 ===");
  console.log(CONFIRM ? "MODE: LIVE DEPLOYMENT (CONFIRM_MAINNET=YES)" : "MODE: DRY-RUN (read-only — nothing will be signed or broadcast)");
  if (process.env.CONFIRM_MAINNET && !CONFIRM) console.log(`note: CONFIRM_MAINNET="${process.env.CONFIRM_MAINNET}" is not exactly "YES" — staying in dry-run.`);
  if (SKIP_QUEST) console.log("BATCH MODE: SKIP_QUEST=1 — batch 1 of 2 (project contracts only; QuestPass deferred, no USDC needed)");
  if (QUEST_ONLY) console.log("BATCH MODE: QUEST_ONLY=1 — batch 2 of 2 (USDC approve + QuestPass only, appended to the batch-1 record)");
  if (RESUME_BATCH1) console.log("BATCH MODE: RESUME_BATCH1=1 — batch 1 was interrupted after the BeCounted gate landed; deploying only the remaining batch-1 contracts against the recorded gate", seedRec.humanGate);
  if (RESUME_BATCH1 && SKIP_QUEST) console.log("note: SKIP_QUEST=1 is also set — RESUME_BATCH1 takes this path; the record keeps the batch-1 shape (no quest keys).");
  if (QUEST_ONLY && existingRec.deployer && existingRec.deployer.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error("record deployer " + existingRec.deployer + " does not match this wallet " + wallet.address + " — QUEST_ONLY must run with the batch-1 deployer key");
  }
  if (RESUME_BATCH1 && seedRec.deployer.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error("seed record deployer " + seedRec.deployer + " does not match this wallet " + wallet.address + " — RESUME_BATCH1 must run with the batch-1 deployer key (the remaining addresses are predicted from its nonce)");
  }

  // ---- Season start -------------------------------------------------
  // Resolution order: QUEST_START_AT env · (QUEST_ONLY only) the
  // questStartAt recorded by an earlier run · placeholder (dry-run).
  // LIVE runs that deploy QuestPass (full or QUEST_ONLY) require a
  // real value; SKIP_QUEST never deploys QuestPass, so it never does.
  let startAt, startAtIsPlaceholder = false;
  if (process.env.QUEST_START_AT) {
    startAt = parseInt(process.env.QUEST_START_AT, 10);
    if (!Number.isFinite(startAt) || startAt <= 0) throw new Error("QUEST_START_AT is not a valid unix timestamp: " + process.env.QUEST_START_AT);
  } else if (QUEST_ONLY && existingRec.questStartAt) {
    startAt = existingRec.questStartAt;
    console.log("QUEST_START_AT: using the value recorded earlier:", startAt, "=", new Date(startAt * 1000).toISOString());
  } else if (CONFIRM && !SKIP_QUEST && !RESUME_BATCH1) {
    throw new Error("QUEST_START_AT is required in LIVE mode (season day 0 start, unix seconds) — QUEST_ONLY may omit it only when the record carries questStartAt");
  } else {
    startAt = nextNoonCST();
    startAtIsPlaceholder = true;
  }
  if (CONFIRM && !SKIP_QUEST && !RESUME_BATCH1) {
    const nowS = Math.floor(Date.now() / 1000);
    // Mirror the contract's own guard, and refuse a season that has
    // already started (day 0 must begin at startAt, in the future).
    if (startAt + Number(QUEST.stampDays) * 86400 <= nowS) throw new Error("QUEST_START_AT + 7 days is already in the past — the contract would reject this");
    if (startAt <= nowS) throw new Error("QUEST_START_AT is not in the future — pick the real season start (runbook: launch day 12:00 CST)");
    if (startAt > nowS + 14 * 86400) throw new Error("QUEST_START_AT is more than 14 days out — double-check the value");
  }

  // ---- Read-only sanity ----------------------------------------------
  const regCode = await provider.getCode(REGISTRY);
  if (regCode.length <= 2) throw new Error("no code at registry address on mainnet — wrong network?");
  const registry = new ethers.Contract(REGISTRY, ["function balanceOf(address) view returns (uint256)"], provider);
  const sampleBal = await registry.balanceOf(SAMPLE_HOLDER);
  console.log("registry:", REGISTRY, "· sample holder Agent ID balance:", sampleBal.toString(), "(expect >= 1)");

  // RESUME_BATCH1: prove every recorded contract on-chain BEFORE
  // planning anything against it (gate: code size / registry /
  // isHuman sample · bindings: code size / registrar · apps: code
  // size / gate / bindings / idRegistry references).
  if (RESUME_BATCH1) {
    console.log("verifying the recorded gate on-chain before planning…");
    await verifyRecordedGate(provider, seedRec.humanGate);
    if (seedRec.bindings) await verifyRecordedBindings(provider, seedRec.bindings, wallet.address);
    if (seedRec.appsV11) await verifyRecordedApps(provider, seedRec.appsV11, seedRec.humanGate, seedRec.bindings);
  }

  const usdcRead = new ethers.Contract(USDC, ["function decimals() view returns (uint8)", "function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)"], provider);
  const usdcDecimals = Number(await usdcRead.decimals());
  console.log("USDC:", USDC, "· decimals read on-chain:", usdcDecimals, "(expect 18 on BSC)");
  if (usdcDecimals !== 18) throw new Error("unexpected USDC decimals — aborting rather than scaling amounts on an assumption");
  const unit = 10n ** BigInt(usdcDecimals);
  const ctx = {
    startAt, startAtIsPlaceholder, usdcDecimals,
    dayPoolRaw: QUEST.dayPoolUsdc * unit,
    finalePoolRaw: QUEST.finalePoolUsdc * unit,
    skipQuest: SKIP_QUEST || RESUME_BATCH1,
    questOnly: QUEST_ONLY,
    resumeBatch1: RESUME_BATCH1,
    gateAddress: QUEST_ONLY ? existingRec.humanGate : RESUME_BATCH1 ? seedRec.humanGate : null,
    recordedBindings: RESUME_BATCH1 ? (seedRec.bindings ?? null) : null,
    recordedApps: RESUME_BATCH1 ? (seedRec.appsV11 ?? null) : null,
  };
  ctx.escrowRaw = ctx.dayPoolRaw * QUEST.stampDays + ctx.finalePoolRaw; // 14 + 45 = 59 USDC

  const bnbBalance = await provider.getBalance(wallet.address);
  const usdcBalance = await usdcRead.balanceOf(wallet.address);
  const gasPrice = (await provider.getFeeData()).gasPrice ?? 1000000000n;
  const { steps } = await buildPlan(wallet, provider, ctx);
  console.log("");
  const totalCost = printPlan(wallet, bnbBalance, usdcBalance, gasPrice, steps, ctx);

  if (!CONFIRM) {
    console.log("");
    console.log("DRY-RUN complete. No transaction was signed or broadcast.");
    console.log("To deploy for real on launch day:");
    console.log("  CONFIRM_MAINNET=YES QUEST_START_AT=<unix seconds> node scripts/deploy-mainnet.js");
    console.log("  (add INCLUDE_PROFILE=1 to include IdentityProfile)");
    if (SKIP_QUEST) console.log("  SKIP_QUEST batch 1: add SKIP_QUEST=1 — no USDC and no QUEST_START_AT required; QuestPass follows later with QUEST_ONLY=1 once 59 USDC is in the deployer");
    if (QUEST_ONLY) console.log("  QUEST_ONLY batch 2: add QUEST_ONLY=1 — appends QuestPass to the batch-1 record in", recordPath);
    if (RESUME_BATCH1) console.log("  RESUME batch 1: add RESUME_BATCH1=1 INCLUDE_PROFILE=1 — deploys only the missing batch-1 contracts against the recorded gate; no QUEST_START_AT and no USDC required");
    return;
  }

  // ---- LIVE pre-flight aborts ----------------------------------------
  if (totalCost > 0n && bnbBalance < totalCost * BALANCE_SAFETY_X10 / 10n) throw new Error("BNB balance below 1.5x estimated total gas cost — aborting before any broadcast");
  if (!SKIP_QUEST && !RESUME_BATCH1 && usdcBalance < ctx.escrowRaw) throw new Error(`USDC balance ${ethers.formatUnits(usdcBalance, usdcDecimals)} below the ${ethers.formatUnits(ctx.escrowRaw, usdcDecimals)} USDC QuestPass escrow — aborting before any broadcast`);

  // ---- LIVE batch 2 (QUEST_ONLY) --------------------------------------
  // Only two transactions: approve the predicted QuestPass address,
  // then deploy it (same pattern as the full flow's quest block).
  // The quest keys are appended to a copy of the batch-1 record —
  // batch-1 keys are carried over untouched — and the FULL post-
  // deploy checks then run against the merged record.
  if (QUEST_ONLY) {
    console.log("");
    console.log("deploying batch 2 (USDC approve → QuestPass)…");
    const out = { ...existingRec };
    const saveRecord = () => {
      fs.writeFileSync(recordPath, JSON.stringify(out, null, 2));
      console.log("  record updated:", path.basename(recordPath));
    };
    const questStep = Object.fromEntries(steps.map(s => [s.name, s]))["QuestPass"];
    const pendingNow = await provider.getTransactionCount(wallet.address, "pending");
    const predicted = ethers.getCreateAddress({ from: wallet.address, nonce: pendingNow + 1 });
    if (predicted.toLowerCase() !== questStep.address.toLowerCase()) {
      console.log(`  note: plan predicted QuestPass at ${questStep.address}, live nonce now predicts ${predicted} — approving the LIVE prediction`);
    }
    const usdcWrite = new ethers.Contract(USDC, ["function approve(address,uint256) returns (bool)"], provider);
    const approveData = usdcWrite.interface.encodeFunctionData("approve", [predicted, ctx.escrowRaw]);
    const approveEst = (await estimateOrNull(provider, { from: wallet.address, to: USDC, data: approveData })) ?? 60000n;
    console.log(`  approving QuestPass escrow: ${ethers.formatUnits(ctx.escrowRaw, usdcDecimals)} USDC → ${predicted}`);
    await sendTx(wallet, provider, gasPrice, { to: USDC, data: approveData, gasLimit: approveEst * (100n + GAS_BUFFER_PCT) / 100n });
    const allowance = await waitForAllowance(usdcRead, wallet.address, predicted, ctx.escrowRaw);
    if (allowance !== ctx.escrowRaw) throw new Error("allowance after approve is " + allowance.toString() + ", expected the full escrow — aborting before the QuestPass deploy");
    console.log("  allowance confirmed:", ethers.formatUnits(allowance, usdcDecimals), "USDC");
    questStep.address = predicted; // deployStep asserts the landing address
    const questOut = await deployStep(wallet, provider, gasPrice, questStep);
    out.quest = questOut.address; out.questTx = questOut.tx; out.questBlock = questOut.block;
    out.questStartAt = startAt; out.questToken = USDC; out.questEscrowUsdc = ethers.formatUnits(ctx.escrowRaw, usdcDecimals);
    saveRecord();
    await verifyAll(provider, out, ctx);
    saveRecord();
    console.log("BATCH 2 COMPLETE: QuestPass deployed and its keys appended to the batch-1 record (batch-1 keys untouched); full post-deploy checks passed.");
    console.log("REMAINING BNB BALANCE:", ethers.formatEther(await provider.getBalance(wallet.address)), "BNB — return the leftover to the user (see LAUNCH-RUNBOOK.md).");
    console.log("USDC note: the 59 USDC escrow now sits inside QuestPass; unclaimed season funds return only via QuestPass.reclaim() after the finale prize-claim window (~30 days after the finale entry window closes).");
    return;
  }

  // ---- LIVE resume (RESUME_BATCH1) ------------------------------------
  // Batch 1 was interrupted after a prefix of it landed. The record
  // starts from the seed (recorded keys carried over untouched) and
  // gains the missing batch-1 keys as each step lands — same
  // save-after-every-step discipline as a normal run. NO quest keys
  // are written: the record keeps the batch-1 shape, so QUEST_ONLY=1
  // can still append QuestPass later.
  if (RESUME_BATCH1) {
    console.log("");
    console.log("resuming batch 1 against the recorded gate", seedRec.humanGate, "— deploying only the missing contracts (" + steps.map(s => s.name).join(" → ") + ")…");
    const out = { ...seedRec };
    if (!out.network) out.network = "bsc-mainnet";
    if (!out.registry) out.registry = REGISTRY;
    const saveRecord = () => {
      fs.writeFileSync(recordPath, JSON.stringify(out, null, 2));
      console.log("  record updated:", path.basename(recordPath));
    };
    const byName = Object.fromEntries(steps.map(s => [s.name, s]));
    if (byName["IdentityBindingsV3"]) {
      const bindOut = await deployStep(wallet, provider, gasPrice, byName["IdentityBindingsV3"]);
      out.bindings = bindOut.address; out.bindingsTx = bindOut.tx; out.bindingsBlock = bindOut.block;
      saveRecord();
    }
    if (byName["OneIDCampaignsV11"]) {
      const appsOut = await deployStep(wallet, provider, gasPrice, byName["OneIDCampaignsV11"]);
      out.appsV11 = appsOut.address; out.appsV9 = appsOut.address; out.appsTx = appsOut.tx; out.appsBlock = appsOut.block;
      saveRecord();
    }
    if (INCLUDE_PROFILE) {
      const profOut = await deployStep(wallet, provider, gasPrice, byName["IdentityProfile"]);
      out.profile = profOut.address; out.profileTx = profOut.tx; out.profileBlock = profOut.block;
      saveRecord();
    }
    await verifyAll(provider, out, ctx);
    saveRecord();
    console.log("RESUME COMPLETE: batch 1 finished — " + steps.map(s => s.name).join(" / ") + " deployed against the recorded gate; post-deploy checks passed; the record carries no quest keys.");
    console.log("Once 59 USDC is in the deployer, run batch 2:  CONFIRM_MAINNET=YES QUEST_ONLY=1 QUEST_START_AT=<unix seconds> node scripts/deploy-mainnet.js");
    console.log("REMAINING BNB BALANCE:", ethers.formatEther(await provider.getBalance(wallet.address)), "BNB — return the leftover to the user (see LAUNCH-RUNBOOK.md).");
    return;
  }

  console.log("");
  console.log("deploying in order (pending nonce re-fetched before every tx)…");
  // The record is written INCREMENTALLY: saveRecord() runs after every
  // successful step, so if anything fails mid-run, mainnet-address.json
  // already holds every address that actually landed — never re-run the
  // whole script blindly; read the record, check BscScan, and deploy
  // only what is missing.
  const out = {
    network: "bsc-mainnet", chainId: CHAIN_ID, deployer: wallet.address, registry: REGISTRY,
    humanGate: null, humanGateTx: null, humanGateBlock: null,
    // appsV11 is the canonical key. appsV9 carries the same address as a
    // legacy alias: flip-mainnet.js versions predating V11 read
    // appsV9/appsV7, and the alias keeps an older flip copy working.
    appsV11: null, appsV9: null, appsTx: null, appsBlock: null,
    bindings: null, bindingsTx: null, bindingsBlock: null,
    // SKIP_QUEST (batch 1) writes NO quest keys at all — the record is
    // batch-1 only, and QUEST_ONLY appends these keys in batch 2.
    ...(SKIP_QUEST ? {} : {
      quest: null, questTx: null, questBlock: null,
      questStartAt: startAt, questToken: USDC, questEscrowUsdc: ethers.formatUnits(ctx.escrowRaw, usdcDecimals),
    }),
    profile: null, profileTx: null, profileBlock: null,
  };
  const saveRecord = () => {
    fs.writeFileSync(recordPath, JSON.stringify(out, null, 2));
    console.log("  record updated:", path.basename(recordPath));
  };
  const byName = Object.fromEntries(steps.map(s => [s.name, s]));
  const gateOut = await deployStep(wallet, provider, gasPrice, byName["BeCounted"]);
  out.humanGate = gateOut.address; out.humanGateTx = gateOut.tx; out.humanGateBlock = gateOut.block;
  saveRecord();
  const bindOut = await deployStep(wallet, provider, gasPrice, byName["IdentityBindingsV3"]);
  out.bindings = bindOut.address; out.bindingsTx = bindOut.tx; out.bindingsBlock = bindOut.block;
  saveRecord();
  const appsOut = await deployStep(wallet, provider, gasPrice, byName["OneIDCampaignsV11"]);
  out.appsV11 = appsOut.address; out.appsV9 = appsOut.address; out.appsTx = appsOut.tx; out.appsBlock = appsOut.block;
  saveRecord();

  if (!SKIP_QUEST) {
  // QuestPass escrow: approve the PREDICTED address, then deploy.
  // (Mirrors test/flow8.test.js deployFunded: the approve consumes one
  // nonce, so the deploy must land at approveNonce + 1.)
  const questStep = byName["QuestPass"];
  const pendingNow = await provider.getTransactionCount(wallet.address, "pending");
  const predicted = ethers.getCreateAddress({ from: wallet.address, nonce: pendingNow + 1 });
  if (predicted.toLowerCase() !== questStep.address.toLowerCase()) {
    console.log(`  note: plan predicted QuestPass at ${questStep.address}, live nonce now predicts ${predicted} — approving the LIVE prediction`);
  }
  const usdcWrite = new ethers.Contract(USDC, ["function approve(address,uint256) returns (bool)"], provider);
  const approveData = usdcWrite.interface.encodeFunctionData("approve", [predicted, ctx.escrowRaw]);
  const approveEst = (await estimateOrNull(provider, { from: wallet.address, to: USDC, data: approveData })) ?? 60000n;
  console.log(`  approving QuestPass escrow: ${ethers.formatUnits(ctx.escrowRaw, usdcDecimals)} USDC → ${predicted}`);
  await sendTx(wallet, provider, gasPrice, { to: USDC, data: approveData, gasLimit: approveEst * (100n + GAS_BUFFER_PCT) / 100n });
  const allowance = await waitForAllowance(usdcRead, wallet.address, predicted, ctx.escrowRaw);
  if (allowance !== ctx.escrowRaw) throw new Error("allowance after approve is " + allowance.toString() + ", expected the full escrow — aborting before the QuestPass deploy");
  console.log("  allowance confirmed:", ethers.formatUnits(allowance, usdcDecimals), "USDC");
  questStep.address = predicted; // deployStep asserts the landing address
  const questOut = await deployStep(wallet, provider, gasPrice, questStep);
  out.quest = questOut.address; out.questTx = questOut.tx; out.questBlock = questOut.block;
  saveRecord();
  }

  if (INCLUDE_PROFILE) {
    const profOut = await deployStep(wallet, provider, gasPrice, byName["IdentityProfile"]);
    out.profile = profOut.address; out.profileTx = profOut.tx; out.profileBlock = profOut.block;
    saveRecord();
  }

  await verifyAll(provider, out, ctx);
  saveRecord();
  if (SKIP_QUEST) {
    console.log("BATCH 1 COMPLETE: project contracts deployed and verified; QuestPass is NOT deployed yet and the record carries no quest keys.");
    console.log("Once 59 USDC is in the deployer, run batch 2:  CONFIRM_MAINNET=YES QUEST_ONLY=1 QUEST_START_AT=<unix seconds> node scripts/deploy-mainnet.js");
  } else {
    console.log("saved mainnet-address.json (complete, post-verify)");
  }
  console.log("REMAINING BNB BALANCE:", ethers.formatEther(await provider.getBalance(wallet.address)), "BNB — return the leftover to the user (see LAUNCH-RUNBOOK.md).");
  if (!SKIP_QUEST) console.log("USDC note: the 59 USDC escrow now sits inside QuestPass; unclaimed season funds return only via QuestPass.reclaim() after the finale prize-claim window (~30 days after the finale entry window closes).");
}
main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
