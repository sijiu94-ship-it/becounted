const { ethers } = require("ethers");
const fs = require("fs");
(async () => {
  const p = new ethers.JsonRpcProvider("https://bsc-testnet-rpc.publicnode.com", 97, { staticNetwork: true });
  const abi = JSON.parse(fs.readFileSync("artifacts/contracts/OneIDCampaignsV9.sol/OneIDCampaignsV9.json", "utf8")).abi;
  const apps = new ethers.Contract("0x1ebff25f093c798ea301008b13c54fbc00348aec", abi, p);
  const t0 = Date.now();
  const n = Number(await apps.campaignCount());
  const humans = new Set(); let payouts = 0;
  for (let i = 0; i < n; i++) {
    const c = await apps.getCampaign(i);
    const entries = await apps.getEntries(i);
    for (const a of entries) humans.add(a);
    if (Number(c.kind) === 2) payouts += entries.length;
    else if (c.drawn) {
      const winners = await apps.getWinners(i);
      for (const w of winners) { if (await apps.prizeClaimed(i, w)) payouts++; }
    }
  }
  console.log("campaigns:", n, "| humans:", humans.size, "| payouts:", payouts, "| elapsed:", Date.now() - t0, "ms");
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
