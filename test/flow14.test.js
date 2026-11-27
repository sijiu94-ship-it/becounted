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
const NO_COND = { requireBinding: false, gateToken: ethers.ZeroAddress, gateMin: 0n, gateIs721: false, requireEnteredId: MAXU, minStamps: 0, questRef: ethers.ZeroAddress, allowRoot: ethers.ZeroHash, idListRoot: ethers.ZeroHash };

// --- Merkle helpers: MUST match OneIDCampaignsV11's sorted-pair scheme ---
// condition 4 leaf = keccak256(packed address)
// condition 5 leaf = keccak256(packed keccak256(bytes(handle)))  [identity leaf]
function addrLeafOf(addr) { return ethers.keccak256(ethers.solidityPacked(["address"], [addr])); }
function idLeafOf(handle) {
  const labelhash = ethers.keccak256(ethers.toUtf8Bytes(handle));
  return ethers.keccak256(ethers.solidityPacked(["bytes32"], [labelhash]));
}
function hashPair(a, b) {
  const [x, y] = a < b ? [a, b] : [b, a];
  return ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [x, y]));
}
function buildLayers(leaves) {
  let level = leaves.slice();
  const layers = [level];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(i + 1 < level.length ? hashPair(level[i], level[i + 1]) : level[i]);
    }
    level = next;
    layers.push(level);
  }
  return layers;
}
function rootOfLeaves(leaves) { const l = buildLayers(leaves); return l[l.length - 1][0]; }
function proofOfLeaf(leaves, leaf) {
  const layers = buildLayers(leaves);
  let idx = leaves.findIndex(x => x.toLowerCase() === leaf.toLowerCase());
  assert(idx >= 0, "leaf not in list");
  const proof = [];
  for (let li = 0; li < layers.length - 1; li++) {
    const level = layers[li];
    const sib = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (sib < level.length) proof.push(level[sib]);
    idx = Math.floor(idx / 2);
  }
  return proof;
}
const addrRoot = (addrs) => rootOfLeaves(addrs.map(addrLeafOf));
const addrProof = (addrs, a) => proofOfLeaf(addrs.map(addrLeafOf), addrLeafOf(a));
const idRoot = (handles) => rootOfLeaves(handles.map(idLeafOf));
const idProof = (handles, h) => proofOfLeaf(handles.map(idLeafOf), idLeafOf(h));

