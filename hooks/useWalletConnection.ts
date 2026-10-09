"use client";

import { useState } from "react";
import { setAllowed, getAddress } from "@stellar/freighter-api";
import { useWallet } from "@/context/WalletContext";
import { createContainerForWallet } from "@/lib/docker/containerState";

export function useWalletConnection() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const walletContext = useWallet();

  const fetchBalance = async (publicKey: string): Promise<string> => {
    try {
      const response = await fetch(
        `https://horizon-testnet.stellar.org/accounts/${publicKey}`
      );
      if (!response.ok) {
        return "0.00";
      }
      const data = await response.json();
      const nativeBalance = data.balances.find(
        (b: { asset_type: string; balance: string }) =>
          b.asset_type === "native"
      );
      return nativeBalance ? nativeBalance.balance : "0.00";
    } catch (error) {
      console.error("Error fetching balance:", error);
      return "0.00";
    }
  };

  const createContainer = async (walletAddress: string): Promise<void> => {
    await createContainerForWallet(walletAddress, {
      setContainerReady: walletContext.setContainerReady,
      onInfo: (message) => console.log(message),
      onError: (message) => {
        console.warn(message);
        setError(message);
      },
    });
  };

  const handleConnect = async (): Promise<void> => {
    setIsConnecting(true);
    setError(null);
    try {
      console.log("[WalletConnect] Starting wallet connection...");
      console.log("[WalletConnect] Requesting wallet access...");

      const allowed = await setAllowed();
      console.log("[WalletConnect] Permission result:", allowed);

      if (!allowed.isAllowed) {
        setError("Please approve wallet access in the Freighter popup.");
        setIsConnecting(false);
        return;
      }

      console.log("[WalletConnect] Getting wallet address...");
      const addressData = await getAddress();
      console.log("[WalletConnect] Address data:", addressData);

      if (!addressData || !addressData.address) {
        console.error("[WalletConnect] No address in response:", addressData);
        throw new Error(
          "Could not get wallet address. Make sure you have selected an account in Freighter and approved access."
        );
      }

      const walletAddress = addressData.address;
      console.log("Connected wallet address:", walletAddress);

      const balance = await fetchBalance(walletAddress);
      await createContainer(walletAddress);
      walletContext.connect(walletAddress, balance);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("[WalletConnect] Connection error:", errorMessage, error);

      if (
        errorMessage.includes("approved") ||
        errorMessage.includes("denied")
      ) {
        setError("Please approve wallet access in the Freighter popup.");
      } else if (
        errorMessage.includes("account") ||
        errorMessage.includes("address")
      ) {
        setError(
          "Could not get wallet address. Make sure you have an account in Freighter and approved access."
        );
      } else if (errorMessage.includes("locked")) {
        setError("Freighter is locked. Please unlock it with your password.");
      } else {
        setError(errorMessage || "Failed to connect wallet. Please try again.");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = (): void => {
    setError(null);
    walletContext.disconnect();
  };

  return {
    isConnecting,
    error,
    handleConnect,
    handleDisconnect,
    setError,
  };
}

