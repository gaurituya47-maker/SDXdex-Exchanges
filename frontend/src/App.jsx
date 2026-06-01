import { useEffect, useState } from "react";
import Dashboard from "./components/Dashboard";
import BotControl from "./components/BotControl";
import { useWallet } from "./hooks/useWallet";
import { useContract } from "./hooks/useContract";

export default function App() {
  const wallet = useWallet();
  const contract = useContract(wallet.signer);
  const [status, setStatus] = useState("idle");
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!contract) {
      return undefined;
    }

    const handler = (tokenBorrow, amount, profit, buyDex, sellDex, event) => {
      const entry = {
        txHash: event.transactionHash,
        profit: Number(profit.toString()) / 1e18,
      };
      setHistory((prev) => [entry, ...prev].slice(0, 10));
    };

    contract.on("ArbitrageExecuted", handler);
    return () => contract.off("ArbitrageExecuted", handler);
  }, [contract]);

  return (
    <div className="min-h-screen bg-gray-950 text-white px-6 py-8">
      <Dashboard
        account={wallet.account}
        chainId={wallet.chainId}
        connect={wallet.connect}
        disconnect={wallet.disconnect}
        contract={contract}
        status={status}
        setStatus={setStatus}
        history={history}
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <BotControl contract={contract} setStatus={setStatus} />
      </div>
    </div>
  );
}
