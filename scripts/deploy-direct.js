// Direct deploy with plain ethers (no Hardhat runtime) — explicit logging
// at each step so a hang is visible immediately.
// Usage: node scripts/deploy-direct.js testnet|mainnet
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const REAL_REGISTRY = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
const NETS = {
  testnet: { rpc: "https://bsc-testnet.publicnode.com", chainId: 97 },
  mainnet: { rpc: "https://bsc-dataseed.binance.org", chainId: 56 },
};

function artifact(name) {
  const p = path.join(
    __dirname, "..", "artifacts", "contracts",
    name === "MockAgentIdRegistry" ? "mocks" : "",
    name + ".sol", name + ".json"
  );
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: j.abi, bytecode: j.bytecode };
}

async function deploy(provider, wallet, name, args) {
  const { abi, bytecode } = artifact(name);
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  console.log(`deploying ${name} ...`);
  const c = await factory.deploy(...args);
  const tx = c.deploymentTransaction();
  console.log(`  tx: ${tx.hash}`);
  await tx.wait(1);
  const addr = await c.getAddress();
  console.log(`  ${name}: ${addr}`);
  return addr;
}

async function main() {
  const which = process.argv[2] || "testnet";
  const net = NETS[which];
  const key = fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim();
  const provider = new ethers.JsonRpcProvider(net.rpc, net.chainId, { staticNetwork: true });
  const wallet = new ethers.Wallet(key, provider);
  console.log("network:", which, net.chainId, "deployer:", wallet.address);
  const bal = await provider.getBalance(wallet.address);
  console.log("balance:", ethers.formatEther(bal));
  if (bal === 0n) throw new Error("zero balance, fund the deployer first");

  let registry = REAL_REGISTRY;
  if (net.chainId === 97) {
    registry = await deploy(provider, wallet, "MockAgentIdRegistry", []);
  }
  const gate = await deploy(provider, wallet, "BeCounted", [registry]);
  const apps = await deploy(provider, wallet, "OneIDCampaigns", [gate]);
  console.log(JSON.stringify({ network: which, registry, gate, apps }, null, 2));
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
});
