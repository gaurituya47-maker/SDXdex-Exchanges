import { useMemo } from "react";
import { ethers } from "ethers";
import FlashLoanArbitrageAbi from "../abi/FlashLoanArbitrage.json";

export function useContract(signer) {
  return useMemo(() => {
    if (!signer) {
      return null;
    }

    const address = import.meta.env.VITE_CONTRACT_ADDRESS;
    if (!address) {
      return null;
    }

    return new ethers.Contract(address, FlashLoanArbitrageAbi.abi, signer);
  }, [signer]);
}
