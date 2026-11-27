const { ethers } = require("hardhat");
const assert = require("assert");

async function expectRevert(p, errName) {
  try { await p; } catch (e) {
    if (errName && !String(e.message).includes(errName)) throw new Error(`reverted but not with ${errName}: ${String(e.message).slice(0, 160)}`);
    return;
  }
  throw new Error(`expected revert ${errName || ""} but call succeeded`);
}

const LINKS2 = [
  { title: "X", url: "https://x.com/jiusi" },
  { title: "Blog", url: "https://example.com/blog" },
];

describe("IdentityProfile", function () {
  let profile, issuer, alice, bob;

  beforeEach(async function () {
    [issuer, alice, bob] = await ethers.getSigners();
    const P = await ethers.getContractFactory("IdentityProfile", issuer);
    profile = await P.deploy();
  });

  it("sets and reads back a profile; unset address reads empty", async function () {
    const [bio0, links0, at0] = await profile.profileOf(alice.address);
    assert.equal(bio0, "");
    assert.equal(links0.length, 0);
    assert.equal(at0, 0n);

    const rc = await (await profile.connect(alice).setProfile("DeFi dabbler, card-carrying human.", LINKS2)).wait();
    const ev = rc.logs.map(l => { try { return profile.interface.parseLog(l); } catch (e) { return null; } }).find(p => p && p.name === "ProfileSet");
    assert.ok(ev, "ProfileSet event emitted");
    assert.equal(ev.args.who, alice.address);
    assert.equal(ev.args.linkCount, 2n);

    const [bio, links, at] = await profile.profileOf(alice.address);
    assert.equal(bio, "DeFi dabbler, card-carrying human.");
    assert.equal(links.length, 2);
    assert.equal(links[0].title, "X");
    assert.equal(links[0].url, "https://x.com/jiusi");
    assert.equal(links[1].title, "Blog");
    assert.ok(at > 0n);
  });

  it("re-setting overwrites bio and links (old links are gone)", async function () {
    await profile.connect(alice).setProfile("v1", LINKS2);
    await profile.connect(alice).setProfile("v2", [{ title: "Site", url: "https://example.com" }]);
    const [bio, links] = await profile.profileOf(alice.address);
    assert.equal(bio, "v2");
    assert.equal(links.length, 1);
    assert.equal(links[0].title, "Site");
  });

  it("removeProfile clears everything", async function () {
    await profile.connect(alice).setProfile("gone soon", LINKS2);
    await profile.connect(alice).removeProfile();
    const [bio, links, at] = await profile.profileOf(alice.address);
    assert.equal(bio, "");
    assert.equal(links.length, 0);
    assert.equal(at, 0n);
  });

  it("rejects more than 5 links", async function () {
    const six = Array.from({ length: 6 }, (_, i) => ({ title: `L${i}`, url: "https://example.com" }));
    await expectRevert(profile.connect(alice).setProfile("ok", six), "TooManyLinks");
    const five = six.slice(0, 5);
    await profile.connect(alice).setProfile("ok", five);
    const [, links] = await profile.profileOf(alice.address);
    assert.equal(links.length, 5);
  });

  it("rejects non-https URLs (http, bare domain, empty)", async function () {
    await expectRevert(profile.connect(alice).setProfile("ok", [{ title: "A", url: "http://example.com" }]), "BadUrl");
    await expectRevert(profile.connect(alice).setProfile("ok", [{ title: "A", url: "example.com" }]), "BadUrl");
    await expectRevert(profile.connect(alice).setProfile("ok", [{ title: "A", url: "" }]), "BadUrl");
  });

  it("rejects an over-long bio and an over-long link title", async function () {
    await expectRevert(profile.connect(alice).setProfile("x".repeat(161), []), "BioTooLong");
    await profile.connect(alice).setProfile("x".repeat(160), []);
    await expectRevert(profile.connect(alice).setProfile("ok", [{ title: "t".repeat(41), url: "https://example.com" }]), "TitleTooLong");
  });

  it("profiles are per-address: setting one never touches another", async function () {
    await profile.connect(alice).setProfile("alice here", LINKS2);
    const [bioB, linksB] = await profile.profileOf(bob.address);
    assert.equal(bioB, "");
    assert.equal(linksB.length, 0);
    await profile.connect(bob).setProfile("bob here", []);
    const [bioA, linksA] = await profile.profileOf(alice.address);
    assert.equal(bioA, "alice here");
    assert.equal(linksA.length, 2);
    await profile.connect(bob).removeProfile();
    const [bioA2] = await profile.profileOf(alice.address);
    assert.equal(bioA2, "alice here");
  });
});
