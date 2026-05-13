import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useTokenData } from '../hooks/useTokenData';
import { useTokenList } from '../data/useTokenList';
import { useAptPrice } from '../contexts/AptPriceContext';
import { useTheme } from '../contexts/ThemeContext';

type SortOrder = 'newest' | 'oldest' | 'highest_mc' | 'lowest_mc' | 'highest_vol' | 'lowest_vol';

interface Token {
  name: string;
  symbol: string;
  supply: number;
  txHash: string;
  image: string | null;
  launchDate: string;
  creator: string;
  metadataAddress?: string;
  price?: number;
  priceUSD?: number;
  marketCap?: number;
  marketCapUSD?: number;
  volume?: number;
  change24h?: number;
  creatorAddress?: string;
}

const HomePage: React.FC = () => {
  const { account } = useWallet();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  const { tokens: catalogTokens, loading } = useTokenData();
  const { aptPrice } = useAptPrice();

  const catalogAddrs = useMemo(
    () => catalogTokens.map(t => t.metadataAddress || t.txHash).filter(Boolean) as string[],
    [catalogTokens]
  );
  const { data: liveByAddr } = useTokenList(catalogAddrs);

  const rawTokens = useMemo(() => {
    if (!liveByAddr) return catalogTokens;
    const aptUsd = aptPrice ?? 0;
    return catalogTokens.map(t => {
      const key = (t.metadataAddress || t.txHash || '').toLowerCase();
      const live = liveByAddr[key];
      if (!live) return t;
      return {
        ...t,
        price: live.spotPriceAPT,
        priceUSD: aptUsd > 0 ? live.spotPriceAPT * aptUsd : t.priceUSD,
        marketCap: live.marketCapAPT,
        marketCapUSD: aptUsd > 0 ? live.marketCapAPT * aptUsd : t.marketCapUSD,
        tokensSold: live.tokensSold,
        aptRaised: live.aptRaisedOctas,
      };
    });
  }, [catalogTokens, liveByAddr, aptPrice]);

  const tokens = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? rawTokens.filter(t =>
          t.name.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q) ||
          (t.creatorAddress || '').toLowerCase().includes(q)
        )
      : rawTokens;

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortOrder) {
        case 'newest':     return new Date(b.launchDate).getTime() - new Date(a.launchDate).getTime();
        case 'oldest':     return new Date(a.launchDate).getTime() - new Date(b.launchDate).getTime();
        case 'highest_mc': return (b.marketCap || 0) - (a.marketCap || 0);
        case 'lowest_mc':  return (a.marketCap || 0) - (b.marketCap || 0);
        case 'highest_vol':return (b.volume || 0) - (a.volume || 0);
        case 'lowest_vol': return (a.volume || 0) - (b.volume || 0);
      }
    });
    return sorted;
  }, [rawTokens, sortOrder, searchQuery]);

  const totalVolume24h = useMemo(
    () => rawTokens.reduce((sum, t) => sum + (t.volume || 0), 0),
    [rawTokens]
  );
  const totalMarketCap = useMemo(
    () => rawTokens.reduce((sum, t) => sum + (t.marketCapUSD || 0), 0),
    [rawTokens]
  );

  const truncateAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const formatPrice = (n: number) => {
    if (n < 0.0001) return `$${n.toFixed(8)}`;
    if (n < 0.01) return `$${n.toFixed(6)}`;
    if (n < 1) return `$${n.toFixed(4)}`;
    return `$${n.toFixed(2)}`;
  };
  const formatBig = (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };

  // Restrained icon palette — muted, Apple-style. No bright/saturated colors.
  const iconPalette = ['#5E5CE6', '#0F6F4E', '#FF9F0A', '#BF5AF2', '#64D2FF', '#FF6482', '#A2845E', '#30B0C7'];
  const getIconBg = (sym: string) => iconPalette[sym.charCodeAt(0) % iconPalette.length];

  const handleTradeClick = (t: Token) => {
    const url = t.metadataAddress || t.txHash;
    navigate(`/newtoken/${url}`, {
      state: {
        name: t.name, symbol: t.symbol, supply: t.supply, txHash: t.txHash,
        metadataAddress: t.metadataAddress || t.txHash,
        creatorAddress: t.creator,
        creationDate: new Date(t.launchDate).getTime() / 1000,
      },
    });
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
          background: var(--bg-primary);
          color: var(--text-primary);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .mm-page { min-height: 100vh; background: var(--bg-primary); }

        /* ── HEADER ── */
        .mm-header {
          position: sticky; top: 0; z-index: 100;
          height: 52px;
          background: ${isDark ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.72)'};
          backdrop-filter: saturate(180%) blur(20px);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
          border-bottom: 1px solid var(--border);
        }
        .mm-nav {
          max-width: 1140px; margin: 0 auto; height: 100%;
          padding: 0 22px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .mm-logo {
          display: flex; align-items: center; gap: 8px;
          font-size: 20px; font-weight: 600; letter-spacing: -0.022em;
          color: var(--text-primary); text-decoration: none;
        }
        .mm-logo-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--accent);
        }
        .mm-nav-links {
          display: flex; gap: 36px; list-style: none; margin: 0; padding: 0;
        }
        .mm-nav-links a {
          font-size: 13px; font-weight: 400;
          color: var(--text-primary); opacity: 0.86;
          text-decoration: none; transition: opacity 0.15s;
        }
        .mm-nav-links a:hover { opacity: 1; }
        .mm-nav-actions { display: flex; align-items: center; gap: 12px; }
        .mm-theme-btn {
          background: none; border: none; cursor: pointer;
          padding: 6px; font-size: 14px; line-height: 1;
          color: var(--text-secondary); border-radius: 6px;
          transition: background 0.15s;
        }
        .mm-theme-btn:hover { background: var(--bg-hover); }
        .mm-cta-pill {
          background: var(--accent); color: #fff;
          padding: 7px 16px; border-radius: 980px;
          font-size: 13px; font-weight: 500;
          text-decoration: none; transition: background 0.15s;
        }
        .mm-cta-pill:hover { background: var(--accent-hover); }

        /* ── HERO ── */
        .mm-hero {
          padding: 120px 22px 100px;
          text-align: center;
          background: var(--bg-primary);
          position: relative;
          overflow: hidden;
        }
        .mm-hero::before {
          content: '';
          position: absolute;
          top: -20%; left: 50%;
          transform: translateX(-50%);
          width: 900px; height: 900px;
          background: radial-gradient(circle, var(--accent-light) 0%, transparent 60%);
          opacity: ${isDark ? '0.4' : '0.6'};
          pointer-events: none;
          z-index: 0;
        }
        .mm-hero-inner {
          max-width: 980px; margin: 0 auto;
          position: relative; z-index: 1;
        }
        .mm-eyebrow {
          display: inline-block;
          font-size: 19px; font-weight: 600;
          letter-spacing: -0.022em;
          color: var(--accent);
          margin-bottom: 8px;
        }
        .mm-hero-title {
          font-size: clamp(48px, 7.5vw, 96px);
          font-weight: 600;
          letter-spacing: -0.045em;
          line-height: 1.0357;
          color: var(--text-primary);
          margin: 0 0 22px;
        }
        .mm-hero-title .accent { color: var(--accent); }
        .mm-hero-sub {
          font-size: clamp(19px, 1.8vw, 24px);
          font-weight: 400;
          line-height: 1.35;
          letter-spacing: 0.009em;
          color: var(--text-secondary);
          max-width: 640px;
          margin: 0 auto 38px;
        }
        .mm-hero-actions {
          display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;
        }
        .mm-btn-primary {
          background: var(--accent); color: #fff;
          padding: 13px 24px; border-radius: 980px;
          font-size: 17px; font-weight: 400;
          text-decoration: none;
          transition: background 0.18s;
          display: inline-flex; align-items: center; gap: 6px;
          border: none; cursor: pointer;
        }
        .mm-btn-primary:hover { background: var(--accent-hover); }
        .mm-btn-ghost {
          color: var(--accent); padding: 13px 0;
          font-size: 17px; font-weight: 400;
          text-decoration: none;
          display: inline-flex; align-items: center; gap: 4px;
          transition: opacity 0.15s;
        }
        .mm-btn-ghost:hover { opacity: 0.7; }
        .mm-btn-ghost::after {
          content: '›'; font-size: 22px; line-height: 0.5;
          transition: transform 0.2s;
        }
        .mm-btn-ghost:hover::after { transform: translateX(3px); }

        /* ── STATS BAR ── */
        .mm-stats {
          background: var(--bg-secondary);
          padding: 52px 22px;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }
        .mm-stats-inner {
          max-width: 1140px; margin: 0 auto;
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px;
        }
        .mm-stat-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          font-weight: 600;
          margin-bottom: 10px;
        }
        .mm-stat-value {
          font-size: 36px;
          font-weight: 600;
          letter-spacing: -0.026em;
          color: var(--text-primary);
          line-height: 1.1;
        }
        .mm-stat-suffix {
          font-size: 16px; font-weight: 500;
          color: var(--text-secondary);
          margin-left: 4px;
        }

        /* ── TOKENS SECTION ── */
        .mm-tokens {
          padding: 100px 22px;
          background: var(--bg-primary);
        }
        .mm-tokens-inner { max-width: 1180px; margin: 0 auto; }
        .mm-section-head {
          display: flex; justify-content: space-between; align-items: flex-end;
          gap: 24px; flex-wrap: wrap;
          margin-bottom: 48px;
        }
        .mm-section-title {
          font-size: clamp(36px, 4vw, 48px);
          font-weight: 600;
          letter-spacing: -0.032em;
          line-height: 1.0833;
          color: var(--text-primary);
          margin: 0 0 10px;
        }
        .mm-section-sub {
          font-size: 19px;
          color: var(--text-secondary);
          margin: 0;
        }
        .mm-controls {
          display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
        }
        .mm-search {
          background: var(--bg-secondary);
          border: 1px solid transparent;
          border-radius: 980px;
          padding: 9px 16px 9px 38px;
          font-size: 14px;
          color: var(--text-primary);
          outline: none;
          width: 260px;
          transition: border-color 0.15s, background 0.15s;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2.5'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: 14px center;
          font-family: inherit;
        }
        .mm-search:focus { border-color: var(--accent); background: var(--bg-primary); }
        .mm-search::placeholder { color: var(--text-muted); }
        .mm-sort {
          background: var(--bg-secondary);
          border: 1px solid transparent;
          border-radius: 980px;
          padding: 9px 36px 9px 16px;
          font-size: 14px;
          color: var(--text-primary);
          cursor: pointer;
          outline: none;
          appearance: none;
          -webkit-appearance: none;
          font-family: inherit;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
        }
        .mm-sort:focus { border-color: var(--accent); }

        /* ── TOKEN CARDS ── */
        .mm-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
        }
        .mm-card {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 22px;
          display: flex; flex-direction: column; gap: 18px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
        }
        .mm-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0,0,0,${isDark ? '0.4' : '0.08'}), 0 2px 8px rgba(0,0,0,${isDark ? '0.3' : '0.04'});
          border-color: var(--border-secondary);
        }
        .mm-card-head { display: flex; align-items: center; gap: 14px; }
        .mm-card-icon {
          width: 44px; height: 44px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 600; color: #fff;
          flex-shrink: 0;
          letter-spacing: -0.01em;
        }
        .mm-card-name-wrap { flex: 1; min-width: 0; }
        .mm-card-name {
          font-size: 17px; font-weight: 600;
          letter-spacing: -0.012em;
          color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          line-height: 1.2;
        }
        .mm-card-symbol {
          font-size: 13px; color: var(--text-muted);
          font-weight: 400; margin-top: 2px;
        }
        .mm-card-badge {
          font-size: 12px; font-weight: 600;
          padding: 4px 10px; border-radius: 980px;
          flex-shrink: 0;
        }
        .mm-card-stats {
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
          padding: 16px 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }
        .mm-card-stat-label {
          font-size: 10px; font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 5px;
        }
        .mm-card-stat-value {
          font-size: 18px; font-weight: 600;
          color: var(--text-primary);
          letter-spacing: -0.014em;
          line-height: 1.1;
        }
        .mm-card-foot {
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px;
        }
        .mm-card-creator {
          font-size: 11px;
          color: var(--text-muted);
          font-family: -apple-system-mono, 'SF Mono', ui-monospace, monospace;
          cursor: pointer;
          transition: color 0.15s;
        }
        .mm-card-creator:hover { color: var(--text-secondary); }
        .mm-card-trade {
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: none;
          padding: 7px 16px;
          border-radius: 980px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
          font-family: inherit;
        }
        .mm-card-trade:hover {
          background: var(--accent);
          color: #fff;
        }

        .mm-empty {
          text-align: center; padding: 80px 20px;
          color: var(--text-muted); font-size: 16px;
        }

        /* ── FOOTER ── */
        .mm-footer {
          background: var(--bg-secondary);
          border-top: 1px solid var(--border);
          padding: 56px 22px 28px;
        }
        .mm-footer-inner { max-width: 1140px; margin: 0 auto; }
        .mm-footer-top {
          padding-bottom: 36px;
          border-bottom: 1px solid var(--border);
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 48px;
        }
        .mm-footer-brand {
          font-size: 17px; font-weight: 600;
          letter-spacing: -0.022em;
          color: var(--text-primary);
          margin-bottom: 10px;
          display: flex; align-items: center; gap: 8px;
        }
        .mm-footer-desc {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.55;
          max-width: 320px;
        }
        .mm-footer-section h4 {
          font-size: 12px; font-weight: 600;
          color: var(--text-secondary);
          margin: 0 0 14px;
        }
        .mm-footer-section ul { list-style: none; margin: 0; padding: 0; }
        .mm-footer-section li { margin-bottom: 10px; }
        .mm-footer-section a {
          font-size: 12px;
          color: var(--text-secondary);
          text-decoration: none;
          transition: color 0.15s;
        }
        .mm-footer-section a:hover { color: var(--text-primary); }
        .mm-footer-bottom {
          padding-top: 22px;
          display: flex; justify-content: space-between; align-items: center;
          font-size: 12px;
          color: var(--text-muted);
          flex-wrap: wrap; gap: 16px;
        }
        .mm-footer-bottom a {
          color: var(--text-muted);
          text-decoration: none;
          margin-left: 24px;
        }
        .mm-footer-bottom a:hover { color: var(--text-secondary); }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .mm-stats-inner { grid-template-columns: repeat(2, 1fr); gap: 28px; }
          .mm-nav-links { display: none; }
          .mm-footer-top { grid-template-columns: 1fr 1fr; gap: 36px; }
        }
        @media (max-width: 600px) {
          .mm-hero { padding: 80px 18px 60px; }
          .mm-tokens { padding: 60px 18px; }
          .mm-controls { width: 100%; }
          .mm-search { flex: 1; width: auto; }
          .mm-footer-top { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="mm-page">
        {/* ── HEADER ── */}
        <header className="mm-header">
          <div className="mm-nav">
            <Link to="/" className="mm-logo">
              <div className="mm-logo-dot" />
              MoveMint
            </Link>
            <ul className="mm-nav-links">
              <li><Link to="/marketplace">Marketplace</Link></li>
              <li><Link to="/launch">Launch</Link></li>
              {account && <li><Link to={`/profile/${account.address}`}>Profile</Link></li>}
            </ul>
            <div className="mm-nav-actions">
              <button className="mm-theme-btn" onClick={toggleTheme} title={isDark ? 'Light mode' : 'Dark mode'}>
                {isDark ? '☀' : '☾'}
              </button>
              <Link to="/launch" className="mm-cta-pill">Launch token</Link>
            </div>
          </div>
        </header>

        {/* ── HERO ── */}
        <section className="mm-hero">
          <div className="mm-hero-inner">
            <div className="mm-eyebrow">MoveMint</div>
            <h1 className="mm-hero-title">
              Token launching,<br />
              <span className="accent">reimagined.</span>
            </h1>
            <p className="mm-hero-sub">
              Built on Aptos. Designed for speed. Launch a token in seconds — no code, no fuss, just markets.
            </p>
            <div className="mm-hero-actions">
              <Link to="/launch" className="mm-btn-primary">Launch a token</Link>
              <a href="#tokens" className="mm-btn-ghost">Explore the marketplace</a>
            </div>
          </div>
        </section>

        {/* ── STATS ── */}
        <section className="mm-stats">
          <div className="mm-stats-inner">
            <div>
              <div className="mm-stat-label">Tokens launched</div>
              <div className="mm-stat-value">{rawTokens.length}</div>
            </div>
            <div>
              <div className="mm-stat-label">24h volume</div>
              <div className="mm-stat-value">{totalVolume24h > 0 ? formatBig(totalVolume24h) : '$0'}</div>
            </div>
            <div>
              <div className="mm-stat-label">Total market cap</div>
              <div className="mm-stat-value">{totalMarketCap > 0 ? formatBig(totalMarketCap) : '$0'}</div>
            </div>
            <div>
              <div className="mm-stat-label">Network</div>
              <div className="mm-stat-value">Aptos<span className="mm-stat-suffix">testnet</span></div>
            </div>
          </div>
        </section>

        {/* ── TOKENS ── */}
        <section className="mm-tokens" id="tokens">
          <div className="mm-tokens-inner">
            <div className="mm-section-head">
              <div>
                <h2 className="mm-section-title">Live on MoveMint.</h2>
                <p className="mm-section-sub">Real-time markets, sorted by you.</p>
              </div>
              <div className="mm-controls">
                <input
                  type="text"
                  className="mm-search"
                  placeholder="Search tokens"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <select
                  className="mm-sort"
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value as SortOrder)}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="highest_mc">Highest market cap</option>
                  <option value="lowest_mc">Lowest market cap</option>
                  <option value="highest_vol">Highest volume</option>
                  <option value="lowest_vol">Lowest volume</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="mm-empty">Loading markets…</div>
            ) : tokens.length === 0 ? (
              <div className="mm-empty">
                {searchQuery ? `No tokens match "${searchQuery}"` : 'No tokens have launched yet. Be the first.'}
              </div>
            ) : (
              <div className="mm-grid">
                {tokens.map((token, i) => {
                  const change = token.change24h;
                  const isPos = change != null && change >= 0;
                  const badgeColor = change == null ? 'var(--text-muted)' : isPos ? 'var(--positive)' : 'var(--negative)';
                  const badgeBg = change == null
                    ? 'transparent'
                    : isPos
                      ? (isDark ? 'rgba(48,209,88,0.15)' : 'rgba(15,111,78,0.10)')
                      : (isDark ? 'rgba(255,69,58,0.15)' : 'rgba(215,0,21,0.10)');
                  const displaySymbol = token.symbol.startsWith('$') ? token.symbol : `$${token.symbol}`;

                  return (
                    <div key={i} className="mm-card" onClick={() => handleTradeClick(token)}>
                      <div className="mm-card-head">
                        {token.image ? (
                          <img
                            src={token.image}
                            alt={token.symbol}
                            className="mm-card-icon"
                            style={{ objectFit: 'cover' }}
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="mm-card-icon" style={{ background: getIconBg(token.symbol) }}>
                            {token.symbol.replace('$', '').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="mm-card-name-wrap">
                          <div className="mm-card-name">{token.name}</div>
                          <div className="mm-card-symbol">{displaySymbol}</div>
                        </div>
                        <div
                          className="mm-card-badge"
                          style={{ color: badgeColor, background: badgeBg }}
                        >
                          {change == null ? '—' : `${isPos ? '↑' : '↓'} ${Math.abs(change).toFixed(2)}%`}
                        </div>
                      </div>

                      <div className="mm-card-stats">
                        <div>
                          <div className="mm-card-stat-label">Price</div>
                          <div className="mm-card-stat-value">
                            {token.priceUSD != null ? formatPrice(token.priceUSD) : `${(token.price || 0).toFixed(6)} APT`}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="mm-card-stat-label">Market cap</div>
                          <div className="mm-card-stat-value">
                            {token.marketCapUSD != null ? formatBig(token.marketCapUSD) : '—'}
                          </div>
                        </div>
                      </div>

                      <div className="mm-card-foot">
                        {token.creatorAddress && token.creatorAddress !== 'Unknown' ? (
                          <div
                            className="mm-card-creator"
                            onClick={e => { e.stopPropagation(); navigate(`/profile/${token.creatorAddress}`); }}
                            title={token.creatorAddress}
                          >
                            {truncateAddress(token.creatorAddress)}
                          </div>
                        ) : <div />}
                        <button
                          className="mm-card-trade"
                          onClick={e => { e.stopPropagation(); handleTradeClick(token); }}
                        >
                          Trade
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="mm-footer">
          <div className="mm-footer-inner">
            <div className="mm-footer-top">
              <div>
                <div className="mm-footer-brand">
                  <div className="mm-logo-dot" /> MoveMint
                </div>
                <p className="mm-footer-desc">
                  A token launchpad built for the Aptos network. Launch in seconds, trade instantly.
                </p>
              </div>
              <div className="mm-footer-section">
                <h4>Products</h4>
                <ul>
                  <li><Link to="/marketplace">Marketplace</Link></li>
                  <li><Link to="/launch">Launch a token</Link></li>
                </ul>
              </div>
              <div className="mm-footer-section">
                <h4>Resources</h4>
                <ul>
                  <li><a href="#">Documentation</a></li>
                  <li><a href="#">API reference</a></li>
                  <li><a href="#">Support</a></li>
                </ul>
              </div>
              <div className="mm-footer-section">
                <h4>Company</h4>
                <ul>
                  <li><a href="#">About</a></li>
                  <li><a href="#">Privacy</a></li>
                  <li><a href="#">Terms</a></li>
                </ul>
              </div>
            </div>
            <div className="mm-footer-bottom">
              <span>Copyright © 2025 MoveMint. All rights reserved.</span>
              <span>
                <a href="#">Privacy</a>
                <a href="#">Terms</a>
                <a href="#">Cookies</a>
              </span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default HomePage;
