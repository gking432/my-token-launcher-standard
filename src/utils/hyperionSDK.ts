import { Network } from "@aptos-labs/ts-sdk";
import { initHyperionSDK, FeeTierIndex } from '@hyperionxyz/sdk';

// Only initialize SDK if API key is available
let hyperionSDK: any = null;
try {
  const apiKey = process.env.REACT_APP_APTOS_API_KEY || "placeholder_key_for_testing";
  hyperionSDK = initHyperionSDK({
    network: Network.TESTNET, // Use TESTNET since DEVNET not supported by Hyperion
    APTOS_API_KEY: apiKey
  });
  console.log('Hyperion SDK initialized for testnet');
} catch (error) {
  console.warn('Hyperion SDK not initialized - API key missing:', error);
}

export { hyperionSDK };
export const FEE_TIER_INDEX = FeeTierIndex["PER_0.05_SPACING_5"];
export const DEAD_ADDRESS = "0x0000000000000000000000000000000000000000000000000000000000000000"; 