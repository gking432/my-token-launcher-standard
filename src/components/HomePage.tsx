import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { MODULE_ADDRESS } from "../config";
import { useTokenData } from '../hooks/useTokenData';
import { useTokenList } from '../data/useTokenList';
import { useAptPrice } from '../contexts/AptPriceContext';

const HomePage: React.FC = () => {
  const { account } = useWallet();
  const navigate = useNavigate();
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'highest_mc' | 'lowest_mc' | 'highest_vol' | 'lowest_vol'>('newest');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
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

  // Sort tokens based on sortOrder
  const tokens = useMemo(() => {
    const sortedTokens = [...rawTokens];
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
  }, [rawTokens, sortOrder]);

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
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          html, body {
            width: 100%;
            margin: 0;
            padding: 0;
            overflow-x: hidden;
          }

          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.5;
          }

          .promo-banner {
            background: #00d4aa;
            color: white;
            text-align: center;
            padding: 12px 0;
            font-size: 14px;
            font-weight: 500;
          }

          .header {
            background: var(--bg-primary);
            border-bottom: 1px solid var(--border);
            padding: 16px 0;
            width: 100vw;
            max-width: 100vw;
            margin-left: calc(-50vw + 50%);
            margin-right: calc(-50vw + 50%);
            box-sizing: border-box;
          }

          .nav-container {
            max-width: 1600px;
            margin: 0 auto;
            padding: 0 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 48px;
            width: 100%;
          }

          .nav-search {
            flex: 1;
            max-width: 500px;
            margin: 0 auto;
          }

          .nav-search-input {
            width: 100%;
            padding: 10px 16px;
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 14px;
            background: var(--bg-secondary);
            color: var(--text-primary);
          }

          .nav-search-input::placeholder {
            color: var(--text-muted);
          }

          .logo {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 28px;
            font-weight: 900;
            color: var(--text-primary);
            color: var(--text-primary);
          }

          .logo-dot {
            width: 12px;
            height: 12px;
            background: #00d4aa;
            border-radius: 50%;
          }

          .nav-links {
            display: flex;
            gap: 48px;
            list-style: none;
            align-items: center;
            margin: 0;
            padding: 0;
          }

          .nav-links a {
            color: var(--text-secondary);
            text-decoration: none;
            font-weight: 500;
            font-size: 16px;
            transition: color 0.2s;
          }

          .nav-links a:hover {
            color: var(--text-primary);
          }

          .auth-section {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-left: auto;
          }


          .sign-in {
            color: var(--text-primary);
            text-decoration: none;
            font-weight: 500;
          }

          .sign-up {
            background: #00d4aa;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            transition: background 0.2s;
          }

          .sign-up:hover {
            background: #00b894;
          }

          .main-container {
            width: 100vw;
            max-width: 100vw;
            margin-left: calc(-50vw + 50%);
            margin-right: calc(-50vw + 50%);
            box-sizing: border-box;
          }
          
          .main-container-inner {
            max-width: 1600px;
            width: 100%;
            margin: 0 auto;
            padding: 32px 24px;
            display: flex;
            gap: 32px;
            min-height: calc(100vh - 200px);
            box-sizing: border-box;
          }

          .content {
            flex: 1;
          }

          .page-header {
            margin-bottom: 24px;
          }

          .page-title {
            font-size: 68px;
            font-weight: 600;
            margin-bottom: 16px;
            color: var(--text-primary);
          }


          .section-header {
            margin-bottom: 24px;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .section-title {
            font-size: 32px;
            font-weight: 600;
            margin-bottom: 8px;
          }

          .section-subtitle {
            color: var(--text-secondary);
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 8px;
          }

          .read-more {
            color: #00d4aa;
            text-decoration: none;
            font-weight: 500;
          }

          .table-controls {
            display: flex;
            gap: 16px;
            margin-bottom: 24px;
            flex-wrap: wrap;
          }

          .control-dropdown {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--bg-primary);
            cursor: pointer;
            font-size: 14px;
            color: var(--text-primary);
          }

          .crypto-table {
            width: 100%;
            border-collapse: collapse;
            background: var(--bg-primary);
          }

          .crypto-table th {
            text-align: left;
            padding: 16px 12px;
            font-weight: 600;
            color: var(--text-secondary);
            font-size: 14px;
            border-bottom: 1px solid var(--border);
          }

          .crypto-table td {
            padding: 16px 12px;
            border-bottom: 1px solid var(--bg-secondary);
            color: var(--text-primary);
          }

          .crypto-table tr:hover {
            background: var(--bg-hover);
          }

          .asset-cell {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .asset-icon {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            font-size: 16px;
          }

          .doge { background: linear-gradient(135deg, #c2a633, #f7d794); }
          .pepe { background: linear-gradient(135deg, #4caf50, #81c784); }
          .shib { background: linear-gradient(135deg, #ff6b35, #ff8f65); }
          .bonk { background: linear-gradient(135deg, #9c27b0, #ba68c8); }
          .floki { background: linear-gradient(135deg, #ff5722, #ff8a65); }

          .asset-info {
            display: flex;
            flex-direction: column;
          }

          .asset-name {
            font-weight: 600;
            color: var(--text-primary);
            font-size: 16px;
          }

          .asset-symbol {
            color: var(--text-secondary);
            font-size: 14px;
          }

          .price {
            font-weight: 600;
            font-size: 16px;
          }

          .chart-mini {
            width: 80px;
            height: 40px;
          }

          .change-positive {
            color: #00d4aa;
            font-weight: 600;
          }

          .change-negative {
            color: #ff4747;
            font-weight: 600;
          }

          .mkt-cap {
            color: #00d4aa;
            font-weight: 600;
          }

          .volume {
            color: var(--text-secondary);
          }

          .trade-btn {
            background: #00d4aa;
            color: white;
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
          }

          .trade-btn:hover {
            background: #00b894;
          }

          .sidebar {
            width: 300px;
            display: flex;
            flex-direction: column;
            gap: 24px;
            min-height: 100%;
          }

          .sidebar-card {
            background: #00d4aa;
            color: white;
            padding: 24px;
            border-radius: 12px;
            position: relative;
            overflow: hidden;
          }

          .sidebar-card h3 {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 8px;
          }

          .sidebar-card p {
            margin-bottom: 16px;
            opacity: 0.9;
          }

          .sidebar-btn {
            background: white;
            color: #00d4aa;
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
          }

          .coin-icon {
            position: absolute;
            right: 16px;
            top: 16px;
            width: 48px;
            height: 48px;
            opacity: 0.3;
          }

          .movers-card {
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
          }

          .movers-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
          }

          .movers-title {
            font-size: 18px;
            font-weight: 600;
          }

          .movers-nav {
            display: flex;
            gap: 8px;
          }

          .nav-arrow {
            width: 32px;
            height: 32px;
            border: 1px solid var(--border);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: var(--text-secondary);
          }

          .movers-subtitle {
            color: var(--text-secondary);
            font-size: 14px;
            margin-bottom: 16px;
          }

          .mover-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 0;
            border-bottom: 1px solid var(--bg-secondary);
          }

          .mover-item:last-child {
            border-bottom: none;
          }

          .mover-icon {
            width: 24px;
            height: 24px;
            border-radius: 50%;
          }

          .mover-info {
            flex: 1;
          }

          .mover-name {
            font-weight: 600;
            font-size: 14px;
          }

          .mover-price {
            color: var(--text-secondary);
            font-size: 12px;
          }

          .mover-change {
            font-weight: 600;
            font-size: 14px;
          }
          
          /* Footer Styles */
          .footer {
            background: var(--bg-primary);
            border-top: 1px solid var(--border);
            width: 100vw;
            max-width: 100vw;
            padding: 40px 0;
            margin-left: calc(-50vw + 50%);
            margin-right: calc(-50vw + 50%);
            box-sizing: border-box;
          }
          
          .footer-container {
            max-width: 1600px;
            margin: 0 auto;
            padding: 0 24px;
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1fr;
            gap: 40px;
          }
          
          .footer-section h4 {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 16px;
          }
          
          .footer-section p {
            font-size: 14px;
            color: var(--text-secondary);
            line-height: 1.6;
            margin-bottom: 20px;
          }
          
          .footer-social {
            display: flex;
            gap: 16px;
          }
          
          .social-link {
            color: var(--text-secondary);
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
            transition: color 0.2s;
          }
          
          .social-link:hover {
            color: #00d4aa;
          }
          
          .footer-links {
            list-style: none;
            padding: 0;
          }
          
          .footer-links li {
            margin-bottom: 8px;
          }
          
          .footer-links a {
            color: #5b616e;
            text-decoration: none;
            font-size: 14px;
            transition: color 0.2s;
          }
          
          .footer-links a:hover {
            color: #00d4aa;
          }
          
          .footer-bottom {
            border-top: 1px solid var(--border);
            padding: 20px 0;
            margin-top: 40px;
            width: 100%;
          }

          .footer-bottom-content {
            max-width: 1600px;
            margin: 0 auto;
            padding: 0 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
          }
          
          .footer-bottom p {
            font-size: 14px;
            color: var(--text-secondary);
          }
          
          .footer-bottom-links {
            display: flex;
            gap: 20px;
          }
          
          .footer-bottom-links a {
            color: #5b616e;
            text-decoration: none;
            font-size: 14px;
            transition: color 0.2s;
          }
          
          .footer-bottom-links a:hover {
            color: #00d4aa;
          }
          
          .sort-section {
            background: #f8f9fa;
            border: 1px solid #e7ebee;
            border-radius: 12px;
            padding: 20px 24px;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
          }
          
          .sort-header {
            margin: 0;
            display: flex;
            align-items: center;
          }
          
          .sort-header p {
            font-size: 14px;
            font-weight: 600;
            color: #0a0b0d;
            margin: 0;
            letter-spacing: 0.3px;
            white-space: nowrap;
          }
          
          .marketplace-sort {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            flex: 1;
          }
          
          .sort-dropdown {
            position: relative;
            min-width: 140px;
          }
          
          .sort-dropdown-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 16px;
            background: #ffffff;
            border: 1px solid #d8dce0;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: #0a0b0d;
            transition: all 0.2s;
            min-width: 140px;
          }
          
          .sort-dropdown-header:hover {
            border-color: #00d4aa;
            background: #f8f9fa;
          }
          
          .sort-dropdown.active .sort-dropdown-header {
            border-color: #00d4aa;
            box-shadow: 0 0 0 3px rgba(0, 212, 170, 0.1);
            background: #ffffff;
          }
          
          .dropdown-arrow {
            font-size: 12px;
            color: #5b616e;
            transition: transform 0.2s;
            margin-left: 8px;
          }
          
          .sort-dropdown.active .dropdown-arrow {
            transform: rotate(180deg);
          }
          
          .sort-dropdown-content {
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            right: 0;
            background: #ffffff;
            border: 1px solid #e7ebee;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
            z-index: 1000;
            opacity: 0;
            visibility: hidden;
            transform: translateY(-8px);
            transition: all 0.2s ease;
            margin-top: 4px;
            min-width: 100%;
            overflow: hidden;
          }
          
          .sort-dropdown.active .sort-dropdown-content {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
            display: block;
          }
          
          .sort-option {
            display: block;
            width: 100%;
            padding: 10px 16px;
            background: none;
            border: none;
            text-align: left;
            font-size: 14px;
            color: #0a0b0d;
            cursor: pointer;
            transition: background 0.2s;
          }
          
          .sort-option:hover {
            background: #f8f9fa;
          }
          
          .sort-option.active {
            background: #00d4aa;
            color: #ffffff;
          }
          
          .sort-option.active:hover {
            background: #00b894;
          }
          
          @media (max-width: 768px) {
            .nav-links {
              display: none;
            }
            
            .main-container {
              grid-template-columns: 1fr;
              gap: 24px;
            }
            
            .page-title {
              font-size: 32px;
            }
            
            .table-controls {
              flex-direction: column;
            }
            
            .sort-section {
              padding: 16px 20px;
              flex-direction: column;
              align-items: flex-start;
            }
            
            .marketplace-sort {
              gap: 8px;
              width: 100%;
            }
            
            .sort-dropdown {
              min-width: 120px;
              flex: 1;
            }
            
            .sort-dropdown-header {
              min-width: 120px;
              padding: 8px 12px;
            }
            
            .crypto-table {
              font-size: 14px;
            }
          }

          @media (max-width: 768px) {
            .footer-container {
              grid-template-columns: 1fr;
              gap: 30px;
            }
            
            .footer-bottom-content {
              flex-direction: column;
              gap: 16px;
              text-align: center;
            }
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
            <input type="text" className="nav-search-input" placeholder="Search for a meme coin..." />
          </div>
          <nav>
            <ul className="nav-links">
              <li><Link to="/marketplace">Marketplace</Link></li>
              <li><Link to="/launch">Launch</Link></li>
            </ul>
          </nav>
          <div className="auth-section">
            <Link to="/launch" className="sign-up">Launch Token</Link>
          </div>
        </div>
      </header>

      <div className="main-container">
        <div className="main-container-inner">
        <main className="content">
          <div className="page-header">
            <h1 className="page-title">Smarter. Faster. Better.</h1>
            <p style={{ fontSize: '20px', color: '#5b616e', marginTop: '16px', maxWidth: '800px', lineHeight: '1.6' }}>
              Launch in seconds with zero code, instant liquidity, and lightning-fast transactions at minimal fees. See what's possible when token creation meets innovation.
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
              <span style={{ color: '#5b616e', fontSize: '16px' }}>{tokens.length} tokens trading now</span>
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

            <table className="crypto-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Price</th>
                  <th>Chart</th>
                  <th>Change</th>
                  <th style={{ color: '#00d4aa' }}>Mkt cap</th>
                  <th>Volume</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>Loading tokens...</td>
                  </tr>
                ) : tokens.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>No tokens found.</td>
                  </tr>
                ) : (
                  tokens.map((token, index) => (
                    <tr key={index}>
                      <td>
                        <div className="asset-cell">
                          <div className="asset-icon" style={{ background: getTokenIconBg(token.symbol) }}>{getTokenIcon(token.symbol)}</div>
                          <div className="asset-info">
                            <div className="asset-name">{token.name}</div>
                            <div className="asset-symbol">{token.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className="price">{token.priceUSD != null ? formatPrice(token.priceUSD) : `${(token.price || 0).toFixed(8)} APT`}</td>
                      <td>
                        <svg className="chart-mini" viewBox="0 0 80 40">
                          <polyline fill="none" stroke="#00d4aa" strokeWidth="2" points="0,30 20,25 40,15 60,10 80,5"/>
                        </svg>
                      </td>
                      <td className={token.change24h != null && token.change24h >= 0 ? 'change-positive' : 'change-negative'}>
                        {token.change24h != null ? `${token.change24h >= 0 ? '⬆' : '⬇'} ${Math.abs(token.change24h).toFixed(2)}%` : '—'}
                      </td>
                      <td className="mkt-cap">{token.marketCapUSD != null ? formatMarketCap(token.marketCapUSD) : `${(token.marketCap || 0).toFixed(2)} APT`}</td>
                      <td className="volume">{formatVolume(token.volume || 0)}</td>
                      <td><button className="trade-btn" onClick={() => handleTradeClick(token)}>Trade</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
                fontSize: '20px', 
                fontWeight: 600, 
                color: '#0a0b0d',
                marginBottom: '12px'
              }}>
                Advertise Here
              </h3>
              <p style={{ 
                fontSize: '14px', 
                color: '#5b616e',
                lineHeight: '1.6',
                marginBottom: '24px',
                maxWidth: '240px'
              }}>
                Promote your token to active traders. Get max visibility in our premium ad space.
              </p>
              <button style={{
                background: '#00d4aa',
                color: 'white',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#00b894'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#00d4aa'}
              >
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