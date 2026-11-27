#!/usr/bin/env node
// register-auto.js — Automated attested-binding registrar (v2 flow, 2026-11-26).
//
// Policy basis (project owner's ruling, 2026-11-26): the hackathon rule
// prohibits PROVIDING a name -> address lookup function; it does not
// prohibit internal USE. At a holder's own request, this registrar
// resolves their Agent ID name internally, exactly once, to register
// their own X binding. The resolved address is:
//   - never printed in full (only a keccak fingerprint is shown),
//   - never written to any file or log,
//   - never exposed through any UI or API.
// Site and whitepaper copy state exactly this, no more and no less.
//
// Flow:
//   1. Read the verification tweet (text file produced by the fetch step:
//      first line "author: <handle>", the rest is the tweet text).
//      The tweet carries two public names + a proof code, never an address:
//        BeCounted binding verification
//        Handle: @<x handle>
//        Agent ID: <name>.ai
//        Proof: BC-<16 hex of keccak256(lowercase address + "@" + handle)>
//        #BeCountedBind
//   2. Check the tweet author matches the claimed X handle.
//   3. Resolve the Agent ID name via Binance's official channel
//      (baw wallet resolve-domain, BSC). Internal use only, see above.
//   4. Recompute the proof code from the resolved address + handle and
//      require an exact match in the tweet, plus the Agent ID line.
//   5. Dry-run stops here. With --execute, call
//      IdentityBindingsV3.registerByAttestation (registrar key) and
//      verify proofTypeOf == 1 and isBindingValid == true on-chain.
//
// Usage:
//   node scripts/register-auto.js <agentIdName> <xHandle> <tweetTextFile> [--execute]
// Env: BAW_BIN overrides the baw wrapper path.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const { ethers } = require("ethers");

const ROOT = path.join(__dirname, "..");
const READ_RPCS = ["https://bsc-dataseed1.binance.org", "https://bsc-dataseed.binance.org", "https://bsc-rpc.publicnode.com"];
const BINDINGS_ABI = [
  "function registerByAttestation(address who, string handle)",
  "function isBindingValid(address) view returns (bool)",
  "function proofTypeOf(address) view returns (uint8)",
  "function registrar() view returns (address)",
];

function fail(msg) { console.error("ERROR:", msg); process.exit(1); }

function bindingsTarget() {
  const rec = JSON.parse(fs.readFileSync(path.join(ROOT, "mainnet-address.json"), "utf8"));
  if (!rec.bindings || rec.chainId !== 56) fail("mainnet-address.json has no mainnet bindings entry");
  return rec.bindings;
}

