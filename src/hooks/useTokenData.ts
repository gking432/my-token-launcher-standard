import { useState, useEffect } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { getTokenLauncherTokens, fetchPurchaseEvents } from '../utils/aptosIndexer';
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
  tokensSold?: number; // For internal calculation
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

  // Convert Aptos event timestamp (microseconds) to milliseconds
  const aptosTimestampToMs = (ts: number): number => {
    if (ts > 1e15) return ts / 1000;   // nanoseconds → ms
    if (ts > 1e12) return ts / 1000;   // microseconds → ms
    if (ts > 1e9)  return ts;          // already ms
    return ts * 1000;                  // seconds → ms
  };

  // Calculate 24h volume by summing purchase events from last 24 hours
  const calculate24hVolume = async (metadataAddr: string): Promise<number> => {
    try {
      // Fetch purchase events for this token
      const purchaseEvents = await fetchPurchaseEvents(metadataAddr, 1000);

      if (!purchaseEvents || purchaseEvents.length === 0) {
        return 0;
      }

      // Get timestamp 24 hours ago (in ms)
      const nowMs = Date.now();
      const twentyFourHoursAgoMs = nowMs - (24 * 60 * 60 * 1000);

      // Filter events from the last 24 hours (convert Aptos μs timestamps to ms)
      const eventsLast24h = purchaseEvents.filter((event: any) => {
        const eventMs = aptosTimestampToMs(parseInt(event.timestamp || '0'));
        return eventMs >= twentyFourHoursAgoMs && eventMs <= nowMs;
      });

      if (eventsLast24h.length === 0) {
        return 0;
      }

      // Calculate total volume in USD
      // For each purchase, calculate the cost using the bonding curve
      // tokens_sold in event is AFTER purchase, so tokens_sold_before = tokens_sold - amount
      let totalVolumeUSD = 0;
      
      for (const event of eventsLast24h) {
        const amount = parseFloat(event.amount || '0');
        const tokensSoldAfter = parseFloat(event.tokens_sold || '0');
        const tokensSoldBefore = Math.max(0, tokensSoldAfter - amount);
        
        if (amount > 0 && aptPrice) {
          // Calculate price before and after purchase
          const priceBefore = calculateBondingCurvePrice(tokensSoldBefore);
          const priceAfter = calculateBondingCurvePrice(tokensSoldAfter);
          
          // Use average price for the purchase
          const avgPrice = (priceBefore + priceAfter) / 2;
          
          // Volume = amount * average_price * aptPrice
          const eventVolumeUSD = amount * avgPrice * aptPrice;
          totalVolumeUSD += eventVolumeUSD;
        }
      }

      return totalVolumeUSD;
      
    } catch (error) {
      console.error(`Error calculating 24h volume for ${metadataAddr}:`, error);
      return 0; // Return 0 on error
    }
  };

  // Calculate 24h price change by fetching purchase events
  const calculate24hPriceChange = async (metadataAddr: string, currentTokensSold: number, currentPrice: number): Promise<number> => {
    try {
      // Fetch purchase events for this token
      const purchaseEvents = await fetchPurchaseEvents(metadataAddr, 1000);

      if (!purchaseEvents || purchaseEvents.length === 0) {
        return 0;
      }

      // Get timestamp 24 hours ago (in ms)
      const nowMs = Date.now();
      const twentyFourHoursAgoMs = nowMs - (24 * 60 * 60 * 1000);

      // Filter events from the last 24 hours and sort by timestamp (oldest first)
      const eventsLast24h = purchaseEvents
        .filter((event: any) => {
          const eventMs = aptosTimestampToMs(parseInt(event.timestamp || '0'));
          return eventMs >= twentyFourHoursAgoMs && eventMs <= nowMs;
        })
        .sort((a: any, b: any) => {
          return parseInt(a.timestamp || '0') - parseInt(b.timestamp || '0');
        });

      if (eventsLast24h.length === 0) {
        if (purchaseEvents.length > 0) {
          const oldestEvent = [...purchaseEvents].sort((a: any, b: any) =>
            parseInt(a.timestamp || '0') - parseInt(b.timestamp || '0')
          )[0];

          const oldestMs = aptosTimestampToMs(parseInt(oldestEvent.timestamp || '0'));
          if (oldestMs < twentyFourHoursAgoMs) {
            return 0; // Existed 24h ago, no trades since
          } else {
            const launchPrice = calculateBondingCurvePrice(0);
            if (launchPrice === 0) return 0;
            return ((currentPrice - launchPrice) / launchPrice) * 100;
          }
        }
        return 0;
      }

      // Get tokens_sold from the earliest event in the last 24 hours
      // tokens_sold in the event is AFTER the purchase, so we need to subtract the amount
      const earliestEvent = eventsLast24h[0];
      const tokensSoldAfterPurchase = parseInt(earliestEvent.tokens_sold || '0');
      const amountPurchased = parseInt(earliestEvent.amount || '0');
      const tokensSold24hAgo = Math.max(0, tokensSoldAfterPurchase - amountPurchased);
      
      // Calculate price 24h ago
      const price24hAgo = calculateBondingCurvePrice(tokensSold24hAgo);
      
      // Calculate percentage change
      if (price24hAgo === 0) {
        return 0;
      }
      
      const changePercent = ((currentPrice - price24hAgo) / price24hAgo) * 100;
      return changePercent;
      
    } catch (error) {
      console.error(`Error calculating 24h price change for ${metadataAddr}:`, error);
      return 0; // Return 0 on error
    }
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
      
      // Convert events to Token objects (first pass - get basic data)
      const tokensBasicData = tokenEvents.map((event, index) => {
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
        
        // Parse supply data
        // aptosIndexer renames minted_supply → tokens_sold in the data wrapper
        // Total supply = 1B (800M sold via bonding curve + 200M pre-minted for DEX at graduation)
        const BONDING_CURVE_MAX = 800_000_000;
        const TOTAL_SUPPLY_DEFAULT = 1_000_000_000;
        const totalSupply = parseInt(eventData?.total_supply || String(TOTAL_SUPPLY_DEFAULT));
        // tokens_sold is the renamed minted_supply; fall back to curve-max minus remaining
        const mintedSupply = parseInt(
          eventData?.tokens_sold ?? eventData?.minted_supply ?? '0'
        );
        const remainingSupply = parseInt(eventData?.remaining_supply || String(BONDING_CURVE_MAX));

        // Prefer explicit tokens_sold field; fall back to bonding_curve_max - remaining
        // (NOT totalSupply - remaining, which would incorrectly include the 200M reserve)
        const tokensSold = mintedSupply > 0
          ? mintedSupply
          : Math.max(0, BONDING_CURVE_MAX - remainingSupply);
        
        // Calculate APT price using bonding curve
        const priceAPT = calculateBondingCurvePrice(tokensSold);
        
        // Calculate USD price if APT price is available (use current aptPrice from context)
        // Note: We'll recalculate USD prices when aptPrice updates, but won't refetch tokens
        const currentAptPrice = aptPrice;
        const priceUSD = currentAptPrice ? priceAPT * currentAptPrice : undefined;
        const marketCapUSD = priceUSD ? priceUSD * totalSupply : undefined;
        
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
          launchDate: new Date(aptosTimestampToMs(parseInt(eventData?.timestamp || '0'))).toISOString(),
          creator: eventData?.creator || 'Unknown',
          creatorAddress: eventData?.creator || 'Unknown',
          metadataAddress: fullMetadataAddr,
          price: priceAPT,
          marketCap: priceAPT * totalSupply,
          volume: 0, // Will be calculated below from purchase events
          change24h: 0, // Will be calculated below
          priceUSD,
          marketCapUSD,
          tokensSold // Store for 24h calculation
        };
      });

      // Calculate 24h price changes and volumes for all tokens in parallel
      console.log("📊 Calculating 24h price changes and volumes...");
      const tokensWith24hData = await Promise.all(
        tokensBasicData.map(async (token) => {
          if (token.metadataAddress && token.metadataAddress !== 'Unknown') {
            const [change24h, volume24h] = await Promise.all([
              calculate24hPriceChange(
                token.metadataAddress,
                token.tokensSold,
                token.price
              ),
              calculate24hVolume(token.metadataAddress)
            ]);
            return {
              ...token,
              change24h,
              volume: volume24h
            };
          }
          return token;
        })
      );

      const fetchedTokens: Token[] = tokensWith24hData;

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
