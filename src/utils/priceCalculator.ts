// Price calculation constants from the bonding curve document
const PRICE_NUMERATOR = 19029514756; // 19,029,514,756
const PRICE_CONSTANT = 61.9053276; // 61.9053276 Octas
const MAX_TOKENS = 800000000; // 800,000,000 total supply

export interface TokenPriceData {
  priceInApt: number;
  priceInUsd: number;
  aptCost: number;
  usdCost: number;
}

export interface BondingCurveParams {
  tokensSold: number;
  tokenAmount: number;
  aptPrice: number;
}

/**
 * Calculate the current price of a token using the bonding curve formula
 * Formula: Price (Octas/token) = (19,029,514,756 / (800,000,000 - tokens_sold)) + 61.9053276
 * Then: Price (APT/token) = Price (Octas/token) / 10^8
 * @param tokensSold - Number of tokens already sold
 * @returns Price in APT
 */
export const calculateCurrentPrice = (tokensSold: number): number => {
  const denominator = MAX_TOKENS - tokensSold;

  if (denominator <= 0) {
    throw new Error('All tokens have been sold');
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

/**
 * Calculate the cost to buy a specific amount of tokens
 * Uses the average price between before and after the purchase
 * @param tokensSold - Number of tokens already sold
 * @param tokenAmount - Number of tokens to buy
 * @returns Cost in APT
 */
export const calculateBuyCost = (tokensSold: number, tokenAmount: number): number => {
  if (tokenAmount <= 0) {
    return 0;
  }
  
  const tokensSoldBefore = tokensSold;
  const tokensSoldAfter = tokensSold + tokenAmount;
  
  // Calculate prices before and after purchase
  const priceBefore = calculateCurrentPrice(tokensSoldBefore);
  const priceAfter = calculateCurrentPrice(tokensSoldAfter);
  
  // Use average price for cost calculation
  const averagePrice = (priceBefore + priceAfter) / 2;
  
  // Calculate cost: average price * token amount
  return averagePrice * tokenAmount;
};

/**
 * Calculate token price and cost in both APT and USD
 * @param params - Bonding curve parameters
 * @returns Token price data
 */
export const calculateTokenPrice = (params: BondingCurveParams): TokenPriceData => {
  const { tokensSold, tokenAmount, aptPrice } = params;
  
  // Calculate current price per token in APT
  const priceInApt = calculateCurrentPrice(tokensSold);
  
  // Calculate cost for the specified amount in APT
  const aptCost = calculateBuyCost(tokensSold, tokenAmount);
  
  // Convert to USD using APT price
  const priceInUsd = priceInApt * aptPrice;
  const usdCost = aptCost * aptPrice;
  
  return {
    priceInApt,
    priceInUsd,
    aptCost,
    usdCost
  };
};

/**
 * Calculate the number of tokens that can be bought with a given APT amount
 * @param tokensSold - Number of tokens already sold
 * @param aptAmount - Amount of APT to spend
 * @returns Number of tokens that can be bought
 */
export const calculateTokensForApt = (tokensSold: number, aptAmount: number): number => {
  if (aptAmount <= 0) {
    return 0;
  }
  
  // Use binary search to find the right amount
  let low = 0;
  let high = 800_000_000 - tokensSold; // Max tokens available
  let result = 0;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const cost = calculateBuyCost(tokensSold, mid);
    
    if (cost <= aptAmount) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  
  return result;
};

/**
 * Calculate market cap for a token
 * @param tokensSold - Number of tokens sold
 * @param aptPrice - Current APT price in USD
 * @returns Market cap in USD
 */
export const calculateMarketCap = (tokensSold: number, aptPrice: number): number => {
  const currentPrice = calculateCurrentPrice(tokensSold);
  const totalSupply = 800_000_000; // Total token supply
  const marketCapApt = currentPrice * totalSupply;
  return marketCapApt * aptPrice;
};

/**
 * Format price for display
 * @param price - Price in USD
 * @returns Formatted price string
 */
export const formatPrice = (price: number): string => {
  if (price < 0.0001) return `$${price.toFixed(8)}`;
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(2)}`;
};

/**
 * Format market cap for display
 * @param marketCap - Market cap in USD
 * @returns Formatted market cap string
 */
export const formatMarketCap = (marketCap: number): string => {
  if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(1)}B`;
  if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(1)}M`;
  if (marketCap >= 1e3) return `$${(marketCap / 1e3).toFixed(1)}K`;
  return `$${marketCap.toFixed(0)}`;
}; 