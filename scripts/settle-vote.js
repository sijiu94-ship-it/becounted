// settle-vote.js — Minority-vote settlement recompute for OneIDCampaignsV11–V16
// (one ABI lineage: the Voted event and tally() reads are unchanged across
// V12–V16, and the V11 artifact ABI decodes V16 getCampaign returns — the
// trailing `weighted` field is ignored; verified 2026-11-27).
//
// Usage:
//   node scripts/settle-vote.js <campaignId> <prizeRawAmount>
//
//   <campaignId>      id of a VOTE campaign on OneIDCampaigns (V11–V16)
//   <prizeRawAmount>  total prize as an integer string in the raw units of
//                     the campaign's prize token (campaign.prizeToken; for
//                     vote campaigns this is address(0) on-chain — the prize
//                     itself is held off-contract and paid manually, so the
//                     amount is simply interpreted in raw units of whatever
//                     token the organiser pays out, e.g. 15 USDC = 15e18 raw
//                     units for BSC USDC).
//
// Mainnet settlement (the launch minority vote — see LAUNCH-RUNBOOK §8):
//   APPS_ADDRESS=<appsV16 from mainnet-address.json> \
//   DEPLOY_BLOCK=<appsV16Block from mainnet-address.json> \
//   CHAIN_ID=56 \
//   RPC_URLS=https://bsc-rpc.publicnode.com,https://bsc-dataseed.binance.org,https://bsc-dataseed1.bnbchain.org \
//   node scripts/settle-vote.js <campaignId> 15000000000000000000
//
// What it does (READ-ONLY — it never sends a transaction):
//   1. Reads the campaign; refuses anything that is not a Vote campaign or
//      has not ended yet (current block timestamp <= endAt).
//   2. Scans every Voted(id, participant, option) event for the campaign
//      from the apps deploy block to the chain head, sequentially in
//      10,000-block chunks on mainnet (public endpoints cap eth_getLogs at
//      10k blocks/call there; 45,000 on testnet), splitting a chunk in half
//      if it keeps failing, and recomputes the per-option tallies from the
//      events alone.
//   3. Cross-checks the recomputed tallies against the contract's tally()
//      storage reads. A mismatch is reported loudly and the payout file is
//      marked tallyVerified=false (exit code 2).
//   4. MINORITY RULE: the winning side is the option(s) with the MINIMUM
//      tally. TIE RULE: if several options tie at the minimum, the voters of
//      ALL tied options together form the winning side.
//      Edge case, surfaced explicitly: an option with zero votes has the
//      minimum tally (0) but no voters; if it is the (or a) minimum, the
//      winning side may be empty and the whole prize stays undistributed.
//      The script reports this instead of silently inventing a winner.
//   5. Splits the prize equally among winning-side voters:
//      perVoter = floor(prize / winnerCount); the integer-division remainder
//      ("dust") is reported explicitly and stays with the organiser.
//   6. Writes vote-payout-<id>.json next to this script's project root and
//      prints a human-readable summary. Anyone can re-run this script and
//      must get the same payout file — that is the point.
//
// Env overrides (defaults = the V11 testnet trial stack, so the
// settlement path can be rehearsed against it as-is):
//   APPS_ADDRESS   default 0x8Ce3052c7CcAFd29a58306981D2235433d386d32
//                  (OneIDCampaignsV11 testnet trial stack)
//   DEPLOY_BLOCK   default 144405789 (trial stack apps deploy block)
//   CHAIN_ID       default 97 (BSC testnet); 56 for mainnet
//   RPC_URLS       comma-separated read RPCs (tried in order per chunk)
//                  default: publicnode BSC testnet endpoints
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const APPS_ADDRESS = process.env.APPS_ADDRESS || "0x8Ce3052c7CcAFd29a58306981D2235433d386d32";
const DEPLOY_BLOCK = Number(process.env.DEPLOY_BLOCK || 144405789);
const CHAIN_ID = Number(process.env.CHAIN_ID || 97);
// Mainnet guard (added 2026-11-26 audit): the defaults above are the
// TESTNET trial stack. Running with CHAIN_ID=56 but the default
// APPS_ADDRESS would settle against a testnet address read on mainnet
// — refuse loudly instead of producing a plausible-looking wrong file.
if (CHAIN_ID === 56 && APPS_ADDRESS.toLowerCase() === "0x8ce3052c7ccafd29a58306981d2235433d386d32") {
  console.error("REFUSING: CHAIN_ID=56 but APPS_ADDRESS is the testnet trial default.");
  console.error("Set APPS_ADDRESS and DEPLOY_BLOCK from mainnet-address.json (appsV16 / appsV16Block) explicitly.");
  process.exit(1);
}
const RPC_URLS = (process.env.RPC_URLS || process.env.READ_RPC ||
  "https://bsc-testnet-rpc.publicnode.com,https://bsc-testnet.publicnode.com,https://bnb-testnet.api.onfinality.io/public"
).split(",").map((s) => s.trim()).filter(Boolean);
// Public mainnet endpoints cap eth_getLogs at 10,000 blocks per call
// (measured 2026-11-26 — see count-interactions.js); testnet tolerates more.
const CHUNK = CHAIN_ID === 56 ? 10000 : 45000;

