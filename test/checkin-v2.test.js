const { ethers } = require("hardhat");
const assert = require("assert");

// =====================================================================
// CheckInV2 — identical to CheckIn V1 except WINDOW_DAYS = 14.
// Focused tests: the constant, the 14-day slide-out boundary, the
// saturation point (14 days -> weight 15), and the gate errors.
// =====================================================================

async function expectRevert(p, errName) {
  try { await p; } catch (e) {
    if (errName && !String(e.message).includes(errName)) throw new Error(`reverted but not with ${errName}: ${String(e.message).slice(0, 200)}`);
    return;
  }
  throw new Error(`expected revert ${errName || ""} but call succeeded`);
}

async function warpTo(ts) {
  if (ts <= (await latestTs())) return;
  await ethers.provider.send("evm_setNextBlockTimestamp", [ts]); await ethers.provider.send("evm_mine", []);
}

const CST = 28800;
const DAY = 86400;
const cstDayOf = (ts) => Math.floor((ts + CST) / DAY);
const cstTs = (day, secs) => day * DAY - CST + secs;
async function latestTs() { return (await ethers.provider.getBlock("latest")).timestamp; }
async function warpToCstToday(secs) {
  const now = await latestTs();
  let d = cstDayOf(now);
  if (cstTs(d, secs) <= now) d += 1;
  await warpTo(cstTs(d, secs));
  return d;
}

describe("CheckInV2 (14-day window)", function () {
  let mock, gate, checkin, issuer, alice, bob, carol;

  beforeEach(async function () {
    [issuer, alice, bob, carol] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    gate = await Gate.deploy(await mock.getAddress());
    const C = await ethers.getContractFactory("CheckInV2", issuer);
    checkin = await C.deploy(await gate.getAddress());
    await mock.issue(alice.address);
    await mock.issue(bob.address);
  });

  it("WINDOW_DAYS is 14", async function () {
    assert.equal(await checkin.WINDOW_DAYS(), 14n);
  });

  it("gate + once-a-day still enforced", async function () {
    await expectRevert(checkin.connect(carol).checkIn(), "NotHuman");
    const d = await warpToCstToday(12 * 3600);
    await checkin.connect(alice).checkIn();
    await expectRevert(checkin.connect(alice).checkIn(), "AlreadyCheckedIn");
    assert.equal(await checkin.weightOf(alice.address), 2n);
    assert.equal(d > 0, true);
  });

  it("a check-in counts for 14 days, then slides out", async function () {
    const d = await warpToCstToday(12 * 3600);
    await checkin.connect(alice).checkIn();                    // day d
    await warpTo(cstTs(d + 13, 12 * 3600));                    // 13 days later: still in
    assert.equal(await checkin.windowCountOf(alice.address), 1n);
    assert.equal(await checkin.weightOf(alice.address), 2n);
    await warpTo(cstTs(d + 14, 12 * 3600));                    // 14 days later: out
    assert.equal(await checkin.windowCountOf(alice.address), 0n);
    assert.equal(await checkin.weightOf(alice.address), 1n);
    assert.equal(await checkin.totalCheckInsOf(alice.address), 1n); // lifetime stays
  });

  it("14 consecutive days saturate at weight 15; day 15 keeps 15", async function () {
    const d = await warpToCstToday(12 * 3600);
    for (let i = 0; i < 14; i++) {
      await warpTo(cstTs(d + i, 12 * 3600));
      await checkin.connect(alice).checkIn();
    }
    assert.equal(await checkin.windowCountOf(alice.address), 14n);
    assert.equal(await checkin.weightOf(alice.address), 15n);
    await warpTo(cstTs(d + 14, 12 * 3600));
    await checkin.connect(alice).checkIn();                    // day d+14: d slid out
    assert.equal(await checkin.windowCountOf(alice.address), 14n);
    assert.equal(await checkin.weightOf(alice.address), 15n);
    assert.equal(await checkin.totalCheckInsOf(alice.address), 15n);
  });

  it("mixed days: only the in-window day counts", async function () {
    const d = await warpToCstToday(12 * 3600);
    await checkin.connect(bob).checkIn();                      // day d
    await warpTo(cstTs(d + 5, 12 * 3600));
    await checkin.connect(bob).checkIn();                      // day d+5
    await warpTo(cstTs(d + 14, 12 * 3600));                    // d is out, d+5 is 9 old
    assert.equal(await checkin.windowCountOf(bob.address), 1n);
    assert.equal(await checkin.weightOf(bob.address), 2n);
    assert.equal(await checkin.totalCheckInsOf(bob.address), 2n);
  });
});
