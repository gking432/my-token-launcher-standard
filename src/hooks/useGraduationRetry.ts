import { useEffect, useRef } from 'react';
import { getPendingGraduations, updateGraduationAttempt, clearGraduationAttempt } from '../utils/graduationStorage';
import { useGraduationHandler } from './useGraduation';
import { usePageVisibility } from './usePageVisibility';

export const useGraduationRetry = () => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { handleGraduation } = useGraduationHandler();
  const isVisible = usePageVisibility();
  
  const retryGraduation = async (metadata_addr: string) => {
    const pending = getPendingGraduations();
    const attempt = pending[metadata_addr];
    
    if (!attempt) return;
    
    // Check if max attempts reached
    if (attempt.attempts >= attempt.max_attempts) {
      console.log('Max graduation attempts reached for:', metadata_addr);
      updateGraduationAttempt(metadata_addr, { status: 'failed' });
      return;
    }
    
    // Check if enough time has passed
    if (Date.now() - attempt.last_attempt < attempt.retry_interval) {
      return; // Not time to retry yet
    }
    
    console.log(`Retrying graduation for ${metadata_addr} (attempt ${attempt.attempts + 1})`);
    
    try {
      // Attempt graduation again
      await handleGraduation({
        metadata_addr: attempt.metadata_addr,
        token_amount: attempt.token_amount,
        apt_amount: attempt.apt_amount,
        timestamp: Date.now()
      });
      
      // Success - clear attempt
      clearGraduationAttempt(metadata_addr);
      
    } catch (error) {
      console.error('Retry failed for:', metadata_addr, error);
      
      // Update attempt count and timestamp
      updateGraduationAttempt(metadata_addr, {
        attempts: attempt.attempts + 1,
        last_attempt: Date.now()
      });
    }
  };
  
  // No continuous polling - only retry when explicitly called
  // Graduation retries should be triggered by user actions or specific events
  // Continuous polling is wasteful since graduations are rare events
  // Remove this useEffect - retryGraduation can be called manually when needed
  
  return { retryGraduation };
}; 