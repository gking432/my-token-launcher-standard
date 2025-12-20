import { useState, useEffect } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { getTokenLauncherTokens } from '../utils/aptosIndexer';
import { MODULE_ADDRESS } from '../config';
import { useAptPrice } from '../contexts/AptPriceContext';
import { usePageVisibility } from './usePageVisibility';

interface Token {
  name: string;
  symbol: string;
  supply: number;
  txHash: string;
  image: string | null;
  launchDate: string;
  creator: string;
  metadataAddress?: string;
  price?: number;
  marketCap?: number;
  volume?: number;
  change24h?: number;
  creatorAddress?: string;
  // Add USD fields
  priceUSD?: number;
  marketCapUSD?: number;
}

interface UseTokenDataReturn {
  tokens: Token[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useTokenData = (): UseTokenDataReturn => {
  const { aptPrice } = useAptPrice();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const isVisible = usePageVisibility();

  // Helper function to convert hex string to readable string
  const hexToString = (hex: string) => {
    if (!hex || !hex.startsWith("0x")) return "";
    try {
      const hexWithoutPrefix = hex.replace("0x", "");
      const bytes = [];
      for (let i = 0; i < hexWithoutPrefix.length; i += 2) {
        bytes.push(parseInt(hexWithoutPrefix.substr(i, 2), 16));
      }
      return String.fromCharCode(...bytes);
    } catch (error) {
      console.error("Error converting hex to string:", error, "Hex:", hex);
      return "";
    }
  };

  // Helper function for bonding curve calculation
  const calculateBondingCurvePrice = (tokensSold: number): number => {
    const PRICE_NUMERATOR = 19029514756; // 19,029,514,756
    const PRICE_CONSTANT = 61.9053276; // 61.9053276 Octas
    const MAX_TOKENS = 800000000; // 800,000,000 total supply
    
    const denominator = MAX_TOKENS - tokensSold;
    
    if (denominator <= 0) {
      throw new Error("All tokens have been sold");
    }
    
    // Calculate hyperbolic term: numerator / denominator (floating point division)
    const hyperbolicTerm = PRICE_NUMERATOR / denominator;
    
    // Add constant term (61.9053276 Octas)
    const constantTerm = PRICE_CONSTANT;
    
    // Total price in Octas (smallest APT unit)
    const priceInOctas = hyperbolicTerm + constantTerm;
    
    // Convert to APT (divide by 10^8)
    return priceInOctas / 100_000_000;
  };

  const fetchTokens = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("🔄 useTokenData: Fetching tokens...");
      
      // Fetch tokens using our optimized fallback approach
      const tokenEvents = await getTokenLauncherTokens(MODULE_ADDRESS);
      
      console.log("📊 useTokenData: Raw token events:", tokenEvents);
      
      // Reset retry count on success
      setRetryCount(0);
      
      // Convert events to Token objects
      const fetchedTokens: Token[] = tokenEvents.map((event, index) => {
        const eventData = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        // Debug: Log the actual event data structure
        console.log(`🔍 Event ${index} data:`, eventData);
        console.log(`🔍 Event ${index} full structure:`, event);
        console.log(`🔍 Event ${index} metadata_addr:`, eventData?.metadata_addr, 'type:', typeof eventData?.metadata_addr);
        console.log(`🔍 Event ${index} all keys:`, Object.keys(eventData || {}));
        
        // Get metadata address - try both snake_case and camelCase
        const metadataAddr = eventData?.metadata_addr || eventData?.metadataAddress || eventData?.metadata_address;
        console.log(`🔍 Event ${index} resolved metadataAddr:`, metadataAddr);
        
        // Convert hex ticker to readable string
        const tickerHex = eventData?.ticker || '';
        const symbol = tickerHex.startsWith('0x') ? hexToString(tickerHex) : tickerHex;
        
        // Parse supply data - use correct field names from TokenCreatedEvent
        const totalSupply = parseInt(eventData?.total_supply || '1000000');
        const mintedSupply = parseInt(eventData?.minted_supply || '0');
        const remainingSupply = parseInt(eventData?.remaining_supply || '1000000');
        
        // Calculate tokens sold as total - remaining
        const tokensSold = totalSupply - remainingSupply;
        
        // Calculate APT price using bonding curve
        const priceAPT = calculateBondingCurvePrice(tokensSold);
        
        // Calculate USD price if APT price is available (use current aptPrice from context)
        // Note: We'll recalculate USD prices when aptPrice updates, but won't refetch tokens
        const currentAptPrice = aptPrice;
        const priceUSD = currentAptPrice ? priceAPT * currentAptPrice : undefined;
        const marketCapUSD = priceUSD ? priceUSD * totalSupply : undefined;
        
        // Generate mock data for demonstration (you can replace with real price feeds later)
        const price = priceAPT; // Use real APT price instead of random
        const marketCap = price * totalSupply;
        const volume = Math.random() * 1000000 + 10000;
        const change24h = (Math.random() - 0.5) * 100;
        
        // Ensure metadataAddr is a string and not truncated
        const fullMetadataAddr = metadataAddr && typeof metadataAddr === 'string' 
          ? metadataAddr 
          : (metadataAddr?.toString() || 'Unknown');
        
        console.log(`✅ Event ${index} final metadataAddr:`, fullMetadataAddr, 'length:', fullMetadataAddr?.length);
        
        return {
          name: symbol || `Token ${index + 1}`,
          symbol: symbol || `TKN${index + 1}`,
          supply: totalSupply,
          txHash: fullMetadataAddr !== 'Unknown' ? fullMetadataAddr : `0x${Math.random().toString(16).substr(2, 64)}`,
          image: null,
          launchDate: new Date(parseInt(eventData?.timestamp || '0') / 1000).toISOString(),
          creator: eventData?.creator || 'Unknown',
          creatorAddress: eventData?.creator || 'Unknown',
          metadataAddress: fullMetadataAddr,
          price,
          marketCap,
          volume,
          change24h,
          // Add USD fields
          priceUSD,
          marketCapUSD
        };
      });

      console.log("✅ useTokenData: Processed tokens:", fetchedTokens);
      
      // Update USD prices with current APT price if available
      const tokensWithUSD = fetchedTokens.map(token => {
        if (aptPrice && token.price) {
          return {
            ...token,
            priceUSD: token.price * aptPrice,
            marketCapUSD: token.price * aptPrice * token.supply
          };
        }
        return token;
      });
      
      setTokens(tokensWithUSD);
      
    } catch (err) {
      console.error("❌ useTokenData: Error fetching tokens:", err);
      
      // Distinguish between different types of errors
      let errorMessage = 'Failed to fetch tokens';
      if (err instanceof Error) {
        if (err.message.includes('rate limit') || err.message.includes('429')) {
          errorMessage = 'Rate limited by Aptos network - please try again in a few moments';
          
          // Auto-retry rate limit errors with exponential backoff
          if (retryCount < 3) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10 seconds
            console.log(`🔄 Auto-retrying in ${delay}ms (attempt ${retryCount + 1}/3)...`);
            setRetryCount(prev => prev + 1);
            
            setTimeout(() => {
              fetchTokens();
            }, delay);
            return; // Don't set error state yet
          }
        } else if (err.message.includes('All methods failed')) {
          errorMessage = 'All data sources are currently unavailable - please try again later';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      setTokens([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch tokens on mount only if page is visible (not when APT price changes to avoid excessive API calls)
  useEffect(() => {
    if (isVisible) {
      fetchTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]); // Only fetch when page becomes visible (fetchTokens is stable enough)

  // Update USD prices when APT price changes (without refetching tokens from API)
  useEffect(() => {
    if (aptPrice && tokens.length > 0) {
      setTokens(prevTokens => {
        return prevTokens.map(token => {
          if (token.price) {
            return {
              ...token,
              priceUSD: token.price * aptPrice,
              marketCapUSD: token.price * aptPrice * token.supply
            };
          }
          return token;
        });
      });
    }
  }, [aptPrice]); // Only update USD prices when APT price changes, don't refetch from API

  // Return the hook interface
  return {
    tokens,
    loading,
    error,
    refetch: fetchTokens
  };
};
