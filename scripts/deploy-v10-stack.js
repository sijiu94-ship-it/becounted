// Deploy + live-trial the OneIDCampaignsV10 trial stack on BSC testnet.
// INDEPENDENT stack — does not touch the existing demo stack (apps 0x9dac…):
//   MockRegistryV2 (has handleOf) -> BeCounted gate -> OneIDCampaignsV10
// Trial: a condition-5 (Agent ID allowlist) raffle whose identity list is
// ["trialone", "questfan"]; w1 holds "trialone" and must get in; w2 holds
// "trialtwo" (not listed) and a fresh handle-less wallet w3 must both be
// rejected with ConditionFailed(5).
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
const BINDINGS_V2 = "0x3b5a6cd4ae21cf100da21197a58be6d6d406f843";
const ID_LIST_HANDLES = ["trialone", "questfan"];

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
  return { hash, block: parseInt(rc.blockNumber, 16), status: rc.status };
}
async function deploy(wallet, provider, name, sub, args) {
  const { abi, bytecode, runtimeBytes } = artifact(name, sub);
  const factory = new ethers.ContractFactory(abi, bytecode);
  const deployTx = await factory.getDeployTransaction(...args);
  console.log(`deploying ${name}: expect runtime ${runtimeBytes} bytes`);
  const r = await send(wallet, provider, null, deployTx.data, 0n, 5000000n);
  if (r.status !== "0x1") throw new Error(name + " deploy reverted: " + r.hash);
  // contract address = CREATE(wallet, nonce used) — recompute from receipt via tx lookup
  const txObj = await provider.getTransaction(r.hash);
  const addr = ethers.getCreateAddress({ from: wallet.address, nonce: txObj.nonce });
  const code = await provider.getCode(addr);
  console.log("  address:", addr, "runtime bytes:", (code.length - 2) / 2, "block:", r.block);
  if ((code.length - 2) / 2 !== runtimeBytes) throw new Error(name + " runtime size mismatch");
  return { address: addr, tx: r.hash, block: r.block, abi };
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

async function main() {
  const provider = new ethers.JsonRpcProvider(READ_RPC, 97, { staticNetwork: true });
  const deployer = new ethers.Wallet(fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim());
  const wp = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "keys", "vote-proof-wallets.json"), "utf8"));
  const w1 = new ethers.Wallet(wp.wallet1.privateKey || wp.wallet1.key || wp.wallet1);
  const w2 = new ethers.Wallet(wp.wallet2.privateKey || wp.wallet2.key || wp.wallet2);
  // fresh handle-less trial wallet (persisted under keys/, git-ignored)
  const w3Path = path.join(__dirname, "..", "keys", "v10-trial-wallet.json");
  let w3;
  if (fs.existsSync(w3Path)) { w3 = new ethers.Wallet(JSON.parse(fs.readFileSync(w3Path, "utf8")).privateKey); }
  else { w3 = ethers.Wallet.createRandom(); fs.writeFileSync(w3Path, JSON.stringify({ privateKey: w3.privateKey, address: w3.address }, null, 2)); }
  console.log("deployer:", deployer.address, "tBNB:", ethers.formatEther(await provider.getBalance(deployer.address)));
  console.log("w1:", w1.address, "| w2:", w2.address, "| w3 (handle-less):", w3.address);

  const out = { network: "bsc-testnet", date: new Date().toISOString() };

  // 1) trial stack
  const mock = await deploy(deployer, provider, "MockRegistryV2", "mocks", []);
  out.mockRegistryV2 = mock.address; out.mockRegistryV2Tx = mock.tx; out.mockRegistryV2Block = mock.block;
  const gate = await deploy(deployer, provider, "BeCounted", "", [mock.address]);
  out.gateV10 = gate.address; out.gateV10Tx = gate.tx; out.gateV10Block = gate.block;
  const apps = await deploy(deployer, provider, "OneIDCampaignsV10", "", [gate.address, BINDINGS_V2]);
  out.appsV10 = apps.address; out.appsV10Tx = apps.tx; out.appsV10Block = apps.block;
  out.bindings = BINDINGS_V2;

  const mockC = new ethers.Contract(mock.address, mock.abi, provider);
  const appsC = new ethers.Contract(apps.address, apps.abi, provider);
  console.log("apps.idRegistry():", await appsC.idRegistry());
  if ((await appsC.idRegistry()).toLowerCase() !== mock.address.toLowerCase()) throw new Error("idRegistry != mock registry");

  // 2) identities: w1 -> "trialone" (listed), w2 -> "trialtwo" (NOT listed), w3 -> issued, no handle
  let r = await send(w1, provider, mock.address, mockC.interface.encodeFunctionData("registerHandle", ["trialone"]));
  out.w1RegisterHandleTx = r.hash; console.log("w1 registerHandle(trialone):", r.hash, r.status);
  r = await send(w2, provider, mock.address, mockC.interface.encodeFunctionData("registerHandle", ["trialtwo"]));
  out.w2RegisterHandleTx = r.hash; console.log("w2 registerHandle(trialtwo):", r.hash, r.status);
  r = await send(deployer, provider, mock.address, mockC.interface.encodeFunctionData("issue", [w3.address]));
  out.w3IssueTx = r.hash; console.log("issue(w3, no handle):", r.hash, r.status);
  if ((await provider.getBalance(w3.address)) === 0n) {
    r = await send(deployer, provider, w3.address, "0x", ethers.parseEther("0.001"));
    out.w3FundTx = r.hash; console.log("fund w3:", r.hash, r.status);
  }
  console.log("handleOf(w1):", await mockC.handleOf(w1.address), "| handleOf(w2):", await mockC.handleOf(w2.address), "| handleOf(w3):", JSON.stringify(await mockC.handleOf(w3.address)));
  const gateC = new ethers.Contract(gate.address, gate.abi, provider);
  console.log("isHuman w1/w2/w3:", await gateC.isHuman(w1.address), await gateC.isHuman(w2.address), await gateC.isHuman(w3.address));

  // 3) condition-5 raffle
  const { root, proof } = idRootAndProof(ID_LIST_HANDLES, "trialone");
  out.idListHandles = ID_LIST_HANDLES; out.idListRoot = root; out.w1IdProof = proof;
  const now = (await provider.getBlock("latest")).timestamp;
  const blk = await provider.getBlockNumber();
  const cond = [false, ethers.ZeroAddress, 0n, false, ethers.MaxUint256, 0, ethers.ZeroAddress, ethers.ZeroHash, root];
  r = await send(deployer, provider, apps.address, appsC.interface.encodeFunctionData("createRaffle",
    ["V10 condition-5 trial raffle", now - 60, now + 3600, 1, blk + 1000, ethers.ZeroAddress, 0n, cond, ""]), 0n, 1000000n);
  if (r.status !== "0x1") throw new Error("createRaffle reverted: " + r.hash);
  out.createRaffleTx = r.hash; out.createRaffleBlock = r.block;
  const rcTx = await provider.getTransactionReceipt(r.hash);
  const ev = rcTx.logs.map(l => { try { return appsC.interface.parseLog(l); } catch { return null; } }).find(e => e && e.name === "CampaignCreated");
  const id = Number(ev.args.id); out.campaignId = id;
  const cd = await appsC.conditionsOf(id);
  console.log("campaign", id, "idListRoot on-chain:", cd.idListRoot, "match:", cd.idListRoot === root);
  if (cd.idListRoot !== root) throw new Error("idListRoot mismatch");

  // 4) w1 (listed handle) enters — must succeed
  r = await send(w1, provider, apps.address, appsC.interface.encodeFunctionData("enterRaffle", [id, [], proof]));
  out.w1EnterTx = r.hash; out.w1EnterBlock = r.block;
  console.log("w1 enterRaffle:", r.hash, "status:", r.status);
  if (r.status !== "0x1") throw new Error("w1 entry FAILED");
  console.log("hasEntered(w1):", await appsC.hasEntered(id, w1.address));

  // 5) w2 (unlisted handle) + w3 (no handle) enter — must revert ConditionFailed(5)
  for (const [name, w] of [["w2", w2], ["w3", w3]]) {
    const data = appsC.interface.encodeFunctionData("enterRaffle", [id, [], []]);
    // decode the revert reason via eth_call replay first
    let reason = null;
    try {
      await provider.call({ from: w.address, to: apps.address, data });
    } catch (e) {
      const raw = e.data || (e.info && e.info.error && e.info.error.data);
      if (raw) { const p = appsC.interface.parseError(raw); reason = p ? `${p.name}(${p.args.join(",")})` : raw; }
      else reason = String(e.message).slice(0, 120);
    }
    const rr = await send(w, provider, apps.address, data);
    console.log(`${name} enterRaffle:`, rr.hash, "status:", rr.status, "| revert reason:", reason);
    out[name + "EnterTx"] = rr.hash; out[name + "EnterStatus"] = rr.status; out[name + "RevertReason"] = reason;
    if (rr.status !== "0x0") throw new Error(name + " entry should have reverted");
    console.log(`hasEntered(${name}):`, await appsC.hasEntered(id, w.address));
    if (await appsC.hasEntered(id, w.address)) throw new Error(name + " must not be marked entered");
  }

  out.trialResult = "w1 (listed handle 'trialone') entered; w2 (unlisted handle 'trialtwo') and w3 (no handle) rejected with ConditionFailed(5); entries not consumed";
  fs.writeFileSync(path.join(__dirname, "..", "v10-address.json"), JSON.stringify(out, null, 2));
  console.log("saved v10-address.json");
}
main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
