// weighted-draw.js — Weighted draw for BeCounted platform-run campaigns
// with OFF-CHAIN prizes (e.g. the API-token grand prize), where winners
// are picked in proportion to the activity weight kept by the CheckIn
// contract (weight = 1 + check-in days inside the trailing 14-day
// window of CheckInV2, Beijing-time day boundary; V1 used 30 days).
// NOTE: since OneIDCampaignsV16, raffles can draw by weight ON-CHAIN;
// this tool remains for platform-run off-chain-prize draws and for
// independently auditing weights, and it is built so that ANYONE
// can recompute the result from public chain data alone.
//
// Usage — run a draw:
//   node scripts/weighted-draw.js \
//     --checkin 0xCheckInContract \
//     --rpc https://bsc-testnet-rpc.publicnode.com \
//     --entrants-from 0xOneIDCampaigns --campaign 3 \
//     --seed-block 144800000 --winners 1 \
//     --out reports/api-grand-prize-draw.md
//
//   Entrants can also come from a file (one address per line, or a JSON
//   array of addresses):
//     --entrants-file entrants.txt        (instead of --entrants-from/--campaign)
//
//   Optional flags:
//     --snapshot-block N   block whose state fixes the weights
//                          (default: seed-block - 1, so the weight table
//                          is frozen BEFORE the seed block exists)
//     --checkin-from-block N
//                          first block of the CheckedIn log scan
//                          (default: the deploy block recorded in
//                          ../checkin-address.json when its address
//                          matches --checkin, else 0)
//     --apps-from-block N  first block of the Entered log scan
//                          (default: 0)
//     RPC_URLS env var is honoured when --rpc is omitted; --rpc takes a
//     comma-separated list, endpoints are tried in order per call.
//
// Usage — verify a published report (independent recomputation):
//   node scripts/weighted-draw.js --verify reports/api-grand-prize-draw.md \
//     [--rpc <url>]        (defaults to the RPC recorded in the report)
//   Exit code 0 = report matches a fresh recomputation from chain data;
//   1 = mismatch or error.
//
// How it works (READ-ONLY — it never sends a transaction):
//   1. Entrants: the campaign's Entered events up to the snapshot block
//      (deduplicated), or the addresses in --entrants-file.
//   2. Weights: CheckedIn logs are scanned in sequential 10,000-block
//      chunks (publicnode caps mainnet eth_getLogs ranges at 10000
//      blocks; same chunking discipline as count-interactions.js /
//      settle-vote.js, splitting down to 1,000 on persistent failure). For each entrant, the check-in
//      days inside the trailing 14-day window are counted with the
//      contract's own rule — day index = (timestamp + 8h) / 86400
//      (Beijing time), a day counts iff snapshotDay - day <= 13 — where
//      snapshotDay is the day index of the SNAPSHOT BLOCK's timestamp.
//      weight = 1 + in-window days. Each weight is then cross-checked
//      against an eth_call to weightOf() AT the snapshot block; public
//      RPCs may refuse archive calls, so the report states exactly how
//      many cross-checks succeeded — a failed cross-check is reported,
//      never silently treated as a pass, and a successful cross-check
//      that DISAGREES aborts the draw (exit 2, report still written).
//   3. Draw (the exact algorithm is also printed in the report header):
//        seed = blockhash(seed-block)
//        for i = 0, 1, 2, ... (winner index, 0-based):
//          digest = keccak256(seed_bytes32 || i_as_uint256_big_endian)
//          r      = uint256(digest) mod (current total weight)
//          walk the entrants sorted by address ascending (byte order),
//          accumulating weights; the first entrant whose cumulative
//          weight exceeds r wins; remove the winner and subtract their
//          weight before the next i (sampling without replacement).
//   4. The report (markdown) carries a machine-readable JSON block with
//      every parameter and intermediate value; --verify re-derives
//      everything from the chain and compares all of it.
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const CHUNK = 10000; // publicnode caps MAINNET eth_getLogs ranges at
                     // 10000 blocks ("query exceeds max block range
                     // 10000") and rate-limits bursts — 45k chunks
                     // died on mainnet in the 2026-11-26 rehearsal.
