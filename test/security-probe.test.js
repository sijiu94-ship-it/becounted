const { ethers } = require("hardhat");
const assert = require("assert");

// =====================================================================
// SECURITY PROBE — adversarial exploit attempts against
// OneIDCampaignsV11 escrowed funds (2026-11-23, pre-mainnet; written
// against V10, repointed to V11 by the security-fix batch the same
// day — PROBE 5's insolvency findings and the V10 fallback-seed grind
// are FIXED in V11, and those sections now assert the fixed
// behaviour; everything else asserts the same defences as before).
//
// These tests do not re-assert happy paths. Each one actively tries to
// take money out of the contract that the attacker is not entitled to:
// double claims, reentrancy (malicious ERC20 + malicious BNB
// receiver), premature creator reclaim, condition bypass with forged
// Merkle proofs, fee-on-transfer funding, and seed/timing games.
// Attacker contracts are compiled in-test with solc (same pattern as
// flow15) so contracts/ stays untouched.
// =====================================================================

async function expectRevert(p, errName) {
  try { await p; } catch (e) {
    if (errName && !String(e.message).includes(errName)) throw new Error(`reverted but not with ${errName}: ${String(e.message).slice(0, 250)}`);
    return e;
  }
  throw new Error(`expected revert ${errName || ""} but call succeeded`);
}

async function expectCond(p, apps, which) {
  try { await p; } catch (e) {
    const data = e.data || (e.info && e.info.error && e.info.error.data) || null;
    if (data && data !== "0x") {
      const parsed = apps.interface.parseError(data);
      assert(parsed && parsed.name === "ConditionFailed" && Number(parsed.args[0]) === which,
        `not ConditionFailed(${which}): ` + (parsed && parsed.name));
      return;
    }
    if (String(e.message).includes(`ConditionFailed(${which})`)) return;
    throw new Error("unexpected error: " + String(e.message).slice(0, 250));
  }
  throw new Error(`expected ConditionFailed(${which}) but call succeeded`);
}

async function mine(n) { await ethers.provider.send("hardhat_mine", [ethers.toBeHex(n)]); }
async function warp(secs) { await ethers.provider.send("evm_increaseTime", [secs]); await ethers.provider.send("evm_mine", []); }
async function warpTo(ts) { await ethers.provider.send("evm_setNextBlockTimestamp", [ts]); await ethers.provider.send("evm_mine", []); }
async function nowTs() { return (await ethers.provider.getBlock("latest")).timestamp; }

const MAXU = ethers.MaxUint256;
const NO_COND = { requireBinding: false, gateToken: ethers.ZeroAddress, gateMin: 0n, gateIs721: false, requireEnteredId: MAXU, minStamps: 0, questRef: ethers.ZeroAddress, allowRoot: ethers.ZeroHash, idListRoot: ethers.ZeroHash };
const DAY = 86400;

// --- Merkle helpers (must match _verifyMerkle: sorted pairs, odd promoted) ---
function leafOf(addr) { return ethers.keccak256(ethers.solidityPacked(["address"], [addr])); }
function idLeafOf(handle) {
  const lh = ethers.keccak256(ethers.toUtf8Bytes(handle));
  return ethers.keccak256(ethers.solidityPacked(["bytes32"], [lh]));
}
function hashPair(a, b) {
  const [x, y] = a < b ? [a, b] : [b, a];
  return ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [x, y]));
}
function buildLayers(leaves) {
  let level = leaves.slice();
  const layers = [level];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? hashPair(level[i], level[i + 1]) : level[i]);
    level = next; layers.push(level);
  }
  return layers;
}
function rootOfLeaves(leaves) { const l = buildLayers(leaves); return l[l.length - 1][0]; }
function proofOfLeaves(leaves, idx) {
  const layers = buildLayers(leaves);
  const proof = [];
  let i = idx;
  for (let li = 0; li < layers.length - 1; li++) {
    const lv = layers[li];
    const sib = i % 2 === 0 ? i + 1 : i - 1;
    if (sib < lv.length) proof.push(lv[sib]);
    i = Math.floor(i / 2);
  }
  return proof;
}
function flipByte(hex) {
  const b = ethers.getBytes(hex);
  b[b.length - 1] = b[b.length - 1] ^ 0xff;
  return ethers.hexlify(b);
}

// --- Attacker contracts (compiled in-test) ---------------------------
const ATTACKER_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICampaigns {
    function enterRaffle(uint256 id, bytes32[] calldata proof, bytes32[] calldata idProof) external;
    function castVote(uint256 id, uint8 option, bytes32[] calldata proof, bytes32[] calldata idProof) external;
    function claim(uint256 id, bytes32[] calldata proof, bytes32[] calldata idProof) external;
    function claimPrize(uint256 id) external;
}
interface IQuest {
    function claimStamp() external;
    function enterFinale() external;
    function claimPrize() external;
}

