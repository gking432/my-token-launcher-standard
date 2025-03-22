import React from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import GoogleLogin from './GoogleLogin';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WalletConnectModal: React.FC<WalletConnectModalProps> = ({ isOpen, onClose }) => {
  const { connect, wallets } = useWallet();

  // Add debug logging
  console.log("Available wallets in modal:", wallets);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="wallet-connect-modal">
        <div className="modal-header">
          <h2>Connect Wallet</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-content">
          <div className="wallets-section">
            <h3>Available Wallets</h3>
            <div className="wallet-list">
              {wallets.map((wallet) => {
                console.log("Rendering wallet:", wallet.name);
                return (
                  <button
                    key={wallet.name}
                    onClick={() => {
                      connect(wallet.name);
                      onClose();
                    }}
                    className="wallet-option"
                  >
                    <img src={wallet.icon} alt={wallet.name} className="wallet-icon" />
                    <span>{wallet.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="divider">
            <span>or</span>
          </div>

          <div className="google-section">
            
            <GoogleOAuthProvider clientId="YOUR_GOOGLE_CLIENT_ID">
              <GoogleLogin />
            </GoogleOAuthProvider>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletConnectModal; 