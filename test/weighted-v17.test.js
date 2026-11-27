const { ethers } = require("hardhat");
const assert = require("assert");

// =====================================================================
// OneIDCampaignsV17 — weighted raffle draws (check-in weight).
// The core assertion style: after an on-chain draw, recompute the
// expected winners in JS from the Drawn event's seed and the weights
// read from CheckInV2 — the contract must match bit for bit.
// =====================================================================

async function expectRevert(p, errName) {
  try { await p; } catch (e) {
    if (errName && !String(e.message).includes(errName)) throw new Error(`reverted but not with ${errName}: ${String(e.message).slice(0, 200)}`);
    return;
  }
  throw new Error(`expected revert ${errName || ""} but call succeeded`);
}

async function warp(secs) { await ethers.provider.send("evm_increaseTime", [secs]); await ethers.provider.send("evm_mine", []); }
async function mine(n) { for (let i = 0; i < n; i++) await ethers.provider.send("evm_mine", []); }
async function warpTo(ts) {
  const now = (await ethers.provider.getBlock("latest")).timestamp;
  if (ts <= now) return;
  await ethers.provider.send("evm_setNextBlockTimestamp", [ts]); await ethers.provider.send("evm_mine", []);
}

const CST = 28800, DAY = 86400;
const cstDayOf = (ts) => Math.floor((ts + CST) / DAY);
const cstTs = (day, secs) => day * DAY - CST + secs;

const MAXU = ethers.MaxUint256;
const NO_COND = { requireBinding: false, gateToken: ethers.ZeroAddress, gateMin: 0n, gateIs721: false, requireEnteredId: MAXU, minStamps: 0, questRef: ethers.ZeroAddress, allowRoot: ethers.ZeroHash, idListRoot: ethers.ZeroHash };

const abi = ethers.AbiCoder.defaultAbiCoder();
const pickRand = (seed, p) => BigInt(ethers.keccak256(abi.encode(["uint256", "uint256"], [seed, p])));

// Mirror of the contract's weighted selection.
function expectedWeighted(entries, weights, seed, k) {
  const idx = entries.map((_, i) => i);
  let remaining = weights.reduce((a, b) => a + b, 0n);
  const out = [];
  for (let p = 0; p < k; p++) {
    const r = pickRand(seed, p) % remaining;
    let acc = 0n, chosen = p;
    for (let j = p; j < entries.length; j++) {
      acc += weights[idx[j]];
      if (r < acc) { chosen = j; break; }
    }
    [idx[p], idx[chosen]] = [idx[chosen], idx[p]];
    remaining -= weights[idx[p]];
    out.push(entries[idx[p]]);
  }
  return out;
}

// Mirror of the contract's equal-odds partial Fisher-Yates.
function expectedEqual(entries, seed, k) {
  const idx = entries.map((_, i) => i);
  const n = entries.length;
  const out = [];
  for (let i = 0; i < k; i++) {
    const j = i + Number(pickRand(seed, i) % BigInt(n - i));
    [idx[i], idx[j]] = [idx[j], idx[i]];
    out.push(entries[idx[i]]);
  }
  return out;
}

