// settle-vote-proof.js — TESTNET-ONLY live proof for scripts/settle-vote.js.
//
// Creates two fresh wallets, issues them mock Agent IDs, funds them with a
// little tBNB from the deployer, opens a short 2-option vote on
// OneIDCampaignsV5, casts 3 votes (deployer + wallet1 -> option 0,
// wallet2 -> option 1), waits for the vote to end, then runs the settle
// script and asserts: tallies 2 vs 1, minority = option 1, sole winner =
// wallet2, per-voter amount = the full test prize, dust = 0.
//
// Fresh wallet keys are persisted to keys/vote-proof-wallets.json (testnet
// throwaways, so a re-run reuses the same wallets). Never mainnet.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { ethers } = require("ethers");

const READ_RPC = "https://bsc-testnet-rpc.publicnode.com";
const SEND_RPCS = [
  "https://bsc-testnet-rpc.publicnode.com",
  "https://bnb-testnet.api.onfinality.io/public",
  "https://bsc-testnet.publicnode.com",
];
const REGISTRY = "0xdA585A4aE5b73Ee2728AadA3e877A3A1F84027cd";
const APPS = "0xfFF120c006ceB3487AD61943E4022e15cc8eb923";
const TEST_PRIZE = "15000000000000000000"; // 15e18 raw units, matches the 15 USDC launch prize shape

