const { ethers } = require("ethers");

const V2_ROUTERS = [
  {
    name: "UniswapV2",
    address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  },
  {
    name: "SushiSwap",
    address: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
  },
  {
    name: "PancakeSwap",
    address: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
  },
];

const TOKEN_LIST = {
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
};

const TOKEN_DECIMALS = {
  USDC: 6,
  USDT: 6,
  WETH: 18,
  DAI: 18,
  WBTC: 8,
};

const V2_ROUTER_ABI = [
  "function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts)",
];

const dexNameToIndex = {
  UniswapV2: 0,
  SushiSwap: 1,
  PancakeSwap: 2,
};

/**
 * @param {string} tokenBorrow
 * @param {string} tokenTarget
 * @param {string | number | bigint} borrowAmount
 * @param {string} rpcUrl
 */
async function findArbitrageOpportunity(tokenBorrow, tokenTarget, borrowAmount, rpcUrl) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const borrowSymbol = Object.keys(TOKEN_LIST).find((symbol) => TOKEN_LIST[symbol] === tokenBorrow);
  const tokenDecimals = TOKEN_DECIMALS[borrowSymbol] ?? 18;
  const parsedAmount = ethers.parseUnits(borrowAmount.toString(), tokenDecimals);

  const buyPromises = V2_ROUTERS.map(async (router) => {
    const contract = new ethers.Contract(router.address, V2_ROUTER_ABI, provider);
    const path = [tokenBorrow, tokenTarget];
    const result = await contract.getAmountsOut(parsedAmount, path);
    return {
      dex: router.name,
      amountOut: result[result.length - 1],
    };
  });

  const sellPromises = V2_ROUTERS.map(async (router) => {
    const contract = new ethers.Contract(router.address, V2_ROUTER_ABI, provider);
    const path = [tokenTarget, tokenBorrow];
    const result = await contract.getAmountsOut(parsedAmount, path);
    return {
      dex: router.name,
      amountOut: result[result.length - 1],
    };
  });

  const buyResults = await Promise.allSettled(buyPromises);
  const sellResults = await Promise.allSettled(sellPromises);

  const validBuys = buyResults
    .filter((res) => res.status === "fulfilled")
    .map((res) => res.value);
  const validSells = sellResults
    .filter((res) => res.status === "fulfilled")
    .map((res) => res.value);

  if (validBuys.length === 0 || validSells.length === 0) {
    return null;
  }

  const bestBuy = validBuys.reduce((prev, current) =>
    current.amountOut > prev.amountOut ? current : prev
  );
  const bestSell = validSells.reduce((prev, current) =>
    current.amountOut > prev.amountOut ? current : prev
  );

  const borrowAmountParsed = parsedAmount;
  const repayAmount = borrowAmountParsed * 10009n / 10000n;
  const profit = bestSell.amountOut - repayAmount;

  if (bestSell.amountOut <= repayAmount) {
    return null;
  }

  return {
    tokenBorrow,
    tokenTarget,
    borrowAmount: borrowAmountParsed,
    buyDex: bestBuy.dex,
    sellDex: bestSell.dex,
    buyDexIndex: dexNameToIndex[bestBuy.dex],
    sellDexIndex: dexNameToIndex[bestSell.dex],
    buyAmountTarget: bestBuy.amountOut,
    sellAmountBorrow: bestSell.amountOut,
    fee: repayAmount - borrowAmountParsed,
    profit,
    profitUsd: Number(ethers.formatUnits(profit, tokenDecimals)),
  };
}

module.exports = {
  TOKEN_LIST,
  V2_ROUTERS,
  findArbitrageOpportunity,
};
