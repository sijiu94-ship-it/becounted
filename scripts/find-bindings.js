const { ethers } = require("ethers");
const fs = require("fs"), path = require("path");
(async () => {
  const p = new ethers.JsonRpcProvider("https://bsc-testnet-rpc.publicnode.com", 97, { staticNetwork: true });
  const dep = "0x09385E06bDFa5772B90f7542d1d9FDD1B1d0DF38";
  const nonce = await p.getTransactionCount(dep, "latest");
  console.log("current nonce:", nonce);
  const j = JSON.parse(fs.readFileSync("artifacts/contracts/IdentityBindingsV2.sol/IdentityBindingsV2.json", "utf8"));
  for (let n = Math.max(0, nonce - 3); n < nonce; n++) {
    const addr = ethers.getCreateAddress({ from: dep, nonce: n });
    const code = await p.getCode(addr);
    if (code.length > 2) {
      const c = new ethers.Contract(addr, j.abi, p);
      let reg = "?"; try { reg = await c.registrar(); } catch (e) {}
      console.log("nonce", n, "-> contract at", addr, "codeBytes:", (code.length - 2) / 2, "registrar:", reg);
    } else console.log("nonce", n, "-> no code at", addr);
  }
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
