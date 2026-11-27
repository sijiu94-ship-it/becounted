const { ethers } = require("hardhat");
const assert = require("assert");

// =====================================================================
// SECURITY-FIX REGRESSIONS — 2026-11-23 pre-mainnet fix batch.
//
// Pins the fixed behaviour for every issue the deep audit confirmed:
//   1. C1 (Critical, OneIDCampaignsV10): claimPrize after the
//      creator's reclaim paid the same prize twice out of other
//      campaigns' escrow. The cross-campaign raffle case lives in
//      security-probe-c1.test.js; here: the VOTE path (same shared
//      claimPrize) and the standalone ClaimExpired deadline.
//   2. Fee-on-transfer tokens (Medium): funding accounted the nominal
//      amount while less arrived -> insolvency + locked funds.
//      Campaigns are pinned in security-probe.test.js PROBE 5; here:
//      QuestPass construction and the GatedClaim template.
//   3. Draw-seed timing (High): V10's creator-chosen seed + previous-
//      block fallback allowed draw-block grinding. Campaigns are
//      pinned in flow15 + PROBE 6; here: the QuestPass seed RE-LOCK
//      and the explicit SeasonClosed late-claim error.
//   4. IdentityBindingsV3: high-s (malleable) signatures rejected;
//      registrar role rotatable.
//   5. BeCounted: an EOA passed as the registry is rejected at
//      construction instead of bricking every isHuman read.
// =====================================================================

async function expectRevert(p, errName) {
  try { await p; } catch (e) {
    if (errName && !String(e.message).includes(errName)) throw new Error(`reverted but not with ${errName}: ${String(e.message).slice(0, 250)}`);
    return e;
  }
  throw new Error(`expected revert ${errName || ""} but call succeeded`);
}
async function mine(n) { await ethers.provider.send("hardhat_mine", [ethers.toBeHex(n)]); }
async function warp(secs) { await ethers.provider.send("evm_increaseTime", [secs]); await ethers.provider.send("evm_mine", []); }
async function warpTo(ts) { await ethers.provider.send("evm_setNextBlockTimestamp", [ts]); await ethers.provider.send("evm_mine", []); }
// Set the NEXT block's timestamp without mining, so the following
// transaction itself lands at exactly `ts`.
async function setNextTs(ts) { await ethers.provider.send("evm_setNextBlockTimestamp", [ts]); }
async function nowTs() { return (await ethers.provider.getBlock("latest")).timestamp; }

const MAXU = ethers.MaxUint256;
const NO_COND = { requireBinding: false, gateToken: ethers.ZeroAddress, gateMin: 0n, gateIs721: false, requireEnteredId: MAXU, minStamps: 0, questRef: ethers.ZeroAddress, allowRoot: ethers.ZeroHash, idListRoot: ethers.ZeroHash };
const DAY = 86400;

async function createdId(apps, tx) {
  const rc = await tx.wait();
  const ev = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } }).find(e => e && e.name === "CampaignCreated");
  return Number(ev.args.id);
}
async function lockAndDraw(apps, id) {
  await apps.lockDraw(id);
  await mine(3);
  await apps.draw(id);
}

