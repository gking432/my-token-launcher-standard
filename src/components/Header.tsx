import React, { useState, useEffect } from 'react';
import '../MoveMint.css';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

const Header: React.FC = () => {
  const { connect, account, wallets, disconnect } = useWallet();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  useEffect(() => {
    const savedWallet = localStorage.getItem("connectedWallet");

    if (savedWallet && !account && !isConnecting) {
      setIsConnecting(true);
      (async () => {
        try {
          await connect(savedWallet);
        } catch (err) {
          console.error("Auto-connect error:", err);
        } finally {
          setIsConnecting(false);
        }
      })();
    }
  }, [connect, account]);

  const handleDisconnect = async () => {
    try {
      await disconnect();
      localStorage.removeItem("connectedWallet");
      window.location.reload();
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
    }
  };

  const handleConnect = async (walletName: string) => {
    try {
      if (!account) {
        await connect(walletName);
        localStorage.setItem("connectedWallet", walletName);
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      if (String(error).includes("User has rejected the request")) {
        console.warn("User rejected the wallet connection.");
        localStorage.removeItem("connectedWallet");
      }
    }
  };

  return (
    <header className="main-header"> {/* Remove 'container' class */}
      <div className="top-nav">
        <a href="#">Docs</a>
        <a href="#">Support</a>
      </div>

      <div className="header-left">
        <a href="/">
          <img src="assets/logo.svg" alt="MoveMint Logo" className="logo" />
        </a>
      </div>

      <div className="search-container">
        <img src="assets/magnifyingglass.svg" alt="Search Icon" className="search-icon" />
        <input type="text" placeholder="Search for a token..." className="search-bar" />
      </div>

      <div className="header-right">
        {account ? (
          <div className="wallet-dropdown">
            <button className="wallet-button" onClick={toggleDropdown}>
              <img src="/assets/greenwallet.svg" alt="Wallet Icon" className="wallet-icon" />
              {String(account.address).slice(0, 6)}...
            </button>

            {dropdownOpen && (
              <div className="wallet-menu">
                <a href="/profile">Profile</a>
                <button onClick={handleDisconnect}>Disconnect</button>
              </div>
            )}
          </div>
        ) : (
          wallets.length > 0 ? (
            wallets.map((wallet) => (
              <button
                key={wallet.name}
                onClick={() => handleConnect(wallet.name)}
                className="connect-wallet"
              >
                <img src="/assets/walleticon.svg" alt="Wallet Icon" className="wallet-icon" />
                Connect
              </button>
            ))
          ) : (
            <p>No wallets available</p>
          )
        )}
      </div>
    </header>
  );
};

export default Header;