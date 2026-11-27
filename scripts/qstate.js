const { ethers } = require("ethers");
const fs = require("fs");
(async () => {
  const p = new ethers.JsonRpcProvider("https://bsc-testnet-rpc.publicnode.com", 97, { staticNetwork: true });
  const abi = JSON.parse(fs.readFileSync("artifacts/contracts/QuestPass.sol/QuestPass.json", "utf8")).abi;
  const q = new ethers.Contract("0x90c3320557db7540a5899e7d3bc0577e399ec378", abi, p);
  const dep = "0x09385E06bDFa5772B90f7542d1d9FDD1B1d0DF38";
  const f = (ts) => new Date(Number(ts) * 1000).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  console.log("phase:", (await q.phase()).toString(), "| currentDay:", (await q.currentDay()).toString());
  console.log("startAt:", f(await q.startAt()), "| stampEnd:", f(await q.stampEnd()), "| entryEnd:", f(await q.entryEnd()));
  console.log("deployer stamps:", (await q.stampCount(dep)).toString(), "| minStamps:", (await q.minStamps()).toString(), "| eligible:", await q.eligible(dep));
  console.log("finaleDrawn:", await q.finaleDrawn(), "| finaleEntries:", (await q.finaleEntryCount()).toString());
  for (let d = 0; d < 7; d++) console.log("day", d, "claims:", (await q.dayClaims(d)).toString());
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
