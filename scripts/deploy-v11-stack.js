// Deploy + live-trial the OneIDCampaignsV11 trial stack on BSC testnet.
// INDEPENDENT stack — does not touch the V10 trial stack or the main demo
// stack:
//   MockRegistryV2 (has handleOf) -> BeCounted gate -> IdentityBindingsV3
//   -> OneIDCampaignsV11(gate, bindingsV3)
// Contents:
//   id 0 — condition-5 (Agent ID allowlist) trial raffle, 1h window;
//          w1 ("trialone", listed) must get in; w2 ("trialtwo") and the
//          handle-less w3 must revert ConditionFailed(5).
//   id 1 — plain vote with on-chain option labels (7-day window)
//   id 2 — fixed claim drop, 0.003 tBNB pool / 3 claims (7-day window)
//   id 3 — long-running condition-5 raffle, same identity list (7-day)
//   id 4 — FUNDED flow raffle (0.001 tBNB, 1 winner, ~150s window):
//          w1 + w2 enter -> wait for the end -> draw() before lockDraw
//          must revert SeedNotLocked -> lockDraw -> draw -> winner
//          claimPrize (balance asserted to the wei) -> loser claimPrize
//          reverts NotWinner -> winner re-claim reverts AlreadyCounted
//          -> creator reclaim reverts TooEarly.
// C1 regression note: the literal reclaim -> claimPrize sequence needs
// endAt + 30 days of real time (PRIZE_CLAIM_WINDOW is a 30-day constant),
// so it cannot run live in one session; it is covered by the local suite
// (test/security-probe-c1.test.js with reversed expectations +
// test/security-fix.test.js, part of the 141 passing). The live probes
// above pin the new lockDraw state machine and the claim guards that
// ARE reachable on-chain.
// Writes v11-address.json + v11-demo-frontend.json. Deployer key and
// wallet keys are read from keys/ and never printed.
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
const ID_LIST_HANDLES = ["trialone", "questfan"];
const MAXU = ethers.MaxUint256;
const NO_COND = [false, ethers.ZeroAddress, 0n, false, MAXU, 0, ethers.ZeroAddress, ethers.ZeroHash, ethers.ZeroHash];

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
async function deploy(wallet, provider, name, sub, args, gasLimit = 6000000n) {
  const { abi, bytecode, runtimeBytes } = artifact(name, sub);
  const factory = new ethers.ContractFactory(abi, bytecode);
  const deployTx = await factory.getDeployTransaction(...args);
  console.log(`deploying ${name}: expect runtime ${runtimeBytes} bytes`);
  const r = await send(wallet, provider, null, deployTx.data, 0n, gasLimit);
  if (r.status !== "0x1") throw new Error(name + " deploy reverted: " + r.hash);
  const txObj = await provider.getTransaction(r.hash);
  const addr = ethers.getCreateAddress({ from: wallet.address, nonce: txObj.nonce });
  const code = await provider.getCode(addr);
  console.log("  address:", addr, "runtime bytes:", (code.length - 2) / 2, "block:", r.block, "gasUsed:", r.gasUsed);
  if ((code.length - 2) / 2 !== runtimeBytes) throw new Error(name + " runtime size mismatch");
  return { address: addr, tx: r.hash, block: r.block, gasUsed: r.gasUsed, abi };
}
// Replay a call and decode the revert (returns "Name(args)" or null on success).
async function replayError(provider, appsC, from, to, data) {
  try {
    await provider.call({ from, to, data });
    return null;
  } catch (e) {
    const raw = e.data || (e.info && e.info.error && e.info.error.data);
    if (raw) { try { const p = appsC.interface.parseError(raw); return p ? `${p.name}(${p.args.join(",")})` : String(raw); } catch { return String(raw); } }
    return String(e.message).slice(0, 120);
  }
}
// identity-leaf merkle (must match the contract + test/flow14)
function idLeafOf(handle) {
  const lh = ethers.keccak256(ethers.toUtf8Bytes(handle));
  return ethers.keccak256(ethers.solidityPacked(["bytes32"], [lh]));
}
function hashPair(a, b) {
  const [x, y] = a < b ? [a, b] : [b, a];
  return ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [x, y]));
}
function idRootAndProof(handles, target) {
  const leaves = handles.map(idLeafOf);
  let level = leaves.slice(); const layers = [level];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? hashPair(level[i], level[i + 1]) : level[i]);
    level = next; layers.push(level);
  }
  let idx = handles.indexOf(target); const proof = [];
  for (let li = 0; li < layers.length - 1; li++) {
    const lv = layers[li]; const sib = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (sib < lv.length) proof.push(lv[sib]);
    idx = Math.floor(idx / 2);
  }
  return { root: layers[layers.length - 1][0], proof };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const provider = new ethers.JsonRpcProvider(READ_RPC, 97, { staticNetwork: true });
  const deployer = new ethers.Wallet(fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim());
  const wp = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "keys", "vote-proof-wallets.json"), "utf8"));
  const w1 = new ethers.Wallet(wp.wallet1.privateKey || wp.wallet1.key || wp.wallet1);
  const w2 = new ethers.Wallet(wp.wallet2.privateKey || wp.wallet2.key || wp.wallet2);
  const w3Path = path.join(__dirname, "..", "keys", "v10-trial-wallet.json");
  let w3;
  if (fs.existsSync(w3Path)) { w3 = new ethers.Wallet(JSON.parse(fs.readFileSync(w3Path, "utf8")).privateKey); }
  else { w3 = ethers.Wallet.createRandom(); fs.writeFileSync(w3Path, JSON.stringify({ privateKey: w3.privateKey, address: w3.address }, null, 2)); }
  console.log("deployer:", deployer.address, "tBNB:", ethers.formatEther(await provider.getBalance(deployer.address)));
  console.log("w1:", w1.address, "tBNB:", ethers.formatEther(await provider.getBalance(w1.address)));
  console.log("w2:", w2.address, "tBNB:", ethers.formatEther(await provider.getBalance(w2.address)));
  console.log("w3 (handle-less):", w3.address, "tBNB:", ethers.formatEther(await provider.getBalance(w3.address)));
  // Top up the trial wallets if they cannot pay gas.
  for (const [name, w] of [["w1", w1], ["w2", w2], ["w3", w3]]) {
    if ((await provider.getBalance(w.address)) < ethers.parseEther("0.002")) {
      const r = await send(deployer, provider, w.address, "0x", ethers.parseEther("0.005"));
      console.log(`fund ${name}:`, r.hash, r.status);
    }
  }

  const out = { network: "bsc-testnet", date: new Date().toISOString() };

  // 1) trial stack: mock -> gate -> bindingsV3 -> appsV11
  const mock = await deploy(deployer, provider, "MockRegistryV2", "mocks", []);
  out.mockRegistryV2 = mock.address; out.mockRegistryV2Tx = mock.tx; out.mockRegistryV2Block = mock.block;
  const gate = await deploy(deployer, provider, "BeCounted", "", [mock.address]);
  out.gateV11 = gate.address; out.gateV11Tx = gate.tx; out.gateV11Block = gate.block; out.gateDeployGasUsed = gate.gasUsed;
  const bind = await deploy(deployer, provider, "IdentityBindingsV3", "", []);
  out.bindingsV3 = bind.address; out.bindingsV3Tx = bind.tx; out.bindingsV3Block = bind.block; out.bindingsV3DeployGasUsed = bind.gasUsed;
  const apps = await deploy(deployer, provider, "OneIDCampaignsV11", "", [gate.address, bind.address]);
  out.appsV11 = apps.address; out.appsV11Tx = apps.tx; out.appsV11Block = apps.block; out.appsV11DeployGasUsed = apps.gasUsed;

  const mockC = new ethers.Contract(mock.address, mock.abi, provider);
  const gateC = new ethers.Contract(gate.address, gate.abi, provider);
  const bindC = new ethers.Contract(bind.address, bind.abi, provider);
  const appsC = new ethers.Contract(apps.address, apps.abi, provider);
  console.log("apps.idRegistry():", await appsC.idRegistry());
  if ((await appsC.idRegistry()).toLowerCase() !== mock.address.toLowerCase()) throw new Error("idRegistry != mock registry");
  console.log("apps.bindings():", await appsC.bindings());
  if ((await appsC.bindings()).toLowerCase() !== bind.address.toLowerCase()) throw new Error("apps bindings != BindingsV3");
  console.log("bindingsV3.registrar():", await bindC.registrar());
  if ((await bindC.registrar()).toLowerCase() !== deployer.address.toLowerCase()) throw new Error("registrar != deployer");
  out.registrar = await bindC.registrar();

  // 2) identities: w1 -> "trialone" (listed), w2 -> "trialtwo" (NOT listed), w3 -> issued, no handle
  let r = await send(w1, provider, mock.address, mockC.interface.encodeFunctionData("registerHandle", ["trialone"]));
  out.w1RegisterHandleTx = r.hash; console.log("w1 registerHandle(trialone):", r.hash, r.status);
  r = await send(w2, provider, mock.address, mockC.interface.encodeFunctionData("registerHandle", ["trialtwo"]));
  out.w2RegisterHandleTx = r.hash; console.log("w2 registerHandle(trialtwo):", r.hash, r.status);
  r = await send(deployer, provider, mock.address, mockC.interface.encodeFunctionData("issue", [w3.address]));
  out.w3IssueTx = r.hash; console.log("issue(w3, no handle):", r.hash, r.status);
  console.log("handleOf(w1):", await mockC.handleOf(w1.address), "| handleOf(w2):", await mockC.handleOf(w2.address), "| handleOf(w3):", JSON.stringify(await mockC.handleOf(w3.address)));
  console.log("isHuman w1/w2/w3:", await gateC.isHuman(w1.address), await gateC.isHuman(w2.address), await gateC.isHuman(w3.address));

  const now0 = (await provider.getBlock("latest")).timestamp;
  async function createdId(txPromise) {
    const rr = await txPromise;
    if (rr.status !== "0x1") throw new Error("create reverted: " + rr.hash);
    const rcTx = await provider.getTransactionReceipt(rr.hash);
    const ev = rcTx.logs.map(l => { try { return appsC.interface.parseLog(l); } catch { return null; } }).find(e => e && e.name === "CampaignCreated");
    return { id: Number(ev.args.id), hash: rr.hash, block: rr.block };
  }

  // 3) id 0 — condition-5 trial raffle (1h, no prize)
  const { root, proof } = idRootAndProof(ID_LIST_HANDLES, "trialone");
  out.idListHandles = ID_LIST_HANDLES; out.idListRoot = root; out.w1IdProof = proof;
  const cond5 = [...NO_COND.slice(0, 8), root];
  let c = await createdId(send(deployer, provider, apps.address, appsC.interface.encodeFunctionData("createRaffle",
    ["V11 condition-5 trial raffle", now0 - 60, now0 + 3600, 1, ethers.ZeroAddress, 0n, cond5, ""]), 0n, 1000000n));
  out.createRaffleTx = c.hash; out.createRaffleBlock = c.block; out.campaignId = c.id;
  console.log("campaign", c.id, "cond-5 trial raffle created:", c.hash);
  const cd0 = await appsC.conditionsOf(c.id);
  if (cd0.idListRoot !== root) throw new Error("idListRoot mismatch");
  r = await send(w1, provider, apps.address, appsC.interface.encodeFunctionData("enterRaffle", [c.id, [], proof]));
  out.w1EnterTx = r.hash; out.w1EnterBlock = r.block;
  console.log("w1 enterRaffle:", r.hash, "status:", r.status);
  if (r.status !== "0x1") throw new Error("w1 entry FAILED");
  for (const [name, w] of [["w2", w2], ["w3", w3]]) {
    const data = appsC.interface.encodeFunctionData("enterRaffle", [c.id, [], []]);
    const reason = await replayError(provider, appsC, w.address, apps.address, data);
    const rr = await send(w, provider, apps.address, data);
    console.log(`${name} enterRaffle:`, rr.hash, "status:", rr.status, "| revert reason:", reason);
    out[name + "EnterTx"] = rr.hash; out[name + "EnterStatus"] = rr.status; out[name + "RevertReason"] = reason;
    if (rr.status !== "0x0") throw new Error(name + " entry should have reverted");
    if (await appsC.hasEntered(c.id, w.address)) throw new Error(name + " must not be marked entered");
  }
  out.trialResult = "w1 (listed handle 'trialone') entered; w2 (unlisted handle 'trialtwo') and w3 (no handle) rejected with ConditionFailed(5); entries not consumed";

  // 4) demo campaigns id 1..3 (7-day windows) -> v11-demo-frontend.json
  const demo = { network: "bsc-testnet", date: new Date().toISOString(), apps: apps.address, campaigns: [] };
  const start = now0 - 60, end7 = now0 + 7 * 86400;
  c = await createdId(send(deployer, provider, apps.address,
    appsC.interface.encodeFunctionData("createVote", ["Demo vote — 前端演示 (V11)", start, end7, 2, ethers.ZeroAddress, 0n, 0, NO_COND, ["Option A 选项甲", "Option B 选项乙"]])));
  demo.campaigns.push({ kind: "vote", ...c }); console.log("vote:", JSON.stringify(c));
  c = await createdId(send(deployer, provider, apps.address,
    appsC.interface.encodeFunctionData("createClaim", ["Demo claim — 前端演示 (V11)", start, end7, 3, ethers.ZeroAddress, ethers.parseEther("0.003"), false, NO_COND]),
    ethers.parseEther("0.003")));
  demo.campaigns.push({ kind: "claim", ...c }); console.log("claim:", JSON.stringify(c));
  c = await createdId(send(deployer, provider, apps.address,
    appsC.interface.encodeFunctionData("createRaffle", ["V11 condition-5 demo raffle — Agent ID 名单抽奖", start, end7, 1, ethers.ZeroAddress, 0n, cond5, ""])));
  demo.campaigns.push({ kind: "raffle-cond5", idListHandles: ID_LIST_HANDLES, idListRoot: root, ...c });
  console.log("raffle-cond5:", JSON.stringify(c));
  const cd3 = await appsC.conditionsOf(c.id);
  if (cd3.idListRoot !== root) throw new Error("idListRoot mismatch (demo raffle)");

  // 5) id 4 — funded flow raffle: enter -> end -> lockDraw -> draw -> claimPrize
  const flowStart = (await provider.getBlock("latest")).timestamp;
  const flowEnd = flowStart + 150;
  const PRIZE = ethers.parseEther("0.001");
  const fc = await createdId(send(deployer, provider, apps.address,
    appsC.interface.encodeFunctionData("createRaffle", ["V11 flow trial raffle — 全流程实测", flowStart - 10, flowEnd, 1, ethers.ZeroAddress, PRIZE, NO_COND, ""]),
    PRIZE, 1000000n));
  console.log("flow raffle:", JSON.stringify(fc), "endAt:", flowEnd);
  const flow = { campaignId: fc.id, createTx: fc.hash, prizePerWinner: PRIZE.toString(), endAt: flowEnd };
  r = await send(w1, provider, apps.address, appsC.interface.encodeFunctionData("enterRaffle", [fc.id, [], []]));
  flow.w1EnterTx = r.hash; if (r.status !== "0x1") throw new Error("flow w1 entry failed");
  r = await send(w2, provider, apps.address, appsC.interface.encodeFunctionData("enterRaffle", [fc.id, [], []]));
  flow.w2EnterTx = r.hash; if (r.status !== "0x1") throw new Error("flow w2 entry failed");
  console.log("flow: w1 + w2 entered; waiting for endAt", flowEnd);
  for (;;) {
    const t = (await provider.getBlock("latest")).timestamp;
    if (t > flowEnd) break;
    await sleep(5000);
  }
  // draw before lockDraw must revert SeedNotLocked
  flow.drawBeforeLockReason = await replayError(provider, appsC, deployer.address, apps.address, appsC.interface.encodeFunctionData("draw", [fc.id]));
  console.log("flow: draw before lockDraw ->", flow.drawBeforeLockReason);
  if (!String(flow.drawBeforeLockReason).startsWith("SeedNotLocked")) throw new Error("expected SeedNotLocked, got " + flow.drawBeforeLockReason);
  r = await send(deployer, provider, apps.address, appsC.interface.encodeFunctionData("lockDraw", [fc.id]));
  flow.lockDrawTx = r.hash; if (r.status !== "0x1") throw new Error("lockDraw failed");
  let camp = await appsC.getCampaign(fc.id);
  flow.seedBlock = camp.seedBlock.toString();
  console.log("flow: lockDraw ok, seedBlock =", flow.seedBlock);
  for (;;) {
    const b = await provider.getBlockNumber();
    if (BigInt(b) > camp.seedBlock) break;
    await sleep(1500);
  }
  r = await send(deployer, provider, apps.address, appsC.interface.encodeFunctionData("draw", [fc.id]));
  flow.drawTx = r.hash; if (r.status !== "0x1") throw new Error("draw failed");
  camp = await appsC.getCampaign(fc.id);
  console.log("flow: drawn =", camp.drawn, "usedFallbackSeed =", camp.usedFallbackSeed);
  if (!camp.drawn || camp.usedFallbackSeed) throw new Error("draw state wrong");
  const w1Won = await appsC.isWinner(fc.id, w1.address);
  const w2Won = await appsC.isWinner(fc.id, w2.address);
  if (w1Won === w2Won) throw new Error("exactly one of w1/w2 must win");
  const winner = w1Won ? w1 : w2, loser = w1Won ? w2 : w1;
  flow.winner = winner.address; flow.loser = loser.address;
  console.log("flow: winner =", winner.address);
  const balBefore = await provider.getBalance(winner.address);
  r = await send(winner, provider, apps.address, appsC.interface.encodeFunctionData("claimPrize", [fc.id]), 0n, 300000n);
  flow.claimPrizeTx = r.hash; if (r.status !== "0x1") throw new Error("winner claimPrize failed");
  const balAfter = await provider.getBalance(winner.address);
  const gasCost = BigInt(r.gasUsed) * GAS_PRICE;
  const netGain = balAfter - balBefore + gasCost;
  console.log("flow: winner net gain (prize, gas-adjusted):", netGain.toString(), "expected:", PRIZE.toString());
  if (netGain !== PRIZE) throw new Error("winner prize amount mismatch");
  flow.winnerPrizeVerified = true;
  flow.loserClaimReason = await replayError(provider, appsC, loser.address, apps.address, appsC.interface.encodeFunctionData("claimPrize", [fc.id]));
  console.log("flow: loser claimPrize ->", flow.loserClaimReason);
  if (!String(flow.loserClaimReason).startsWith("NotWinner")) throw new Error("expected NotWinner, got " + flow.loserClaimReason);
  flow.winnerReclaimReason = await replayError(provider, appsC, winner.address, apps.address, appsC.interface.encodeFunctionData("claimPrize", [fc.id]));
  console.log("flow: winner second claimPrize ->", flow.winnerReclaimReason);
  if (!String(flow.winnerReclaimReason).startsWith("AlreadyCounted")) throw new Error("expected AlreadyCounted, got " + flow.winnerReclaimReason);
  flow.creatorReclaimReason = await replayError(provider, appsC, deployer.address, apps.address, appsC.interface.encodeFunctionData("reclaim", [fc.id]));
  console.log("flow: creator reclaim (inside window) ->", flow.creatorReclaimReason);
  if (!String(flow.creatorReclaimReason).startsWith("TooEarly")) throw new Error("expected TooEarly, got " + flow.creatorReclaimReason);
  flow.result = "enter -> end -> draw-before-lock SeedNotLocked -> lockDraw -> draw (no fallback) -> winner claimPrize exact 0.001 tBNB -> loser NotWinner -> double-claim AlreadyCounted -> early reclaim TooEarly";
  out.flowTrial = flow;

  out.c1Regression = "Local suite only: the reclaim -> claimPrize sequence needs endAt + 30 days of real time (PRIZE_CLAIM_WINDOW = 30 days constant), unreachable in a live session. Covered by test/security-probe-c1.test.js (expectations reversed for V11: post-reclaim claimPrize reverts AlreadyCounted) + test/security-fix.test.js — part of the 141 passing.";
  out.trialResult += "; demo campaigns 1-3 created; flow raffle id " + fc.id + " ran the full lockDraw flow";

  fs.writeFileSync(path.join(__dirname, "..", "v11-address.json"), JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(__dirname, "..", "v11-demo-frontend.json"), JSON.stringify(demo, null, 2));
  console.log("saved v11-address.json + v11-demo-frontend.json");
  console.log("apps.campaignCount:", (await appsC.campaignCount()).toString());
}
main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
