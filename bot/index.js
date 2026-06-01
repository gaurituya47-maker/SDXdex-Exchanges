const { ethers } = require("ethers");
const chalk = require("chalk");
const dotenv = require("dotenv");
const { findArbitrageOpportunity, TOKEN_LIST } = require("./dexScanner");
const { executeArbitrage } = require("./executor");

dotenv.config();

const RPC_URL = process.env.MAINNET_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const MIN_PROFIT = process.env.MIN_PROFIT || "0.1";

const PAIRS = [
  ["USDC", "WETH"],
  ["USDC", "WBTC"],
  ["USDT", "WETH"],
  ["DAI", "WETH"],
];

const TOKEN_DECIMALS = {
  USDC: 6,
  USDT: 6,
  WETH: 18,
  DAI: 18,
  WBTC: 8,
};

const CONTRACT_ABI = require("../artifacts/contracts/FlashLoanArbitrage.sol/FlashLoanArbitrage.json").abi;

let totalProfit = 0n;
let txCount = 0;

async function main() {
  if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
    console.error(chalk.red("Missing MAINNET_RPC_URL, PRIVATE_KEY or CONTRACT_ADDRESS in .env"));
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

  console.log(chalk.cyan("Flash Arb Bot started"));
  console.log("Scanning pairs every 3000ms...");

  setInterval(async () => {
    for (const [borrowSymbol, targetSymbol] of PAIRS) {
      try {
        const tokenBorrow = TOKEN_LIST[borrowSymbol];
        const tokenTarget = TOKEN_LIST[targetSymbol];
        const borrowAmount = "10000";

        const opportunity = await findArbitrageOpportunity(tokenBorrow, tokenTarget, borrowAmount, RPC_URL);
        if (!opportunity) {
          console.log(chalk.gray(`No opportunity for ${borrowSymbol}/${targetSymbol}`));
          continue;
        }

        const borrowDecimals = TOKEN_DECIMALS[borrowSymbol] ?? 18;
        const profitValue = Number(ethers.formatUnits(opportunity.profit, borrowDecimals));
        if (profitValue < Number(MIN_PROFIT)) {
          console.log(chalk.yellow(`Opportunity below minProfit for ${borrowSymbol}/${targetSymbol}: ${profitValue} ${borrowSymbol}`));
          continue;
        }

        const params = {
          tokenBorrow,
          tokenTarget,
          borrowAmount: ethers.parseUnits(borrowAmount, borrowDecimals),
          buyDex: opportunity.buyDexIndex,
          sellDex: opportunity.sellDexIndex,
          v3FeeBuy: 3000,
          v3FeeSell: 3000,
          minProfit: opportunity.profit,
        };

        console.log(chalk.blue("Executing arbitrage:"), borrowSymbol, "->", targetSymbol, "profit", ethers.formatUnits(opportunity.profit, borrowDecimals));
        const receipt = await executeArbitrage(contract, params);
        totalProfit += opportunity.profit;
        txCount += 1;
        console.log(chalk.green(`Total Profit: ${ethers.formatUnits(totalProfit, 18)} | Tx Count: ${txCount}`));
      } catch (error) {
        const message = error?.message || "Unknown error";
        if (message.includes("InsufficientProfit") || message.includes("MinProfitNotMet")) {
          console.log(chalk.yellow("Skipped failing arbitrage execution:"), message);
          continue;
        }
        console.error(chalk.red("Scanner error:"), message);
      }
    }
  }, 3000);
}

main().catch((error) => {
  console.error(chalk.red("Fatal bot error:"), error);
  process.exit(1);
});
