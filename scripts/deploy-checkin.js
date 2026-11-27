// Deploy CheckIn (daily check-in + 30-day activity weight) on BSC testnet,
// wired to the existing V11 trial stack's gate:
//   gateV11 0x2464F16146EA45C8b30fe3FED5E8f536C5344296 (BeCounted over
//   MockRegistryV2 — testnet only, the real registry is mainnet-only).
// Deployment is followed by READ-ONLY verification only (fresh-address
// weightOf == 1, totalCheckInsOf == 0, gate() wired, runtime size exact);
// no check-in is sent from this script.
// Writes checkin-address.json. Deployer key is read from keys/ and
// never printed.
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
const GATE_V11 = "0x2464F16146EA45C8b30fe3FED5E8f536C5344296";

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
  console.log("deployer:", deployer.address);
  const bal = await provider.getBalance(deployer.address);
  console.log("tBNB balance:", ethers.formatEther(bal));
  if (bal === 0n) throw new Error("deployer has no tBNB");

  // Pre-flight: the V11 gate must be live and answering on testnet.
  const gateCode = await provider.getCode(GATE_V11);
  if (gateCode === "0x") throw new Error("gate has no code on testnet: " + GATE_V11);
  const gateC = new ethers.Contract(GATE_V11, ["function isHuman(address) view returns (bool)"], provider);
  await gateC.isHuman(deployer.address);
  console.log("gate pre-flight OK:", GATE_V11, "code bytes:", (gateCode.length - 2) / 2);

  const { abi, bytecode, runtimeBytes } = artifact("CheckIn");
  const factory = new ethers.ContractFactory(abi, bytecode);
  const deployTx = await factory.getDeployTransaction(GATE_V11);
  console.log(`deploying CheckIn: expect runtime ${runtimeBytes} bytes`);
  const r = await send(deployer, provider, null, deployTx.data, 0n, 2000000n);
  if (r.status !== "0x1") throw new Error("CheckIn deploy reverted: " + r.hash);
  const txObj = await provider.getTransaction(r.hash);
  const addr = ethers.getCreateAddress({ from: deployer.address, nonce: txObj.nonce });
  console.log("  address:", addr, "block:", r.block, "gasUsed:", r.gasUsed);

  // Read-only verification. Public read replicas can lag a fresh deploy,
  // so poll until the code shows up before asserting anything.
  let code = "0x";
  for (let i = 0; i < 20 && code === "0x"; i++) { code = await provider.getCode(addr); if (code === "0x") await sleep(3000); }
  if (code === "0x") throw new Error("deployed code not visible on read RPC after polling");
  const liveRuntime = (code.length - 2) / 2;
  console.log("  live runtime bytes:", liveRuntime);
  if (liveRuntime !== runtimeBytes) throw new Error("runtime size mismatch");

  const ci = new ethers.Contract(addr, abi, provider);
  const wiredGate = await ci.gate();
  if (wiredGate.toLowerCase() !== GATE_V11.toLowerCase()) throw new Error("gate wiring mismatch: " + wiredGate);
  // Fresh, never-checked-in addresses: the deployer itself (it has not
  // checked in — this script sends no check-in) and a random address.
  const fresh = ethers.Wallet.createRandom().address;
  const checks = {
    gate: wiredGate,
    weightOfFreshRandom: Number(await ci.weightOf(fresh)),
    totalCheckInsFreshRandom: Number(await ci.totalCheckInsOf(fresh)),
    weightOfDeployer: Number(await ci.weightOf(deployer.address)),
    totalCheckInsDeployer: Number(await ci.totalCheckInsOf(deployer.address)),
    windowDays: Number(await ci.WINDOW_DAYS()),
    todayIndex: Number(await ci.todayIndex()),
  };
  console.log("read-only verification:", JSON.stringify(checks));
  if (checks.weightOfFreshRandom !== 1 || checks.totalCheckInsFreshRandom !== 0) throw new Error("fresh-address invariant failed");
  if (checks.weightOfDeployer !== 1 || checks.totalCheckInsDeployer !== 0) throw new Error("deployer invariant failed");
  if (checks.windowDays !== 30 || checks.todayIndex <= 0) throw new Error("constant/index sanity failed");

  const record = {
    network: "bsc-testnet",
    chainId: 97,
    date: new Date().toISOString(),
    contract: "CheckIn",
    checkIn: addr,
    checkInTx: r.hash,
    checkInBlock: r.block,
    deployGasUsed: r.gasUsed,
    runtimeBytes: liveRuntime,
    gate: GATE_V11,
    gateStack: "V11 trial stack (BeCounted over MockRegistryV2 0xd7617CB77d5626D9131d3195776350cA69D02782) — testnet only",
    deployer: deployer.address,
    verification: checks,
    note: "Testnet trial deployment. Read-only verification only; no check-in sent. Mainnet deployment is a separate, separately-approved step.",
  };
  fs.writeFileSync(path.join(__dirname, "..", "checkin-address.json"), JSON.stringify(record, null, 2) + "\n");
  console.log("wrote checkin-address.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
