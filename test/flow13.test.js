const { ethers } = require("hardhat");
const assert = require("assert");

async function expectRevert(p, errName) {
  try { await p; } catch (e) {
    if (errName && !String(e.message).includes(errName)) throw new Error(`reverted but not with ${errName}: ${String(e.message).slice(0, 200)}`);
    return;
  }
  throw new Error(`expected revert ${errName || ""} but call succeeded`);
}

const MAXU = ethers.MaxUint256;
const NO_COND = { requireBinding: false, gateToken: ethers.ZeroAddress, gateMin: 0n, gateIs721: false, requireEnteredId: MAXU, minStamps: 0, questRef: ethers.ZeroAddress, allowRoot: ethers.ZeroHash };

// --- Merkle helpers: MUST match OneIDCampaignsV9._verifyAllow exactly ---
// leaf = keccak256(packed address); pairs sorted before hashing; an
// unpaired node is promoted unchanged.
function leafOf(addr) { return ethers.keccak256(ethers.solidityPacked(["address"], [addr])); }
function hashPair(a, b) {
  const [x, y] = a < b ? [a, b] : [b, a];
  return ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [x, y]));
}
function buildLayers(addrs) {
  let level = addrs.map(leafOf);
  const layers = [level];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(i + 1 < level.length ? hashPair(level[i], level[i + 1]) : level[i]);
    }
    level = next;
    layers.push(level);
  }
  return layers;
}
function rootOf(addrs) { const l = buildLayers(addrs); return l[l.length - 1][0]; }
function proofOf(addrs, target) {
  const layers = buildLayers(addrs);
  let idx = addrs.findIndex(a => a.toLowerCase() === target.toLowerCase());
  assert(idx >= 0, "target not in list");
  const proof = [];
  for (let li = 0; li < layers.length - 1; li++) {
    const level = layers[li];
    const sib = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (sib < level.length) proof.push(level[sib]);
    idx = Math.floor(idx / 2);
  }
  return proof;
}

async function mine(n) { for (let i = 0; i < n; i++) await ethers.provider.send("evm_mine", []); }
async function warp(secs) { await ethers.provider.send("evm_increaseTime", [secs]); await ethers.provider.send("evm_mine", []); }

