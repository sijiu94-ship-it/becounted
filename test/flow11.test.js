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

async function mine(n) { for (let i = 0; i < n; i++) await ethers.provider.send("evm_mine", []); }
async function warp(secs) { await ethers.provider.send("evm_increaseTime", [secs]); await ethers.provider.send("evm_mine", []); }

describe("OneIDCampaignsV8 vote option labels", function () {
  let mock, gate, bindings, apps, issuer, creator, alice, bob, carol;

  beforeEach(async function () {
    [issuer, creator, alice, bob, carol] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    gate = await Gate.deploy(await mock.getAddress());
    const Bind = await ethers.getContractFactory("IdentityBindings", issuer);
    bindings = await Bind.deploy();
    const Apps = await ethers.getContractFactory("OneIDCampaignsV8", creator);
    apps = await Apps.deploy(await gate.getAddress(), await bindings.getAddress());
    for (const u of [alice, bob, carol]) await mock.issue(u.address);
  });

  async function createdId(tx) {
    const rc = await tx.wait();
    const ev = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } }).find(e => e && e.name === "CampaignCreated");
    return Number(ev.args.id);
  }

  async function vote(labels, extra = {}) {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const blk = await ethers.provider.getBlockNumber();
    return createdId(await apps.connect(creator).createVote(
      extra.title || "v", now - 10, now + (extra.dur || 3600), labels.length,
      ethers.ZeroAddress, extra.pool || 0n, extra.winners || 0, extra.pool ? blk + 10 : 0,
      NO_COND, labels, { value: extra.pool || 0n }));
  }

  it("stores labels on-chain and reads them back in order", async function () {
    const labels = ["同意", "反对", "再想想"];
    const id = await vote(labels);
    assert.deepEqual(await apps.optionLabelsOf(id), labels);
    const c = await apps.getCampaign(id);
    assert.equal(Number(c.optionCount), 3);
  });

  it("rejects a label count that does not match the option count", async function () {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await expectRevert(apps.connect(creator).createVote("v", now - 10, now + 3600, 3, ethers.ZeroAddress, 0n, 0, 0, NO_COND, ["a", "b"]), "BadParams");
    await expectRevert(apps.connect(creator).createVote("v", now - 10, now + 3600, 2, ethers.ZeroAddress, 0n, 0, 0, NO_COND, ["a", "b", "c"]), "BadParams");
  });

  it("rejects empty and overlong labels; a 60-byte label is fine", async function () {
    await expectRevert(vote(["", "b"]), "BadParams");
    await expectRevert(vote(["x".repeat(61), "b"]), "BadParams");
    const id = await vote(["x".repeat(60), "b"]);
    assert.equal((await apps.optionLabelsOf(id))[0], "x".repeat(60));
  });

  it("votes tally by index against labelled options", async function () {
    const id = await vote(["支持", "反对"]);
    await apps.connect(alice).castVote(id, 0, []);
    await apps.connect(bob).castVote(id, 0, []);
    await apps.connect(carol).castVote(id, 1, []);
    assert.equal(await apps.tally(id, 0), 2n);
    assert.equal(await apps.tally(id, 1), 1n);
    assert.equal(await apps.voteOf(id, carol.address), 1);
  });

  it("prize vote with labels: draw and claim still work end to end", async function () {
    const pool = ethers.parseEther("0.003");
    const id = await vote(["红方", "蓝方"], { pool, winners: 1, dur: 600 });
    await apps.connect(alice).castVote(id, 0, []);
    await apps.connect(bob).castVote(id, 1, []);
    await warp(601);
    await mine(12);
    await apps.connect(creator).draw(id);
    const c = await apps.getCampaign(id);
    assert.equal(c.drawn, true);
    assert.equal(c.prizePerWinner, pool); // sole winner takes the whole pool
    const winners = await apps.getWinners(id);
    assert.equal(winners.length, 1);
    const w = winners[0].toLowerCase() === alice.address.toLowerCase() ? alice : bob;
    const before = await ethers.provider.getBalance(w.address);
    const tx = await apps.connect(w).claimPrize(id);
    const rc = await tx.wait();
    const gas = rc.gasUsed * tx.gasPrice;
    const after = await ethers.provider.getBalance(w.address);
    assert.equal(after - before + gas, pool);
    assert.deepEqual(await apps.optionLabelsOf(id), ["红方", "蓝方"]);
  });

  it("raffles carry no labels", async function () {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const blk = await ethers.provider.getBlockNumber();
    const id = await createdId(await apps.connect(creator).createRaffle("r", now - 10, now + 3600, 1, blk + 100, ethers.ZeroAddress, 0n, NO_COND));
    assert.deepEqual(await apps.optionLabelsOf(id), []);
  });
});
