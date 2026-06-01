const hre = require("hardhat");

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("CONTRACT_ADDRESS environment variable is required for verification");
  }

  await hre.run("verify:verify", {
    address: contractAddress,
    constructorArguments: ["0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e"],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
