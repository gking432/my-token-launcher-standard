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

const CACHE_DURATION = 60000; // 60 seconds

// Price sources in priority order — Binance needs no API key and has no CORS issues
const PRICE_SOURCES = [
  {
    name: 'Binance',
    url: 'https://api.binance.com/api/v3/ticker/price?symbol=APTUSDT',
    parse: (data: any): number => parseFloat(data.price),
  },
  {
    name: 'CoinGecko (direct)',
    url: 'https://api.coingecko.com/api/v3/simple/price?ids=aptos&vs_currencies=usd',
    parse: (data: any): number => data?.aptos?.usd,
  },
  {
    name: 'CoinGecko (proxy)',
    url: 'https://corsproxy.io/?' + encodeURIComponent('https://api.coingecko.com/api/v3/simple/price?ids=aptos&vs_currencies=usd'),
    parse: (data: any): number => data?.aptos?.usd,
  },
];

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

    let lastError: string = 'All price sources failed';
    for (const source of PRICE_SOURCES) {
      try {
        console.log(`🔄 Fetching APT price from ${source.name}...`);
        const response = await fetch(source.url);
        if (!response.ok) {
          throw new Error(`${source.name} error: ${response.status}`);
        }
        const data = await response.json();
        const price = source.parse(data);
        if (!price || isNaN(price) || price <= 0) {
          throw new Error(`${source.name}: invalid price value`);
        }
        console.log(`✅ APT price from ${source.name}: $${price}`);
        setAptPrice(price);
        setLastUpdated(Date.now());
        setError(null);
        setLoading(false);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`⚠️ ${source.name} failed:`, lastError);
      }
    }
    // All sources failed
    console.error('❌ All APT price sources failed:', lastError);
    setError(lastError);
    if (aptPrice) console.log('📊 Keeping cached APT price:', aptPrice);
    setLoading(false);
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