// ---------------------------------------------------------------------
// 1a. C1 on the VOTE path + the standalone ClaimExpired deadline
// ---------------------------------------------------------------------
describe("fix regression: C1 vote path & ClaimExpired (OneIDCampaignsV11)", function () {
  let mock, gate, bindings, apps, token, issuer, creator, alice, bob;

  beforeEach(async function () {
    [issuer, creator, alice, bob] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    gate = await Gate.deploy(await mock.getAddress());
    const Bind = await ethers.getContractFactory("IdentityBindings", issuer);
    bindings = await Bind.deploy();
    const Apps = await ethers.getContractFactory("OneIDCampaignsV11", creator);
    apps = await Apps.deploy(await gate.getAddress(), await bindings.getAddress());
    const Tok = await ethers.getContractFactory("MockERC20", creator);
    token = await Tok.deploy();
    for (const u of [alice, bob]) await mock.issue(u.address);
  });

  it("prize vote: winner claiming after the creator's reclaim reverts (AlreadyCounted); the pool is not double-paid", async function () {
    const pool = 200n;
    await token.mint(creator.address, pool);
    await token.connect(creator).approve(await apps.getAddress(), pool);
    const now = await nowTs();
    const id = await createdId(apps, await apps.connect(creator).createVote(
      "pv", now - 10, now + 600, 2, await token.getAddress(), pool, 1, NO_COND, ["A", "B"]));
    await apps.connect(alice).castVote(id, 0, [], []); // sole voter -> sole winner
    await warp(700);
    await lockAndDraw(apps, id);
    assert.deepEqual(await apps.getWinners(id), [alice.address]);
    assert.equal((await apps.getCampaign(id)).prizePerWinner, pool);
    // window passes unclaimed; creator reclaims the whole pool
    const camp = await apps.getCampaign(id);
    await warpTo(Number(camp.endAt) + 30 * DAY + 1);
    await apps.connect(creator).reclaim(id);
    assert.equal(await token.balanceOf(creator.address), pool, "creator recovered the unclaimed pool");
    assert.equal(await token.balanceOf(await apps.getAddress()), 0n);
    // the C1 move: the winner claims anyway -> hard revert, no payment
    await expectRevert(apps.connect(alice).claimPrize(id), "AlreadyCounted");
    assert.equal(await token.balanceOf(alice.address), 0n);
    assert.equal((await apps.getCampaign(id)).paidOut, pool, "paidOut stays at the reclaimed total — never above it");
  });

  it("ClaimExpired: with NO reclaim at all, a claim after endAt + 30 days reverts ClaimExpired; a claim at exactly the deadline still works", async function () {
    const per = 50n;
    await token.mint(creator.address, per * 2n);
    await token.connect(creator).approve(await apps.getAddress(), per * 2n);
    const now = await nowTs();
    const id = await createdId(apps, await apps.connect(creator).createRaffle(
      "exp", now - 10, now + 600, 2, await token.getAddress(), per, NO_COND, ""));
    await apps.connect(alice).enterRaffle(id, [], []);
    await apps.connect(bob).enterRaffle(id, [], []);
    await warp(700);
    await lockAndDraw(apps, id);
    assert.equal((await apps.getWinners(id)).length, 2, "both entrants win (k == n)");
    const camp = await apps.getCampaign(id);
    // alice claims at exactly endAt + 30 days: the deadline is a
    // strict >, so the last instant of the window is still claimable.
    // setNextTs (no mining) makes her claim land in that exact block.
    await setNextTs(Number(camp.endAt) + 30 * DAY);
    await apps.connect(alice).claimPrize(id);
    assert.equal(await token.balanceOf(alice.address), per);
    // bob is one step past it — and the creator has NOT reclaimed, so
    // the refusal must come from the deadline itself
    assert.equal((await apps.getCampaign(id)).reclaimed, false);
    await expectRevert(apps.connect(bob).claimPrize(id), "ClaimExpired");
    assert.equal(await token.balanceOf(bob.address), 0n);
  });
});