async function receiptAny(txHash) {
  for (const url of READ_RPCS) {
    try {
      const p = new ethers.JsonRpcProvider(url);
      const rc = await p.getTransactionReceipt(txHash);
      if (rc) return rc;
    } catch (e) { /* try next */ }
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const pos = args.filter(a => a !== "--execute");
  if (pos.length !== 3) fail("usage: register-auto.js <agentIdName> <xHandle> <tweetTextFile> [--execute]");
  let [agentName, handle, tweetFile] = pos;
  agentName = agentName.trim().toLowerCase().replace(/^@/, "");
  if (!agentName.includes(".")) agentName += ".ai";
  handle = handle.trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9_]{1,15}$/.test(handle)) fail("bad X handle: " + handle);

  // 1-2. Tweet + author check
  const raw = fs.readFileSync(tweetFile, "utf8");
  const lines = raw.split(/\r?\n/);
  const authorMatch = (lines[0] || "").match(/^author:\s*@?([A-Za-z0-9_]{1,15})\s*$/i);
  if (!authorMatch) fail("tweet file must start with 'author: <handle>'");
  if (authorMatch[1].toLowerCase() !== handle) fail(`tweet author @${authorMatch[1]} != claimed @${handle}`);
  const tweet = lines.slice(1).join("\n");
  if (!tweet.includes("#BeCountedBind")) fail("tweet missing #BeCountedBind");
  if (!new RegExp("agent id:\\s*" + agentName.replace(/\./g, "\\."), "i").test(tweet)) {
    fail("tweet missing 'Agent ID: " + agentName + "' line");
  }
  console.log("tweet author OK: @" + handle);
  console.log("tweet Agent ID line OK: " + agentName);

  // 3. Internal resolution (Binance official channel). Result stays in
  //    memory only; never printed in full, never persisted.
  const bawBin = process.env.BAW_BIN || path.join(os.homedir(), "workspace/tools/baw");
  let out;
  try {
    out = execFileSync(bawBin, ["wallet", "resolve-domain", "--name", agentName, "--binanceChainId", "56", "--json"], { timeout: 300000, encoding: "utf8" });
  } catch (e) {
    fail("baw resolve-domain failed: " + (e.stdout || e.message || "").toString().slice(0, 200));
  }
  let resolved;
  try {
    const j = JSON.parse(out.slice(out.indexOf("{")));
    if (!j.success || !j.data || !/^0x[0-9a-fA-F]{40}$/.test(j.data.address || "")) throw new Error("bad resolve payload");
    resolved = ethers.getAddress(j.data.address);
    if (j.data.isFallback) fail("resolution is a fallback record, refusing to register on it");
  } catch (e) { fail("could not parse resolve result: " + e.message); }
  const fp = ethers.keccak256(ethers.toUtf8Bytes(resolved.toLowerCase())).slice(0, 12);
  console.log("internal resolution OK (fingerprint " + fp + ", address not shown, not stored)");

  // 4. Proof check
  const proof = "BC-" + ethers.keccak256(ethers.toUtf8Bytes(resolved.toLowerCase() + "@" + handle)).slice(2, 18).toUpperCase();
  if (!tweet.includes(proof)) fail("tweet proof mismatch (expected the BC- code derived from the resolved address; not shown)");
  console.log("proof code OK: " + proof);

  const target = bindingsTarget();
  const read = new ethers.Contract(target, BINDINGS_ABI, new ethers.JsonRpcProvider(READ_RPCS[0]));
  const existing = Number(await read.proofTypeOf(resolved));
  if (existing === 0) fail("a signature binding (proofType 0) already exists; attestation must not overwrite it");
  if (existing === 1) { console.log("already attested (proofType 1). Nothing to do."); return; }

  if (!execute) {
    console.log("DRY RUN PASS — would register attested binding for @" + handle + " (" + agentName + "). Re-run with --execute to broadcast.");
    return;
  }

  // 5. Register
  console.log("About to register attested binding for @" + handle + " — Ctrl+C within 5s to abort.");
  await new Promise(r => setTimeout(r, 5000));
  const key = fs.readFileSync(path.join(ROOT, "keys/deployer.key"), "utf8").trim();
  const sendProvider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org");
  const wallet = new ethers.Wallet(key, sendProvider);
  const reg = await read.registrar();
  if (reg.toLowerCase() !== wallet.address.toLowerCase()) fail("deployer key is not the registrar of " + target);
  const c = new ethers.Contract(target, BINDINGS_ABI, wallet);
  const tx = await c.registerByAttestation(resolved, handle);
  console.log("broadcasted:", tx.hash);
  let rc = null;
  for (let i = 0; i < 20 && !rc; i++) { rc = await receiptAny(tx.hash); if (!rc) await new Promise(r => setTimeout(r, 3000)); }
  if (!rc) fail("broadcast but receipt not readable yet — check the tx hash manually, do NOT re-run blindly");
  console.log("receipt status:", rc.status, "block:", rc.blockNumber);
  if (rc.status !== 1) fail("transaction reverted");
  const valid = await read.isBindingValid(resolved);
  const pt = Number(await read.proofTypeOf(resolved));
  console.log("verify: isBindingValid =", valid, "| proofType =", pt);
  if (!valid || pt !== 1) fail("post-registration verification failed");
  console.log("DONE — attested binding registered for @" + handle + ".");
}

main().catch(e => fail(e.message || String(e)));
