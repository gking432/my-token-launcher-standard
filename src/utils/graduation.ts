import { hyperionSDK, FEE_TIER_INDEX, DEAD_ADDRESS } from './hyperionSDK';
import { priceToTick, LowestTickByStep, HighestTickByStep } from '@hyperionxyz/sdk';
import { PositionInfo } from '../types/graduation';

// Calculate final bonding curve price at graduation
export const calculateGraduationPrice = (tokensSold: number, aptSpent: number): number => {
  // This should match your bonding curve calculation
  // For now, using a simple ratio - adjust to match your actual curve
  return aptSpent / tokensSold;
};

// Create pool with full-range liquidity
export const createGraduationPool = async (
  tokenMetadata: string,
  tokenAmount: number,
  aptAmount: number,
  finalPrice: number,
  slippage: number = 0.1
) => {
  if (!hyperionSDK) {
    throw new Error('Hyperion SDK not initialized - API key required');
  }

  // Full range ticks for maximum liquidity
  const tickLower = LowestTickByStep[FEE_TIER_INDEX];
  const tickUpper = HighestTickByStep[FEE_TIER_INDEX];
  
  // Calculate current price tick based on final bonding curve price
  const decimalsRatio = Math.pow(10, 8 - 6); // Assuming 8 decimals for APT, 6 for tokens
  const priceTickResult = priceToTick({
    price: finalPrice,
    feeTierIndex: FEE_TIER_INDEX,
    decimalsRatio
  });
  
  // Convert BigNumber to number, default to 0 if null
  const currentPriceTick = priceTickResult ? Number(priceTickResult) : 0;
  
  const params = {
    currencyA: tokenMetadata,
    currencyB: "0x1::aptos_coin::AptosCoin",
    currencyAAmount: tokenAmount,
    currencyBAmount: aptAmount,
    feeTierIndex: FEE_TIER_INDEX,
    currentPriceTick,
    tickLower,
    tickUpper,
    slippage
  };
  
  return await hyperionSDK.Pool.createPoolTransactionPayload(params);
};

// Lock LP tokens by sending to dead address
export const lockLPTokens = async (positionId: string, lpTokenAmount: number) => {
  const payload = {
    function: "0x1::fungible_asset::transfer",
    typeArguments: [`${positionId}::lp_token::LPToken`], // LP token type
    functionArguments: [
      DEAD_ADDRESS,
      lpTokenAmount
    ]
  };
  
  return payload;
};

// Get position info from pool creation transaction
export const getPositionInfoFromPool = async (txHash: string): Promise<PositionInfo> => {
  // This will need to be implemented based on Hyperion's actual event structure
  // For now, returning mock data - you'll need to parse the actual transaction events
  return {
    positionId: `position_${txHash.slice(0, 8)}`,
    lpTokenAmount: 1000000 // Mock amount - get from actual transaction
  };
}; 