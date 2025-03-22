import React, { useState, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Link } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import GoogleLogin from './GoogleLogin';
import WalletConnectModal from './WalletConnectModal';

const Header: React.FC = () => {
  const { connect, account, wallets, disconnect } = useWallet();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.wallet-dropdown')) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const toggleTheme = () => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    setIsDarkMode(!isDarkMode);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const toggleDropdown = (event: React.MouseEvent) => {
    event.stopPropagation();
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

  const handleDisconnect = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await disconnect();
      localStorage.removeItem("connectedWallet");
      setDropdownOpen(false);
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
    <>
      <nav className="top-nav">
        <Link to="/docs" className="nav-link">Docs</Link>
        <Link to="/support" className="nav-link">Support</Link>
        <div className="theme-switch-wrapper">
          <span className="theme-icon">☉</span>
          <label className="theme-switch">
            <input 
              type="checkbox" 
              checked={isDarkMode}
              onChange={toggleTheme}
            />
            <span className="slider round"></span>
          </label>
          <span className="theme-icon">☾</span>
        </div>
      </nav>
      
      <header className="main-header">
        <Link to="/" className="logo">
          Mint<span className="dot">.</span>
        </Link>

        <div className="search-container">
          <input type="text" placeholder="Search for a token..." className="search-bar" />
        </div>

        <div className="nav-links">
          {account ? (
            <div className="wallet-dropdown">
              <button className="wallet-btn" onClick={toggleDropdown}>
                {String(account.address).slice(0, 6)}...
              </button>
              {dropdownOpen && (
                <div className="dropdown-menu">
                  <Link 
                    to="/profile" 
                    className="dropdown-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDropdownOpen(false);
                    }}
                  >
                    Profile
                  </Link>
                  <button onClick={handleDisconnect} className="dropdown-item">
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsModalOpen(true)}
              className="wallet-btn"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      <WalletConnectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};

export default Header;