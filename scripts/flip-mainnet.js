// flip-mainnet.js — one-shot frontend flip from the testnet config to the
// mainnet config, driven ONLY by the deployment record written by
// scripts/deploy-mainnet.js: mainnet-address.json, with fields
//   { network, chainId, deployer, registry,
//     humanGate, humanGateTx, humanGateBlock,
//     appsV11, appsTx, appsBlock,
//     bindings, bindingsTx, bindingsBlock,
//     quest, questTx, questBlock, questStartAt, questToken, questEscrowUsdc,
//     profile, profileTx, profileBlock }        (profile is null when the
//                                                 deploy ran without
//                                                 INCLUDE_PROFILE=1)
// The record's appsV9 key (a same-address legacy alias written by
// deploy-mainnet.js) and even older "appsV7" records are accepted as
// fallbacks when appsV11 is absent.
//
// What it flips in web/assets/app.js:
//   GATE_TESTNET     <- humanGate
//   APPS_TESTNET     <- appsV11
//   BINDINGS_TESTNET <- bindings
//   PROFILE_TESTNET  <- profile
//   QUEST_TESTNET    <- quest
//   APPS_DEPLOY_BLOCK <- appsBlock
//   NETWORK.appsChainId 97 -> 56, appsChainHex "0x61" -> "0x38"
//   NETWORK.appsRpcs   -> the diversified mainnet RPC list (same order as
//                         NETWORK.mainRpcs: dataseed, publicnode, ankr,
//                         dataseed1, dataseed2)
//   TOKEN_PRESETS.usdt/usdc -> BSC mainnet USDT/USDC (addresses documented
//                         in the app.js comment above TOKEN_PRESETS; USDC
//                         matches deploy-mainnet.js)
//   wallet_addEthereumChain fallback params -> mainnet (chain name,
//                         tBNB -> BNB, mainnet RPCs, bscscan.com)
//   every remaining testnet.bscscan.com link domain -> bscscan.com
//   i18n copy pairs (en + zh) that say "testnet" -> their mainnet wording
//                         (table ported from the retired
//                         switch-frontend-mainnet.js), plus the draw-
//                         certificate canvas line "BNB Chain Testnet"
//   web/becounted-skill.md placeholders {{BECOUNTED_MAINNET_ADDRESS}} /
//                         {{APPS_MAINNET_ADDRESS}} / {{QUEST_MAINNET_ADDRESS}}
//                         -> humanGate / appsV11 / quest (every occurrence;
//                         a placeholder already replaced by its target
//                         address is an idempotent no-op, but a placeholder
//                         whose target address is ALSO absent is an error)
//   every web/*.html: nav badge <span>testnet</span> -> <span>mainnet</span>,
//                         testnet.bscscan.com -> bscscan.com, and any
//                         hardcoded testnet contract address (the current
//                         *_TESTNET values — builders/whitepaper address
//                         tables) -> the matching mainnet record address
// An address guard (pre-write on the planned contents, re-checked
// post-write) additionally refuses the flip if any address the flipped
// frontend would present — a bscscan.com/address/ link or a bare 0x
// address in app.js / any web/*.html — is neither in the deployment
// record, nor the Agent ID registry, nor a mainnet token preset. It
// exists because the builders/whitepaper address tables once carried a
// retired stack's hardcoded addresses that no swap pair touched: the
// flip would have relabelled them "mainnet" while pointing at testnet
// contracts. The guard reports its result in dry-run mode too.
// A label sweep (pre-write and post-write) additionally refuses the flip
// if any em-dash testnet label ("— BSC testnet" / "— BSC 测试网") survives
// in app.js — e.g. a dictionary label that has no I18N_PAIRS entry yet
// (the f_chain_test chain-name value is exempt: bare name, no label form).
// This script is the ONLY frontend flip tool: the older
// switch-frontend-mainnet.js was merged into it and deleted. Its
// --keep-profile-testnet escape hatch was deliberately NOT carried over:
// a record with profile null fails validation above, like any other
// missing field — the flip refuses to guess.
// The *_TESTNET constant NAMES stay (the whole codebase references them);
// only their values change — same approach as the earlier manual flips.
//
// Usage:
//   node scripts/flip-mainnet.js [--addresses <file>] [--web-dir <dir>]
//   node scripts/flip-mainnet.js --apply [--addresses <file>] [--web-dir <dir>]
//
// Default mode is DRY-RUN: prints every planned change as old -> new and
// writes nothing. --apply writes — but only after EVERY validation has
// passed: a missing/invalid record field, a pattern that is not found
// exactly once, an inconsistent asset version, or a syntax error in the
// flipped app.js all abort BEFORE any file is touched, so the flip can
// never land half-done. On apply, the asset version (?v=… on app.js /
// style.css references) is bumped one step in app.js (if present there)
// and in every web/*.html, following the existing scheme:
//   1122c -> 1122d   (…z -> next number + "a"; a plain number increments)
//
// --web-dir exists so the flip can be rehearsed against a COPY of web/
// without touching the real one. This script never touches keys/, never
// deploys, and never pushes.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

