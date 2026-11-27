// Deploy a GatedClaim template demo instance on BSC testnet against
// the existing BeCounted (0x4858c1c6a4428c65ee6f60aac21a3f404d85d598).
// Demo drop: 0.003 tBNB pool, 3 equal shares of 0.001, window opens
// immediately and closes in 7 days. Raw-sign + multi-endpoint
// broadcast, pending-nonce fetch with one nonce-too-low retry (same
// approach as deploy-v5.js).
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
const POOL = ethers.parseEther("0.003");
const MAX_CLAIMS = 3;

function artifact() {
  const p = path.join(__dirname, "..", "artifacts", "contracts", "templates", "GatedClaim.sol", "GatedClaim.json");
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
    catch (e) { last = e; console.log("  send issue via", url, "-", e.message.slice(0, 100)); if (/nonce too low|already known/i.test(e.message)) throw e; }
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
  const balance = await provider.getBalance(wallet.address);
  console.log("deployer:", wallet.address, "balance:", ethers.formatEther(balance), "tBNB");
  if (balance < POOL + ethers.parseEther("0.001")) throw new Error("insufficient tBNB for pool + gas");
  const gasPrice = (await provider.getFeeData()).gasPrice ?? 1000000000n;

  // Send one tx, taking the pending nonce first; on nonce-too-low,
  // refetch the pending nonce and re-sign/retry exactly once.
  async function send(buildTx) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const nonce = await provider.getTransactionCount(wallet.address, "pending");
      const tx = { ...buildTx, nonce, gasPrice, chainId: 97, type: 0 };
      const raw = await wallet.signTransaction(tx);
      try {
        const hash = await broadcast(raw);
        const rc = await waitReceipt(hash);
        if (rc.status !== "0x1") throw new Error("tx reverted: " + hash);
        return { hash, rc };
      } catch (e) {
        if (attempt === 0 && /nonce too low/i.test(e.message)) { console.log("  nonce too low, retrying once with fresh pending nonce"); continue; }
        throw e;
      }
    }
    throw new Error("send failed after retry");
  }

  const { abi, bytecode, runtimeBytes } = artifact();
  const factory = new ethers.ContractFactory(abi, bytecode);
  const now = Math.floor(Date.now() / 1000);
  const deployTx = await factory.getDeployTransaction(GATE, ethers.ZeroAddress, POOL, MAX_CLAIMS, now - 60, now + 7 * 86400);
  console.log(`deploying GatedClaim demo: expect runtime ${runtimeBytes} bytes`);
  const { hash: deployHash, rc } = await send({ to: null, data: deployTx.data, gasLimit: 3000000n });
  console.log("  deploy tx:", deployHash);
  const addr = rc.contractAddress;
  const code = await provider.getCode(addr);
  console.log("  address:", addr, "runtime bytes:", (code.length - 2) / 2);
  if ((code.length - 2) / 2 !== runtimeBytes) throw new Error("runtime size mismatch");

  const drop = new ethers.Contract(addr, abi, provider);
  console.log("  gate():", await drop.gate());
  console.log("  share():", ethers.formatEther(await drop.share()), "tBNB");

  // Fund the pool (BNB path: send exactly POOL with fund()).
  const fundIface = new ethers.Interface(abi);
  const { hash: fundHash } = await send({ to: addr, data: fundIface.encodeFunctionData("fund", []), value: POOL, gasLimit: 200000n });
  console.log("  fund tx:", fundHash, "funded():", await drop.funded(), "remainingShares():", (await drop.remainingShares()).toString());

  // Live smoke test: claim once if the deployer itself passes the
  // testnet gate (it holds a mock-registry ID from earlier trials).
  const gateC = new ethers.Contract(GATE, ["function isHuman(address) view returns (bool)"], provider);
  const human = await gateC.isHuman(wallet.address);
  console.log("  deployer isHuman on testnet gate:", human);
  let claimHash = null;
  if (human) {
    const { hash } = await send({ to: addr, data: fundIface.encodeFunctionData("claim", []), gasLimit: 300000n });
    claimHash = hash;
    console.log("  claim tx:", claimHash, "claimedCount():", (await drop.claimedCount()).toString(), "deployer claimed:", await drop.claimed(wallet.address));
  }

  fs.writeFileSync(
    path.join(__dirname, "..", "templates-address.json"),
    JSON.stringify({ gatedClaimDemo: addr, gate: GATE, token: ethers.ZeroAddress, pool: POOL.toString(), maxClaims: MAX_CLAIMS, deployTx: deployHash, fundTx: fundHash, claimTx: claimHash }, null, 2)
  );
  console.log("saved templates-address.json");
}
main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
