import { useState, useEffect } from 'react';
import { getTokenLauncherTokens } from '../utils/aptosIndexer';
import { MODULE_ADDRESS } from '../config';

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
}

interface UseTokenDataReturn {
  tokens: Token[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useTokenData = (): UseTokenDataReturn => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const fetchTokens = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("🔄 useTokenData: Fetching tokens...");
      
      // Fetch tokens using our optimized fallback approach
      const tokenEvents = await getTokenLauncherTokens(MODULE_ADDRESS);
      
      console.log("📊 useTokenData: Raw token events:", tokenEvents);
      
      // Convert events to Token objects
      const fetchedTokens: Token[] = tokenEvents.map((event, index) => {
        const eventData = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        // Convert hex ticker to readable string
        const tickerHex = eventData?.ticker || '';
        const symbol = tickerHex.startsWith('0x') ? hexToString(tickerHex) : tickerHex;
        
        // Parse supply data
        const totalSupply = parseInt(eventData?.total_supply || '1000000');
        
        // Generate mock data for demonstration (you can replace with real price feeds later)
        const price = Math.random() * 0.01 + 0.0001;
        const marketCap = price * totalSupply;
        const volume = Math.random() * 1000000 + 10000;
        const change24h = (Math.random() - 0.5) * 100;
        
        return {
          name: symbol || `Token ${index + 1}`,
          symbol: symbol || `TKN${index + 1}`,
          supply: totalSupply,
          txHash: eventData?.metadata_addr || `0x${Math.random().toString(16).substr(2, 64)}`,
          image: null,
          launchDate: new Date().toISOString(),
          creator: eventData?.creator || 'Unknown',
          creatorAddress: eventData?.creator || 'Unknown',
          metadataAddress: eventData?.metadata_addr || 'Unknown',
          price,
          marketCap,
          volume,
          change24h,
        };
      });

      console.log("✅ useTokenData: Processed tokens:", fetchedTokens);
      setTokens(fetchedTokens);
      
    } catch (err) {
      console.error("❌ useTokenData: Error fetching tokens:", err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tokens');
      setTokens([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch tokens on mount
  useEffect(() => {
    fetchTokens();
  }, []);

  // Return the hook interface
  return {
    tokens,
    loading,
    error,
    refetch: fetchTokens
  };
}; 