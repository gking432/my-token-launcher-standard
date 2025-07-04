import { useEffect, useRef } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { AptosClient } from "aptos";
import { useGraduationHandler } from '../hooks/useGraduation';
import { useGraduationRetry } from '../hooks/useGraduationRetry';
import { GraduationReadyEvent } from '../types/graduation';
import { MODULE_ADDRESS, RESOURCE_ADDRESS } from '../config';

export const GraduationListener: React.FC = () => {
  const { account } = useWallet();
  const { handleGraduation } = useGraduationHandler();
  const { retryGraduation } = useGraduationRetry();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckedRef = useRef<number>(0);
  
  useEffect(() => {
    if (!account) return;
    
    const client = new AptosClient("https://fullnode.devnet.aptoslabs.com");
    
    const checkForGraduationEvents = async () => {
      try {
        console.log('Checking for graduation events...');
        
        // Get recent transactions for the token launcher contract
        // Use module address for the ModuleState event handle
        const events = await client.getEventsByEventHandle(
          MODULE_ADDRESS,
          `${MODULE_ADDRESS}::token_launcher::ModuleState`,
          "graduation_events",
          { start: lastCheckedRef.current, limit: 10 }
        );
        
        for (const event of events) {
          const graduationEvent: GraduationReadyEvent = {
            metadata_addr: event.data.metadata_addr,
            token_amount: 0, // Not provided in TokenGraduatedEvent
            apt_amount: parseInt(event.data.market_cap_at_graduation),
            timestamp: parseInt(event.data.timestamp),
            token_metadata: event.data.metadata_addr // Use metadata_addr as token_metadata
          };
          
          console.log('Graduation event detected:', graduationEvent);
          await handleGraduation(graduationEvent);
        }
        
        // Update last checked timestamp
        lastCheckedRef.current = Date.now();
        
      } catch (error) {
        console.error('Error checking for graduation events:', error);
      }
    };
    
    // Check immediately
    checkForGraduationEvents();
    
    // Then check every 30 seconds
    intervalRef.current = setInterval(checkForGraduationEvents, 30000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [account, handleGraduation]);
  
  // This component doesn't render anything
  return null;
}; 