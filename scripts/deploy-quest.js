// Deploy QuestPass (expedition season) on BSC testnet for a compressed
// rehearsal season: starts ~2 minutes after deploy, 3 slots/day,
// dayPool 0.0021 tBNB/day, minStamps 2 (rehearsal only), 2 winners,
// finale pool 0.003 tBNB, entry window 1 hour. Mainnet parameters
// (7 days, minStamps 5, USDC pools) are set at the mainnet deploy. Raw-sign +
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

async function attempt(wallet, provider, gasPrice, deployData, runtimeBytes, value = 0n) {
  const nonce = await provider.getTransactionCount(wallet.address, "pending");
  console.log("  attempt with pending nonce:", nonce);
  const tx = { to: null, data: deployData, value, nonce, gasLimit: 3000000n, gasPrice, chainId: 97, type: 0 };
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

  const { abi, bytecode, runtimeBytes } = artifact("QuestPass");
  const GATE_TESTNET = "0x4858c1c6a4428c65ee6f60aac21a3f404d85d598";
  const now = Math.floor(Date.now() / 1000);
  // Rehearsal season (testnet only): starts in ~2 minutes, compressed
  // finale eligibility (minStamps 2), entry window 1 hour. The 7 stamp
  // days stay real days; the trial only exercises day 0 + finale logic
  // via a second short config below if needed.
  const args = [
    GATE_TESTNET,
    ethers.ZeroAddress,               // BNB pools
    now + 120,                        // startAt
    3,                                // slotsPerDay
    ethers.parseEther("0.0021"),      // dayPool
    2,                                // minStamps (rehearsal)
    2,                                // winnerCount
    ethers.parseEther("0.003"),       // finalePool
    3600,                             // entryWindow (1 hour, rehearsal)
  ];
  const total = ethers.parseEther("0.0021") * 7n + ethers.parseEther("0.003");
  const bal = await provider.getBalance(wallet.address);
  if (bal < total + ethers.parseEther("0.002")) throw new Error("deployer tBNB too low for escrow + gas");
  const factory = new ethers.ContractFactory(abi, bytecode);
  const deployTx = await factory.getDeployTransaction(...args, { value: total });
  console.log(`deploying QuestPass (escrow ${ethers.formatEther(total)} tBNB): expect runtime ${runtimeBytes} bytes`);

  let out;
  try {
    out = await attempt(wallet, provider, gasPrice, deployTx.data, runtimeBytes, total);
  } catch (e) {
    if (!/nonce too low/i.test(e.message)) throw e;
    console.log("  nonce too low — refetching pending nonce and retrying once");
    out = await attempt(wallet, provider, gasPrice, deployTx.data, runtimeBytes, total);
  }

  const c = new ethers.Contract(out.addr, abi, provider);
  console.log("  phase:", (await c.phase()).toString(), "startAt:", (await c.startAt()).toString(), "stampPool:", ethers.formatEther(await c.stampPool()), "prizePerWinner:", ethers.formatEther(await c.prizePerWinner()));
  fs.writeFileSync(path.join(__dirname, "..", "quest-address.json"), JSON.stringify({ quest: out.addr, tx: out.hash, questBlock: out.block, rehearsal: { startAt: args[2], slotsPerDay: 3, dayPool: "0.0021", minStamps: 2, winnerCount: 2, finalePool: "0.003", entryWindow: 3600 } }, null, 2));
  console.log("saved quest-address.json");
}
main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
