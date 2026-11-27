require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-verify");
const fs = require("fs");
const path = require("path");

// Deployer key is read from a local, git-ignored file — never commit it.
// Testnet phase uses a dedicated throwaway wallet (see keys/README).
function deployerKey() {
  const f = path.join(__dirname, "keys", "deployer.key");
  if (fs.existsSync(f)) return [fs.readFileSync(f, "utf8").trim()];
  return [];
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  // BscScan verification goes through the Etherscan V2 unified API.
  // The key is read from the environment at verify time — never stored in files.
  // Rehearsed 2026-11-23: the same std-JSON inputs verified all three core
  // testnet contracts with an exact match on Sourcify (fallback route, no key).
  etherscan: { apiKey: process.env.ETHERSCAN_API_KEY || "" },
  networks: {
    bsctestnet: {
      url: "https://bsc-testnet.publicnode.com",
      chainId: 97,
      accounts: deployerKey(),
    },
    bsc: {
      url: "https://bsc-dataseed.binance.org",
      chainId: 56,
      accounts: deployerKey(),
    },
  },
};
