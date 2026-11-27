// Deploy OneIDCampaignsV2 on BSC testnet against the existing BeCounted
// (0x4858c1c6a4428c65ee6f60aac21a3f404d85d598). Raw-sign + multi-endpoint
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
const GATE = "0x4858c1c6a4428c65ee6f60aac21a3f404d85d598";

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
  let nonce = await provider.getTransactionCount(wallet.address, "latest");
  console.log("deployer:", wallet.address, "nonce:", nonce, "balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "tBNB");
  const gasPrice = (await provider.getFeeData()).gasPrice ?? 1000000000n;

  const { abi, bytecode, runtimeBytes } = artifact("OneIDCampaignsV2");
  const factory = new ethers.ContractFactory(abi, bytecode);
  const deployTx = await factory.getDeployTransaction(GATE);
  console.log(`deploying OneIDCampaignsV2: expect runtime ${runtimeBytes} bytes`);
  const tx = { to: null, data: deployTx.data, nonce, gasLimit: 5000000n, gasPrice, chainId: 97, type: 0 };
  const raw = await wallet.signTransaction(tx);
  const hash = await broadcast(raw);
  console.log("  tx:", hash);
  const rc = await waitReceipt(hash);
  if (rc.status !== "0x1") throw new Error("deploy reverted");
  const addr = rc.contractAddress;
  const code = await provider.getCode(addr);
  console.log("  address:", addr, "runtime bytes:", (code.length - 2) / 2);
  if ((code.length - 2) / 2 !== runtimeBytes) throw new Error("runtime size mismatch");
  const c = new ethers.Contract(addr, abi, provider);
  console.log("  gate():", await c.gate());
  console.log("  campaignCount():", (await c.campaignCount()).toString());
  fs.writeFileSync(path.join(__dirname, "..", "v2-address.json"), JSON.stringify({ appsV2: addr, gate: GATE, tx: hash }, null, 2));
  console.log("saved v2-address.json");
}
main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
