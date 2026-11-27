// Deploy CheckIn (daily check-in + 30-day activity weight) on BSC MAINNET,
// wired to the mainnet BeCounted gate:
//   gate 0xdA585A4aE5b73Ee2728AadA3e877A3A1F84027cd (mainnet-address.json).
// Same contract that was trial-deployed on BSC testnet at
// 0x8A9c105322580b724012529B72aa745f48600Cab (checkin-address.json).
//
// Safety: refuses to sign/broadcast unless CONFIRM_MAINNET is exactly
// "YES" (same convention as deploy-mainnet.js). Without it the script
// runs read-only pre-flight checks and prints the plan only.
// Pre-flight hard-asserts the deployer's mainnet nonce is still 4 (only
// the four batch-1 deploys have ever been sent from this wallet) and
// that the gate answers isHuman(sampleHolder) == true on mainnet.
// Post-deploy verification is READ-ONLY and cross-checked on at least
// two independent mainnet endpoints (public read replicas have lagged
// fresh deploys before — never trust a single endpoint, and never
// re-send while a deployment tx's status is unclear).
// No check-in is sent from this script. Source verification (BscScan)
// is a separate step, done once the Etherscan key is available.
// Appends a "mainnet" section to checkin-address.json, leaving the
// existing testnet record untouched. Deployer key is read from keys/
// and never printed.
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const CONFIRM = process.env.CONFIRM_MAINNET === "YES";
const READ_RPCS = [
  "https://bsc-rpc.publicnode.com",
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.bnbchain.org",
];
const SEND_RPCS = [
  "https://bsc-rpc.publicnode.com",
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.bnbchain.org",
  "https://bsc-dataseed2.bnbchain.org",
];
const GATE_MAINNET = "0xdA585A4aE5b73Ee2728AadA3e877A3A1F84027cd";
const SAMPLE_HOLDER = "0x119B2Bf71856155b234f818476ae0610634A2aB9";
const EXPECTED_NONCE = 4;
const EXPECTED_RUNTIME = 1647;
const DEPLOY_GAS_LIMIT = 1000000n;

