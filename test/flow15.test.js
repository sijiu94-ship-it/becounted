const { ethers } = require("hardhat");
const assert = require("assert");

// =====================================================================
// flow15 — AUDIT COVERAGE GAPS (2026-11-23 full-site audit, test lane)
//
// The 88-test suite covered the money paths but never exercised:
//   1. the DRAW SEED path end-to-end (V11 lock-draw: lock after the
//      end, draw inside the blockhash window, re-lock after expiry —
//      V10's fallback branch, which this section used to pin, was
//      removed by the 2026-11-23 security-fix batch),
//   2. QuestPass finale with ZERO entries, and reclaim when the finale
//      was never drawn,
//   3. BeCounted.isHuman(address(0)) against a registry with REAL
//      ERC-721 semantics (characterization — audit item L6),
//   4. condition 5 when the registry returns a MIXED-CASE handle
//      (characterization — audit assumption L1),
//   5. draw() gas at a realistic-but-large entrant count (audit M1:
//      the O(n) draw has a hard ceiling somewhere; observe, don't cap).
// Characterization tests are labelled as such: they pin CURRENT
// behaviour so a future change shows up as a deliberate test edit.
// =====================================================================

async function expectRevert(p, errName) {
  try { await p; } catch (e) {
    if (errName && !String(e.message).includes(errName)) throw new Error(`reverted but not with ${errName}: ${String(e.message).slice(0, 200)}`);
    return;
  }
  throw new Error(`expected revert ${errName || ""} but call succeeded`);
}

async function mine(n) { await ethers.provider.send("hardhat_mine", [ethers.toBeHex(n)]); }
async function warp(secs) { await ethers.provider.send("evm_increaseTime", [secs]); await ethers.provider.send("evm_mine", []); }
async function warpTo(ts) { await ethers.provider.send("evm_setNextBlockTimestamp", [ts]); await ethers.provider.send("evm_mine", []); }

const MAXU = ethers.MaxUint256;
const NO_COND = { requireBinding: false, gateToken: ethers.ZeroAddress, gateMin: 0n, gateIs721: false, requireEnteredId: MAXU, minStamps: 0, questRef: ethers.ZeroAddress, allowRoot: ethers.ZeroHash, idListRoot: ethers.ZeroHash };
const DAY = 86400;

