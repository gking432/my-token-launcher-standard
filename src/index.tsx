import React from 'react';
import ReactDOM from 'react-dom/client';
import { AptosWalletAdapterProvider, useWallet } from '@aptos-labs/wallet-adapter-react';
import { AvailableWallets } from '@aptos-labs/wallet-adapter-core';
import App from './App';

// Define available wallets
const optInWallets: readonly AvailableWallets[] = [
  "Petra" as AvailableWallets,
  "Fewcha" as AvailableWallets,
  "Rise" as AvailableWallets,
];

// Function to log wallets
const WalletDebugger = () => {
  const { wallets } = useWallet();
  console.log("Available wallets:", wallets);
  return null;
};

// Render App
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AptosWalletAdapterProvider 
      optInWallets={optInWallets} 
      autoConnect={false}
    >
      <WalletDebugger /> {/* Logs wallets to console */}
      <App />
    </AptosWalletAdapterProvider>
  </React.StrictMode>
);