const KIND_NAMES = ["Raffle", "Vote", "Claim"];

function artifact(name) {
  const p = path.join(__dirname, "..", "artifacts", "contracts", name + ".sol", name + ".json");
  return JSON.parse(fs.readFileSync(p, "utf8")).abi;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// Sequential chunked log scan with retry/backoff per chunk; a chunk that
// keeps failing is split in half recursively before giving up.
async function scanRange(filter, from, to, logs) {
  let attempt = 0;
  for (;;) {
    try {
      const part = await rpc("eth_getLogs", [{ ...filter, fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16) }]);
      logs.push(...part);
      return;
    } catch (e) {
      attempt++;
      if (attempt > 3) {
        if (to - from >= 1000) {
          const mid = from + Math.floor((to - from) / 2);
          console.error(`    chunk ${from}-${to} keeps failing (${e.message}) — splitting at ${mid}`);
          await scanRange(filter, from, mid, logs);
          await scanRange(filter, mid + 1, to, logs);
          return;
        }
        throw new Error(`eth_getLogs chunk ${from}-${to} failed after retries: ${e.message}`);
      }
      await sleep(1500 * attempt);
    }
  }
}

async function scanLogs(filter, fromBlock, toBlock) {
  const logs = [];
  for (let from = fromBlock; from <= toBlock; from += CHUNK) {
    await scanRange(filter, from, Math.min(from + CHUNK - 1, toBlock), logs);
    if (from + CHUNK <= toBlock) await sleep(250); // be gentle with public RPC rate limits
  }
  return logs;
}

