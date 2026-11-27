const { ethers } = require("hardhat");

async function expectRevert(p, why) {
  try {
    await p;
    throw new Error("expected revert: " + why);
  } catch (e) {
    if (e.message.startsWith("expected revert")) throw e;
  }
}

async function main() {
  const [issuer, alice, bob, carol, mallory] = await ethers.getSigners();

  const Mock = await ethers.getContractFactory("MockAgentIdRegistry");
  const mock = await Mock.deploy();
  const Gate = await ethers.getContractFactory("BeCounted");
  const gate = await Gate.deploy(await mock.getAddress());
  const Apps = await ethers.getContractFactory("OneIDCampaigns");
  const apps = await Apps.deploy(await gate.getAddress());

  // Issue test IDs to alice, bob, carol. Mallory has none.
  for (const u of [alice, bob, carol]) await mock.issue(u.address);
  console.log("isHuman(alice) =", await gate.isHuman(alice.address));
  console.log("isHuman(mallory) =", await gate.isHuman(mallory.address));

  const now = (await ethers.provider.getBlock("latest")).timestamp;
  const blockNow = await ethers.provider.getBlockNumber();

  // --- Raffle ---
  const tx = await apps.createRaffle("test draw", now - 10, now + 3600, 2, blockNow + 20);
  await tx.wait();
  await apps.connect(alice).enterRaffle(0);
  await apps.connect(bob).enterRaffle(0);
  await apps.connect(carol).enterRaffle(0);
  await expectRevert(apps.connect(alice).enterRaffle(0), "double entry must revert");
  await expectRevert(apps.connect(mallory).enterRaffle(0), "non-human must revert");
  console.log("raffle entries:", (await apps.getEntries(0)).length);

  // --- Vote ---
  await (await apps.createVote("test vote", now - 10, now + 3600, 3)).wait();
  await apps.connect(alice).castVote(1, 0);
  await apps.connect(bob).castVote(1, 0);
  await apps.connect(carol).castVote(1, 2);
  console.log(
    "vote tally:",
    (await apps.tally(1, 0)).toString(),
    (await apps.tally(1, 1)).toString(),
    (await apps.tally(1, 2)).toString()
  );

  // Fast-forward past endAt and seedBlock, then draw.
  await ethers.provider.send("evm_increaseTime", [3700]);
  await ethers.provider.send("evm_mine", []);
  for (let i = 0; i < 25; i++) await ethers.provider.send("evm_mine", []);
  await apps.draw(0);
  const winners = await apps.getWinners(0);
  console.log("winners:", winners);
  if (winners.length !== 2) throw new Error("expected 2 winners");
  const entries = await apps.getEntries(0);
  for (const w of winners) if (!entries.includes(w)) throw new Error("winner not in entries");
  if (new Set(winners).size !== winners.length) throw new Error("duplicate winner");

  console.log("ALL FLOW TESTS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
