const { ethers } = require("ethers");

const AGGREGATORS = {
  USDC: null,
  USDT: null,
  WETH: "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419f",
  DAI: null,
  WBTC: "0xf4030086522a5beea4988f8ca5b36dbc97bee88c",
};

const PRICE_ABI = [
  "function latestAnswer() view returns (int256)",
  "function decimals() view returns (uint8)",
];

/**
 * @param {string} rpcUrl
 * @param {string} symbol
 */
async function getTokenPrice(rpcUrl, symbol) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  if (symbol === "USDC" || symbol === "USDT" || symbol === "DAI") {
    return 1.0;
  }

  const aggregatorAddress = AGGREGATORS[symbol];
  if (!aggregatorAddress) {
    throw new Error(`No price oracle configured for ${symbol}`);
  }

  const aggregator = new ethers.Contract(aggregatorAddress, PRICE_ABI, provider);
  const answer = await aggregator.latestAnswer();
  const decimals = await aggregator.decimals();
  return Number(answer) / 10 ** decimals;
}

/**
 * @param {string} rpcUrl
 * @param {Array<string>} symbols
 */
async function getTokenPrices(rpcUrl, symbols) {
  const prices = {};
  for (const symbol of symbols) {
    prices[symbol] = await getTokenPrice(rpcUrl, symbol);
  }
  return prices;
}

module.exports = {
  getTokenPrice,
  getTokenPrices,
};
