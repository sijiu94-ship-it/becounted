// Deploy OneIDCampaignsV17 to BSC MAINNET (chainId 56).
// Requires CONFIRM_MAINNET=YES.
//   V17 = V16 + external-audit fixes (weight snapshot at lockDraw,
//   full https:// prefix checks, constructor checkIn_ code guard),
//   wired to the EXISTING mainnet gate, IdentityBindingsV4 and
//   CheckInV2 (no new CheckIn deployment).
// Idempotent: refuses if mainnet-address.json already records appsV17.
// Post-deploy self-checks are eth_call replays (no gas spent).
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const READ_RPCS = [
  "https://bsc-rpc.publicnode.com",
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.bnbchain.org",
  "https://bsc-dataseed2.bnbchain.org",
];
const SEND_RPCS = [
  "https://bsc-rpc.publicnode.com",
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.bnbchain.org",
  "https://bsc-dataseed2.bnbchain.org",
  "https://bnbchain.api.onfinality.io/public",
];
const CHAIN_ID = 56;
const RECORD_PATH = path.join(__dirname, "..", "mainnet-address.json");
const CI_RECORD_PATH = path.join(__dirname, "..", "checkin-address.json");
const MAXU = ethers.MaxUint256;
const NO_COND = [false, ethers.ZeroAddress, 0n, false, MAXU, 0, ethers.ZeroAddress, ethers.ZeroHash, ethers.ZeroHash];

function artifact(name, sub) {
  const p = path.join(__dirname, "..", "artifacts", "contracts", sub || "", name + ".sol", name + ".json");
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: j.abi, bytecode: j.bytecode, runtimeBytes: (j.deployedBytecode.length - 2) / 2 };
}
async function rpc(url, method, params) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(20000) });
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
  for (let i = 0; i < 40; i++) { const rc = await rpc(READ_RPCS[1], "eth_getTransactionReceipt", [hash]); if (rc) return rc; await new Promise(r => setTimeout(r, 3000)); }
  throw new Error("receipt timeout " + hash);
}

