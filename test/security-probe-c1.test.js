const { ethers } = require("hardhat");
const assert = require("assert");

// =====================================================================
// SECURITY PROBE C1 — cross-campaign double-pay via claimPrize AFTER
// creator reclaim. Originally written against OneIDCampaignsV10
// (2026-11-23, pre-mainnet) as a PoC of a CONFIRMED Critical:
//
//   V10's claimPrize() never checked `c.reclaimed` and had no claim
//   deadline. reclaim() (endAt + 30 days) paid the remainder to the
//   creator and set paidOut = total, but did NOT close claimPrize. A
//   winner who had not yet claimed could therefore claim AFTER the
//   reclaim — and because all campaigns share one contract balance,
//   that second payment was silently funded by OTHER campaigns'
//   escrow. Case A below stole exactly 50 out of campaign B's 200 on
//   V10 and left B's winner permanently short.
//
// Why single-campaign probes missed it: with only one campaign in the
// pool, the post-reclaim claim reverts TransferFailed (balance is 0).
// The theft needs a second campaign's escrow sitting in the pool —
// which is exactly the mainnet steady state.
//
// NOW A REGRESSION TEST against OneIDCampaignsV11: the fix (claimPrize
// reverts once `reclaimed` is set, plus a hard ClaimExpired deadline)
// must make the same attack FAIL and leave campaign B whole. If these
// assertions ever go red, C1 is back.
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
async function nowTs() { return (await ethers.provider.getBlock("latest")).timestamp; }

const MAXU = ethers.MaxUint256;
const NO_COND = { requireBinding: false, gateToken: ethers.ZeroAddress, gateMin: 0n, gateIs721: false, requireEnteredId: MAXU, minStamps: 0, questRef: ethers.ZeroAddress, allowRoot: ethers.ZeroHash, idListRoot: ethers.ZeroHash };
const DAY = 86400;

async function deployStack(signers) {
  const [issuer, deployer] = signers;
  const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
  const mock = await Mock.deploy();
  const Gate = await ethers.getContractFactory("BeCounted", issuer);
  const gate = await Gate.deploy(await mock.getAddress());
  const Bind = await ethers.getContractFactory("IdentityBindings", issuer);
  const bindings = await Bind.deploy();
  const Apps = await ethers.getContractFactory("OneIDCampaignsV11", deployer);
  const apps = await Apps.deploy(await gate.getAddress(), await bindings.getAddress());
  return { mock, gate, bindings, apps };
}

async function createdId(apps, tx) {
  const rc = await tx.wait();
  const ev = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } }).find(e => e && e.name === "CampaignCreated");
  return Number(ev.args.id);
}

async function erc20Raffle(apps, creator, tokenAddr, prizePerWinner, winners, dur = 600) {
  const now = await nowTs();
  return createdId(apps, await apps.connect(creator).createRaffle(
    "r", now - 10, now + dur, winners, tokenAddr, prizePerWinner, NO_COND, ""));
}

// V11 draw path: the seed is locked on-chain after the end, then the
// draw runs once the seed block exists.
async function lockAndDraw(apps, id) {
  await apps.lockDraw(id);
  await mine(3);
  await apps.draw(id);
}