// ---------------------------------------------------------------------
// 2 + 3. QuestPass & GatedClaim: fee-token funding, seed re-lock,
//        SeasonClosed
// ---------------------------------------------------------------------
describe("fix regression: QuestPass & GatedClaim (fee funding, re-lock, SeasonClosed)", function () {
  let mock, gate, token, issuer, creator, alice, bob;

  beforeEach(async function () {
    [issuer, creator, alice, bob] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    gate = await Gate.deploy(await mock.getAddress());
    const Tok = await ethers.getContractFactory("MockERC20", creator);
    token = await Tok.deploy();
    for (const u of [alice, bob]) await mock.issue(u.address);
  });

  async function deployQuest(cfg, tok) {
    const total = cfg.dayPool * 7n + cfg.finalePool;
    await tok.mint(creator.address, total);
    const nonce = await ethers.provider.getTransactionCount(creator.address);
    const predicted = ethers.getCreateAddress({ from: creator.address, nonce: nonce + 1 });
    await tok.connect(creator).approve(predicted, total);
    const Q = await ethers.getContractFactory("QuestPass", creator);
    return Q.deploy(await gate.getAddress(), await tok.getAddress(), cfg.startAt,
      cfg.slots, cfg.dayPool, cfg.minStamps, cfg.winners, cfg.finalePool, cfg.entryWindow);
  }

  it("fee token: QuestPass construction reverts InsufficientReceived (escrow would land 10% short)", async function () {
    const Fee = await ethers.getContractFactory("MockFeeERC20", creator);
    const fee = await Fee.deploy();
    const now = await nowTs();
    const cfg = { startAt: now + 60, slots: 3, dayPool: 700n, minStamps: 1, winners: 1, finalePool: 300n, entryWindow: 3600 };
    await expectRevert(deployQuest(cfg, fee), "InsufficientReceived");
    // nothing was escrowed anywhere: the creator still holds it all
    assert.equal(await fee.balanceOf(creator.address), 700n * 7n + 300n);
  });

  it("fee token: GatedClaim fund() reverts InsufficientReceived and the drop stays unfunded; a standard token funds fine (control)", async function () {
    const Fee = await ethers.getContractFactory("MockFeeERC20", creator);
    const fee = await Fee.deploy();
    const now = await nowTs();
    const G = await ethers.getContractFactory("GatedClaim", creator);
    const drop = await G.deploy(await gate.getAddress(), await fee.getAddress(), 1000n, 10, now - 10, now + 3600);
    await fee.mint(creator.address, 1000n);
    await fee.connect(creator).approve(await drop.getAddress(), 1000n);
    await expectRevert(drop.connect(creator).fund(), "InsufficientReceived");
    assert.equal(await drop.funded(), false);
    assert.equal(await fee.balanceOf(await drop.getAddress()), 0n);
    assert.equal(await fee.balanceOf(creator.address), 1000n);
    // control: same shape, honest token
    const good = await G.deploy(await gate.getAddress(), await token.getAddress(), 1000n, 10, now - 10, now + 3600);
    await token.mint(creator.address, 1000n);
    await token.connect(creator).approve(await good.getAddress(), 1000n);
    await good.connect(creator).fund();
    assert.equal(await good.funded(), true);
    assert.equal(await token.balanceOf(await good.getAddress()), 1000n);
  });

  it("seed re-lock: a valid lock cannot be replaced, an aged-out lock can — and the re-locked draw uses the real seed (no fallback)", async function () {
    const now = await nowTs();
    const cfg = { startAt: now + 60, slots: 3, dayPool: 700n, minStamps: 1, winners: 1, finalePool: 300n, entryWindow: 3600 };
    const quest = await deployQuest(cfg, token);
    await warpTo(cfg.startAt + 1);
    await quest.connect(alice).claimStamp();
    await warpTo(Number(await quest.stampEnd()) + 1);
    await quest.connect(alice).enterFinale();
    await warpTo(Number(await quest.entryEnd()) + 1);
    await quest.lockFinaleSeed();
    const sb1 = await quest.finaleSeedBlock();
    assert.ok(sb1 > 0n);
    // while the lock is valid a second lock is refused (no seed shopping)
    await expectRevert(quest.lockFinaleSeed(), "AlreadyCounted");
    // bury the seed block beyond the blockhash window, then re-lock
    await mine(300);
    assert.ok(BigInt(await ethers.provider.getBlockNumber()) > sb1 + 256n);
    await quest.lockFinaleSeed();
    const sb2 = await quest.finaleSeedBlock();
    assert.ok(sb2 > sb1, "re-lock refreshed the seed block");
    await mine(3);
    await quest.drawFinale();
    assert.equal(await quest.usedFallbackSeed(), false, "the draw ran on the re-locked seed, not the fallback");
    assert.deepEqual(await quest.getWinners(), [alice.address]);
    const balBefore = await token.balanceOf(alice.address); // includes her day-0 stamp payout
    await quest.connect(alice).claimPrize();
    assert.equal((await token.balanceOf(alice.address)) - balBefore, 300n, "finale prize paid in full");
  });

  it("SeasonClosed: after the creator's reclaim, a drawn winner's late claim reverts SeasonClosed (not an opaque payout failure)", async function () {
    const now = await nowTs();
    const cfg = { startAt: now + 60, slots: 3, dayPool: 700n, minStamps: 1, winners: 1, finalePool: 300n, entryWindow: 3600 };
    const quest = await deployQuest(cfg, token);
    await warpTo(cfg.startAt + 1);
    await quest.connect(alice).claimStamp();
    await warpTo(Number(await quest.stampEnd()) + 1);
    await quest.connect(alice).enterFinale();
    await warpTo(Number(await quest.entryEnd()) + 1);
    await quest.lockFinaleSeed();
    await mine(3);
    await quest.drawFinale();
    assert.deepEqual(await quest.getWinners(), [alice.address]);
    // winner never claims; the window passes and the creator reclaims
    await warpTo(Number(await quest.entryEnd()) + 30 * DAY + 1);
    await quest.connect(creator).reclaim();
    assert.equal(await quest.reclaimed(), true);
    assert.equal(await quest.finaleReclaimed(), true);
    await expectRevert(quest.connect(alice).claimPrize(), "SeasonClosed");
  });
});

