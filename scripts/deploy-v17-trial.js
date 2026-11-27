// Deploy + live-trial CheckInV2 and OneIDCampaignsV17 on BSC testnet,
// wired to the EXISTING V4 trial stack (gate + IdentityBindingsV4 from
// bindings-v4-address.json).
//   CheckInV2 = CheckIn V1 with WINDOW_DAYS 30 -> 14.
//   V16 = V15 + weighted raffle draws (createRaffle gains `weighted`;
//   draw reads CheckIn.weightOf for every entrant and picks without
//   replacement against cumulative weight).
// Live trial (each step asserted, PASS lines printed):
//   1. deploy CheckInV2(gate): gate() wiring, WINDOW_DAYS == 14
//   2. deploy V16(gate, bindingsV4, checkInV2): wiring + count 0
//   3. H checks in on CheckInV2 -> weightOf(H) = 2, weightOf(U) = 1
//   4. negative replay: weighted raffle on a checkIn-less V16 -> BadParams
//   5. weighted raffle (label prize, 1 winner): H + U enter, end,
//      lockDraw, draw -> DrawWeighted totalWeight == 3, winner matches
//      the JS recomputation from the Drawn seed
//   6. registration-claim regression on V16 (create + H claim, amount 0)
// Writes checkin-v2-address.json + campaigns-v16-address.json.
// Keys are read from keys/, never printed.
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
const MAXU = ethers.MaxUint256;
const NO_COND = [false, ethers.ZeroAddress, 0n, false, MAXU, 0, ethers.ZeroAddress, ethers.ZeroHash, ethers.ZeroHash];

