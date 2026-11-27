const { ethers } = require("hardhat");
const assert = require("assert");

async function expectRevert(p, errName) {
  try {
    await p;
  } catch (e) {
    if (errName && !String(e.message).includes(errName)) {
      throw new Error(`reverted but not with ${errName}: ${String(e.message).slice(0, 200)}`);
    }
    return;
  }
  throw new Error(`expected revert ${errName || ""} but call succeeded`);
}

describe("OneIDCampaignsV2 — escrow, claims, reclaim", function () {
  let mock, gate, apps, musd;
  let issuer, creator, alice, bob, carol, dave;
  const now = async () => (await ethers.provider.getBlock("latest")).timestamp;

  beforeEach(async function () {
    [issuer, creator, alice, bob, carol, dave] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    gate = await Gate.deploy(await mock.getAddress());
    const Apps = await ethers.getContractFactory("OneIDCampaignsV2", issuer);
    apps = await Apps.deploy(await gate.getAddress());
    const M = await ethers.getContractFactory("MockERC20", issuer);
    musd = await M.deploy();
    for (const u of [alice, bob, carol]) await mock.connect(issuer).issue(u.address);
    await musd.mint(creator.address, ethers.parseEther("1000"));
  });

  it("escrowed BNB raffle: fund, enter, draw, winner claims, double-claim reverts", async function () {
    const t = await now();
    const per = ethers.parseEther("0.1");
    const bn = await ethers.provider.getBlockNumber();
    const id = await apps.connect(creator).createRaffle.staticCall(
      "Prize draw", t - 10, t + 3600, 1, bn + 500, ethers.ZeroAddress, per, { value: per });
    await apps.connect(creator).createRaffle(
      "Prize draw", t - 10, t + 3600, 1, bn + 500, ethers.ZeroAddress, per, { value: per });
    await apps.connect(alice).enterRaffle(id);
    await expectRevert(apps.connect(dave).enterRaffle(id), "NotHuman");
    await expectRevert(apps.connect(alice).enterRaffle(id), "AlreadyCounted");
    await ethers.provider.send("evm_increaseTime", [3700]);
    await ethers.provider.send("evm_mine", []);
    for (let i = 0; i < 600; i++) await ethers.provider.send("evm_mine", []);
    await apps.draw(id);
    assert.equal(await apps.isWinner(id, alice.address), true);
    const before = await ethers.provider.getBalance(alice.address);
    const tx = await apps.connect(alice).claimPrize(id);
    const rc = await tx.wait();
    const gas = rc.gasUsed * rc.gasPrice;
    const after = await ethers.provider.getBalance(alice.address);
    assert.equal(after - before + gas, per);
    await expectRevert(apps.connect(alice).claimPrize(id), "AlreadyCounted");
    await expectRevert(apps.connect(bob).claimPrize(id), "NotWinner");
  });

  it("ERC20 claim campaign: equal shares, one per human, creator reclaims remainder after end", async function () {
    const t = await now();
    const pool = ethers.parseEther("100");
    await musd.connect(creator).approve(await apps.getAddress(), pool);
    const id = await apps.connect(creator).createClaim.staticCall("Fair drop", t - 10, t + 3600, 3, await musd.getAddress(), pool);
    await apps.connect(creator).createClaim("Fair drop", t - 10, t + 3600, 3, await musd.getAddress(), pool);
    const per = pool / 3n;
    await apps.connect(alice).claim(id);
    assert.equal(await musd.balanceOf(alice.address), per);
    await expectRevert(apps.connect(alice).claim(id), "AlreadyCounted");
    await expectRevert(apps.connect(dave).claim(id), "NotHuman");
    await apps.connect(bob).claim(id);
    await expectRevert(apps.connect(creator).reclaim(id), "TooEarly");
    await ethers.provider.send("evm_increaseTime", [3700]);
    await ethers.provider.send("evm_mine", []);
    const dust = pool - per * 2n;
    const cBefore = await musd.balanceOf(creator.address);
    await apps.connect(creator).reclaim(id);
    assert.equal((await musd.balanceOf(creator.address)) - cBefore, dust);
    await expectRevert(apps.connect(creator).reclaim(id), "AlreadyCounted");
  });

  it("claim cap: NoSlots once maxClaims reached", async function () {
    const t = await now();
    const pool = ethers.parseEther("10");
    await musd.connect(creator).approve(await apps.getAddress(), pool);
    const id = await apps.connect(creator).createClaim.staticCall("Tiny drop", t - 10, t + 3600, 2, await musd.getAddress(), pool);
    await apps.connect(creator).createClaim("Tiny drop", t - 10, t + 3600, 2, await musd.getAddress(), pool);
    await apps.connect(alice).claim(id);
    await apps.connect(bob).claim(id);
    await expectRevert(apps.connect(carol).claim(id), "NoSlots");
  });

  it("unfunded raffle still works; wrong escrow value reverts", async function () {
    const t = await now();
    const bn = await ethers.provider.getBlockNumber();
    await expectRevert(
      apps.connect(creator).createRaffle("Bad", t - 10, t + 3600, 1, bn + 500, ethers.ZeroAddress, ethers.parseEther("0.1"), { value: 1 }),
      "WrongValue");
    const id = await apps.connect(creator).createRaffle.staticCall("Free draw", t - 10, t + 3600, 1, bn + 500, ethers.ZeroAddress, 0);
    await apps.connect(creator).createRaffle("Free draw", t - 10, t + 3600, 1, bn + 500, ethers.ZeroAddress, 0);
    await apps.connect(carol).enterRaffle(id);
    assert.equal((await apps.getCampaign(id)).entryCount, 1n);
  });
});
