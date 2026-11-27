// Deploy the renamed BeCounted stack on BSC testnet:
//   BeCounted (gate, reads the mock registry) -> IdentityBindings ->
//   OneIDCampaignsV8 -> QuestPass (rehearsal season) -> GatedClaim demo.
// Raw-sign + multi-endpoint broadcast, pending nonce, pinned 1 gwei
// (same approach as deploy-v8.js / deploy-quest.js / deploy-template.js).
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const READ_RPC = "https://bsc-testnet-rpc.publicnode.com";
const SEND_RPCS = [
  "https://bsc-testnet-rpc.publicnode.com",
  "https://bnb-testnet.api.onfinality.io/public",
  "https://bsc-testnet.publicnode.com",
];
const MOCK_REGISTRY = "0xdA585A4aE5b73Ee2728AadA3e877A3A1F84027cd";
const GAS_PRICE = 1000000000n;

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
    catch (e) { last = e; console.log("  send issue via", url, "-", e.message.slice(0, 100)); if (/already known/i.test(e.message)) return ethers.keccak256(raw); if (/nonce too low/i.test(e.message)) throw e; }
  }
  throw last ?? new Error("broadcast failed");
}
async function waitReceipt(hash) {
  for (let i = 0; i < 40; i++) { const rc = await rpc(READ_RPC, "eth_getTransactionReceipt", [hash]); if (rc) return rc; await new Promise(r => setTimeout(r, 3000)); }
  throw new Error("receipt timeout " + hash);
}
async function sendTx(wallet, provider, txFields) {
  const nonce = await provider.getTransactionCount(wallet.address, "pending");
  const tx = { nonce, gasPrice: GAS_PRICE, chainId: 97, type: 0, gasLimit: 300000n, value: 0n, ...txFields };
  const raw = await wallet.signTransaction(tx);
  const hash = await broadcast(raw);
  const rc = await waitReceipt(hash);
  if (rc.status !== "0x1") throw new Error("tx reverted: " + hash);
  return { hash, block: parseInt(rc.blockNumber, 16) };
}
async function deploy(wallet, provider, name, args, value = 0n, sub) {
  const { abi, bytecode, runtimeBytes } = artifact(name, sub);
  const factory = new ethers.ContractFactory(abi, bytecode);
  const deployTx = await factory.getDeployTransaction(...args);
  console.log("deploying", name, "...");
  const { hash, block } = await sendTx(wallet, provider, { to: null, data: deployTx.data, value, gasLimit: 6000000n });
  const rc = await rpc(READ_RPC, "eth_getTransactionReceipt", [hash]);
  const addr = rc.contractAddress;
  const code = await provider.getCode(addr);
  console.log(" ", name, "->", addr, "runtime bytes:", (code.length - 2) / 2, "block:", block, "tx:", hash);
  if ((code.length - 2) / 2 !== runtimeBytes) throw new Error("runtime size mismatch for " + name);
  return { addr, hash, block, abi };
}

