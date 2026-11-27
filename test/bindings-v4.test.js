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
const DAY = 86400;
const TWEET = 2125786033946279937n;

describe("IdentityBindingsV4 self-registration + cooldown", function () {
  let mock, gate, bindings, apps, registrar, creator, alice, bob, carol;

  beforeEach(async function () {
    [registrar, creator, alice, bob, carol] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", registrar);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", registrar);
    gate = await Gate.deploy(await mock.getAddress());
    const Bind = await ethers.getContractFactory("IdentityBindingsV4", registrar);
    bindings = await Bind.deploy();
    const Apps = await ethers.getContractFactory("OneIDCampaignsV11", creator);
    apps = await Apps.deploy(await gate.getAddress(), await bindings.getAddress());
    for (const u of [alice, bob, carol]) await mock.issue(u.address);
  });

  async function signBind(signer, handle) {
    const stmt = await bindings.statementFor(handle, signer.address);
    return signer.signMessage(stmt);
  }

  async function bindRaffle() {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const tx = await apps.connect(creator).createRaffle("bind-gated", now - 10, now + 3600, 1,
      ethers.ZeroAddress, 0n, BIND_COND, "");
    const rc = await tx.wait();
    return Number(rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "CampaignCreated").args.id);
  }

  // ---------- signature path (carried over) ----------

  it("signature path: proofType 0, valid, cooldown stamped", async function () {
    const sig = await signBind(alice, "alice_x");
    await bindings.connect(alice).registerBinding("alice_x", sig);
    assert.equal(await bindings.proofTypeOf(alice.address), 0);
    assert.equal(await bindings.isBindingValid(alice.address), true);
    assert.equal(await bindings.proofRefOf(alice.address), 0n);
    const [handle, storedSig] = await bindings.bindingOf(alice.address);
    assert.equal(handle, "alice_x");
    assert.equal(storedSig, sig);
    assert.ok((await bindings.lastRegisteredAt(alice.address)) > 0n);
  });

  it("signature path: wrong signer signature reverts BadSignature", async function () {
    const sig = await signBind(alice, "alice_x"); // alice's signature…
    await expectRevert(bindings.connect(bob).registerBinding("alice_x", sig), "BadSignature"); // …submitted by bob
  });

  // ---------- self-registration path ----------

  it("self path: proofType 2, valid, proofRef stored, cooldown stamped", async function () {
    await bindings.connect(alice).registerSelf("alice_x", TWEET);
    assert.equal(await bindings.proofTypeOf(alice.address), 2);
    assert.equal(await bindings.isBindingValid(alice.address), true);
    assert.equal(await bindings.proofRefOf(alice.address), TWEET);
    const [handle, storedSig] = await bindings.bindingOf(alice.address);
    assert.equal(handle, "alice_x");
    assert.equal(storedSig, "0x");
    assert.ok((await bindings.lastRegisteredAt(alice.address)) > 0n);
  });

  it("self path: tweetId 0 reverts BadEvidence", async function () {
    await expectRevert(bindings.connect(alice).registerSelf("alice_x", 0n), "BadEvidence");
  });

  it("self path: bad handles revert BadHandle", async function () {
    await expectRevert(bindings.connect(alice).registerSelf("Alice_X", TWEET), "BadHandle");
    await expectRevert(bindings.connect(alice).registerSelf("a".repeat(16), TWEET), "BadHandle");
    await expectRevert(bindings.connect(alice).registerSelf("", TWEET), "BadHandle");
    await expectRevert(bindings.connect(alice).registerSelf("@alice", TWEET), "BadHandle");
  });

  it("self path cannot overwrite a signature binding (after cooldown)", async function () {
    const sig = await signBind(alice, "alice_x");
    await bindings.connect(alice).registerBinding("alice_x", sig);
    await warp(DAY + 1);
    await expectRevert(bindings.connect(alice).registerSelf("alice_other", TWEET), "ProofDowngrade");
    assert.equal(await bindings.proofTypeOf(alice.address), 0);
  });

  it("signature path CAN overwrite a self-registration (after cooldown), clearing proofRef", async function () {
    await bindings.connect(alice).registerSelf("alice_x", TWEET);
    await warp(DAY + 1);
    const sig = await signBind(alice, "alice_x");
    await bindings.connect(alice).registerBinding("alice_x", sig);
    assert.equal(await bindings.proofTypeOf(alice.address), 0);
    assert.equal(await bindings.proofRefOf(alice.address), 0n);
  });

  it("self path can overwrite own self-registration after cooldown", async function () {
    await bindings.connect(alice).registerSelf("alice_x", TWEET);
    await warp(DAY + 1);
    await bindings.connect(alice).registerSelf("alice_new", TWEET + 1n);
    const [handle] = await bindings.bindingOf(alice.address);
    assert.equal(handle, "alice_new");
    assert.equal(await bindings.proofRefOf(alice.address), TWEET + 1n);
  });

  // ---------- cooldown ----------

  it("cooldown: immediate second self-registration reverts CooldownActive", async function () {
    await bindings.connect(alice).registerSelf("alice_x", TWEET);
    await expectRevert(bindings.connect(alice).registerSelf("alice_y", TWEET + 1n), "CooldownActive");
  });

  it("cooldown: self then signature immediately reverts CooldownActive", async function () {
    await bindings.connect(alice).registerSelf("alice_x", TWEET);
    const sig = await signBind(alice, "alice_x");
    await expectRevert(bindings.connect(alice).registerBinding("alice_x", sig), "CooldownActive");
  });

  it("cooldown: signature then self immediately reverts CooldownActive", async function () {
    const sig = await signBind(alice, "alice_x");
    await bindings.connect(alice).registerBinding("alice_x", sig);
    await expectRevert(bindings.connect(alice).registerSelf("alice_x", TWEET), "CooldownActive");
  });

  it("cooldown: removeBinding does NOT reset it", async function () {
    await bindings.connect(alice).registerSelf("alice_x", TWEET);
    await bindings.connect(alice).removeBinding();
    assert.equal(await bindings.proofTypeOf(alice.address), 255);
    await expectRevert(bindings.connect(alice).registerSelf("alice_x", TWEET), "CooldownActive");
  });

  it("cooldown: revocation does NOT reset it", async function () {
    await bindings.connect(alice).registerSelf("fake_handle", TWEET);
    await bindings.connect(registrar).revokeSelfRegistration(alice.address);
    await expectRevert(bindings.connect(alice).registerSelf("alice_x", TWEET), "CooldownActive");
  });

  it("cooldown: per-address — a fresh address registers while another is cooling down", async function () {
    await bindings.connect(alice).registerSelf("alice_x", TWEET);
    await bindings.connect(bob).registerSelf("bob_x", TWEET);
    assert.equal(await bindings.proofTypeOf(bob.address), 2);
  });

  it("cooldown: after 24h the next registration succeeds", async function () {
    await bindings.connect(alice).registerSelf("alice_x", TWEET);
    await warp(DAY + 1);
    await bindings.connect(alice).registerSelf("alice_y", TWEET + 1n);
    assert.equal(await bindings.proofTypeOf(alice.address), 2);
  });

  // ---------- revocation ----------

  it("revocation: registrar revokes a self-registration", async function () {
    await bindings.connect(alice).registerSelf("fake_handle", TWEET);
    await bindings.connect(registrar).revokeSelfRegistration(alice.address);
    assert.equal(await bindings.proofTypeOf(alice.address), 255);
    assert.equal(await bindings.isBindingValid(alice.address), false);
    assert.equal(await bindings.proofRefOf(alice.address), 0n);
  });

  it("revocation: non-registrar reverts NotRegistrar", async function () {
    await bindings.connect(alice).registerSelf("alice_x", TWEET);
    await expectRevert(bindings.connect(bob).revokeSelfRegistration(alice.address), "NotRegistrar");
  });

  it("revocation: signature binding is untouchable (NotSelfRegistered)", async function () {
    const sig = await signBind(alice, "alice_x");
    await bindings.connect(alice).registerBinding("alice_x", sig);
    await expectRevert(bindings.connect(registrar).revokeSelfRegistration(alice.address), "NotSelfRegistered");
    assert.equal(await bindings.proofTypeOf(alice.address), 0);
  });

  it("revocation: unbound address reverts NotSelfRegistered", async function () {
    await expectRevert(bindings.connect(registrar).revokeSelfRegistration(carol.address), "NotSelfRegistered");
  });

  it("registrar rotation: role moves, zero address and strangers rejected", async function () {
    await expectRevert(bindings.connect(alice).transferRegistrar(bob.address), "NotRegistrar");
    await expectRevert(bindings.connect(registrar).transferRegistrar(ethers.ZeroAddress), "BadRegistrar");
    await bindings.connect(registrar).transferRegistrar(bob.address);
    await bindings.connect(alice).registerSelf("alice_x", TWEET);
    await expectRevert(bindings.connect(registrar).revokeSelfRegistration(alice.address), "NotRegistrar");
    await bindings.connect(bob).revokeSelfRegistration(alice.address);
    assert.equal(await bindings.proofTypeOf(alice.address), 255);
  });

  // ---------- campaigns integration (V11 wired to V4 bindings) ----------

  it("campaigns: self-registered and signature-bound holders pass condition 0, unbound cannot", async function () {
    await bindings.connect(alice).registerSelf("alice_x", TWEET);
    const sig = await signBind(carol, "carol_x");
    await bindings.connect(carol).registerBinding("carol_x", sig);
    const id = await bindRaffle();
    await apps.connect(alice).enterRaffle(id, [], []);
    await apps.connect(carol).enterRaffle(id, [], []);
    await expectRevert(apps.connect(bob).enterRaffle(id, [], []), "ConditionFailed");
  });

  it("campaigns: after revocation the holder fails condition 0; after cooldown + re-register, passes again", async function () {
    await bindings.connect(alice).registerSelf("fake_handle", TWEET);
    await bindings.connect(registrar).revokeSelfRegistration(alice.address);
    const id1 = await bindRaffle();
    await expectRevert(apps.connect(alice).enterRaffle(id1, [], []), "ConditionFailed");
    await warp(DAY + 1);
    await bindings.connect(alice).registerSelf("alice_x", TWEET + 5n);
    const id2 = await bindRaffle();
    await apps.connect(alice).enterRaffle(id2, [], []);
  });
});
