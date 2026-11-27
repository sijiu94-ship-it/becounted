const { ethers } = require("hardhat");
const assert = require("assert");

// =====================================================================
// SECURITY PROBE — adversarial exploit attempts against QuestPass
// (2026-11-23, pre-mainnet). Companion to security-probe.test.js:
// day-pool draining, per-day double stamps, boundary claims, finale
// double claims, premature reclaim, seed-lock repetition, and a
// fallback-seed TIMING GRIND: once the locked seed block ages out of
// the 256-block blockhash window, the fallback seed is the PREVIOUS
// block's hash — which is public before the draw transaction lands,
// so a patient caller can choose the block in which to draw. The last
// test demonstrates that grind end-to-end and measures its cost.
// =====================================================================

async function expectRevert(p, errName) {
  try { await p; } catch (e) {
    if (errName && !String(e.message).includes(errName)) throw new Error(`reverted but not with ${errName}: ${String(e.message).slice(0, 250)}`);
    return e;
  }
  throw new Error(`expected revert ${errName || ""} but call succeeded`);
}
async function mine(n) { await ethers.provider.send("hardhat_mine", [ethers.toBeHex(n)]); }
async function warpTo(ts) { await ethers.provider.send("evm_setNextBlockTimestamp", [ts]); await ethers.provider.send("evm_mine", []); }
async function nowTs() { return (await ethers.provider.getBlock("latest")).timestamp; }
const DAY = 86400;

