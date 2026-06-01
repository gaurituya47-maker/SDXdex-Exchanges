import React, { useState } from "react";
import { ethers } from "ethers";

const tokenOptions = [
  { label: "USDC", value: "USDC" },
  { label: "USDT", value: "USDT" },
  { label: "WETH", value: "WETH" },
  { label: "DAI", value: "DAI" },
  { label: "WBTC", value: "WBTC" },
];

const dexOptions = [
  { label: "Uniswap V2", value: 0 },
  { label: "Uniswap V3", value: 1 },
  { label: "SushiSwap", value: 2 },
  { label: "PancakeSwap", value: 3 },
  { label: "Curve", value: 4 },
];

const tokenAddresses = {
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
};

const decimals = {
  USDC: 6,
  USDT: 6,
  WETH: 18,
  DAI: 18,
  WBTC: 8,
};

export default function BotControl({ contract, setStatus }) {
  const [borrowAmount, setBorrowAmount] = useState("10000");
  const [tokenBorrow, setTokenBorrow] = useState("USDC");
  const [tokenTarget, setTokenTarget] = useState("WETH");
  const [minProfit, setMinProfit] = useState("0.1");
  const [buyDex, setBuyDex] = useState(0);
  const [sellDex, setSellDex] = useState(2);
  const [message, setMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!contract) {
      setMessage("Connect wallet and load contract first.");
      return;
    }

    try {
      setStatus("executing");
      setMessage("Sending arbitrage transaction...");
      const borrowDecimals = decimals[tokenBorrow];
      const params = {
        tokenBorrow: tokenAddresses[tokenBorrow],
        tokenTarget: tokenAddresses[tokenTarget],
        borrowAmount: ethers.parseUnits(borrowAmount, borrowDecimals),
        buyDex,
        sellDex,
        v3FeeBuy: 3000,
        v3FeeSell: 3000,
        minProfit: ethers.parseUnits(minProfit, borrowDecimals),
      };
      const tx = await contract.executeArbitrage(params);
      setStatus("waiting");
      await tx.wait();
      setStatus("success");
      setMessage("Arbitrage transaction confirmed.");
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Execution failed.");
    }
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
      <h2 className="text-2xl font-semibold text-white">Control Panel</h2>
      <p className="mt-2 text-slate-400">Submit a parameterized arbitrage transaction from MetaMask.</p>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-slate-200">
            Borrow Amount
            <input
              value={borrowAmount}
              onChange={(e) => setBorrowAmount(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            />
          </label>
          <label className="block text-slate-200">
            Min Profit
            <input
              value={minProfit}
              onChange={(e) => setMinProfit(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-slate-200">
            Token Borrow
            <select
              value={tokenBorrow}
              onChange={(e) => setTokenBorrow(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            >
              {tokenOptions.map((token) => (
                <option key={token.value} value={token.value}>{token.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-slate-200">
            Token Target
            <select
              value={tokenTarget}
              onChange={(e) => setTokenTarget(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            >
              {tokenOptions.map((token) => (
                <option key={token.value} value={token.value}>{token.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-slate-200">
            Buy DEX
            <select
              value={buyDex}
              onChange={(e) => setBuyDex(Number(e.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            >
              {dexOptions.map((dex) => (
                <option key={dex.value} value={dex.value}>{dex.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-slate-200">
            Sell DEX
            <select
              value={sellDex}
              onChange={(e) => setSellDex(Number(e.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            >
              {dexOptions.map((dex) => (
                <option key={dex.value} value={dex.value}>{dex.label}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="submit"
          className="mt-4 inline-flex w-full justify-center rounded-2xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          Run Arbitrage
        </button>
      </form>
      {message && <p className="mt-4 text-slate-300">{message}</p>}
    </div>
  );
}