function artifact(name, sub) {
  const p = path.join(__dirname, "..", "artifacts", "contracts", sub || "", name + ".sol", name + ".json");
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
    catch (e) { last = e; console.log("  send issue via", url, "-", e.message.slice(0, 100)); if (/nonce too low|already known/i.test(e.message)) return ethers.keccak256(raw); }
  }
  throw last ?? new Error("broadcast failed");
}
async function waitReceipt(hash) {
  // Rotate read endpoints: publicnode mainnet has intermittently refused
  // eth_getTransactionReceipt before; one endpoint's silence is not proof
  // a tx is missing.
  for (let i = 0; i < 60; i++) {
    for (const url of READ_RPCS) {
      try { const rc = await rpc(url, "eth_getTransactionReceipt", [hash]); if (rc) return rc; } catch { /* try next endpoint */ }
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error("receipt timeout " + hash);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(CONFIRM ? "MODE: LIVE DEPLOYMENT (CONFIRM_MAINNET=YES)" : "MODE: DRY-RUN (read-only — nothing will be signed or broadcast)");
  const provider = new ethers.JsonRpcProvider(READ_RPCS[0], 56, { staticNetwork: true });
  const dataseed = new ethers.JsonRpcProvider(READ_RPCS[1], 56, { staticNetwork: true });
  const deployer = new ethers.Wallet(fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim());
  console.log("deployer:", deployer.address);

  const bal = await provider.getBalance(deployer.address);
  const nonce = await provider.getTransactionCount(deployer.address, "latest");
  console.log("BNB balance:", ethers.formatEther(bal), "| nonce:", nonce);
  if (bal === 0n) throw new Error("deployer has no BNB");
  if (nonce !== EXPECTED_NONCE) throw new Error(`ABORT: expected mainnet nonce ${EXPECTED_NONCE}, got ${nonce} — wallet history changed, investigate before deploying`);

  // Pre-flight: mainnet gate live, and the real registry behind it must
  // answer true for the known sample holder (impossible on any mock).
  const gateCode = await provider.getCode(GATE_MAINNET);
  if (gateCode === "0x") throw new Error("gate has no code on mainnet: " + GATE_MAINNET);
  const gateC = new ethers.Contract(GATE_MAINNET, ["function isHuman(address) view returns (bool)", "function registry() view returns (address)"], provider);
  const sampleHuman = await gateC.isHuman(SAMPLE_HOLDER);
  const registry = await gateC.registry();
  console.log("gate pre-flight OK:", GATE_MAINNET, "code bytes:", (gateCode.length - 2) / 2, "| registry:", registry, "| isHuman(sampleHolder):", sampleHuman);
  if (!sampleHuman) throw new Error("gate does not recognise the sample holder on mainnet — wrong gate/network");

  const { abi, bytecode, runtimeBytes } = artifact("CheckIn");
  if (runtimeBytes !== EXPECTED_RUNTIME) throw new Error(`artifact runtime ${runtimeBytes} != expected ${EXPECTED_RUNTIME} — artifact drift, stop`);
  const factory = new ethers.ContractFactory(abi, bytecode);
  const deployTx = await factory.getDeployTransaction(GATE_MAINNET);
  const fee = await provider.getFeeData();
  const gasPrice = fee.gasPrice ?? 1000000000n;
  const predicted = ethers.getCreateAddress({ from: deployer.address, nonce });
  console.log(`plan: deploy CheckIn(gate=${GATE_MAINNET}) at nonce ${nonce} -> ${predicted}; runtime ${runtimeBytes} B; gasLimit ${DEPLOY_GAS_LIMIT}; gasPrice ${ethers.formatUnits(gasPrice, "gwei")} gwei; worst-case cost ${ethers.formatEther(DEPLOY_GAS_LIMIT * gasPrice)} BNB`);

  if (!CONFIRM) { console.log("dry-run complete — re-run with CONFIRM_MAINNET=YES to deploy."); return; }

  const tx = { to: null, data: deployTx.data, value: 0n, nonce, gasLimit: DEPLOY_GAS_LIMIT, gasPrice, chainId: 56, type: 0 };
  const raw = await deployer.signTransaction(tx);
  const hash = await broadcast(raw);
  console.log("  tx hash:", hash);
  const rc = await waitReceipt(hash);
  if (rc.status !== "0x1") throw new Error("CheckIn deploy reverted: " + hash);
  const block = parseInt(rc.blockNumber, 16);
  const gasUsed = parseInt(rc.gasUsed, 16);
  const addr = rc.contractAddress || predicted;
  if (addr.toLowerCase() !== predicted.toLowerCase()) throw new Error(`address mismatch: receipt ${addr} vs predicted ${predicted}`);
  console.log("  address:", addr, "block:", block, "gasUsed:", gasUsed);

  // Post-deploy verification, cross-endpoint (publicnode + dataseed).
  // Poll each endpoint until the fresh code shows up before asserting.
  async function verifyOn(p, label) {
    let code = "0x";
    for (let i = 0; i < 20 && code === "0x"; i++) { code = await p.getCode(addr); if (code === "0x") await sleep(3000); }
    if (code === "0x") throw new Error(label + ": deployed code not visible after polling");
    const liveRuntime = (code.length - 2) / 2;
    const ci = new ethers.Contract(addr, abi, p);
    const checks = {
      runtimeBytes: liveRuntime,
      gate: await ci.gate(),
      weightOfSampleHolder: Number(await ci.weightOf(SAMPLE_HOLDER)),
      totalCheckInsSampleHolder: Number(await ci.totalCheckInsOf(SAMPLE_HOLDER)),
      windowDays: Number(await ci.WINDOW_DAYS()),
      todayIndex: Number(await ci.todayIndex()),
    };
    console.log(label, "verification:", JSON.stringify(checks));
    if (checks.runtimeBytes !== EXPECTED_RUNTIME) throw new Error(label + ": runtime size mismatch");
    if (checks.gate.toLowerCase() !== GATE_MAINNET.toLowerCase()) throw new Error(label + ": gate wiring mismatch: " + checks.gate);
    if (checks.weightOfSampleHolder !== 1 || checks.totalCheckInsSampleHolder !== 0) throw new Error(label + ": sample-holder initial-state invariant failed");
    if (checks.windowDays !== 30 || checks.todayIndex <= 0) throw new Error(label + ": constant/index sanity failed");
    return checks;
  }
  const checksA = await verifyOn(provider, "publicnode");
  await verifyOn(dataseed, "dataseed  ");

  const balAfter = await provider.getBalance(deployer.address);
  console.log("deployer balance after:", ethers.formatEther(balAfter), "BNB | spent:", ethers.formatEther(bal - balAfter), "BNB");

  const recordPath = path.join(__dirname, "..", "checkin-address.json");
  const record = JSON.parse(fs.readFileSync(recordPath, "utf8"));
  record.mainnet = {
    network: "bsc-mainnet",
    chainId: 56,
    date: new Date().toISOString(),
    contract: "CheckIn",
    checkIn: addr,
    checkInTx: hash,
    checkInBlock: block,
    deployGasUsed: gasUsed,
    gasPriceWei: gasPrice.toString(),
    runtimeBytes: checksA.runtimeBytes,
    gate: GATE_MAINNET,
    gateStack: "Mainnet batch-1 BeCounted gate over the real SPACE ID Agent ID registry 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F",
    deployer: deployer.address,
    deployerBalanceAfter: ethers.formatEther(balAfter),
    verification: checksA,
    verifiedOnEndpoints: READ_RPCS.slice(0, 2),
    note: "Mainnet deployment. Read-only cross-endpoint verification only; no check-in sent. BscScan source verification pending (needs the Etherscan V2 key, supplied separately).",
  };
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n");
  console.log("wrote mainnet section into checkin-address.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
