import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { MODULE_ADDRESS } from "../config";
import { useTokenData } from '../hooks/useTokenData';
import { useTokenList } from '../data/useTokenList';
import { useAptPrice } from '../contexts/AptPriceContext';
import { useTheme } from '../contexts/ThemeContext';

const HomePage: React.FC = () => {
  const { account } = useWallet();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'highest_mc' | 'lowest_mc' | 'highest_vol' | 'lowest_vol'>('newest');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Catalog (slow-changing metadata): name, ticker, image, address, creator
  const { tokens: catalogTokens, loading, error, refetch } = useTokenData();

  // Live state for every token in the catalog. Polls every 5s, server-cached.
  const catalogAddrs = useMemo(
    () => catalogTokens.map(t => t.metadataAddress || t.txHash).filter(Boolean) as string[],
    [catalogTokens]
  );
  const { data: liveByAddr } = useTokenList(catalogAddrs);
  const { aptPrice } = useAptPrice();

  // Merge live vault data over the catalog so price/mcap match the token page exactly.
  const rawTokens = useMemo(() => {
    if (!liveByAddr) return catalogTokens;
    const aptUsd = aptPrice ?? 0;
    return catalogTokens.map(t => {
      const key = (t.metadataAddress || t.txHash || '').toLowerCase();
      const live = liveByAddr[key];
      if (!live) return t;
      const priceUSD = aptUsd > 0 ? live.spotPriceAPT * aptUsd : t.priceUSD;
      const marketCapUSD = aptUsd > 0 ? live.marketCapAPT * aptUsd : t.marketCapUSD;
      return {
        ...t,
        price: live.spotPriceAPT,
        priceUSD,
        marketCap: live.marketCapAPT,
        marketCapUSD,
        tokensSold: live.tokensSold,
        aptRaised: live.aptRaisedOctas,
      };
    });
  }, [catalogTokens, liveByAddr, aptPrice]);

  // Aptos client setup
  const config = useMemo(() => new AptosConfig({ 
    network: Network.TESTNET,
    fullnode: "https://fullnode.testnet.aptoslabs.com/v1",
  }), []);
  const client = useMemo(() => new Aptos(config), [config]);
  const tokenLauncherAddress = MODULE_ADDRESS;

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
  }

  // Sort and filter tokens
  const tokens = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? rawTokens.filter(t =>
          t.name.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q) ||
          (t.creatorAddress || '').toLowerCase().includes(q)
        )
      : rawTokens;

    const sortedTokens = [...filtered];
    sortedTokens.sort((a, b) => {
      switch (sortOrder) {
        case 'newest':
          return new Date(b.launchDate).getTime() - new Date(a.launchDate).getTime();
        case 'oldest':
          return new Date(a.launchDate).getTime() - new Date(b.launchDate).getTime();
        case 'highest_mc':
          return (b.marketCap || 0) - (a.marketCap || 0);
        case 'lowest_mc':
          return (a.marketCap || 0) - (b.marketCap || 0);
        case 'highest_vol':
          return (b.volume || 0) - (a.volume || 0);
        case 'lowest_vol':
          return (a.volume || 0) - (b.volume || 0);
        default:
          return new Date(b.launchDate).getTime() - new Date(a.launchDate).getTime();
      }
    });
    return sortedTokens;
  }, [rawTokens, sortOrder, searchQuery]);

  // No continuous polling - tokens are fetched once on mount
  // Use manual refresh button if user wants to update data
  // Note: Static data (name, ticker, creator) doesn't change
  // Price is calculated client-side from tokensSold, which only changes on trades

  // Helper functions from LandingPage
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    if (diffInHours < 1) return `${Math.floor(diffInHours * 60)} minutes ago`;
    if (diffInHours < 24) return `${Math.floor(diffInHours)} hours ago`;
    return date.toLocaleDateString();
  };

  const handleDropdownClick = (dropdownName: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setActiveDropdown(activeDropdown === dropdownName ? null : dropdownName);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.sort-dropdown')) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const formatPrice = (price: number) => {
    if (price < 0.0001) return `$${price.toFixed(8)}`;
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(1)}B`;
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(1)}M`;
    if (marketCap >= 1e3) return `$${(marketCap / 1e3).toFixed(1)}K`;
    return `$${marketCap.toFixed(0)}`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(1)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(1)}M`;
    if (volume >= 1e3) return `$${(volume / 1e3).toFixed(1)}K`;
    return `$${volume.toFixed(0)}`;
  };

  const handleTradeClick = (token: Token) => {
    // Use metadataAddress for the URL, fallback to txHash if metadataAddress is missing
    const addressForUrl = token.metadataAddress || token.txHash;
    navigate(`/newtoken/${addressForUrl}`, {
      state: {
        name: token.name,
        symbol: token.symbol,
        supply: token.supply,
        txHash: token.txHash,
        metadataAddress: token.metadataAddress || token.txHash,
        creatorAddress: token.creator,
        creationDate: new Date(token.launchDate).getTime() / 1000,
      },
    });
  };

  const getTokenIcon = (symbol: string) => {
    const icons = ['🐕', '🐸', '🚀', '🌙', '🔥', '💎', '⭐', '🌟', '🌙', '☀️'];
    const index = symbol.charCodeAt(0) % icons.length;
    return icons[index];
  };

  const getTokenIconBg = (symbol: string) => {
    const colors = ['#f7931a', '#627eea', '#50af95', '#f0b90b', '#1e88e5', '#e91e63', '#9c27b0', '#ff5722', '#4caf50', '#2196f3'];
    const index = symbol.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <>
      <style>
        {`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

          html, body {
            width: 100%;
            overflow-x: hidden;
          }

          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.5;
          }

          /* ── PROMO BANNER ── */
          .promo-banner {
            background: var(--accent);
            color: #fff;
            text-align: center;
            padding: 10px 0;
            font-size: 13px;
            font-weight: 500;
            letter-spacing: 0.01em;
          }

          /* ── HEADER ── */
          .header {
            background: var(--bg-primary);
            border-bottom: 1px solid var(--border);
            padding: 0;
            width: 100vw;
            max-width: 100vw;
            margin-left: calc(-50vw + 50%);
            box-sizing: border-box;
            position: sticky;
            top: 0;
            z-index: 100;
            backdrop-filter: blur(12px);
          }

          .nav-container {
            max-width: 1440px;
            margin: 0 auto;
            padding: 0 32px;
            height: 60px;
            display: flex;
            align-items: center;
            gap: 32px;
          }

          .logo {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 20px;
            font-weight: 800;
            color: var(--text-primary);
            letter-spacing: -0.02em;
            white-space: nowrap;
            flex-shrink: 0;
            text-decoration: none;
          }

          .logo-dot {
            width: 8px;
            height: 8px;
            background: var(--accent);
            border-radius: 50%;
          }

          .nav-search {
            flex: 1;
            max-width: 400px;
          }

          .nav-search-input {
            width: 100%;
            padding: 8px 14px 8px 36px;
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 14px;
            background: var(--bg-secondary);
            color: var(--text-primary);
            outline: none;
            transition: border-color 0.15s, box-shadow 0.15s;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238a9ba8' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: 10px center;
          }

          .nav-search-input:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px rgba(0,212,170,0.12);
          }

          .nav-search-input::placeholder { color: var(--text-muted); }

          .nav-links {
            display: flex;
            gap: 4px;
            list-style: none;
            align-items: center;
            margin-left: auto;
          }

          .nav-links a {
            color: var(--text-secondary);
            text-decoration: none;
            font-weight: 500;
            font-size: 14px;
            padding: 6px 12px;
            border-radius: 6px;
            transition: color 0.15s, background 0.15s;
          }

          .nav-links a:hover {
            color: var(--text-primary);
            background: var(--bg-hover);
          }

          .auth-section {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
          }

          .sign-up {
            background: var(--accent);
            color: #fff;
            padding: 8px 18px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            transition: opacity 0.15s;
            white-space: nowrap;
          }

          .sign-up:hover { opacity: 0.88; }

          /* ── LAYOUT ── */
          .main-container {
            width: 100vw;
            max-width: 100vw;
            margin-left: calc(-50vw + 50%);
            box-sizing: border-box;
          }

          .main-container-inner {
            max-width: 1440px;
            margin: 0 auto;
            padding: 32px 32px 48px;
            display: flex;
            gap: 28px;
            min-height: calc(100vh - 60px);
          }

          .content { flex: 1; min-width: 0; }

          /* ── PAGE HEADER ── */
          .page-header { margin-bottom: 28px; }

          .page-title {
            font-size: 26px;
            font-weight: 700;
            color: var(--text-primary);
            letter-spacing: -0.02em;
          }

          .section-subtitle {
            color: var(--text-muted);
            font-size: 14px;
            margin-top: 4px;
          }

          /* ── SORT BAR ── */
          .sort-section {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 14px 18px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
          }

          .sort-header p {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-muted);
            white-space: nowrap;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .marketplace-sort {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            flex: 1;
          }

          .sort-dropdown {
            position: relative;
            min-width: 130px;
          }

          .sort-dropdown-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 7px 12px;
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 7px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            color: var(--text-primary);
            transition: border-color 0.15s;
            gap: 8px;
          }

          .sort-dropdown-header:hover { border-color: var(--accent); }

          .sort-dropdown.active .sort-dropdown-header {
            border-color: var(--accent);
            box-shadow: 0 0 0 2px rgba(0,212,170,0.15);
          }

          .dropdown-arrow {
            font-size: 10px;
            color: var(--text-muted);
            transition: transform 0.2s;
          }

          .sort-dropdown.active .dropdown-arrow { transform: rotate(180deg); }

          .sort-dropdown-content {
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            right: 0;
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 8px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            z-index: 200;
            opacity: 0;
            visibility: hidden;
            transform: translateY(-6px);
            transition: opacity 0.15s, transform 0.15s, visibility 0.15s;
            overflow: hidden;
          }

          .sort-dropdown.active .sort-dropdown-content {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
          }

          .sort-option {
            display: block;
            width: 100%;
            padding: 9px 14px;
            background: none;
            border: none;
            text-align: left;
            font-size: 13px;
            color: var(--text-primary);
            cursor: pointer;
            transition: background 0.12s;
          }

          .sort-option:hover { background: var(--bg-hover); }

          .sort-option.active {
            background: var(--accent);
            color: #fff;
            font-weight: 600;
          }

          /* ── SECTION HEADER ── */
          .section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
          }

          .read-more {
            font-size: 13px;
            font-weight: 600;
            color: var(--accent);
            text-decoration: none;
            white-space: nowrap;
            transition: opacity 0.15s;
          }

          .read-more:hover { opacity: 0.75; }

          /* ── TOKEN CARDS ── */
          .trade-btn {
            background: var(--accent);
            color: #fff;
            padding: 7px 16px;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            font-size: 13px;
            transition: opacity 0.15s;
          }

          .trade-btn:hover { opacity: 0.85; }

          /* ── SIDEBAR ── */
          .sidebar {
            width: 280px;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          .sidebar-card {
            background: linear-gradient(135deg, var(--accent) 0%, #00b894 100%);
            color: #fff;
            padding: 24px;
            border-radius: 12px;
            position: relative;
            overflow: hidden;
          }

          .sidebar-card h3 {
            font-size: 17px;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: -0.01em;
          }

          .sidebar-card p {
            margin-bottom: 20px;
            opacity: 0.88;
            font-size: 14px;
            line-height: 1.5;
          }

          .sidebar-btn {
            background: rgba(255,255,255,0.95);
            color: #00a87d;
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.15s;
          }

          .sidebar-btn:hover { background: #fff; }

          .movers-card {
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
          }

          .movers-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
          }

          .movers-title {
            font-size: 15px;
            font-weight: 700;
            color: var(--text-primary);
          }

          .movers-subtitle {
            color: var(--text-muted);
            font-size: 12px;
            margin-bottom: 12px;
          }

          .mover-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 0;
            border-bottom: 1px solid var(--border);
          }

          .mover-item:last-child { border-bottom: none; }

          .mover-info { flex: 1; }

          .mover-name {
            font-weight: 600;
            font-size: 13px;
            color: var(--text-primary);
          }

          .mover-price {
            color: var(--text-muted);
            font-size: 12px;
          }

          .mover-change {
            font-weight: 600;
            font-size: 13px;
          }

          /* ── FOOTER ── */
          .footer {
            background: var(--bg-secondary);
            border-top: 1px solid var(--border);
            width: 100vw;
            max-width: 100vw;
            padding: 48px 0 0;
            margin-left: calc(-50vw + 50%);
            box-sizing: border-box;
          }

          .footer-container {
            max-width: 1440px;
            margin: 0 auto;
            padding: 0 32px;
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1fr;
            gap: 40px;
          }

          .footer-section h4 {
            font-size: 13px;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 14px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .footer-section p {
            font-size: 14px;
            color: var(--text-secondary);
            line-height: 1.6;
            margin-bottom: 16px;
          }

          .footer-social { display: flex; gap: 12px; }

          .social-link {
            color: var(--text-secondary);
            text-decoration: none;
            font-size: 13px;
            font-weight: 500;
            transition: color 0.15s;
          }

          .social-link:hover { color: var(--accent); }

          .footer-links { list-style: none; padding: 0; }

          .footer-links li { margin-bottom: 8px; }

          .footer-links a {
            color: var(--text-secondary);
            text-decoration: none;
            font-size: 13px;
            transition: color 0.15s;
          }

          .footer-links a:hover { color: var(--accent); }

          .footer-bottom {
            border-top: 1px solid var(--border);
            margin-top: 40px;
          }

          .footer-bottom-content {
            max-width: 1440px;
            margin: 0 auto;
            padding: 20px 32px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .footer-bottom p {
            font-size: 13px;
            color: var(--text-muted);
          }

          .footer-bottom-links { display: flex; gap: 20px; }

          .footer-bottom-links a {
            color: var(--text-muted);
            text-decoration: none;
            font-size: 13px;
            transition: color 0.15s;
          }

          .footer-bottom-links a:hover { color: var(--accent); }

          /* ── RESPONSIVE ── */
          @media (max-width: 1024px) {
            .sidebar { width: 240px; }
          }

          @media (max-width: 768px) {
            .nav-container { padding: 0 16px; gap: 16px; }
            .nav-links { display: none; }
            .main-container-inner { flex-direction: column; padding: 20px 16px; }
            .sidebar { width: 100%; }
            .footer-container { grid-template-columns: 1fr; gap: 24px; }
            .footer-bottom-content { flex-direction: column; gap: 12px; text-align: center; }
          }
        `}
      </style>

      <header className="header">
        <div className="nav-container">
          <div className="logo">
            MoveMint
            <div className="logo-dot"></div>
          </div>
          <div className="nav-search">
            <input
              type="text"
              className="nav-search-input"
              placeholder="Search tokens, symbols, creators…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <nav>
            <ul className="nav-links">
              <li><Link to="/marketplace">Marketplace</Link></li>
              <li><Link to="/launch">Launch</Link></li>
            </ul>
          </nav>
          <div className="auth-section" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: '8px',
                padding: '6px 10px', cursor: 'pointer', fontSize: '16px', lineHeight: 1,
                color: 'var(--text-secondary)',
              }}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            <Link to="/launch" className="sign-up">Launch Token</Link>
          </div>
        </div>
      </header>

      <div className="main-container">
        <div className="main-container-inner">
        <main className="content">
          <div className="page-header">
            <h1 className="page-title">Smarter. Faster. Better.</h1>
            <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginTop: '10px', maxWidth: '560px', lineHeight: '1.6' }}>
              Launch in seconds with zero code, instant liquidity, and lightning-fast transactions at minimal fees.
            </p>
          </div>

                            {/* Bonding Curve Test - Commented out for now, can re-enable if needed for debugging */}
                  {/* {aptPrice && (
                    <div style={{
                      background: '#e8f5e8',
                      padding: '15px 20px',
                      borderRadius: '12px',
                      marginBottom: '20px',
                      border: '1px solid #4caf50'
                    }}>
                      <h3 style={{ margin: '0 0 10px 0', color: '#2e7d32' }}>Bonding Curve Test:</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                        <div style={{ background: '#f0f8f0', padding: '10px', borderRadius: '8px' }}>
                          <strong>0 tokens sold:</strong><br/>
                          APT: {calculateCurrentPrice(0).toFixed(10)} APT/token<br/>
                          USD: {formatPrice(calculateCurrentPrice(0) * aptPrice)}<br/>
                          <small>Expected: 0.00000085692</small>
                        </div>
                        <div style={{ background: '#f0f8f0', padding: '10px', borderRadius: '8px' }}>
                          <strong>100M tokens sold:</strong><br/>
                          APT: {calculateCurrentPrice(100000000).toFixed(10)} APT/token<br/>
                          USD: {formatPrice(calculateCurrentPrice(100000000) * aptPrice)}<br/>
                          <small>Expected: 0.00000096330</small>
                        </div>
                        <div style={{ background: '#f0f8f0', padding: '10px', borderRadius: '8px' }}>
                          <strong>400M tokens sold:</strong><br/>
                          APT: {calculateCurrentPrice(400000000).toFixed(10)} APT/token<br/>
                          USD: {formatPrice(calculateCurrentPrice(400000000) * aptPrice)}<br/>
                          <small>Expected: 0.00000126987</small>
                        </div>
                        <div style={{ background: '#f0f8f0', padding: '10px', borderRadius: '8px' }}>
                          <strong>700M tokens sold:</strong><br/>
                          APT: {calculateCurrentPrice(700000000).toFixed(10)} APT/token<br/>
                          USD: {formatPrice(calculateCurrentPrice(700000000) * aptPrice)}<br/>
                          <small>Expected: 0.00000263315</small>
                        </div>
                        <div style={{ background: '#f0f8f0', padding: '10px', borderRadius: '8px' }}>
                          <strong>Graduation (792,260,950):</strong><br/>
                          APT: {calculateCurrentPrice(792260950).toFixed(10)} APT/token<br/>
                          USD: {formatPrice(calculateCurrentPrice(792260950) * aptPrice)}<br/>
                          <small>Expected: 0.00002520570</small>
                        </div>
                        <div style={{ background: '#f0f8f0', padding: '10px', borderRadius: '8px' }}>
                          <strong>Market Cap (0 sold):</strong><br/>
                          {formatMarketCap(calculateMarketCap(0, aptPrice))}
                        </div>
                      </div>
                    </div>
                  )} */}

          <section>
            <div className="section-header">
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>{tokens.length} tokens trading now</span>
              <Link to="/launch" className="read-more">Launch Your Token Now →</Link>
            </div>

            <div className="sort-section">
              <div className="sort-header">
                <p>Sort by:</p>
              </div>
              <div className="marketplace-sort">
                <div className={`sort-dropdown ${activeDropdown === 'marketCap' ? 'active' : ''}`}>
                  <div 
                    className="sort-dropdown-header"
                    onClick={(e: React.MouseEvent) => handleDropdownClick('marketCap', e)}
                  >
                    <span>Market Cap</span>
                    <span className="dropdown-arrow">▼</span>
                  </div>
                  <div className="sort-dropdown-content">
                    <button 
                      className={`sort-option ${sortOrder === 'highest_mc' ? 'active' : ''}`}
                      onClick={() => {
                        setSortOrder('highest_mc');
                        setActiveDropdown(null);
                      }}
                    >
                      Highest First
                    </button>
                    <button 
                      className={`sort-option ${sortOrder === 'lowest_mc' ? 'active' : ''}`}
                      onClick={() => {
                        setSortOrder('lowest_mc');
                        setActiveDropdown(null);
                      }}
                    >
                      Lowest First
                    </button>
                  </div>
                </div>
                <div className={`sort-dropdown ${activeDropdown === 'volume' ? 'active' : ''}`}>
                  <div 
                    className="sort-dropdown-header"
                    onClick={(e: React.MouseEvent) => handleDropdownClick('volume', e)}
                  >
                    <span>Volume</span>
                    <span className="dropdown-arrow">▼</span>
                  </div>
                  <div className="sort-dropdown-content">
                    <button 
                      className={`sort-option ${sortOrder === 'highest_vol' ? 'active' : ''}`}
                      onClick={() => {
                        setSortOrder('highest_vol');
                        setActiveDropdown(null);
                      }}
                    >
                      Highest First
                    </button>
                    <button 
                      className={`sort-option ${sortOrder === 'lowest_vol' ? 'active' : ''}`}
                      onClick={() => {
                        setSortOrder('lowest_vol');
                        setActiveDropdown(null);
                      }}
                    >
                      Lowest First
                    </button>
                  </div>
                </div>
                <div className={`sort-dropdown ${activeDropdown === 'age' ? 'active' : ''}`}>
                  <div 
                    className="sort-dropdown-header"
                    onClick={(e: React.MouseEvent) => handleDropdownClick('age', e)}
                  >
                    <span>Age</span>
                    <span className="dropdown-arrow">▼</span>
                  </div>
                  <div className="sort-dropdown-content">
                    <button 
                      className={`sort-option ${sortOrder === 'newest' ? 'active' : ''}`}
                      onClick={() => {
                        setSortOrder('newest');
                        setActiveDropdown(null);
                      }}
                    >
                      Newest First
                    </button>
                    <button 
                      className={`sort-option ${sortOrder === 'oldest' ? 'active' : ''}`}
                      onClick={() => {
                        setSortOrder('oldest');
                        setActiveDropdown(null);
                      }}
                    >
                      Oldest First
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>Loading tokens…</div>
            ) : tokens.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                {searchQuery ? `No tokens match "${searchQuery}"` : 'No tokens found.'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', padding: '4px 0 8px' }}>
                {tokens.map((token, index) => {
                  const change = token.change24h;
                  const isPos = change != null && change >= 0;
                  const changeColor = change == null ? 'var(--text-muted)' : isPos ? 'var(--positive)' : 'var(--negative)';
                  return (
                    <div
                      key={index}
                      onClick={() => handleTradeClick(token)}
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        padding: '16px',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)';
                        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,212,170,0.12)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                      }}
                    >
                      {/* Header row: icon + name + change badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {token.image ? (
                          <img
                            src={token.image}
                            alt={token.symbol}
                            style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div style={{
                            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                            background: getTokenIconBg(token.symbol),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '20px',
                          }}>
                            {getTokenIcon(token.symbol)}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {token.name}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>${token.symbol}</div>
                        </div>
                        <div style={{
                          fontSize: '12px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                          color: changeColor,
                          background: change == null ? 'transparent' : isPos ? 'rgba(0,212,170,0.12)' : 'rgba(255,71,87,0.12)',
                          flexShrink: 0,
                        }}>
                          {change == null ? '—' : `${isPos ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%`}
                        </div>
                      </div>

                      {/* Price + market cap row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price</div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {token.priceUSD != null ? formatPrice(token.priceUSD) : `${(token.price || 0).toFixed(8)} APT`}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mkt cap</div>
                          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--accent)' }}>
                            {token.marketCapUSD != null ? formatMarketCap(token.marketCapUSD) : `${(token.marketCap || 0).toFixed(2)} APT`}
                          </div>
                        </div>
                      </div>

                      {/* Footer: vol + creator + trade button */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '10px', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '1px' }}>Vol 24h</div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>{formatVolume(token.volume || 0)}</div>
                        </div>
                        {token.creatorAddress && token.creatorAddress !== 'Unknown' && (
                          <div
                            style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', cursor: 'pointer' }}
                            onClick={e => { e.stopPropagation(); navigate(`/profile/${token.creatorAddress}`); }}
                            title={token.creatorAddress}
                          >
                            by {truncateAddress(token.creatorAddress)}
                          </div>
                        )}
                        <button
                          className="trade-btn"
                          style={{ padding: '6px 16px', fontSize: '13px', flexShrink: 0 }}
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
          </section>
        </main>

        <aside className="sidebar">
          <div className="sidebar-card">
            <h3>Launch your token today!</h3>
            <p>For 0.2 APT, your project can begin trading immediately.</p>
            <Link to="/launch">
              <button className="sidebar-btn">Launch Now</button>
            </Link>
          </div>

          <div className="movers-card">
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              textAlign: 'center',
              padding: '40px 20px',
              minHeight: '400px'
            }}>
              <div style={{ 
                fontSize: '48px', 
                marginBottom: '20px',
                opacity: 0.3
              }}>📢</div>
              <h3 style={{
                fontSize: '17px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '10px',
                letterSpacing: '-0.01em'
              }}>
                Advertise Here
              </h3>
              <p style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                lineHeight: '1.6',
                marginBottom: '20px',
                maxWidth: '240px'
              }}>
                Promote your token to active traders. Get max visibility in our premium ad space.
              </p>
              <button className="trade-btn" style={{ padding: '10px 20px' }}>
                Contact Us
              </button>
            </div>
          </div>
        </aside>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-section">
            <h4>MoveMint</h4>
            <p>Launch and trade tokens on the MoveMint platform. Join the future of decentralized finance.</p>
            <div className="footer-social">
              <a href="#" className="social-link">Twitter</a>
              <a href="#" className="social-link">Telegram</a>
              <a href="#" className="social-link">Discord</a>
              <a href="#" className="social-link">GitHub</a>
            </div>
          </div>
          
          <div className="footer-section">
            <h4>Products</h4>
            <ul className="footer-links">
              <li><Link to="/marketplace">Marketplace</Link></li>
              <li><Link to="/boost">Boost</Link></li>
              <li><Link to="/launch">Token Launch</Link></li>
              <li><Link to="/trading">Trading</Link></li>
              <li><Link to="/analytics">Analytics</Link></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4>Resources</h4>
            <ul className="footer-links">
              <li><Link to="/docs">Documentation</Link></li>
              <li><Link to="/api">API</Link></li>
              <li><Link to="/support">Support</Link></li>
              <li><Link to="/blog">Blog</Link></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4>Company</h4>
            <ul className="footer-links">
              <li><Link to="/about">About</Link></li>
              <li><Link to="/careers">Careers</Link></li>
              <li><Link to="/privacy">Privacy Policy</Link></li>
              <li><Link to="/terms">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="footer-bottom-content">
            <p>&copy; 2024 MoveMint. All rights reserved.</p>
            <div className="footer-bottom-links">
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
              <Link to="/cookies">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default HomePage; 