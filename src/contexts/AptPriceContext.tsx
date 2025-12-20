import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { usePageVisibility } from '../hooks/usePageVisibility';

interface AptPriceContextType {
  aptPrice: number | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refetch: () => void;
}

const AptPriceContext = createContext<AptPriceContextType | undefined>(undefined);

export const useAptPrice = () => {
  const context = useContext(AptPriceContext);
  if (!context) {
    throw new Error('useAptPrice must be used within an AptPriceProvider');
  }
  return context;
};

interface AptPriceProviderProps {
  children: ReactNode;
}

const CACHE_DURATION = 60000; // 60 seconds (increased to reduce API calls)
// Use a different CORS proxy that doesn't have rate limits
const COINGECKO_API_URL = 'https://corsproxy.io/?' + encodeURIComponent('https://api.coingecko.com/api/v3/simple/price?ids=aptos&vs_currencies=usd');

export const AptPriceProvider = ({ children }: AptPriceProviderProps): JSX.Element => {
  const [aptPrice, setAptPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const isVisible = usePageVisibility();

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
      console.log('🔍 Raw API response:', data);
      
      // Check for rate limit errors
      if (data.status && data.status.error_code === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      
      if (!data.aptos || !data.aptos.usd) {
        console.error('❌ Invalid response format:', data);
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

  // Initial fetch - only if page is visible
  useEffect(() => {
    if (isVisible) {
      fetchAptPrice();
    }
  }, [fetchAptPrice, isVisible]);

  // No continuous polling - APT price fetched once on mount
  // APT price doesn't change frequently enough to warrant continuous polling
  // Use refetch() manually if needed, or implement WebSocket for real-time price updates

  const refetch = useCallback(() => {
    fetchAptPrice(true);
  }, [fetchAptPrice]);

  const value: AptPriceContextType = {
    aptPrice,
    loading,
    error,
    lastUpdated,
    refetch
  };

  return (
    <AptPriceContext.Provider value={value}>
      {children}
    </AptPriceContext.Provider>
  );
};
