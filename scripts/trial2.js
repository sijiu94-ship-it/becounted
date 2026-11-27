// Live trial of OneIDCampaignsV2 on BSC testnet:
// funded raffle (0.01 tBNB prize) -> enter -> draw -> claimPrize,
// plus a native claim campaign (0.006 pool / 3 shares) -> claim.
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const RPC = "https://bsc-testnet-rpc.publicnode.com";
const APPS = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "v2-address.json"), "utf8")).appsV2;

async function main() {
  const key = fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim();
  const provider = new ethers.JsonRpcProvider(RPC, 97, { staticNetwork: true });
  const wallet = new ethers.Wallet(key, provider);
  const art = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "artifacts", "contracts", "OneIDCampaignsV2.sol", "OneIDCampaignsV2.json"), "utf8"));
  const apps = new ethers.Contract(APPS, art.abi, wallet);
  const bal = async () => await provider.getBalance(wallet.address);

  const latest = await provider.getBlock("latest");
  const older = await provider.getBlock(latest.number - 200);
  const spb = (latest.timestamp - older.timestamp) / 200;
  console.log("block time ~", spb.toFixed(3), "s; block", latest.number);

  const start = latest.timestamp - 5;
  const end = latest.timestamp + 150;
  const seedBlock = latest.number + Math.ceil((end - latest.timestamp) / spb) + 40;
  const prize = ethers.parseEther("0.01");

  let tx = await apps.createRaffle("V2 Trial — escrowed 0.01 tBNB", start, end, 1, seedBlock, ethers.ZeroAddress, prize, { value: prize });
  await tx.wait();
  const raffleId = (await apps.campaignCount()) - 1n;
  console.log("raffle id", raffleId.toString(), "seedBlock", seedBlock);

  tx = await apps.enterRaffle(raffleId);
  await tx.wait();
  console.log("entered raffle");

  // Claim campaign: 0.006 tBNB pool, 3 shares of 0.002.
  const pool = ethers.parseEther("0.006");
  tx = await apps.createClaim("V2 Trial — one human one share", start, end + 3600, 3, ethers.ZeroAddress, pool, { value: pool });
  await tx.wait();
  const claimId = (await apps.campaignCount()) - 1n;
  const b0 = await bal();
  tx = await apps.claim(claimId);
  const rc = await tx.wait();
  const b1 = await bal();
  const gasCost = rc.gasUsed * rc.gasPrice;
  console.log("claimed share; net delta (incl gas):", ethers.formatEther(b1 - b0), "tBNB; payout minus gas =", ethers.formatEther(b1 - b0 + gasCost));

  console.log("waiting for raffle end + seed block...");
  for (;;) {
    const b = await provider.getBlock("latest");
    if (b.timestamp > end && b.number > seedBlock + 2) break;
    await new Promise(r => setTimeout(r, 10000));
  }
  tx = await apps.draw(raffleId);
  await tx.wait();
  console.log("drawn; isWinner:", await apps.isWinner(raffleId, wallet.address));
  const b2 = await bal();
  tx = await apps.claimPrize(raffleId);
  const rc2 = await tx.wait();
  const b3 = await bal();
  console.log("prize claimed; payout minus gas =", ethers.formatEther(b3 - b2 + rc2.gasUsed * rc2.gasPrice), "tBNB (expect 0.01)");
  const c = await apps.getCampaign(raffleId);
  console.log("raffle paidOut:", ethers.formatEther(c.paidOut), "reclaimed:", c.reclaimed);
}
main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
