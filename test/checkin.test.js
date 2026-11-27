const { ethers } = require("hardhat");
const assert = require("assert");

// =====================================================================
// CheckIn — daily check-in + 30-day sliding-window activity weight.
//
// Day boundary is Beijing time (CST, UTC+8):
//   dayIndex = (timestamp + 28800) / 86400.
// Helpers below place block timestamps at exact CST wall-clock points
// so the boundary behaviour is tested, not assumed.
// =====================================================================

async function expectRevert(p, errName) {
  try { await p; } catch (e) {
    if (errName && !String(e.message).includes(errName)) throw new Error(`reverted but not with ${errName}: ${String(e.message).slice(0, 200)}`);
    return;
  }
  throw new Error(`expected revert ${errName || ""} but call succeeded`);
}

async function warpTo(ts) {
  // No-op if the chain is already at/past the target (e.g. a loop's
  // first iteration re-targets the timestamp we just warped to).
  if (ts <= (await latestTs())) return;
  await ethers.provider.send("evm_setNextBlockTimestamp", [ts]); await ethers.provider.send("evm_mine", []);
}

const CST = 28800;
const DAY = 86400;
const cstDayOf = (ts) => Math.floor((ts + CST) / DAY);
// Timestamp `secs` seconds into CST day `day` (secs 0 = 00:00:00 CST).
const cstTs = (day, secs) => day * DAY - CST + secs;

async function latestTs() { return (await ethers.provider.getBlock("latest")).timestamp; }
// Warp to `secs` into the CURRENT CST day if still ahead of the chain,
// otherwise into the next CST day. Returns the day index landed on.
async function warpToCstToday(secs) {
  const now = await latestTs();
  let d = cstDayOf(now);
  if (cstTs(d, secs) <= now) d += 1;
  await warpTo(cstTs(d, secs));
  return d;
}

