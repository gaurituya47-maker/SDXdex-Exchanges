import React, { useMemo, useState } from "react";
import WalletConnect from "./WalletConnect";
import ProfitChart from "./ProfitChart";
import { ethers } from "ethers";

const DEFAULT_PARAMS = {
  tokenBorrow: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  tokenTarget: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  borrowAmount: ethers.parseUnits("10000", 6),
  buyDex: 0,
  sellDex: 2,
  v3FeeBuy: 3000,
  v3FeeSell: 3000,
  minProfit: ethers.parseUnits("0.1", 6),
};

const dexNames = ["Uniswap V2", "Uniswap V3", "SushiSwap", "PancakeSwap", "Curve", "Balancer V2"];

export default function Dashboard({ account, chainId, connect, disconnect, contract, status, setStatus, history }) {
  const totalProfit = useMemo(() => history.reduce((sum, entry) => sum + entry.profit, 0), [history]);
  const txCount = history.length;
  const networkName = chainId === 1 ? "Ethereum" : chainId === 42161 ? "Arbitrum" : chainId === 137 ? "Polygon" : "Unknown";
  const [controlStatus, setControlStatus] = useState(status || "idle");

  const runDefaultArbitrage = async () => {
    if (!contract) return;
    try {
      setControlStatus("executing");
      const tx = await contract.executeArbitrage(DEFAULT_PARAMS);
      setControlStatus("waiting");
      await tx.wait();
      setControlStatus("success");
    } catch (error) {
      setControlStatus("error");
    }
  };

  return (
    <div className="rounded-[2rem] border border-slate-800 bg-slate-950 p-8 shadow-2xl">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-4xl font-semibold text-cyan-300">⚡ Flash Arb Bot</h1>
          <p className="mt-2 text-slate-400">Monitor and execute arbitrage from a connected wallet.</p>
        </div>
        <WalletConnect account={account} chainId={chainId} connect={connect} disconnect={disconnect} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl bg-slate-900 p-5 text-white shadow-lg">
          <p className="text-sm uppercase text-slate-500">💰 Total Profit</p>
          <p className="mt-3 text-3xl font-semibold">{totalProfit.toFixed(4)} USDC</p>
        </div>
        <div className="rounded-3xl bg-slate-900 p-5 text-white shadow-lg">
          <p className="text-sm uppercase text-slate-500">📊 Total Transactions</p>
          <p className="mt-3 text-3xl font-semibold">{txCount}</p>
        </div>
        <div className="rounded-3xl bg-slate-900 p-5 text-white shadow-lg">
          <p className="text-sm uppercase text-slate-500">🌐 Network Name</p>
          <p className="mt-3 text-3xl font-semibold">{networkName}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl bg-slate-900 p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-white">Control Panel</h2>
          <p className="mt-2 text-slate-400">Run an example arbitrage with default parameters.</p>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
            <button
              onClick={runDefaultArbitrage}
              disabled={!contract}
              className="rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ▶️ Run Arbitrage
            </button>
            <div className="rounded-2xl bg-slate-950 px-4 py-3 text-sm text-slate-300">
              Status: {controlStatus}
            </div>
          </div>
          <div className="mt-6 space-y-2 rounded-3xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
            <p>Defaults:</p>
            <p>borrow 10,000 USDC</p>
            <p>target WETH</p>
            <p>buyDex {dexNames[0]}</p>
            <p>sellDex {dexNames[2]}</p>
          </div>
        </div>
        <div className="rounded-3xl bg-slate-900 p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-white">Profit History</h2>
          {history.length > 0 ? (
            <div className="mt-4 space-y-3">
              {history.map((entry, index) => (
                <a
                  key={`${entry.txHash}-${index}`}
                  href={`https://etherscan.io/tx/${entry.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-3xl border border-slate-800 bg-slate-950 p-4 hover:border-cyan-500"
                >
                  <p className="text-sm text-slate-400">Profit: {entry.profit.toFixed(4)} USDC</p>
                  <p className="mt-1 text-xs text-slate-500">{entry.txHash}</p>
                </a>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-950 p-6 text-slate-400">
              ยังไม่มีการทำ Arbitrage...
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <ProfitChart data={history} />
      </div>
    </div>
  );
}