const MAINNET_USDT = "0x55d398326f99059fF775485246999027B3197955";
const MAINNET_USDC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const AGENT_ID_REGISTRY = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
// The demo sample holder (9nosing.ai) appears in app.js as a worked
// example; it is an EOA, not a contract, and the homepage masks it —
// the address guard must not flag it.
const SAMPLE_HOLDER_ADDR = "0x119B2Bf71856155b234f818476ae0610634A2aB9";
// The zero address is the "no prize token" sentinel used across app.js,
// not a contract address.
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MAINNET_APPS_RPCS = [
  "https://bsc-dataseed.binance.org",
  "https://bsc-rpc.publicnode.com",
  "https://rpc.ankr.com/bsc",
  "https://bsc-dataseed1.bnbchain.org",
  "https://bsc-dataseed2.bnbchain.org",
];

// i18n copy pairs (exact current string -> mainnet string), ported verbatim
// from the retired switch-frontend-mainnet.js (its runbook §4 list).
// Replacing by exact string (not by key) keeps the en and zh dictionaries
// in sync, and the plan validation fails loudly if the copy has drifted.
const I18N_PAIRS = [
  ["campaigns on testnet", "campaigns on mainnet"],
  ["测试网上的活动", "主网上的活动"],
  ["testnet demo · mainnet launch follows the hackathon schedule", "live on mainnet · Binance Wallet × BNB Chain Agent ID Hackathon"],
  ["测试网演示 · 主网按黑客松排期上线", "主网已上线 · 币安钱包 × BNB 链 Agent ID 黑客松"],
  ["Live on BNB testnet", "Live on BNB mainnet"],
  ["BNB 测试网运行中", "BNB 主网运行中"],
  ["Every entry below passed the BeCounted check. Testnet runs on a mock registry — on mainnet, the same contracts read the real Agent ID registry and any holder can enter.",
   "Every entry below passed the BeCounted check. The contracts read the real Agent ID registry on BNB mainnet — any holder can enter."],
  ["下面每一次报名都通过了 BeCounted 的核验。测试网用的是模拟注册表；主网上线后，同一套合约读取真实 Agent ID 注册表，任何持有者都能报名。",
   "下面每一次报名都通过了 BeCounted 的核验。合约读取 BNB 主网真实 Agent ID 注册表，任何持有者都能报名。"],
  ["Could not reach the testnet right now — refresh in a moment.", "Could not reach BNB mainnet right now — refresh in a moment."],
  ["暂时连不上测试网——稍后刷新。", "暂时连不上 BNB 主网——稍后刷新。"],
  ["Connect your wallet first (top right). The testnet demo uses the mock registry.",
   "Connect your wallet first (top right). Entry requires an Agent ID in your Agentic Wallet."],
  ["先连接钱包（右上角）。测试网演示使用模拟注册表。", "先连接钱包（右上角）。参加需要 Agentic Wallet 里的 Agent ID。"],
  ["Connected on BSC testnet: ", "Connected on BSC mainnet: "],
  ["已在 BSC 测试网连接：", "已在 BSC 主网连接："],
  ["Connected, but your wallet is not on BSC testnet - switch to BSC testnet before joining a campaign.",
   "Connected, but your wallet is not on BSC mainnet - switch to BSC mainnet before joining a campaign."],
  ["已连接，但钱包不在 BSC 测试网——参加活动前请先切换到 BSC 测试网。",
   "已连接，但钱包不在 BSC 主网——参加活动前请先切换到 BSC 主网。"],
  ["BeCounted — BSC testnet", "BeCounted — BSC mainnet"],
  ["BeCounted — BSC 测试网", "BeCounted — BSC 主网"],
  ["OneIDCampaigns — BSC testnet", "OneIDCampaigns — BSC mainnet"],
  ["OneIDCampaigns — BSC 测试网", "OneIDCampaigns — BSC 主网"],
  ["QuestPass — BSC testnet", "QuestPass — BSC mainnet"],
  ["QuestPass — BSC 测试网", "QuestPass — BSC 主网"],
  ["IdentityBindingsV3 (testnet)", "IdentityBindingsV3"],
  ["绑定登记合约（测试网）", "绑定登记合约"],
  ["Currently live on BSC testnet. Mainnet addresses replace these at launch, verified on BscScan.",
   "Live on BSC mainnet. Addresses verified on BscScan."],
  ["当前运行于 BSC 测试网；主网地址将在上线时替换此处，并已在 BscScan 验证。",
   "当前运行于 BSC 主网；地址已在 BscScan 验证。"],
  ["Live from the gate — BSC testnet", "Live from the gate — BSC mainnet"],
  ["门边的实时动态 — BSC 测试网", "门边的实时动态 — BSC 主网"],
];
// The draw-certificate canvas text hardcodes "BNB Chain Testnet" — without
// this, a mainnet winner's downloaded certificate would still say Testnet.
const CERT_PAIR = ["Agent ID gated \\u00b7 BNB Chain Testnet", "Agent ID gated \\u00b7 BNB Chain"];