const ATTACKER_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IQuest {
    function claimStamp() external;
    function enterFinale() external;
    function claimPrize() external;
}
/// mode 3 = reenter quest.claimPrize(), 4 = reenter quest.claimStamp().
contract ReceiverAttacker {
    address public target; uint8 public mode; bool public armed;
    uint256 public attempts; bool public innerSucceeded; bytes public innerError;
    function arm(address t, uint8 m) external { target = t; mode = m; armed = true; }
    function stamp(address q) external { IQuest(q).claimStamp(); }
    function enterFin(address q) external { IQuest(q).enterFinale(); }
    function claimPQ(address q) external { IQuest(q).claimPrize(); }
    receive() external payable {
        if (!armed) return;
        attempts++;
        if (mode == 3) { try IQuest(target).claimPrize() { innerSucceeded = true; } catch (bytes memory e) { innerError = e; } }
        else if (mode == 4) { try IQuest(target).claimStamp() { innerSucceeded = true; } catch (bytes memory e) { innerError = e; } }
    }
}
`;
let ReceiverAttackerF;
before(async function () {
  const solc = require("solc");
  const input = { language: "Solidity", sources: { "QAttackers.sol": { content: ATTACKER_SOURCE } }, settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } } };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errs = (out.errors || []).filter(e => e.severity === "error");
  assert.equal(errs.length, 0, errs.map(e => e.formattedMessage).join("\n"));
  const C = out.contracts["QAttackers.sol"].ReceiverAttacker;
  const [deployer] = await ethers.getSigners();
  ReceiverAttackerF = new ethers.ContractFactory(C.abi, C.evm.bytecode.object, deployer);
});

async function deployGate(signers) {
  const [issuer] = signers;
  const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
  const mock = await Mock.deploy();
  const Gate = await ethers.getContractFactory("BeCounted", issuer);
  const gate = await Gate.deploy(await mock.getAddress());
  return { mock, gate };
}

// ERC20-funded quest via the predict-address approve pattern (flow15).
async function deployQuestERC20(creator, gate, token, cfg) {
  const total = cfg.dayPool * 7n + cfg.finalePool;
  await token.mint(creator.address, total);
  const nonce = await ethers.provider.getTransactionCount(creator.address);
  const predicted = ethers.getCreateAddress({ from: creator.address, nonce: nonce + 1 });
  await token.connect(creator).approve(predicted, total);
  const Q = await ethers.getContractFactory("QuestPass", creator);
  const quest = await Q.deploy(await gate.getAddress(), await token.getAddress(), cfg.startAt, cfg.slots, cfg.dayPool, cfg.minStamps, cfg.winners, cfg.finalePool, cfg.entryWindow);
  assert.equal(await quest.getAddress(), predicted);
  return quest;
}

// =====================================================================
// ATTACK 7: day-pool abuse — double stamp, slot exhaustion, drain math,
// day-boundary and phase-boundary claims
// =====================================================================
describe("PROBE 7: QuestPass day pool", function () {
  let issuer, creator, alice, bob, carol, dave, mock, gate, token, quest, cfg;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    [issuer, creator, alice, bob, carol, dave] = signers;
    ({ mock, gate } = await deployGate(signers));
    const Tok = await ethers.getContractFactory("MockERC20", creator);
    token = await Tok.deploy();
    for (const u of [alice, bob, carol, dave]) await mock.issue(u.address);
    const now = await nowTs();
    cfg = { startAt: now + 60, slots: 3, dayPool: 3000n, minStamps: 1, winners: 1, finalePool: 1000n, entryWindow: 3600 };
    quest = await deployQuestERC20(creator, gate, token, cfg);
  });

  it("before the season starts, claimStamp is closed (NotOpen)", async function () {
    await expectRevert(quest.connect(alice).claimStamp(), "NotOpen");
  });

  it("same human, same day, twice: AlreadyCounted. Non-human: NotHuman.", async function () {
    await warpTo(cfg.startAt + 1);
    await quest.connect(alice).claimStamp();
    await expectRevert(quest.connect(alice).claimStamp(), "AlreadyCounted");
    const allSigners = await ethers.getSigners();
    const erin = allSigners[6]; // never issued an ID
    await expectRevert(quest.connect(erin).claimStamp(), "NotHuman");
    assert.equal(await quest.stampCount(alice.address), 1);
  });

  it("day pool drains exactly: 3 slots pay out the full 3000 (last slot takes the remainder, never negative, never more); the 4th human gets NoSlots", async function () {
    await warpTo(cfg.startAt + 1);
    const amounts = [];
    for (const u of [alice, bob, carol]) {
      const before = await token.balanceOf(u.address);
      await quest.connect(u).claimStamp();
      amounts.push((await token.balanceOf(u.address)) - before);
    }
    assert.equal(await quest.dayClaims(0), 3);
    assert.equal(await quest.dayPaid(0), 3000n, "dayPaid equals the day pool exactly");
    assert.equal(amounts.reduce((a, b) => a + b, 0n), 3000n, "payouts sum to the day pool — no over-issue");
    for (const a of amounts) assert.ok(a >= 1n, "every slot pays at least 1 unit");
    assert.equal(amounts[2], 3000n - amounts[0] - amounts[1], "last slot takes exactly the remainder");
    await expectRevert(quest.connect(dave).claimStamp(), "NoSlots");
    assert.equal(await token.balanceOf(await quest.getAddress()), 3000n * 6n + 1000n, "other days + finale untouched");
  });

  it("boundaries: exactly startAt+1day is day 1; the last second of day 6 still stamps; at stampEnd the stamp phase is shut", async function () {
    await warpTo(cfg.startAt + 1);
    await quest.connect(alice).claimStamp(); // day 0
    await warpTo(cfg.startAt + DAY); // first instant of day 1
    assert.equal(await quest.currentDay(), 1);
    await quest.connect(alice).claimStamp();
    assert.equal(await quest.hasStampedOn(alice.address, 1), true);
    const end = Number(await quest.stampEnd());
    // warpTo mines its own block at end-2, so the claim transaction
    // itself lands at end-1 — the last second of day 6
    await warpTo(end - 2);
    assert.equal(await quest.currentDay(), 6);
    await quest.connect(alice).claimStamp();
    assert.equal(await quest.hasStampedOn(alice.address, 6), true);
    assert.equal(await quest.stampCount(alice.address), 3);
    await warpTo(end); // stamp phase over — entry window instead
    await expectRevert(quest.connect(bob).claimStamp(), "NotOpen");
  });
});

// =====================================================================
// ATTACK 1/8 (QuestPass): finale double claim, non-winner claims,
// eligibility bypass
// =====================================================================
describe("PROBE 1/8-Q: QuestPass finale claims", function () {
  let issuer, creator, alice, bob, carol, mock, gate, token, quest, cfg;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    [issuer, creator, alice, bob, carol] = signers;
    ({ mock, gate } = await deployGate(signers));
    const Tok = await ethers.getContractFactory("MockERC20", creator);
    token = await Tok.deploy();
    for (const u of [alice, bob, carol]) await mock.issue(u.address);
    const now = await nowTs();
    cfg = { startAt: now + 60, slots: 5, dayPool: 500n, minStamps: 1, winners: 1, finalePool: 900n, entryWindow: 3600 };
    quest = await deployQuestERC20(creator, gate, token, cfg);
    await warpTo(cfg.startAt + 1);
    await quest.connect(alice).claimStamp();
    await quest.connect(bob).claimStamp();
    // carol never stamps
    await warpTo(Number(await quest.stampEnd()) + 1);
  });

  it("eligibility cannot be skipped: unstamped human -> NotEligible; double entry -> AlreadyCounted", async function () {
    await expectRevert(quest.connect(carol).enterFinale(), "NotEligible");
    await quest.connect(alice).enterFinale();
    await expectRevert(quest.connect(alice).enterFinale(), "AlreadyCounted");
    assert.equal(await quest.finaleEntryCount(), 1);
  });

  it("winner claims exactly once; loser, non-entrant and pre-draw claims all revert", async function () {
    await quest.connect(alice).enterFinale();
    await quest.connect(bob).enterFinale();
    // too early: no draw yet
    await expectRevert(quest.connect(alice).claimPrize(), "NotEnded");
    await warpTo(Number(await quest.entryEnd()) + 1);
    await quest.lockFinaleSeed();
    await mine(3);
    await quest.drawFinale();
    const winners = await quest.getWinners();
    assert.equal(winners.length, 1);
    const winner = [alice, bob].find(u => u.address === winners[0]);
    const loser = [alice, bob].find(u => u.address !== winners[0]);
    await expectRevert(quest.connect(loser).claimPrize(), "NotWinner");
    await expectRevert(quest.connect(carol).claimPrize(), "NotWinner");
    const before = await token.balanceOf(winner.address);
    await quest.connect(winner).claimPrize();
    assert.equal((await token.balanceOf(winner.address)) - before, 900n);
    // DOUBLE CLAIM
    await expectRevert(quest.connect(winner).claimPrize(), "AlreadyCounted");
    assert.equal(await quest.finalePaidTotal(), 900n);
  });
});

// =====================================================================
// ATTACK 2-Q: reentrancy on QuestPass BNB payouts
// =====================================================================
describe("PROBE 2-Q: QuestPass reentrancy (BNB)", function () {
  it("claimStamp and finale claimPrize pay a reentering receiver exactly once each", async function () {
    const signers = await ethers.getSigners();
    const [issuer, creator] = signers;
    const { mock, gate } = await deployGate(signers);
    const attacker = await ReceiverAttackerF.deploy();
    const atkAddr = await attacker.getAddress();
    await mock.issue(atkAddr);
    const now = await nowTs();
    const Q = await ethers.getContractFactory("QuestPass", creator);
    // BNB season: dayPool 2000 x7 + finale 1000 = 15000 wei escrow
    const quest = await Q.deploy(await gate.getAddress(), ethers.ZeroAddress, now + 60, 2, 2000n, 1, 1, 1000n, 3600, { value: 15000n });
    await warpTo(now + 61);
    // --- stamp reentry (mode 4)
    await attacker.arm(await quest.getAddress(), 4);
    await attacker.stamp(await quest.getAddress());
    assert.equal(await attacker.attempts(), 1n);
    assert.equal(await attacker.innerSucceeded(), false);
    assert.ok(Buffer.from((await attacker.innerError()).slice(2), "hex").toString("latin1").includes("reentrant"));
    assert.equal(await quest.stampCount(atkAddr), 1);
    const stampAmt = await quest.dayPaid(0);
    assert.equal(await ethers.provider.getBalance(atkAddr), stampAmt, "exactly one stamp payout");
    // --- finale: attacker is the sole entrant, so it must win
    await warpTo(Number(await quest.stampEnd()) + 1);
    await attacker.enterFin(await quest.getAddress());
    await warpTo(Number(await quest.entryEnd()) + 1);
    await quest.lockFinaleSeed();
    await mine(3);
    await quest.drawFinale();
    assert.deepEqual(await quest.getWinners(), [atkAddr]);
    // --- prize reentry (mode 3)
    await attacker.arm(await quest.getAddress(), 3);
    const attemptsBefore = await attacker.attempts();
    await attacker.claimPQ(await quest.getAddress());
    assert.equal((await attacker.attempts()) - attemptsBefore, 1n);
    assert.equal(await attacker.innerSucceeded(), false);
    assert.equal(await ethers.provider.getBalance(atkAddr), stampAmt + 1000n, "stamp + exactly one finale prize");
    assert.equal(await quest.prizeClaimed(atkAddr), true);
    await expectRevert(attacker.claimPQ(await quest.getAddress()), "AlreadyCounted");
  });
});

// =====================================================================
// ATTACK 3-Q + 6-Q: reclaim authority/timing; seed lock repetition;
// fallback-seed timing grind
// =====================================================================
describe("PROBE 3/6-Q: QuestPass reclaim & seed games", function () {
  let issuer, creator, alice, bob, mock, gate, token;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    [issuer, creator, alice, bob] = signers;
    ({ mock, gate } = await deployGate(signers));
    const Tok = await ethers.getContractFactory("MockERC20", creator);
    token = await Tok.deploy();
    for (const u of [alice, bob]) await mock.issue(u.address);
  });

  async function freshQuest() {
    const now = await nowTs();
    const cfg = { startAt: now + 60, slots: 3, dayPool: 700n, minStamps: 1, winners: 1, finalePool: 300n, entryWindow: 3600 };
    const quest = await deployQuestERC20(creator, gate, token, cfg);
    return { quest, cfg, total: 700n * 7n + 300n };
  }

  it("reclaim: non-creator can never call it; creator cannot call it before entryEnd + 30 days; exactly the remainder after", async function () {
    const { quest, cfg, total } = await freshQuest();
    await warpTo(cfg.startAt + 1);
    await quest.connect(alice).claimStamp();
    const stampPaid = await quest.stampPaidTotal();
    await warpTo(Number(await quest.entryEnd()) + 1);
    await expectRevert(quest.connect(alice).reclaim(), "NotCreator");
    await expectRevert(quest.connect(creator).reclaim(), "TooEarly");
    await warpTo(Number(await quest.entryEnd()) + 30 * DAY + 1);
    await expectRevert(quest.connect(alice).reclaim(), "NotCreator");
    const before = await token.balanceOf(creator.address);
    await quest.connect(creator).reclaim();
    assert.equal((await token.balanceOf(creator.address)) - before, total - stampPaid);
    assert.equal(await token.balanceOf(await quest.getAddress()), 0n);
    await expectRevert(quest.connect(creator).reclaim(), "AlreadyCounted");
  });

  it("admin surface: QuestPass exposes no owner/withdraw/sweep function at all", async function () {
    const { quest } = await freshQuest();
    const names = [];
    quest.interface.forEachFunction(f => names.push(f.name));
    for (const banned of ["owner", "withdraw", "sweep", "pause", "setCreator", "setGate", "upgradeTo"]) {
      assert.ok(!names.includes(banned), `unexpected admin function present: ${banned}`);
    }
  });

  it("seed lock: too early -> TooEarly; second lock -> AlreadyCounted; draw before the seed block -> NotEnded; second draw -> AlreadyDrawn", async function () {
    const { quest, cfg } = await freshQuest();
    await warpTo(cfg.startAt + 1);
    await quest.connect(alice).claimStamp();
    await warpTo(Number(await quest.stampEnd()) + 1);
    await quest.connect(alice).enterFinale();
    // entries still open
    await expectRevert(quest.lockFinaleSeed(), "TooEarly");
    await warpTo(Number(await quest.entryEnd()) + 1);
    await quest.lockFinaleSeed();
    const sb = await quest.finaleSeedBlock();
    assert.ok(sb > 0n);
    // the seed is one-shot: nobody can re-lock to shop for a better seed
    await expectRevert(quest.lockFinaleSeed(), "AlreadyCounted");
    // draw must wait for the seed block itself
    await expectRevert(quest.drawFinale(), "NotEnded");
    await mine(3);
    await quest.drawFinale();
    assert.equal(await quest.usedFallbackSeed(), false);
    await expectRevert(quest.drawFinale(), "AlreadyDrawn");
    await expectRevert(quest.lockFinaleSeed(), "AlreadyDrawn");
  });

  it("FALLBACK GRIND (quantified): after the seed block ages out, the draw caller can precompute the outcome per block and only draw on a favourable one", async function () {
    this.timeout(120000);
    const { quest, cfg } = await freshQuest();
    await warpTo(cfg.startAt + 1);
    await quest.connect(alice).claimStamp(); // victim enters first
    await quest.connect(bob).claimStamp();   // attacker second
    await warpTo(Number(await quest.stampEnd()) + 1);
    await quest.connect(alice).enterFinale();
    await quest.connect(bob).enterFinale();
    const entries = await quest.getFinaleEntries();
    assert.deepEqual(entries, [alice.address, bob.address]);
    await warpTo(Number(await quest.entryEnd()) + 1);
    await quest.lockFinaleSeed();
    const sb = await quest.finaleSeedBlock();
    // bury the seed block: blockhash(sb) now reads 0 -> fallback path,
    // whose seed is blockhash(block.number - 1) at draw time — PUBLIC
    // before the draw transaction is even sent.
    await mine(300);
    assert.ok(BigInt(await ethers.provider.getBlockNumber()) > sb + 256n);
    // observation window: without drawing, record who WOULD win if the
    // draw landed in the next block, for several consecutive blocks —
    // the outcome flips block to block and the caller sees each one
    // before deciding, which is exactly what makes the timing game work
    const wouldWin = [];
    for (let i = 0; i < 6; i++) {
      const h = BigInt((await ethers.provider.getBlock("latest")).hash);
      const j = Number(BigInt(ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [h, 0n]))) % 2n);
      wouldWin.push(entries[j] === bob.address ? "attacker" : "victim");
      await mine(1);
    }
    let skipped = 0;
    let drew = false;
    for (let i = 0; i < 80 && !drew; i++) {
      const latest = await ethers.provider.getBlock("latest");
      const seed = BigInt(latest.hash); // == blockhash(block.number - 1) for a draw landing in the next block
      const j = Number(BigInt(ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [seed, 0n]))) % 2n);
      if (entries[j] === bob.address) {
        await quest.drawFinale();
        drew = true;
      } else {
        skipped++;
        await mine(1);
      }
    }
    assert.ok(drew, "a favourable block arrived within 80 tries");
    assert.equal(await quest.usedFallbackSeed(), true);
    assert.deepEqual(await quest.getWinners(), [bob.address], "the grind delivered the win to the attacker");
    console.log(`\n    [grind] predicted fallback winner over 6 observed blocks: ${wouldWin.join(", ")}; attacker then skipped ${skipped} unfavourable block(s) and drew on a favourable one (fair odds would be 50%)`);
  });
});
