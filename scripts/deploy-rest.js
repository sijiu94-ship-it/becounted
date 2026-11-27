// Deploy BeCounted + OneIDCampaigns on BSC testnet, resuming after the
// Mock registry (0xdA585A4aE5b73Ee2728AadA3e877A3A1F84027cd, nonce 0).
// A previous nonce-1 slot was consumed by a duplicate Mock deployment,
// so this script verifies runtime code length + live calls after each
// deploy before continuing.
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const READ_RPC = "https://bsc-testnet-rpc.publicnode.com";
const SEND_RPCS = [
  "https://bsc-testnet-rpc.publicnode.com",
  "https://bnb-testnet.api.onfinality.io/public",
  "https://bsc-testnet.publicnode.com",
];
const REGISTRY = "0xdA585A4aE5b73Ee2728AadA3e877A3A1F84027cd";

function artifact(name) {
  const p = path.join(__dirname, "..", "artifacts", "contracts", name + ".sol", name + ".json");
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: j.abi, bytecode: j.bytecode, runtimeBytes: (j.deployedBytecode.length - 2) / 2 };
}

async function rpc(url, method, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(method + ": " + JSON.stringify(j.error));
  return j.result;
}

async function broadcast(raw) {
  let last;
  for (const url of SEND_RPCS) {
    try {
      const h = await rpc(url, "eth_sendRawTransaction", [raw]);
      console.log("  broadcast via", url);
      return h;
    } catch (e) {
      last = e;
      console.log("  send issue via", url, "-", e.message.slice(0, 100));
      // If the error says the nonce is already used, another endpoint
      // accepted it first — treat as broadcast and let receipt polling decide.
      if (/nonce too low|already known/i.test(e.message)) return ethers.keccak256(raw);
    }
  }
  throw last ?? new Error("broadcast failed");
}

async function waitReceipt(hash) {
  for (let i = 0; i < 40; i++) {
    const rc = await rpc(READ_RPC, "eth_getTransactionReceipt", [hash]);
    if (rc) return rc;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("receipt timeout " + hash);
}

async function main() {
  const key = fs.readFileSync(path.join(__dirname, "..", "keys", "deployer.key"), "utf8").trim();
  const wallet = new ethers.Wallet(key);
  const provider = new ethers.JsonRpcProvider(READ_RPC, 97, { staticNetwork: true });
  let nonce = await provider.getTransactionCount(wallet.address, "latest");
  console.log("deployer:", wallet.address, "nonce:", nonce);
  const gasPrice = (await provider.getFeeData()).gasPrice ?? 1000000000n;

  async function deploy(name, args) {
    const { abi, bytecode, runtimeBytes } = artifact(name);
    const factory = new ethers.ContractFactory(abi, bytecode);
    const deployTx = await factory.getDeployTransaction(...args);
    console.log(`deploying ${name}: creation data ${(deployTx.data.length - 2) / 2} bytes, expect runtime ${runtimeBytes} bytes`);
    const tx = { to: null, data: deployTx.data, nonce, gasLimit: 4000000n, gasPrice, chainId: 97, type: 0 };
    const raw = await wallet.signTransaction(tx);
    const hash = await broadcast(raw);
    console.log("  tx:", hash);
    const rc = await waitReceipt(hash);
    if (rc.status !== "0x1") throw new Error(name + " reverted");
    const code = await rpc(READ_RPC, "eth_getCode", [rc.contractAddress, "latest"]);
    const bytes = (code.length - 2) / 2;
    console.log(`  confirmed: ${rc.contractAddress} (runtime ${bytes} bytes)`);
    if (bytes !== runtimeBytes) throw new Error(`${name} runtime size mismatch: got ${bytes}, want ${runtimeBytes}`);
    nonce += 1;
    return rc.contractAddress;
  }

  const gate = await deploy("BeCounted", [REGISTRY]);

  // Live checks on the gate before building on it.
  const reg = await rpc(READ_RPC, "eth_call", [{ to: gate, data: "0x7b103999" }, "latest"]);
  console.log("gate.registry():", reg);
  if (!reg.toLowerCase().includes(REGISTRY.slice(2).toLowerCase())) throw new Error("registry mismatch");
  const ih = await rpc(READ_RPC, "eth_call", [
    { to: gate, data: "0xf72c436f" + "000000000000000000000000" + wallet.address.slice(2).toLowerCase() },
    "latest",
  ]);
  console.log("gate.isHuman(deployer, no ID yet):", ih);

  const apps = await deploy("OneIDCampaigns", [gate]);
  const g = await rpc(READ_RPC, "eth_call", [{ to: apps, data: "0x7a0ebc88" }, "latest"]);
  console.log("apps.gate():", g);
  if (!g.toLowerCase().includes(gate.slice(2).toLowerCase())) throw new Error("apps gate mismatch");
  const cc = await rpc(READ_RPC, "eth_call", [{ to: apps, data: "0x7274e30d" }, "latest"]);
  console.log("apps.campaignCount():", cc);
  console.log(JSON.stringify({ network: "bsctestnet", registry: REGISTRY, gate, apps }, null, 2));
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
});