// ---------- args ----------
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
function optValue(name) {
  const i = argv.indexOf(name);
  if (i === -1) return null;
  const v = argv[i + 1];
  if (!v || v.startsWith("--")) fail("option " + name + " needs a value");
  return v;
}
const addrPath = optValue("--addresses")
  ? path.resolve(optValue("--addresses"))
  : path.join(ROOT, "mainnet-address.json");
const webDir = optValue("--web-dir")
  ? path.resolve(optValue("--web-dir"))
  : path.join(ROOT, "web");
const APP_JS = path.join(webDir, "assets", "app.js");
const SKILL_MD = path.join(webDir, "becounted-skill.md");

function fileLabel(f) {
  const r = path.relative(ROOT, f);
  return r.startsWith("..") ? f : r;
}
function fail(msg) {
  console.error("FAILED: " + msg);
  console.error("Nothing was written.");
  process.exit(1);
}
function isAddr(a) {
  return typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a);
}
function read(p) {
  return fs.readFileSync(p, "utf8");
}
function countOccurrences(s, sub) {
  return s.split(sub).length - 1;
}
function bumpVersion(v) {
  const m = v.match(/^(\d+)([a-z])?$/);
  if (!m) fail("unrecognized asset version format: " + JSON.stringify(v));
  if (!m[2]) return String(Number(m[1]) + 1);
  if (m[2] === "z") return String(Number(m[1]) + 1) + "a";
  return m[1] + String.fromCharCode(m[2].charCodeAt(0) + 1);
}

