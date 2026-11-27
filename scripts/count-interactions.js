// count-interactions.js — Count DISTINCT Agent ID holder addresses that
// have interacted with the submitted BeCounted contracts.
//
// Usage:
//   node scripts/count-interactions.js [--record <path>] [--json]
//
//   --record <path>  deployment record JSON to read contract addresses
//                    and deploy blocks from.
//                    Default: ../mainnet-address.json (written by
//                    scripts/deploy-mainnet.js at launch).
//                    For the testnet V11 trial stack:
//                      node scripts/count-interactions.js --record v11-address.json
//   --json           print ONLY a machine-readable JSON summary on
//                    stdout (progress goes to stderr) — for pasting the
//                    headline number into the submission draft's
//                    {{AGENT_ID_INTERACTION_COUNT}}.
//
// What it does (READ-ONLY — it never sends a transaction):
//   1. Loads the deployment record and auto-detects the chain from it
//      (record.chainId, else record.network, else the presence of a
//      mock registry => testnet 97; default mainnet 56).
//      Record keys are resolved tolerantly, following the conventions
//      of deploy-mainnet.js / mainnet-quest.js / settle-vote.js:
//        apps  : EVERY recorded version is scanned — appsV14 |
//                appsV13 | appsV12 | appsV11 | apps (blocks:
//                appsV14Block | ... | appsBlock) — the current
//                version alone would miss earlier mainnet activity,
//                and an old version alone misses everything current.
//        gate  : humanGate | gateV11 | gate       (verification only)
//        quest : quest | questNew          block: questBlock | questNewBlock
//                                                 | questTrial.deployBlock
//        bindings : bindingsV4 (+ bindingsV4Block) and the legacy
//                bindings V3 (+ bindingsBlock)
//        profile  : profile (+ profileBlock)
//        checkin  : read from the sibling checkin-address.json —
//                its `mainnet` entry on chain 56, its top-level
//                entry on chain 97.
//   2. Scans event logs from each contract's deploy block to the chain
//      head, sequentially in 45,000-block chunks (publicnode caps
//      eth_getLogs at 50k blocks and rate-limits bursts; settle-vote.js
//      uses the same chunking). If a chunk keeps failing on every RPC
//      it is split in half recursively down to 5,000 blocks — mainnet
//      log access from some endpoints is more restricted than testnet.
//        OneIDCampaigns (each recorded version): Entered, Voted,
//                        Claimed, PrizeClaimed (participant/winner is
//                        the 2nd indexed topic)
//        QuestPass:      Stamped, FinaleEntered, PrizeClaimed
//                        (who/winner is the 1st indexed topic)
//        CheckIn:        CheckedIn (user is the 1st indexed topic)
//        IdentityBindings V4: BindingRegistered, SelfBindingRegistered
//                        (who is the 1st indexed topic); V3 adds
//                        AttestedBindingRegistered
//        IdentityProfile: ProfileSet (who is the 1st indexed topic)
//   3. Deduplicates every participant address across BOTH contracts.
//   4. Verifies each unique address is really an Agent ID holder:
//        mainnet (56): balanceOf(address) > 0 on the real SPACE ID
//                      Agent ID registry
//                      0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F
//                      (single eth_calls only — no log scans against
//                      the registry, which is the restricted path).
//        testnet (97): gate.isHuman(address) on the record's gate
//                      (BeCounted), falling back to balanceOf on the
//                      record's mockRegistryV2 if no gate is recorded.
//                      NOTE: on the V11 trial stack the gate reads a
//                      MOCK registry, so "verified" there only means
//                      "holds a mock Agent ID in the trial registry" —
//                      the testnet run proves the counting/dedup logic,
//                      not real-world holder status.
//   5. Prints: total unique interactors, unique VERIFIED holders (the
//      headline number for the >=30-interactions contest requirement),
//      per-contract and per-event breakdowns, the address list, and —
//      grouped by prize token — the raw totals paid out via Claimed /
//      PrizeClaimed (raw units; decimals differ per token, so amounts
//      are NOT summed across tokens).
//
// Env overrides:
//   RPC_URLS  comma-separated read RPCs (tried in order per call)
//             defaults: settle-vote.js testnet list (chain 97) or the
//             deploy-mainnet.js mainnet read list (chain 56).
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const REGISTRY_MAINNET = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
let CHUNK = 45000; // mainnet: lowered to 10000 after CHAIN_ID is known
                   // (publicnode caps mainnet eth_getLogs ranges at
                   // 10000 blocks and rate-limits bursts)