async function main() {
  const key = fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim();
  const wallet = new ethers.Wallet(key);
  const provider = new ethers.JsonRpcProvider(READ_RPC, 97, { staticNetwork: true });
  console.log("deployer:", wallet.address, "balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "tBNB");

  // 1) BeCounted gate on the mock registry (skippable via env on resume)
  const gate = process.env.GATE_ADDR
    ? { addr: process.env.GATE_ADDR, hash: process.env.GATE_TX || "pre-deployed", block: Number(process.env.GATE_BLOCK || 0), abi: artifact("BeCounted").abi }
    : await deploy(wallet, provider, "BeCounted", [MOCK_REGISTRY]);
  if (process.env.GATE_ADDR) console.log("reusing gate:", gate.addr);
  const gateC = new ethers.Contract(gate.addr, gate.abi, provider);
  console.log("  registry():", await gateC.registry());
  console.log("  isHuman(deployer):", await gateC.isHuman(wallet.address));

  // 2) IdentityBindings (new "BeCounted X binding" statement)
  const bindings = process.env.BINDINGS_ADDR
    ? { addr: process.env.BINDINGS_ADDR, hash: process.env.BINDINGS_TX || "pre-deployed", block: Number(process.env.BINDINGS_BLOCK || 0), abi: artifact("IdentityBindings").abi }
    : await deploy(wallet, provider, "IdentityBindings", []);
  if (process.env.BINDINGS_ADDR) console.log("reusing bindings:", bindings.addr);
  const bindC = new ethers.Contract(bindings.addr, bindings.abi, provider);
  console.log("  statementFor sample:", JSON.stringify(await bindC.statementFor("becounted_demo", wallet.address)));

  // 3) OneIDCampaignsV8 on the new gate + bindings
  const apps = await deploy(wallet, provider, "OneIDCampaignsV8", [gate.addr, bindings.addr]);
  const appsC = new ethers.Contract(apps.addr, apps.abi, provider);
  console.log("  apps gate():", await appsC.gate());

  // 4) QuestPass rehearsal season (same params as the previous rehearsal)
  const now = Math.floor(Date.now() / 1000);
  const escrow = ethers.parseEther("0.0021") * 7n + ethers.parseEther("0.003");
  const quest = await deploy(wallet, provider, "QuestPass", [
    gate.addr, ethers.ZeroAddress, now + 120, 3, ethers.parseEther("0.0021"), 2, 2, ethers.parseEther("0.003"), 3600,
  ], escrow);
  const questC = new ethers.Contract(quest.addr, quest.abi, provider);
  console.log("  quest phase():", (await questC.phase()).toString(), "startAt:", (await questC.startAt()).toString());

  // 5) GatedClaim demo on the new gate + fund the BNB pool
  const tpl = await deploy(wallet, provider, "GatedClaim", [
    gate.addr, ethers.ZeroAddress, ethers.parseEther("0.003"), 3, now - 60, now + 7 * 86400,
  ], 0n, "templates");
  const tplC = new ethers.Contract(tpl.addr, tpl.abi, provider);
  const tplIface = new ethers.Interface(tpl.abi);
  const fund = await sendTx(wallet, provider, { to: tpl.addr, data: tplIface.encodeFunctionData("fund", []), value: ethers.parseEther("0.003"), gasLimit: 200000n });
  console.log("  GatedClaim funded:", await tplC.funded(), "fund tx:", fund.hash);

  const record = {
    gate: gate.addr, gateTx: gate.hash, gateBlock: gate.block,
    bindings: bindings.addr, bindingsTx: bindings.hash, bindingsBlock: bindings.block,
    appsV8: apps.addr, appsTx: apps.hash, appsBlock: apps.block,
    questPass: quest.addr, questTx: quest.hash, questBlock: quest.block, questStartAt: now + 120,
    gatedClaimDemo: tpl.addr, gatedClaimTx: tpl.hash, gatedClaimBlock: tpl.block,
    mockRegistry: MOCK_REGISTRY, network: "bsc-testnet", renamedFrom: "HumanGate", date: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(__dirname, "..", "becounted-stack-address.json"), JSON.stringify(record, null, 2));
  fs.writeFileSync(path.join(__dirname, "..", "v8-address.json"), JSON.stringify({ appsV8: apps.addr, gate: gate.addr, tx: apps.hash }, null, 2));
  fs.writeFileSync(path.join(__dirname, "..", "quest-address.json"), JSON.stringify({ questPass: quest.addr, gate: gate.addr, tx: quest.hash, startAt: now + 120 }, null, 2));
  fs.writeFileSync(path.join(__dirname, "..", "templates-address.json"), JSON.stringify({ gatedClaimDemo: tpl.addr, gate: gate.addr, token: ethers.ZeroAddress, pool: ethers.parseEther("0.003").toString(), maxClaims: 3, deployTx: tpl.hash, fundTx: fund.hash }, null, 2));
  console.log("STACK DEPLOYED:", JSON.stringify(record, null, 2));
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
