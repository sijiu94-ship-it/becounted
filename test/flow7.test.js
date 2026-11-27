const { ethers } = require("hardhat");
const assert = require("assert");

async function expectRevert(p, errName) {
  try { await p; } catch (e) {
    if (errName && !String(e.message).includes(errName)) throw new Error(`reverted but not with ${errName}: ${String(e.message).slice(0, 160)}`);
    return;
  }
  throw new Error(`expected revert ${errName || ""} but call succeeded`);
}

describe("GatedClaim template (templates/GatedClaim.sol)", function () {
  let mock, gate, token, issuer, creator, alice, bob, carol;

  beforeEach(async function () {
    [issuer, creator, alice, bob, carol] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    gate = await Gate.deploy(await mock.getAddress());
    const Tok = await ethers.getContractFactory("MockERC20", creator);
    token = await Tok.deploy();
    // alice and carol hold Agent IDs; bob does not.
    await mock.issue(alice.address);
    await mock.issue(carol.address);
  });

  async function deployDrop({ tokenAddr, pool, maxClaims, startDelta = -10, endDelta = 3600 }) {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const G = await ethers.getContractFactory("GatedClaim", creator);
    const drop = await G.deploy(await gate.getAddress(), tokenAddr, pool, maxClaims, now + startDelta, now + endDelta);
    return drop;
  }

  async function deployFundedErc20(pool = 300n, maxClaims = 3) {
    const drop = await deployDrop({ tokenAddr: await token.getAddress(), pool, maxClaims });
    await token.mint(creator.address, pool);
    await token.connect(creator).approve(await drop.getAddress(), pool);
    await drop.connect(creator).fund();
    return drop;
  }

  it("claim before funding reverts NotFunded", async function () {
    const drop = await deployDrop({ tokenAddr: await token.getAddress(), pool: 300n, maxClaims: 3 });
    await expectRevert(drop.connect(alice).claim(), "NotFunded");
  });

  it("non-human claim reverts NotHuman", async function () {
    const drop = await deployFundedErc20();
    assert.equal(await gate.isHuman(bob.address), false);
    await expectRevert(drop.connect(bob).claim(), "NotHuman");
    assert.equal(await drop.claimedCount(), 0);
  });

  it("human claims exactly one equal share (ERC20)", async function () {
    const drop = await deployFundedErc20(300n, 3);
    assert.equal(await drop.share(), 100n);
    await drop.connect(alice).claim();
    assert.equal(await token.balanceOf(alice.address), 100n);
    assert.equal(await drop.claimed(alice.address), true);
    assert.equal(await drop.claimedCount(), 1);
    assert.equal(await drop.paidOut(), 100n);
    assert.equal(await drop.remainingShares(), 2);
    assert.equal(await drop.remainingPool(), 200n);
  });

  it("second claim from the same human reverts AlreadyClaimed", async function () {
    const drop = await deployFundedErc20();
    await drop.connect(alice).claim();
    await expectRevert(drop.connect(alice).claim(), "AlreadyClaimed");
    assert.equal(await token.balanceOf(alice.address), 100n);
  });

  it("sold out: once the shares are gone, claims revert NoSlots", async function () {
    const drop = await deployFundedErc20(50n, 1);
    await drop.connect(alice).claim();
    await expectRevert(drop.connect(carol).claim(), "NoSlots");
  });

  it("reclaim: too early reverts, non-creator reverts, after deadline creator recovers leftovers plus dust", async function () {
    // Pool 100 over 3 shares pays 33 each; dust is 1.
    const drop = await deployFundedErc20(100n, 3);
    await drop.connect(alice).claim();
    assert.equal(await token.balanceOf(alice.address), 33n);

    await expectRevert(drop.connect(creator).reclaim(), "TooEarly");

    await ethers.provider.send("evm_increaseTime", [3700]);
    await ethers.provider.send("evm_mine", []);

    await expectRevert(drop.connect(alice).reclaim(), "NotCreator");
    const before = await token.balanceOf(creator.address);
    await drop.connect(creator).reclaim();
    const after = await token.balanceOf(creator.address);
    assert.equal(after - before, 67n); // 2 unclaimed shares (66) + dust (1)
    assert.equal(await token.balanceOf(await drop.getAddress()), 0n);
    assert.equal(await drop.reclaimed(), true);
    await expectRevert(drop.connect(creator).reclaim(), "AlreadyReclaimed");
  });

  it("claim after the window closes reverts NotOpen", async function () {
    const drop = await deployFundedErc20(300n, 3);
    await ethers.provider.send("evm_increaseTime", [3700]);
    await ethers.provider.send("evm_mine", []);
    await expectRevert(drop.connect(carol).claim(), "NotOpen");
  });

  it("BNB pool: fund with value, human claims the exact BNB share", async function () {
    const pool = ethers.parseEther("0.003");
    const drop = await deployDrop({ tokenAddr: ethers.ZeroAddress, pool, maxClaims: 3 });
    await drop.connect(creator).fund({ value: pool });
    assert.equal(await drop.share(), ethers.parseEther("0.001"));

    const before = await ethers.provider.getBalance(carol.address);
    const tx = await drop.connect(carol).claim();
    const rc = await tx.wait();
    const gas = rc.gasUsed * rc.gasPrice;
    const after = await ethers.provider.getBalance(carol.address);
    assert.equal(after - before, ethers.parseEther("0.001") - gas);
    assert.equal(await ethers.provider.getBalance(await drop.getAddress()), ethers.parseEther("0.002"));
  });
});
