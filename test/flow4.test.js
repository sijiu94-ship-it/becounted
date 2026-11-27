const { ethers } = require("hardhat");
const assert = require("assert");

async function expectRevert(p, errName) {
  try { await p; } catch (e) {
    if (errName && !String(e.message).includes(errName)) throw new Error(`reverted but not with ${errName}: ${String(e.message).slice(0, 160)}`);
    return;
  }
  throw new Error(`expected revert ${errName || ""} but call succeeded`);
}

describe("OneIDCampaignsV4 — creator X post link", function () {
  let mock, gate, apps, issuer, creator, alice;
  const now = async () => (await ethers.provider.getBlock("latest")).timestamp;

  beforeEach(async function () {
    [issuer, creator, alice] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    gate = await Gate.deploy(await mock.getAddress());
    const Apps = await ethers.getContractFactory("OneIDCampaignsV4", issuer);
    apps = await Apps.deploy(await gate.getAddress());
    await mock.connect(issuer).issue(alice.address);
  });

  it("creator sets and updates the post URL; others cannot", async function () {
    const t = await now();
    const id = await apps.connect(creator).createVote.staticCall("Post link test", t - 10, t + 3600, 2);
    await apps.connect(creator).createVote("Post link test", t - 10, t + 3600, 2);
    assert.equal(await apps.postUrl(id), "");
    await apps.connect(creator).setPostUrl(id, "https://x.com/jiusi/status/1234567890");
    assert.equal(await apps.postUrl(id), "https://x.com/jiusi/status/1234567890");
    await expectRevert(apps.connect(alice).setPostUrl(id, "https://x.com/alice/status/1"), "NotCreator");
    await apps.connect(creator).setPostUrl(id, "https://x.com/jiusi/status/9999");
    assert.equal(await apps.postUrl(id), "https://x.com/jiusi/status/9999");
  });

  it("rejects empty, over-long and non-https URLs", async function () {
    const t = await now();
    const id = await apps.connect(creator).createVote.staticCall("URL rules", t - 10, t + 3600, 2);
    await apps.connect(creator).createVote("URL rules", t - 10, t + 3600, 2);
    await expectRevert(apps.connect(creator).setPostUrl(id, ""), "BadParams");
    await expectRevert(apps.connect(creator).setPostUrl(id, "http://x.com/a/status/1"), "BadParams");
    await expectRevert(apps.connect(creator).setPostUrl(id, "https://x.com/" + "a".repeat(200)), "BadParams");
  });
});