const MIN_CHUNK = 1000;
const CST_OFFSET = 28800; // seconds, UTC+8
const DAY = 86400;
const WINDOW_DAYS = 14;

const CHECKED_IN_TOPIC = ethers.id("CheckedIn(address,uint256,uint256)");
const ENTERED_TOPIC = ethers.id("Entered(uint256,address)");
const CHECKIN_IFACE = new ethers.Interface([
  "event CheckedIn(address indexed user, uint256 dayIndex, uint256 totalCheckIns)",
  "function weightOf(address user) view returns (uint256)",
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dayIndexOf = (ts) => Math.floor((ts + CST_OFFSET) / DAY);
const sortKey = (a) => a.toLowerCase();
const byAddressAsc = (a, b) => (sortKey(a.address ?? a) < sortKey(b.address ?? b) ? -1 : 1);

// ---- args ---------------------------------------------------------------
const argv = process.argv.slice(2);
const args = {};
const FLAGS_WITH_VALUE = new Set([
  "--checkin", "--rpc", "--entrants-from", "--campaign", "--entrants-file",
  "--seed-block", "--snapshot-block", "--winners", "--out",
  "--checkin-from-block", "--apps-from-block", "--verify",
]);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!FLAGS_WITH_VALUE.has(a)) { console.error("unknown argument: " + a); usage(); process.exit(1); }
  const v = argv[++i];
  if (v === undefined) { console.error("missing value for " + a); process.exit(1); }
  args[a] = v;
}
function usage() {
  console.error("usage (draw):   node scripts/weighted-draw.js --checkin <addr> --rpc <url[,url...]> (--entrants-from <addr> --campaign <id> | --entrants-file <path>) --seed-block <n> [--snapshot-block <n>] --winners <k> --out <report.md> [--checkin-from-block <n>] [--apps-from-block <n>]");
  console.error("usage (verify): node scripts/weighted-draw.js --verify <report.md> [--rpc <url[,url...]>]");
}
const VERIFY_MODE = args["--verify"] !== undefined;

let RPC_URLS = (args["--rpc"] || process.env.RPC_URLS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

// ---- raw RPC with per-call fallback across the list ---------------------
async function rpc(method, params) {
  let last;
  for (const url of RPC_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(20000),
      });
      const j = await res.json();
      if (j.error) throw new Error(JSON.stringify(j.error));
      return j.result;
    } catch (e) { last = e; }
  }
  throw last ?? new Error("all RPCs failed for " + method);
}

// Sequential chunked log scan (same discipline as count-interactions.js):
// 10k chunks in order; a chunk that keeps failing on every endpoint is
// split in half recursively down to MIN_CHUNK before giving up.
async function scanChunk(filter, from, to) {
  let attempt = 0;
  for (;;) {
    try {
      return await rpc("eth_getLogs", [{ ...filter, fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16) }]);
    } catch (e) {
      attempt++;
      if (attempt > 4) {
        if (to - from + 1 > MIN_CHUNK) {
          const mid = from + Math.floor((to - from) / 2);
          console.error(`    chunk ${from}-${to} keeps failing (${String(e.message).slice(0, 80)}) — splitting at ${mid}`);
          const a = await scanChunk(filter, from, mid);
          const b = await scanChunk(filter, mid + 1, to);
          return a.concat(b);
        }
        throw new Error(`eth_getLogs chunk ${from}-${to} failed after retries: ${e.message}`);
      }
      await sleep(1500 * attempt);
    }
  }
}

async function scanLogs(filter, fromBlock, toBlock, label) {
  const logs = [];
  if (fromBlock > toBlock) return logs;
  for (let from = fromBlock; from <= toBlock; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, toBlock);
    const part = await scanChunk(filter, from, to);
    logs.push(...part);
    console.error(`    ${label}: blocks ${from}-${to} -> ${part.length} log(s)`);
    if (to < toBlock) await sleep(400);
  }
  return logs;
}

