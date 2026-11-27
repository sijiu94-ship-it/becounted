// Live testnet trial, phase A: issue a test ID to the deployer, create a
// raffle + a vote, enter/vote, and verify state. Phase B (draw) is
// scripts/draw.js, run after the raffle ends.
// Usage: node scripts/trial.js
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const RPC = "https://bsc-testnet-rpc.publicnode.com";
const REGISTRY = "0xdA585A4aE5b73Ee2728AadA3e877A3A1F84027cd";
const GATE = "0x4858c1c6a4428c65ee6f60aac21a3f404d85d598";
const APPS = "0x42c9f4bfa02e0b4365d9701f962b4dcd4bf39a07";

function load(name, sub) {
  const p = path.join(__dirname, "..", "artifacts", "contracts", sub ?? "", name + ".sol", name + ".json");
  return JSON.parse(fs.readFileSync(p, "utf8")).abi;
}

async function send(wallet, provider, to, data, nonce) {
  const gasPrice = (await provider.getFeeData()).gasPrice ?? 1000000000n;
  const tx = { to, data, nonce, gasLimit: 500000n, gasPrice, chainId: 97, type: 0 };
  const raw = await wallet.signTransaction(tx);
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [raw] }),
  });
  const j = await res.json();
  if (j.error) throw new Error("send: " + JSON.stringify(j.error));
  const hash = j.result;
  for (let i = 0; i < 40; i++) {
    const r2 = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [hash] }),
    });
    const rc = (await r2.json()).result;
    if (rc) {
      if (rc.status !== "0x1") throw new Error("tx reverted: " + hash);
      return hash;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("receipt timeout " + hash);
}

async function main() {
  const key = fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim();
  const provider = new ethers.JsonRpcProvider(RPC, 97, { staticNetwork: true });
  const wallet = new ethers.Wallet(key, provider);
  let nonce = await provider.getTransactionCount(wallet.address, "latest");
  console.log("deployer:", wallet.address, "nonce:", nonce);

  const mock = new ethers.Contract(REGISTRY, load("MockAgentIdRegistry", "mocks"), provider);
  const gate = new ethers.Contract(GATE, load("BeCounted"), provider);
  const apps = new ethers.Contract(APPS, load("OneIDCampaigns"), provider);

  // 1) Issue a test ID to the deployer.
  console.log("issue test ID:", await send(wallet, provider, REGISTRY, mock.interface.encodeFunctionData("issue", [wallet.address]), nonce++));
  console.log("isHuman(deployer) now:", await gate.isHuman(wallet.address));

  // 2) Create a raffle: starts now, ends in ~3 minutes, seed block +120.
  const now = Math.floor(Date.now() / 1000);
  const blk = await provider.getBlockNumber();
  const seedBlock = blk + 120;
  console.log("createRaffle:", await send(wallet, provider, APPS,
    apps.interface.encodeFunctionData("createRaffle", ["Testnet Trial Draw 20U", now - 60, now + 180, 1, seedBlock]), nonce++));
  fs.writeFileSync(path.join(__dirname, "..", "trial-state.json"),
    JSON.stringify({ raffleId: 0, seedBlock, endAt: now + 180 }, null, 2));

  // 3) Enter the raffle.
  console.log("enterRaffle:", await send(wallet, provider, APPS, apps.interface.encodeFunctionData("enterRaffle", [0]), nonce++));
  console.log("entries:", (await apps.getEntries(0)).length);

  // 4) Create + cast a vote.
  console.log("createVote:", await send(wallet, provider, APPS,
    apps.interface.encodeFunctionData("createVote", ["Trial vote: ship it?", now - 60, now + 86400, 2]), nonce++));
  console.log("castVote:", await send(wallet, provider, APPS, apps.interface.encodeFunctionData("castVote", [1, 0]), nonce++));
  console.log("tally option0:", (await apps.tally(1, 0)).toString(), "option1:", (await apps.tally(1, 1)).toString());
  console.log("campaignCount:", (await apps.campaignCount()).toString());
  console.log("PHASE A OK — run scripts/draw.js after the raffle end time in trial-state.json");
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
});