// ---------- load + validate the deployment record ----------
if (!fs.existsSync(addrPath)) {
  fail("deployment record not found: " + addrPath + " — deploy first (scripts/deploy-mainnet.js writes mainnet-address.json)");
}
let rec;
try {
  rec = JSON.parse(read(addrPath));
} catch (e) {
  fail("deployment record is not valid JSON: " + addrPath + " (" + e.message + ")");
}
const appsAddr = rec.appsV18 || rec.appsV17 || rec.appsV16 || rec.appsV15 || rec.appsV14 || rec.appsV13 || rec.appsV12 || rec.appsV11 || rec.appsV9 || rec.appsV7;
const bindAddr = rec.bindingsV4 || rec.bindings;
const appsBlock = rec.appsV17 ? rec.appsV17Block : rec.appsV16 ? rec.appsV16Block : rec.appsV15 ? rec.appsV15Block : rec.appsV14 ? rec.appsV14Block : rec.appsV13 ? rec.appsV13Block : rec.appsV12 ? rec.appsV12Block : rec.appsBlock;
// No-quest mode (user decision 2026-11-25): QuestPass is NOT part of this
// launch — the expedition is neither deployed nor shown on the website.
// When the record carries no quest address, the flip proceeds without it:
// QUEST_TESTNET is neutralized to the zero address, the Skill's quest
// placeholder is skipped (its section is removed from the Skill), and no
// HTML address swap is planned for it (the address tables no longer list
// QuestPass; the address guard fails loudly if one survives anywhere).
const NO_QUEST = !isAddr(rec.quest);
if (NO_QUEST) {
  console.log("NOTE: deployment record has no quest address — flipping in NO-QUEST mode (expedition not launched; QUEST_TESTNET -> zero address).");
}
const required = [
  ["humanGate", rec.humanGate],
  ["appsV12", appsAddr],
  ["bindingsV4", bindAddr],
  ...(NO_QUEST ? [] : [["quest", rec.quest]]),
  ["profile", rec.profile],
];
const missing = required.filter(([, v]) => !isAddr(v)).map(([k]) => k);
if (missing.length) {
  fail(
    "deployment record " + addrPath + " has missing/invalid address field(s): " + missing.join(", ") +
    (missing.includes("profile") ? " (profile is null when the deploy ran without INCLUDE_PROFILE=1 — deploy IdentityProfile or fix the record; the flip refuses to guess)" : "")
  );
}
if (!Number.isInteger(appsBlock) || appsBlock <= 0) {
  fail("deployment record: appsBlock missing/invalid (needed for APPS_DEPLOY_BLOCK)");
}
if (rec.chainId !== undefined && rec.chainId !== 56) {
  fail("deployment record chainId is " + rec.chainId + ", expected 56 (BSC mainnet)");
}
if (rec.chainId === undefined) {
  fail("deployment record: chainId field missing — cannot confirm this record is a mainnet deployment");
}

// ---------- read current frontend ----------
if (!fs.existsSync(APP_JS)) fail("app.js not found at " + APP_JS);
const appJs = read(APP_JS);
const htmlFiles = fs.readdirSync(webDir).filter((f) => f.endsWith(".html")).sort().map((f) => path.join(webDir, f));
if (!htmlFiles.length) fail("no .html files under " + webDir);

function extractConst(src, name) {
  const m = src.match(new RegExp("const " + name + "\\s*=\\s*\"(0x[0-9a-fA-F]+)\""));
  if (!m) fail("const not found in app.js: " + name);
  return m[1];
}
function extractPreset(src, key) {
  const m = src.match(new RegExp(key + ":\\s*\"(0x[0-9a-fA-F]+)\""));
  if (!m) fail("token preset not found in app.js: " + key);
  return m[1];
}

// ---------- build the edit plan (all in memory; nothing written yet) ----------
// edits: {file, label, find, replace, allowMultiple}
const edits = [];
function edit(file, label, find, replace, allowMultiple) {
  edits.push({ file, label, find, replace, allowMultiple: !!allowMultiple });
}

const addrEdits = [
  ["GATE_TESTNET", rec.humanGate, "humanGate"],
  ["APPS_TESTNET", appsAddr, "appsV12"],
  ["BINDINGS_TESTNET", bindAddr, "bindingsV4"],
  ["PROFILE_TESTNET", rec.profile, "profile"],
  ["QUEST_TESTNET", NO_QUEST ? ZERO_ADDRESS : rec.quest, NO_QUEST ? "zero (no-quest mode)" : "quest"],
];
for (const [name, newVal, recKey] of addrEdits) {
  extractConst(appJs, name); // fails loudly if the const is gone
  // Rebuild with the exact current declaration text (spacing preserved).
  const declRe = new RegExp("const " + name + "\\s*=\\s*\"0x[0-9a-fA-F]+\"");
  const decl = appJs.match(declRe)[0];
  edit(APP_JS, name + " <- record." + recKey, decl, decl.replace(/"0x[0-9a-fA-F]+"/, '"' + newVal + '"'));
}