describe("OneIDCampaignsV11 condition 5 (Agent ID allowlist)", function () {
  let mock, gate, bindings, apps, issuer, creator, alice, bob, carol, dave, erin;

  // Assert a staticCall reverts with ConditionFailed(which) exactly.
  async function expectCondition(callPromise, which) {
    try { await callPromise; } catch (e) {
      const data = e.data || (e.info && e.info.error && e.info.error.data) || null;
      if (data && data !== "0x") {
        const parsed = apps.interface.parseError(data);
        assert(parsed && parsed.name === "ConditionFailed", "not ConditionFailed: " + (parsed && parsed.name));
        assert.equal(Number(parsed.args[0]), which, `wrong condition index`);
        return;
      }
      if (String(e.message).includes(`ConditionFailed(${which})`)) return;
      throw new Error("unexpected error: " + String(e.message).slice(0, 200));
    }
    throw new Error(`expected ConditionFailed(${which}) but call succeeded`);
  }

  beforeEach(async function () {
    [issuer, creator, alice, bob, carol, dave, erin] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockRegistryV2", issuer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", issuer);
    gate = await Gate.deploy(await mock.getAddress());
    const Bind = await ethers.getContractFactory("IdentityBindings", issuer);
    bindings = await Bind.deploy();
    const Apps = await ethers.getContractFactory("OneIDCampaignsV11", creator);
    apps = await Apps.deploy(await gate.getAddress(), await bindings.getAddress());
    // handles (bare lowercase labels, as the real registry stores them)
    await mock.connect(alice).registerHandle("aliceai");
    await mock.connect(bob).registerHandle("bobai");
    await mock.connect(carol).registerHandle("carolai");
    await mock.connect(dave).registerHandle("daveai");
    // erin holds an ID (passes the human gate) but has NO handle
    await mock.issue(erin.address);
  });

  async function createdId(tx) {
    const rc = await tx.wait();
    const ev = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } }).find(e => e && e.name === "CampaignCreated");
    return Number(ev.args.id);
  }

  async function raffle(cond, title = "r") {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    return createdId(await apps.connect(creator).createRaffle(title, now - 10, now + 3600, 1, ethers.ZeroAddress, 0n, cond, ""));
  }

  it("wiring: idRegistry is the gate's registry; plain campaigns behave like V9", async function () {
    assert.equal(await apps.idRegistry(), await mock.getAddress());
    assert.equal(await gate.registry(), await mock.getAddress());
    const id = await raffle(NO_COND);
    await apps.connect(alice).enterRaffle(id, [], []);
    assert.equal(await apps.hasEntered(id, alice.address), true);
    const cd = await apps.conditionsOf(id);
    assert.equal(cd.allowRoot, ethers.ZeroHash);
    assert.equal(cd.idListRoot, ethers.ZeroHash);
  });

  it("condition 5 (raffle): listed handle gets in; unlisted / handle-less / forged proof fail with ConditionFailed(5) and do not consume the entry", async function () {
    const handles = ["aliceai", "bobai", "carolai"];
    const id = await raffle({ ...NO_COND, idListRoot: idRoot(handles) });
    assert.equal((await apps.conditionsOf(id)).idListRoot, idRoot(handles));
    // human with a handle that is NOT on the list
    await expectCondition(apps.connect(dave).enterRaffle.staticCall(id, [], []), 5);
    await expectRevert(apps.connect(dave).enterRaffle(id, [], []), "ConditionFailed");
    assert.equal(await apps.hasEntered(id, dave.address), false);
    // human with NO handle at all
    await expectCondition(apps.connect(erin).enterRaffle.staticCall(id, [], []), 5);
    await expectRevert(apps.connect(erin).enterRaffle(id, [], []), "ConditionFailed");
    assert.equal(await apps.hasEntered(id, erin.address), false);
    // listed handle but someone else's proof (forged for this caller)
    await expectCondition(apps.connect(alice).enterRaffle.staticCall(id, [], idProof(handles, "bobai")), 5);
    assert.equal(await apps.hasEntered(id, alice.address), false);
    // listed handle, own proof — the earlier failures consumed nothing
    await apps.connect(alice).enterRaffle(id, [], idProof(handles, "aliceai"));
    assert.equal(await apps.hasEntered(id, alice.address), true);
    // the condition-4 proof slot is ignored while condition 4 is off
    await apps.connect(bob).enterRaffle(id, [ethers.ZeroHash], idProof(handles, "bobai"));
    assert.equal(await apps.hasEntered(id, bob.address), true);
    await apps.connect(carol).enterRaffle(id, [], idProof(handles, "carolai"));
    assert.equal(await apps.hasEntered(id, carol.address), true);
  });

  it("condition 5: single-handle list (root == leaf, empty proof)", async function () {
    const id = await raffle({ ...NO_COND, idListRoot: idRoot(["aliceai"]) });
    await apps.connect(alice).enterRaffle(id, [], []);
    assert.equal(await apps.hasEntered(id, alice.address), true);
    await expectRevert(apps.connect(bob).enterRaffle(id, [], []), "ConditionFailed");
  });

  it("condition 5 reads the handle live: the list binds the identity, not the address", async function () {
    const id = await raffle({ ...NO_COND, idListRoot: idRoot(["aliceai", "bobai"]) });
    // alice renames away from the listed handle -> no longer eligible
    await mock.connect(alice).registerHandle("alice2");
    await expectCondition(apps.connect(alice).enterRaffle.staticCall(id, [], idProof(["aliceai", "bobai"], "aliceai")), 5);
    // ... and back -> eligible again (the failed attempt consumed nothing)
    await mock.connect(alice).registerHandle("aliceai");
    await apps.connect(alice).enterRaffle(id, [], idProof(["aliceai", "bobai"], "aliceai"));
    assert.equal(await apps.hasEntered(id, alice.address), true);
  });

  it("conditions 4+5 together: each list is verified independently", async function () {
    const addrs = [alice.address, bob.address];           // bob passes 4, fails 5
    const handles = ["aliceai", "carolai"];               // carol passes 5, fails 4
    const id = await raffle({ ...NO_COND, allowRoot: addrRoot(addrs), idListRoot: idRoot(handles) });
    // alice is on both lists
    await apps.connect(alice).enterRaffle(id, addrProof(addrs, alice.address), idProof(handles, "aliceai"));
    assert.equal(await apps.hasEntered(id, alice.address), true);
    // bob: valid address proof, handle not listed -> ConditionFailed(5)
    await expectCondition(apps.connect(bob).enterRaffle.staticCall(id, addrProof(addrs, bob.address), []), 5);
    await expectRevert(apps.connect(bob).enterRaffle(id, addrProof(addrs, bob.address), []), "ConditionFailed");
    assert.equal(await apps.hasEntered(id, bob.address), false);
    // carol: valid identity proof, address not listed -> ConditionFailed(4) (checked first)
    await expectCondition(apps.connect(carol).enterRaffle.staticCall(id, [], idProof(handles, "carolai")), 4);
    assert.equal(await apps.hasEntered(id, carol.address), false);
    // dave: on neither list -> ConditionFailed(4)
    await expectCondition(apps.connect(dave).enterRaffle.staticCall(id, [], []), 4);
  });

  it("condition 5 also gates votes and claims", async function () {
    const handles = ["aliceai", "bobai", "carolai"];
    const cond = { ...NO_COND, idListRoot: idRoot(handles) };
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const v = await createdId(await apps.connect(creator).createVote("v", now - 10, now + 3600, 2, ethers.ZeroAddress, 0n, 0, cond, ["A", "B"]));
    await expectCondition(apps.connect(dave).castVote.staticCall(v, 0, [], []), 5);
    await apps.connect(bob).castVote(v, 1, [], idProof(handles, "bobai"));
    assert.equal(await apps.hasEntered(v, bob.address), true);
    assert.equal(await apps.tally(v, 1), 1n);
    const c = await createdId(await apps.connect(creator).createClaim("c", now - 10, now + 3600, 2, ethers.ZeroAddress, ethers.parseEther("0.002"), false, cond, { value: ethers.parseEther("0.002") }));
    // handle-less human cannot claim
    await expectCondition(apps.connect(erin).claim.staticCall(c, [], []), 5);
    assert.equal(await apps.hasEntered(c, erin.address), false);
    await apps.connect(alice).claim(c, [], idProof(handles, "aliceai"));
    assert.equal(await apps.hasEntered(c, alice.address), true);
    assert.equal((await apps.getCampaign(c)).paidOut, ethers.parseEther("0.001"));
  });
});
