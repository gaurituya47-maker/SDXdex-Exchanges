import { useEffect, useState } from "react";
import { ethers } from "ethers";

const CHAIN_LABELS = {
  1: "Ethereum",
  42161: "Arbitrum",
  137: "Polygon",
};

export function useWallet() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!window.ethereum) {
      setError("MetaMask not installed");
      return;
    }

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnect();
        return;
      }
      setAccount(accounts[0]);
    };

    const handleChainChanged = (chainIdHex) => {
      setChainId(Number(chainIdHex));
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  const connect = async () => {
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
      const providerInstance = new ethers.BrowserProvider(window.ethereum);
      const signerInstance = await providerInstance.getSigner();
      setAccount(accounts[0]);
      setProvider(providerInstance);
      setSigner(signerInstance);
      setChainId(Number(chainIdHex));
      setError(null);
    } catch (err) {
      setError(err.message || "Unable to connect wallet");
    }
  };

  const disconnect = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    setError(null);
  };

  return {
    account,
    provider,
    signer,
    chainId,
    error,
    connect,
    disconnect,
    networkName: CHAIN_LABELS[chainId] || "Unknown",
  };
}
