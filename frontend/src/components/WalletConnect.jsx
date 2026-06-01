import React from "react";

function getChainBadge(chainId) {
  if (chainId === 1) return "Ethereum";
  if (chainId === 42161) return "Arbitrum";
  if (chainId === 137) return "Polygon";
  return "Unknown";
}

export default function WalletConnect({ account, chainId, connect, disconnect }) {
  const truncated = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : "Connect Wallet";

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={account ? disconnect : connect}
        className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
      >
        {truncated}
      </button>
      {account && (
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200">
          {getChainBadge(chainId)}
        </span>
      )}
    </div>
  );
}