const MIN_CHUNK = 5000;

const RPC_DEFAULTS = {
  56: "https://bsc-rpc.publicnode.com,https://bsc-dataseed.binance.org,https://bsc-dataseed1.bnbchain.org,https://bsc-dataseed2.bnbchain.org,https://bnbchain.api.onfinality.io/public",
  97: "https://bsc-testnet-rpc.publicnode.com,https://bsc-testnet.publicnode.com,https://bnb-testnet.api.onfinality.io/public",
};

// ---- args -------------------------------------------------------------
const argv = process.argv.slice(2);
const JSON_MODE = argv.includes("--json");
let recordPath = path.join(__dirname, "..", "mainnet-address.json");
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--record") {
    const p = argv[++i];
    if (!p) { console.error("usage: node scripts/count-interactions.js [--record <path>] [--json]"); process.exit(1); }
    recordPath = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  } else if (argv[i] !== "--json") {
    console.error("unknown argument: " + argv[i]);
    console.error("usage: node scripts/count-interactions.js [--record <path>] [--json]");
    process.exit(1);
  }
}
const log = (...a) => (JSON_MODE ? console.error(...a) : console.log(...a));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function artifact(name) {
  const p = path.join(__dirname, "..", "artifacts", "contracts", name + ".sol", name + ".json");
  return JSON.parse(fs.readFileSync(p, "utf8")).abi;
}

// ---- record resolution --------------------------------------------------
if (!fs.existsSync(recordPath)) {
  console.error("deployment record not found: " + recordPath);
  console.error("(mainnet-address.json is written by scripts/deploy-mainnet.js at launch;");
  console.error(" for the testnet trial stack use: --record v11-address.json)");
  process.exit(1);
}
const rec = JSON.parse(fs.readFileSync(recordPath, "utf8"));

const CHAIN_ID = Number(
  rec.chainId ??
  (typeof rec.network === "string" && rec.network.includes("testnet") ? 97 :
   typeof rec.network === "string" && rec.network.includes("mainnet") ? 56 :
   rec.mockRegistryV2 ? 97 : 56)
);
const RPC_URLS = (process.env.RPC_URLS || RPC_DEFAULTS[CHAIN_ID] || RPC_DEFAULTS[56])
  .split(",").map((s) => s.trim()).filter(Boolean);
if (CHAIN_ID === 56) CHUNK = 10000;