// ---------------------------------------------------------------------
// 4. IdentityBindingsV3: low-s enforcement + registrar rotation
// ---------------------------------------------------------------------
describe("fix regression: IdentityBindingsV3 (low-s, registrar rotation)", function () {
  let bindings, registrar, newRegistrar, third, alice, bob;
  // n / 2 for secp256k1 — the exact threshold IdentityBindingsV3
  // enforces (verified digit-for-digit against @noble/curves' order).
  const SECP_HALF = BigInt("0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0");
  const SECP_N = SECP_HALF * 2n + 1n; // the curve order is odd

  beforeEach(async function () {
    [registrar, newRegistrar, third, alice, bob] = await ethers.getSigners();
    const Bind = await ethers.getContractFactory("IdentityBindingsV3", registrar);
    bindings = await Bind.deploy();
  });

  async function signBind(signer, handle, bind) {
    const stmt = await bind.statementFor(handle, signer.address);
    return signer.signMessage(stmt);
  }
  // Build the malleable copy (r, n - s, v^1) from the raw bytes: it
  // recovers the SAME signer as the canonical low-s original.
  function malleate(sig) {
    const b = ethers.getBytes(sig);
    const s = BigInt(ethers.hexlify(b.slice(32, 64)));
    assert.ok(s <= SECP_HALF, "ethers produces low-s signatures");
    const out = new Uint8Array(65);
    out.set(b.slice(0, 32), 0);
    out.set(ethers.getBytes(ethers.toBeHex(SECP_N - s, 32)), 32);
    out[64] = b[64] === 27 ? 28 : 27;
    return ethers.hexlify(out);
  }

  it("low-s: the canonical signature registers; its malleable high-s copy is rejected on V3 (and was accepted on V2)", async function () {
    const sig = await signBind(alice, "alice_x", bindings);
    await bindings.connect(alice).registerBinding("alice_x", sig);
    assert.equal(await bindings.proofTypeOf(alice.address), 0);
    // the flipped copy recovers the SAME signer — V2 accepted it
    const mal = malleate(sig);
    const Bind2 = await ethers.getContractFactory("IdentityBindingsV2", registrar);
    const v2 = await Bind2.deploy();
    const stmt2 = await v2.statementFor("alice_x", alice.address);
    assert.equal(stmt2, await bindings.statementFor("alice_x", alice.address), "same canonical statement across versions");
    await v2.connect(alice).registerBinding("alice_x", mal);
    assert.equal(await v2.isBindingValid(alice.address), true, "V2 accepted the malleable copy (characterisation)");
    // V3 refuses it, for registration AND therefore for validity
    await expectRevert(bindings.connect(bob).registerBinding("bob_x", malleate(await signBind(bob, "bob_x", bindings))), "BadSignature");
    assert.equal(await bindings.isBindingValid(bob.address), false);
  });

  it("registrar rotation: only the current registrar can transfer; zero address rejected; the old registrar loses its powers, the new one gains them", async function () {
    assert.equal(await bindings.registrar(), registrar.address);
    await expectRevert(bindings.connect(alice).transferRegistrar(newRegistrar.address), "NotRegistrar");
    await expectRevert(bindings.connect(registrar).transferRegistrar(ethers.ZeroAddress), "BadRegistrar");
    const tx = await bindings.connect(registrar).transferRegistrar(newRegistrar.address);
    const rc = await tx.wait();
    const ev = rc.logs.map(l => { try { return bindings.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "RegistrarTransferred");
    assert.ok(ev, "RegistrarTransferred emitted");
    assert.equal(ev.args.previousRegistrar, registrar.address);
    assert.equal(ev.args.newRegistrar, newRegistrar.address);
    assert.equal(await bindings.registrar(), newRegistrar.address);
    // old registrar is powerless now
    await expectRevert(bindings.connect(registrar).registerByAttestation(bob.address, "bob_agentic"), "NotRegistrar");
    await expectRevert(bindings.connect(registrar).transferRegistrar(third.address), "NotRegistrar");
    // new registrar can attest — and rotate onwards
    await bindings.connect(newRegistrar).registerByAttestation(bob.address, "bob_agentic");
    assert.equal(await bindings.proofTypeOf(bob.address), 1);
    assert.equal(await bindings.isBindingValid(bob.address), true);
    await bindings.connect(newRegistrar).transferRegistrar(third.address);
    assert.equal(await bindings.registrar(), third.address);
    await bindings.connect(third).revokeAttestation(bob.address);
    assert.equal(await bindings.isBindingValid(bob.address), false);
  });

  it("V3 keeps V2's guardrails: attestation still cannot overwrite a signature binding", async function () {
    const sig = await signBind(alice, "alice_x", bindings);
    await bindings.connect(alice).registerBinding("alice_x", sig);
    await expectRevert(bindings.connect(registrar).registerByAttestation(alice.address, "alice_other"), "ProofDowngrade");
    assert.equal(await bindings.proofTypeOf(alice.address), 0);
  });
});

// ---------------------------------------------------------------------
// 5. BeCounted: registry must be a contract
// ---------------------------------------------------------------------
describe("fix regression: BeCounted registry codesize check", function () {
  it("deploying against an EOA reverts; against a real registry contract it deploys", async function () {
    const [issuer, alice] = await ethers.getSigners();
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    await expectRevert(Gate.deploy(alice.address), "registry has no code");
    await expectRevert(Gate.deploy(ethers.ZeroAddress), "registry is zero");
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
    const mock = await Mock.deploy();
    const gate = await Gate.deploy(await mock.getAddress());
    assert.equal(await gate.registry(), await mock.getAddress());
  });
});