describe("OneIDCampaignsV17 weighted raffle draws", function () {
  let mock, gate, bindings, checkin, apps, deployer, creator, alice, bob, carol, dave, eve;

  beforeEach(async function () {
    [deployer, creator, alice, bob, carol, dave, eve] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", deployer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", deployer);
    gate = await Gate.deploy(await mock.getAddress());
    const Bind = await ethers.getContractFactory("IdentityBindingsV4", deployer);
    bindings = await Bind.deploy();
    const CI = await ethers.getContractFactory("CheckInV2", deployer);
    checkin = await CI.deploy(await gate.getAddress());
    const Apps = await ethers.getContractFactory("OneIDCampaignsV17", deployer);
    apps = await Apps.deploy(await gate.getAddress(), await bindings.getAddress(), await checkin.getAddress());
    for (const u of [alice, bob, carol, dave]) await mock.issue(u.address);
    // eve: no Agent ID.
  });

  async function now() { return (await ethers.provider.getBlock("latest")).timestamp; }

  // Give alice 3 check-in days, carol 1, dave 2, bob none — all inside
  // the 14-day window ending today. Returns nothing; weights end up
  // alice 4, bob 1, carol 2, dave 3.
  async function seedWeights() {
    const t0 = await now();
    const d = cstDayOf(t0);
    await warpTo(cstTs(d, 12 * 3600));
    await checkin.connect(alice).checkIn();                   // d
    await checkin.connect(dave).checkIn();                    // d
    await warpTo(cstTs(d + 1, 12 * 3600));
    await checkin.connect(alice).checkIn();                   // d+1
    await warpTo(cstTs(d + 2, 12 * 3600));
    await checkin.connect(alice).checkIn();                   // d+2
    await checkin.connect(carol).checkIn();                   // d+2
    await checkin.connect(dave).checkIn();                    // d+2
    assert.equal(await checkin.weightOf(alice.address), 4n);
    assert.equal(await checkin.weightOf(bob.address), 1n);
    assert.equal(await checkin.weightOf(carol.address), 2n);
    assert.equal(await checkin.weightOf(dave.address), 3n);
  }

  async function makeRaffle(winnerCount, weighted, dur = 3600) {
    const t = await now();
    const tx = await apps.connect(creator).createRaffle("w raffle", t - 10, t + dur, winnerCount,
      ethers.ZeroAddress, 0n, NO_COND, "加权奖品", weighted);
    const rc = await tx.wait();
    const ev = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "CampaignCreated");
    return Number(ev.args.id);
  }

  async function drawAndGetSeed(id) {
    await apps.lockDraw(id);
    await mine(3);
    const tx = await apps.draw(id);
    const rc = await tx.wait();
    const evs = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } }).filter(Boolean);
    const drawn = evs.find(e => e.name === "Drawn");
    const wEv = evs.find(e => e.name === "DrawWeighted");
    return { seed: drawn.args.seed, totalWeight: wEv ? wEv.args.totalWeight : null };
  }

  it("weighted draw matches the JS recomputation exactly (1 winner)", async function () {
    await seedWeights();
    const id = await makeRaffle(1, true);
    const entries = [alice, bob, carol, dave];
    for (const u of entries) await apps.connect(u).enterRaffle(id, [], []);
    const c = await apps.getCampaign(id);
    assert.equal(c.weighted, true);
    await warp(3600 + 60);
    const { seed, totalWeight } = await drawAndGetSeed(id);
    assert.equal(totalWeight, 10n);
    const expected = expectedWeighted(entries.map(u => u.address), [4n, 1n, 2n, 3n], seed, 1);
    const winners = await apps.getWinners(id);
    assert.deepEqual(winners.map(a => a.toLowerCase()), expected.map(a => a.toLowerCase()));
  });

  it("weighted draw matches recomputation for 2 winners, no replacement", async function () {
    await seedWeights();
    const id = await makeRaffle(2, true);
    const entries = [alice, bob, carol, dave];
    for (const u of entries) await apps.connect(u).enterRaffle(id, [], []);
    await warp(3600 + 60);
    const { seed } = await drawAndGetSeed(id);
    const expected = expectedWeighted(entries.map(u => u.address), [4n, 1n, 2n, 3n], seed, 2);
    const winners = await apps.getWinners(id);
    assert.deepEqual(winners.map(a => a.toLowerCase()), expected.map(a => a.toLowerCase()));
    assert.notEqual(winners[0].toLowerCase(), winners[1].toLowerCase());
  });

  it("all-equal weights still draw fine through the weighted path", async function () {
    const id = await makeRaffle(2, true);
    const entries = [alice, bob, carol];
    for (const u of entries) await apps.connect(u).enterRaffle(id, [], []);
    await warp(3600 + 60);
    const { seed, totalWeight } = await drawAndGetSeed(id);
    assert.equal(totalWeight, 3n); // nobody checked in: everyone weighs 1
    const expected = expectedWeighted(entries.map(u => u.address), [1n, 1n, 1n], seed, 2);
    const winners = await apps.getWinners(id);
    assert.deepEqual(winners.map(a => a.toLowerCase()), expected.map(a => a.toLowerCase()));
  });

  it("weighted = false keeps the equal-odds Fisher-Yates draw", async function () {
    await seedWeights(); // weights exist but must be IGNORED
    const id = await makeRaffle(2, false);
    const entries = [alice, bob, carol, dave];
    for (const u of entries) await apps.connect(u).enterRaffle(id, [], []);
    const c = await apps.getCampaign(id);
    assert.equal(c.weighted, false);
    await warp(3600 + 60);
    const { seed, totalWeight } = await drawAndGetSeed(id);
    assert.equal(totalWeight, null); // no DrawWeighted event
    const expected = expectedEqual(entries.map(u => u.address), seed, 2);
    const winners = await apps.getWinners(id);
    assert.deepEqual(winners.map(a => a.toLowerCase()), expected.map(a => a.toLowerCase()));
  });

  it("weighted raffle cannot be created when no CheckIn is wired", async function () {
    const Apps = await ethers.getContractFactory("OneIDCampaignsV17", deployer);
    const bare = await Apps.deploy(await gate.getAddress(), await bindings.getAddress(), ethers.ZeroAddress);
    const t = await now();
    await expectRevert(bare.connect(creator).createRaffle("x", t - 10, t + 3600, 1,
      ethers.ZeroAddress, 0n, NO_COND, "", true), "BadParams");
    const tx = await bare.connect(creator).createRaffle("x", t - 10, t + 3600, 1,
      ethers.ZeroAddress, 0n, NO_COND, "", false);
    await tx.wait(); // equal-odds creation still works
  });

  it("weighted escrow raffle pays the winner the fixed share", async function () {
    await seedWeights();
    const t = await now();
    const per = ethers.parseEther("0.01");
    const tx = await apps.connect(creator).createRaffle("paid w", t - 10, t + 3600, 1,
      ethers.ZeroAddress, per, NO_COND, "", true, { value: per });
    const rc = await tx.wait();
    const ev = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "CampaignCreated");
    const id = Number(ev.args.id);
    const entries = [alice, bob, carol, dave];
    for (const u of entries) await apps.connect(u).enterRaffle(id, [], []);
    await warp(3600 + 60);
    const { seed } = await drawAndGetSeed(id);
    const expected = expectedWeighted(entries.map(u => u.address), [4n, 1n, 2n, 3n], seed, 1);
    const winner = entries.find(u => u.address.toLowerCase() === expected[0].toLowerCase());
    const before = await ethers.provider.getBalance(winner.address);
    await apps.connect(winner).claimPrize(id);
    const after = await ethers.provider.getBalance(winner.address);
    assert.ok(after > before, "winner balance increased");
  });

  it("checkIn immutable is exposed and points at CheckInV2", async function () {
    assert.equal((await apps.checkIn()).toLowerCase(), (await checkin.getAddress()).toLowerCase());
  });

  // ---------------- V17 additions (external audit fixes) ----------------

  async function drawOnly(id) {
    await mine(3);
    const tx = await apps.draw(id);
    const rc = await tx.wait();
    const evs = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } }).filter(Boolean);
    const drawn = evs.find(e => e.name === "Drawn");
    const wEv = evs.find(e => e.name === "DrawWeighted");
    return { seed: drawn.args.seed, totalWeight: wEv ? wEv.args.totalWeight : null };
  }

  it("V17 snapshot: post-lock check-ins do NOT change the draw (audit Medium-1)", async function () {
    await seedWeights(); // alice 4, bob 1, carol 2, dave 3
    const id = await makeRaffle(2, true);
    const entries = [alice, bob, carol, dave];
    for (const u of entries) await apps.connect(u).enterRaffle(id, [], []);
    await warp(3600 + 60);
    await apps.lockDraw(id); // snapshot freezes 4/1/2/3 here
    // Bob now pumps his LIVE weight from 1 to 3 with two more check-ins.
    const dNow = cstDayOf(await now());
    await warpTo(cstTs(dNow + 1, 12 * 3600));
    await checkin.connect(bob).checkIn();
    await warpTo(cstTs(dNow + 2, 12 * 3600));
    await checkin.connect(bob).checkIn();
    assert.equal(await checkin.weightOf(bob.address), 3n); // live weight moved
    const { seed, totalWeight } = await drawOnly(id);
    assert.equal(totalWeight, 10n); // snapshot total, NOT the live 12
    const expected = expectedWeighted(entries.map(u => u.address), [4n, 1n, 2n, 3n], seed, 2);
    const winners = await apps.getWinners(id);
    assert.deepEqual(winners.map(a => a.toLowerCase()), expected.map(a => a.toLowerCase()));
  });

  it("V17 snapshot: re-lock after seed expiry refreshes the seed, never the weights", async function () {
    await seedWeights();
    const id = await makeRaffle(1, true);
    const entries = [alice, bob, carol, dave];
    for (const u of entries) await apps.connect(u).enterRaffle(id, [], []);
    await warp(3600 + 60);
    await apps.lockDraw(id); // snapshot 4/1/2/3
    await mine(260); // seed block ages out of the 256-block window
    await checkin.connect(bob).checkIn(); // bob live weight 1 -> 2 (new CST day not required: bob never checked in)
    assert.equal(await checkin.weightOf(bob.address), 2n);
    await apps.lockDraw(id); // re-lock: new seed, weights stay frozen
    const { seed, totalWeight } = await drawOnly(id);
    assert.equal(totalWeight, 10n);
    const expected = expectedWeighted(entries.map(u => u.address), [4n, 1n, 2n, 3n], seed, 1);
    const winners = await apps.getWinners(id);
    assert.deepEqual(winners.map(a => a.toLowerCase()), expected.map(a => a.toLowerCase()));
  });

  it("V17: setPostUrl and setWinnerInfo require the full https:// prefix (audit Low-1)", async function () {
    const id = await makeRaffle(1, false);
    await apps.connect(creator).setPostUrl(id, "https://x.com/9nosing/status/1");
    assert.equal(await apps.postUrl(id), "https://x.com/9nosing/status/1");
    await expectRevert(apps.connect(creator).setPostUrl(id, "httpsx://evil.example"), "BadParams");
    await expectRevert(apps.connect(creator).setPostUrl(id, "https"), "BadParams");
    await expectRevert(apps.connect(creator).setPostUrl(id, "http://x.com/a"), "BadParams");
    await apps.connect(creator).setWinnerInfo(id, "https://forms.gle/abc", "note");
    await expectRevert(apps.connect(creator).setWinnerInfo(id, "httpsx://evil.example", "n"), "BadParams");
    await apps.connect(creator).setWinnerInfo(id, "", ""); // clearing still allowed
  });

  it("V17: constructor rejects an EOA as checkIn_ (audit Low-2)", async function () {
    const Apps = await ethers.getContractFactory("OneIDCampaignsV17", deployer);
    await expectRevert(Apps.deploy(await gate.getAddress(), await bindings.getAddress(), alice.address),
      "checkIn not a contract");
  });
});
