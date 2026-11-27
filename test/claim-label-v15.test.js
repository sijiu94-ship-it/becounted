const { ethers } = require("hardhat");
const assert = require("assert");

async function expectRevert(p, errName) {
  try { await p; } catch (e) {
    if (errName && !String(e.message).includes(errName)) throw new Error(`reverted but not with ${errName}: ${String(e.message).slice(0, 200)}`);
    return;
  }
  throw new Error(`expected revert ${errName || ""} but call succeeded`);
}

async function warp(secs) { await ethers.provider.send("evm_increaseTime", [secs]); await ethers.provider.send("evm_mine", []); }

const MAXU = ethers.MaxUint256;
const NO_COND = { requireBinding: false, gateToken: ethers.ZeroAddress, gateMin: 0n, gateIs721: false, requireEnteredId: MAXU, minStamps: 0, questRef: ethers.ZeroAddress, allowRoot: ethers.ZeroHash, idListRoot: ethers.ZeroHash };
const BIND_COND = { ...NO_COND, requireBinding: true };
const LABEL = "周边礼盒 x1"; // 15 bytes in UTF-8

describe("OneIDCampaignsV15 registration claims (claim prizeLabel)", function () {
  let mock, gate, bindings, apps, deployer, creator, alice, bob, carol, dave;

  beforeEach(async function () {
    [deployer, creator, alice, bob, carol, dave] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", deployer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", deployer);
    gate = await Gate.deploy(await mock.getAddress());
    const Bind = await ethers.getContractFactory("IdentityBindingsV4", deployer);
    bindings = await Bind.deploy();
    const Apps = await ethers.getContractFactory("OneIDCampaignsV15", deployer);
    apps = await Apps.deploy(await gate.getAddress(), await bindings.getAddress());
    for (const u of [alice, bob, carol]) await mock.issue(u.address);
    // dave is NOT issued an Agent ID (non-holder control).
  });

  async function now() { return (await ethers.provider.getBlock("latest")).timestamp; }

  async function makeReg(maxClaims = 2, cond = NO_COND, dur = 3600) {
    const t = await now();
    const tx = await apps.connect(creator).createClaim("reg drop", t - 10, t + dur, maxClaims,
      ethers.ZeroAddress, 0n, false, cond, LABEL);
    const rc = await tx.wait();
    const ev = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "CampaignCreated");
    assert.ok(ev, "CampaignCreated event");
    const funded = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "Funded");
    assert.equal(funded, undefined, "registration claim must not emit Funded");
    return Number(ev.args.id);
  }

  it("creates a registration claim: label stored, no pool, no escrow taken", async function () {
    const balBefore = await ethers.provider.getBalance(creator.address);
    const id = await makeReg(100);
    const c = await apps.getCampaign(id);
    assert.equal(c.prizeLabel, LABEL);
    assert.equal(c.pool, 0n);
    assert.equal(c.claimAmount, 0n);
    assert.equal(Number(c.maxClaims), 100);
    assert.equal(c.prizeToken, ethers.ZeroAddress);
    assert.equal(c.claimRandom, false);
    const balAfter = await ethers.provider.getBalance(creator.address);
    assert.ok(balBefore - balAfter < ethers.parseEther("0.001"), "creator only paid gas, no escrow left the wallet");
    assert.equal(await ethers.provider.getBalance(await apps.getAddress()), 0n, "contract holds nothing");
  });

  it("claiming records the holder on-chain and pays nothing", async function () {
    const id = await makeReg(2);
    const balBefore = await ethers.provider.getBalance(alice.address);
    const tx = await apps.connect(alice).claim(id, [], []);
    const rc = await tx.wait();
    const ev = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "Claimed");
    assert.ok(ev, "Claimed event");
    assert.equal(ev.args.participant.toLowerCase(), alice.address.toLowerCase());
    assert.equal(ev.args.amount, 0n);
    const gas = rc.gasUsed * rc.gasPrice;
    const balAfter = await ethers.provider.getBalance(alice.address);
    assert.equal(balBefore - balAfter, gas, "claimant spent gas only, received nothing");
    const c = await apps.getCampaign(id);
    assert.equal(Number(c.entryCount), 1);
    assert.equal(c.paidOut, 0n);
    const entries = await apps.getEntries(id);
    assert.deepEqual(entries.map(a => a.toLowerCase()), [alice.address.toLowerCase()]);
  });

  it("one human one slot: a second claim reverts AlreadyCounted", async function () {
    const id = await makeReg(3);
    await apps.connect(alice).claim(id, [], []);
    await expectRevert(apps.connect(alice).claim(id, [], []), "AlreadyCounted");
  });

  it("first come first served: once maxClaims is reached the next claim reverts NoSlots", async function () {
    const id = await makeReg(2);
    await apps.connect(alice).claim(id, [], []);
    await apps.connect(bob).claim(id, [], []);
    await expectRevert(apps.connect(carol).claim(id, [], []), "NoSlots");
    const entries = await apps.getEntries(id);
    assert.equal(entries.length, 2);
  });

  it("non-holders cannot register (the gate still applies)", async function () {
    const id = await makeReg(2);
    await expectRevert(apps.connect(dave).claim(id, [], []), "NotHuman");
  });

  it("entry conditions still apply to registration claims", async function () {
    const id = await makeReg(2, BIND_COND);
    await expectRevert(apps.connect(alice).claim(id, [], []), "ConditionFailed");
  });

  it("claiming outside the window reverts NotOpen", async function () {
    const id = await makeReg(2, NO_COND, 60);
    await warp(120);
    await expectRevert(apps.connect(alice).claim(id, [], []), "NotOpen");
  });

  it("validation: a label cannot be combined with a token, a pool, random mode or a payment", async function () {
    const t = await now();
    await expectRevert(apps.connect(creator).createClaim("x", t - 10, t + 3600, 2, await mock.getAddress(), 0n, false, NO_COND, LABEL), "BadParams");
    await expectRevert(apps.connect(creator).createClaim("x", t - 10, t + 3600, 2, ethers.ZeroAddress, 100n, false, NO_COND, LABEL), "BadParams");
    await expectRevert(apps.connect(creator).createClaim("x", t - 10, t + 3600, 2, ethers.ZeroAddress, 0n, true, NO_COND, LABEL), "BadParams");
    await expectRevert(apps.connect(creator).createClaim("x", t - 10, t + 3600, 2, ethers.ZeroAddress, 0n, false, NO_COND, LABEL, { value: 1n }), "BadParams");
    await expectRevert(apps.connect(creator).createClaim("x", t - 10, t + 3600, 2, ethers.ZeroAddress, 0n, false, NO_COND, "L".repeat(81)), "BadParams");
  });

  it("validation: escrow claims are unchanged — pool required and must cover every slot", async function () {
    const t = await now();
    await expectRevert(apps.connect(creator).createClaim("x", t - 10, t + 3600, 2, ethers.ZeroAddress, 0n, false, NO_COND, ""), "BadParams");
    await expectRevert(apps.connect(creator).createClaim("x", t - 10, t + 3600, 10, ethers.ZeroAddress, 5n, false, NO_COND, "", { value: 5n }), "BadParams");
  });

  it("escrow claims still pay out exactly as before (regression)", async function () {
    const t = await now();
    const pool = ethers.parseEther("0.002");
    const tx = await apps.connect(creator).createClaim("escrow drop", t - 10, t + 3600, 2,
      ethers.ZeroAddress, pool, false, NO_COND, "", { value: pool });
    const rc0 = await tx.wait();
    const id = Number(rc0.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "CampaignCreated").args.id);
    const balBefore = await ethers.provider.getBalance(alice.address);
    const rc = await (await apps.connect(alice).claim(id, [], [])).wait();
    const gas = rc.gasUsed * rc.gasPrice;
    const balAfter = await ethers.provider.getBalance(alice.address);
    assert.equal(balAfter - balBefore + gas, ethers.parseEther("0.001"), "fixed share paid in full");
    const c = await apps.getCampaign(id);
    assert.equal(c.paidOut, ethers.parseEther("0.001"));
  });

  it("reclaim on a registration claim closes it out and moves no funds", async function () {
    const id = await makeReg(2, NO_COND, 60);
    await apps.connect(alice).claim(id, [], []);
    await warp(120);
    const balBefore = await ethers.provider.getBalance(creator.address);
    const rc = await (await apps.connect(creator).reclaim(id)).wait();
    const gas = rc.gasUsed * rc.gasPrice;
    const balAfter = await ethers.provider.getBalance(creator.address);
    assert.equal(balBefore - balAfter, gas, "creator got nothing back — there was never a pool");
    const c = await apps.getCampaign(id);
    assert.equal(c.reclaimed, true);
    await expectRevert(apps.connect(creator).reclaim(id), "AlreadyCounted");
  });
});