async function getBlock(n) {
  const b = await rpc("eth_getBlockByNumber", ["0x" + n.toString(16), false]);
  if (!b) throw new Error("block " + n + " not found (not mined yet?)");
  return { number: parseInt(b.number, 16), hash: b.hash.toLowerCase(), timestamp: parseInt(b.timestamp, 16) };
}

// ---- entrants -------------------------------------------------------------
function parseEntrantsFile(p) {
  const raw = fs.readFileSync(p, "utf8");
  let list;
  if (raw.trim().startsWith("[")) {
    list = JSON.parse(raw);
    if (!Array.isArray(list)) throw new Error("entrants file JSON is not an array: " + p);
  } else {
    list = raw.split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));
  }
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const addr = ethers.getAddress(String(item).trim()); // throws on garbage — loud is good
    const k = sortKey(addr);
    if (!seen.has(k)) { seen.add(k); out.push(addr); }
  }
  return out;
}

async function entrantsFromEvents(apps, campaignId, fromBlock, toBlock) {
  const topicId = "0x" + BigInt(campaignId).toString(16).padStart(64, "0");
  const logs = await scanLogs({ address: apps, topics: [ENTERED_TOPIC, topicId] }, fromBlock, toBlock, "Entered");
  const seen = new Set();
  const out = [];
  for (const raw of logs) {
    const addr = ethers.getAddress("0x" + raw.topics[2].slice(-40));
    const k = sortKey(addr);
    if (!seen.has(k)) { seen.add(k); out.push(addr); }
  }
  return out;
}

// ---- weights ---------------------------------------------------------------
// Recompute every entrant's weight from the CheckedIn log alone, using
// the contract's own day-boundary and window rules, anchored at the
// snapshot block's timestamp. Returns rows sorted by address ascending.
async function computeWeights(checkin, checkinFromBlock, snapshotBlock, snapshotDay, entrants) {
  const logs = await scanLogs({ address: checkin, topics: [CHECKED_IN_TOPIC] }, checkinFromBlock, snapshotBlock, "CheckedIn");
  const entrantKeys = new Set(entrants.map(sortKey));
  const daysByUser = new Map(); // lowercase address -> Set(dayIndex)
  for (const raw of logs) {
    const user = ethers.getAddress("0x" + raw.topics[1].slice(-40));
    const k = sortKey(user);
    if (!entrantKeys.has(k)) continue;
    const dayIndex = Number(BigInt("0x" + raw.data.slice(2, 66)));
    if (!daysByUser.has(k)) daysByUser.set(k, new Set());
    daysByUser.get(k).add(dayIndex);
  }
  const rows = entrants.map((addr) => {
    const days = [...(daysByUser.get(sortKey(addr)) ?? [])].sort((a, b) => a - b);
    const inWindow = days.filter((d) => snapshotDay - d >= 0 && snapshotDay - d < WINDOW_DAYS);
    return { address: addr, checkInDays: days, windowDays: inWindow.length, weight: 1 + inWindow.length };
  });
  rows.sort(byAddressAsc);
  return { rows, totalLogs: logs.length };
}

// Cross-check each computed weight against weightOf() eth_call AT the
// snapshot block. Archive calls fail on some public RPCs — failures are
// counted and reported, never treated as passes.
async function crossCheck(checkin, rows, snapshotBlock) {
  const stats = { attempted: rows.length, ok: 0, failed: 0, mismatches: [] };
  const blockTag = "0x" + snapshotBlock.toString(16);
  for (const row of rows) {
    try {
      const data = CHECKIN_IFACE.encodeFunctionData("weightOf", [row.address]);
      const out = await rpc("eth_call", [{ to: checkin, data }, blockTag]);
      const onchain = Number(CHECKIN_IFACE.decodeFunctionResult("weightOf", out)[0]);
      if (onchain === row.weight) stats.ok++;
      else stats.mismatches.push({ address: row.address, computed: row.weight, onchain });
    } catch {
      stats.failed++;
    }
  }
  return stats;
}

