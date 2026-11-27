// Live testnet trial, phase B: wait until the trial raffle has ended and
// its seed block has passed, then draw and print the winner.
// Usage: node scripts/draw.js
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const RPC = "https://bsc-testnet-rpc.publicnode.com";
const APPS = "0x42c9f4bfa02e0b4365d9701f962b4dcd4bf39a07";

function load(name) {
  const p = path.join(__dirname, "..", "artifacts", "contracts", name + ".sol", name + ".json");
  return JSON.parse(fs.readFileSync(p, "utf8")).abi;
}

async function main() {
  const state = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "trial-state.json"), "utf8"));
  const key = fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim();
  const provider = new ethers.JsonRpcProvider(RPC, 97, { staticNetwork: true });
  const wallet = new ethers.Wallet(key, provider);
  const apps = new ethers.Contract(APPS, load("OneIDCampaigns"), provider);

  // Wait for end time + seed block.
  for (let i = 0; i < 80; i++) {
    const now = Math.floor(Date.now() / 1000);
    const blk = await provider.getBlockNumber();
    if (now > state.endAt + 5 && blk > state.seedBlock + 2) break;
    console.log(`waiting… now=${now} endAt=${state.endAt} block=${blk} seedBlock=${state.seedBlock}`);
    await new Promise((r) => setTimeout(r, 15000));
  }

  const nonce = await provider.getTransactionCount(wallet.address, "latest");
  const gasPrice = (await provider.getFeeData()).gasPrice ?? 1000000000n;
  const data = apps.interface.encodeFunctionData("draw", [state.raffleId]);
  const raw = await wallet.signTransaction({ to: APPS, data, nonce, gasLimit: 500000n, gasPrice, chainId: 97, type: 0 });
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [raw] }),
  });
  const j = await res.json();
  if (j.error) throw new Error("send: " + JSON.stringify(j.error));
  console.log("draw tx:", j.result);
  for (let i = 0; i < 40; i++) {
    const r2 = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [j.result] }),
    });
    const rc = (await r2.json()).result;
    if (rc) {
      if (rc.status !== "0x1") throw new Error("draw reverted");
      break;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.log("winners:", await apps.getWinners(state.raffleId));
  const c = await apps.getCampaign(state.raffleId);
  console.log("drawn:", c.drawn, "usedFallbackSeed:", c.usedFallbackSeed, "entries:", c.entryCount.toString());
  console.log("PHASE B OK");
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
});
