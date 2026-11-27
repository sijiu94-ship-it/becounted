// Deploy by signing locally and broadcasting the raw tx through several
// public endpoints (the first BSC testnet endpoint we tried accepted the
// tx into its own mempool but never propagated it — nonce stayed 0).
// Usage: node scripts/deploy-raw.js testnet
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const READ_RPC = "https://bsc-testnet-rpc.publicnode.com";
const SEND_RPCS = [
  "https://bnb-testnet.api.onfinality.io/public",
  "https://bsc-testnet-rpc.publicnode.com",
  "https://bsc-testnet.publicnode.com",
];

function artifact(name) {
  const p = path.join(
    __dirname, "..", "artifacts", "contracts",
    name === "MockAgentIdRegistry" ? "mocks" : "",
    name + ".sol", name + ".json"
  );
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: j.abi, bytecode: j.bytecode };
}

async function rpc(url, method, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(method + " @ " + url + ": " + JSON.stringify(j.error));
  return j.result;
}

async function broadcast(raw) {
  let hash = null;
  for (const url of SEND_RPCS) {
    try {
      hash = await rpc(url, "eth_sendRawTransaction", [raw]);
      console.log("  broadcast via", url, "->", hash);
      return hash;
    } catch (e) {
      console.log("  send failed via", url, "-", e.message.slice(0, 120));
    }
  }
  throw new Error("all broadcast endpoints failed");
}

async function waitReceipt(hash) {
  for (let i = 0; i < 60; i++) {
    const rc = await rpc(READ_RPC, "eth_getTransactionReceipt", [hash]);
    if (rc) return rc;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("receipt timeout for " + hash);
}

async function main() {
  const key = fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim();
  const wallet = new ethers.Wallet(key);
  const provider = new ethers.JsonRpcProvider(READ_RPC, 97, { staticNetwork: true });
  console.log("deployer:", wallet.address);
  let nonce = await provider.getTransactionCount(wallet.address, "latest");
  console.log("starting nonce:", nonce);
  const gasPrice = (await provider.getFeeData()).gasPrice ?? 1000000000n;

  async function deploy(name, args) {
    const { abi, bytecode } = artifact(name);
    const factory = new ethers.ContractFactory(abi, bytecode);
    const deployTx = await factory.getDeployTransaction(...args);
    const gasLimit = (BigInt(deployTx.gasLimit ?? 0) || 3000000n);
    const tx = {
      to: null,
      data: deployTx.data,
      nonce: nonce,
      gasLimit: gasLimit === 0n ? 3000000n : gasLimit,
      gasPrice: gasPrice,
      chainId: 97,
      type: 0,
    };
    const raw = await wallet.signTransaction(tx);
    const expected = ethers.getCreateAddress({ from: wallet.address, nonce });
    console.log(`deploying ${name} (nonce ${nonce}) -> ${expected}`);
    const hash = await broadcast(raw);
    const rc = await waitReceipt(hash);
    if (rc.status !== "0x1") throw new Error(name + " deploy reverted");
    console.log(`  confirmed in block ${parseInt(rc.blockNumber, 16)}, contract: ${rc.contractAddress}`);
    nonce += 1;
    return rc.contractAddress;
  }

  const registry = await deploy("MockAgentIdRegistry", []);
  const gate = await deploy("BeCounted", [registry]);
  const apps = await deploy("OneIDCampaigns", [gate]);
  console.log(JSON.stringify({ network: "bsctestnet", registry, gate, apps }, null, 2));
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
});
