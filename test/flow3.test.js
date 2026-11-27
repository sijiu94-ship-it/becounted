const { ethers } = require("hardhat");
const assert = require("assert");

async function expectRevert(p, errName) {
  try { await p; } catch (e) {
    if (errName && !String(e.message).includes(errName)) throw new Error(`reverted but not with ${errName}: ${String(e.message).slice(0, 160)}`);
    return;
  }
  throw new Error(`expected revert ${errName || ""} but call succeeded`);
}

describe("OneIDCampaignsV3 — random (lucky-draw) claims", function () {
  let mock, gate, apps;
  let issuer, creator, alice, bob, carol;
  const now = async () => (await ethers.provider.getBlock("latest")).timestamp;

  beforeEach(async function () {
    [issuer, creator, alice, bob, carol] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    gate = await Gate.deploy(await mock.getAddress());
    const Apps = await ethers.getContractFactory("OneIDCampaignsV3", issuer);
    apps = await Apps.deploy(await gate.getAddress());
    for (const u of [alice, bob, carol]) await mock.connect(issuer).issue(u.address);
  });

  it("random mode: shares vary, every share >= 1, last claim drains the pool exactly", async function () {
    const t = await now();
    const pool = ethers.parseEther("0.09");
    const id = await apps.connect(creator).createClaim.staticCall("Lucky drop", t - 10, t + 3600, 3, ethers.ZeroAddress, pool, true, { value: pool });
    await apps.connect(creator).createClaim("Lucky drop", t - 10, t + 3600, 3, ethers.ZeroAddress, pool, true, { value: pool });
    const c0 = await apps.getCampaign(id);
    assert.equal(c0.claimRandom, true);
    assert.equal(c0.claimAmount, 0n);

    const got = [];
    for (const u of [alice, bob, carol]) {
      const before = await ethers.provider.getBalance(u.address);
      const tx = await apps.connect(u).claim(id);
      const rc = await tx.wait();
      const after = await ethers.provider.getBalance(u.address);
      got.push(after - before + rc.gasUsed * rc.gasPrice);
    }
    console.log("    random shares:", got.map(g => ethers.formatEther(g)).join(", "));
    for (const g of got) assert.ok(g >= 1n, "share below 1 unit");
    assert.equal(got[0] + got[1] + got[2], pool, "pool must drain exactly");
    const c1 = await apps.getCampaign(id);
    assert.equal(c1.paidOut, pool);
    // Pool exhausted: the NoSlots check fires before the dedup check.
    await expectRevert(apps.connect(alice).claim(id), "NoSlots");
  });

  it("random mode bounds: no draw exceeds twice the remaining average", async function () {
    const t = await now();
    const pool = 1000n; // tiny pool in wei to stress the bounds
    const id = await apps.connect(creator).createClaim.staticCall("Tiny lucky", t - 10, t + 3600, 3, ethers.ZeroAddress, pool, true, { value: pool });
    await apps.connect(creator).createClaim("Tiny lucky", t - 10, t + 3600, 3, ethers.ZeroAddress, pool, true, { value: pool });
    let remaining = pool;
    for (const [i, u] of [alice, bob, carol].entries()) {
      const slots = 3n - BigInt(i);
      const before = await ethers.provider.getBalance(u.address);
      const tx = await apps.connect(u).claim(id);
      const rc = await tx.wait();
      const gotAmt = (await ethers.provider.getBalance(u.address)) - before + rc.gasUsed * rc.gasPrice;
      if (slots > 1n) {
        const cap = (remaining / slots) * 2n;
        assert.ok(gotAmt <= cap, `draw ${gotAmt} exceeds double-mean cap ${cap}`);
        assert.ok(gotAmt >= 1n);
      } else {
        assert.equal(gotAmt, remaining, "last claim takes the rest");
      }
      remaining -= gotAmt;
    }
    assert.equal(remaining, 0n);
  });

  it("fixed mode unchanged in V3; pool smaller than slots reverts", async function () {
    const t = await now();
    const pool = ethers.parseEther("0.03");
    const id = await apps.connect(creator).createClaim.staticCall("Fixed drop", t - 10, t + 3600, 3, ethers.ZeroAddress, pool, false, { value: pool });
    await apps.connect(creator).createClaim("Fixed drop", t - 10, t + 3600, 3, ethers.ZeroAddress, pool, false, { value: pool });
    const before = await ethers.provider.getBalance(alice.address);
    const tx = await apps.connect(alice).claim(id);
    const rc = await tx.wait();
    const gotAmt = (await ethers.provider.getBalance(alice.address)) - before + rc.gasUsed * rc.gasPrice;
    assert.equal(gotAmt, ethers.parseEther("0.01"));
    await expectRevert(
      apps.connect(creator).createClaim("Too small", t - 10, t + 3600, 10, ethers.ZeroAddress, 5, true, { value: 5 }),
      "BadParams");
  });
});
