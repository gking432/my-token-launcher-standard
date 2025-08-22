// COMMENTED OUT FOR NOW - WAS PART OF BROKEN IMPROVEMENTS
/*
import { useMemo } from 'react';
import { useTokenData } from './useTokenData';
import { useAptPrice } from './useAptPrice';
import { 
  calculateCurrentPrice, 
  calculateMarketCap, 
  calculateBuyCost,
  TokenPriceData,
  BondingCurveParams 
} from '../utils/priceCalculator';

export interface TokenMarketData {
  // Token metadata from useTokenData
  tokens: any[];
  loading: boolean;
  error: string | null;
  
  // APT price data
  aptPrice: number | null;
  aptPriceLoading: boolean;
  aptPriceError: string | null;
  
  // Calculated market data for each token
  tokenMarketData: {
    [tokenAddress: string]: {
      currentPriceApt: number;
      currentPriceUsd: number;
      marketCapUsd: number;
      buyCostApt: (tokenAmount: number) => number;
      buyCostUsd: (tokenAmount: number) => number;
      tokensForApt: (aptAmount: number) => number;
    };
  };
  
  // Utility functions
  getTokenPrice: (tokenAddress: string, tokensSold: number) => TokenPriceData | null;
  getTokenMarketCap: (tokenAddress: string, tokensSold: number) => number | null;
}

export const useTokenMarketData = (): TokenMarketData => {
  const { tokens, loading, error } = useTokenData();
  const { aptPrice, loading: aptPriceLoading, error: aptPriceError } = useAptPrice();

  // We now fetch tokensSold for each token in useTokenData
  // This provides real-time price data based on actual sales

  // Calculate market data for each token
  const tokenMarketData = useMemo(() => {
    if (!tokens || !aptPrice) {
      return {};
    }

    const marketData: TokenMarketData['tokenMarketData'] = {};

    tokens.forEach(token => {
      if (token.metadataAddress) {
        // Get tokens sold from the token data
        const tokensSold = token.tokensSold;
        
        // Calculate current price in APT
        const currentPriceApt = calculateCurrentPrice(tokensSold);
        
        // Calculate current price in USD
        const currentPriceUsd = currentPriceApt * aptPrice;
        
        // Calculate market cap in USD
        const marketCapUsd = calculateMarketCap(tokensSold, aptPrice);
        
        // Helper functions for cost calculations
        const buyCostApt = (tokenAmount: number) => {
          return calculateBuyCost(tokensSold, tokenAmount);
        };
        
        const buyCostUsd = (tokenAmount: number) => {
          return buyCostApt(tokenAmount) * aptPrice;
        };
        
        const tokensForApt = (aptAmount: number) => {
          // Simple calculation: tokens = aptAmount / currentPrice
          return aptAmount / currentPriceApt;
        };

        marketData[token.metadataAddress] = {
          currentPriceApt,
          currentPriceUsd,
          marketCapUsd,
          buyCostApt,
          buyCostUsd,
          tokensForApt
        };
      }
    });

    return marketData;
  }, [tokens, aptPrice]);

  // Utility function to get token price data
  const getTokenPrice = (tokenAddress: string, tokensSold: number): TokenPriceData | null => {
    if (!aptPrice) return null;
    
    return {
      priceInApt: calculateCurrentPrice(tokensSold),
      priceInUsd: calculateCurrentPrice(tokensSold) * aptPrice,
      aptCost: 0, // Will be calculated when tokenAmount is provided
      usdCost: 0
    };
  };

  // Utility function to get token market cap
  const getTokenMarketCap = (tokenAddress: string, tokensSold: number): number | null => {
    if (!aptPrice) return null;
    return calculateMarketCap(tokensSold, aptPrice);
  };

  return {
    tokens,
    loading,
    error,
    aptPrice,
    aptPriceLoading,
    aptPriceError,
    tokenMarketData,
    getTokenPrice,
    getTokenMarketCap
  };
};
*/

// Empty export to make this file a module
export {}; 