const blockM = appJs.match(/const APPS_DEPLOY_BLOCK = (\d+);/);
if (!blockM) fail("APPS_DEPLOY_BLOCK not found in app.js");
edit(APP_JS, "APPS_DEPLOY_BLOCK <- record.appsBlock", blockM[0], "const APPS_DEPLOY_BLOCK = " + appsBlock + ";");

const chainM = appJs.match(/appsChainId: (\d+), appsChainHex: "(0x[0-9a-fA-F]+)"/);
if (!chainM) fail("NETWORK appsChainId/appsChainHex not found in app.js");
edit(APP_JS, "NETWORK chain -> 56", chainM[0], 'appsChainId: 56, appsChainHex: "0x38"');

const rpcM = appJs.match(/appsRpcs: (\[[^\]]*\])/);
if (!rpcM) fail("NETWORK appsRpcs not found in app.js");
edit(APP_JS, "NETWORK.appsRpcs -> mainnet RPCs", rpcM[0], "appsRpcs: " + JSON.stringify(MAINNET_APPS_RPCS));

for (const [key, val] of [["usdt", MAINNET_USDT], ["usdc", MAINNET_USDC]]) {
  const cur = extractPreset(appJs, key);
  edit(APP_JS, "TOKEN_PRESETS." + key + " -> mainnet", key + ': "' + cur + '"', key + ': "' + val + '"');
}

// One-way text edits (testnet wording -> mainnet wording) are idempotent:
// if the testnet form is present, plan the swap; if only the mainnet form
// is present, the file was already flipped — plan a no-op; if NEITHER is
// present, the copy has drifted and we fail loudly. `probe` is the string
// whose presence proves the flipped state (defaults to `to`; needed when
// `to` itself is a substring that also occurs in unrelated code).
function oneWayEdit(label, from, to, probe) {
  if (appJs.includes(from)) {
    edit(APP_JS, label, from, to);
  } else if (appJs.includes(probe || to)) {
    edit(APP_JS, label, probe || to, probe || to); // already flipped
  } else {
    fail("pattern drifted for '" + label + "': neither the testnet nor the mainnet form found in app.js");
  }
}

// wallet_addEthereumChain fallback params -> mainnet. This edit must stay
// BEFORE the blanket bscscan-domain edit below: its find string contains
// testnet.bscscan.com, so the domain edit would otherwise eat part of it.
const addChainM = appJs.match(/chainName:"BNB Smart Chain Testnet", nativeCurrency:\{ name:"tBNB", symbol:"tBNB", decimals:18 \}, rpcUrls:\[[^\]]*\], blockExplorerUrls:\["https:\/\/testnet\.bscscan\.com"\]/);
const ADDCHAIN_MAINNET = 'chainName:"BNB Smart Chain", nativeCurrency:{ name:"BNB", symbol:"BNB", decimals:18 }, rpcUrls:' + JSON.stringify(MAINNET_APPS_RPCS) + ', blockExplorerUrls:["https://bscscan.com"]';
if (addChainM) {
  edit(APP_JS, "wallet_addEthereumChain -> mainnet", addChainM[0], ADDCHAIN_MAINNET);
} else if (appJs.includes('chainName:"BNB Smart Chain", nativeCurrency:{ name:"BNB", symbol:"BNB", decimals:18 }')) {
  edit(APP_JS, "wallet_addEthereumChain -> mainnet", ADDCHAIN_MAINNET, ADDCHAIN_MAINNET); // already flipped
} else {
  fail("wallet_addEthereumChain params not found in app.js (neither testnet nor mainnet form)");
}

// Every remaining testnet.bscscan.com link domain in app.js -> bscscan.com.
if (appJs.includes("testnet.bscscan.com")) {
  edit(APP_JS, "testnet.bscscan.com -> bscscan.com (app.js)", "testnet.bscscan.com", "bscscan.com", true);
}

// i18n copy pairs + the certificate canvas line (exact-string edits).
for (const [from, to] of I18N_PAIRS) {
  // "IdentityBindingsV3" alone also occurs in unrelated code, so for that
  // pair the flipped-state probe is the quoted dictionary value.
  const probe = from === "IdentityBindingsV3 (testnet)" ? '"IdentityBindingsV3"' : to;
  oneWayEdit("i18n: " + from.slice(0, 40) + "…", from, to, probe);
}
oneWayEdit("certificate canvas text -> BNB Chain", CERT_PAIR[0], CERT_PAIR[1]);

