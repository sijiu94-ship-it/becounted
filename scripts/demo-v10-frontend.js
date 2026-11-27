// Supplement the V10 trial stack with frontend demo content:
//   id 1 — plain vote with on-chain option labels (7-day window)
//   id 2 — fixed claim drop, 0.003 tBNB pool / 3 claims (7-day window)
//   id 3 — fresh condition-5 (Agent ID allowlist) raffle reusing the
//          phase-1 identity list ["trialone", "questfan"] (7-day window;
//          the phase-1 trial raffle id 0 only ran for 1 hour)
// Writes v10-demo-frontend.json. Raw-sign + multi-endpoint broadcast,
// same pattern as deploy-v10-stack.js. Deployer key never printed.
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
const APPS = "0x5c6bd30ead292b97e910d761209736A440f4bA3e";
const MAXU = ethers.MaxUint256;
const NO_COND = [false, ethers.ZeroAddress, 0n, false, MAXU, 0, ethers.ZeroAddress, ethers.ZeroHash, ethers.ZeroHash];

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
async function send(wallet, provider, to, data, value = 0n, gasLimit = 1500000n) {
  const nonce = await provider.getTransactionCount(wallet.address, "pending");
  const tx = { to, data, value, nonce, gasLimit, gasPrice: GAS_PRICE, chainId: 97, type: 0 };
  const raw = await wallet.signTransaction(tx);
  const hash = await broadcast(raw);
  const rc = await waitReceipt(hash);
  if (rc.status !== "0x1") throw new Error("tx reverted: " + hash);
  return { hash, block: parseInt(rc.blockNumber, 16) };
}

async function main() {
  const provider = new ethers.JsonRpcProvider(READ_RPC, 97, { staticNetwork: true });
  const deployer = new ethers.Wallet(fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim());
  const apps = new ethers.Contract(APPS, artifact("OneIDCampaignsV10"), provider);
  const trial = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "v10-address.json"), "utf8"));
  console.log("deployer:", deployer.address, "tBNB:", ethers.formatEther(await provider.getBalance(deployer.address)));
  console.log("apps.campaignCount before:", (await apps.campaignCount()).toString());

  const now = (await provider.getBlock("latest")).timestamp;
  const blk = await provider.getBlockNumber();
  const start = now - 60, end = now + 7 * 86400;
  const out = { network: "bsc-testnet", date: new Date().toISOString(), apps: APPS, campaigns: [] };

  async function createdId(txPromise) {
    const r = await txPromise;
    const rcTx = await provider.getTransactionReceipt(r.hash);
    const ev = rcTx.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } }).find(e => e && e.name === "CampaignCreated");
    return { id: Number(ev.args.id), ...r };
  }

  // id 1 — plain vote with labels
  let c = await createdId(send(deployer, provider, APPS,
    apps.interface.encodeFunctionData("createVote", ["Demo vote — 前端演示 (V10)", start, end, 2, ethers.ZeroAddress, 0n, 0, 0, NO_COND, ["Option A 选项甲", "Option B 选项乙"]])));
  out.campaigns.push({ kind: "vote", ...c }); console.log("vote:", JSON.stringify(c));

  // id 2 — fixed claim drop, 0.003 tBNB / 3 claims
  c = await createdId(send(deployer, provider, APPS,
    apps.interface.encodeFunctionData("createClaim", ["Demo claim — 前端演示 (V10)", start, end, 3, ethers.ZeroAddress, ethers.parseEther("0.003"), false, NO_COND]),
    ethers.parseEther("0.003")));
  out.campaigns.push({ kind: "claim", ...c }); console.log("claim:", JSON.stringify(c));

  // id 3 — fresh condition-5 raffle (long window), same identity list/root as phase 1
  const cond5 = [...NO_COND.slice(0, 8), trial.idListRoot];
  c = await createdId(send(deployer, provider, APPS,
    apps.interface.encodeFunctionData("createRaffle", ["V10 condition-5 demo raffle — Agent ID 名单抽奖", start, end, 1, blk + 1400000, ethers.ZeroAddress, 0n, cond5, ""])));
  out.campaigns.push({ kind: "raffle-cond5", idListHandles: trial.idListHandles, idListRoot: trial.idListRoot, ...c });
  console.log("raffle-cond5:", JSON.stringify(c));
  const cd = await apps.conditionsOf(c.id);
  console.log("on-chain idListRoot match:", cd.idListRoot === trial.idListRoot);
  if (cd.idListRoot !== trial.idListRoot) throw new Error("idListRoot mismatch");

  console.log("apps.campaignCount after:", (await apps.campaignCount()).toString());
  fs.writeFileSync(path.join(__dirname, "..", "v10-demo-frontend.json"), JSON.stringify(out, null, 2));
  console.log("saved v10-demo-frontend.json");
}
main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
