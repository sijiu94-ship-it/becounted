// Deploy IdentityBindingsV4 + OneIDCampaignsV11-wired-to-V4 ("V12") to
// BSC MAINNET (chainId 56). Requires CONFIRM_MAINNET=YES.
//   - IdentityBindingsV4: no constructor args; registrar = deployer.
//   - OneIDCampaignsV11 artifact deployed with (existing mainnet gate,
//     the new bindingsV4) — same audited code, new wiring only.
// Idempotent: refuses to run if mainnet-address.json already records
// bindingsV4 / appsV12. Record is updated incrementally; existing keys
// (bindings, appsV11, ...) are left untouched as history.
// Post-deploy self-checks run before the record is written.
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
  for (let i = 0; i < 40; i++) { const rc = await rpc(READ_RPCS[1], "eth_getTransactionReceipt", [hash]); if (rc) return rc; await new Promise(r => setTimeout(r, 3000)); }
  throw new Error("receipt timeout " + hash);
}

async function main() {
  if (process.env.CONFIRM_MAINNET !== "YES") throw new Error("refusing: set CONFIRM_MAINNET=YES");
  const rec = JSON.parse(fs.readFileSync(RECORD_PATH, "utf8"));
  if (rec.bindingsV4 || rec.appsV12) throw new Error("record already has bindingsV4/appsV12 — refusing to redeploy");
  const provider = new ethers.JsonRpcProvider(READ_RPCS[0], CHAIN_ID, { staticNetwork: true });
  const deployer = new ethers.Wallet(fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim(), provider);
  if (deployer.address.toLowerCase() !== rec.deployer.toLowerCase()) throw new Error("deployer key does not match record");
  const gasPrice = (await provider.getFeeData()).gasPrice ?? 100000000n;
  console.log("deployer:", deployer.address, "BNB:", ethers.formatEther(await provider.getBalance(deployer.address)), "gasPrice:", gasPrice.toString());
  console.log("gate (existing):", rec.humanGate);

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

  const bind = await deploy("IdentityBindingsV4", "", [], 1500000n);
  const apps = await deploy("OneIDCampaignsV11", "", [rec.humanGate, bind.address], 5000000n);

  console.log("— post-deploy self-checks");
  const bindC = new ethers.Contract(bind.address, bind.abi, provider);
  const appsC = new ethers.Contract(apps.address, apps.abi, provider);
  const checks = [
    ["V4 registrar == deployer", (await bindC.registrar()).toLowerCase() === deployer.address.toLowerCase()],
    ["V4 deployer unbound (255)", Number(await bindC.proofTypeOf(deployer.address)) === 255],
    ["V4 COOLDOWN == 86400", Number(await bindC.COOLDOWN()) === 86400],
    ["V12 bindings() == V4", (await appsC.bindings()).toLowerCase() === bind.address.toLowerCase()],
    ["V12 gate() == mainnet gate", (await appsC.gate()).toLowerCase() === rec.humanGate.toLowerCase()],
    ["V12 campaignCount == 0", Number(await appsC.campaignCount()) === 0],
  ];
  for (const [label, ok] of checks) { console.log(ok ? "  PASS" : "  FAIL", label); if (!ok) throw new Error("self-check failed: " + label); }

  rec.bindingsV4 = bind.address; rec.bindingsV4Tx = bind.tx; rec.bindingsV4Block = bind.block;
  rec.appsV12 = apps.address; rec.appsV12Tx = apps.tx; rec.appsV12Block = apps.block;
  fs.writeFileSync(RECORD_PATH, JSON.stringify(rec, null, 2) + "\n");
  console.log("record updated: mainnet-address.json (+bindingsV4, +appsV12)");
  console.log("deployer BNB after:", ethers.formatEther(await provider.getBalance(deployer.address)));
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