describe("OneIDCampaignsV9 allowlist + vote prizes", function () {
  let mock, gate, bindings, apps, token, issuer, creator, alice, bob, carol, dave, erin;

  beforeEach(async function () {
    [issuer, creator, alice, bob, carol, dave, erin] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    gate = await Gate.deploy(await mock.getAddress());
    const Bind = await ethers.getContractFactory("IdentityBindings", issuer);
    bindings = await Bind.deploy();
    const Apps = await ethers.getContractFactory("OneIDCampaignsV9", creator);
    apps = await Apps.deploy(await gate.getAddress(), await bindings.getAddress());
    const Tok = await ethers.getContractFactory("MockERC20", creator);
    token = await Tok.deploy();
    for (const u of [alice, bob, carol, dave, erin]) await mock.issue(u.address);
  });

  async function createdId(tx) {
    const rc = await tx.wait();
    const ev = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } }).find(e => e && e.name === "CampaignCreated");
    return Number(ev.args.id);
  }

  async function raffle(cond, title = "r") {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const blk = await ethers.provider.getBlockNumber();
    return createdId(await apps.connect(creator).createRaffle(title, now - 10, now + 3600, 1, blk + 100, ethers.ZeroAddress, 0n, cond, ""));
  }

  it("plain campaign: empty proof behaves like V6", async function () {
    const id = await raffle(NO_COND);
    await apps.connect(alice).enterRaffle(id, []);
    assert.equal(await apps.hasEntered(id, alice.address), true);
    const cd = await apps.conditionsOf(id);
    assert.equal(cd.allowRoot, ethers.ZeroHash);
  });

  it("condition 4 (allowlist): only listed addresses with a valid proof get in; failures do not consume the entry", async function () {
    const list = [alice.address, bob.address, carol.address];
    const id = await raffle({ ...NO_COND, allowRoot: rootOf(list) });
    // human but not on the list
    await expectRevert(apps.connect(dave).enterRaffle(id, []), "ConditionFailed");
    assert.equal(await apps.hasEntered(id, dave.address), false);
    // on the list but someone else's proof
    await expectRevert(apps.connect(alice).enterRaffle(id, proofOf(list, bob.address)), "ConditionFailed");
    assert.equal(await apps.hasEntered(id, alice.address), false);
    // on the list, own proof
    await apps.connect(alice).enterRaffle(id, proofOf(list, alice.address));
    assert.equal(await apps.hasEntered(id, alice.address), true);
    await apps.connect(carol).enterRaffle(id, proofOf(list, carol.address));
    assert.equal(await apps.hasEntered(id, carol.address), true);
  });

  it("condition 4 also gates votes and claims", async function () {
    const list = [alice.address, bob.address, carol.address, dave.address, erin.address];
    const cond = { ...NO_COND, allowRoot: rootOf(list) };
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const v = await createdId(await apps.connect(creator).createVote("v", now - 10, now + 3600, 2, ethers.ZeroAddress, 0n, 0, 0, cond, ["A", "B"]));
    await expectRevert(apps.connect(erin).castVote(v, 0, []), "ConditionFailed");
    await apps.connect(erin).castVote(v, 1, proofOf(list, erin.address));
    assert.equal(await apps.hasEntered(v, erin.address), true);
    const c = await createdId(await apps.connect(creator).createClaim("c", now - 10, now + 3600, 2, ethers.ZeroAddress, ethers.parseEther("0.002"), false, cond, { value: ethers.parseEther("0.002") }));
    await expectRevert(apps.connect(bob).claim(c, []), "ConditionFailed");
    await apps.connect(bob).claim(c, proofOf(list, bob.address));
    assert.equal(await apps.hasEntered(c, bob.address), true);
  });

  async function prizeVote({ pool, winners, tokenAddr = ethers.ZeroAddress }) {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const blk = await ethers.provider.getBlockNumber();
    const opts = tokenAddr === ethers.ZeroAddress ? { value: pool } : {};
    return createdId(await apps.connect(creator).createVote("pv", now - 10, now + 600, 2, tokenAddr, pool, winners, blk + 10, NO_COND, ["A", "B"], opts));
  }

  it("vote prize (BNB): draw from all voters, equal split, winners claim, draw is reproducible off-chain", async function () {
    const pool = ethers.parseEther("0.003");
    const id = await prizeVote({ pool, winners: 2 });
    await apps.connect(alice).castVote(id, 0, []);
    await apps.connect(bob).castVote(id, 1, []);
    await apps.connect(carol).castVote(id, 1, []);
    assert.equal((await apps.getCampaign(id)).pool, pool);
    await warp(601);
    await mine(12);
    const tx = await apps.draw(id);
    const rc = await tx.wait();
    const dev = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } }).find(e => e && e.name === "Drawn");
    const winners = await apps.getWinners(id);
    assert.equal(winners.length, 2);
    const camp = await apps.getCampaign(id);
    assert.equal(camp.prizePerWinner, pool / 2n);
    // off-chain recompute: partial Fisher-Yates over the entry list
    const entries = await apps.getEntries(id);
    const seed = dev.args.seed;
    const idx = entries.map((_, i) => i);
    for (let i = 0; i < 2; i++) {
      const j = i + Number(BigInt(ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [seed, BigInt(i)]))) % BigInt(entries.length - i));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    assert.deepEqual(winners, [entries[idx[0]], entries[idx[1]]]);
    // winners claim; loser cannot
    const loser = [alice, bob, carol].find(u => !winners.includes(u.address));
    await expectRevert(apps.connect(loser).claimPrize(id), "NotWinner");
    let claimed = 0n;
    for (const w of winners) {
      const signer = [alice, bob, carol].find(u => u.address === w);
      const before = await ethers.provider.getBalance(w);
      const t = await apps.connect(signer).claimPrize(id);
      const r = await t.wait();
      const gas = r.gasUsed * r.gasPrice;
      const after = await ethers.provider.getBalance(w);
      assert.equal(after - before + gas, pool / 2n);
      claimed += pool / 2n;
    }
    assert.equal((await apps.getCampaign(id)).paidOut, claimed);
    await expectRevert(apps.connect([alice, bob, carol].find(u => u.address === winners[0])).claimPrize(id), "AlreadyCounted");
  });

  it("vote prize: fewer voters than winner slots — the single voter takes the whole pool", async function () {
    const pool = ethers.parseEther("0.001");
    const id = await prizeVote({ pool, winners: 3 });
    await apps.connect(alice).castVote(id, 0, []);
    await warp(601);
    await mine(12);
    await apps.draw(id);
    const winners = await apps.getWinners(id);
    assert.equal(winners.length, 1);
    assert.equal((await apps.getCampaign(id)).prizePerWinner, pool);
    await apps.connect(alice).claimPrize(id);
    assert.equal((await apps.getCampaign(id)).paidOut, pool);
  });

  it("vote prize: creation validation and plain-vote behaviour", async function () {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const blk = await ethers.provider.getBlockNumber();
    // prize without winner count
    await expectRevert(apps.connect(creator).createVote("x", now - 10, now + 600, 2, ethers.ZeroAddress, 100n, 0, blk + 10, NO_COND, ["A", "B"], { value: 100n }), "BadParams");
    // prize with a seed block in the past
    await expectRevert(apps.connect(creator).createVote("x", now - 10, now + 600, 2, ethers.ZeroAddress, 100n, 1, blk, NO_COND, ["A", "B"], { value: 100n }), "BadParams");
    // winners declared but no prize
    await expectRevert(apps.connect(creator).createVote("x", now - 10, now + 600, 2, ethers.ZeroAddress, 0n, 1, 0, NO_COND, ["A", "B"]), "BadParams");
    // plain vote: no draw, no reclaim
    const id = await createdId(await apps.connect(creator).createVote("plain", now - 10, now + 600, 2, ethers.ZeroAddress, 0n, 0, 0, NO_COND, ["A", "B"]));
    await apps.connect(alice).castVote(id, 0, []);
    await warp(601);
    await expectRevert(apps.draw(id), "no prize draw");
    await expectRevert(apps.connect(creator).reclaim(id), "BadParams");
  });

  it("vote prize (ERC20) + creator reclaim of the unclaimed remainder after 30 days", async function () {
    const pool = 1000n;
    await token.mint(creator.address, pool);
    await token.connect(creator).approve(await apps.getAddress(), pool);
    const id = await prizeVote({ pool, winners: 1, tokenAddr: await token.getAddress() });
    await apps.connect(alice).castVote(id, 0, []);
    await apps.connect(bob).castVote(id, 1, []);
    await warp(601);
    await mine(12);
    await apps.draw(id);
    const winners = await apps.getWinners(id);
    assert.equal(winners.length, 1);
    // winner never claims; too early to reclaim
    await expectRevert(apps.connect(creator).reclaim(id), "TooEarly");
    await warp(31 * 24 * 3600);
    const before = await token.balanceOf(creator.address);
    await apps.connect(creator).reclaim(id);
    assert.equal((await token.balanceOf(creator.address)) - before, pool);
    await expectRevert(apps.connect(creator).reclaim(id), "AlreadyCounted");
  });
});