// ---------------------------------------------------------------------
// 1a. OneIDCampaignsV11 draw seed: lock-after-end state machine.
//     V11 removed the creator-chosen creation-time seedBlock AND the
//     previous-block fallback: the seed block is locked on-chain after
//     entries close (block.number + 2 at lock time), the draw runs
//     only inside its 256-block blockhash window, and an aged-out lock
//     is refreshed by re-locking — never by falling back to a hash the
//     draw caller could already read.
// ---------------------------------------------------------------------
describe("audit gap: OneIDCampaignsV11 lock-draw seed", function () {
  let mock, gate, bindings, apps, issuer, creator, alice, bob;

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
    await mock.issue(alice.address);
    await mock.issue(bob.address);
  });

  async function enteredRaffle(prize) {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const tx = await apps.connect(creator).createRaffle("lk", now - 10, now + 600, 1,
      ethers.ZeroAddress, prize, NO_COND, "", { value: prize });
    const rc0 = await tx.wait();
    const id = Number(rc0.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "CampaignCreated").args.id);
    await apps.connect(alice).enterRaffle(id, [], []);
    await apps.connect(bob).enterRaffle(id, [], []);
    return id;
  }

  it("no lock, no draw: draw before lockDraw reverts SeedNotLocked; lockDraw before the end reverts NotEnded", async function () {
    const prize = ethers.parseEther("0.001");
    const id = await enteredRaffle(prize);
    await expectRevert(apps.lockDraw(id), "NotEnded");
    await warp(700); // campaign over, but nobody locked a seed
    await expectRevert(apps.draw(id), "SeedNotLocked");
    assert.equal((await apps.getCampaign(id)).drawn, false);
  });

  it("locked seed draws inside the window: usedFallbackSeed is false, winner claims the escrow", async function () {
    const prize = ethers.parseEther("0.001");
    const id = await enteredRaffle(prize);
    await warp(700);
    const ltx = await apps.lockDraw(id);
    const lrc = await ltx.wait();
    const lev = lrc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "DrawSeedLocked");
    assert.ok(lev, "DrawSeedLocked emitted");
    assert.equal(Number(lev.args.seedBlock), lrc.blockNumber + 2);
    // a second lock while this one is valid is refused (no seed shopping)
    await expectRevert(apps.lockDraw(id), "SeedLocked");
    // draw must still wait for the seed block itself
    await expectRevert(apps.draw(id), "NotEnded");
    await mine(3);
    const dtx = await apps.draw(id);
    const drc = await dtx.wait();
    const dev = drc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "Drawn");
    assert.ok(dev, "Drawn emitted");
    assert.equal(dev.args.usedFallbackSeed, false);
    const camp = await apps.getCampaign(id);
    assert.equal(camp.drawn, true);
    assert.equal(camp.usedFallbackSeed, false);
    const winners = await apps.getWinners(id);
    assert.equal(winners.length, 1);
    const signer = [alice, bob].find(u => u.address === winners[0]);
    const before = await ethers.provider.getBalance(winners[0]);
    const ctx = await apps.connect(signer).claimPrize(id);
    const crc = await ctx.wait();
    const after = await ethers.provider.getBalance(winners[0]);
    assert.equal(after - before + crc.gasUsed * crc.gasPrice, prize);
    assert.equal((await apps.getCampaign(id)).paidOut, prize);
    // and locking after the draw is refused too
    await expectRevert(apps.lockDraw(id), "AlreadyDrawn");
  });

  it("aged-out lock: draw reverts SeedExpired (no fallback), lockDraw re-locks a fresh seed, draw then succeeds", async function () {
    const prize = ethers.parseEther("0.001");
    const id = await enteredRaffle(prize);
    await warp(700);
    await apps.lockDraw(id);
    const sb1 = (await apps.getCampaign(id)).seedBlock;
    assert.ok(sb1 > 0n);
    // bury the locked seed block beyond the 256-block blockhash window
    await mine(300);
    assert.ok(BigInt(await ethers.provider.getBlockNumber()) > sb1 + 256n, "seed block outside the blockhash window");
    await expectRevert(apps.draw(id), "SeedExpired");
    // re-lock is now allowed and points at a fresh future block
    await apps.lockDraw(id);
    const sb2 = (await apps.getCampaign(id)).seedBlock;
    assert.ok(sb2 > sb1, "re-lock refreshed the seed block");
    await mine(3);
    const dtx = await apps.draw(id);
    const drc = await dtx.wait();
    const dev = drc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "Drawn");
    assert.ok(dev, "Drawn emitted after re-lock");
    assert.equal(dev.args.usedFallbackSeed, false);
    assert.equal((await apps.getWinners(id)).length, 1);
  });
});

