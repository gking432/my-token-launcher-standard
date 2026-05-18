import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useTheme } from '../contexts/ThemeContext';
import BoostBar from './BoostBar';

const AppHeader: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const { account, connect, disconnect, wallets } = useWallet();
  const navigate = useNavigate();

  const [walletOpen, setWalletOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const walletRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) {
        setWalletOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/marketplace?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const truncateAddr = (addr: string) => {
    const s = addr.toString();
    return `${s.slice(0, 6)}…${s.slice(-4)}`;
  };

  const handleCopy = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <>
      <style>{`
        .ah-header {
          position: sticky; top: 0; z-index: 200; height: 60px;
          background: ${isDark ? 'rgba(0,0,0,0.82)' : 'rgba(255,255,255,0.88)'};
          backdrop-filter: saturate(180%) blur(20px);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
          border-bottom: 1px solid var(--border);
        }
        .ah-nav {
          max-width: 1280px; margin: 0 auto; height: 100%;
          padding: 0 24px; display: flex; align-items: center; gap: 6px;
        }
        .ah-logo {
          display: flex; align-items: center; gap: 9px; flex-shrink: 0;
          font-size: 18px; font-weight: 700; letter-spacing: -0.025em;
          color: var(--text-primary); text-decoration: none;
        }
        .ah-logo-mark {
          width: 28px; height: 28px; border-radius: 9px;
          background: linear-gradient(145deg, var(--accent), var(--accent-hover));
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 15px; font-weight: 800;
          box-shadow: 0 2px 8px rgba(5,150,105,0.35); flex-shrink: 0;
        }
        .ah-spacer { flex: 1; min-width: 12px; }
        .ah-search-wrap { position: relative; flex-shrink: 0; }
        .ah-search {
          width: 210px; height: 34px; padding: 0 12px 0 34px;
          background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: 10px; font-size: 13px; font-family: inherit;
          color: var(--text-primary); outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, width 0.2s;
        }
        .ah-search:focus {
          border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); width: 260px;
        }
        .ah-search::placeholder { color: var(--text-muted); }
        .ah-search-icon {
          position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
          color: var(--text-muted); font-size: 13px; pointer-events: none;
          line-height: 1;
        }
        .ah-links {
          display: flex; gap: 2px; list-style: none; margin: 0; padding: 0;
          flex-shrink: 0;
        }
        .ah-links a {
          font-size: 14px; font-weight: 500; color: var(--text-secondary);
          text-decoration: none; padding: 7px 12px; border-radius: 8px;
          transition: color 0.12s, background 0.12s; white-space: nowrap;
        }
        .ah-links a:hover { color: var(--text-primary); background: var(--bg-secondary); }
        .ah-wallet-wrap { position: relative; flex-shrink: 0; }
        .ah-connect-btn {
          background: var(--accent); color: #fff;
          padding: 8px 16px; border-radius: 10px;
          font-size: 13.5px; font-weight: 600; border: none; cursor: pointer;
          font-family: inherit; box-shadow: 0 2px 10px rgba(5,150,105,0.3);
          transition: background 0.15s; white-space: nowrap;
        }
        .ah-connect-btn:hover { background: var(--accent-hover); }
        .ah-addr-btn {
          display: flex; align-items: center; gap: 7px;
          background: var(--bg-secondary); border: 1.5px solid var(--border);
          padding: 7px 12px; border-radius: 10px;
          font-size: 13px; font-weight: 600; cursor: pointer;
          font-family: inherit; color: var(--text-primary);
          transition: background 0.12s, border-color 0.12s; white-space: nowrap;
        }
        .ah-addr-btn:hover { background: var(--bg-hover); border-color: var(--accent); }
        .ah-addr-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--accent); flex-shrink: 0;
        }
        .ah-addr-chevron { font-size: 10px; color: var(--text-muted); }
        .ah-dropdown {
          position: absolute; right: 0; top: calc(100% + 8px); z-index: 300;
          background: var(--bg-primary); border: 1px solid var(--border);
          border-radius: 14px; padding: 8px;
          box-shadow: 0 12px 32px ${isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.12)'};
          min-width: 210px;
        }
        .ah-drop-title {
          font-size: 11px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.07em;
          padding: 4px 10px 8px;
        }
        .ah-drop-item {
          display: flex; align-items: center; gap: 10px;
          width: 100%; padding: 9px 10px; border-radius: 9px;
          background: none; border: none; cursor: pointer;
          font-size: 14px; font-weight: 500; color: var(--text-primary);
          font-family: inherit; text-align: left; text-decoration: none;
          transition: background 0.1s;
        }
        .ah-drop-item:hover { background: var(--bg-secondary); }
        .ah-drop-item.danger {
          color: var(--negative);
        }
        .ah-drop-item.danger:hover {
          background: ${isDark ? 'rgba(215,0,21,0.10)' : 'rgba(215,0,21,0.06)'};
        }
        .ah-drop-sep { height: 1px; background: var(--border); margin: 6px 0; }
        .ah-wallet-opt {
          display: flex; align-items: center; gap: 10px;
          width: 100%; padding: 10px 10px; border-radius: 9px;
          background: none; border: none; cursor: pointer;
          font-size: 14px; font-weight: 500; color: var(--text-primary);
          font-family: inherit; text-align: left;
          transition: background 0.1s;
        }
        .ah-wallet-opt:hover { background: var(--bg-secondary); }
        .ah-wallet-img {
          width: 28px; height: 28px; border-radius: 8px; object-fit: cover; flex-shrink: 0;
        }
        .ah-wallet-placeholder {
          width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
          background: var(--bg-secondary); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; color: var(--text-muted);
        }
        .ah-theme-btn {
          background: var(--bg-secondary); border: 1px solid var(--border);
          width: 34px; height: 34px; border-radius: 9px; cursor: pointer;
          font-size: 14px; display: flex; align-items: center; justify-content: center;
          color: var(--text-secondary); transition: background 0.15s; flex-shrink: 0;
          font-family: inherit;
        }
        .ah-theme-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        @media (max-width: 900px) { .ah-links { display: none; } }
        @media (max-width: 680px) {
          .ah-search { width: 140px; }
          .ah-search:focus { width: 180px; }
        }
        @media (max-width: 480px) { .ah-search-wrap { display: none; } }
      `}</style>

      <header className="ah-header">
        <div className="ah-nav">
          <Link to="/" className="ah-logo">
            <div className="ah-logo-mark">M</div>
            MoveMint
          </Link>

          <div className="ah-spacer" />

          <div className="ah-search-wrap">
            <span className="ah-search-icon">&#9906;</span>
            <input
              type="text"
              className="ah-search"
              placeholder="Search tokens…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKey}
            />
          </div>

          <ul className="ah-links">
            <li><Link to="/marketplace">Marketplace</Link></li>
            <li><Link to="/boost">Boost</Link></li>
            <li><Link to="/launch">Launch</Link></li>
            <li><Link to="/about">About</Link></li>
            {account && <li><Link to={`/profile/${account.address}`}>Profile</Link></li>}
          </ul>

          <div className="ah-wallet-wrap" ref={walletRef}>
            {account ? (
              <>
                <button className="ah-addr-btn" onClick={() => setWalletOpen(v => !v)}>
                  <span className="ah-addr-dot" />
                  {truncateAddr(account.address.toString())}
                  <span className="ah-addr-chevron">&#9660;</span>
                </button>
                {walletOpen && (
                  <div className="ah-dropdown">
                    <div className="ah-drop-title">Wallet</div>
                    <button className="ah-drop-item" onClick={handleCopy}>
                      {copied ? 'Copied!' : 'Copy address'}
                    </button>
                    <Link
                      to={`/profile/${account.address}`}
                      className="ah-drop-item"
                      onClick={() => setWalletOpen(false)}
                    >
                      Profile
                    </Link>
                    <div className="ah-drop-sep" />
                    <button
                      className="ah-drop-item danger"
                      onClick={() => { disconnect(); setWalletOpen(false); }}
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <button className="ah-connect-btn" onClick={() => setWalletOpen(v => !v)}>
                  Connect Wallet
                </button>
                {walletOpen && (
                  <div className="ah-dropdown">
                    <div className="ah-drop-title">Choose a wallet</div>
                    {wallets.length === 0 ? (
                      <div style={{ padding: '8px 10px', fontSize: 13, color: 'var(--text-muted)' }}>
                        No wallets detected. Install Petra or another Aptos wallet.
                      </div>
                    ) : wallets.map(wallet => (
                      <button
                        key={wallet.name}
                        className="ah-wallet-opt"
                        onClick={() => { connect(wallet.name); setWalletOpen(false); }}
                      >
                        {wallet.icon ? (
                          <img src={wallet.icon} alt={wallet.name} className="ah-wallet-img" />
                        ) : (
                          <div className="ah-wallet-placeholder">
                            {wallet.name.charAt(0)}
                          </div>
                        )}
                        {wallet.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <button
            className="ah-theme-btn"
            onClick={toggleTheme}
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            {isDark ? '☀' : '☾'}
          </button>
        </div>
      </header>
      <BoostBar />
    </>
  );
};

export default AppHeader;