/// BNB receiver that tries to reenter the paying contract from receive().
/// mode 1 = campaigns.claimPrize(arg), 2 = campaigns.claim(arg),
/// 3 = quest.claimPrize(), 4 = quest.claimStamp().
contract ReceiverAttacker {
    address public target;
    uint256 public arg;
    uint8 public mode;
    bool public armed;
    uint256 public attempts;
    bool public innerSucceeded;
    bytes public innerError;

    function arm(address t, uint256 a, uint8 m) external { target = t; arg = a; mode = m; armed = true; }
    function enterRaffle(address apps, uint256 id) external { ICampaigns(apps).enterRaffle(id, new bytes32[](0), new bytes32[](0)); }
    function claimC(address apps, uint256 id) external { ICampaigns(apps).claim(id, new bytes32[](0), new bytes32[](0)); }
    function claimP(address apps, uint256 id) external { ICampaigns(apps).claimPrize(id); }
    function stamp(address q) external { IQuest(q).claimStamp(); }
    function enterFin(address q) external { IQuest(q).enterFinale(); }
    function claimPQ(address q) external { IQuest(q).claimPrize(); }

    receive() external payable {
        if (!armed) return;
        attempts++;
        if (mode == 1) { try ICampaigns(target).claimPrize(arg) { innerSucceeded = true; } catch (bytes memory e) { innerError = e; } }
        else if (mode == 2) { try ICampaigns(target).claim(arg, new bytes32[](0), new bytes32[](0)) { innerSucceeded = true; } catch (bytes memory e) { innerError = e; } }
        else if (mode == 3) { try IQuest(target).claimPrize() { innerSucceeded = true; } catch (bytes memory e) { innerError = e; } }
        else if (mode == 4) { try IQuest(target).claimStamp() { innerSucceeded = true; } catch (bytes memory e) { innerError = e; } }
    }
}

/// ERC20 whose transfer() (the payout leg) reenters the campaigns
/// contract. The token contract itself is the entrant/winner, so the
/// reentrant call carries the winner's identity.
/// hookMode 1 = reenter claimPrize(hookId), 2 = reenter claim(hookId).
contract EvilToken {
    string public name = "Evil"; string public symbol = "EVL"; uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    address public hookTarget; uint256 public hookId; uint8 public hookMode; bool public armed;
    uint256 public hookAttempts; bool public hookSucceeded;

    function mint(address to, uint256 a) external { balanceOf[to] += a; totalSupply += a; }
    function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s] = a; return true; }
    function transferFrom(address f, address t, uint256 a) external returns (bool) {
        require(balanceOf[f] >= a, "bal"); require(allowance[f][msg.sender] >= a, "allow");
        allowance[f][msg.sender] -= a; balanceOf[f] -= a; balanceOf[t] += a; return true;
    }
    function arm(address t, uint256 id, uint8 m) external { hookTarget = t; hookId = id; hookMode = m; armed = true; }
    function enterRaffle(address apps, uint256 id) external { ICampaigns(apps).enterRaffle(id, new bytes32[](0), new bytes32[](0)); }
    function claimPrize(address apps, uint256 id) external { ICampaigns(apps).claimPrize(id); }
    function claimC(address apps, uint256 id) external { ICampaigns(apps).claim(id, new bytes32[](0), new bytes32[](0)); }
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "bal");
        balanceOf[msg.sender] -= amount; balanceOf[to] += amount;
        if (armed && msg.sender == hookTarget) {
            hookAttempts++;
            if (hookMode == 1) { try ICampaigns(hookTarget).claimPrize(hookId) { hookSucceeded = true; } catch {} }
            else if (hookMode == 2) { try ICampaigns(hookTarget).claim(hookId, new bytes32[](0), new bytes32[](0)) { hookSucceeded = true; } catch {} }
        }
        return true;
    }
}