describe("PROBE C1 (regression, V11): claimPrize after reclaim must NOT drain another campaign's escrow", function () {
  let S, issuer, deployer, jia, yi, bing, ding, wu, token, appsAddr;
  const A_PER = 50n;          // campaign A: 50 per winner
  const A_WINNERS = 2;        // A total escrow = 100
  const B_TOTAL = 200n;       // campaign B: 200 x 1 winner

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    [issuer, deployer, jia, yi, bing, ding, wu] = signers;
    S = await deployStack(signers);
    for (const u of [jia, yi, bing, ding, wu]) await S.mock.issue(u.address);
    const Tok = await ethers.getContractFactory("MockERC20", deployer);
    token = await Tok.deploy();
    appsAddr = await S.apps.getAddress();
  });

  it("CASE A: winner's post-reclaim claim now reverts; campaign B's escrow stays whole and its winner is paid in full", async function () {
    // --- fund & create -------------------------------------------------
    await token.mint(jia.address, A_PER * BigInt(A_WINNERS));       // 100
    await token.connect(jia).approve(appsAddr, A_PER * BigInt(A_WINNERS));
    await token.mint(ding.address, B_TOTAL);                        // 200
    await token.connect(ding).approve(appsAddr, B_TOTAL);

    const idA = await erc20Raffle(S.apps, jia, await token.getAddress(), A_PER, A_WINNERS);
    // B runs an hour longer than A, so that at the moment of A's
    // post-window reclaim, B's own claim window is still open — on V10
    // that is exactly when the theft drained it.
    const idB = await erc20Raffle(S.apps, ding, await token.getAddress(), B_TOTAL, 1, 600 + 3600);
    assert.equal(await token.balanceOf(appsAddr), 300n, "pool holds A 100 + B 200");

    // --- enter: A gets exactly its 2 winners-to-be; B gets its winner --
    await S.apps.connect(yi).enterRaffle(idA, [], []);
    await S.apps.connect(bing).enterRaffle(idA, [], []);
    await S.apps.connect(wu).enterRaffle(idB, [], []);

    // --- end + draw both (V11: lock the seed, then draw) --------------
    await warp(700); // A (600s) has ended; B (4200s) has not
    await lockAndDraw(S.apps, idA);
    await warp(3600); // now B has ended too
    await lockAndDraw(S.apps, idB);
    const winnersA = await S.apps.getWinners(idA);
    assert.equal(winnersA.length, 2);
    assert.ok(winnersA.includes(yi.address) && winnersA.includes(bing.address), "both A entrants win (k == n)");
    assert.deepEqual(await S.apps.getWinners(idB), [wu.address]);

    // --- yi claims in-window: honest 50 ---------------------------------
    await S.apps.connect(yi).claimPrize(idA);
    assert.equal(await token.balanceOf(yi.address), A_PER);
    assert.equal((await S.apps.getCampaign(idA)).paidOut, 50n);
    assert.equal(await token.balanceOf(appsAddr), 250n);

    // --- 30 days pass; creator jia reclaims A's remainder (50) ----------
    const campA = await S.apps.getCampaign(idA);
    await warpTo(Number(campA.endAt) + 30 * DAY + 1);
    const jiaBefore = await token.balanceOf(jia.address);
    await S.apps.connect(jia).reclaim(idA);
    const jiaGot = (await token.balanceOf(jia.address)) - jiaBefore;
    assert.equal(jiaGot, 50n, "creator reclaims the unclaimed winner's 50");
    const campA2 = await S.apps.getCampaign(idA);
    assert.equal(campA2.reclaimed, true);
    assert.equal(campA2.paidOut, 100n, "A's books are closed: paidOut == total escrow 100");
    assert.equal(await token.balanceOf(appsAddr), 200n, "pool now holds exactly B's 200 — A's money is fully out");

    // --- THE EXPLOIT, REPLAYED: bing claims A's prize AFTER the reclaim -
    const poolBefore = await token.balanceOf(appsAddr);
    const bingBefore = await token.balanceOf(bing.address);
    let exploitError = null;
    try {
      await S.apps.connect(bing).claimPrize(idA);
    } catch (e) { exploitError = e; }

    const poolAfter = await token.balanceOf(appsAddr);
    const bingGot = (await token.balanceOf(bing.address)) - bingBefore;
    const campA3 = await S.apps.getCampaign(idA);
    console.log(`\n    [C1/A] post-reclaim claimPrize: error=${exploitError ? String(exploitError.message).slice(0, 120) : "none"}`);
    console.log(`    [C1/A] bing received: ${bingGot} (A prize was 50); pool ${poolBefore} -> ${poolAfter}; A paidOut now ${campA3.paidOut} vs A total escrow 100`);

    assert.ok(exploitError, "FIX CHECK: post-reclaim claimPrize must revert on V11");
    assert.ok(String(exploitError.message).includes("AlreadyCounted"),
      "the reclaimed check is what stops it: " + String(exploitError.message).slice(0, 160));
    assert.equal(bingGot, 0n, "bing was paid nothing the second time");
    assert.equal(poolAfter, 200n, "the shared pool is untouched — B's 200 is intact");
    assert.equal(campA3.paidOut, 100n, "A's books stay closed: paidOut == total escrow 100");

    // --- the former victim: B's winner is paid in full ------------------
    await S.apps.connect(wu).claimPrize(idB);
    const wuGot = await token.balanceOf(wu.address);
    console.log(`    [C1/A] B winner wu claim of 200: succeeded; wu balance ${wuGot}; pool left ${await token.balanceOf(appsAddr)}`);
    assert.equal(wuGot, 200n, "B's winner receives the full 200");
    assert.equal(await token.balanceOf(appsAddr), 0n, "pool empties exactly: every escrowed unit accounted for");
    console.log(`    [C1/A] CONCLUSION: the C1 double-pay is closed — post-reclaim claims revert and no campaign's escrow can fund another's prizes`);
  });

  it("CASE B (creator self-dealing): closed by the same check — documented, not re-run", async function () {
    // On V10 the creator-as-winner variant was strictly easier than
    // Case A: reclaim() paid them the remainder at endAt+30d, then
    // their own claimPrize() paid the same share again out of other
    // campaigns' escrow. V11's claimPrize has no path around the
    // `reclaimed` flag regardless of who calls it — creator included —
    // so Case A's revert covers B; per tasking, B is documented here
    // rather than re-run.
    console.log("\n    [C1/B] skipped: creator-as-winner hits the identical `reclaimed` check proven in Case A (claimPrize has no creator exception)");
  });
});
