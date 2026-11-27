// Deploy BeCounted + OneIDCampaigns.
// - On BSC testnet (chainId 97) there is no real Agent ID registry, so a
//   MockAgentIdRegistry is deployed first and the gate points at it.
// - On BSC mainnet (chainId 56) the gate points at the real registry:
//   0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F (SPACE ID Agent ID).
const { ethers } = require("hardhat");

const REAL_REGISTRY = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  console.log("network:", net.chainId.toString(), "deployer:", deployer.address);

  let registryAddr = REAL_REGISTRY;
  if (net.chainId === 97n) {
    const Mock = await ethers.getContractFactory("MockAgentIdRegistry");
    const mock = await Mock.deploy();
    await mock.waitForDeployment();
    registryAddr = await mock.getAddress();
    console.log("MockAgentIdRegistry:", registryAddr);
  }

  const Gate = await ethers.getContractFactory("BeCounted");
  const gate = await Gate.deploy(registryAddr);
  await gate.waitForDeployment();
  const gateAddr = await gate.getAddress();
  console.log("BeCounted:", gateAddr, "(registry:", registryAddr + ")");

  const Apps = await ethers.getContractFactory("OneIDCampaigns");
  const apps = await Apps.deploy(gateAddr);
  await apps.waitForDeployment();
  console.log("OneIDCampaigns:", await apps.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
