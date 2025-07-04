import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { GraduationReadyEvent, GraduationAttempt } from '../types/graduation';
import { createGraduationPool, lockLPTokens, getPositionInfoFromPool, calculateGraduationPrice } from '../utils/graduation';
import { saveGraduationAttempt, clearGraduationAttempt } from '../utils/graduationStorage';
import { InputTransactionData } from '@aptos-labs/wallet-adapter-core';

export const useGraduationHandler = () => {
  const { signAndSubmitTransaction, connected } = useWallet();
  
  const handleGraduation = async (event: GraduationReadyEvent) => {
    try {
      console.log('Starting graduation for token:', event.metadata_addr);
      
      // Check if wallet is connected
      if (!connected) {
        console.log('Wallet not connected - skipping graduation for:', event.metadata_addr);
        // Flag for retry when wallet connects
        await flagForRetry(event);
        return;
      }
      
      // Calculate final bonding curve price
      const finalPrice = calculateGraduationPrice(event.token_amount, event.apt_amount);
      
      // 1. Create pool with full-range liquidity
      const poolPayload = await createGraduationPool(
        event.token_metadata || getTokenMetadata(event.metadata_addr),
        event.token_amount,
        event.apt_amount,
        finalPrice
      );
      
      // 2. Submit pool creation transaction using wallet adapter
      const poolTx = await signAndSubmitTransaction(poolPayload);
      
      console.log('Pool creation transaction submitted:', poolTx.hash);
      
      // 3. Get position info from pool creation
      const positionInfo = await getPositionInfoFromPool(poolTx.hash);
      
      // 4. Lock LP tokens by sending to dead address
      const lockPayload = await lockLPTokens(positionInfo.positionId, positionInfo.lpTokenAmount);
      const lockTransaction: InputTransactionData = {
        data: {
          function: lockPayload.function as `${string}::${string}::${string}`,
          typeArguments: lockPayload.typeArguments,
          functionArguments: lockPayload.functionArguments
        }
      };
      const lockTx = await signAndSubmitTransaction(lockTransaction);
      
      console.log('LP token locking transaction submitted:', lockTx.hash);
      
      // 5. Success - clear any pending retries
      clearGraduationAttempt(event.metadata_addr);
      console.log('Graduation completed successfully for:', event.metadata_addr);
      
    } catch (error) {
      console.error('Graduation failed for token:', event.metadata_addr, error);
      
      // Flag for automatic retry
      await flagForRetry(event);
    }
  };
  
  const flagForRetry = async (event: GraduationReadyEvent) => {
    const attempt: GraduationAttempt = {
      metadata_addr: event.metadata_addr,
      token_amount: event.token_amount,
      apt_amount: event.apt_amount,
      attempts: 0,
      last_attempt: Date.now(),
      max_attempts: 10,
      retry_interval: 600000, // 10 minutes
      status: 'pending'
    };
    
    saveGraduationAttempt(attempt);
    console.log('Token flagged for retry:', event.metadata_addr);
  };
  
  return { handleGraduation };
};

// Helper function to get token metadata (you'll need to implement this)
const getTokenMetadata = (metadata_addr: string): string => {
  // Return the metadata address directly - this is the fungible asset metadata object address
  return metadata_addr;
}; 