// ---- the draw ---------------------------------------------------------------
function runDraw(rows, seedHash, winnersCount) {
  let total = rows.reduce((a, r) => a + BigInt(r.weight), 0n);
  const pool = rows.map((r) => ({ address: r.address, weight: r.weight }));
  const draws = [];
  for (let i = 0; i < winnersCount; i++) {
    const digest = ethers.keccak256(ethers.concat([seedHash, ethers.zeroPadValue(ethers.toBeHex(i), 32)]));
    const r = BigInt(digest) % total;
    let acc = 0n;
    let picked = null;
    for (const row of pool) {
      acc += BigInt(row.weight);
      if (r < acc) { picked = row; break; }
    }
    if (!picked) throw new Error("draw walk fell off the cumulative table — internal error");
    draws.push({ i, digest, r: r.toString(), totalWeightBefore: total.toString(), winner: picked.address, winnerWeight: picked.weight });
    pool.splice(pool.indexOf(picked), 1);
    total -= BigInt(picked.weight);
  }
  return draws;
}

const ALGORITHM_TEXT = [
  "seed = blockhash(seed-block)",
  "entrants are sorted by address ascending (byte order of the 20-byte address)",
  "for winner index i = 0, 1, 2, ... (0-based):",
  "  digest = keccak256(seed as 32 raw bytes || i as a 32-byte big-endian uint256)",
  "  r = uint256(digest) mod (current total weight)",
  "  walk the sorted entrants accumulating weights; the first entrant whose",
  "  cumulative weight is strictly greater than r wins this round",
  "  remove the winner and subtract their weight, then continue with i+1",
  "weight of an entrant = 1 + (number of their check-in days d with",
  "  snapshotDay - 29 <= d <= snapshotDay), where day indexes use the",
  "  Beijing-time boundary dayIndex = (unix timestamp + 28800) / 86400 and",
  "  snapshotDay is the day index of the snapshot block's timestamp",
].join("\n");

