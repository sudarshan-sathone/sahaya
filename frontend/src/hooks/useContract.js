import { useState } from "react";
import { ethers } from "ethers";
import { contractAddress, abi } from "../constants/index.js";

export function useContract() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [provider, setProvider] = useState(null);
  const [network, setNetwork] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const connectWallet = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!window.ethereum) {
        setError("MetaMask not found. Please install it first.");
        return;
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });

      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const net = await browserProvider.getNetwork();

      let networkName = "Unknown Network";
      const chainId = Number(net.chainId.toString());
      if (chainId === 31337) {
        networkName = "Local Hardhat";
      } else if (chainId === 11155111) {
        networkName = "Sepolia";
      }

      const signer = await browserProvider.getSigner();
      const c = new ethers.Contract(contractAddress, abi, signer);

      setAccount(accounts[0]);
      setProvider(browserProvider);
      setNetwork(networkName);
      setContract(c);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to connect wallet");
    } finally {
      setLoading(false);
    }
  };

  return { account, contract, provider, network, connectWallet, error, loading };
}