// ---------------------------------------------------------------------
// 1b + 2 + 3. QuestPass finale: fallback seed, zero entries, no-draw
// ---------------------------------------------------------------------
describe("audit gap: QuestPass finale edges", function () {
  let mock, gate, token, issuer, creator, alice;

  beforeEach(async function () {
    [issuer, creator, alice] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    gate = await Gate.deploy(await mock.getAddress());
    const Tok = await ethers.getContractFactory("MockERC20", creator);
    token = await Tok.deploy();
    await mock.issue(alice.address);
  });

  // Funded deploy (constructor pulls the escrow via transferFrom):
  // predict the address, approve, then deploy — same pattern as flow8.
  async function deployQuest() {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const cfg = { startAt: now + 60, slots: 3, dayPool: 700n, minStamps: 1, winners: 1, finalePool: 300n, entryWindow: 3600 };
    const total = cfg.dayPool * 7n + cfg.finalePool; // 5200
    await token.mint(creator.address, total);
    const nonce = await ethers.provider.getTransactionCount(creator.address);
    const predicted = ethers.getCreateAddress({ from: creator.address, nonce: nonce + 1 });
    await token.connect(creator).approve(predicted, total);
    const Q = await ethers.getContractFactory("QuestPass", creator);
    const quest = await Q.deploy(await gate.getAddress(), await token.getAddress(), cfg.startAt,
      cfg.slots, cfg.dayPool, cfg.minStamps, cfg.winners, cfg.finalePool, cfg.entryWindow);
    assert.equal(await quest.getAddress(), predicted);
    return { quest, cfg, total };
  }

  it("fallback seed: seed block aged out -> drawFinale uses the fallback, sets usedFallbackSeed, winner claims", async function () {
    const { quest, cfg } = await deployQuest();
    await warpTo(cfg.startAt + 1);
    await quest.connect(alice).claimStamp();
    await warpTo(Number(await quest.stampEnd()) + 1);
    await quest.connect(alice).enterFinale();
    await warpTo(Number(await quest.entryEnd()) + 1);
    await quest.lockFinaleSeed();
    const seedBlock = await quest.finaleSeedBlock();
    assert.ok(seedBlock > 0n);
    // bury the seed block beyond the 256-block blockhash window
    await mine(300);
    assert.ok(BigInt(await ethers.provider.getBlockNumber()) > seedBlock + 256n, "seed block outside the blockhash window");
    const tx = await quest.drawFinale();
    const rc = await tx.wait();
    const ev = rc.logs.map(l => { try { return quest.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "FinaleDrawn");
    assert.ok(ev, "FinaleDrawn emitted");
    assert.equal(ev.args.usedFallbackSeed, true);
    assert.equal(await quest.usedFallbackSeed(), true);
    assert.deepEqual(await quest.getWinners(), [alice.address]);
    const before = await token.balanceOf(alice.address);
    await quest.connect(alice).claimPrize();
    assert.equal((await token.balanceOf(alice.address)) - before, 300n);
  });

  it("zero entries: drawFinale succeeds and draws zero winners (k clamps to n = 0); nothing gets stuck", async function () {
    const { quest, cfg, total } = await deployQuest();
    // nobody stamps, nobody enters; run the clock out
    await warpTo(Number(await quest.entryEnd()) + 1);
    assert.equal(await quest.phase(), 3);
    await quest.lockFinaleSeed();
    await mine(3);
    const tx = await quest.drawFinale();
    const rc = await tx.wait();
    const ev = rc.logs.map(l => { try { return quest.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "FinaleDrawn");
    assert.ok(ev, "FinaleDrawn emitted");
    assert.equal(Number(ev.args.winnerCount), 0);
    assert.equal(ev.args.usedFallbackSeed, false);
    assert.equal(await quest.finaleDrawn(), true);
    assert.equal((await quest.getWinners()).length, 0);
    // nobody can claim a prize that was never drawn to anyone
    await expectRevert(quest.connect(alice).claimPrize(), "NotWinner");
    // and the whole escrow stays reclaimable by the creator afterwards
    await warpTo(Number(await quest.entryEnd()) + 31 * DAY);
    const before = await token.balanceOf(creator.address);
    await quest.connect(creator).reclaim();
    assert.equal((await token.balanceOf(creator.address)) - before, total);
  });

  it("finale never drawn: creator reclaims everything after the window; a late prize claim fails NotEnded", async function () {
    const { quest, cfg, total } = await deployQuest();
    await warpTo(cfg.startAt + 1);
    await quest.connect(alice).claimStamp();
    await warpTo(Number(await quest.stampEnd()) + 1);
    await quest.connect(alice).enterFinale();
    assert.equal(await quest.finaleEntryCount(), 1);
    // NOTE: seed is never locked and drawFinale is never called.
    await expectRevert(quest.connect(creator).reclaim(), "TooEarly");
    await warpTo(Number(await quest.entryEnd()) + 31 * DAY);
    const stampPaid = await quest.stampPaidTotal();
    assert.ok(stampPaid > 0n && stampPaid <= 700n, "one stamp was paid");
    const before = await token.balanceOf(creator.address);
    await quest.connect(creator).reclaim();
    // remainder = full escrow minus the one stamp payout; finale pool intact
    assert.equal((await token.balanceOf(creator.address)) - before, total - stampPaid);
    assert.equal(await token.balanceOf(await quest.getAddress()), 0n);
    assert.equal(await quest.reclaimed(), true);
    // the would-be finalist's late claim fails: no draw ever happened
    await expectRevert(quest.connect(alice).claimPrize(), "NotEnded");
    await expectRevert(quest.connect(creator).reclaim(), "AlreadyCounted");
  });
});

// ---------------------------------------------------------------------
// 4. CHARACTERIZATION (audit L6): BeCounted.isHuman(address(0))
//    KNOWN BEHAVIOUR — BeCounted has no zero-address short-circuit, so
//    against a registry with real ERC-721 semantics (the SPACE ID
//    registry is OpenZeppelin ERC-721 based, whose balanceOf reverts
//    for the zero address) isHuman(0) REVERTS instead of returning
//    false. Wave 2 plans `if (account == address(0)) return false;`.
//    The project's own mocks return 0 for the zero address and thereby
//    MASK this — pinned by the contrast test at the bottom.
//    (The real-semantics registry is compiled in-test with solc
//    because contracts/ is frozen for this lane.)
// ---------------------------------------------------------------------
describe("audit characterization: BeCounted.isHuman(address(0))", function () {
  let issuer, alice, bob, realGate, mockGate;

  before(async function () {
    [issuer, alice, bob] = await ethers.getSigners();
    const solc = require("solc");
    const source = `
      // SPDX-License-Identifier: MIT
      pragma solidity ^0.8.24;
      /// Test-only stand-in with REAL ERC-721 registry semantics:
      /// balanceOf(address(0)) reverts, like OpenZeppelin ERC721.
      contract RealSemanticsRegistry {
          error ERC721InvalidOwner(address owner);
          mapping(address => uint256) private _balances;
          function setHuman(address who, bool human) external { _balances[who] = human ? 1 : 0; }
          function balanceOf(address owner) external view returns (uint256) {
              if (owner == address(0)) revert ERC721InvalidOwner(owner);
              return _balances[owner];
          }
          function handleOf(address) external pure returns (string memory) { return ""; }
      }`;
    const input = {
      language: "Solidity",
      sources: { "RealSemanticsRegistry.sol": { content: source } },
      settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
    };
    const out = JSON.parse(solc.compile(JSON.stringify(input)));
    const errs = (out.errors || []).filter(e => e.severity === "error");
    assert.equal(errs.length, 0, errs.map(e => e.formattedMessage).join("\n"));
    const c = out.contracts["RealSemanticsRegistry.sol"].RealSemanticsRegistry;
    const factory = new ethers.ContractFactory(c.abi, c.evm.bytecode.object, issuer);
    const realReg = await factory.deploy();
    await realReg.setHuman(alice.address, true);
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    realGate = await Gate.deploy(await realReg.getAddress());
    // contrast stack: the project's lenient mock
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
    const mock = await Mock.deploy();
    mockGate = await Gate.deploy(await mock.getAddress());
  });

  it("KNOWN BEHAVIOUR (L6): against a real-semantics registry, isHuman(0) reverts (ERC721InvalidOwner) instead of returning false", async function () {
    await expectRevert(realGate.isHuman(ethers.ZeroAddress));
    // sanity: ordinary addresses answer normally on the same stack
    assert.equal(await realGate.isHuman(alice.address), true);
    assert.equal(await realGate.isHuman(bob.address), false);
  });

  it("contrast: the lenient project mock masks it — isHuman(0) returns false there", async function () {
    assert.equal(await mockGate.isHuman(ethers.ZeroAddress), false);
  });
});

// ---------------------------------------------------------------------
// 5. CHARACTERIZATION (audit L1): condition 5 handle case sensitivity.
//    KNOWN ASSUMPTION — the contract builds the identity leaf from the
//    registry's raw handle string and does NO case normalization; the
//    product builds lists from bare lowercase labels only. If a
//    registry ever returned a mixed-case handle, a listed user would
//    be rejected — the failure direction is fail-closed (nobody gets
//    in wrongly, no funds at risk). The real registry stores bare
//    lowercase labels (verified on mainnet 2026-11-23:
//    handleOf(0x119B...2aB9) = "9nosing").
// ---------------------------------------------------------------------
describe("audit characterization: condition 5 handle case (L1)", function () {
  let mock, gate, bindings, apps, issuer, creator, alice, bob;

  function idLeafOf(handle) {
    const labelhash = ethers.keccak256(ethers.toUtf8Bytes(handle));
    return ethers.keccak256(ethers.solidityPacked(["bytes32"], [labelhash]));
  }
  function hashPair(a, b) {
    const [x, y] = a < b ? [a, b] : [b, a];
    return ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [x, y]));
  }
  function idRoot(handles) {
    let level = handles.map(idLeafOf);
    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? hashPair(level[i], level[i + 1]) : level[i]);
      level = next;
    }
    return level[0];
  }
  function idProof(handles, h) {
    const layers = [handles.map(idLeafOf)];
    let level = layers[0];
    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? hashPair(level[i], level[i + 1]) : level[i]);
      level = next; layers.push(level);
    }
    let idx = handles.findIndex(x => x === h);
    const proof = [];
    for (let li = 0; li < layers.length - 1; li++) {
      const lv = layers[li];
      const sib = idx % 2 === 0 ? idx + 1 : idx - 1;
      if (sib < lv.length) proof.push(lv[sib]);
      idx = Math.floor(idx / 2);
    }
    return proof;
  }

  async function expectCondition5(p) {
    try { await p; } catch (e) {
      const data = e.data || (e.info && e.info.error && e.info.error.data) || null;
      if (data && data !== "0x") {
        const parsed = apps.interface.parseError(data);
        assert(parsed && parsed.name === "ConditionFailed" && Number(parsed.args[0]) === 5,
          "not ConditionFailed(5): " + (parsed && parsed.name));
        return;
      }
      if (String(e.message).includes("ConditionFailed(5)")) return;
      throw new Error("unexpected error: " + String(e.message).slice(0, 200));
    }
    throw new Error("expected ConditionFailed(5) but call succeeded");
  }

  beforeEach(async function () {
    [issuer, creator, alice, bob] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockRegistryV2", issuer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    gate = await Gate.deploy(await mock.getAddress());
    const Bind = await ethers.getContractFactory("IdentityBindings", issuer);
    bindings = await Bind.deploy();
    const Apps = await ethers.getContractFactory("OneIDCampaignsV11", creator);
    apps = await Apps.deploy(await gate.getAddress(), await bindings.getAddress());
    // the mock accepts any case (uniqueness is on the raw string)
    await mock.connect(alice).registerHandle("TrialOne"); // MIXED case
    await mock.connect(bob).registerHandle("bobai");      // lowercase control
  });

  it("KNOWN ASSUMPTION (L1): mixed-case registry handle misses the lowercase-built list -> ConditionFailed(5); lowercase control enters", async function () {
    // the list is built exactly the way the product builds it: lowercase only
    const handles = ["trialone", "bobai"];
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const tx = await apps.connect(creator).createRaffle("case", now - 10, now + 3600, 1,
      ethers.ZeroAddress, 0n, { ...NO_COND, idListRoot: idRoot(handles) }, "");
    const rc = await tx.wait();
    const id = Number(rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "CampaignCreated").args.id);
    assert.equal(await mock.handleOf(alice.address), "TrialOne");
    // alice IS the listed person ("trialone") but her registry handle is
    // "TrialOne": the leaf differs, the proof cannot verify -> rejected
    await expectCondition5(apps.connect(alice).enterRaffle.staticCall(id, [], idProof(handles, "trialone")));
    await expectRevert(apps.connect(alice).enterRaffle(id, [], idProof(handles, "trialone")), "ConditionFailed");
    assert.equal(await apps.hasEntered(id, alice.address), false);
    // control: bob's lowercase handle matches the lowercase-built list
    await apps.connect(bob).enterRaffle(id, [], idProof(handles, "bobai"));
    assert.equal(await apps.hasEntered(id, bob.address), true);
  });
});

