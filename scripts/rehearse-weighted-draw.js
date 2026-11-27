// rehearse-weighted-draw.js — LOCAL REHEARSAL ONLY (hardhat node).
//
// Deploys MockRegistryV2 + BeCounted + CheckIn on a local
// `npx hardhat node`, issues mock Agent IDs to seven holders, walks
// them through a scripted 46-day check-in calendar (evm_setNextBlock
// Timestamp at Beijing-time noon of each simulated day), then writes
// /tmp/wd-rehearsal/setup.json + entrants.txt so the weighted-draw CLI
// can be run against the node exactly as it would be run in production:
//
//   npx hardhat node                                   (terminal 1)
//   npx hardhat run scripts/rehearse-weighted-draw.js --network localhost
//   node scripts/weighted-draw.js --checkin <addr> --rpc http://127.0.0.1:8545 \
//     --entrants-file /tmp/wd-rehearsal/entrants.txt --checkin-from-block <n> \
//     --seed-block <n> --winners 3 --out /tmp/wd-rehearsal/report.md
//   node scripts/weighted-draw.js --verify /tmp/wd-rehearsal/report.md
//
// Scripted calendar, relative to snapshot day T (all at CST noon):
//   A: T-29, T-15, T-1, T        -> 4 days in window  -> weight 5
//   B: T-30, T-29, T             -> T-30 is 30 days old = OUTSIDE,
//                                   2 in window      -> weight 3
//   C: T                         -> 1                -> weight 2
//   D: T-45, T-40                -> 0 in window      -> weight 1
//   E: T-9 .. T (10 straight)    -> 10               -> weight 11
//   F: (never checks in)         -> 0                -> weight 1
//   G: T-2, T-1, T               -> checks in but is NOT an entrant;
//                                   must not appear in the weight table
// Expected total weight = 5+3+2+1+11+1 = 23.
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");
const assert = require("assert");

const CST = 28800;
const DAY = 86400;
const cstDayOf = (ts) => Math.floor((ts + CST) / DAY);
const cstTs = (day, secs) => day * DAY - CST + secs;

const OUT_DIR = "/tmp/wd-rehearsal";

async function main() {
  const signers = await ethers.getSigners();
  const [issuer, A, B, C, D, E, F, G] = signers;

  const Mock = await ethers.getContractFactory("MockRegistryV2", issuer);
  const mock = await Mock.deploy();
  const Gate = await ethers.getContractFactory("BeCounted", issuer);
  const gate = await Gate.deploy(await mock.getAddress());
  const CheckIn = await ethers.getContractFactory("CheckIn", issuer);
  const checkin = await CheckIn.deploy(await gate.getAddress());
  const checkinAddr = await checkin.getAddress();
  const deployTx = checkin.deploymentTransaction();
  const checkinDeployBlock = (await deployTx.wait()).blockNumber;
  console.log("mock registry:", await mock.getAddress());
  console.log("gate:", await gate.getAddress());
  console.log("checkin:", checkinAddr, "deploy block:", checkinDeployBlock);

  for (const s of [A, B, C, D, E, F, G]) await mock.issue(s.address);

  const firstTs = (await ethers.provider.getBlock("latest")).timestamp;
  const T = cstDayOf(firstTs) + 46; // snapshot day; earliest check-in = T-45 = tomorrow CST
  console.log("snapshot day T =", T);

  // (dayOffset from T, signer) pairs, executed in chronological order.
  const plan = [];
  const add = (signer, offsets) => offsets.forEach((o) => plan.push({ day: T + o, signer }));
  add(A, [-29, -15, -1, 0]);
  add(B, [-30, -29, 0]);
  add(C, [0]);
  add(D, [-45, -40]);
  for (let o = -9; o <= 0; o++) add(E, [o]);
  add(G, [-2, -1, 0]);
  plan.sort((x, y) => x.day - y.day);

  let seq = 0;
  for (const step of plan) {
    const ts = cstTs(step.day, 12 * 3600 + seq * 97); // noon CST + a few minutes, strictly increasing
    seq++;
    await ethers.provider.send("evm_setNextBlockTimestamp", [ts]);
    const tx = await checkin.connect(step.signer).checkIn();
    await tx.wait();
  }
  console.log(`check-ins done: ${plan.length}`);

  // Two fresh blocks after the last check-in: snapshot = head-1, seed = head.
  await ethers.provider.send("evm_mine", []);
  await ethers.provider.send("evm_mine", []);
  const head = await ethers.provider.getBlockNumber();
  const seedBlock = head;
  const snapshotBlock = head - 1;
  const seed = await ethers.provider.getBlock(seedBlock);
  const snap = await ethers.provider.getBlock(snapshotBlock);
  assert.equal(cstDayOf(snap.timestamp), T, "snapshot block must sit in day T");
  assert.equal(cstDayOf(seed.timestamp), T, "seed block must sit in day T");
  console.log(`snapshot block ${snapshotBlock}, seed block ${seedBlock}, seed hash ${seed.hash}`);

  // Direct on-chain expectations (weightOf at head, same CST day as snapshot).
  const expected = new Map([
    [A.address, { windowDays: 4, weight: 5 }],
    [B.address, { windowDays: 2, weight: 3 }],
    [C.address, { windowDays: 1, weight: 2 }],
    [D.address, { windowDays: 0, weight: 1 }],
    [E.address, { windowDays: 10, weight: 11 }],
    [F.address, { windowDays: 0, weight: 1 }],
  ]);
  for (const [addr, exp] of expected) {
    const w = await checkin.weightOf(addr);
    assert.equal(w, BigInt(exp.weight), `weightOf(${addr}) should be ${exp.weight}, got ${w}`);
  }
  assert.equal(await checkin.weightOf(G.address), 4n, "G really did check in (3 days) — exclusion must come from the entrant list");
  console.log("weightOf assertions: all as expected");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Entrant file deliberately includes a comment, a blank line, a
  // duplicate (A twice) and one lowercase address (C) — the CLI parser
  // must dedupe and normalise all of it.
  const entrantsTxt = [
    "# API grand prize — entrants (rehearsal)",
    A.address,
    B.address,
    C.address.toLowerCase(),
    D.address,
    E.address,
    F.address,
    A.address, // duplicate on purpose
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, "entrants.txt"), entrantsTxt);

  const setup = {
    rpc: "http://127.0.0.1:8545",
    checkin: checkinAddr,
    checkinDeployBlock,
    entrantsFile: path.join(OUT_DIR, "entrants.txt"),
    entrants: [A, B, C, D, E, F].map((s) => s.address),
    nonEntrant: G.address,
    expected: Object.fromEntries(expected),
    totalWeight: 23,
    snapshotBlock,
    seedBlock,
    seedHash: seed.hash,
    winners: 3,
  };
  fs.writeFileSync(path.join(OUT_DIR, "setup.json"), JSON.stringify(setup, null, 2));
  console.log("setup written:", path.join(OUT_DIR, "setup.json"));
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