// ---- draw mode ---------------------------------------------------------------
async function doDraw() {
  const checkinArg = args["--checkin"];
  if (!checkinArg) { console.error("--checkin is required"); usage(); process.exit(1); }
  const checkin = ethers.getAddress(checkinArg);
  if (!RPC_URLS.length) { console.error("--rpc is required (or set RPC_URLS)"); process.exit(1); }
  const seedBlock = Number(args["--seed-block"]);
  if (!Number.isInteger(seedBlock)) { console.error("--seed-block <n> is required"); process.exit(1); }
  const snapshotBlock = args["--snapshot-block"] !== undefined ? Number(args["--snapshot-block"]) : seedBlock - 1;
  const winnersCount = Number(args["--winners"]);
  if (!Number.isInteger(winnersCount) || winnersCount < 1) { console.error("--winners <k>=1.. is required"); process.exit(1); }
  const outPath = args["--out"];
  if (!outPath) { console.error("--out <report.md> is required"); process.exit(1); }
  if (snapshotBlock >= seedBlock) {
    console.error("snapshot-block must be BEFORE seed-block (weights freeze before the seed exists)");
    process.exit(1);
  }

  // entrant source
  let entrantsSource;
  let entrants;
  if (args["--entrants-file"]) {
    entrants = parseEntrantsFile(args["--entrants-file"]);
    entrantsSource = { type: "file", name: path.basename(args["--entrants-file"]) };
  } else if (args["--entrants-from"]) {
    const apps = ethers.getAddress(args["--entrants-from"]);
    const campaign = args["--campaign"];
    if (campaign === undefined) { console.error("--campaign <id> is required with --entrants-from"); process.exit(1); }
    const appsFromBlock = args["--apps-from-block"] !== undefined ? Number(args["--apps-from-block"]) : 0;
    entrantsSource = { type: "events", apps, campaign: String(campaign), appsFromBlock };
    console.error(`scanning Entered events for campaign ${campaign} on ${apps} (blocks ${appsFromBlock}-${snapshotBlock})…`);
    entrants = await entrantsFromEvents(apps, campaign, appsFromBlock, snapshotBlock);
  } else {
    console.error("give either --entrants-file or --entrants-from + --campaign");
    usage();
    process.exit(1);
  }
  if (!entrants.length) { console.error("no entrants found — nothing to draw"); process.exit(1); }
  if (winnersCount > entrants.length) {
    console.error(`--winners ${winnersCount} exceeds entrant count ${entrants.length}`);
    process.exit(1);
  }

  // check-in scan start: explicit flag, else the recorded deploy block
  // when checkin-address.json names this same contract, else 0.
  let checkinFromBlock = args["--checkin-from-block"] !== undefined ? Number(args["--checkin-from-block"]) : null;
  let checkinFromSource = "flag";
  if (checkinFromBlock === null) {
    checkinFromBlock = 0;
    checkinFromSource = "default 0";
    try {
      const rec = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "checkin-address.json"), "utf8"));
      // The record's top level is the TESTNET trial; the mainnet
      // deployment is nested under `mainnet`. Check both — reading
      // only the top level silently fell back to block 0 on mainnet
      // (found in the 2026-11-26 audit).
      for (const entry of [rec, rec.mainnetV2, rec.mainnet]) {
        if (!entry) continue;
        const recAddr = entry.checkIn || entry.checkin || entry.address;
        if (recAddr && sortKey(recAddr) === sortKey(checkin) && Number.isInteger(entry.checkInBlock)) {
          checkinFromBlock = entry.checkInBlock;
          checkinFromSource = "checkin-address.json deploy block";
          break;
        }
      }
    } catch { /* no record — scanning from 0 */ }
  }

  const head = parseInt(await rpc("eth_blockNumber", []), 16);
  if (seedBlock > head) { console.error(`seed block ${seedBlock} not mined yet (head ${head}) — wait for it, then run`); process.exit(1); }
  const seed = await getBlock(seedBlock);
  const snap = await getBlock(snapshotBlock);
  const snapshotDay = dayIndexOf(snap.timestamp);
  console.error(`snapshot block ${snapshotBlock} (ts ${snap.timestamp}, CST day ${snapshotDay}); seed block ${seedBlock} hash ${seed.hash}`);

  console.error(`scanning CheckedIn logs on ${checkin} (blocks ${checkinFromBlock}-${snapshotBlock})…`);
  const { rows, totalLogs } = await computeWeights(checkin, checkinFromBlock, snapshotBlock, snapshotDay, entrants);
  const totalWeight = rows.reduce((a, r) => a + r.weight, 0);

  console.error(`cross-checking ${rows.length} weight(s) against weightOf() at block ${snapshotBlock}…`);
  const cc = await crossCheck(checkin, rows, snapshotBlock);
  console.error(`  cross-check: ${cc.ok} ok, ${cc.failed} call(s) failed, ${cc.mismatches.length} mismatch(es)`);

  const draws = runDraw(rows, seed.hash, winnersCount);
  const winners = draws.map((d) => d.winner);

  const data = {
    tool: "weighted-draw",
    version: 1,
    generatedAt: new Date().toISOString(),
    rpcUsed: RPC_URLS.join(","),
    checkin,
    checkinFromBlock,
    checkinFromSource,
    entrantsSource,
    entrantCount: rows.length,
    snapshotBlock,
    snapshotTimestamp: snap.timestamp,
    snapshotDayIndex: snapshotDay,
    seedBlock,
    seedHash: seed.hash,
    winnersCount,
    totalWeight,
    checkedInLogsScanned: totalLogs,
    crosscheck: cc,
    rows: rows.map((r) => ({ address: r.address, checkInDays: r.checkInDays, windowDays: r.windowDays, weight: r.weight })),
    draws,
    winners,
  };

  const md = [];
  md.push("# BeCounted weighted draw — report");
  md.push("");
  md.push(`- CheckIn contract: \`${checkin}\` (CheckedIn scan from block ${checkinFromBlock}, ${checkinFromSource})`);
  if (entrantsSource.type === "events") {
    md.push(`- Entrants: \`Entered\` events of campaign **${entrantsSource.campaign}** on OneIDCampaigns \`${entrantsSource.apps}\`, blocks ${entrantsSource.appsFromBlock}–${snapshotBlock}`);
  } else {
    md.push(`- Entrants: address list from file \`${entrantsSource.name}\` (as recorded in the JSON block below)`);
  }
  md.push(`- Entrants: **${rows.length}** · total weight: **${totalWeight}** · winners drawn: **${winnersCount}**`);
  md.push(`- Snapshot block: **${snapshotBlock}** (timestamp ${snap.timestamp}, Beijing day index ${snapshotDay})`);
  md.push(`- Seed block: **${seedBlock}** · seed (blockhash): \`${seed.hash}\``);
  md.push(`- CheckedIn logs scanned: ${totalLogs}`);
  md.push(`- weightOf() cross-check at the snapshot block: attempted ${cc.attempted}, ok ${cc.ok}, call-failed ${cc.failed}, mismatches ${cc.mismatches.length}` +
    (cc.failed > 0 ? " — failed calls mean the RPC would not serve archive state; those weights rest on the log recomputation alone, which anyone can redo from the same logs." : ""));
  if (cc.mismatches.length) {
    md.push("");
    md.push("## ⚠️ CROSS-CHECK MISMATCHES");
    md.push("");
    md.push("The log-based recomputation DISAGREES with weightOf() for:");
    for (const m of cc.mismatches) md.push(`- ${m.address}: computed ${m.computed}, on-chain ${m.onchain}`);
    md.push("");
    md.push("Treat this report as INVALID until the discrepancy is explained.");
  }
  md.push("");
  md.push("## Algorithm (fixed — anyone can recompute from this text)");
  md.push("");
  md.push("```text");
  md.push(ALGORITHM_TEXT);
  md.push("```");
  md.push("");
  md.push("## Weight table (sorted by address ascending)");
  md.push("");
  md.push("| # | address | check-in days in window | weight |");
  md.push("|---|---------|-------------------------|--------|");
  rows.forEach((r, i) => md.push(`| ${i + 1} | ${r.address} | ${r.windowDays} | ${r.weight} |`));
  md.push("");
  md.push("## Winners (in draw order)");
  md.push("");
  draws.forEach((d) => md.push(`${d.i + 1}. **${d.winner}** (weight ${d.winnerWeight}; r = ${d.r} of total ${d.totalWeightBefore})`));
  md.push("");
  md.push("## How to verify this report");
  md.push("");
  md.push("```bash");
  md.push(`node scripts/weighted-draw.js --verify ${path.basename(outPath)} --rpc ${RPC_URLS[0]}`);
  md.push("```");
  md.push("");
  md.push("Verification re-scans the chain data named below, recomputes every weight and the full draw, and compares all of it against this report.");
  md.push("");
  md.push("## Machine-readable record");
  md.push("");
  md.push("```json");
  md.push(JSON.stringify(data, null, 2));
  md.push("```");
  md.push("");

  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, md.join("\n"));
  console.log(`report written: ${outPath}`);
  console.log(`entrants ${rows.length} · total weight ${totalWeight} · winners:`);
  for (const d of draws) console.log(`  ${d.i + 1}. ${d.winner} (weight ${d.winnerWeight})`);
  if (cc.mismatches.length) {
    console.error("CROSS-CHECK MISMATCH — report written but flagged INVALID");
    process.exit(2);
  }
  process.exit(0); // Node's fetch keep-alive pool can otherwise hold
  // the process open long after the work is done (seen 2026-11-26:
  // report written, process still alive 18 min later).
}

