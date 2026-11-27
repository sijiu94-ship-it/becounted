// Deploy + live-trial the IdentityBindingsV4 stack on BSC testnet.
// INDEPENDENT stack — does not touch the V11 trial stack or mainnet:
//   MockRegistryV2 -> BeCounted gate -> IdentityBindingsV4
//   -> OneIDCampaignsV11(gate, bindingsV4)   [the "V12" configuration:
//      V11 code, constructor pointed at the V4 bindings registry]
// Live trial (each step asserted, PASS lines printed):
//   1. holder H registerSelf -> proofType 2, proofRef stored, valid
//   2. binding-gated raffle: H enters; unbound U reverts ConditionFailed(0)
//   3. H registerSelf again at once -> CooldownActive
//   4. registrar revokeSelfRegistration(H) -> proofType 255
//   5. second binding-gated raffle: H reverts ConditionFailed(0)
//   6. H registerSelf again -> CooldownActive (revocation did not reset)
// Writes bindings-v4-address.json. Keys are read from keys/, never printed.
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
const BIND_COND = [true, ethers.ZeroAddress, 0n, false, MAXU, 0, ethers.ZeroAddress, ethers.ZeroHash, ethers.ZeroHash];
const TWEET_ID = 1999999999999999999n;

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

async function main() {
  const provider = new ethers.JsonRpcProvider(READ_RPC, 97, { staticNetwork: true });
  const deployer = new ethers.Wallet(fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim(), provider);
  const wp = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "keys", "vote-proof-wallets.json"), "utf8"));
  const H = new ethers.Wallet(wp.wallet1.privateKey || wp.wallet1.key || wp.wallet1, provider);
  const U = new ethers.Wallet(wp.wallet2.privateKey || wp.wallet2.key || wp.wallet2, provider);
  console.log("deployer:", deployer.address, "tBNB:", ethers.formatEther(await provider.getBalance(deployer.address)));
  for (const [n, w] of [["H", H], ["U", U]]) {
    const b = await provider.getBalance(w.address);
    console.log(n + ":", w.address, "tBNB:", ethers.formatEther(b));
    if (b < ethers.parseEther("0.01")) { console.log("  topping up", n); await send(deployer, provider, w.address, "0x", ethers.parseEther("0.02"), 21000n); }
  }

  const mock = await deploy(deployer, provider, "MockRegistryV2", "mocks", []);
  const gate = await deploy(deployer, provider, "BeCounted", "", [mock.address]);
  const bind = await deploy(deployer, provider, "IdentityBindingsV4", "", []);
  const apps = await deploy(deployer, provider, "OneIDCampaignsV11", "", [gate.address, bind.address]);

  const mockC = new ethers.Contract(mock.address, mock.abi, provider);
  const bindC = new ethers.Contract(bind.address, bind.abi, provider);
  const appsC = new ethers.Contract(apps.address, apps.abi, provider);
  const enc = (c, fn, args) => c.interface.encodeFunctionData(fn, args);

  console.log("— issue Agent IDs to H and U");
  await send(deployer, provider, mock.address, enc(mockC, "issue", [H.address]));
  await send(deployer, provider, mock.address, enc(mockC, "issue", [U.address]));

  console.log("— 1. H registerSelf");
  const r1 = await send(H, provider, bind.address, enc(bindC, "registerSelf", ["trialholder", TWEET_ID]));
  console.log("  tx:", r1.hash);
  assertEq(await bindC.proofTypeOf(H.address), 2, "proofTypeOf(H)");
  assertEq(await bindC.proofRefOf(H.address), TWEET_ID, "proofRefOf(H)");
  assertEq(await bindC.isBindingValid(H.address), true, "isBindingValid(H)");

  console.log("— 2. binding-gated raffle: H enters, U blocked");
  const now = (await provider.getBlock("latest")).timestamp;
  const c1 = await send(deployer, provider, apps.address, enc(appsC, "createRaffle", ["v4trial", now - 10, now + 3600, 1, ethers.ZeroAddress, 0n, BIND_COND, ""]), 0n, 1500000n);
  const rc1 = await rpc(READ_RPC, "eth_getTransactionReceipt", [c1.hash]);
  const created = rc1.logs.map(l => { try { return appsC.interface.parseLog({ topics: l.topics, data: l.data }); } catch { return null; } }).find(e => e && e.name === "CampaignCreated");
  const id1 = created.args.id;
  await send(H, provider, apps.address, enc(appsC, "enterRaffle", [id1, [], []]));
  console.log("  PASS H entered raffle", id1.toString());
  const eU = await replayError(provider, appsC.interface, U.address, apps.address, enc(appsC, "enterRaffle", [id1, [], []]));
  if (!/^ConditionFailed\(0\)/.test(eU || "")) throw new Error("U entry: expected ConditionFailed(0), got " + eU);
  console.log("  PASS U blocked:", eU);

  console.log("— 3. H immediate re-register -> CooldownActive");
  const eCool = await replayError(provider, bindC.interface, H.address, bind.address, enc(bindC, "registerSelf", ["otherhandle", TWEET_ID + 1n]));
  if (!/^CooldownActive/.test(eCool || "")) throw new Error("expected CooldownActive, got " + eCool);
  console.log("  PASS cooldown:", eCool);

  console.log("— 4. registrar revokes H");
  await send(deployer, provider, bind.address, enc(bindC, "revokeSelfRegistration", [H.address]));
  assertEq(await bindC.proofTypeOf(H.address), 255, "proofTypeOf(H) after revoke");

  console.log("— 5. second raffle: revoked H blocked");
  const now2 = (await provider.getBlock("latest")).timestamp;
  const c2 = await send(deployer, provider, apps.address, enc(appsC, "createRaffle", ["v4trial2", now2 - 10, now2 + 3600, 1, ethers.ZeroAddress, 0n, BIND_COND, ""]), 0n, 1500000n);
  const rc2 = await rpc(READ_RPC, "eth_getTransactionReceipt", [c2.hash]);
  const created2 = rc2.logs.map(l => { try { return appsC.interface.parseLog({ topics: l.topics, data: l.data }); } catch { return null; } }).find(e => e && e.name === "CampaignCreated");
  const eH2 = await replayError(provider, appsC.interface, H.address, apps.address, enc(appsC, "enterRaffle", [created2.args.id, [], []]));
  if (!/^ConditionFailed\(0\)/.test(eH2 || "")) throw new Error("revoked H entry: expected ConditionFailed(0), got " + eH2);
  console.log("  PASS revoked H blocked:", eH2);

  console.log("— 6. H re-register after revocation -> CooldownActive");
  const eCool2 = await replayError(provider, bindC.interface, H.address, bind.address, enc(bindC, "registerSelf", ["trialholder", TWEET_ID + 2n]));
  if (!/^CooldownActive/.test(eCool2 || "")) throw new Error("expected CooldownActive after revoke, got " + eCool2);
  console.log("  PASS cooldown survives revocation:", eCool2);

  const record = {
    network: "bsc-testnet", chainId: 97,
    mockRegistryV2: mock.address, gate: gate.address,
    bindingsV4: bind.address, campaignsV11onV4: apps.address,
    registrar: deployer.address,
    trial: "registerSelf/proofRef/condition0/cooldown/revoke/cooldown-after-revoke all PASS",
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(__dirname, "..", "bindings-v4-address.json"), JSON.stringify(record, null, 2));
  console.log("ALL LIVE TRIAL CHECKS PASS — record written to bindings-v4-address.json");
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
