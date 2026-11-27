// Deploy IdentityProfile on BSC testnet. Standalone contract, no
// constructor args, no relation to the frozen three. Raw-sign +
// multi-endpoint broadcast (same approach as deploy-v5.js), nonce
// taken from "pending", with one retry on "nonce too low".
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const READ_RPC = "https://bsc-testnet-rpc.publicnode.com";
const SEND_RPCS = [
  "https://bsc-testnet-rpc.publicnode.com",
  "https://bnb-testnet.api.onfinality.io/public",
  "https://bsc-testnet.publicnode.com",
];

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
    catch (e) { last = e; console.log("  send issue via", url, "-", e.message.slice(0, 100)); if (/already known/i.test(e.message)) return ethers.keccak256(raw); if (/nonce too low/i.test(e.message)) throw e; }
  }
  throw last ?? new Error("broadcast failed");
}
async function waitReceipt(hash) {
  for (let i = 0; i < 40; i++) { const rc = await rpc(READ_RPC, "eth_getTransactionReceipt", [hash]); if (rc) return rc; await new Promise(r => setTimeout(r, 3000)); }
  throw new Error("receipt timeout " + hash);
}

async function attempt(wallet, provider, gasPrice, deployData, runtimeBytes) {
  const nonce = await provider.getTransactionCount(wallet.address, "pending");
  console.log("  attempt with pending nonce:", nonce);
  const tx = { to: null, data: deployData, nonce, gasLimit: 3000000n, gasPrice, chainId: 97, type: 0 };
  const raw = await wallet.signTransaction(tx);
  const hash = await broadcast(raw);
  console.log("  tx:", hash);
  const rc = await waitReceipt(hash);
  if (rc.status !== "0x1") throw new Error("deploy reverted");
  const addr = rc.contractAddress;
  const code = await provider.getCode(addr);
  console.log("  address:", addr, "runtime bytes:", (code.length - 2) / 2, "block:", parseInt(rc.blockNumber, 16));
  if ((code.length - 2) / 2 !== runtimeBytes) throw new Error("runtime size mismatch");
  return { addr, hash, block: parseInt(rc.blockNumber, 16) };
}

async function main() {
  const key = fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim();
  const wallet = new ethers.Wallet(key);
  const provider = new ethers.JsonRpcProvider(READ_RPC, 97, { staticNetwork: true });
  console.log("deployer:", wallet.address, "balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "tBNB");
  const gasPrice = (await provider.getFeeData()).gasPrice ?? 1000000000n;

  const { abi, bytecode, runtimeBytes } = artifact("IdentityProfile");
  const factory = new ethers.ContractFactory(abi, bytecode);
  const deployTx = await factory.getDeployTransaction();
  console.log(`deploying IdentityProfile: expect runtime ${runtimeBytes} bytes`);

  let out;
  try {
    out = await attempt(wallet, provider, gasPrice, deployTx.data, runtimeBytes);
  } catch (e) {
    if (!/nonce too low/i.test(e.message)) throw e;
    console.log("  nonce too low — refetching pending nonce and retrying once");
    out = await attempt(wallet, provider, gasPrice, deployTx.data, runtimeBytes);
  }

  const c = new ethers.Contract(out.addr, abi, provider);
  const [bio, links, updatedAt] = await c.profileOf(wallet.address);
  console.log("  profileOf(deployer): bio=", JSON.stringify(bio), "links=", links.length, "updatedAt=", updatedAt.toString());
  fs.writeFileSync(path.join(__dirname, "..", "profile-address.json"), JSON.stringify({ profile: out.addr, tx: out.hash, profileBlock: out.block }, null, 2));
  console.log("saved profile-address.json");
}
main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