describe("CheckIn", function () {
  let mock, gate, checkin, issuer, alice, bob, carol;

  beforeEach(async function () {
    [issuer, alice, bob, carol] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    gate = await Gate.deploy(await mock.getAddress());
    const CheckIn = await ethers.getContractFactory("CheckIn", issuer);
    checkin = await CheckIn.deploy(await gate.getAddress());
    await mock.issue(alice.address);
    await mock.issue(bob.address);
    // carol: no Agent ID.
  });

  it("constructor rejects a zero gate and an EOA gate", async function () {
    const CheckIn = await ethers.getContractFactory("CheckIn", issuer);
    await expectRevert(CheckIn.deploy(ethers.ZeroAddress), "gate is zero");
    await expectRevert(CheckIn.deploy(carol.address), "gate has no code");
  });

  it("fresh address: weight 1, window 0, total 0, never checked in", async function () {
    assert.equal(await checkin.weightOf(alice.address), 1n);
    assert.equal(await checkin.windowCountOf(alice.address), 0n);
    assert.equal(await checkin.totalCheckInsOf(alice.address), 0n);
    assert.equal(await checkin.lastCheckInDayOf(alice.address), 0n);
    assert.equal(await checkin.hasCheckedInToday(alice.address), false);
  });

  it("non-holder check-in reverts NotHuman and records nothing", async function () {
    await expectRevert(checkin.connect(carol).checkIn(), "NotHuman");
    assert.equal(await checkin.totalCheckInsOf(carol.address), 0n);
    assert.equal(await checkin.weightOf(carol.address), 1n);
  });

  it("first check-in emits CheckedIn(user, dayIndex, 1) and sets weight 2", async function () {
    const d = await warpToCstToday(12 * 3600); // noon CST
    assert.equal(await checkin.todayIndex(), BigInt(d));
    const tx = await checkin.connect(alice).checkIn();
    const rc = await tx.wait();
    const ev = rc.logs.map(l => { try { return checkin.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "CheckedIn");
    assert.ok(ev, "CheckedIn event present");
    assert.equal(ev.args.user, alice.address);
    assert.equal(ev.args.dayIndex, BigInt(d));
    assert.equal(ev.args.totalCheckIns, 1n);
    assert.equal(await checkin.weightOf(alice.address), 2n);
    assert.equal(await checkin.windowCountOf(alice.address), 1n);
    assert.equal(await checkin.totalCheckInsOf(alice.address), 1n);
    assert.equal(await checkin.lastCheckInDayOf(alice.address), BigInt(d));
    assert.equal(await checkin.hasCheckedInToday(alice.address), true);
  });

  it("same-day repeat reverts AlreadyCheckedIn — immediately and at 23:59 CST", async function () {
    const d = await warpToCstToday(3600); // 01:00 CST
    await checkin.connect(alice).checkIn();
    await expectRevert(checkin.connect(alice).checkIn(), "AlreadyCheckedIn");
    await warpTo(cstTs(d, 86340)); // 23:59:00 CST, same day (60s slack: the tx block ticks +1s)
    assert.equal(await checkin.todayIndex(), BigInt(d));
    await expectRevert(checkin.connect(alice).checkIn(), "AlreadyCheckedIn");
    assert.equal(await checkin.totalCheckInsOf(alice.address), 1n);
  });

  it("CST boundary: 23:59 and next-day 00:01 are different days, 2 minutes apart", async function () {
    const d = await warpToCstToday(86340); // 23:59:00 CST
    await checkin.connect(bob).checkIn();
    assert.equal(await checkin.lastCheckInDayOf(bob.address), BigInt(d));
    await warpTo(cstTs(d + 1, 60)); // 00:01:00 CST next day
    assert.equal(await checkin.todayIndex(), BigInt(d + 1));
    await checkin.connect(bob).checkIn(); // must succeed
    assert.equal(await checkin.totalCheckInsOf(bob.address), 2n);
    assert.equal(await checkin.weightOf(bob.address), 3n);
    // ...and 00:30 the same new day is a repeat.
    await warpTo(cstTs(d + 1, 1800));
    await expectRevert(checkin.connect(bob).checkIn(), "AlreadyCheckedIn");
  });

  it("next-day check-in succeeds; weight and total grow", async function () {
    const d = await warpToCstToday(12 * 3600);
    await checkin.connect(alice).checkIn();
    await warpTo(cstTs(d + 1, 12 * 3600));
    await checkin.connect(alice).checkIn();
    assert.equal(await checkin.totalCheckInsOf(alice.address), 2n);
    assert.equal(await checkin.windowCountOf(alice.address), 2n);
    assert.equal(await checkin.weightOf(alice.address), 3n);
  });

  it("bitmap shift across a multi-day gap keeps exactly the right days", async function () {
    const d = await warpToCstToday(12 * 3600);
    await checkin.connect(alice).checkIn();                    // day d
    await warpTo(cstTs(d + 5, 12 * 3600));
    await checkin.connect(alice).checkIn();                    // day d+5; bits {0,5}
    let rec = await checkin.recordOf(alice.address);
    assert.equal(rec.window, (1 << 5) | 1);
    assert.equal(await checkin.weightOf(alice.address), 3n);
    await warpTo(cstTs(d + 30, 12 * 3600));
    await checkin.connect(alice).checkIn();                    // day d+30
    // Stored bits relative to d+30: bit25 = day d+5 (IN), bit30 = day d
    // (30 days old — still stored in the 32-bit frame but OUTSIDE the
    // 30-day weight mask), bit0 = today (IN).
    rec = await checkin.recordOf(alice.address);
    assert.equal(rec.window, (1 << 30) | (1 << 25) | 1);
    assert.equal(await checkin.windowCountOf(alice.address), 2n);
    assert.equal(await checkin.weightOf(alice.address), 3n);
    assert.equal(await checkin.totalCheckInsOf(alice.address), 3n);
  });

  it("days slide out of the weight window as time passes, without any new check-in", async function () {
    const d = await warpToCstToday(12 * 3600);
    await checkin.connect(alice).checkIn();                    // day d
    await warpTo(cstTs(d + 1, 12 * 3600));
    await checkin.connect(alice).checkIn();                    // day d+1
    assert.equal(await checkin.weightOf(alice.address), 3n);
    await warpTo(cstTs(d + 30, 12 * 3600));                    // d is 30 old (out), d+1 is 29 (in)
    assert.equal(await checkin.windowCountOf(alice.address), 1n);
    assert.equal(await checkin.weightOf(alice.address), 2n);
    await warpTo(cstTs(d + 31, 12 * 3600));                    // both out
    assert.equal(await checkin.windowCountOf(alice.address), 0n);
    assert.equal(await checkin.weightOf(alice.address), 1n);
    // ...but the lifetime total is untouched.
    assert.equal(await checkin.totalCheckInsOf(alice.address), 2n);
    assert.equal(await checkin.lastCheckInDayOf(alice.address), BigInt(d + 1));
  });

  it("a check-in 31 days after the previous one starts a fresh window", async function () {
    const d = await warpToCstToday(12 * 3600);
    await checkin.connect(alice).checkIn();
    await warpTo(cstTs(d + 31, 12 * 3600));
    await checkin.connect(alice).checkIn();
    const rec = await checkin.recordOf(alice.address);
    // bit31 still holds the 31-day-old check-in inside the 32-bit frame;
    // it is outside the 30-day mask, so the counted window is just today.
    assert.equal(rec.window, (1n << 31n) | 1n);
    assert.equal(await checkin.windowCountOf(alice.address), 1n);
    assert.equal(await checkin.weightOf(alice.address), 2n);
    assert.equal(await checkin.totalCheckInsOf(alice.address), 2n);
  });

  it("30 consecutive days saturate the weight at 31; day 31 keeps it at 31", async function () {
    const d = await warpToCstToday(12 * 3600);
    for (let i = 0; i < 30; i++) {
      if (i > 0) await warpTo(cstTs(d + i, 12 * 3600));
      await checkin.connect(alice).checkIn();
    }
    assert.equal(await checkin.totalCheckInsOf(alice.address), 30n);
    assert.equal(await checkin.windowCountOf(alice.address), 30n);
    assert.equal(await checkin.weightOf(alice.address), 31n);
    await warpTo(cstTs(d + 30, 12 * 3600));
    await checkin.connect(alice).checkIn();                    // oldest day slides out
    assert.equal(await checkin.totalCheckInsOf(alice.address), 31n);
    assert.equal(await checkin.windowCountOf(alice.address), 30n);
    assert.equal(await checkin.weightOf(alice.address), 31n);
  });

  it("irregular pattern: weightOf matches hand calculation, and an independent recomputation from CheckedIn events", async function () {
    const d = await warpToCstToday(12 * 3600);
    const offsets = [0, 1, 3, 7, 15, 29];
    for (const off of offsets) {
      await warpTo(cstTs(d + off, 12 * 3600));
      await checkin.connect(alice).checkIn();
    }
    // At day d+29 every pattern day is within [today-29, today].
    assert.equal(await checkin.windowCountOf(alice.address), 6n);
    assert.equal(await checkin.weightOf(alice.address), 7n);
    assert.equal(await checkin.totalCheckInsOf(alice.address), 6n);

    await warpTo(cstTs(d + 36, 12 * 3600));
    // In-window offsets at day d+36: those with 36-off <= 29 → off >= 7 → {7,15,29}.
    assert.equal(await checkin.windowCountOf(alice.address), 3n);
    assert.equal(await checkin.weightOf(alice.address), 4n);

    // Independent recomputation: rebuild the day set from events only,
    // the way any third party would audit the weight off the log.
    const events = await checkin.queryFilter(checkin.filters.CheckedIn(alice.address));
    const days = new Set(events.map(e => Number(e.args.dayIndex)));
    assert.deepEqual([...days].sort((a, b) => a - b), offsets.map(o => d + o));
    const today = d + 36;
    const expected = [...days].filter(x => today - x < 30).length;
    assert.equal(await checkin.weightOf(alice.address), BigInt(1 + expected));
    // Event totals are a running count 1..6.
    assert.deepEqual(events.map(e => Number(e.args.totalCheckIns)), [1, 2, 3, 4, 5, 6]);
  });

  it("two holders accumulate independently", async function () {
    const d = await warpToCstToday(12 * 3600);
    await checkin.connect(alice).checkIn();
    await warpTo(cstTs(d + 2, 12 * 3600));
    await checkin.connect(alice).checkIn();
    await checkin.connect(bob).checkIn();
    assert.equal(await checkin.totalCheckInsOf(alice.address), 2n);
    assert.equal(await checkin.weightOf(alice.address), 3n);
    assert.equal(await checkin.totalCheckInsOf(bob.address), 1n);
    assert.equal(await checkin.weightOf(bob.address), 2n);
  });
});
