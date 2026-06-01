const chalk = require("chalk");

/**
 * @param {import("ethers").Contract} contract
 * @param {object} params
 */
async function executeArbitrage(contract, params) {
  try {
    const tx = await contract.executeArbitrage(params);
    const receipt = await tx.wait();
    console.log(chalk.green("Arbitrage tx confirmed:"), receipt.transactionHash);
    return receipt;
  } catch (error) {
    console.error(chalk.red("Executor error:"), error.message || error);
    throw error;
  }
}

module.exports = {
  executeArbitrage,
};