const pick = (...keys) => {
  for (const k of keys) if (rec[k]) return rec[k];
  return null;
};
// Every recorded OneIDCampaigns version gets scanned (newest first).
const APPS_VERSIONS = [];
for (const [label, akey, bkey] of [["V18", "appsV18", "appsV18Block"], ["V17", "appsV17", "appsV17Block"], ["V16", "appsV16", "appsV16Block"], ["V15", "appsV15", "appsV15Block"], ["V14", "appsV14", "appsV14Block"], ["V13", "appsV13", "appsV13Block"], ["V12", "appsV12", "appsV12Block"], ["V11", "appsV11", "appsV11Block"]]) {
  if (rec[akey]) APPS_VERSIONS.push({ label, address: rec[akey], block: Number(rec[bkey] ?? rec.appsBlock ?? 0) });
}
if (!APPS_VERSIONS.length && rec.apps) APPS_VERSIONS.push({ label: "apps", address: rec.apps, block: Number(rec.appsBlock ?? 0) });
const QUEST = pick("quest", "questNew");
const QUEST_BLOCK = Number(pick("questBlock", "questNewBlock") ?? rec.questTrial?.deployBlock ?? 0);
const GATE = pick("humanGate", "gateV11", "gate");
const MOCK_REGISTRY = pick("mockRegistryV2", "mockRegistry");
const REGISTRY = pick("registry") || REGISTRY_MAINNET;
// Bindings + profile live in the same record; CheckIn lives in the
// sibling checkin-address.json (mainnet entry nested under `mainnet`).
const BINDINGS_V4 = rec.bindingsV4 ? { address: rec.bindingsV4, block: Number(rec.bindingsV4Block ?? 0) } : null;
const BINDINGS_V3 = rec.bindings ? { address: rec.bindings, block: Number(rec.bindingsBlock ?? 0) } : null;
const PROFILE = rec.profile ? { address: rec.profile, block: Number(rec.profileBlock ?? 0) } : null;
let CHECKIN = null;
let CHECKIN_V1 = null;
try {
  const cj = JSON.parse(fs.readFileSync(path.join(path.dirname(recordPath), "checkin-address.json"), "utf8"));
  const entry = CHAIN_ID === 56 ? (cj.mainnetV2 || cj.mainnet) : cj;
  if (entry && entry.checkIn) CHECKIN = { address: entry.checkIn, block: Number(entry.checkInBlock ?? 0) };
  // V1 stays deployed and its CheckedIn events are still project
  // interactions — count them under their own watermark section.
  if (CHAIN_ID === 56 && cj.mainnet && cj.mainnet.checkIn) CHECKIN_V1 = { address: cj.mainnet.checkIn, block: Number(cj.mainnet.checkInBlock ?? 0) };
} catch { /* no checkin record — scanner skips */ }

// ---- incremental scan state (watermarks) ---------------------------------
// A full deploy-block-to-head sweep is unavoidable ONCE; after that,
// re-scanning the whole range every run wastes the free-RPC rate
// budget (the 2026-11-26 mainnet runs died of -32005 that way). Each
// successful run therefore persists, per contract section: the head
// block it reached and the unique addresses found so far. The next
// run starts OVERLAP blocks before the saved watermark (BSC reorgs
// are a few blocks at most) and merges. The state file is written
// ONLY at the end of a fully successful run — a run that dies mid-way
// never advances a watermark past blocks it did not scan.
const OVERLAP = 100;
const STATE_PATH = path.join(__dirname, "state", `count-state-${CHAIN_ID}.json`);
let scanState = { chainId: CHAIN_ID, sections: {} };
try {
  const s = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  if (s.chainId === CHAIN_ID && s.sections) scanState = s;
} catch { /* no state yet — first run sweeps from the deploy blocks */ }

function sectionFrom(key, deployBlock, address) {
  const sec = scanState.sections[key];
  if (!sec || !sec.lastBlock) return { from: deployBlock, prior: [], priorPayouts: [] };
  // A section key must never silently change which contract it describes:
  // if the stored section names a different address than the one this key
  // resolves to now (e.g. the "checkin" key outliving CheckIn V1 and being
  // reused for V2), the prior uniques belong to the OLD contract — reset.
  if (address && sec.address && sec.address.toLowerCase() !== address.toLowerCase()) {
    return { from: deployBlock, prior: [], priorPayouts: [] };
  }
  return {
    from: Math.max(deployBlock, sec.lastBlock - OVERLAP + 1),
    prior: sec.unique ?? [],
    priorPayouts: sec.payouts ?? [],
  };
}

function saveScanState(head, scans) {
  for (const s of scans) {
    if (!s || !s.key) continue;
    scanState.sections[s.key] = {
      lastBlock: head,
      address: s.address,
      unique: s.unique,
      payouts: (s.payouts ?? []).map((p) => p.campaignId !== undefined
        ? { campaignId: p.campaignId, amount: p.amount.toString() }
        : { amount: p.toString() }),
    };
  }
  scanState.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(scanState, null, 2));
}

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
    } catch (e) {
      last = e;
    }
  }
  throw last ?? new Error("all RPCs failed for " + method);
}

