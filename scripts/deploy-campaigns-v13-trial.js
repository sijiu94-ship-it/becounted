// Deploy + live-trial OneIDCampaignsV13 on BSC testnet, wired to the
// EXISTING V4 trial stack (gate + IdentityBindingsV4 from
// bindings-v4-address.json). V13 = V11 code + setWinnerInfo.
// Live trial (each step asserted, PASS lines printed):
//   1. deploy V13(gate, bindingsV4); gate()/bindings() wiring checks
//   2. creator creates a prizeLabel raffle (winnerCount 1)
//   3. creator setWinnerInfo(url, note) -> getters read back exactly
//   4. non-creator setWinnerInfo -> NotCreator (eth_call replay)
//   5. holders H + U enter; wait for end; lockDraw; draw; 1 winner
//   6. winnerInfoUrl/Note still readable after the draw
// Writes campaigns-v13-address.json. Keys are read from keys/, never printed.
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
const INFO_URL = "https://example.com/winner-form";
const INFO_NOTE = "中奖后请在此填写你的 API 账号邮箱";

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
async function replayError(provider, iface, from, to, data) {
  try { await provider.call({ from, to, data }); return null; }
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
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const provider = new ethers.JsonRpcProvider(READ_RPC, 97, { staticNetwork: true });
  const stack = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "bindings-v4-address.json"), "utf8"));
  const deployer = new ethers.Wallet(fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim(), provider);
  const wp = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "keys", "vote-proof-wallets.json"), "utf8"));
  const H = new ethers.Wallet(wp.wallet1.privateKey || wp.wallet1.key || wp.wallet1, provider);
  const U = new ethers.Wallet(wp.wallet2.privateKey || wp.wallet2.key || wp.wallet2, provider);
  console.log("deployer/creator:", deployer.address);

  // 1. deploy + wiring
  const apps = await deploy(deployer, provider, "OneIDCampaignsV13", "", [stack.gate, stack.bindingsV4]);
  const A = new ethers.Contract(apps.address, apps.abi, provider);
  assertEq(await A.gate(), stack.gate, "gate()");
  assertEq(await A.bindings(), stack.bindingsV4, "bindings()");
  assertEq(await A.campaignCount(), 0n, "campaignCount at birth");

  // 2. prizeLabel raffle, ~150 s long
  const now = (await provider.getBlock("latest")).timestamp;
  const createData = A.interface.encodeFunctionData("createRaffle", ["api-prize-v13", now - 10, now + 150, 1, ethers.ZeroAddress, 0n, NO_COND, "API credits x7"]);
  const cTx = await send(deployer, provider, apps.address, createData);
  const count = await A.campaignCount();
  assertEq(count, 1n, "campaignCount after create");
  const id = 0n;
  console.log("  raffle id", id.toString(), "create tx", cTx.hash);

  // 3. set + read back
  await send(deployer, provider, apps.address, A.interface.encodeFunctionData("setWinnerInfo", [id, INFO_URL, INFO_NOTE]));
  assertEq(await A.winnerInfoUrl(id), INFO_URL, "winnerInfoUrl");
  assertEq(await A.winnerInfoNote(id), INFO_NOTE, "winnerInfoNote");

  // 4. non-creator rejected
  const err = await replayError(provider, A.interface, H.address, apps.address, A.interface.encodeFunctionData("setWinnerInfo", [id, "https://evil.example.com", "x"]));
  if (!err || !err.startsWith("NotCreator")) throw new Error("expected NotCreator, got: " + err);
  console.log("  PASS non-creator setWinnerInfo ->", err);

  // 5. entries, wait, lock, draw
  await send(H, provider, apps.address, A.interface.encodeFunctionData("enterRaffle", [id, [], []]));
  await send(U, provider, apps.address, A.interface.encodeFunctionData("enterRaffle", [id, [], []]));
  console.log("  PASS H + U entered; waiting for the raffle to end (~150 s)…");
  for (;;) {
    const t = (await provider.getBlock("latest")).timestamp;
    if (t > now + 150) break;
    await sleep(15000);
  }
  await send(deployer, provider, apps.address, A.interface.encodeFunctionData("lockDraw", [id]));
  await sleep(4000);
  await send(deployer, provider, apps.address, A.interface.encodeFunctionData("draw", [id]));
  const winners = await A.getWinners(id);
  assertEq(winners.length, 1, "winner count");
  console.log("  PASS winner drawn:", winners[0]);

  // 6. info survives the draw
  assertEq(await A.winnerInfoUrl(id), INFO_URL, "winnerInfoUrl after draw");
  assertEq(await A.winnerInfoNote(id), INFO_NOTE, "winnerInfoNote after draw");

  const record = {
    network: "bsc-testnet", chainId: 97,
    gate: stack.gate, bindingsV4: stack.bindingsV4,
    campaignsV13: apps.address, deployTx: apps.tx,
    trial: "deploy/wiring/set+readback/NotCreator/enter/lockDraw/draw/info-after-draw all PASS",
    trialRaffleId: 0, trialWinner: winners[0],
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(__dirname, "..", "campaigns-v13-address.json"), JSON.stringify(record, null, 2));
  console.log("TRIAL COMPLETE:", JSON.stringify(record, null, 2));
}

main().catch(e => { console.error("TRIAL FAILED:", e.message); process.exit(1); });
