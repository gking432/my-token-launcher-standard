import { useEffect, useRef } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { AptosClient } from "aptos";
import { useGraduationHandler } from '../hooks/useGraduation';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { GraduationReadyEvent } from '../types/graduation';
import { MODULE_ADDRESS, RESOURCE_ADDRESS } from '../config';

export const GraduationListener: React.FC = () => {
  const { account } = useWallet();
  const { handleGraduation } = useGraduationHandler();
  const lastCheckedRef = useRef<number>(0);
  const isVisible = usePageVisibility();
  
  useEffect(() => {
    if (!account) return;
    
    const client = new AptosClient("https://fullnode.testnet.aptoslabs.com");
    const API_KEY = "aptoslabs_X7pogeAv3Za_M35uoXPYzbEC8bJwNKAt36hzZagRmJHPE";
    
    const checkForGraduationEvents = async () => {
      try {
        console.log('Checking for graduation events...');
        
        // Use direct REST API with API key to avoid rate limiting
        const url = `https://fullnode.testnet.aptoslabs.com/v1/accounts/${MODULE_ADDRESS}/events/${MODULE_ADDRESS}::token_launcher::ModuleState/graduation_events?start=${lastCheckedRef.current}&limit=10`;
        
        const response = await fetch(url, {
          headers: { "x-api-key": API_KEY },
        });
        
        if (response.status === 429) {
          console.warn("Rate limit exceeded for graduation events, retrying...");
          // Add retry logic
          await new Promise(resolve => setTimeout(resolve, 5000));
          return;
        }
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const events = await response.json();
        
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
    
    // Check once on mount if visible - no continuous polling
    // Graduation events are rare, so continuous polling is wasteful
    // Consider using gRPC streaming or WebSocket for real-time graduation events
    if (isVisible) {
      console.log('▶️ GraduationListener: Checking for graduation events (one-time)');
      checkForGraduationEvents();
    } else {
      console.log('⏸️ GraduationListener: Paused (tab hidden)');
    }
    
    // No cleanup needed since we're not using intervals anymore
  }, [account, handleGraduation, isVisible]);
  
  // This component doesn't render anything
  return null;
}; 