// Sequential chunked log scan. Each chunk is retried (the rpc() helper
// already rotates endpoints per attempt); a chunk that still fails is
// split in half down to MIN_CHUNK blocks before giving up.
async function scanChunk(filter, from, to) {
  let attempt = 0;
  for (;;) {
    try {
      return await rpc("eth_getLogs", [{ ...filter, fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16) }]);
    } catch (e) {
      attempt++;
      if (attempt > 3) {
        if (to - from + 1 > MIN_CHUNK) {
          const mid = from + Math.floor((to - from) / 2);
          log(`    chunk ${from}-${to} keeps failing (${e.message.slice(0, 80)}) — splitting at ${mid}`);
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
  for (let from = fromBlock; from <= toBlock; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, toBlock);
    const part = await scanChunk(filter, from, to);
    logs.push(...part);
    log(`    ${label}: blocks ${from}-${to} -> ${part.length} log(s)`);
    if (to < toBlock) await sleep(1000); // be gentle with public RPC rate limits (raised from 250ms after a -32005 rate-limit kill on 2026-11-26)
  }
  return logs;
}

// ---- holder verification --------------------------------------------------
const ERC721_MIN = new ethers.Interface(["function balanceOf(address) view returns (uint256)"]);
const GATE_MIN = new ethers.Interface(["function isHuman(address) view returns (bool)"]);

async function ethCallBoolOrBalance(iface, fn, to, addr) {
  const data = iface.encodeFunctionData(fn, [addr]);
  const out = await rpc("eth_call", [{ to, data }, "latest"]);
  return iface.decodeFunctionResult(fn, out)[0];
}

async function isVerifiedHolder(addr) {
  if (CHAIN_ID === 56) {
    const bal = await ethCallBoolOrBalance(ERC721_MIN, "balanceOf", REGISTRY, addr);
    return bal > 0n;
  }
  if (GATE) return Boolean(await ethCallBoolOrBalance(GATE_MIN, "isHuman", GATE, addr));
  if (MOCK_REGISTRY) {
    const bal = await ethCallBoolOrBalance(ERC721_MIN, "balanceOf", MOCK_REGISTRY, addr);
    return bal > 0n;
  }
  throw new Error("testnet record has neither a gate nor a mock registry — cannot verify holders");
}

// ---- per-contract scans ---------------------------------------------------
async function scanApps(head, version) {
  const APPS = version.address, APPS_BLOCK = version.block;
  const key = `apps${version.label}`;
  const { from, prior, priorPayouts } = sectionFrom(key, APPS_BLOCK);
  const iface = new ethers.Interface(artifact("OneIDCampaignsV11"));
  // Fast path (added 2026-11-26): a campaigns contract whose
  // campaignCount() is 0 cannot have emitted any of the events below,
  // so its (large) log ranges are skipped outright. Without this the
  // mainnet run burns its free-RPC rate budget on ~90 empty calls and
  // dies with -32005 before reaching the contracts that actually have
  // activity (CheckIn / Bindings / Profile).
  try {
    const out = await rpc("eth_call", [{ to: APPS, data: iface.encodeFunctionData("campaignCount", []) }, "latest"]);
    const count = BigInt(iface.decodeFunctionResult("campaignCount", out)[0]);
    if (count === 0n) {
      log(`    apps${version.label}: campaignCount 0 — no events possible, log scan skipped`);
      return { key, label: version.label, address: APPS, fromBlock: APPS_BLOCK, scannedFrom: from, events: { Entered: 0, Voted: 0, Claimed: 0, PrizeClaimed: 0 }, unique: [...new Set(prior)], payouts: priorPayouts.map((p) => ({ campaignId: p.campaignId, amount: BigInt(p.amount) })) };
    }
  } catch (e) {
    log(`    apps${version.label}: campaignCount read failed (${String(e.message).slice(0, 60)}) — falling back to log scan`);
  }
  const topics = {
    Entered: ethers.id("Entered(uint256,address)"),
    Voted: ethers.id("Voted(uint256,address,uint8)"),
    Claimed: ethers.id("Claimed(uint256,address,uint256)"),
    PrizeClaimed: ethers.id("PrizeClaimed(uint256,address,uint256)"),
  };
  const events = {};
  const unique = new Set(prior);
  const payouts = priorPayouts.map((p) => ({ campaignId: p.campaignId, amount: BigInt(p.amount) })); // {campaignId, amount}
  for (const [name, topic] of Object.entries(topics)) {
    const logs = await scanLogs({ address: APPS, topics: [topic] }, from, head, `apps${version.label}/${name}`);
    events[name] = logs.length;
    for (const raw of logs) {
      const parsed = iface.parseLog({ topics: raw.topics, data: raw.data });
      const who = parsed.args.participant ?? parsed.args.winner;
      unique.add(ethers.getAddress(who));
      if (name === "Claimed" || name === "PrizeClaimed") {
        payouts.push({ campaignId: parsed.args.id.toString(), amount: parsed.args.amount });
      }
    }
  }
  return { key, label: version.label, address: APPS, fromBlock: APPS_BLOCK, scannedFrom: from, events, unique: [...unique], payouts };
}

// Generic scanner for contracts whose participant is the FIRST indexed
// topic of every event of interest (CheckIn, IdentityBindings,
// IdentityProfile). No payout tracking.
async function scanSimple(label, target, head, eventSigs) {
  if (!target) { log(`  ${label}: no address in record — skipped`); return null; }
  const { from, prior } = sectionFrom(label, target.block, target.address);
  const events = {};
  const unique = new Set(prior);
  for (const sig of eventSigs) {
    const name = sig.slice(0, sig.indexOf("("));
    const logs = await scanLogs({ address: target.address, topics: [ethers.id(sig)] }, from, head, `${label}/${name}`);
    events[name] = logs.length;
    for (const raw of logs) unique.add(ethers.getAddress("0x" + raw.topics[1].slice(26)));
  }
  return { key: label, label, address: target.address, fromBlock: target.block, scannedFrom: from, events, unique: [...unique], payouts: [] };
}

async function scanQuest(head) {
  if (!QUEST) { log("  QuestPass: no quest address in record — skipped"); return null; }
  const { from, prior, priorPayouts } = sectionFrom("quest", QUEST_BLOCK);
  const iface = new ethers.Interface(artifact("QuestPass"));
  const topics = {
    Stamped: ethers.id("Stamped(address,uint32,uint256)"),
    FinaleEntered: ethers.id("FinaleEntered(address)"),
    PrizeClaimed: ethers.id("PrizeClaimed(address,uint256)"),
  };
  const events = {};
  const unique = new Set(prior);
  const payouts = priorPayouts.map((p) => BigInt(p.amount)); // amounts (all in quest.token())
  for (const [name, topic] of Object.entries(topics)) {
    const logs = await scanLogs({ address: QUEST, topics: [topic] }, from, head, `quest/${name}`);
    events[name] = logs.length;
    for (const raw of logs) {
      const parsed = iface.parseLog({ topics: raw.topics, data: raw.data });
      const who = parsed.args.who ?? parsed.args.winner;
      unique.add(ethers.getAddress(who));
      if (name === "PrizeClaimed") payouts.push(parsed.args.amount);
    }
  }
  return { key: "quest", address: QUEST, fromBlock: QUEST_BLOCK, scannedFrom: from, events, unique: [...unique], payouts };
}

// Group apps payouts by the campaign's prize token (one getCampaign
// read per campaign that actually paid out — cheap). Best-effort: on
// any failure the raw per-campaign sums are reported ungrouped.
async function groupAppsPayouts(scan) {
  if (!scan || !scan.payouts.length) return {};
  const byCampaign = new Map();
  for (const p of scan.payouts) byCampaign.set(p.campaignId, (byCampaign.get(p.campaignId) ?? 0n) + p.amount);
  const byToken = {};
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URLS[0], CHAIN_ID, { staticNetwork: true });
    const apps = new ethers.Contract(scan.address, artifact("OneIDCampaignsV11"), provider);
    for (const [id, sum] of byCampaign) {
      const c = await apps.getCampaign(BigInt(id));
      const token = ethers.getAddress(c.prizeToken);
      byToken[token] = (byToken[token] ?? 0n) + sum;
    }
  } catch {
    for (const [id, sum] of byCampaign) byToken[`campaign#${id} (token lookup failed)`] = sum;
  }
  return Object.fromEntries(Object.entries(byToken).map(([k, v]) => [k, v.toString()]));
}

