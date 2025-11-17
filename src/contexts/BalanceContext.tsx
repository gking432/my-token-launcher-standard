import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { MODULE_ADDRESS } from '../config';

interface BalanceContextType {
  balances: Map<string, string>;
  loading: boolean;
  error: string | null;
  refreshBalances: (force?: boolean) => Promise<void>;
  getTokenBalance: (metadataAddress: string) => string;
}

const BalanceContext = createContext<BalanceContextType | undefined>(undefined);

export const useBalanceContext = () => {
  const context = useContext(BalanceContext);
  if (!context) {
    throw new Error('useBalanceContext must be used within a BalanceProvider');
  }
  return context;
};

interface BalanceProviderProps {
  children: ReactNode;
}

export const BalanceProvider = ({ children }: BalanceProviderProps): JSX.Element => {
  const { account } = useWallet();
  const [balances, setBalances] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Request deduplication using ref to prevent race conditions
  const fetchingRef = useRef(false);
  const pendingRequestRef = useRef<Promise<Map<string, string>> | null>(null);
  
  // Balance caching with TTL (5 minutes)
  const balanceCacheRef = useRef<{ data: Map<string, string>; timestamp: number } | null>(null);
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  // Force refresh trigger - ensures all components update when balances change
  const [forceRefreshTrigger, setForceRefreshTrigger] = useState(0);

  // Helper function to normalize addresses (lowercase, ensure 0x prefix, pad to 64 hex chars)
  const normalizeAddress = (address: string | undefined | null): string => {
    if (!address) return '';
    // Remove 0x if present, lowercase, pad to 64 hex characters, then add 0x back
    let cleaned = address.replace(/^0x/i, '').toLowerCase();
    // Pad with leading zeros to ensure 64 hex characters (32 bytes)
    cleaned = cleaned.padStart(64, '0');
    return cleaned ? `0x${cleaned}` : '';
  };

  // Direct blockchain balance fetching using BuyerStore (like NEWtokenpage)
  const fetchBalancesFromBlockchain = async (): Promise<Map<string, string>> => {
    if (!account) {
      throw new Error("No wallet connected");
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log("💰 Fetching balances directly from blockchain for:", account.address.toString());
      
      // Create Aptos client for direct blockchain queries (using same config as NEWtokenpage)
      const config = new AptosConfig({
        network: Network.TESTNET,
        fullnode: "https://fullnode.testnet.aptoslabs.com/v1"
      });
      const aptos = new Aptos(config);

      // Get account resources to find BuyerStore (like NEWtokenpage does)
      const response = await aptos.getAccountResources({
        accountAddress: account.address.toString()
      });
      
      if (!response) {
        console.log("⚠️ No resources found for account");
        return new Map();
      }

      // Find the BuyerStore resource (this is what NEWtokenpage uses successfully)
      const buyerStore = response.find((resource: any) =>
        resource.type === `${MODULE_ADDRESS}::token_launcher::BuyerStore`
      );
      
      const balanceMap = new Map<string, string>();
      
      if (buyerStore && (buyerStore.data as any).stores) {
        const stores = (buyerStore.data as any).stores;
        console.log(`🔍 Found ${stores.length} token stores in BuyerStore`);
        
        // For each store, get the balance from the FungibleStore
        for (const store of stores) {
          if (store.metadata_addr && store.store?.inner) {
            try {
              const storeAddress = store.store.inner;
              const storeResources = await aptos.getAccountResources({ 
                accountAddress: storeAddress 
              });
              
              const fungibleStore = storeResources.find((r: any) => 
                r.type === "0x1::fungible_asset::FungibleStore"
              );
              
              if (fungibleStore && (fungibleStore.data as any).balance) {
                const amount = Number((fungibleStore.data as any).balance) / Math.pow(10, 6);
                // Normalize address before storing to ensure consistent lookups
                const normalizedAddr = normalizeAddress(store.metadata_addr);
                if (normalizedAddr) {
                  balanceMap.set(normalizedAddr, amount.toString());
                  console.log(`✅ Balance: ${normalizedAddr} = ${amount}`);
                }
              }
            } catch (storeError) {
              console.warn(`⚠️ Failed to get balance for store ${store.metadata_addr}:`, storeError);
            }
          }
        }
      } else {
        console.log("ℹ️ No BuyerStore found or no stores");
      }
      
      console.log(`✅ Retrieved ${balanceMap.size} balances from blockchain`);
      return balanceMap;
      
    } catch (error) {
      console.error("❌ Blockchain balance fetch failed:", error);
      setError(error instanceof Error ? error.message : "Unknown error");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Refresh balances function with robust deduplication, caching, and retry logic
  const refreshBalances = async (force: boolean = false, retryCount: number = 0, maxRetries: number = 3) => {
    if (!account) return;
    
    // Check cache first (unless force refresh is requested)
    if (!force && balanceCacheRef.current && retryCount === 0) {
      const { data, timestamp } = balanceCacheRef.current;
      const now = Date.now();
      if (now - timestamp < CACHE_TTL) {
        console.log("💾 Using cached balances (fresh for", Math.round((CACHE_TTL - (now - timestamp)) / 1000), "seconds)");
        setBalances(data);
        setError(null);
        return;
      }
    }
    
    // If already fetching, wait for the current request
    if (fetchingRef.current || pendingRequestRef.current) {
      console.log("🔄 Balance request already in progress, waiting for result...");
      try {
        if (pendingRequestRef.current) {
          const balanceMap = await pendingRequestRef.current;
          setBalances(balanceMap);
          setError(null);
          console.log("🔄 Balances refreshed from pending request");
        }
        return;
      } catch (err) {
        console.error("Pending request failed:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        return;
      }
    }
    
    // Start new request
    try {
      console.log(`🔄 Starting new balance fetch${retryCount > 0 ? ` (retry ${retryCount}/${maxRetries})` : ''}...`);
      fetchingRef.current = true;
      const requestPromise = fetchBalancesFromBlockchain();
      pendingRequestRef.current = requestPromise;
      
      const balanceMap = await requestPromise;
      setBalances(balanceMap);
      setError(null);
      
      // Cache the result
      balanceCacheRef.current = { data: balanceMap, timestamp: Date.now() };
      console.log("💾 Cached balances for 5 minutes");
      console.log("🔄 Balances refreshed successfully");
      
      // Immediately update balances state for all components
      setBalances(balanceMap);
      setError(null);
      
      // Force all components to refresh with new data
      setForceRefreshTrigger(prev => prev + 1);
      console.log("🔄 Force refresh triggered for all components");
    } catch (err) {
      console.error(`Failed to refresh balances${retryCount > 0 ? ` (attempt ${retryCount}/${maxRetries})` : ''}:`, err);
      
      // Retry logic: if force refresh and we haven't exceeded max retries, retry with delay
      if (force && retryCount < maxRetries) {
        const delayMs = 2000 * (retryCount + 1); // Exponential backoff: 2s, 4s, 6s
        console.log(`⏳ Retrying balance fetch in ${delayMs}ms...`);
        fetchingRef.current = false;
        pendingRequestRef.current = null;
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return refreshBalances(force, retryCount + 1, maxRetries);
      }
      
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      fetchingRef.current = false;
      pendingRequestRef.current = null;
    }
  };

  // Get balance for a specific token (with address normalization)
  const getTokenBalance = (metadataAddress: string): string => {
    if (!metadataAddress) return "0.000";
    // Normalize address before lookup to ensure we find it
    const normalizedAddr = normalizeAddress(metadataAddress);
    const balance = balances.get(normalizedAddr);
    if (balance !== undefined) {
      console.log(`💰 Balance lookup: ${normalizedAddr} = ${balance}`);
      return balance;
    }
    console.log(`⚠️ Balance not found for: ${normalizedAddr} (available keys: ${Array.from(balances.keys()).join(', ')})`);
    return "0.000";
  };

  // Fetch balances when wallet connects/disconnects/changes
  useEffect(() => {
    if (account) {
      console.log("🔄 Wallet connected/changed, refreshing balances for:", account.address.toString());
      // Force fresh balance fetch when wallet changes (bypass cache)
      refreshBalances(true);
    } else {
      console.log("🔄 Wallet disconnected, clearing balances");
      setBalances(new Map());
      setError(null);
      // Clear cache when wallet disconnects
      balanceCacheRef.current = null;
      // Reset force refresh trigger
      setForceRefreshTrigger(0);
    }
  }, [account?.address]); // Watch for address changes specifically
  


  const value: BalanceContextType = {
    balances,
    loading,
    error,
    refreshBalances,
    getTokenBalance
  };

  return (
    <BalanceContext.Provider value={value}>
      {children}
    </BalanceContext.Provider>
  );
}; 