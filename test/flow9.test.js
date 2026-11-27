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
const NO_COND = { requireBinding: false, gateToken: ethers.ZeroAddress, gateMin: 0n, gateIs721: false, requireEnteredId: MAXU, minStamps: 0, questRef: ethers.ZeroAddress };

describe("OneIDCampaignsV6 condition engine", function () {
  let mock, gate, bindings, apps, token, quest, issuer, creator, alice, bob, carol, dave, erin;

  beforeEach(async function () {
    [issuer, creator, alice, bob, carol, dave, erin] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    gate = await Gate.deploy(await mock.getAddress());
    const Bind = await ethers.getContractFactory("IdentityBindings", issuer);
    bindings = await Bind.deploy();
    const Apps = await ethers.getContractFactory("OneIDCampaignsV6", creator);
    apps = await Apps.deploy(await gate.getAddress(), await bindings.getAddress());
    const Tok = await ethers.getContractFactory("MockERC20", creator);
    token = await Tok.deploy();
    for (const u of [alice, carol, dave, erin]) await mock.issue(u.address);
    // a live QuestPass season (BNB pools) for the stamp condition
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const Q = await ethers.getContractFactory("QuestPass", creator);
    quest = await Q.deploy(await gate.getAddress(), ethers.ZeroAddress, now - 10, 5,
      ethers.parseEther("0.005"), 1, 1, 0n, 3600, { value: ethers.parseEther("0.035") });
  });

  async function raffle(cond, title = "r") {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const blk = await ethers.provider.getBlockNumber();
    const tx = await apps.connect(creator).createRaffle(title, now - 10, now + 3600, 1, blk + 100, ethers.ZeroAddress, 0n, cond);
    const rc = await tx.wait();
    const ev = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } }).find(e => e && e.name === "CampaignCreated");
    return Number(ev.args.id);
  }

  async function bind(who, handle) {
    const stmt = await bindings.statementFor(handle, who.address);
    const sig = await who.signMessage(stmt);
    await bindings.connect(who).registerBinding(handle, sig);
  }

  it("no conditions: entry behaves like V5", async function () {
    const id = await raffle(NO_COND);
    await apps.connect(alice).enterRaffle(id);
    assert.equal(await apps.hasEntered(id, alice.address), true);
    const cd = await apps.conditionsOf(id);
    assert.equal(cd.requireBinding, false);
    assert.equal(cd.requireEnteredId, MAXU);
  });

  it("condition 0 (X binding): blocks unbound, admits after binding, failure does not consume the entry", async function () {
    const id = await raffle({ ...NO_COND, requireBinding: true });
    await expectRevert(apps.connect(alice).enterRaffle(id), "ConditionFailed");
    assert.equal(await apps.hasEntered(id, alice.address), false);
    await bind(alice, "alice_x");
    await apps.connect(alice).enterRaffle(id);
    assert.equal(await apps.hasEntered(id, alice.address), true);
  });

  it("condition 1 (token gate): blocks below the minimum, admits at the minimum", async function () {
    const id = await raffle({ ...NO_COND, gateToken: await token.getAddress(), gateMin: 100n });
    await expectRevert(apps.connect(carol).enterRaffle(id), "ConditionFailed");
    await token.mint(carol.address, 99n);
    await expectRevert(apps.connect(carol).enterRaffle(id), "ConditionFailed");
    await token.mint(carol.address, 1n);
    await apps.connect(carol).enterRaffle(id);
    assert.equal(await apps.hasEntered(id, carol.address), true);
  });

  it("condition 2 (prior participation): must enter the earlier campaign first", async function () {
    const a = await raffle(NO_COND, "first");
    const b = await raffle({ ...NO_COND, requireEnteredId: BigInt(a) }, "second");
    await expectRevert(apps.connect(dave).enterRaffle(b), "ConditionFailed");
    await apps.connect(dave).enterRaffle(a);
    await apps.connect(dave).enterRaffle(b);
    assert.equal(await apps.hasEntered(b, dave.address), true);
  });

  it("condition 3 (quest stamps): must hold a stamp in the named season", async function () {
    const id = await raffle({ ...NO_COND, minStamps: 1, questRef: await quest.getAddress() });
    await expectRevert(apps.connect(erin).enterRaffle(id), "ConditionFailed");
    await quest.connect(erin).claimStamp();
    await apps.connect(erin).enterRaffle(id);
    assert.equal(await apps.hasEntered(id, erin.address), true);
  });

  it("conditions also gate votes and claims", async function () {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const vtx = await apps.connect(creator).createVote("v", now - 10, now + 3600, 2, { ...NO_COND, requireBinding: true });
    const vrc = await vtx.wait();
    const vid = Number(vrc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } }).find(e => e && e.name === "CampaignCreated").args.id);
    await expectRevert(apps.connect(alice).castVote(vid, 0), "ConditionFailed");
    await bind(alice, "alice_x");
    await apps.connect(alice).castVote(vid, 1);
    assert.equal(await apps.tally(vid, 1), 1n);

    await token.mint(creator.address, 300n);
    await token.connect(creator).approve(await apps.getAddress(), 300n);
    const ctx = await apps.connect(creator).createClaim("c", now - 10, now + 3600, 3, await token.getAddress(), 300n, false,
      { ...NO_COND, gateToken: await token.getAddress(), gateMin: 50n });
    const crc = await ctx.wait();
    const cid = Number(crc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } }).find(e => e && e.name === "CampaignCreated").args.id);
    await expectRevert(apps.connect(carol).claim(cid), "ConditionFailed");
    await token.mint(carol.address, 50n);
    await apps.connect(carol).claim(cid);
    assert.equal(await token.balanceOf(carol.address), 150n); // 50 kept + 100 share
  });

  it("creation validation: bad condition combos revert BadParams", async function () {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const blk = await ethers.provider.getBlockNumber();
    // gate token without a minimum
    await expectRevert(apps.connect(creator).createRaffle("x", now - 10, now + 3600, 1, blk + 100, ethers.ZeroAddress, 0n,
      { ...NO_COND, gateToken: await token.getAddress(), gateMin: 0n }), "BadParams");
    // prior-participation pointing at a future/self campaign
    await expectRevert(apps.connect(creator).createRaffle("x", now - 10, now + 3600, 1, blk + 100, ethers.ZeroAddress, 0n,
      { ...NO_COND, requireEnteredId: 99n }), "BadParams");
    // stamps without a season contract, and stamps above the season maximum
    await expectRevert(apps.connect(creator).createRaffle("x", now - 10, now + 3600, 1, blk + 100, ethers.ZeroAddress, 0n,
      { ...NO_COND, minStamps: 2 }), "BadParams");
    await expectRevert(apps.connect(creator).createRaffle("x", now - 10, now + 3600, 1, blk + 100, ethers.ZeroAddress, 0n,
      { ...NO_COND, minStamps: 8, questRef: await quest.getAddress() }), "BadParams");
    // binding condition on a deployment without a bindings contract
    const Apps2 = await ethers.getContractFactory("OneIDCampaignsV6", creator);
    const apps2 = await Apps2.deploy(await gate.getAddress(), ethers.ZeroAddress);
    await expectRevert(apps2.connect(creator).createRaffle("x", now - 10, now + 3600, 1, blk + 100, ethers.ZeroAddress, 0n,
      { ...NO_COND, requireBinding: true }), "BadParams");
  });

  it("combined conditions: all must pass", async function () {
    const id = await raffle({ ...NO_COND, requireBinding: true, gateToken: await token.getAddress(), gateMin: 10n });
    await bind(dave, "dave_x");
    await expectRevert(apps.connect(dave).enterRaffle(id), "ConditionFailed"); // bound but no tokens
    await token.mint(dave.address, 10n);
    await apps.connect(dave).enterRaffle(id);
    assert.equal(await apps.hasEntered(id, dave.address), true);
  });
});
