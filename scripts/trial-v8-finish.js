// trial-v8-finish.js — finish Part B of the V8 live trial: draw the
// labelled prize vote (id 1) now that its seed block has passed, and
// have the winner claim. (The first run's draw was attempted before
// block.number passed the seed block — a trial-script timing bug,
// not a contract issue.)
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const READ_RPC = "https://bsc-testnet-rpc.publicnode.com";
const SEND_RPCS = [
  "https://bsc-testnet-rpc.publicnode.com",
  "https://bnb-testnet.api.onfinality.io/public",
  "https://bsc-testnet.publicnode.com",
];
const APPS = "0xc1673134d18ac881bd4c61ecf82e5e35a32c9a56";
const ID = 1;

function artifact(name) {
  const p = path.join(__dirname, "..", "artifacts", "contracts", name + ".sol", name + ".json");
  return JSON.parse(fs.readFileSync(p, "utf8")).abi;
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
    try { return await rpc(url, "eth_sendRawTransaction", [raw]); }
    catch (e) { last = e; if (/already known/i.test(e.message)) return ethers.keccak256(raw); if (/nonce too low/i.test(e.message)) throw e; }
  }
  throw last ?? new Error("broadcast failed");
}
async function waitReceipt(hash) {
  for (let i = 0; i < 40; i++) { const rc = await rpc(READ_RPC, "eth_getTransactionReceipt", [hash]); if (rc) return rc; await new Promise(r => setTimeout(r, 3000)); }
  throw new Error("receipt timeout " + hash);
}
const provider = new ethers.JsonRpcProvider(READ_RPC, 97, { staticNetwork: true });
async function send(wallet, to, data, value = 0n, gasLimit = 600000n) {
  const nonce = await provider.getTransactionCount(wallet.address, "pending");
  const gasPrice = 1000000000n;
  const raw = await wallet.signTransaction({ to, data, value, nonce, gasLimit, gasPrice, chainId: 97, type: 0 });
  const hash = await broadcast(raw);
  const rc = await waitReceipt(hash);
  if (rc.status !== "0x1") throw new Error("tx reverted: " + hash);
  return rc;
}

async function main() {
  const abi = artifact("OneIDCampaignsV8");
  const iface = new ethers.Interface(abi);
  const read = new ethers.Contract(APPS, abi, provider);
  const dkey = fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim();
  const deployer = new ethers.Wallet(dkey);
  const proofKeys = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "keys", "vote-proof-wallets.json"), "utf8"));
  const w1 = new ethers.Wallet(proofKeys.wallet1);

  const before0 = await read.getCampaign(ID);
  const blk = await provider.getBlockNumber();
  console.log("campaign:", "endAt", before0.endAt.toString(), "seedBlock", before0.seedBlock.toString(), "drawn", before0.drawn, "| current block", blk);
  if (before0.drawn) throw new Error("already drawn?");
  await send(deployer, APPS, iface.encodeFunctionData("draw", [ID]));
  const c = await read.getCampaign(ID);
  const pool = ethers.parseEther("0.001");
  if (!c.drawn) throw new Error("not drawn");
  if (c.prizePerWinner !== pool) throw new Error("prizePerWinner " + c.prizePerWinner);
  console.log("drawn OK, usedFallbackSeed:", c.usedFallbackSeed);
  const winners = await read.getWinners(ID);
  if (winners.length !== 1) throw new Error("winners " + winners.length);
  const w = winners[0].toLowerCase() === deployer.address.toLowerCase() ? deployer : w1;
  const before = await provider.getBalance(w.address);
  const rcClaim = await send(w, APPS, iface.encodeFunctionData("claimPrize", [ID]), 0n, 300000n);
  const gasCost = BigInt(rcClaim.gasUsed) * 1000000000n;
  const after = await provider.getBalance(w.address);
  if (after - before + gasCost !== pool) throw new Error("claim delta mismatch");
  const labels = await read.optionLabelsOf(ID);
  if (JSON.stringify(labels) !== JSON.stringify(["红方", "蓝方"])) throw new Error("labels mismatch " + JSON.stringify(labels));
  console.log("B OK: prize vote drawn, sole winner claimed 0.001 tBNB, labels intact");
  console.log("TRIAL V8 PART B DONE");
}

main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
