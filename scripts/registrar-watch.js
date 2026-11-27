#!/usr/bin/env node
// registrar-watch.js — unattended intake pipeline for attested X bindings (v2).
//
// One subcommand does the whole job for one verification tweet:
//   node scripts/registrar-watch.js process <statusIdOrUrl>
//
// Pipeline: fetch the tweet (public read APIs) -> normalize the display
// text (X linkifies the Agent ID name into "https://name.ai"; the visible
// text is restored) -> parse the claimed X handle + Agent ID name from the
// tweet itself -> write the register-auto input file -> run
// scripts/register-auto.js (dry-run, then --execute on PASS). All
// verification (author match, internal one-time name resolution via the
// official baw channel, proof recompute, no-overwrite of signature
// bindings) lives in register-auto.js; this script adds fetching, parsing,
// idempotency and a ledger. Outcomes are recorded in
// registrar-watch/ledger.json keyed by tweet status id:
//   bound | already_bound | rejected (permanent, with reason)
//   retry (transient failure, attempts counted) | needs_attention (>6 tries)
// Re-processing a tweet whose ledger state is final is a no-op.
//
// Policy basis: see register-auto.js header (internal use only; the
// resolved address is never printed, stored or exposed).

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const WATCH_DIR = path.join(ROOT, "registrar-watch");
const LEDGER = path.join(WATCH_DIR, "ledger.json");
const TWEET_DIR = path.join(WATCH_DIR, "tweets");

function loadLedger() {
  try { return JSON.parse(fs.readFileSync(LEDGER, "utf8")); } catch (e) { return {}; }
}
function saveLedger(l) {
  fs.mkdirSync(WATCH_DIR, { recursive: true });
  const tmp = LEDGER + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(l, null, 2));
  fs.renameSync(tmp, LEDGER);
}
function out(obj) { console.log(JSON.stringify(obj)); }

async function fetchTweet(id) {
  // fxtwitter: {tweet:{text, author:{screen_name}}}
  try {
    const r = await fetch("https://api.fxtwitter.com/status/" + id, { signal: AbortSignal.timeout(30000) });
    const j = await r.json();
    if (j && j.tweet && j.tweet.text && j.tweet.author && j.tweet.author.screen_name) {
      return { text: j.tweet.text, author: j.tweet.author.screen_name, source: "fxtwitter" };
    }
  } catch (e) { /* fall through */ }
  // vxtwitter: {text, user_screen_name}
  try {
    const r = await fetch("https://api.vxtwitter.com/Twitter/status/" + id, { signal: AbortSignal.timeout(30000) });
    const j = await r.json();
    if (j && j.text && j.user_screen_name) {
      return { text: j.text, author: j.user_screen_name, source: "vxtwitter" };
    }
  } catch (e) { /* fall through */ }
  return null;
}