// Skill placeholders -> record addresses (every occurrence). Idempotent:
// if a placeholder is gone but its target address is present, the file was
// already flipped — register a no-op. If NEITHER is present, fail.
if (!fs.existsSync(SKILL_MD)) fail("becounted-skill.md not found at " + SKILL_MD);
const skillMd = read(SKILL_MD);
for (const [placeholder, val, recKey] of [
  ["{{BECOUNTED_MAINNET_ADDRESS}}", rec.humanGate, "humanGate"],
  ["{{APPS_MAINNET_ADDRESS}}", appsAddr, "appsV11"],
  ...(NO_QUEST ? [] : [["{{QUEST_MAINNET_ADDRESS}}", rec.quest, "quest"]]),
]) {
  if (skillMd.includes(placeholder)) {
    edit(SKILL_MD, "skill " + placeholder + " <- record." + recKey, placeholder, val, true);
  } else if (skillMd.includes(val)) {
    edit(SKILL_MD, "skill " + placeholder + " <- record." + recKey, val, val, true); // already flipped
  } else {
    fail("becounted-skill.md: neither placeholder " + placeholder + " nor its target address (" + recKey + ") found — cannot flip the Skill");
  }
}

// HTML pages: nav badge, bscscan domain, and hardcoded testnet contract
// addresses (address tables) -> the matching mainnet record addresses.
const htmlAddrSwaps = [
  ["GATE_TESTNET", rec.humanGate, "humanGate"],
  ["APPS_TESTNET", appsAddr, "appsV12"],
  ["BINDINGS_TESTNET", bindAddr, "bindingsV4"],
  ["PROFILE_TESTNET", rec.profile, "profile"],
  ...(NO_QUEST ? [] : [["QUEST_TESTNET", rec.quest, "quest"]]),
].map(([name, newVal, recKey]) => [extractConst(appJs, name), newVal, name + " <- record." + recKey]);
// Collision guard: HTML swaps are plain string replacements applied in
// sequence, so a record address that equals ANOTHER contract's current
// testnet address would be re-replaced by that contract's swap and corrupt
// the tables. Real mainnet records always carry fresh addresses; refuse
// anything else instead of writing garbage.
const swapOlds = htmlAddrSwaps.map(([o]) => o.toLowerCase());
for (const [oldVal, newVal, label] of htmlAddrSwaps) {
  if (oldVal.toLowerCase() !== newVal.toLowerCase() && swapOlds.includes(newVal.toLowerCase())) {
    fail("HTML address swap collision: record value for " + label + " (" + newVal + ") equals another contract's current testnet address — sequential replacement would corrupt the address tables; fix the record");
  }
}
for (const f of htmlFiles) {
  const html = read(f);
  const base = path.basename(f);
  if (html.includes("<span>testnet</span>")) {
    edit(f, base + " nav badge testnet -> mainnet", "<span>testnet</span>", "<span>mainnet</span>", true);
  }
  if (html.includes("testnet.bscscan.com")) {
    edit(f, base + " testnet.bscscan.com -> bscscan.com", "testnet.bscscan.com", "bscscan.com", true);
  }
  for (const [oldVal, newVal, label] of htmlAddrSwaps) {
    if (oldVal !== newVal && html.includes(oldVal)) {
      edit(f, base + " address " + label, oldVal, newVal, true);
    }
  }
}

// Asset version bump: version must be consistent across all html files.
const versions = new Set();
for (const f of htmlFiles) {
  const html = read(f);
  for (const m of html.matchAll(/assets\/(?:app\.js|style\.css)\?v=([0-9]+[a-z]?)/g)) versions.add(m[1]);
}
for (const m of appJs.matchAll(/\?v=([0-9]+[a-z]?)/g)) versions.add(m[1]);
if (versions.size === 0) fail("no asset version (?v=…) found in html/app.js — cannot bump");
if (versions.size > 1) fail("inconsistent asset versions across files: " + [...versions].join(", ") + " — fix manually first");
const oldVersion = [...versions][0];
const newVersion = bumpVersion(oldVersion);
for (const f of htmlFiles) {
  if (read(f).includes("?v=" + oldVersion)) {
    edit(f, path.basename(f) + " asset version", "?v=" + oldVersion, "?v=" + newVersion, true);
  }
}
if (appJs.includes("?v=" + oldVersion)) {
  edit(APP_JS, "app.js asset version", "?v=" + oldVersion, "?v=" + newVersion, true);
}

