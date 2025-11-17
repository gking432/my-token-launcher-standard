import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAptPrice } from './AptPriceContext';

interface TokenPrice {
  metadataAddress: string;
  priceAPT: number;
  priceUSD: number;
  marketCapUSD: number;
  volume24h: number;
  priceChange24h: number;
  lastUpdated: number;
}

interface RealTimePriceContextType {
  tokenPrices: Map<string, TokenPrice>;
  loading: boolean;
  error: string | null;
  updateTokenPrice: (metadataAddress: string, priceAPT: number, volume?: number) => void;
  getTokenPrice: (metadataAddress: string) => TokenPrice | null;
  refreshAllPrices: () => void;
}

const RealTimePriceContext = createContext<RealTimePriceContextType | undefined>(undefined);

export const useRealTimePrice = () => {
  const context = useContext(RealTimePriceContext);
  if (!context) {
    throw new Error('useRealTimePrice must be used within a RealTimePriceProvider');
  }
  return context;
};

interface RealTimePriceProviderProps {
  children: ReactNode;
}

// Helper function for bonding curve calculation (same as in aptosIndexer.ts)
function calculateBondingCurvePrice(tokensSold: number): number {
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
}

export const RealTimePriceProvider: React.FC<RealTimePriceProviderProps> = ({ children }) => {
  const [tokenPrices, setTokenPrices] = useState<Map<string, TokenPrice>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { aptPrice } = useAptPrice();

  // Update token price when APT price changes
  useEffect(() => {
    if (aptPrice && tokenPrices.size > 0) {
      console.log('🔄 APT price changed, updating all token USD prices...');
      
      setTokenPrices(prevPrices => {
        const newPrices = new Map(prevPrices);
        
        newPrices.forEach((tokenPrice, metadataAddress) => {
          const newPriceUSD = tokenPrice.priceAPT * aptPrice;
          const newMarketCapUSD = newPriceUSD * 1000000; // Assuming 1M total supply for market cap
          
          newPrices.set(metadataAddress, {
            ...tokenPrice,
            priceUSD: newPriceUSD,
            marketCapUSD: newMarketCapUSD,
            lastUpdated: Date.now()
          });
        });
        
        return newPrices;
      });
    }
  }, [aptPrice, tokenPrices.size]);

  const updateTokenPrice = useCallback((metadataAddress: string, priceAPT: number, volume: number = 0) => {
    if (!aptPrice) {
      console.warn('⚠️ Cannot update token price: APT price not available');
      return;
    }

    const priceUSD = priceAPT * aptPrice;
    const marketCapUSD = priceUSD * 1000000; // Assuming 1M total supply
    
    const newTokenPrice: TokenPrice = {
      metadataAddress,
      priceAPT,
      priceUSD,
      marketCapUSD,
      volume24h: volume,
      priceChange24h: 0, // TODO: Calculate 24h change
      lastUpdated: Date.now()
    };

    setTokenPrices(prevPrices => {
      const newPrices = new Map(prevPrices);
      newPrices.set(metadataAddress, newTokenPrice);
      return newPrices;
    });

    console.log(`💰 Updated price for ${metadataAddress}: ${priceAPT} APT ($${priceUSD.toFixed(6)})`);
  }, [aptPrice]);

  const getTokenPrice = useCallback((metadataAddress: string): TokenPrice | null => {
    return tokenPrices.get(metadataAddress) || null;
  }, [tokenPrices]);

  const refreshAllPrices = useCallback(() => {
    console.log('🔄 Refreshing all token prices...');
    // This would trigger a refresh of all token data
    // For now, we'll just log it
  }, []);

  const value: RealTimePriceContextType = {
    tokenPrices,
    loading,
    error,
    updateTokenPrice,
    getTokenPrice,
    refreshAllPrices
  };

  return (
    <RealTimePriceContext.Provider value={value}>
      {children}
    </RealTimePriceContext.Provider>
  );
};