async function main() {
  if (process.env.CONFIRM_MAINNET !== "YES") throw new Error("refusing: set CONFIRM_MAINNET=YES");
  const rec = JSON.parse(fs.readFileSync(RECORD_PATH, "utf8"));
  if (rec.appsV17) throw new Error("record already has appsV17 — refusing to redeploy");
  if (!rec.bindingsV4) throw new Error("record has no bindingsV4 — deploy that first");
  const ciRec = JSON.parse(fs.readFileSync(CI_RECORD_PATH, "utf8"));
  if (!ciRec.mainnetV2 || !ciRec.mainnetV2.checkIn) throw new Error("checkin record has no mainnetV2 — V17 needs the existing CheckInV2");
  const checkInV2 = ciRec.mainnetV2.checkIn;
  const provider = new ethers.JsonRpcProvider(READ_RPCS[0], CHAIN_ID, { staticNetwork: true });
  const deployer = new ethers.Wallet(fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim(), provider);
  if (deployer.address.toLowerCase() !== rec.deployer.toLowerCase()) throw new Error("deployer key does not match record");
  const gasPrice = (await provider.getFeeData()).gasPrice ?? 100000000n;
  console.log("deployer:", deployer.address, "BNB:", ethers.formatEther(await provider.getBalance(deployer.address)), "gasPrice:", gasPrice.toString());
  console.log("gate:", rec.humanGate, "| bindingsV4:", rec.bindingsV4, "| checkInV2 (existing):", checkInV2);

  const { abi, bytecode, runtimeBytes } = artifact("OneIDCampaignsV17", "");
  const factory = new ethers.ContractFactory(abi, bytecode);
  const deployTx = await factory.getDeployTransaction(rec.humanGate, rec.bindingsV4, checkInV2);
  const nonce = await provider.getTransactionCount(deployer.address, "pending");
  const tx = { to: null, data: deployTx.data, value: 0n, nonce, gasLimit: 5000000n, gasPrice, chainId: CHAIN_ID, type: 0 };
  const raw = await deployer.signTransaction(tx);
  const hash = await broadcast(raw);
  const rc = await waitReceipt(hash);
  if (rc.status !== "0x1") throw new Error("OneIDCampaignsV17 deploy reverted: " + hash);
  const addr = ethers.getCreateAddress({ from: deployer.address, nonce });
  const code = await provider.getCode(addr);
  console.log("deployed OneIDCampaignsV17:", addr, "runtime bytes:", (code.length - 2) / 2, "block:", parseInt(rc.blockNumber, 16), "tx:", hash);
  if ((code.length - 2) / 2 !== runtimeBytes) throw new Error("runtime size mismatch");

  console.log("— post-deploy self-checks");
  const appsC = new ethers.Contract(addr, abi, provider);
  const checks = [
    ["V17 gate() == mainnet gate", (await appsC.gate()).toLowerCase() === rec.humanGate.toLowerCase()],
    ["V17 bindings() == V4", (await appsC.bindings()).toLowerCase() === rec.bindingsV4.toLowerCase()],
    ["V17 checkIn() == existing CheckInV2", (await appsC.checkIn()).toLowerCase() === checkInV2.toLowerCase()],
    ["V17 campaignCount == 0", Number(await appsC.campaignCount()) === 0],
  ];
  for (const [label, ok] of checks) { console.log(ok ? "  PASS" : "  FAIL", label); if (!ok) throw new Error("self-check failed: " + label); }

  const head = await provider.getBlock("latest");
  const t = head.timestamp;
  async function replayOk(data, label) {
    try { await provider.call({ from: deployer.address, to: addr, data }); console.log("  PASS replay:", label); }
    catch (e) { throw new Error("self-check failed: " + label + " reverted: " + e.message.slice(0, 160)); }
  }
  async function replayBad(data, label) {
    let err = null;
    try { await provider.call({ from: deployer.address, to: addr, data }); }
    catch (e) {
      const rawE = e.data || (e.info && e.info.error && e.info.error.data);
      if (rawE) { try { const p = appsC.interface.parseError(rawE); err = p ? p.name : String(rawE); } catch { err = String(rawE); } }
      if (!err) err = String(e.message).slice(0, 120);
    }
    if (err !== "BadParams") throw new Error("self-check failed: " + label + " expected BadParams, got: " + err);
    console.log("  PASS replay:", label, "reverts BadParams");
  }
  await replayOk(appsC.interface.encodeFunctionData("createRaffle", ["selfcheck", t - 10, t + 3600, 1, ethers.ZeroAddress, 0n, NO_COND, "加权礼盒", true]),
    "weighted createRaffle(label, weighted) succeeds in-call");
  await replayOk(appsC.interface.encodeFunctionData("createClaim", ["selfcheck", t - 10, t + 3600, 2, ethers.ZeroAddress, 0n, false, NO_COND, "周边礼盒 x1"]),
    "registration createClaim(label, pool 0) succeeds in-call");
  await replayBad(appsC.interface.encodeFunctionData("createClaim", ["selfcheck", t - 10, t + 3600, 2, ethers.ZeroAddress, 100n, false, NO_COND, "周边礼盒 x1"]),
    "createClaim(label + pool)");
  if (Number(await appsC.campaignCount()) !== 0) throw new Error("self-check failed: replays changed state");
  console.log("  PASS replays left no state (campaignCount still 0)");

  rec.appsV17 = addr; rec.appsV17Tx = hash; rec.appsV17Block = parseInt(rc.blockNumber, 16);
  fs.writeFileSync(RECORD_PATH, JSON.stringify(rec, null, 2) + "\n");
  console.log("records updated: mainnet-address.json (+appsV17)");
  console.log("deployer BNB after:", ethers.formatEther(await provider.getBalance(deployer.address)));
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
