// Deploy OneIDCampaignsV9 on BSC testnet against the existing BeCounted
// (0x0cb41f96c84df7bed5db273e77b62414b1a80cbd). Raw-sign + multi-endpoint
// broadcast, with runtime-size and live-call verification (same approach
// as deploy-rest.js, which worked).
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const READ_RPC = "https://bsc-testnet-rpc.publicnode.com";
const SEND_RPCS = [
  "https://bsc-testnet-rpc.publicnode.com",
  "https://bnb-testnet.api.onfinality.io/public",
  "https://bsc-testnet.publicnode.com",
];
const GATE = "0x0cb41f96c84df7bed5db273e77b62414b1a80cbd";
const BINDINGS = "0x6e17c5ddc3be1cb4443b6cbb64c1b520fd80d5f2";

function artifact(name) {
  const p = path.join(__dirname, "..", "artifacts", "contracts", name + ".sol", name + ".json");
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

async function main() {
  const key = fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim();
  const wallet = new ethers.Wallet(key);
  const provider = new ethers.JsonRpcProvider(READ_RPC, 97, { staticNetwork: true });
  console.log("deployer:", wallet.address, "balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "tBNB");
  const gasPrice = (await provider.getFeeData()).gasPrice ?? 1000000000n;

  async function deploy(name, args) {
    const { abi, bytecode, runtimeBytes } = artifact(name);
    const factory = new ethers.ContractFactory(abi, bytecode);
    const deployTx = await factory.getDeployTransaction(...args);
    const nonce = await provider.getTransactionCount(wallet.address, "latest");
    console.log(`deploying ${name}: expect runtime ${runtimeBytes} bytes, nonce ${nonce}`);
    const tx = { to: null, data: deployTx.data, nonce, gasLimit: 5000000n, gasPrice, chainId: 97, type: 0 };
    const raw = await wallet.signTransaction(tx);
    const hash = await broadcast(raw);
    console.log("  tx:", hash);
    const rc = await waitReceipt(hash);
    if (rc.status !== "0x1") throw new Error(name + " deploy reverted");
    const code = await provider.getCode(rc.contractAddress);
    console.log("  address:", rc.contractAddress, "runtime bytes:", (code.length - 2) / 2, "block:", parseInt(rc.blockNumber, 16));
    if ((code.length - 2) / 2 !== runtimeBytes) throw new Error("runtime size mismatch");
    return { address: rc.contractAddress, tx: hash, block: parseInt(rc.blockNumber, 16) };
  }

  const b = await deploy("IdentityBindingsV2", []);
  const reg = await new ethers.Contract(b.address, artifact("IdentityBindingsV2").abi, provider).registrar();
  console.log("registrar:", reg, reg.toLowerCase() === wallet.address.toLowerCase() ? "(deployer OK)" : "(MISMATCH!)");
  const a = await deploy("OneIDCampaignsV9", [GATE, b.address]);
  const appsC = new ethers.Contract(a.address, artifact("OneIDCampaignsV9").abi, provider);
  console.log("apps.bindings():", await appsC.bindings());
  console.log("apps.campaignCount:", (await appsC.campaignCount()).toString());
  fs.writeFileSync(path.join(__dirname, "..", "bindings-v2-address.json"), JSON.stringify({ bindingsV2: b.address, bindingsV2Tx: b.tx, bindingsV2Block: b.block, appsV9b: a.address, appsV9bTx: a.tx, appsV9bBlock: a.block, gate: GATE }, null, 2));
  console.log("recorded to bindings-v2-address.json");
}
main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
