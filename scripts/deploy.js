import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const { ethers, network } = hre;

  const ReliefPool = await ethers.getContractFactory("ReliefPool");
  const reliefPool = await ReliefPool.deploy();

  await reliefPool.waitForDeployment();

  const address = await reliefPool.getAddress();
  const tx = reliefPool.deploymentTransaction();
  const txHash = tx && tx.hash ? tx.hash : "N/A";

  const networkName = network.name;

  console.log("ReliefPool deployed:");
  console.log("  Network:", networkName);
  console.log("  Address:", address);
  console.log("  Tx Hash:", txHash);

  if (networkName === "sepolia") {
    console.log(
      "  Etherscan:",
      `https://sepolia.etherscan.io/address/${address}`
    );
  }

  const outputPath = path.join(__dirname, "..", "deployedAddress.json");

  const payload = {
    address,
    network: networkName
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");

  console.log("deployedAddress.json written at", outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});