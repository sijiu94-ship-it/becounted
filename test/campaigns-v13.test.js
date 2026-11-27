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
async function mine(n) { for (let i = 0; i < n; i++) await ethers.provider.send("evm_mine", []); }

const MAXU = ethers.MaxUint256;
const NO_COND = { requireBinding: false, gateToken: ethers.ZeroAddress, gateMin: 0n, gateIs721: false, requireEnteredId: MAXU, minStamps: 0, questRef: ethers.ZeroAddress, allowRoot: ethers.ZeroHash, idListRoot: ethers.ZeroHash };

const URL = "https://example.com/winner-form";
const NOTE = "中奖后请在此填写你的 API 账号邮箱";

describe("OneIDCampaignsV13 winner info link", function () {
  let mock, gate, bindings, apps, deployer, creator, alice, bob;

  beforeEach(async function () {
    [deployer, creator, alice, bob] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry", deployer);
    mock = await Mock.deploy();
    const Gate = await ethers.getContractFactory("BeCounted", deployer);
    gate = await Gate.deploy(await mock.getAddress());
    const Bind = await ethers.getContractFactory("IdentityBindingsV4", deployer);
    bindings = await Bind.deploy();
    const Apps = await ethers.getContractFactory("OneIDCampaignsV13", deployer);
    apps = await Apps.deploy(await gate.getAddress(), await bindings.getAddress());
    for (const u of [alice, bob]) await mock.issue(u.address);
  });

  async function makeRaffle(dur = 3600) {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const tx = await apps.connect(creator).createRaffle("api-prize", now - 10, now + dur, 1,
      ethers.ZeroAddress, 0n, NO_COND, "API credits x7");
    const rc = await tx.wait();
    return Number(rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "CampaignCreated").args.id);
  }

  it("creator sets winner info; getters return url + note; event emitted", async function () {
    const id = await makeRaffle();
    const tx = await apps.connect(creator).setWinnerInfo(id, URL, NOTE);
    const rc = await tx.wait();
    const ev = rc.logs.map(l => { try { return apps.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "WinnerInfoSet");
    assert.ok(ev, "WinnerInfoSet event");
    assert.equal(await apps.winnerInfoUrl(id), URL);
    assert.equal(await apps.winnerInfoNote(id), NOTE);
  });

  it("non-creator cannot set winner info", async function () {
    const id = await makeRaffle();
    await expectRevert(apps.connect(alice).setWinnerInfo(id, URL, NOTE), "NotCreator");
    assert.equal(await apps.winnerInfoUrl(id), "");
  });

  it("nonexistent campaign reverts", async function () {
    // _campaigns is an array: an out-of-range id panics (0x32) before the
    // creator check — same as setPostUrl. What matters: it always reverts.
    await expectRevert(apps.connect(creator).setWinnerInfo(999, URL, NOTE));
  });

  it("rejects non-https url, over-long url and over-long note", async function () {
    const id = await makeRaffle();
    await expectRevert(apps.connect(creator).setWinnerInfo(id, "http://example.com/f", NOTE), "BadParams");
    await expectRevert(apps.connect(creator).setWinnerInfo(id, "https://" + "a".repeat(195), NOTE), "BadParams");
    await expectRevert(apps.connect(creator).setWinnerInfo(id, URL, "x".repeat(201)), "BadParams");
    // exactly 200 bytes each is fine
    await apps.connect(creator).setWinnerInfo(id, "https://" + "a".repeat(192), "x".repeat(200));
    assert.equal((await apps.winnerInfoUrl(id)).length, 200);
  });

  it("creator can update the link, and clear both fields with an empty url", async function () {
    const id = await makeRaffle();
    await apps.connect(creator).setWinnerInfo(id, URL, NOTE);
    await apps.connect(creator).setWinnerInfo(id, "https://example.com/v2", "新说明");
    assert.equal(await apps.winnerInfoUrl(id), "https://example.com/v2");
    assert.equal(await apps.winnerInfoNote(id), "新说明");
    await apps.connect(creator).setWinnerInfo(id, "", "这条说明应被一并清掉");
    assert.equal(await apps.winnerInfoUrl(id), "");
    assert.equal(await apps.winnerInfoNote(id), "");
  });

  it("end to end: prizeLabel raffle draws and the winner info stays readable", async function () {
    const id = await makeRaffle(600);
    await apps.connect(creator).setWinnerInfo(id, URL, NOTE);
    await apps.connect(alice).enterRaffle(id, [], []);
    await apps.connect(bob).enterRaffle(id, [], []);
    await warp(601);
    await apps.lockDraw(id);
    await mine(3);
    await apps.draw(id);
    const winners = await apps.getWinners(id);
    assert.equal(winners.length, 1);
    assert.ok([alice.address.toLowerCase(), bob.address.toLowerCase()].includes(winners[0].toLowerCase()));
    assert.equal(await apps.winnerInfoUrl(id), URL);
    assert.equal(await apps.winnerInfoNote(id), NOTE);
  });
});
