import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useTheme } from '../contexts/ThemeContext';
import { useTokenData } from '../hooks/useTokenData';
import { useWatchlist } from '../contexts/WatchlistContext';
import BoostBar from './BoostBar';
import TokenAvatar from './TokenAvatar';
import { truncateAddress } from '../utils/format';
import { BOOST_ENABLED } from '../featureFlags';
import Logo from './Logo';

interface AppHeaderProps {
  launchCta?: boolean;
  narrow?: boolean;
  hideBoostBar?: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  launchCta = false,
  narrow = false,
  hideBoostBar = false,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const { account, connect, disconnect, wallets } = useWallet();
  const { tokens } = useTokenData();
  const { watchlist } = useWatchlist();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [walletOpen, setWalletOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchIndex, setSearchIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [launchClicked, setLaunchClicked] = useState(false);
  const showLaunchCta = launchCta && !launchClicked;

  const walletRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Prevent body scroll while the mobile drawer is open.
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) {
        setWalletOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { matches, totalMatchCount } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^\$/, '');
    if (!q) return { matches: [], totalMatchCount: 0 };
    const all = tokens.filter(t => {
      const sym = (t.symbol || '').toLowerCase().replace(/^\$/, '');
      const name = (t.name || '').toLowerCase();
      return sym.includes(q) || name.includes(q);
    });
    return { matches: all.slice(0, 6), totalMatchCount: all.length };
  }, [searchQuery, tokens]);

  const seeAllInMarketplace = () => {
    const q = searchQuery.trim();
    setSearchOpen(false);
    setSearchQuery('');
    navigate(`/marketplace?q=${encodeURIComponent(q)}`);
  };

  useEffect(() => { setSearchIndex(0); }, [searchQuery]);

  const gotoToken = (addr: string) => {
    setSearchOpen(false);
    setSearchQuery('');
    navigate(`/newtoken/${addr}`);
  };

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchIndex(i => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = matches[searchIndex];
      const addr = picked.metadataAddress || picked.txHash;
      if (addr) gotoToken(addr);
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
    }
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
          height: 100%;
          padding: 0 24px;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 12px;
        }
        .ah-nav.narrow { max-width: 1280px; margin: 0 auto; }
        .ah-nav-left {
          display: flex; align-items: center; gap: 6px;
        }
        .ah-nav-right {
          display: flex; align-items: center; gap: 6px; justify-content: flex-end;
        }
        .ah-logo {
          display: flex; align-items: center; flex-shrink: 0;
          text-decoration: none;
        }
        .ah-logo-img {
          height: 34px; width: auto; display: block;
        }
        .ah-search-wrap { position: relative; }
        .ah-search {
          width: 360px; height: 36px; padding: 0 14px 0 36px;
          background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: 10px; font-size: 13.5px; font-family: inherit;
          color: var(--text-primary); outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, width 0.2s;
        }
        .ah-search:focus {
          border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); width: 440px;
        }
        .ah-search::placeholder { color: var(--text-muted); }
        .ah-search-icon {
          position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
          color: var(--text-muted); font-size: 13px; pointer-events: none;
          line-height: 1;
        }
        .ah-search-pop {
          position: absolute; top: calc(100% + 6px); left: 0;
          width: 440px; max-height: 420px; overflow-y: auto;
          background: var(--bg-primary); border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: 0 12px 32px ${isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.12)'};
          padding: 6px; z-index: 300;
        }
        .ah-search-empty {
          padding: 16px 12px; color: var(--text-muted);
          font-size: 13px; text-align: center;
        }
        .ah-search-item {
          display: flex; align-items: center; gap: 10px;
          width: 100%; padding: 8px 10px; border-radius: 9px;
          background: none; border: none; cursor: pointer;
          font-family: inherit; text-align: left;
          transition: background 0.1s;
        }
        .ah-search-item.active, .ah-search-item:hover { background: var(--bg-secondary); }
        .ah-search-icon-img {
          width: 32px; height: 32px; border-radius: 8px;
          flex-shrink: 0; font-size: 13px; color: var(--text-secondary);
          font-weight: 700;
        }
        .ah-search-meta { min-width: 0; flex: 1; }
        .ah-search-name {
          font-size: 13.5px; font-weight: 600; color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ah-search-sym {
          font-size: 12px; color: var(--text-muted); font-weight: 600;
        }
        .ah-search-all {
          display: block; width: 100%; text-align: left;
          padding: 10px 12px; margin-top: 4px;
          border: none; background: var(--bg-secondary);
          border-radius: 9px; cursor: pointer; font-family: inherit;
          font-size: 12.5px; font-weight: 600; color: var(--accent);
          transition: background 0.12s;
        }
        .ah-search-all:hover { background: var(--bg-hover); }
        .ah-wallet-wrap { position: relative; flex-shrink: 0; }
        .ah-connect-btn {
          background: var(--accent); color: #fff;
          padding: 8px 16px; border-radius: 10px;
          font-size: 13.5px; font-weight: 600; border: none; cursor: pointer;
          font-family: inherit; box-shadow: 0 2px 10px rgba(51,151,46,0.3);
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
        .ah-launch-btn {
          background: var(--accent); color: #fff;
          padding: 8px 18px; border-radius: 10px;
          font-size: 13.5px; font-weight: 600;
          text-decoration: none; white-space: nowrap;
          box-shadow: 0 2px 10px rgba(51,151,46,0.3);
          transition: background 0.15s;
          display: inline-flex; align-items: center; gap: 6px;
          border: none; cursor: pointer; font-family: inherit;
        }
        .ah-launch-btn:hover { background: var(--accent-hover); }
        .ah-theme-btn {
          background: var(--bg-secondary); border: 1px solid var(--border);
          width: 34px; height: 34px; border-radius: 9px; cursor: pointer;
          font-size: 14px; display: flex; align-items: center; justify-content: center;
          color: var(--text-secondary); transition: background 0.15s; flex-shrink: 0;
          font-family: inherit;
        }
        .ah-theme-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

        /* Hamburger */
        .ah-burger {
          display: none;
          width: 36px; height: 34px;
          padding: 0; border-radius: 9px;
          background: var(--bg-secondary); border: 1px solid var(--border);
          cursor: pointer; flex-direction: column; align-items: center;
          justify-content: center; gap: 4px;
          font-family: inherit; flex-shrink: 0;
        }
        .ah-burger span {
          display: block; width: 16px; height: 1.6px;
          background: var(--text-primary); border-radius: 2px;
          transition: background 0.15s;
        }
        .ah-burger:hover { background: var(--bg-hover); }

        /* Mobile drawer */
        .ah-mobile-backdrop {
          position: fixed; inset: 0; z-index: 400;
          background: rgba(0,0,0,0.45);
          animation: ahFade 0.18s ease;
        }
        @keyframes ahFade { from { opacity: 0; } to { opacity: 1; } }
        .ah-mobile-drawer {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: 86%; max-width: 320px;
          background: var(--bg-primary);
          border-right: 1px solid var(--border);
          z-index: 401; padding: 16px 14px 28px;
          overflow-y: auto;
          animation: ahSlide 0.22s cubic-bezier(.2,.7,.2,1);
          box-shadow: 0 16px 48px rgba(0,0,0,0.35);
        }
        @keyframes ahSlide {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }
        .ah-mobile-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 6px 14px; border-bottom: 1px solid var(--border); margin-bottom: 12px;
        }
        .ah-mobile-close {
          background: var(--bg-secondary); border: 1px solid var(--border);
          width: 32px; height: 32px; border-radius: 9px;
          cursor: pointer; font-family: inherit; color: var(--text-secondary);
          font-size: 14px;
        }
        .ah-mobile-close:hover { background: var(--bg-hover); color: var(--text-primary); }
        .ah-mobile-section-label {
          font-size: 11px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.08em;
          padding: 14px 10px 6px;
        }
        .ah-mobile-section-label:first-of-type { padding-top: 4px; }
        .ah-mobile-nav { display: flex; flex-direction: column; gap: 2px; }
        .ah-mobile-nav a {
          display: block; padding: 12px 12px; border-radius: 10px;
          font-size: 15px; font-weight: 600; color: var(--text-primary);
          text-decoration: none; transition: background 0.12s;
        }
        .ah-mobile-nav a:hover { background: var(--bg-secondary); }
        .ah-mobile-nav a.boost { color: var(--boost); }
        .ah-mobile-empty {
          padding: 12px; font-size: 13px; color: var(--text-muted);
          line-height: 1.5;
        }
        .ah-mobile-wl { display: flex; flex-direction: column; gap: 2px; }
        .ah-mobile-wl-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 10px; border-radius: 10px;
          color: var(--text-primary); text-decoration: none;
          transition: background 0.12s;
        }
        .ah-mobile-wl-item:hover { background: var(--bg-secondary); }
        .ah-mobile-wl-icon {
          width: 32px; height: 32px; border-radius: 9px;
          flex-shrink: 0; font-size: 13px; color: var(--text-secondary);
          font-weight: 700;
        }
        .ah-mobile-wl-meta { min-width: 0; flex: 1; }
        .ah-mobile-wl-name {
          font-size: 14px; font-weight: 600;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ah-mobile-wl-sym { font-size: 11.5px; color: var(--text-muted); font-weight: 600; }

        @media (max-width: 900px) {
          .ah-nav { grid-template-columns: auto 1fr auto; }
          .ah-burger { display: flex; }
        }
        @media (max-width: 680px) {
          .ah-search { width: 100%; }
          .ah-search:focus { width: 100%; }
          .ah-search-pop { width: min(320px, calc(100vw - 32px)); }
        }
        @media (max-width: 520px) {
          .ah-theme-btn { display: none; }
          .ah-nav { padding: 0 14px; gap: 8px; }
          .ah-connect-btn { padding: 7px 12px; font-size: 12.5px; }
          .ah-addr-btn { padding: 6px 10px; font-size: 12px; }
        }
      `}</style>

      <header className="ah-header">
        <div className={`ah-nav${narrow ? ' narrow' : ''}`}>
          {/* ── LEFT: logo + nav links ── */}
          <div className="ah-nav-left">
            <Link to="/" className="ah-logo">
              <Logo size={22} />
            </Link>
          </div>

          {/* ── CENTER: search ── */}
          <div className="ah-search-wrap" ref={searchRef}>
            <span className="ah-search-icon">&#9906;</span>
            <input
              type="text"
              className="ah-search"
              placeholder="Search tokens…"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={handleSearchKey}
            />
            {searchOpen && searchQuery.trim() && (
              <div className="ah-search-pop">
                {matches.length === 0 ? (
                  <>
                    <div className="ah-search-empty">No tokens match "{searchQuery}"</div>
                    <button className="ah-search-all" onClick={seeAllInMarketplace}>
                      Try in Marketplace →
                    </button>
                  </>
                ) : (
                  <>
                    {matches.map((t, i) => {
                      const addr = t.metadataAddress || t.txHash;
                      return (
                        <button
                          key={addr}
                          className={`ah-search-item${i === searchIndex ? ' active' : ''}`}
                          onMouseEnter={() => setSearchIndex(i)}
                          onClick={() => addr && gotoToken(addr)}
                        >
                          <TokenAvatar
                            image={t.image}
                            symbol={t.symbol}
                            className="ah-search-icon-img"
                            background="var(--bg-tertiary)"
                          />
                          <div className="ah-search-meta">
                            <div className="ah-search-name">{t.name}</div>
                            <div className="ah-search-sym">{t.symbol.startsWith('$') ? t.symbol : `$${t.symbol}`}</div>
                          </div>
                        </button>
                      );
                    })}
                    <button className="ah-search-all" onClick={seeAllInMarketplace}>
                      {totalMatchCount > matches.length
                        ? `See all ${totalMatchCount} matches in Marketplace →`
                        : 'See in Marketplace →'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT: wallet + theme ── */}
          <div className="ah-nav-right">
          <div className="ah-wallet-wrap" ref={walletRef}>
            {account ? (
              <>
                <button className="ah-addr-btn" onClick={() => setWalletOpen(v => !v)}>
                  <span className="ah-addr-dot" />
                  {truncateAddress(account.address.toString())}
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
            ) : showLaunchCta ? (
              <button
                className="ah-launch-btn"
                onClick={() => { setLaunchClicked(true); setWalletOpen(true); }}
              >
                Launch a token ↗
              </button>
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

          <button
            className="ah-burger"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <span /><span /><span />
          </button>
          </div>{/* .ah-nav-right */}
        </div>
      </header>
      {BOOST_ENABLED && !hideBoostBar && <BoostBar />}

      {mobileOpen && (
        <>
          <div className="ah-mobile-backdrop" onClick={() => setMobileOpen(false)} />
          <aside className="ah-mobile-drawer">
            <div className="ah-mobile-head">
              <Link to="/" className="ah-logo" onClick={() => setMobileOpen(false)}>
                <Logo size={22} />
              </Link>
              <button className="ah-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                ✕
              </button>
            </div>

            <div className="ah-mobile-section-label">Navigate</div>
            <nav className="ah-mobile-nav">
              <Link to="/"            onClick={() => setMobileOpen(false)}>Home</Link>
              <Link to="/marketplace" onClick={() => setMobileOpen(false)}>Marketplace</Link>
              {BOOST_ENABLED && <Link to="/boost" onClick={() => setMobileOpen(false)} className="boost">Boost</Link>}
              <Link to="/launch"      onClick={() => setMobileOpen(false)}>Launch</Link>
              <Link to="/about"       onClick={() => setMobileOpen(false)}>About</Link>
              {account && (
                <Link to={`/profile/${account.address}`} onClick={() => setMobileOpen(false)}>Profile</Link>
              )}
            </nav>

            <div className="ah-mobile-section-label">Watchlist</div>
            {watchlist.length === 0 ? (
              <div className="ah-mobile-empty">
                No tokens watched yet. Tap ☆ on any token to add it.
              </div>
            ) : (
              <div className="ah-mobile-wl">
                {watchlist.map(t => (
                  <Link
                    key={t.metadataAddress}
                    to={`/newtoken/${t.metadataAddress}`}
                    className="ah-mobile-wl-item"
                    onClick={() => setMobileOpen(false)}
                  >
                    <TokenAvatar
                      image={t.icon && t.icon.startsWith('http') ? t.icon : null}
                      symbol={t.symbol}
                      className="ah-mobile-wl-icon"
                      background={t.iconBg || 'var(--bg-tertiary)'}
                    />
                    <div className="ah-mobile-wl-meta">
                      <div className="ah-mobile-wl-name">{t.name}</div>
                      <div className="ah-mobile-wl-sym">{t.symbol.startsWith('$') ? t.symbol : `$${t.symbol}`}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </aside>
        </>
      )}
    </>
  );
};

export default AppHeader;
