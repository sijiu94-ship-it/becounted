const { ethers } = require("hardhat");
const assert = require("assert");

async function expectRevert(p, errName) {
  try { await p; } catch (e) {
    if (errName && !String(e.message).includes(errName)) throw new Error(`reverted but not with ${errName}: ${String(e.message).slice(0, 160)}`);
    return;
  }
  throw new Error(`expected revert ${errName || ""} but call succeeded`);
}

const DAY = 86400;

describe("QuestPass expedition", function () {
  let mock, gate, token, issuer, creator, alice, bob, carol, dave, erin;

  beforeEach(async function () {
    [issuer, creator, alice, bob, carol, dave, erin] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    gate = await Gate.deploy(await mock.getAddress());
    const Tok = await ethers.getContractFactory("MockERC20", creator);
    token = await Tok.deploy();
    // everyone except bob holds an Agent ID
    for (const u of [alice, carol, dave, erin]) await mock.issue(u.address);
  });

  // Funded deploy: predict the contract address, approve first, then
  // deploy (the constructor pulls the full escrow via transferFrom).
  async function deployFunded(overrides = {}) {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const cfg = Object.assign({
      tokenAddr: await token.getAddress(), startAt: now + 60, slots: 3,
      dayPool: 700n, minStamps: 5, winners: 2, finalePool: 300n, entryWindow: DAY,
    }, overrides);
    const total = cfg.dayPool * 7n + cfg.finalePool;
    const Q = await ethers.getContractFactory("QuestPass", creator);
    if (cfg.tokenAddr !== ethers.ZeroAddress) {
      await token.mint(creator.address, total);
      const nonce = await ethers.provider.getTransactionCount(creator.address);
      // the approve below consumes `nonce`, so the deploy lands at nonce + 1
      const predicted = ethers.getCreateAddress({ from: creator.address, nonce: nonce + 1 });
      await token.connect(creator).approve(predicted, total);
      const quest = await Q.deploy(await gate.getAddress(), cfg.tokenAddr, cfg.startAt,
        cfg.slots, cfg.dayPool, cfg.minStamps, cfg.winners, cfg.finalePool, cfg.entryWindow);
      assert.equal(await quest.getAddress(), predicted);
      assert.equal(await token.balanceOf(predicted), total);
      return { quest, cfg };
    }
    const quest = await Q.deploy(await gate.getAddress(), cfg.tokenAddr, cfg.startAt,
      cfg.slots, cfg.dayPool, cfg.minStamps, cfg.winners, cfg.finalePool, cfg.entryWindow,
      { value: total });
    return { quest, cfg };
  }

  async function gotoStart(quest, cfg) {
    await ethers.provider.send("evm_setNextBlockTimestamp", [cfg.startAt + 1]);
    await ethers.provider.send("evm_mine", []);
  }

  async function nextDay() {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await ethers.provider.send("evm_setNextBlockTimestamp", [now + DAY]);
    await ethers.provider.send("evm_mine", []);
  }

  it("constructor validation: dayPool below slots reverts; minStamps above 7 reverts", async function () {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const Q = await ethers.getContractFactory("QuestPass", creator);
    await expectRevert(Q.deploy(await gate.getAddress(), await token.getAddress(), now + 60, 3, 2n, 5, 2, 300n, DAY), "BadParams");
    await expectRevert(Q.deploy(await gate.getAddress(), await token.getAddress(), now + 60, 3, 700n, 8, 2, 300n, DAY), "BadParams");
  });

  it("non-human stamp reverts NotHuman; stamp before start reverts NotOpen", async function () {
    const { quest, cfg } = await deployFunded();
    await expectRevert(quest.connect(alice).claimStamp(), "NotOpen");
    await gotoStart(quest, cfg);
    await expectRevert(quest.connect(bob).claimStamp(), "NotHuman");
  });

  it("stamp pays within the day pool, sets bitmap and count; same-day re-stamp reverts", async function () {
    const { quest, cfg } = await deployFunded();
    await gotoStart(quest, cfg);
    const before = await token.balanceOf(alice.address);
    await quest.connect(alice).claimStamp();
    const got = (await token.balanceOf(alice.address)) - before;
    assert.ok(got > 0n && got <= 700n, `stamp amount in range, got ${got}`);
    assert.equal(await quest.stampCount(alice.address), 1);
    assert.equal(await quest.hasStampedOn(alice.address, 0), true);
    assert.equal(await quest.hasStampedOn(alice.address, 1), false);
    assert.equal(await quest.currentDay(), 0);
    await expectRevert(quest.connect(alice).claimStamp(), "AlreadyCounted");
  });

  it("day slot cap: 4th human on the same day reverts NoSlots", async function () {
    const { quest, cfg } = await deployFunded();
    await gotoStart(quest, cfg);
    await quest.connect(alice).claimStamp();
    await quest.connect(carol).claimStamp();
    await quest.connect(dave).claimStamp();
    await expectRevert(quest.connect(erin).claimStamp(), "NoSlots");
    // the day's sub-pool drains exactly across its slots
    assert.equal(await quest.dayPaid(0), 700n);
  });

  it("finale entry: too early, ineligible, then eligible entry + dedup", async function () {
    const { quest, cfg } = await deployFunded();
    await gotoStart(quest, cfg);
    // alice stamps all 7 days, erin only 3
    for (let d = 0; d < 7; d++) {
      await quest.connect(alice).claimStamp();
      if (d < 3) await quest.connect(erin).claimStamp();
      if (d === 0) await expectRevert(quest.connect(alice).enterFinale(), "NotOpen");
      await nextDay();
    }
    assert.equal(await quest.stampCount(alice.address), 7);
    assert.equal(await quest.eligible(alice.address), true);
    assert.equal(await quest.eligible(erin.address), false);
    await expectRevert(quest.connect(erin).enterFinale(), "NotEligible");
    await expectRevert(quest.connect(bob).enterFinale(), "NotHuman");
    await quest.connect(alice).enterFinale();
    assert.equal(await quest.finaleEntryCount(), 1);
    await expectRevert(quest.connect(alice).enterFinale(), "AlreadyCounted");
  });

  it("full finale: seed lock, reproducible draw, exact prize claims, reclaim remainder", async function () {
    const { quest, cfg } = await deployFunded();
    await gotoStart(quest, cfg);
    const trio = [alice, carol, dave];
    for (let d = 0; d < 7; d++) {
      for (const u of trio) await quest.connect(u).claimStamp();
      await nextDay();
    }
    for (const u of trio) await quest.connect(u).enterFinale();
    await expectRevert(quest.lockFinaleSeed(), "TooEarly");
    // close the entry window
    const ee = Number(await quest.entryEnd());
    await ethers.provider.send("evm_setNextBlockTimestamp", [ee + 1]);
    await ethers.provider.send("evm_mine", []);
    await quest.lockFinaleSeed();
    const seedBlock = await quest.finaleSeedBlock();
    assert.ok(seedBlock > 0n);
    // mine past the seed block
    await ethers.provider.send("evm_mine", []);
    await ethers.provider.send("evm_mine", []);
    await ethers.provider.send("evm_mine", []);
    const tx = await quest.drawFinale();
    const rc = await tx.wait();
    const ev = rc.logs.map(l => { try { return quest.interface.parseLog(l); } catch { return null; } }).find(e => e && e.name === "FinaleDrawn");
    assert.ok(ev, "FinaleDrawn emitted");
    const seed = ev.args.seed;
    // recompute winners off-chain from entries + seed (partial Fisher-Yates)
    const entries = await quest.getFinaleEntries();
    const idx = entries.map((_, i) => i);
    const coder = ethers.AbiCoder.defaultAbiCoder();
    for (let i = 0; i < 2; i++) {
      const h = ethers.keccak256(coder.encode(["uint256", "uint256"], [seed, BigInt(i)]));
      const j = i + Number(BigInt(h) % BigInt(entries.length - i));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const expected = [entries[idx[0]], entries[idx[1]]].map(a => a.toLowerCase()).sort();
    const winners = (await quest.getWinners()).map(a => a.toLowerCase()).sort();
    assert.deepEqual(winners, expected);
    // winners claim exactly 150 each; the non-winner cannot
    const loser = trio.find(u => !winners.includes(u.address.toLowerCase()));
    await expectRevert(quest.connect(loser).claimPrize(), "NotWinner");
    for (const w of winners) {
      const signer = trio.find(u => u.address.toLowerCase() === w);
      const b = await token.balanceOf(signer.address);
      await quest.connect(signer).claimPrize();
      assert.equal((await token.balanceOf(signer.address)) - b, 150n);
      await expectRevert(quest.connect(signer).claimPrize(), "AlreadyCounted");
    }
    // reclaim: too early, then after the 30-day window the creator recovers the rest
    await expectRevert(quest.connect(creator).reclaim(), "TooEarly");
    await ethers.provider.send("evm_increaseTime", [31 * DAY]);
    await ethers.provider.send("evm_mine", []);
    const totalFunded = 700n * 7n + 300n;
    const paid = (await quest.stampPaidTotal()) + (await quest.finalePaidTotal());
    const cb = await token.balanceOf(creator.address);
    await quest.connect(creator).reclaim();
    assert.equal((await token.balanceOf(creator.address)) - cb, totalFunded - paid);
    assert.equal(await token.balanceOf(await quest.getAddress()), 0n);
  });

  it("BNB season: funded by value, stamp pays BNB", async function () {
    const dayPool = ethers.parseEther("0.007");
    const { quest, cfg } = await deployFunded({ tokenAddr: ethers.ZeroAddress, dayPool, slots: 2, finalePool: ethers.parseEther("0.003") });
    await gotoStart(quest, cfg);
    const b = await ethers.provider.getBalance(alice.address);
    const tx = await quest.connect(alice).claimStamp();
    const rc = await tx.wait();
    const gas = rc.gasUsed * rc.gasPrice;
    const after = await ethers.provider.getBalance(alice.address);
    assert.ok(after + gas > b, "alice received a BNB stamp payout");
    assert.equal(await quest.stampCount(alice.address), 1);
  });
});