async function main() {
  const [idArg, prizeArg] = process.argv.slice(2);
  if (idArg === undefined || prizeArg === undefined) {
    console.error("usage: node scripts/settle-vote.js <campaignId> <prizeRawAmount>");
    process.exit(1);
  }
  const campaignId = BigInt(idArg);
  if (!/^\d+$/.test(prizeArg)) {
    console.error("prizeRawAmount must be a non-negative integer string (raw token units)");
    process.exit(1);
  }
  const prize = BigInt(prizeArg);

  const provider = new ethers.JsonRpcProvider(RPC_URLS[0], CHAIN_ID, { staticNetwork: true });
  const apps = new ethers.Contract(APPS_ADDRESS, artifact("OneIDCampaignsV11"), provider);

  const count = await apps.campaignCount();
  if (campaignId >= count) throw new Error(`campaign ${campaignId} does not exist (count=${count})`);
  const c = await apps.getCampaign(campaignId);
  const kind = Number(c.kind);
  if (KIND_NAMES[kind] !== "Vote") throw new Error(`campaign ${campaignId} is a ${KIND_NAMES[kind]}, not a Vote — refusing to settle`);

  const head = await provider.getBlock("latest");
  if (BigInt(head.timestamp) <= c.endAt) {
    throw new Error(`campaign ${campaignId} has not ended yet (endAt=${c.endAt}, chain time=${head.timestamp})`);
  }

  const optionCount = Number(c.optionCount);
  console.log(`Campaign #${campaignId}: "${c.title}"`);
  console.log(`  kind=Vote options=${optionCount} token(prizeToken)=${c.prizeToken}`);
  console.log(`  window ${new Date(Number(c.startAt) * 1000).toISOString()} .. ${new Date(Number(c.endAt) * 1000).toISOString()} (ended)`);

  // 1) Recompute tallies from Voted events alone.
  const votedTopic = ethers.id("Voted(uint256,address,uint8)");
  const idTopic = ethers.zeroPadValue(ethers.toBeHex(campaignId), 32);
  const logs = await scanLogs(
    { address: APPS_ADDRESS, topics: [votedTopic, idTopic] },
    DEPLOY_BLOCK,
    head.number
  );
  const tallies = Array(optionCount).fill(0);
  const votersByOption = Array.from({ length: optionCount }, () => []);
  const seen = new Set();
  const duplicates = [];
  for (const log of logs) {
    const participant = ethers.getAddress("0x" + log.topics[2].slice(26));
    const option = Number(BigInt(log.data));
    if (option >= optionCount) throw new Error(`Voted event with out-of-range option ${option} in tx ${log.transactionHash}`);
    tallies[option]++;
    votersByOption[option].push(participant);
    const key = participant.toLowerCase();
    if (seen.has(key)) duplicates.push(participant);
    seen.add(key);
  }

  // 2) Cross-check against contract tally() storage.
  let tallyVerified = true;
  for (let o = 0; o < optionCount; o++) {
    const onChain = Number(await apps.tally(campaignId, o));
    if (onChain !== tallies[o]) {
      tallyVerified = false;
      console.error(`  !! TALLY MISMATCH option ${o}: events=${tallies[o]} contract=${onChain}`);
    }
  }
  console.log(`  Voted events scanned: ${logs.length} (blocks ${DEPLOY_BLOCK}..${head.number})`);
  console.log(`  tallies recomputed:   [${tallies.join(", ")}]  tallyVerified=${tallyVerified}`);
  if (duplicates.length) console.error(`  !! duplicate voters in events (contract should prevent this): ${duplicates.join(", ")}`);

  // 3) Minority rule (+ tie rule), as documented in the header.
  const minTally = Math.min(...tallies);
  const winningOptions = tallies.map((t, o) => (t === minTally ? o : -1)).filter((o) => o >= 0);
  const winners = [...new Set(winningOptions.flatMap((o) => votersByOption[o]))];
  const zeroVoteEdge = minTally === 0;

  // 4) Equal split with explicit dust.
  const perVoter = winners.length ? prize / BigInt(winners.length) : 0n;
  const dust = prize - perVoter * BigInt(winners.length);

  const payout = {
    campaignId: campaignId.toString(),
    appsAddress: APPS_ADDRESS,
    title: c.title,
    token: c.prizeToken,
    optionCount,
    startAt: c.startAt.toString(),
    endAt: c.endAt.toString(),
    settledAtBlock: head.number,
    totalVotes: logs.length,
    tallies: tallies.map((t, o) => ({ option: o, votes: t, voters: votersByOption[o] })),
    tallyVerified,
    duplicateVoters: duplicates,
    minorityTally: minTally,
    winningOptions,
    zeroVoteEdgeCase: zeroVoteEdge,
    prizeRaw: prize.toString(),
    perVoterRaw: perVoter.toString(),
    dustRaw: dust.toString(),
    winnerCount: winners.length,
    winners: winners.map((w) => ({ address: w, amountRaw: perVoter.toString() })),
  };

  const outPath = path.join(__dirname, "..", `vote-payout-${campaignId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(payout, null, 2));

  console.log("\n=== Minority-vote settlement ===");
  tallies.forEach((t, o) => console.log(`  option ${o}: ${t} vote(s)${winningOptions.includes(o) ? "  <- minority (winning side)" : ""}`));
  if (zeroVoteEdge) {
    console.log("  !! EDGE CASE: the minimum tally is 0 — an option nobody voted for is the");
    console.log("     'minority'. Its voter set is empty, so there may be nobody to pay.");
  }
  console.log(`  winning option(s): [${winningOptions.join(", ")}]  winners: ${winners.length}`);
  winners.forEach((w) => console.log(`    ${w}  ->  ${perVoter} (raw units)`));
  console.log(`  prize total: ${prize}  per-voter: ${perVoter}  dust (stays with organiser): ${dust}`);
  if (!winners.length) console.log("  !! winning side is EMPTY — the full prize remains undistributed.");
  console.log(`  payout file: ${outPath}`);

  if (!tallyVerified) process.exit(2);
  process.exit(0); // Node's fetch keep-alive pool can otherwise hold
  // the process open long after the work is done.
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
