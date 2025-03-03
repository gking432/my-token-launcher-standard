// src/components/WalletConnect.tsx
import React from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

const WalletConnect: React.FC = () => {
  const { connect, account, wallets } = useWallet();

  return (
    <div className="p-4">
      {account ? (
        <p>Wallet Connected: {String(account.address)}</p>
      ) : (
        <div>
          {wallets.length > 0 ? (
            wallets.map((wallet) => (
              <button
                key={wallet.name}
                onClick={() => connect(wallet.name)}
                className="m-2 p-2 border rounded"
              >
                Connect with {wallet.name}
              </button>
            ))
          ) : (
            <p>No wallets available</p>
          )}
        </div>
      )}
    </div>
  );
};

export default WalletConnect;
