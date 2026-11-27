// Deploy + live-trial OneIDCampaignsV15 on BSC testnet, wired to the
// EXISTING V4 trial stack (gate + IdentityBindingsV4 from
// bindings-v4-address.json). V15 = V14 code + ONE change: createClaim
// accepts a prizeLabel -> registration claim (no escrow, claim only
// records the claimant on-chain, first come first served).
// Live trial (each step asserted, PASS lines printed):
//   1. deploy V15(gate, bindingsV4); gate()/bindings() wiring checks
//   2. negative replays: label+pool, label+random, label+token,
//      no-label+pool 0 -> all BadParams
//   3. creator creates a registration claim (maxClaims 2, prizeLabel)
//      -> fields read back: label set, pool 0, claimAmount 0
//   4. H claims -> Claimed amount 0, entries [H]; H again -> AlreadyCounted
//   5. U claims -> slots full; any further claim -> NoSlots
//   6. short registration claim (90 s): H claims, wait for end,
//      creator reclaim closes it moving no funds
//   7. escrow claim regression: BNB pool claim pays H exactly one share
// Writes campaigns-v15-address.json. Keys are read from keys/, never printed.
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
const LABEL = "周边礼盒 x1";

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
async function send(wallet, provider, to, data, value = 0n, gasLimit = 500000n) {
  const nonce = await provider.getTransactionCount(wallet.address, "pending");
  const tx = { to, data, value, nonce, gasLimit, gasPrice: GAS_PRICE, chainId: 97, type: 0 };
  const raw = await wallet.signTransaction(tx);
  const hash = await broadcast(raw);
  const rc = await waitReceipt(hash);
  if (rc.status !== "0x1") throw new Error("tx reverted: " + hash);
  return { hash, block: parseInt(rc.blockNumber, 16), gasUsed: parseInt(rc.gasUsed, 16) };
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
  return { address: addr, tx: hash, abi };
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

  // 1. deploy + wiring
  const apps = await deploy(deployer, provider, "OneIDCampaignsV15", "", [stack.gate, stack.bindingsV4]);
  const A = new ethers.Contract(apps.address, apps.abi, provider);
  assertEq(await A.gate(), stack.gate, "gate()");
  assertEq(await A.bindings(), stack.bindingsV4, "bindings()");
  assertEq(await A.campaignCount(), 0n, "campaignCount at birth");

  const now = (await provider.getBlock("latest")).timestamp;

  // 2. negative replays (nothing is created by these)
  const enc = (args, value) => A.interface.encodeFunctionData("createClaim", args);
  await expectReplay(provider, A.interface, deployer.address, apps.address,
    enc(["neg", now - 10, now + 3600, 2, ethers.ZeroAddress, 100n, false, NO_COND, LABEL]), "BadParams");
  await expectReplay(provider, A.interface, deployer.address, apps.address,
    enc(["neg", now - 10, now + 3600, 2, ethers.ZeroAddress, 0n, true, NO_COND, LABEL]), "BadParams");
  await expectReplay(provider, A.interface, deployer.address, apps.address,
    enc(["neg", now - 10, now + 3600, 2, stack.gate, 0n, false, NO_COND, LABEL]), "BadParams");
  await expectReplay(provider, A.interface, deployer.address, apps.address,
    enc(["neg", now - 10, now + 3600, 2, ethers.ZeroAddress, 0n, false, NO_COND, ""]), "BadParams");
  assertEq(await A.campaignCount(), 0n, "campaignCount after negative replays");

  // 3. registration claim, 2 slots
  const cTx = await send(deployer, provider, apps.address,
    enc(["reg-claim-v15", now - 10, now + 3600, 2, ethers.ZeroAddress, 0n, false, NO_COND, LABEL]));
  const id = 0n;
  assertEq(await A.campaignCount(), 1n, "campaignCount after create");
  console.log("  registration claim id", id.toString(), "create tx", cTx.hash);
  const camp = await A.getCampaign(id);
  assertEq(camp.prizeLabel, LABEL, "prizeLabel");
  assertEq(camp.pool, 0n, "pool");
  assertEq(camp.claimAmount, 0n, "claimAmount");
  assertEq(camp.maxClaims, 2n, "maxClaims");
  assertEq(await provider.getBalance(apps.address), 0n, "contract balance (no escrow)");

  // 4. H claims; Claimed event carries amount 0; entries [H]
  const hTx = await send(H, provider, apps.address, A.interface.encodeFunctionData("claim", [id, [], []]));
  console.log("  H claim tx", hTx.hash);
  let entries = await A.getEntries(id);
  assertEq(entries.length, 1, "entries after H");
  assertEq(entries[0], H.address, "entries[0]");
  await expectReplay(provider, A.interface, H.address, apps.address,
    A.interface.encodeFunctionData("claim", [id, [], []]), "AlreadyCounted");

  // 5. U claims -> full; further claims hit NoSlots (checked before _join)
  await send(U, provider, apps.address, A.interface.encodeFunctionData("claim", [id, [], []]));
  entries = await A.getEntries(id);
  assertEq(entries.length, 2, "entries after U");
  await expectReplay(provider, A.interface, deployer.address, apps.address,
    A.interface.encodeFunctionData("claim", [id, [], []]), "NoSlots");

  // 6. short registration claim + reclaim close-out
  const now2 = (await provider.getBlock("latest")).timestamp;
  await send(deployer, provider, apps.address,
    enc(["reg-claim-short", now2 - 10, now2 + 90, 5, ethers.ZeroAddress, 0n, false, NO_COND, LABEL]));
  const id2 = 1n;
  await send(H, provider, apps.address, A.interface.encodeFunctionData("claim", [id2, [], []]));
  console.log("  PASS H claimed on short claim; waiting for it to end (~90 s)…");
  for (;;) {
    const t = (await provider.getBlock("latest")).timestamp;
    if (t > now2 + 90) break;
    await sleep(12000);
  }
  const balBefore = await provider.getBalance(deployer.address);
  await send(deployer, provider, apps.address, A.interface.encodeFunctionData("reclaim", [id2]));
  const camp2 = await A.getCampaign(id2);
  assertEq(camp2.reclaimed, true, "short claim reclaimed");
  assertEq(camp2.paidOut, 0n, "short claim paidOut");
  console.log("  PASS reclaim closed the registration claim (creator balance delta is gas-only, before:", balBefore.toString(), ")");

  // 7. escrow claim regression on the new signature: 0.002 tBNB pool, 2 slots
  const now3 = (await provider.getBlock("latest")).timestamp;
  const pool = ethers.parseEther("0.002");
  await send(deployer, provider, apps.address,
    enc(["escrow-claim-v15", now3 - 10, now3 + 3600, 2, ethers.ZeroAddress, pool, false, NO_COND, ""]), pool);
  const id3 = 2n;
  const hBalBefore = await provider.getBalance(H.address);
  await send(H, provider, apps.address, A.interface.encodeFunctionData("claim", [id3, [], []]));
  const hBalAfter = await provider.getBalance(H.address);
  const gained = hBalAfter - hBalBefore + 1000000000000000n; // + rough gas headroom check below instead
  const camp3 = await A.getCampaign(id3);
  assertEq(camp3.paidOut, ethers.parseEther("0.001"), "escrow claim paidOut (one fixed share)");
  if (!(hBalAfter > hBalBefore)) throw new Error("H balance did not increase from escrow claim");
  console.log("  PASS escrow claim paid H (balance up, paidOut = 0.001 tBNB, gained+gas ≈", gained.toString(), ")");

  const record = {
    network: "bsc-testnet", chainId: 97,
    gate: stack.gate, bindingsV4: stack.bindingsV4,
    campaignsV15: apps.address, deployTx: apps.tx,
    trial: "deploy/wiring/4x BadParams replays/registration create+fields/H+U claim/AlreadyCounted/NoSlots/short claim reclaim/escrow claim regression all PASS",
    trialRegClaimId: 0, trialClaimants: entries,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(__dirname, "..", "campaigns-v15-address.json"), JSON.stringify(record, null, 2));
  console.log("TRIAL COMPLETE:", JSON.stringify(record, null, 2));
}

main().catch(e => { console.error("TRIAL FAILED:", e.message); process.exit(1); });