async function questPayoutTotal(scan) {
  if (!scan || !scan.payouts.length) return null;
  const total = scan.payouts.reduce((a, b) => a + b, 0n);
  let token = null;
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URLS[0], CHAIN_ID, { staticNetwork: true });
    const q = new ethers.Contract(scan.address, artifact("QuestPass"), provider);
    token = ethers.getAddress(await q.token());
  } catch { /* token address is a nice-to-have; the raw total stands */ }
  return { token, totalRaw: total.toString() };
}

// ---- main -------------------------------------------------------------------
async function main() {
  log(`=== BeCounted interaction count ===`);
  log(`record: ${recordPath}`);
  log(`chainId: ${CHAIN_ID} (${CHAIN_ID === 56 ? "BSC mainnet" : CHAIN_ID === 97 ? "BSC testnet" : "custom"})`);
  for (const v of APPS_VERSIONS) if (!v.block) log(`  WARNING: no deploy block for apps ${v.label} — scanning from block 0 (slow)`);
  if (QUEST && !QUEST_BLOCK) log("  WARNING: no quest deploy block in record — scanning quest from block 0 (slow)");

  const head = parseInt(await rpc("eth_blockNumber", []), 16);
  log(`chain head: ${head}`);

  const appsScans = [];
  for (const v of APPS_VERSIONS) {
    log(`scanning OneIDCampaigns ${v.label} events…`);
    appsScans.push(await scanApps(head, v));
  }
  log("scanning QuestPass events…");
  const quest = await scanQuest(head);
  log("scanning CheckInV2 events…");
  const checkin = await scanSimple("checkinV2", CHECKIN, head, ["CheckedIn(address,uint256,uint256)"]);
  log("scanning CheckIn V1 (legacy) events…");
  const checkinV1 = await scanSimple("checkinV1", CHECKIN_V1, head, ["CheckedIn(address,uint256,uint256)"]);
  log("scanning IdentityBindingsV4 events…");
  const bindingsV4 = await scanSimple("bindingsV4", BINDINGS_V4, head, ["BindingRegistered(address,string)", "SelfBindingRegistered(address,string,uint256)"]);
  log("scanning IdentityBindings (legacy V3) events…");
  const bindingsV3 = await scanSimple("bindingsV3", BINDINGS_V3, head, ["BindingRegistered(address,string)", "AttestedBindingRegistered(address,string)"]);
  log("scanning IdentityProfile events…");
  const profile = await scanSimple("profile", PROFILE, head, ["ProfileSet(address,uint8)"]);

  const allScans = [...appsScans, quest, checkin, checkinV1, bindingsV4, bindingsV3, profile];
  const all = new Set();
  for (const s of allScans) if (s) for (const a of s.unique) all.add(a);
  const unique = [...all].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const method = CHAIN_ID === 56
    ? `registry balanceOf > 0 on ${REGISTRY}`
    : GATE ? `gate.isHuman on ${GATE} (mock registry behind it on testnet)` : `mock registry balanceOf > 0 on ${MOCK_REGISTRY}`;
  log(`verifying ${unique.length} unique address(es) — method: ${method}`);
  const holders = [];
  const nonHolders = [];
  for (const addr of unique) {
    (await isVerifiedHolder(addr) ? holders : nonHolders).push(addr);
  }

  const appsPayoutsByToken = {};
  for (const s of appsScans) {
    const m = await groupAppsPayouts(s);
    for (const [k, v] of Object.entries(m)) appsPayoutsByToken[k] = ((BigInt(appsPayoutsByToken[k] ?? "0")) + BigInt(v)).toString();
  }
  const questPayout = await questPayoutTotal(quest);
  const scanSummary = (s) => s && {
    address: s.address, fromBlock: s.fromBlock, scannedFromBlock: s.scannedFrom ?? s.fromBlock,
    events: s.events, uniqueInteractors: s.unique.length, uniqueAddresses: s.unique,
  };

  const summary = {
    record: recordPath,
    chainId: CHAIN_ID,
    headBlock: head,
    generatedAt: new Date().toISOString(),
    appsVersions: appsScans.map((s) => ({ label: s.label, ...scanSummary(s), payoutsByTokenRaw: appsPayoutsByToken })),
    quest: scanSummary(quest) && { ...scanSummary(quest), prizeClaimedTotal: questPayout },
    checkinV2: scanSummary(checkin),
    checkinV1: scanSummary(checkinV1),
    bindingsV4: scanSummary(bindingsV4),
    bindingsV3: scanSummary(bindingsV3),
    profile: scanSummary(profile),
    totalUniqueInteractors: unique.length,
    verifiedHolderMethod: method,
    uniqueVerifiedHolders: holders.length,
    holders,
    nonHolders,
    allUniqueAddresses: unique,
  };

  // Persist watermarks only now — every scan and the holder
  // verification above completed without throwing.
  saveScanState(head, allScans);
  log(`scan state saved: ${STATE_PATH} (watermarks at block ${head})`);

  if (JSON_MODE) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log("");
  const DISPLAY = { checkinV2: "CheckInV2", checkinV1: "CheckIn V1 (legacy)", bindingsV4: "IdentityBindingsV4", bindingsV3: "IdentityBindingsV3 (legacy)", profile: "IdentityProfile" };
  for (const s of allScans) {
    if (!s) continue;
    const name = s.label && DISPLAY[s.label] ? DISPLAY[s.label] : s.label ? `OneIDCampaigns ${s.label}` : "QuestPass";
    console.log(`${name} ${s.address} (from block ${s.fromBlock}):`);
    console.log(`  events: ${Object.entries(s.events).map(([k, v]) => `${k} x${v}`).join(" · ")}`);
    console.log(`  unique interactors: ${s.unique.length}`);
  }
  console.log("");
  console.log(`TOTAL unique interactors (all contracts, deduplicated): ${unique.length}`);
  console.log(`UNIQUE VERIFIED Agent ID HOLDERS: ${holders.length}   <-- headline (contest needs >= 30)`);
  console.log(`  verification: ${method}`);
  if (CHAIN_ID !== 56) {
    console.log("  NOTE: testnet verification reads the trial stack's MOCK registry — it proves");
    console.log("        the counting/dedup logic, not real Agent ID holder status.");
  }
  console.log("");
  console.log("addresses (✓ = verified holder, ✗ = interacted but not a verified holder):");
  for (const a of unique) console.log(`  ${holders.includes(a) ? "✓" : "✗"} ${a}`);
  const paidOut = Object.entries(appsPayoutsByToken);
  if (paidOut.length || questPayout) {
    console.log("");
    console.log("paid out via Claimed/PrizeClaimed (RAW units, grouped by prize token — not summed across tokens):");
    for (const [token, total] of paidOut) console.log(`  apps · token ${token}: ${total}`);
    if (questPayout) console.log(`  quest · token ${questPayout.token ?? "(lookup failed)"}: ${questPayout.totalRaw}`);
  }
  process.exit(0); // Node's fetch keep-alive pool can otherwise hold
  // the process open long after the work is done.
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
