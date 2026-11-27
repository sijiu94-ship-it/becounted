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
const BIND_COND = { ...NO_COND, requireBinding: true };

describe("IdentityBindingsV2 attestation path", function () {
  let mock, gate, bindings, apps, registrar, creator, alice, bob, carol;

  beforeEach(async function () {
    [registrar, creator, alice, bob, carol] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", registrar);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", registrar);
    gate = await Gate.deploy(await mock.getAddress());
    const Bind = await ethers.getContractFactory("IdentityBindingsV2", registrar);
    bindings = await Bind.deploy();
    const Apps = await ethers.getContractFactory("OneIDCampaignsV9", creator);
    apps = await Apps.deploy(await gate.getAddress(), await bindings.getAddress());
    for (const u of [alice, bob, carol]) await mock.issue(u.address);
  });

  async function signBind(signer, handle) {
    const stmt = await bindings.statementFor(handle, signer.address);
    return signer.signMessage(stmt);
  }

  it("signature path unchanged: proofType 0 and valid", async function () {
    const sig = await signBind(alice, "alice_x");
    await bindings.connect(alice).registerBinding("alice_x", sig);
    assert.equal(await bindings.proofTypeOf(alice.address), 0);
    assert.equal(await bindings.isBindingValid(alice.address), true);
    const [handle, storedSig] = await bindings.bindingOf(alice.address);
    assert.equal(handle, "alice_x");
    assert.equal(storedSig, sig);
  });

  it("attestation: registrar registers an address that never signed", async function () {
    await bindings.connect(registrar).registerByAttestation(bob.address, "bob_agentic");
    assert.equal(await bindings.proofTypeOf(bob.address), 1);
    assert.equal(await bindings.isBindingValid(bob.address), true);
    const [handle, storedSig] = await bindings.bindingOf(bob.address);
    assert.equal(handle, "bob_agentic");
    assert.equal(storedSig, "0x");
  });

  it("attestation: non-registrar cannot register", async function () {
    await expectRevert(bindings.connect(alice).registerByAttestation(bob.address, "bob_agentic"), "NotRegistrar");
  });

  it("attestation cannot overwrite a signature binding", async function () {
    const sig = await signBind(alice, "alice_x");
    await bindings.connect(alice).registerBinding("alice_x", sig);
    await expectRevert(bindings.connect(registrar).registerByAttestation(alice.address, "alice_other"), "ProofDowngrade");
    assert.equal(await bindings.proofTypeOf(alice.address), 0);
  });

  it("signature registration upgrades an attested binding", async function () {
    await bindings.connect(registrar).registerByAttestation(bob.address, "bob_agentic");
    const sig = await signBind(bob, "bob_agentic");
    await bindings.connect(bob).registerBinding("bob_agentic", sig);
    assert.equal(await bindings.proofTypeOf(bob.address), 0);
    assert.equal(await bindings.isBindingValid(bob.address), true);
  });

  it("registrar can revoke an attested binding, not a signature one", async function () {
    await bindings.connect(registrar).registerByAttestation(bob.address, "bob_agentic");
    await bindings.connect(registrar).revokeAttestation(bob.address);
    assert.equal(await bindings.isBindingValid(bob.address), false);
    assert.equal(await bindings.proofTypeOf(bob.address), 255);
    const sig = await signBind(alice, "alice_x");
    await bindings.connect(alice).registerBinding("alice_x", sig);
    await expectRevert(bindings.connect(registrar).revokeAttestation(alice.address), "NotAttested");
    assert.equal(await bindings.isBindingValid(alice.address), true);
  });

  it("owner can remove their own attested binding", async function () {
    await bindings.connect(registrar).registerByAttestation(bob.address, "bob_agentic");
    await bindings.connect(bob).removeBinding();
    assert.equal(await bindings.isBindingValid(bob.address), false);
  });

  it("integration: condition 0 accepts attested, rejects unbound", async function () {
    await bindings.connect(registrar).registerByAttestation(bob.address, "bob_agentic");
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const blk = await ethers.provider.getBlockNumber();
    const tx = await apps.connect(creator).createRaffle("gated", now - 10, now + 3600, 1, blk + 100, ethers.ZeroAddress, 0n, BIND_COND, "");
    const rc = await tx.wait();
    const ev = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } }).find(e => e && e.name === "CampaignCreated");
    const id = Number(ev.args.id);
    await apps.connect(bob).enterRaffle(id, []);
    assert.equal(await apps.hasEntered(id, bob.address), true);
    await expectRevert(apps.connect(carol).enterRaffle(id, []), "ConditionFailed");
  });
});