// ---------- address guard ----------
// Allowed after the flip: every address-shaped value in the deployment
// record (the five contracts, the registry, the deployer, the QuestPass
// token), the Agent ID registry, the mainnet USDT/USDC presets, the demo
// sample holder, and the zero-address sentinel. Anything else found in
// app.js or a web/*.html page — as a bscscan.com/address/ link target or
// as a bare 0x address — is a stale hardcoded address and fails the flip.
const guardAllowed = new Set();
for (const v of Object.values(rec)) if (isAddr(v)) guardAllowed.add(v.toLowerCase());
for (const a of [AGENT_ID_REGISTRY, MAINNET_USDT, MAINNET_USDC, SAMPLE_HOLDER_ADDR, ZERO_ADDRESS]) guardAllowed.add(a.toLowerCase());
function addressGuard(getContent) {
  const offenders = [];
  for (const f of [APP_JS, ...htmlFiles]) {
    const content = getContent(f);
    const found = new Set();
    for (const m of content.matchAll(/bscscan\.com\/address\/(0x[0-9a-fA-F]{40})(?![0-9a-fA-F])/g)) found.add(m[1]);
    for (const m of content.matchAll(/0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g)) found.add(m[0]);
    for (const a of found) {
      if (!guardAllowed.has(a.toLowerCase())) offenders.push(fileLabel(f) + ": " + a);
    }
  }
  return offenders;
}

// ---------- validate the whole plan before touching anything ----------
const problems = [];
for (const e of edits) {
  if (e.find === e.replace) continue; // already at target value
  const n = countOccurrences(read(e.file), e.find);
  if (n === 0) problems.push("MISSING pattern for '" + e.label + "' in " + fileLabel(e.file));
  else if (n > 1 && !e.allowMultiple) problems.push("AMBIGUOUS pattern (" + n + "x) for '" + e.label + "' in " + fileLabel(e.file));
}
if (problems.length) {
  for (const p of problems) console.error(p);
  fail(problems.length + " pattern problem(s) — fix before flipping");
}

// Compute every file's new content in memory and syntax-check app.js.
const newContents = new Map();
for (const e of edits) {
  if (e.find === e.replace) continue;
  const base = newContents.has(e.file) ? newContents.get(e.file) : read(e.file);
  newContents.set(e.file, base.split(e.find).join(e.replace));
}
if (newContents.has(APP_JS)) {
  try {
    new vm.Script(newContents.get(APP_JS), { filename: "app.js" });
  } catch (e) {
    fail("flipped app.js would not parse: " + e.message);
  }
}
// Label sweep (pre-write): no em-dash testnet label ("— BSC testnet" /
// "— BSC 测试网") may survive in app.js — every address-table / feed label
// has an I18N_PAIRS entry, so a survivor means a pair is missing and the
// flipped site would keep calling a contract "testnet" in front of the
// judges. The f_chain_test dictionary line is exempt: its value is the
// bare chain name ("BSC testnet", no em-dash label form) used only while
// appsChainId is 97 — dead copy once the chain flips to 56.
function labelSweep(src, origin) {
  const bad = src.split("\n").filter((l) =>
    (l.includes("— BSC testnet") || l.includes("— BSC 测试网")) && !l.includes("f_chain_test"));
  if (bad.length) {
    fail("label sweep failed (" + origin + "): residual testnet label(s) in app.js — add the missing I18N_PAIRS entry: " +
      bad.map((s) => s.trim().slice(0, 90)).join(" | "));
  }
}
labelSweep(newContents.has(APP_JS) ? newContents.get(APP_JS) : appJs, "planned app.js");
// Address guard (pre-write, on the planned contents): a survivor here
// means the flipped site would present an address that is not one of
// ours — fail before anything is written, listing every offender.
const guardOffenders = addressGuard((f) => (newContents.has(f) ? newContents.get(f) : read(f)));
if (guardOffenders.length) {
  for (const o of guardOffenders) console.error("address guard: unexpected address in " + o);
  fail("address guard failed: " + guardOffenders.length + " address(es) in the flipped frontend are neither in the deploy record, the Agent ID registry, nor the mainnet token presets — fix the stale address(es) before flipping");
}