function runRegister(args) {
  try {
    const stdout = execFileSync("node", [path.join(__dirname, "register-auto.js"), ...args],
      { cwd: ROOT, timeout: 420000, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, text: stdout };
  } catch (e) {
    return { code: e.status == null ? -1 : e.status, text: ((e.stdout || "") + "\n" + (e.stderr || "")).toString() };
  }
}

const TRANSIENT = /resolve-domain failed|NETWORK|receipt not readable|ETIMEDOUT|ECONNRESET|fetch failed|baw .*failed/i;

async function processOne(id) {
  const ledger = loadLedger();
  const prev = ledger[id];
  if (prev && ["bound", "already_bound", "rejected", "needs_attention"].includes(prev.status)) {
    out({ id, result: "skipped", status: prev.status });
    return;
  }
  const attempts = (prev && prev.attempts ? prev.attempts : 0) + 1;
  const entry = { statusId: id, attempts, firstSeen: (prev && prev.firstSeen) || new Date().toISOString(), updatedAt: new Date().toISOString() };
  const done = (patch) => { Object.assign(entry, patch); ledger[id] = entry; saveLedger(ledger); out({ id, ...patch }); };

  const tw = await fetchTweet(id);
  if (!tw) {
    if (attempts >= 6) return done({ status: "needs_attention", reason: "tweet fetch failed repeatedly" });
    return done({ status: "retry", reason: "tweet fetch failed (fxtwitter+vxtwitter)" });
  }
  entry.author = tw.author; entry.fetchSource = tw.source;

  // X renders "name.ai" as a link; the API's display text shows it as
  // "https://name.ai". Restore the visible text the author actually posted.
  const text = tw.text.replace(/(Agent ID:\s*)https:\/\//i, "$1");
  const handleM = text.match(/Handle:\s*@([A-Za-z0-9_]{1,15})/i);
  const agentM = text.match(/Agent ID:\s*([A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,})/i);
  if (!handleM || !agentM || !text.includes("#BeCountedBind")) {
    return done({ status: "rejected", reason: "not a complete v2 verification tweet (handle / Agent ID / #BeCountedBind missing)" });
  }
  entry.handle = handleM[1].toLowerCase();
  entry.agentName = agentM[1].toLowerCase();
  if (tw.author.toLowerCase() !== entry.handle) {
    return done({ status: "rejected", reason: "tweet author @" + tw.author + " != claimed handle @" + entry.handle });
  }

  fs.mkdirSync(TWEET_DIR, { recursive: true });
  const file = path.join(TWEET_DIR, id + ".txt");
  fs.writeFileSync(file, "author: " + tw.author + "\n" + text + "\n");

  const dry = runRegister([entry.agentName, entry.handle, file]);
  if (dry.text.includes("already attested")) return done({ status: "already_bound" });
  if (dry.code !== 0 || !dry.text.includes("DRY RUN PASS")) {
    const reason = (dry.text.match(/ERROR:.*/) || ["register-auto dry-run failed"])[0].slice(0, 300);
    if (TRANSIENT.test(dry.text) && attempts < 6) return done({ status: "retry", reason });
    if (TRANSIENT.test(dry.text)) return done({ status: "needs_attention", reason });
    return done({ status: "rejected", reason });
  }
  const ex = runRegister([entry.agentName, entry.handle, file, "--execute"]);
  const txM = ex.text.match(/broadcasted:\s*(0x[0-9a-fA-F]{64})/);
  if (ex.text.includes("already attested")) return done({ status: "already_bound" });
  if (ex.code === 0 && ex.text.includes("DONE")) {
    return done({ status: "bound", tx: txM ? txM[1] : undefined });
  }
  const reason = (ex.text.match(/ERROR:.*/) || ["register-auto execute failed"])[0].slice(0, 300);
  // A broadcast whose receipt could not be read is NOT safe to auto-retry
  // blindly; flag it for a human instead.
  if (txM || /receipt not readable/.test(ex.text)) return done({ status: "needs_attention", reason, tx: txM ? txM[1] : undefined });
  if (TRANSIENT.test(ex.text) && attempts < 6) return done({ status: "retry", reason });
  if (TRANSIENT.test(ex.text)) return done({ status: "needs_attention", reason });
  return done({ status: "rejected", reason });
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "process" && arg) {
    const m = String(arg).match(/(\d{10,})/);
    if (!m) { out({ result: "error", reason: "no status id in argument" }); process.exit(1); }
    await processOne(m[1]);
    return;
  }
  if (cmd === "status") {
    const l = loadLedger();
    const counts = {};
    for (const k of Object.keys(l)) counts[l[k].status] = (counts[l[k].status] || 0) + 1;
    out({ entries: Object.keys(l).length, counts });
    return;
  }
  console.error("usage: registrar-watch.js process <statusIdOrUrl> | status");
  process.exit(1);
}

main().catch(e => { out({ result: "error", reason: String(e && e.message || e) }); process.exit(1); });