function artifact(name, sub) {
  const p = path.join(__dirname, "..", "artifacts", "contracts", sub || "", name + ".sol", name + ".json");
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: j.abi, bytecode: j.bytecode, runtimeBytes: (j.deployedBytecode.length - 2) / 2 };
}
async function rpc(url, method, params) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(20000) });
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
async function send(wallet, provider, to, data, value = 0n, gasLimit = 900000n) {
  const nonce = await provider.getTransactionCount(wallet.address, "pending");
  const tx = { to, data, value, nonce, gasLimit, gasPrice: GAS_PRICE, chainId: 97, type: 0 };
  const raw = await wallet.signTransaction(tx);
  const hash = await broadcast(raw);
  const rc = await waitReceipt(hash);
  if (rc.status !== "0x1") throw new Error("tx reverted: " + hash);
  return { hash, block: parseInt(rc.blockNumber, 16), gasUsed: parseInt(rc.gasUsed, 16), receipt: rc };
}
async function deploy(wallet, provider, name, sub, args, gasLimit = 6000000n) {
  const { abi, bytecode, runtimeBytes } = artifact(name, sub);
  const factory = new ethers.ContractFactory(abi, bytecode);
  const deployTx = await factory.getDeployTransaction(...args);
  console.log(`deploying ${name}: expect runtime ${runtimeBytes} bytes`);
  const nonce = await provider.getTransactionCount(wallet.address, "pending");
  const tx = { to: null, data: deployTx.data, value: 0n, nonce, gasLimit, gasPrice: GAS_PRICE, chainId: 97, type: 0 };
  const raw = await wallet.signTransaction(tx);
  const hash = await broadcast(raw);
  const rc = await waitReceipt(hash);
  if (rc.status !== "0x1") throw new Error(name + " deploy reverted: " + hash);
  const addr = ethers.getCreateAddress({ from: wallet.address, nonce });
  const code = await provider.getCode(addr);
  console.log("  address:", addr, "runtime bytes:", (code.length - 2) / 2, "block:", parseInt(rc.blockNumber, 16));
  if ((code.length - 2) / 2 !== runtimeBytes) throw new Error(name + " runtime size mismatch");
  return { address: addr, tx: hash, abi, block: parseInt(rc.blockNumber, 16) };
}
async function replayError(provider, iface, from, to, data, value = 0n) {
  try { await provider.call({ from, to, data, value }); return null; }
  catch (e) {
    const raw = e.data || (e.info && e.info.error && e.info.error.data);
    if (raw) { try { const p = iface.parseError(raw); return p ? `${p.name}(${p.args.join(",")})` : String(raw); } catch { return String(raw); } }
    return String(e.message).slice(0, 120);
  }
}
function assertEq(actual, expected, label) {
  if (String(actual) !== String(expected)) throw new Error(`ASSERT FAIL ${label}: got ${actual}, want ${expected}`);
  console.log("  PASS", label, "=", String(actual));
}
async function expectReplay(provider, iface, from, to, data, errName, value = 0n) {
  const err = await replayError(provider, iface, from, to, data, value);
  if (!err || !err.startsWith(errName)) throw new Error(`expected ${errName}, got: ${err}`);
  console.log(`  PASS replay -> ${err}`);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const provider = new ethers.JsonRpcProvider(READ_RPC, 97, { staticNetwork: true });
  const stack = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "bindings-v4-address.json"), "utf8"));
  const deployer = new ethers.Wallet(fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim(), provider);
  const wp = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "keys", "vote-proof-wallets.json"), "utf8"));
  const H = new ethers.Wallet(wp.wallet1.privateKey || wp.wallet1.key || wp.wallet1, provider);
  const U = new ethers.Wallet(wp.wallet2.privateKey || wp.wallet2.key || wp.wallet2, provider);
  console.log("deployer/creator:", deployer.address);
  console.log("holders H/U:", H.address, U.address);

  // 1. CheckInV2
  const ci = await deploy(deployer, provider, "CheckInV2", "", [stack.gate]);
  const CI = new ethers.Contract(ci.address, ci.abi, provider);
  assertEq(await CI.gate(), stack.gate, "checkInV2.gate()");
  assertEq(await CI.WINDOW_DAYS(), 14n, "checkInV2.WINDOW_DAYS()");

  // 2. V16 wired to it
  const apps = await deploy(deployer, provider, "OneIDCampaignsV17", "", [stack.gate, stack.bindingsV4, ci.address]);
  const A = new ethers.Contract(apps.address, apps.abi, provider);
  assertEq(await A.gate(), stack.gate, "gate()");
  assertEq(await A.bindings(), stack.bindingsV4, "bindings()");
  assertEq(await A.checkIn(), ci.address, "checkIn()");
  assertEq(await A.campaignCount(), 0n, "campaignCount at birth");

  // 3. H checks in (weight 2); U never does (weight 1)
  if (!(await CI.hasCheckedInToday(H.address))) {
    const hTx = await send(H, provider, ci.address, CI.interface.encodeFunctionData("checkIn", []), 0n, 300000n);
    console.log("  H checkIn tx", hTx.hash);
  }
  assertEq(await CI.weightOf(H.address), 2n, "weightOf(H) after 1 check-in");
  assertEq(await CI.weightOf(U.address), 1n, "weightOf(U) never checked in");

  // 4. negative replay: weighted raffle with no CheckIn wired
  const bare = await deploy(deployer, provider, "OneIDCampaignsV17", "", [stack.gate, stack.bindingsV4, ethers.ZeroAddress]);
  const B = new ethers.Contract(bare.address, bare.abi, provider);
  const now0 = (await provider.getBlock("latest")).timestamp;
  await expectReplay(provider, B.interface, deployer.address, bare.address,
    B.interface.encodeFunctionData("createRaffle", ["neg", now0 - 10, now0 + 3600, 1, ethers.ZeroAddress, 0n, NO_COND, "", true]), "BadParams");

  // 4b. V17 constructor guard: an EOA checkIn_ must not deploy
  let ctorReverted = false;
  try { await deploy(deployer, provider, "OneIDCampaignsV17", "", [stack.gate, stack.bindingsV4, H.address]); }
  catch (e) { ctorReverted = true; console.log("  PASS constructor rejects EOA checkIn_"); }
  if (!ctorReverted) throw new Error("constructor accepted an EOA checkIn_");

  // 5. weighted raffle: label prize, 1 winner, 150 s window
  const now = (await provider.getBlock("latest")).timestamp;
  await send(deployer, provider, apps.address,
    A.interface.encodeFunctionData("createRaffle", ["weighted-trial", now - 10, now + 150, 1, ethers.ZeroAddress, 0n, NO_COND, "加权礼盒", true]));
  const id = 0n;
  assertEq(await A.campaignCount(), 1n, "campaignCount after weighted create");
  const camp = await A.getCampaign(id);
  assertEq(camp.weighted, true, "campaign weighted flag");
  assertEq(camp.prizeLabel, "加权礼盒", "campaign prizeLabel");
  await send(H, provider, apps.address, A.interface.encodeFunctionData("enterRaffle", [id, [], []]), 0n, 400000n);
  await send(U, provider, apps.address, A.interface.encodeFunctionData("enterRaffle", [id, [], []]), 0n, 400000n);
  const entries = await A.getEntries(id);
  assertEq(entries.length, 2, "entries");
  console.log("  waiting for the raffle to end (~150 s)…");
  for (;;) {
    const t = (await provider.getBlock("latest")).timestamp;
    if (t > now + 150) break;
    await sleep(12000);
  }
  const lockTx = await send(deployer, provider, apps.address, A.interface.encodeFunctionData("lockDraw", [id]), 0n, 300000n);
  console.log("  lockDraw tx", lockTx.hash);
  // V17 snapshot proof: U checks in AFTER the lock. U LIVE weight
  // rises 1 -> 2, but the snapshot frozen at lock (H=2, U=1) rules.
  if (!(await CI.hasCheckedInToday(U.address))) {
    const uTx = await send(U, provider, ci.address, CI.interface.encodeFunctionData("checkIn", []), 0n, 300000n);
    console.log("  U post-lock checkIn tx", uTx.hash);
  }
  assertEq(await CI.weightOf(U.address), 2n, "weightOf(U) LIVE after post-lock check-in");
  const campLocked = await A.getCampaign(id);
  const seedBlock = Number(campLocked.seedBlock);
  for (;;) {
    const bn = await provider.getBlockNumber();
    if (bn > seedBlock) break;
    await sleep(3000);
  }
  const drawTx = await send(deployer, provider, apps.address, A.interface.encodeFunctionData("draw", [id]), 0n, 900000n);
  console.log("  draw tx", drawTx.hash);
  // recompute the expected winner from the Drawn seed
  const iface = A.interface;
  let seed = null, totalW = null;
  for (const log of drawTx.receipt.logs) {
    let p = null; try { p = iface.parseLog(log); } catch { /* not ours */ }
    if (!p) continue;
    if (p.name === "Drawn") seed = p.args.seed;
    if (p.name === "DrawWeighted") totalW = p.args.totalWeight;
  }
  if (seed === null) throw new Error("Drawn event not found");
  assertEq(totalW, 3n, "DrawWeighted totalWeight = SNAPSHOT (H=2 + U=1); live weights would total 4");
  const weights = [2n, 1n]; // entries order [H, U]
  const r = BigInt(ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [seed, 0n]))) % 3n;
  let acc = 0n, expected = entries[0];
  for (let i = 0; i < entries.length; i++) { acc += weights[i]; if (r < acc) { expected = entries[i]; break; } }
  const winners = await A.getWinners(id);
  assertEq(winners.length, 1, "winner count");
  assertEq(winners[0], expected, "weighted winner matches JS recomputation");
  console.log("  weighted draw verified: seed", seed.toString().slice(0, 18) + "…", "winner", winners[0]);

  // 6. registration-claim regression on V16
  const now2 = (await provider.getBlock("latest")).timestamp;
  await send(deployer, provider, apps.address,
    A.interface.encodeFunctionData("createClaim", ["reg-v16", now2 - 10, now2 + 3600, 2, ethers.ZeroAddress, 0n, false, NO_COND, "周边礼盒 x1"]));
  const id2 = 1n;
  await send(H, provider, apps.address, A.interface.encodeFunctionData("claim", [id2, [], []]), 0n, 400000n);
  const camp2 = await A.getCampaign(id2);
  assertEq(camp2.entryCount, 1n, "registration claim entryCount on V16");
  assertEq(camp2.pool, 0n, "registration claim pool on V16");

  // 7. V17 URL validation: full https:// prefix on both setters
  await send(deployer, provider, apps.address,
    A.interface.encodeFunctionData("setPostUrl", [id2, "https://x.com/9nosing"]), 0n, 300000n);
  console.log("  PASS setPostUrl accepts https:// link");
  await expectReplay(provider, A.interface, deployer.address, apps.address,
    A.interface.encodeFunctionData("setPostUrl", [id2, "httpsx://evil.example"]), "BadParams");
  await expectReplay(provider, A.interface, deployer.address, apps.address,
    A.interface.encodeFunctionData("setWinnerInfo", [id2, "httpsx://evil.example", "n"]), "BadParams");

  const ciRecord = {
    network: "bsc-testnet", chainId: 97, gate: stack.gate,
    checkInV2: ci.address, deployTx: ci.tx, deployBlock: ci.block,
    windowDays: 14,
    trial: "deploy/gate wiring/WINDOW_DAYS=14/H check-in weight 2 vs U weight 1 all PASS",
    deployedAt: new Date().toISOString(),
  };
  const record = {
    network: "bsc-testnet", chainId: 97,
    gate: stack.gate, bindingsV4: stack.bindingsV4, checkInV2: ci.address,
    campaignsV17: apps.address, deployTx: apps.tx, checkInV2TrialInstance: ci.address,
    trial: "V17: deploy/wiring/constructor EOA checkIn_ rejected/weighted BadParams replay/snapshot proof: lockDraw at H=2,U=1 then U post-lock check-in (live 2) yet DrawWeighted total=3 and winner matches SNAPSHOT recomputation/https:// full-prefix replays on setPostUrl+setWinnerInfo/registration claim regression all PASS",
    trialWeightedWinner: winners[0],
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(__dirname, "..", "campaigns-v17-address.json"), JSON.stringify(record, null, 2));
  console.log("TRIAL COMPLETE:", JSON.stringify(record, null, 2));
}

main().catch(e => { console.error("TRIAL FAILED:", e.message); process.exit(1); });
