const { ethers } = require("hardhat");
const assert = require("assert");

async function expectRevert(p, errName) {
  try { await p; } catch (e) {
    if (errName && !String(e.message).includes(errName)) throw new Error(`reverted but not with ${errName}: ${String(e.message).slice(0, 160)}`);
    return;
  }
  throw new Error(`expected revert ${errName || ""} but call succeeded`);
}

const stmt = (handle, address) =>
  `BeCounted X binding\nHandle: @${handle}\nAddress: ${address.toLowerCase()}\nNetwork: BNB Chain`;

describe("IdentityBindings + V5 series", function () {
  let bindings, mock, gate, apps, issuer, creator, alice, bob;

  beforeEach(async function () {
    [issuer, creator, alice, bob] = await ethers.getSigners();
    const B = await ethers.getContractFactory("IdentityBindings", issuer);
    bindings = await B.deploy();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", issuer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    gate = await Gate.deploy(await mock.getAddress());
    const Apps = await ethers.getContractFactory("OneIDCampaignsV5", issuer);
    apps = await Apps.deploy(await gate.getAddress());
  });

  it("contract statement matches the frontend canonical string byte-for-byte", async function () {
    const onchain = await bindings.statementFor("jiusi", alice.address);
    assert.equal(onchain, stmt("jiusi", alice.address));
  });

  it("registers a valid binding; validity re-verifies; removal clears", async function () {
    const sig = await alice.signMessage(stmt("jiusi", alice.address));
    await bindings.connect(alice).registerBinding("jiusi", sig);
    const [handle, gotSig, at] = await bindings.bindingOf(alice.address);
    assert.equal(handle, "jiusi");
    assert.equal(gotSig, sig);
    assert.ok(at > 0n);
    assert.equal(await bindings.isBindingValid(alice.address), true);
    await bindings.connect(alice).removeBinding();
    assert.equal(await bindings.isBindingValid(alice.address), false);
  });

  it("rejects signatures made for another handle, another wallet, or garbage", async function () {
    const sigOtherHandle = await alice.signMessage(stmt("someoneelse", alice.address));
    await expectRevert(bindings.connect(alice).registerBinding("jiusi", sigOtherHandle), "BadSignature");
    const sigBob = await bob.signMessage(stmt("jiusi", bob.address));
    await expectRevert(bindings.connect(alice).registerBinding("jiusi", sigBob), "BadSignature");
    await expectRevert(bindings.connect(alice).registerBinding("jiusi", "0x1234"), "BadSignature");
  });

  it("rejects bad handles", async function () {
    const sig = await alice.signMessage(stmt("jiusi", alice.address));
    await expectRevert(bindings.connect(alice).registerBinding("Jiusi", sig), "BadHandle");
    await expectRevert(bindings.connect(alice).registerBinding("waytoolonghandle1", sig), "BadHandle");
    await expectRevert(bindings.connect(alice).registerBinding("bad-handle", sig), "BadHandle");
    await expectRevert(bindings.connect(alice).registerBinding("", sig), "BadHandle");
  });

  it("series: creator sets and clears; others cannot; over-long reverts", async function () {
    const t = (await ethers.provider.getBlock("latest")).timestamp;
    const id = await apps.connect(creator).createVote.staticCall("Series test", t - 10, t + 3600, 2);
    await apps.connect(creator).createVote("Series test", t - 10, t + 3600, 2);
    assert.equal(await apps.series(id), "");
    await apps.connect(creator).setSeries(id, "Season 2");
    assert.equal(await apps.series(id), "Season 2");
    await expectRevert(apps.connect(alice).setSeries(id, "Hijack"), "NotCreator");
    await expectRevert(apps.connect(creator).setSeries(id, "x".repeat(61)), "BadParams");
    await apps.connect(creator).setSeries(id, "");
    assert.equal(await apps.series(id), "");
  });
});