// ---- verify mode ---------------------------------------------------------------
function extractReportData(mdText) {
  const blocks = mdText.match(/```json\n[\s\S]*?```/g) || [];
  for (const b of blocks) {
    try {
      const j = JSON.parse(b.replace(/^```json\n/, "").replace(/```$/, ""));
      if (j && j.tool === "weighted-draw") return j;
    } catch { /* keep looking */ }
  }
  throw new Error("no weighted-draw JSON record found in the report");
}

async function doVerify() {
  const reportPath = args["--verify"];
  const rep = extractReportData(fs.readFileSync(reportPath, "utf8"));
  if (!RPC_URLS.length && rep.rpcUsed) RPC_URLS = rep.rpcUsed.split(",").map((s) => s.trim()).filter(Boolean);
  if (!RPC_URLS.length) { console.error("--rpc is required (report records none)"); process.exit(1); }

  const failures = [];
  const check = (label, cond, detail) => {
    console.log(`  ${cond ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
    if (!cond) failures.push(label);
  };

  console.log(`verifying ${reportPath} against a fresh recomputation…`);
  console.log(`  checkin ${rep.checkin} · snapshot ${rep.snapshotBlock} · seed ${rep.seedBlock} · winners ${rep.winnersCount}`);

  // seed hash from chain
  const seed = await getBlock(rep.seedBlock);
  check("seed blockhash matches", seed.hash === rep.seedHash, seed.hash);

  // snapshot day from chain
  const snap = await getBlock(rep.snapshotBlock);
  const snapshotDay = dayIndexOf(snap.timestamp);
  check("snapshot timestamp/day match", snap.timestamp === rep.snapshotTimestamp && snapshotDay === rep.snapshotDayIndex,
    `ts ${snap.timestamp}, day ${snapshotDay}`);

  // entrants
  let entrants;
  if (rep.entrantsSource.type === "events") {
    entrants = await entrantsFromEvents(rep.entrantsSource.apps, rep.entrantsSource.campaign, rep.entrantsSource.appsFromBlock, rep.snapshotBlock);
  } else {
    // file source: re-read the file when it sits next to the report or
    // in the cwd; otherwise fall back to the entrant set embedded in
    // the report itself (weights and draw are still fully re-derived).
    const candidates = [rep.entrantsSource.name, path.join(path.dirname(reportPath), rep.entrantsSource.name)];
    const found = candidates.find((p) => fs.existsSync(p));
    if (found) {
      entrants = parseEntrantsFile(found);
      console.log(`  (entrant list re-read from ${found})`);
    } else {
      entrants = rep.rows.map((r) => r.address);
      console.log("  (entrant file not found — using the entrant set embedded in the report; weights and draw are still recomputed from chain logs)");
    }
  }
  const repEntrants = rep.rows.map((r) => r.address);
  check("entrant set matches",
    entrants.length === repEntrants.length &&
    entrants.map(sortKey).sort().join(",") === repEntrants.map(sortKey).sort().join(","),
    `${entrants.length} entrant(s)`);

  // weights from a fresh log scan
  const { rows } = await computeWeights(rep.checkin, rep.checkinFromBlock, rep.snapshotBlock, snapshotDay, entrants);
  const repByAddr = new Map(rep.rows.map((r) => [sortKey(r.address), r]));
  let weightsOk = rows.length === rep.rows.length;
  for (const row of rows) {
    const rr = repByAddr.get(sortKey(row.address));
    if (!rr || rr.weight !== row.weight || rr.windowDays !== row.windowDays ||
        JSON.stringify(rr.checkInDays) !== JSON.stringify(row.checkInDays)) {
      weightsOk = false;
      console.log(`    weight differs for ${row.address}: report=${rr ? rr.weight : "absent"} recomputed=${row.weight}`);
    }
  }
  check("weight table matches", weightsOk, `${rows.length} row(s)`);
  const totalWeight = rows.reduce((a, r) => a + r.weight, 0);
  check("total weight matches", totalWeight === rep.totalWeight, String(totalWeight));

  // draw
  const draws = runDraw(rows, seed.hash, rep.winnersCount);
  const winnersOk = JSON.stringify(draws.map((d) => d.winner)) === JSON.stringify(rep.winners) &&
    draws.every((d, i) => rep.draws[i] && d.digest === rep.draws[i].digest && d.r === rep.draws[i].r &&
      d.totalWeightBefore === rep.draws[i].totalWeightBefore);
  check("draw matches (digests, r values, winner order)", winnersOk, draws.map((d) => d.winner).join(", "));

  if (failures.length) {
    console.log(`VERIFY: FAIL (${failures.length} check(s) failed: ${failures.join("; ")})`);
    process.exit(1);
  }
  console.log("VERIFY: PASS — weights and draw reproduce exactly from chain data");
}

(async () => {
  try {
    if (VERIFY_MODE) await doVerify();
    else await doDraw();
  } catch (e) {
    console.error("FAILED:", e.message);
    process.exit(1);
  }
})();
