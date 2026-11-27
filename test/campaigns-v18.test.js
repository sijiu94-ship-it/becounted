const { ethers } = require("hardhat");
const assert = require("assert");

// =====================================================================
// OneIDCampaignsV18 — second-round deep-review changes:
//  (1) N6: nonReentrant on enterRaffle / castVote (state-integrity
//      proof against a reentry-attempting gate token)
//  (2) DrawWeights event carries each winner's snapshot weight
//  (3) claimPrizeFor: anyone may trigger a winner's claim
// Plus a weighted-snapshot regression (the _drawWeighted tail changed).
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

describe("OneIDCampaignsV18 deep-review changes", function () {
  let mock, gate, bindings, checkin, apps, deployer, creator, alice, bob, carol, dave;

  beforeEach(async function () {
    [deployer, creator, alice, bob, carol, dave] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", deployer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", deployer);
    gate = await Gate.deploy(await mock.getAddress());
    const Bind = await ethers.getContractFactory("IdentityBindingsV4", deployer);
    bindings = await Bind.deploy();
    const CI = await ethers.getContractFactory("CheckInV2", deployer);
    checkin = await CI.deploy(await gate.getAddress());
    const Apps = await ethers.getContractFactory("OneIDCampaignsV18", deployer);
    apps = await Apps.deploy(await gate.getAddress(), await bindings.getAddress(), await checkin.getAddress());
    for (const u of [alice, bob, carol, dave]) await mock.issue(u.address);
  });

  async function now() { return (await ethers.provider.getBlock("latest")).timestamp; }

  async function seedWeights() {
    const t0 = await now();
    const d = cstDayOf(t0);
    await warpTo(cstTs(d, 12 * 3600));
    await checkin.connect(alice).checkIn();
    await checkin.connect(dave).checkIn();
    await warpTo(cstTs(d + 1, 12 * 3600));
    await checkin.connect(alice).checkIn();
    await warpTo(cstTs(d + 2, 12 * 3600));
    await checkin.connect(alice).checkIn();
    await checkin.connect(carol).checkIn();
    await checkin.connect(dave).checkIn();
    // weights: alice 4, bob 1, carol 2, dave 3
  }

  async function createRaffle(opts = {}) {
    const t = await now();
    const tx = await apps.connect(creator).createRaffle(
      opts.title || "r", t - 10, t + (opts.dur || 3600), opts.winners || 1,
      opts.token || ethers.ZeroAddress, opts.per || 0n,
      opts.cond || NO_COND, opts.label || "", opts.weighted || false,
      { value: opts.value || 0n });
    const rc = await tx.wait();
    const ev = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "CampaignCreated");
    return Number(ev.args.id);
  }

  async function lockAndDraw(id) {
    await apps.lockDraw(id);
    await mine(3);
    const tx = await apps.draw(id);
    return tx.wait();
  }

  it("DrawWeights event carries each winner's snapshot weight", async function () {
    await seedWeights();
    const id = await createRaffle({ winners: 2, weighted: true, label: "加权礼盒" });
    const entries = [alice, bob, carol, dave];
    for (const u of entries) await apps.connect(u).enterRaffle(id, [], []);
    await warp(3600 + 60);
    const rc = await lockAndDraw(id);
    const evs = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } }).filter(Boolean);
    const dw = evs.find(e => e.name === "DrawWeights");
    assert.ok(dw, "DrawWeights emitted");
    const winners = await apps.getWinners(id);
    assert.deepEqual(dw.args.winners.map(a => a.toLowerCase()), winners.map(a => a.toLowerCase()));
    const weightByAddr = new Map([[alice.address.toLowerCase(), 4n], [bob.address.toLowerCase(), 1n], [carol.address.toLowerCase(), 2n], [dave.address.toLowerCase(), 3n]]);
    dw.args.winners.forEach((w, i) => assert.equal(dw.args.weights[i], weightByAddr.get(w.toLowerCase())));
    const total = evs.find(e => e.name === "DrawWeighted");
    assert.equal(total.args.totalWeight, 10n);
  });

  it("claimPrizeFor pays the winner when a third party triggers it", async function () {
    const per = ethers.parseEther("0.01");
    const id = await createRaffle({ winners: 1, per, value: per });
    await apps.connect(alice).enterRaffle(id, [], []);
    await apps.connect(bob).enterRaffle(id, [], []);
    await warp(3600 + 60);
    await lockAndDraw(id);
    const winners = await apps.getWinners(id);
    const winner = winners[0];
    const loser = winner.toLowerCase() === alice.address.toLowerCase() ? bob : alice;
    // non-winner cannot be paid via claimPrizeFor
    await expectRevert(apps.connect(carol).claimPrizeFor(id, loser.address), "NotWinner");
    const before = await ethers.provider.getBalance(winner);
    // carol (not even an entrant) triggers; winner receives, pays no gas
    await apps.connect(carol).claimPrizeFor(id, winner);
    const after = await ethers.provider.getBalance(winner);
    assert.equal(after - before, per);
    assert.equal(await apps.prizeClaimed(id, winner), true);
    // nothing left to claim, by anyone
    await expectRevert(apps.connect(carol).claimPrizeFor(id, winner), "AlreadyCounted");
    const winnerSigner = winner.toLowerCase() === alice.address.toLowerCase() ? alice : bob;
    await expectRevert(apps.connect(winnerSigner).claimPrize(id), "AlreadyCounted");
  });

  it("claimPrizeFor before the draw reverts NotEnded", async function () {
    const per = ethers.parseEther("0.01");
    const id = await createRaffle({ winners: 1, per, value: per });
    await apps.connect(alice).enterRaffle(id, [], []);
    await expectRevert(apps.connect(carol).claimPrizeFor(id, alice.address), "NotEnded");
  });

  it("N6: a reentry-attempting gate token cannot double-enter a raffle", async function () {
    const RT = await ethers.getContractFactory("ReentrantGateToken", deployer);
    const rt = await RT.deploy();
    const cond = { ...NO_COND, gateToken: await rt.getAddress(), gateMin: 1n };
    const id = await createRaffle({ cond, label: "gated" });
    await rt.arm(await apps.getAddress(), id);
    await apps.connect(alice).enterRaffle(id, [], []);
    const c = await apps.getCampaign(id);
    assert.equal(c.entryCount, 1n);
    const entries = await apps.getEntries(id);
    assert.deepEqual(entries.map(a => a.toLowerCase()), [alice.address.toLowerCase()]);
    // ordinary dedup still intact afterwards
    await expectRevert(apps.connect(alice).enterRaffle(id, [], []), "AlreadyCounted");
  });

  it("N6: a reentry-attempting gate token cannot double-vote", async function () {
    const RT = await ethers.getContractFactory("ReentrantGateToken", deployer);
    const rt = await RT.deploy();
    const cond = { ...NO_COND, gateToken: await rt.getAddress(), gateMin: 1n };
    const t = await now();
    const tx = await apps.connect(creator).createVote("v", t - 10, t + 3600, 2, ethers.ZeroAddress, 0n, 0, cond, ["A", "B"]);
    const rc = await tx.wait();
    const ev = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "CampaignCreated");
    const id = Number(ev.args.id);
    await rt.arm(await apps.getAddress(), id);
    await apps.connect(bob).castVote(id, 1, [], []);
    const c = await apps.getCampaign(id);
    assert.equal(c.entryCount, 1n);
    assert.equal(await apps.voteOf(id, bob.address), 1n);
    await expectRevert(apps.connect(bob).castVote(id, 0, [], []), "AlreadyCounted");
  });

  it("weighted snapshot regression: post-lock check-ins still cannot move the draw", async function () {
    await seedWeights();
    const id = await createRaffle({ winners: 1, weighted: true, label: "加权礼盒" });
    for (const u of [alice, bob, carol, dave]) await apps.connect(u).enterRaffle(id, [], []);
    await warp(3600 + 60);
    await apps.lockDraw(id); // snapshot 4/1/2/3
    const dNow = cstDayOf(await now());
    await warpTo(cstTs(dNow + 1, 12 * 3600));
    await checkin.connect(bob).checkIn(); // bob live weight 1 -> 2
    assert.equal(await checkin.weightOf(bob.address), 2n);
    await mine(3);
    const tx = await apps.draw(id);
    const rc = await tx.wait();
    const evs = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } }).filter(Boolean);
    assert.equal(evs.find(e => e.name === "DrawWeighted").args.totalWeight, 10n);
  });
});
