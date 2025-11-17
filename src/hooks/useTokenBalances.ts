import { useState, useEffect, useMemo, useCallback } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";

export const useTokenBalances = () => {
  const { account } = useWallet();
  const [balances, setBalances] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokenBalances = async (): Promise<Map<string, string>> => {
    if (!account) {
      throw new Error("No wallet connected");
    }

    try {
      setLoading(true);
      setError(null);
      
      // Get balances for the connected wallet
      const response = await fetch(`https://fullnode.testnet.aptoslabs.com/v1/accounts/${account.address}/resources?limit=999`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch balances: ${response.status}`);
      }
      
      const resources = await response.json();
      
      // Find the FungibleAssetStore resource
      const fungibleAssetStore = resources.find((resource: any) =>
        resource.type === "0x1::fungible_asset::FungibleAssetStore"
      );
      
      const balanceMap = new Map<string, string>();
      
      if (fungibleAssetStore && fungibleAssetStore.data.stores) {
        const stores = fungibleAssetStore.data.stores;
        
        stores.forEach((store: any) => {
          if (store.metadata && store.balance) {
            const amount = Number(store.balance) / Math.pow(10, 6); // Assuming 6 decimals
            balanceMap.set(store.metadata, amount.toString());
          }
        });
      }
      
      console.log(`✅ Retrieved ${balanceMap.size} balances for ${account.address}`);
      return balanceMap;
      
    } catch (error) {
      console.error("❌ Balance fetch failed:", error);
      setError(error instanceof Error ? error.message : "Unknown error");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Fetch balances when wallet connects
  useEffect(() => {
    if (account) {
      fetchTokenBalances()
        .then((balanceMap) => {
          setBalances(balanceMap);
          setError(null);
        })
        .catch((err) => {
          console.error("Failed to fetch balances:", err);
          setError(err instanceof Error ? err.message : "Unknown error");
        });
    } else {
      setBalances(new Map());
      setError(null);
    }
  }, [account]);

  // Manual refresh function
  const refreshBalances = useCallback(async () => {
    if (account) {
      try {
        const balanceMap = await fetchTokenBalances();
        setBalances(balanceMap);
        setError(null);
             } catch (err) {
         console.error("Failed to refresh balances:", err);
         setError(err instanceof Error ? err.message : "Unknown error");
       }
    }
  }, [account]);

  // Get balance for a specific token
  const getTokenBalance = (metadataAddress: string): string => {
    return balances.get(metadataAddress) || "0.000";
  };

  return {
    balances,
    loading,
    error,
    refreshBalances,
    getTokenBalance
  };
}; 