import { useState, useEffect, useCallback } from 'react';

interface AptPriceData {
  aptPrice: number | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

const CACHE_DURATION = 30000; // 30 seconds
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=aptos&vs_currencies=usd';

export const useAptPrice = () => {
  const [aptPrice, setAptPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetchAptPrice = useCallback(async (force = false) => {
    // Check if we have cached data and it's still valid
    if (!force && aptPrice && lastUpdated && Date.now() - lastUpdated < CACHE_DURATION) {
      console.log('📊 Using cached APT price:', aptPrice);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔄 Fetching APT price from CoinGecko...');
      
      const response = await fetch(COINGECKO_API_URL);
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.aptos || !data.aptos.usd) {
        throw new Error('Invalid response format from CoinGecko API');
      }

      const price = data.aptos.usd;
      console.log('✅ APT price fetched:', price);
      
      setAptPrice(price);
      setLastUpdated(Date.now());
      setError(null);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error fetching APT price';
      console.error('❌ Error fetching APT price:', errorMessage);
      setError(errorMessage);
      
      // If we have a cached price, keep using it
      if (aptPrice) {
        console.log('📊 Using cached APT price due to error:', aptPrice);
      }
    } finally {
      setLoading(false);
    }
  }, [aptPrice, lastUpdated]);

  // Initial fetch
  useEffect(() => {
    fetchAptPrice();
  }, [fetchAptPrice]);

  // Set up polling every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAptPrice();
    }, CACHE_DURATION);

    return () => clearInterval(interval);
  }, [fetchAptPrice]);

  const refetch = useCallback(() => {
    fetchAptPrice(true);
  }, [fetchAptPrice]);

  return {
    aptPrice,
    loading,
    error,
    lastUpdated,
    refetch
  };
}; 