/// ERC20 that skims 10% of every transfer / transferFrom to a sink.
contract FeeToken {
    string public name = "Fee"; string public symbol = "FEE"; uint8 public decimals = 18;
    uint256 public totalSupply;
    address public constant SINK = address(0xdead);
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to, uint256 a) external { balanceOf[to] += a; totalSupply += a; }
    function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s] = a; return true; }
    function _move(address f, address t, uint256 a) internal {
        require(balanceOf[f] >= a, "bal");
        uint256 fee = a / 10;
        balanceOf[f] -= a; balanceOf[t] += a - fee; balanceOf[SINK] += fee;
    }
    function transfer(address t, uint256 a) external returns (bool) { _move(msg.sender, t, a); return true; }
    function transferFrom(address f, address t, uint256 a) external returns (bool) {
        require(allowance[f][msg.sender] >= a, "allow");
        allowance[f][msg.sender] -= a; _move(f, t, a); return true;
    }
}
`;

let ReceiverAttackerF, EvilTokenF, FeeTokenF;
before(async function () {
  const solc = require("solc");
  const input = {
    language: "Solidity",
    sources: { "Attackers.sol": { content: ATTACKER_SOURCE } },
    settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errs = (out.errors || []).filter(e => e.severity === "error");
  assert.equal(errs.length, 0, errs.map(e => e.formattedMessage).join("\n"));
  const C = out.contracts["Attackers.sol"];
  const [deployer] = await ethers.getSigners();
  ReceiverAttackerF = new ethers.ContractFactory(C.ReceiverAttacker.abi, C.ReceiverAttacker.evm.bytecode.object, deployer);
  EvilTokenF = new ethers.ContractFactory(C.EvilToken.abi, C.EvilToken.evm.bytecode.object, deployer);
  FeeTokenF = new ethers.ContractFactory(C.FeeToken.abi, C.FeeToken.evm.bytecode.object, deployer);
});

// --- Shared stack -----------------------------------------------------
async function deployStack(signers) {
  const [issuer, creator] = signers;
  const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
  const mock = await Mock.deploy();
  const Gate = await ethers.getContractFactory("BeCounted", issuer);
  const gate = await Gate.deploy(await mock.getAddress());
  const Bind = await ethers.getContractFactory("IdentityBindings", issuer);
  const bindings = await Bind.deploy();
  const Apps = await ethers.getContractFactory("OneIDCampaignsV11", creator);
  const apps = await Apps.deploy(await gate.getAddress(), await bindings.getAddress());
  return { mock, gate, bindings, apps };
}
async function createdId(apps, tx) {
  const rc = await tx.wait();
  const ev = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } }).find(e => e && e.name === "CampaignCreated");
  return Number(ev.args.id);
}
async function raffleId(apps, creator, { prize = 0n, token = ethers.ZeroAddress, winners = 1, cond = NO_COND, dur = 600 } = {}) {
  const now = await nowTs();
  const opts = token === ethers.ZeroAddress && prize > 0n ? { value: prize * BigInt(winners) } : {};
  return createdId(apps, await apps.connect(creator).createRaffle("r", now - 10, now + dur, winners, token, prize, cond, "", opts));
}
// V11 draw path: lock the seed on-chain (only possible after the end),
// then draw once the seed block exists.
async function lockAndDraw(apps, id) {
  await apps.lockDraw(id);
  await mine(3);
  await apps.draw(id);
}

// =====================================================================
// ATTACK 1 + 8: double claims and claims by non-winners
// =====================================================================
describe("PROBE 1/8: double-claim & non-winner claim (campaigns)", function () {
  let S, issuer, creator, alice, bob, carol, dave;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    [issuer, creator, alice, bob, carol, dave] = signers;
    S = await deployStack(signers);
    for (const u of [alice, bob, carol, dave]) await S.mock.issue(u.address);
  });

  it("raffle winner claims exactly once; second claim, loser claim and non-entrant claim all revert", async function () {
    const Tok = await ethers.getContractFactory("MockERC20", creator);
    const token = await Tok.deploy();
    const prize = 500n;
    await token.mint(creator.address, prize);
    await token.connect(creator).approve(await S.apps.getAddress(), prize);
    const id = await raffleId(S.apps, creator, { prize, token: await token.getAddress() });
    await S.apps.connect(alice).enterRaffle(id, [], []);
    await S.apps.connect(bob).enterRaffle(id, [], []);
    await warp(700);
    await lockAndDraw(S.apps, id);
    const winners = await S.apps.getWinners(id);
    assert.equal(winners.length, 1);
    const winner = [alice, bob].find(u => u.address === winners[0]);
    const loser = [alice, bob].find(u => u.address !== winners[0]);
    // non-winner entrant and never-entered human: both NotWinner
    await expectRevert(S.apps.connect(loser).claimPrize(id), "NotWinner");
    await expectRevert(S.apps.connect(dave).claimPrize(id), "NotWinner");
    // claim before... winner claims once, in full
    await S.apps.connect(winner).claimPrize(id);
    assert.equal(await token.balanceOf(winner.address), prize);
    // DOUBLE CLAIM attempt
    await expectRevert(S.apps.connect(winner).claimPrize(id), "AlreadyCounted");
    assert.equal(await token.balanceOf(winner.address), prize, "balance unchanged after double-claim attempt");
    assert.equal(await token.balanceOf(await S.apps.getAddress()), 0n);
    assert.equal((await S.apps.getCampaign(id)).paidOut, prize);
  });

  it("claim campaign: second claim via claim() reverts; wrong-function paths (claimPrize / enterRaffle / claim-on-raffle) cannot extract a second share", async function () {
    const pool = ethers.parseEther("0.003");
    const now = await nowTs();
    const cid = await createdId(S.apps, await S.apps.connect(creator).createClaim("c", now - 10, now + 600, 3, ethers.ZeroAddress, pool, false, NO_COND, { value: pool }));
    const share = pool / 3n;
    const b0 = await ethers.provider.getBalance(alice.address);
    const t1 = await S.apps.connect(alice).claim(cid, [], []);
    const r1 = await t1.wait();
    const b1 = await ethers.provider.getBalance(alice.address);
    assert.equal(b1 - b0 + r1.gasUsed * r1.gasPrice, share);
    // second claim, same path
    await expectRevert(S.apps.connect(alice).claim(cid, [], []), "AlreadyCounted");
    // second claim, different function name: claimPrize on a Claim campaign
    await expectRevert(S.apps.connect(alice).claimPrize(cid), "no prize");
    // alice via enterRaffle: the dedup mark precedes the kind dispatch,
    // so she is stopped as AlreadyCounted before the kind check
    await expectRevert(S.apps.connect(alice).enterRaffle(cid, [], []), "AlreadyCounted");
    // a FRESH human via enterRaffle on a Claim campaign: _join marks him,
    // then the kind check reverts — the whole tx must roll back (no
    // entry consumed, no share extractable through the wrong door)
    const entriesBefore = (await S.apps.getCampaign(cid)).entryCount;
    await expectRevert(S.apps.connect(bob).enterRaffle(cid, [], []), "not a raffle");
    assert.equal((await S.apps.getCampaign(cid)).entryCount, entriesBefore);
    assert.equal(await S.apps.hasEntered(cid, bob.address), false);
    // claim() aimed at a RAFFLE id
    const rid = await raffleId(S.apps, creator, {});
    await expectRevert(S.apps.connect(alice).claim(rid, [], []), "not a claim");
    // contract still holds exactly the two unclaimed shares
    assert.equal(await ethers.provider.getBalance(await S.apps.getAddress()), pool - share);
  });

  it("finale-style vote prize: non-drawn voter and non-voter cannot claim; drawn voter cannot claim twice", async function () {
    const pool = ethers.parseEther("0.003");
    const now = await nowTs();
    const id = await createdId(S.apps, await S.apps.connect(creator).createVote("pv", now - 10, now + 600, 2, ethers.ZeroAddress, pool, 2, NO_COND, ["A", "B"], { value: pool }));
    await S.apps.connect(alice).castVote(id, 0, [], []);
    await S.apps.connect(bob).castVote(id, 1, [], []);
    await S.apps.connect(carol).castVote(id, 1, [], []);
    await warp(700);
    await lockAndDraw(S.apps, id);
    const winners = await S.apps.getWinners(id);
    assert.equal(winners.length, 2);
    const loser = [alice, bob, carol].find(u => !winners.includes(u.address));
    await expectRevert(S.apps.connect(loser).claimPrize(id), "NotWinner");
    await expectRevert(S.apps.connect(dave).claimPrize(id), "NotWinner");
    const w0 = [alice, bob, carol].find(u => u.address === winners[0]);
    await S.apps.connect(w0).claimPrize(id);
    await expectRevert(S.apps.connect(w0).claimPrize(id), "AlreadyCounted");
    assert.equal((await S.apps.getCampaign(id)).paidOut, pool / 2n);
  });
});

// =====================================================================
// ATTACK 2: reentrancy — malicious BNB receiver + malicious ERC20
// =====================================================================
describe("PROBE 2: reentrancy against claim / claimPrize payouts", function () {
  let S, issuer, creator, alice, bob, attacker;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    [issuer, creator, alice, bob] = signers;
    S = await deployStack(signers);
    for (const u of [alice, bob]) await S.mock.issue(u.address);
    attacker = await ReceiverAttackerF.deploy();
    await S.mock.issue(await attacker.getAddress());
  });

  it("BNB raffle: winner contract reentering claimPrize from receive() gets paid exactly once", async function () {
    const prize = ethers.parseEther("0.002");
    const id = await raffleId(S.apps, creator, { prize });
    await attacker.enterRaffle(await S.apps.getAddress(), id);
    await warp(700);
    await lockAndDraw(S.apps, id);
    assert.deepEqual(await S.apps.getWinners(id), [await attacker.getAddress()]);
    await attacker.arm(await S.apps.getAddress(), id, 1);
    await attacker.claimP(await S.apps.getAddress(), id);
    // the reentry was attempted exactly once and failed
    assert.equal(await attacker.attempts(), 1n);
    assert.equal(await attacker.innerSucceeded(), false);
    const innerErr = Buffer.from((await attacker.innerError()).slice(2), "hex").toString("latin1");
    assert.ok(innerErr.includes("reentrant"), "inner call blocked by the nonReentrant guard: " + innerErr.slice(0, 80));
    // paid exactly one prize, not two
    assert.equal(await ethers.provider.getBalance(await attacker.getAddress()), prize);
    assert.equal(await S.apps.prizeClaimed(id, await attacker.getAddress()), true);
    assert.equal((await S.apps.getCampaign(id)).paidOut, prize);
    // and a straight second claim reverts too
    await expectRevert(attacker.claimP(await S.apps.getAddress(), id), "AlreadyCounted");
  });

  it("BNB claim campaign: claimant contract reentering claim() from receive() gets exactly one share", async function () {
    const pool = ethers.parseEther("0.003");
    const now = await nowTs();
    const id = await createdId(S.apps, await S.apps.connect(creator).createClaim("c", now - 10, now + 600, 3, ethers.ZeroAddress, pool, false, NO_COND, { value: pool }));
    await attacker.arm(await S.apps.getAddress(), id, 2);
    await attacker.claimC(await S.apps.getAddress(), id);
    assert.equal(await attacker.attempts(), 1n);
    assert.equal(await attacker.innerSucceeded(), false);
    assert.equal(await ethers.provider.getBalance(await attacker.getAddress()), pool / 3n);
    assert.equal((await S.apps.getCampaign(id)).entryCount, 1n);
    assert.equal((await S.apps.getCampaign(id)).paidOut, pool / 3n);
  });

  it("ERC20 raffle: malicious prize token reentering claimPrize during the payout transfer cannot double-pay itself", async function () {
    const evil = await EvilTokenF.deploy();
    const evilAddr = await evil.getAddress();
    await S.mock.issue(evilAddr);
    const prize = 500n;
    await evil.mint(creator.address, prize);
    await evil.connect(creator).approve(await S.apps.getAddress(), prize);
    const id = await raffleId(S.apps, creator, { prize, token: evilAddr });
    await evil.enterRaffle(await S.apps.getAddress(), id);
    await warp(700);
    await lockAndDraw(S.apps, id);
    assert.deepEqual(await S.apps.getWinners(id), [evilAddr]);
    await evil.arm(await S.apps.getAddress(), id, 1);
    await evil.claimPrize(await S.apps.getAddress(), id);
    assert.equal(await evil.hookAttempts(), 1n);
    assert.equal(await evil.hookSucceeded(), false);
    assert.equal(await evil.balanceOf(evilAddr), prize, "exactly one prize landed, reentry paid nothing extra");
    assert.equal(await evil.balanceOf(await S.apps.getAddress()), 0n);
    await expectRevert(evil.claimPrize(await S.apps.getAddress(), id), "AlreadyCounted");
  });

  it("ERC20 claim campaign: malicious token reentering claim() during payout cannot take a second share", async function () {
    const evil = await EvilTokenF.deploy();
    const evilAddr = await evil.getAddress();
    await S.mock.issue(evilAddr);
    const pool = 1000n;
    await evil.mint(creator.address, pool);
    await evil.connect(creator).approve(await S.apps.getAddress(), pool);
    const now = await nowTs();
    const id = await createdId(S.apps, await S.apps.connect(creator).createClaim("ec", now - 10, now + 600, 2, evilAddr, pool, false, NO_COND));
    await evil.arm(await S.apps.getAddress(), id, 2);
    await evil.claimC(await S.apps.getAddress(), id);
    assert.equal(await evil.hookAttempts(), 1n);
    assert.equal(await evil.hookSucceeded(), false);
    assert.equal(await evil.balanceOf(evilAddr), 500n, "one share only");
    assert.equal((await S.apps.getCampaign(id)).entryCount, 1n);
    // the honest second share is still there for a normal human
    await S.apps.connect(alice).claim(id, [], []);
    assert.equal(await evil.balanceOf(alice.address), 500n);
    assert.equal(await evil.balanceOf(await S.apps.getAddress()), 0n);
  });
});

// =====================================================================
// ATTACK 3: premature / unauthorized reclaim; admin surface
// =====================================================================
describe("PROBE 3: creator reclaim timing & authority", function () {
  let S, issuer, creator, alice, bob, mallory;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    [issuer, creator, alice, bob, mallory] = signers;
    S = await deployStack(signers);
    for (const u of [alice, bob, mallory]) await S.mock.issue(u.address);
  });

  it("raffle escrow: creator cannot sweep before end, after end, or after draw inside the 30-day window; non-creator never", async function () {
    const prize = ethers.parseEther("0.002");
    const id = await raffleId(S.apps, creator, { prize, dur: 600 });
    const camp0 = await S.apps.getCampaign(id);
    await S.apps.connect(alice).enterRaffle(id, [], []);
    // before end
    await expectRevert(S.apps.connect(creator).reclaim(id), "TooEarly");
    await expectRevert(S.apps.connect(mallory).reclaim(id), "NotCreator");
    // after end, before draw
    await warp(700);
    await expectRevert(S.apps.connect(creator).reclaim(id), "TooEarly");
    // after draw, still inside the window (endAt + 29 days)
    await lockAndDraw(S.apps, id);
    await warpTo(Number(camp0.endAt) + 29 * DAY);
    await expectRevert(S.apps.connect(creator).reclaim(id), "TooEarly");
    await expectRevert(S.apps.connect(mallory).reclaim(id), "NotCreator");
    // window over: creator takes the (unclaimed) escrow — exactly the escrow
    await warpTo(Number(camp0.endAt) + 30 * DAY + 1);
    const b0 = await ethers.provider.getBalance(creator.address);
    const tx = await S.apps.connect(creator).reclaim(id);
    const rc = await tx.wait();
    const b1 = await ethers.provider.getBalance(creator.address);
    assert.equal(b1 - b0 + rc.gasUsed * rc.gasPrice, prize);
    // the winner's late claim now fails: the 30-day window is a hard
    // cutoff BY DESIGN. On V10 this surfaced as an opaque
    // TransferFailed (the money was simply gone); V11 refuses it
    // explicitly — the `reclaimed` check fires first (C1 fix), and
    // the ClaimExpired deadline stands behind it.
    assert.deepEqual(await S.apps.getWinners(id), [alice.address]);
    await expectRevert(S.apps.connect(alice).claimPrize(id), "AlreadyCounted");
    await expectRevert(S.apps.connect(creator).reclaim(id), "AlreadyCounted");
  });

  it("claim pool: creator cannot reclaim before end; after end takes exactly pool - paidOut, not a wei more", async function () {
    const pool = ethers.parseEther("0.003");
    const now = await nowTs();
    const id = await createdId(S.apps, await S.apps.connect(creator).createClaim("c", now - 10, now + 600, 3, ethers.ZeroAddress, pool, false, NO_COND, { value: pool }));
    await S.apps.connect(alice).claim(id, [], []);
    await expectRevert(S.apps.connect(creator).reclaim(id), "TooEarly");
    await warp(700);
    await expectRevert(S.apps.connect(mallory).reclaim(id), "NotCreator");
    const b0 = await ethers.provider.getBalance(creator.address);
    const tx = await S.apps.connect(creator).reclaim(id);
    const rc = await tx.wait();
    const b1 = await ethers.provider.getBalance(creator.address);
    assert.equal(b1 - b0 + rc.gasUsed * rc.gasPrice, pool - pool / 3n, "remainder only");
    assert.equal(await ethers.provider.getBalance(await S.apps.getAddress()), 0n);
    await expectRevert(S.apps.connect(creator).reclaim(id), "AlreadyCounted");
  });

  it("admin surface: no owner/withdraw/sweep/pause/upgrade function exists; setPostUrl/setSeries are creator-only", async function () {
    const names = [];
    S.apps.interface.forEachFunction(f => names.push(f.name));
    for (const banned of ["owner", "withdraw", "sweep", "pause", "unpause", "upgradeTo", "setGate", "setBindings", "mint", "transferOwnership"]) {
      assert.ok(!names.includes(banned), `unexpected admin function present: ${banned}`);
    }
    const id = await raffleId(S.apps, creator, {});
    await expectRevert(S.apps.connect(mallory).setPostUrl(id, "https://x.com/a/status/1"), "NotCreator");
    await expectRevert(S.apps.connect(mallory).setSeries(id, "S2"), "NotCreator");
  });
});

// =====================================================================
// ATTACK 4: entry-condition bypass (direct calls, forged proofs)
// =====================================================================
describe("PROBE 4: condition bypass attempts", function () {
  let S, issuer, creator, alice, bob, carol, dave;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    [issuer, creator, alice, bob, carol, dave] = signers;
    S = await deployStack(signers);
    for (const u of [alice, bob, carol, dave]) await S.mock.issue(u.address);
  });

  it("condition 0 (X binding): unbound human is rejected; after really binding, the same call passes", async function () {
    const id = await raffleId(S.apps, creator, { cond: { ...NO_COND, requireBinding: true } });
    await expectCond(S.apps.connect(alice).enterRaffle(id, [], []), S.apps, 0);
    assert.equal(await S.apps.hasEntered(id, alice.address), false);
    const stmt = await S.bindings.statementFor("alice_x", alice.address);
    const sig = await alice.signMessage(stmt);
    await S.bindings.connect(alice).registerBinding("alice_x", sig);
    await S.apps.connect(alice).enterRaffle(id, [], []);
    assert.equal(await S.apps.hasEntered(id, alice.address), true);
  });

  it("condition 1 (token gate): 0 and 99 of 100 required are rejected; exactly 100 passes", async function () {
    const Tok = await ethers.getContractFactory("MockERC20", creator);
    const gt = await Tok.deploy();
    const id = await raffleId(S.apps, creator, { cond: { ...NO_COND, gateToken: await gt.getAddress(), gateMin: 100n } });
    await expectCond(S.apps.connect(bob).enterRaffle(id, [], []), S.apps, 1);
    await gt.mint(bob.address, 99n);
    await expectCond(S.apps.connect(bob).enterRaffle(id, [], []), S.apps, 1);
    await gt.mint(bob.address, 1n);
    await S.apps.connect(bob).enterRaffle(id, [], []);
    assert.equal(await S.apps.hasEntered(id, bob.address), true);
  });

  it("condition 2 (prior entry): skipping the prerequisite campaign is rejected", async function () {
    const a = await raffleId(S.apps, creator, {});
    const b = await raffleId(S.apps, creator, { cond: { ...NO_COND, requireEnteredId: BigInt(a) } });
    await expectCond(S.apps.connect(carol).enterRaffle(b, [], []), S.apps, 2);
    await S.apps.connect(carol).enterRaffle(a, [], []);
    await S.apps.connect(carol).enterRaffle(b, [], []);
    assert.equal(await S.apps.hasEntered(b, carol.address), true);
  });

  it("condition 3 (QuestPass stamps): 0 stamps rejected; after really stamping, passes", async function () {
    const now = await nowTs();
    const Q = await ethers.getContractFactory("QuestPass", creator);
    const quest = await Q.deploy(await S.gate.getAddress(), ethers.ZeroAddress, now + 30, 3, 300n, 1, 1, 0n, 3600, { value: 2100n });
    const id = await raffleId(S.apps, creator, { cond: { ...NO_COND, minStamps: 1, questRef: await quest.getAddress() } });
    await expectCond(S.apps.connect(dave).enterRaffle(id, [], []), S.apps, 3);
    await warpTo(now + 31);
    await quest.connect(dave).claimStamp();
    // campaign window was [now-10, now+600]; still open after the warp
    await S.apps.connect(dave).enterRaffle(id, [], []);
    assert.equal(await S.apps.hasEntered(id, dave.address), true);
  });

  it("condition 4 (address allowlist): someone else's proof, empty proof, bit-flipped proof and cross-campaign proof all fail; failures never consume the entry", async function () {
    const list = [alice.address, bob.address, carol.address];
    const leaves = list.map(leafOf);
    const root = rootOfLeaves(leaves);
    const id = await raffleId(S.apps, creator, { cond: { ...NO_COND, allowRoot: root } });
    // not on the list, waving alice's proof
    await expectCond(S.apps.connect(dave).enterRaffle(id, proofOfLeaves(leaves, 0), []), S.apps, 4);
    // on the list, bob's proof
    await expectCond(S.apps.connect(alice).enterRaffle(id, proofOfLeaves(leaves, 1), []), S.apps, 4);
    // on the list, empty proof
    await expectCond(S.apps.connect(alice).enterRaffle(id, [], []), S.apps, 4);
    // on the list, own proof with one byte flipped
    const good = proofOfLeaves(leaves, 0);
    const bad = good.slice(); bad[0] = flipByte(bad[0]);
    await expectCond(S.apps.connect(alice).enterRaffle(id, bad, []), S.apps, 4);
    // cross-campaign: a second raffle whose list also contains alice but
    // with a different tree — campaign 1's proof must not replay there
    const list2 = [alice.address, dave.address];
    const leaves2 = list2.map(leafOf);
    const id2 = await raffleId(S.apps, creator, { cond: { ...NO_COND, allowRoot: rootOfLeaves(leaves2) } });
    await expectCond(S.apps.connect(alice).enterRaffle(id2, good, []), S.apps, 4);
    // nothing was consumed by any failure; the real proof still works
    assert.equal(await S.apps.hasEntered(id, alice.address), false);
    await S.apps.connect(alice).enterRaffle(id, good, []);
    assert.equal(await S.apps.hasEntered(id, alice.address), true);
    await S.apps.connect(alice).enterRaffle(id2, proofOfLeaves(leaves2, 0), []);
    assert.equal(await S.apps.hasEntered(id2, alice.address), true);
  });

  it("condition 5 (Agent ID allowlist): another identity's proof, no-handle address and flipped proof all fail", async function () {
    // condition 5 needs a registry with handleOf -> MockRegistryV2 stack
    const Mock2 = await ethers.getContractFactory("MockRegistryV2", issuer);
    const mock2 = await Mock2.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    const gate2 = await Gate.deploy(await mock2.getAddress());
    const Apps = await ethers.getContractFactory("OneIDCampaignsV11", creator);
    const apps2 = await Apps.deploy(await gate2.getAddress(), await S.bindings.getAddress());
    await mock2.connect(alice).registerHandle("aliceai");
    await mock2.connect(bob).registerHandle("bobai");
    await mock2.issue(dave.address); // human, but NO handle at all
    const handles = ["aliceai", "carolai"];
    const leaves = handles.map(idLeafOf);
    const root = rootOfLeaves(leaves);
    const now = await nowTs();
    const id = await createdId(apps2, await apps2.connect(creator).createRaffle("id5", now - 10, now + 3600, 1, ethers.ZeroAddress, 0n, { ...NO_COND, idListRoot: root }, ""));
    const aliceProof = proofOfLeaves(leaves, 0);
    // bob IS a human with a handle — just not a listed one. He presents
    // alice's genuine proof; the contract builds the leaf from BOB's
    // own handle, so it cannot verify.
    await expectCond(apps2.connect(bob).enterRaffle(id, [], aliceProof), apps2, 5);
    // dave has no handle at all — same proof, same rejection
    await expectCond(apps2.connect(dave).enterRaffle(id, [], aliceProof), apps2, 5);
    // alice with a bit-flipped proof
    const bad = aliceProof.slice(); if (bad.length) bad[0] = flipByte(bad[0]);
    await expectCond(apps2.connect(alice).enterRaffle(id, [], bad), apps2, 5);
    // alice with the real proof enters
    await apps2.connect(alice).enterRaffle(id, [], aliceProof);
    assert.equal(await apps2.hasEntered(id, alice.address), true);
  });
});

// =====================================================================
// ATTACK 5: fee-on-transfer token — funding must land in full
// =====================================================================
// On V10 this section DEMONSTRATED insolvency: _fund accounted the
// nominal amount while the token skimmed 10% in transit, so a 1000
// escrow landed as 900, the winner's claim and the creator's reclaim
// both reverted, and 900 stayed locked forever (claim pools lost the
// last share the same way). V11's _fund measures the balance delta
// and reverts the whole funding unless it equals the escrow exactly —
// these tests now assert that rejection, and that the revert leaves
// every balance untouched (no campaign, no locked funds, no fee paid).
describe("PROBE 5: fee-on-transfer token funding is rejected (V11 fix)", function () {
  let issuer, creator, S;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    [issuer, creator] = signers;
    S = await deployStack(signers);
  });

  it("raffle: escrow 1000 would land as 900 — createRaffle reverts InsufficientReceived and nothing moves", async function () {
    const fee = await FeeTokenF.deploy();
    const feeAddr = await fee.getAddress();
    const prize = 1000n;
    await fee.mint(creator.address, prize);
    await fee.connect(creator).approve(await S.apps.getAddress(), prize);
    const now = await nowTs();
    await expectRevert(
      S.apps.connect(creator).createRaffle("fee", now - 10, now + 600, 1, feeAddr, prize, NO_COND, ""),
      "InsufficientReceived"
    );
    // the revert is atomic: no campaign exists, the contract holds
    // nothing, the creator still has the full 1000 and the fee sink
    // got nothing — there is no under-collateralised escrow to lock.
    assert.equal(await S.apps.campaignCount(), 0n);
    assert.equal(await fee.balanceOf(await S.apps.getAddress()), 0n);
    assert.equal(await fee.balanceOf(creator.address), prize);
    assert.equal(await fee.balanceOf("0x000000000000000000000000000000000000dEaD"), 0n);
    console.log("\n    [fee/raffle] V10 outcome was: recorded 1000, held 900, 900 locked forever. V11: funding reverts atomically, 0 locked");
  });

  it("claim pool: createClaim with a fee token reverts the same way; a standard token funds and pays exactly (control)", async function () {
    const fee = await FeeTokenF.deploy();
    const feeAddr = await fee.getAddress();
    const pool = 1000n;
    await fee.mint(creator.address, pool);
    await fee.connect(creator).approve(await S.apps.getAddress(), pool);
    const now = await nowTs();
    await expectRevert(
      S.apps.connect(creator).createClaim("fc", now - 10, now + 3600, 10, feeAddr, pool, false, NO_COND),
      "InsufficientReceived"
    );
    assert.equal(await S.apps.campaignCount(), 0n);
    assert.equal(await fee.balanceOf(await S.apps.getAddress()), 0n);
    assert.equal(await fee.balanceOf(creator.address), pool);
    // control: the identical shape with an honest ERC20 still works —
    // the check rejects short landings, not ERC20 funding itself
    const Tok = await ethers.getContractFactory("MockERC20", creator);
    const good = await Tok.deploy();
    await good.mint(creator.address, pool);
    await good.connect(creator).approve(await S.apps.getAddress(), pool);
    const id = await createdId(S.apps, await S.apps.connect(creator).createClaim("ok", now - 10, now + 3600, 10, await good.getAddress(), pool, false, NO_COND));
    assert.equal(await good.balanceOf(await S.apps.getAddress()), pool);
    assert.equal((await S.apps.getCampaign(id)).pool, pool);
    console.log("\n    [fee/claim] fee token rejected at funding; standard token escrows the full 1000 (control passes)");
  });
});

// =====================================================================
// ATTACK 6 (campaigns half): seed prediction & timing
// =====================================================================
// V10 took its seed from a creator-chosen creation-time block: once
// that block was mined the winner was computable (harmless only
// because entries had closed), and if the draw was late the seed
// silently degraded to the previous block's hash — readable BEFORE
// the draw, so the caller could pick a favourable block to draw in.
// V11 removes both: no seed exists while entries are open; the seed
// block is locked after the end at block.number + 2 (unknowable to
// the locker); the draw has no fallback, only a re-lock.
describe("PROBE 6: seed prediction / late entry / seed immutability (V11 lock-draw)", function () {
  let S, issuer, creator, alice, bob, erin;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    [issuer, creator, alice, bob, erin] = signers;
    S = await deployStack(signers);
    for (const u of [alice, bob, erin]) await S.mock.issue(u.address);
  });

  it("no seed exists while entries are open; after the lock the winner is computable — but entries are already closed, so the prediction cannot be exploited", async function () {
    const id = await raffleId(S.apps, creator, {});
    // the creator picked no seed and none exists yet: seedBlock is 0
    // from creation until somebody locks it after the end
    assert.equal((await S.apps.getCampaign(id)).seedBlock, 0n);
    await S.apps.connect(alice).enterRaffle(id, [], []);
    await S.apps.connect(bob).enterRaffle(id, [], []);
    assert.equal((await S.apps.getCampaign(id)).seedBlock, 0n);
    await warp(700);
    // ended but not locked: no draw is possible at all
    await expectRevert(S.apps.draw(id), "SeedNotLocked");
    const lrc = await (await S.apps.lockDraw(id)).wait();
    const seedBlock = (await S.apps.getCampaign(id)).seedBlock;
    // the lock points two blocks AHEAD of the lock transaction: at
    // lock time that block — and therefore the seed — did not exist
    assert.equal(seedBlock, BigInt(lrc.blockNumber) + 2n);
    await mine(3); // seed block is now mined; its hash is public
    const seed = BigInt((await ethers.provider.getBlock(Number(seedBlock))).hash);
    const entries = await S.apps.getEntries(id);
    const j = Number(BigInt(ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [seed, 0n]))) % 2n);
    const predicted = entries[j];
    // the prediction is REAL (draw below matches it) — the defence is
    // purely temporal: the entry window closed at endAt, long before
    // any seed existed
    await expectRevert(S.apps.connect(erin).enterRaffle(id, [], []), "NotOpen");
    await S.apps.draw(id);
    assert.deepEqual(await S.apps.getWinners(id), [predicted]);
    assert.equal((await S.apps.getCampaign(id)).usedFallbackSeed, false);
    // and the draw itself is one-shot; the seed cannot be re-locked after
    await expectRevert(S.apps.draw(id), "AlreadyDrawn");
    await expectRevert(S.apps.lockDraw(id), "AlreadyDrawn");
  });

  it("draw cannot be forced early: lock before endAt -> NotEnded; draw before the locked seed block exists -> NotEnded; valid lock cannot be re-locked (no seed shopping)", async function () {
    const id = await raffleId(S.apps, creator, { dur: 600 });
    await S.apps.connect(alice).enterRaffle(id, [], []);
    await expectRevert(S.apps.lockDraw(id), "NotEnded");
    await expectRevert(S.apps.draw(id), "NotEnded");
    await warp(700); // past endAt
    await S.apps.lockDraw(id);
    // seed block is two blocks ahead: drawing right now is too early
    await expectRevert(S.apps.draw(id), "NotEnded");
    // and while this lock is valid nobody can replace it with another
    await expectRevert(S.apps.lockDraw(id), "SeedLocked");
    await mine(3);
    await S.apps.draw(id);
    assert.equal((await S.apps.getCampaign(id)).drawn, true);
  });
});
