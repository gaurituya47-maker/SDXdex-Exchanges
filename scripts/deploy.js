const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const FlashLoanArbitrage = await hre.ethers.getContractFactory("FlashLoanArbitrage");
  const poolAddressesProvider = "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e";

  const flashLoanArbitrage = await FlashLoanArbitrage.deploy(poolAddressesProvider);
  await flashLoanArbitrage.deployed();

  console.log("FlashLoanArbitrage deployed to:", flashLoanArbitrage.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
