// Deploy CheckInV2 + OneIDCampaignsV16 to BSC MAINNET (chainId 56).
// Requires CONFIRM_MAINNET=YES.
//   - CheckInV2 = CheckIn V1 with WINDOW_DAYS 30 -> 14 (fresh deploy;
//     V1 history does not carry over, V1 stays readable).
//   - V16 = V15 + weighted raffle draws, wired (gate, BindingsV4,
//     CheckInV2). Constructor order matters: CheckInV2 deploys first.
// Idempotent: refuses if mainnet-address.json already records appsV16,
// or checkin-address.json already records a mainnetV2 entry.
// Post-deploy self-checks include eth_call replays (weighted raffle
// create succeeds in-call; registration create succeeds; label+pool
// reverts BadParams) — no gas spent on the replays.
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
  if (rec.appsV16) throw new Error("record already has appsV16 — refusing to redeploy");
  if (!rec.bindingsV4) throw new Error("record has no bindingsV4 — deploy that first");
  const ciRec = JSON.parse(fs.readFileSync(CI_RECORD_PATH, "utf8"));
  if (ciRec.mainnetV2) throw new Error("checkin record already has mainnetV2 — refusing to redeploy");
  const provider = new ethers.JsonRpcProvider(READ_RPCS[0], CHAIN_ID, { staticNetwork: true });
  const deployer = new ethers.Wallet(fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim(), provider);
  if (deployer.address.toLowerCase() !== rec.deployer.toLowerCase()) throw new Error("deployer key does not match record");
  const gasPrice = (await provider.getFeeData()).gasPrice ?? 100000000n;
  console.log("deployer:", deployer.address, "BNB:", ethers.formatEther(await provider.getBalance(deployer.address)), "gasPrice:", gasPrice.toString());
  console.log("gate (existing):", rec.humanGate, "| bindingsV4 (existing):", rec.bindingsV4);

  async function deploy(name, sub, args, gasLimit) {
    const { abi, bytecode, runtimeBytes } = artifact(name, sub);
    const factory = new ethers.ContractFactory(abi, bytecode);
    const deployTx = await factory.getDeployTransaction(...args);
    const nonce = await provider.getTransactionCount(deployer.address, "pending");
    const tx = { to: null, data: deployTx.data, value: 0n, nonce, gasLimit, gasPrice, chainId: CHAIN_ID, type: 0 };
    const raw = await deployer.signTransaction(tx);
    const hash = await broadcast(raw);
    const rc = await waitReceipt(hash);
    if (rc.status !== "0x1") throw new Error(name + " deploy reverted: " + hash);
    const addr = ethers.getCreateAddress({ from: deployer.address, nonce });
    const code = await provider.getCode(addr);
    console.log(`deployed ${name}:`, addr, "runtime bytes:", (code.length - 2) / 2, "block:", parseInt(rc.blockNumber, 16), "tx:", hash);
    if ((code.length - 2) / 2 !== runtimeBytes) throw new Error(name + " runtime size mismatch");
    return { address: addr, tx: hash, block: parseInt(rc.blockNumber, 16), abi };
  }

  const ci = await deploy("CheckInV2", "", [rec.humanGate], 1500000n);
  const ciC = new ethers.Contract(ci.address, ci.abi, provider);
  const ciChecks = [
    ["CheckInV2 gate() == mainnet gate", (await ciC.gate()).toLowerCase() === rec.humanGate.toLowerCase()],
    ["CheckInV2 WINDOW_DAYS == 14", Number(await ciC.WINDOW_DAYS()) === 14],
    ["CheckInV2 weightOf(deployer) == 1 at birth", Number(await ciC.weightOf(deployer.address)) === 1],
  ];
  for (const [label, ok] of ciChecks) { console.log(ok ? "  PASS" : "  FAIL", label); if (!ok) throw new Error("self-check failed: " + label); }

  const apps = await deploy("OneIDCampaignsV16", "", [rec.humanGate, rec.bindingsV4, ci.address], 5000000n);
  console.log("— post-deploy self-checks");
  const appsC = new ethers.Contract(apps.address, apps.abi, provider);
  const checks = [
    ["V16 gate() == mainnet gate", (await appsC.gate()).toLowerCase() === rec.humanGate.toLowerCase()],
    ["V16 bindings() == V4", (await appsC.bindings()).toLowerCase() === rec.bindingsV4.toLowerCase()],
    ["V16 checkIn() == CheckInV2", (await appsC.checkIn()).toLowerCase() === ci.address.toLowerCase()],
    ["V16 campaignCount == 0", Number(await appsC.campaignCount()) === 0],
  ];
  for (const [label, ok] of checks) { console.log(ok ? "  PASS" : "  FAIL", label); if (!ok) throw new Error("self-check failed: " + label); }

  const head = await provider.getBlock("latest");
  const t = head.timestamp;
  async function replayOk(data, label) {
    try { await provider.call({ from: deployer.address, to: apps.address, data }); console.log("  PASS replay:", label); }
    catch (e) { throw new Error("self-check failed: " + label + " reverted: " + e.message.slice(0, 160)); }
  }
  async function replayBad(data, label) {
    let err = null;
    try { await provider.call({ from: deployer.address, to: apps.address, data }); }
    catch (e) {
      const raw = e.data || (e.info && e.info.error && e.info.error.data);
      if (raw) { try { const p = appsC.interface.parseError(raw); err = p ? p.name : String(raw); } catch { err = String(raw); } }
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

  rec.appsV16 = apps.address; rec.appsV16Tx = apps.tx; rec.appsV16Block = apps.block;
  fs.writeFileSync(RECORD_PATH, JSON.stringify(rec, null, 2) + "\n");
  ciRec.mainnetV2 = {
    network: "bsc-mainnet", chainId: 56, date: new Date().toISOString(),
    contract: "CheckInV2", checkIn: ci.address, checkInTx: ci.tx, checkInBlock: ci.block,
    windowDays: 14, gate: rec.humanGate, deployer: rec.deployer,
    note: "Fresh deployment for the 14-day window; V1 (checkin-address.json `mainnet`) stays deployed and readable as history. V1 check-in records do NOT carry over.",
  };
  fs.writeFileSync(CI_RECORD_PATH, JSON.stringify(ciRec, null, 2) + "\n");
  console.log("records updated: mainnet-address.json (+appsV16), checkin-address.json (+mainnetV2)");
  console.log("deployer BNB after:", ethers.formatEther(await provider.getBalance(deployer.address)));
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