// ---------- report ----------
console.log(APPLY ? "FLIP — APPLY mode" : "FLIP — DRY-RUN (nothing will be written)");
console.log("record: " + addrPath);
console.log("web dir: " + webDir);
console.log("asset version: " + oldVersion + " -> " + newVersion + " (applied on --apply)");
console.log("address guard: PASS — every address in the flipped frontend is in the deploy record, the Agent ID registry, or a mainnet token preset");
console.log("");
let changes = 0;
for (const e of edits) {
  const fl = fileLabel(e.file);
  if (e.find === e.replace) {
    console.log("  = " + e.label + " [" + fl + "] already at target: " + e.replace);
    continue;
  }
  changes++;
  const n = countOccurrences(read(e.file), e.find);
  console.log("  - " + e.label + " [" + fl + "]" + (e.allowMultiple && n > 1 ? " (" + n + "x)" : ""));
  console.log("      old: " + e.find);
  console.log("      new: " + e.replace);
}
console.log("");
if (!APPLY) {
  console.log("DRY-RUN DONE — " + changes + " change(s) planned, no files written. Re-run with --apply to flip.");
  process.exit(0);
}

// ---------- apply (all validations already passed) ----------
for (const [file, content] of newContents) {
  fs.writeFileSync(file, content);
  console.log("wrote " + fileLabel(file));
}
// Post-write verification against the record.
const after = read(APP_JS);
for (const [name, val] of [["GATE_TESTNET", rec.humanGate], ["APPS_TESTNET", appsAddr], ["BINDINGS_TESTNET", rec.bindings], ["PROFILE_TESTNET", rec.profile], ["QUEST_TESTNET", NO_QUEST ? ZERO_ADDRESS : rec.quest]]) {
  if (extractConst(after, name).toLowerCase() !== val.toLowerCase()) fail("post-write check failed for " + name + " — investigate before pushing");
}
if (!after.includes("appsChainId: 56")) fail("post-write check failed: appsChainId is not 56");
if (!after.includes("const APPS_DEPLOY_BLOCK = " + appsBlock + ";")) fail("post-write check failed: APPS_DEPLOY_BLOCK");
for (const f of htmlFiles) {
  const html = read(f);
  if (html.includes("?v=" + oldVersion)) fail("post-write check failed: old asset version remains in " + path.basename(f));
}
// Post-write sweep: nothing testnet-flavoured may survive anywhere the
// flip touches — no testnet explorer domain, no unfilled Skill
// placeholder, no testnet nav badge.
for (const f of [APP_JS, SKILL_MD, ...htmlFiles]) {
  const content = read(f);
  if (content.includes("testnet.bscscan.com")) fail("post-write check failed: testnet.bscscan.com remains in " + fileLabel(f));
  if (content.includes("<span>testnet</span>")) fail("post-write check failed: <span>testnet</span> badge remains in " + fileLabel(f));
  const ph = content.match(/\{\{[^}]*MAINNET[^}]*\}\}/);
  if (ph) fail("post-write check failed: unfilled placeholder " + ph[0] + " remains in " + fileLabel(f));
}
labelSweep(after, "written app.js");
// Post-write address guard: re-scan the files as written (the pre-write
// run covered the planned contents; this proves the bytes on disk).
const postGuardOffenders = addressGuard((f) => read(f));
if (postGuardOffenders.length) {
  fail("post-write check failed: address guard: unexpected address in " + postGuardOffenders.join("; "));
}
console.log("FLIP DONE — frontend now points at the mainnet record in " + path.basename(addrPath) + ", asset version " + newVersion + ".");
console.log("Next steps stay manual (runbook): verify contracts on BscScan, push, then the launch-day self-checks.");