function artifact(name, sub) {
  const p = path.join(__dirname, "..", "artifacts", "contracts", sub ?? "", name + ".sol", name + ".json");
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
async function send(wallet, provider, to, data, value = 0n) {
  const nonce = await provider.getTransactionCount(wallet.address, "pending");
  const gasPrice = (await provider.getFeeData()).gasPrice ?? 1000000000n;
  const tx = { to, data, value, nonce, gasLimit: 500000n, gasPrice, chainId: 97, type: 0 };
  const raw = await wallet.signTransaction(tx);
  const hash = await broadcast(raw);
  const rc = await waitReceipt(hash);
  if (rc.status !== "0x1") throw new Error("tx reverted: " + hash);
  return { hash, rc };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const key = fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim();
  const provider = new ethers.JsonRpcProvider(READ_RPC, 97, { staticNetwork: true });
  const deployer = new ethers.Wallet(key);
  console.log("deployer:", deployer.address, "balance:", ethers.formatEther(await provider.getBalance(deployer.address)), "tBNB");

  // Fresh proof wallets (persisted; testnet throwaways).
  const walletsPath = path.join(__dirname, "..", "keys", "vote-proof-wallets.json");
  let w1, w2;
  if (fs.existsSync(walletsPath)) {
    const saved = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
    w1 = new ethers.Wallet(saved.wallet1);
    w2 = new ethers.Wallet(saved.wallet2);
    console.log("reusing persisted proof wallets");
  } else {
    w1 = ethers.Wallet.createRandom();
    w2 = ethers.Wallet.createRandom();
    fs.writeFileSync(walletsPath, JSON.stringify({ wallet1: w1.privateKey, wallet2: w2.privateKey }, null, 2));
    console.log("created + persisted fresh proof wallets");
  }
  console.log("wallet1:", w1.address, "\nwallet2:", w2.address);

  const mock = new ethers.Contract(REGISTRY, artifact("MockAgentIdRegistry", "mocks"), provider);
  const issuer = await mock.issuer();
  if (issuer.toLowerCase() !== deployer.address.toLowerCase()) throw new Error(`deployer is not the mock registry issuer (issuer=${issuer}) — cannot issue test IDs`);
  console.log("mock registry issuer == deployer ✓");

  // Issue IDs where missing.
  for (const [label, w] of [["deployer", deployer], ["wallet1", w1], ["wallet2", w2]]) {
    if ((await mock.balanceOf(w.address)) === 0n) {
      const { hash } = await send(deployer, provider, REGISTRY, mock.interface.encodeFunctionData("issue", [w.address]));
      console.log(`issue ID -> ${label}: ${hash}`);
    } else console.log(`${label} already holds a test ID`);
  }

  // Fund the fresh wallets with gas money.
  for (const [label, w] of [["wallet1", w1], ["wallet2", w2]]) {
    const bal = await provider.getBalance(w.address);
    if (bal < ethers.parseEther("0.002")) {
      const { hash } = await send(deployer, provider, w.address, "0x", ethers.parseEther("0.005"));
      console.log(`fund ${label} 0.005 tBNB: ${hash}`);
    } else console.log(`${label} already funded (${ethers.formatEther(bal)} tBNB)`);
  }

  // Create the vote campaign: already open, ends in ~150 s.
  const apps = new ethers.Contract(APPS, artifact("OneIDCampaignsV5"), provider);
  const gateAddr = await apps.gate();
  const gate = new ethers.Contract(gateAddr, artifact("BeCounted"), provider);
  for (const [label, w] of [["deployer", deployer], ["wallet1", w1], ["wallet2", w2]]) {
    if (!(await gate.isHuman(w.address))) throw new Error(`${label} is not human via V5's gate (${gateAddr})`);
  }
  console.log("all three voters pass V5's BeCounted ✓");
  const now = (await provider.getBlock("latest")).timestamp;
  const startAt = now - 60, endAt = now + 150;
  const idBefore = await apps.campaignCount();
  const { hash: createHash, rc: createRc } = await send(deployer, provider, APPS,
    apps.interface.encodeFunctionData("createVote", ["Minority vote settlement proof", startAt, endAt, 2]));
  let campaignId = idBefore;
  for (const log of createRc.logs) {
    try { const ev = apps.interface.parseLog(log); if (ev && ev.name === "CampaignCreated") campaignId = ev.args.id; } catch {}
  }
  console.log(`vote campaign created: id=${campaignId} tx=${createHash} (startAt=${startAt}, endAt=${endAt})`);

  // Cast the 3 votes: deployer + wallet1 -> option 0, wallet2 -> option 1.
  const votes = [[deployer, 0, "deployer"], [w1, 0, "wallet1"], [w2, 1, "wallet2"]];
  const voteTx = {};
  for (const [w, opt, label] of votes) {
    const { hash } = await send(w, provider, APPS, apps.interface.encodeFunctionData("castVote", [campaignId, opt]));
    voteTx[label] = hash;
    console.log(`castVote ${label} -> option ${opt}: ${hash}`);
  }

  // Wait for the campaign to end.
  for (;;) {
    const t = (await provider.getBlock("latest")).timestamp;
    if (t > endAt) break;
    console.log(`  waiting for end… chain time ${t}, endAt ${endAt}`);
    await sleep(15000);
  }
  console.log("campaign ended; running settle-vote.js…\n");
  const out = execFileSync("node", [path.join(__dirname, "settle-vote.js"), campaignId.toString(), TEST_PRIZE], { encoding: "utf8" });
  console.log(out);

  // Assert the payout file.
  const payout = JSON.parse(fs.readFileSync(path.join(__dirname, "..", `vote-payout-${campaignId}.json`), "utf8"));
  const assertEq = (a, b, msg) => { if (a !== b) throw new Error(`ASSERT FAIL ${msg}: ${a} !== ${b}`); };
  assertEq(JSON.stringify(payout.tallies.map((t) => t.votes)), JSON.stringify([2, 1]), "tallies");
  assertEq(JSON.stringify(payout.winningOptions), JSON.stringify([1]), "winningOptions");
  assertEq(payout.tallyVerified, true, "tallyVerified");
  assertEq(payout.winnerCount, 1, "winnerCount");
  assertEq(payout.winners[0].address.toLowerCase(), w2.address.toLowerCase(), "sole winner is wallet2");
  assertEq(payout.perVoterRaw, TEST_PRIZE, "winner gets the full prize");
  assertEq(payout.dustRaw, "0", "dust");
  console.log("PROOF OK ✓ tallies 2 vs 1 · minority = option 1 · sole winner wallet2 gets the full test prize · dust 0");
  console.log(JSON.stringify({ campaignId: campaignId.toString(), createTx: createHash, voteTx, wallet1: w1.address, wallet2: w2.address }, null, 2));
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
