// Sourcify v2 verification for the V10 trial stack (chain 97), following
// LAUNCH-RUNBOOK route C: std-JSON input + LONG compiler version taken
// from the hardhat build-info that produced each contract.
const fs = require("fs");
const path = require("path");

const v10 = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "v10-address.json"), "utf8"));
const TARGETS = [
  { name: "OneIDCampaignsV10", identifier: "contracts/OneIDCampaignsV10.sol:OneIDCampaignsV10", address: v10.appsV10, tx: v10.appsV10Tx },
  { name: "MockRegistryV2", identifier: "contracts/mocks/MockRegistryV2.sol:MockRegistryV2", address: v10.mockRegistryV2, tx: v10.mockRegistryV2Tx },
  { name: "BeCounted", identifier: "contracts/BeCounted.sol:BeCounted", address: v10.gateV10, tx: v10.gateV10Tx },
];

function findBuildInfo(contractFile, contractName) {
  const dir = path.join(__dirname, "..", "artifacts", "build-info");
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const bi = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (bi.output && bi.output.contracts && bi.output.contracts[contractFile] && bi.output.contracts[contractFile][contractName]) {
      return bi;
    }
  }
  throw new Error("build-info not found for " + contractName);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function verifyOne(t) {
  const [file] = t.identifier.split(":");
  const bi = findBuildInfo(file, t.name);
  const body = {
    stdJsonInput: bi.input,
    compilerVersion: bi.solcLongVersion,
    contractIdentifier: t.identifier,
    creatorTxHash: t.tx,
  };
  console.log(`\n== ${t.name} @ ${t.address} (compiler ${bi.solcLongVersion})`);
  const res = await fetch(`https://sourcify.dev/server/v2/verify/97/${t.address}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  let j = await res.json().catch(() => ({}));
  console.log("POST status:", res.status, JSON.stringify(j).slice(0, 300));
  const vid = j.verificationId;
  if (vid) {
    for (let i = 0; i < 20; i++) {
      await sleep(3000);
      const r2 = await fetch(`https://sourcify.dev/server/v2/verify/${vid}`);
      const j2 = await r2.json().catch(() => ({}));
      console.log("poll:", JSON.stringify(j2).slice(0, 300));
      if (j2.isVerified !== undefined || (j2.status && j2.status !== "pending")) { j = j2; break; }
      if (JSON.stringify(j2).includes("exact_match") || JSON.stringify(j2).includes("match")) { j = j2; break; }
    }
  }
  // independent readback: ask Sourcify what it has for this address
  const check = await fetch(`https://sourcify.dev/server/v2/contract/97/${t.address}?fields=match,verifiedAt,creationMatch,runtimeMatch`);
  const cj = await check.json().catch(() => ({}));
  console.log("readback:", JSON.stringify(cj).slice(0, 300));
  return { name: t.name, address: t.address, readback: cj };
}

async function main() {
  const results = [];
  for (const t of TARGETS) {
    try { results.push(await verifyOne(t)); }
    catch (e) { console.error("FAILED", t.name, e.message); results.push({ name: t.name, address: t.address, error: e.message }); }
  }
  v10.sourcify = results;
  fs.writeFileSync(path.join(__dirname, "..", "v10-address.json"), JSON.stringify(v10, null, 2));
  console.log("\nrecorded sourcify results into v10-address.json");
}
main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