// ---------------------------------------------------------------------
// 6. Gas observation (audit M1): draw() at 2,000 entrants.
//    No hard gas assertion — the number is logged for the record so
//    the practical ceiling can be extrapolated (draw is O(n) memory +
//    O(k) swaps; BSC block gas limit is the binding constraint).
// ---------------------------------------------------------------------
describe("audit observation: draw() gas at 2000 entrants (M1)", function () {
  it("draw() succeeds with 2000 entrants / 10 winners; gasUsed logged", async function () {
    this.timeout(900000);
    const [issuer, creator] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
    const mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    const gate = await Gate.deploy(await mock.getAddress());
    const Bind = await ethers.getContractFactory("IdentityBindings", issuer);
    const bindings = await Bind.deploy();
    const Apps = await ethers.getContractFactory("OneIDCampaignsV11", creator);
    const apps = await Apps.deploy(await gate.getAddress(), await bindings.getAddress());

    const N = 2000;
    const wallets = [];
    for (let i = 0; i < N; i++) {
      const w = ethers.Wallet.createRandom().connect(ethers.provider);
      wallets.push(w);
      await ethers.provider.send("hardhat_setBalance", [w.address, "0xDE0B6B3A7640000"]); // 1 ETH, no block mined
      await mock.issue(w.address);
    }
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const tx = await apps.connect(creator).createRaffle("gas2000", now - 10, now + DAY, 10,
      ethers.ZeroAddress, 0n, NO_COND, "");
    const rc0 = await tx.wait();
    const id = Number(rc0.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "CampaignCreated").args.id);
    for (const w of wallets) await apps.connect(w).enterRaffle(id, [], []);
    assert.equal((await apps.getCampaign(id)).entryCount, BigInt(N));
    await warp(DAY + 60);
    // V11: lock the seed on-chain, then land a few blocks past the seed
    // block, inside its 256-block blockhash window
    await apps.lockDraw(id);
    await mine(3);
    const dtx = await apps.draw(id);
    const drc = await dtx.wait();
    const camp = await apps.getCampaign(id);
    assert.equal(camp.drawn, true);
    assert.equal(camp.usedFallbackSeed, false);
    assert.equal((await apps.getWinners(id)).length, 10);
    console.log(`\n    [gas] OneIDCampaignsV11.draw() — ${N} entrants, 10 winners: ${drc.gasUsed} gas`);
  });
});
