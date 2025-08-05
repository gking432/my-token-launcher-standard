import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { MODULE_ADDRESS } from "../config";

const HomePage: React.FC = () => {
  const { account } = useWallet();
  const navigate = useNavigate();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);

  // Aptos client setup
  const config = useMemo(() => new AptosConfig({ 
    network: Network.DEVNET,
    fullnode: "https://fullnode.devnet.aptoslabs.com/v1",
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
    marketCap?: number;
    volume?: number;
    change24h?: number;
  }

  // Fetch tokens from blockchain and localStorage
  const fetchTokens = async () => {
    try {
      setLoading(true);
      console.log("Starting blockchain fetch...");
      
      // Fetch tokens from blockchain
      const blockchainTokens: Token[] = [];
      
      try {
        console.log("Fetching ModuleState from:", tokenLauncherAddress);
        
        // Get ModuleState to access the token metadata table
        const moduleState = await client.getAccountResource({
          accountAddress: tokenLauncherAddress,
          resourceType: `${tokenLauncherAddress}::token_launcher::ModuleState`,
        });

        console.log("ModuleState response:", moduleState);

        if (moduleState.data && moduleState.data.token_metadata && moduleState.data.token_metadata.handle) {
          console.log("ModuleState found:", moduleState.data);
          
          // Get recent transactions to find token creation events
          console.log("Fetching recent transactions...");
          const recentTransactions = await client.getAccountTransactions({
            accountAddress: tokenLauncherAddress,
            options: { limit: 50 } // Reduced limit to avoid rate limits
          });

          console.log("Found transactions:", recentTransactions.length);

          // Process transactions to find token creation events
          for (const tx of recentTransactions) {
            console.log("Processing transaction:", tx.hash);
            console.log("Transaction type:", tx.type);
            
            if (tx.type === "user_transaction" && tx.events) {
              console.log("Transaction events:", tx.events.length);
              
              for (const event of tx.events) {
                console.log("Event type:", event.type);
                
                // Check for any token-related events
                if (event.type.includes("token_launcher") || 
                    event.type.includes("Token") ||
                    event.type.includes("token")) {
                  
                  console.log("Found token-related event:", event);
                  
                  try {
                    // Helper function to convert hex string to readable string
                    const hexToString = (hex: string) => {
                      if (!hex || !hex.startsWith("0x")) return "";
                      try {
                        const hexWithoutPrefix = hex.replace("0x", "");
                        const bytes = [];
                        for (let i = 0; i < hexWithoutPrefix.length; i += 2) {
                          bytes.push(parseInt(hexWithoutPrefix.substr(i, 2), 16));
                        }
                        return String.fromCharCode(...bytes);
                      } catch (error) {
                        console.error("Error converting hex to string:", error, "Hex:", hex);
                        return "";
                      }
                    };

                    // Extract token data from the event
                    const eventData = event.data;
                    console.log("Event data:", eventData);
                    
                    const creator = eventData.creator || eventData.creator_address || "Unknown";
                    
                    // Parse token name and symbol
                    let name = "Unknown";
                    let symbol = "N/A";
                    
                    if (eventData.original_name) {
                      if (typeof eventData.original_name === "string" && eventData.original_name.startsWith("0x")) {
                        name = hexToString(eventData.original_name);
                      } else if (Array.isArray(eventData.original_name)) {
                        name = String.fromCharCode(...eventData.original_name);
                      }
                    }
                    
                    if (eventData.ticker) {
                      if (typeof eventData.ticker === "string" && eventData.ticker.startsWith("0x")) {
                        symbol = hexToString(eventData.ticker);
                      } else if (Array.isArray(eventData.ticker)) {
                        symbol = String.fromCharCode(...eventData.ticker);
                      }
                    }

                    const supply = Number(eventData.total_supply || eventData.supply || 0);
                    const metadataAddress = eventData.metadata_addr || eventData.metadata_address;
                    const txHash = tx.hash;
                    const launchDate = new Date(Number(tx.timestamp) / 1000).toISOString();

                    console.log("Parsed token data:", { name, symbol, supply, creator, metadataAddress });

                    // Calculate mock price data (you can implement real price fetching later)
                    const price = Math.random() * 0.01 + 0.0001;
                    const marketCap = price * supply;
                    const volume = Math.random() * 1000000 + 10000;
                    const change24h = (Math.random() - 0.5) * 100;

                    const token: Token = {
                      name: name || "Unknown Token",
                      symbol: symbol || "N/A",
                      supply,
                      txHash,
                      image: null,
                      launchDate,
                      creator,
                      metadataAddress,
                      price,
                      marketCap,
                      volume,
                      change24h,
                    };

                    // Check if we already have this token (avoid duplicates)
                    const existingToken = blockchainTokens.find(t => t.txHash === txHash);
                    if (!existingToken) {
                      console.log("Adding token to list:", token);
                      blockchainTokens.push(token);
                    }
                  } catch (eventError) {
                    console.error("Error processing token creation event:", eventError);
                  }
                }
              }
            }
          }
          
          console.log("Total tokens found from blockchain:", blockchainTokens.length);
        } else {
          console.log("ModuleState not found or invalid structure");
        }
      } catch (blockchainError) {
        console.error("Error fetching from blockchain:", blockchainError);
        
        // Fallback to localStorage only if blockchain completely fails
        console.log("Falling back to localStorage...");
        const users = JSON.parse(localStorage.getItem("users") || "{}");
        Object.keys(users).forEach(wallet => {
          const userTokens = users[wallet].launchedTokens || [];
          userTokens.forEach((token: Token) => {
            const tokenWithPrices = {
              ...token,
              creator: wallet,
              price: Math.random() * 0.01 + 0.0001,
              marketCap: (Math.random() * 0.01 + 0.0001) * token.supply,
              volume: Math.random() * 1000000 + 10000,
              change24h: (Math.random() - 0.5) * 100,
            };
            blockchainTokens.push(tokenWithPrices);
          });
        });
      }

      // Sort by launch date (newest first)
      blockchainTokens.sort((a, b) => {
        const dateA = new Date(a.launchDate).getTime();
        const dateB = new Date(b.launchDate).getTime();
        return dateB - dateA;
      });

      console.log("Final token list:", blockchainTokens);
      setTokens(blockchainTokens);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      setTokens([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
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
    navigate(`/token/${token.txHash}`, {
      state: {
        name: token.name,
        symbol: token.symbol,
        supply: token.supply,
        txHash: token.txHash,
        metadataAddress: token.metadataAddress,
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

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #ffffff;
            color: #0a0b0d;
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
            background: #ffffff;
            border-bottom: 1px solid #e7ebee;
            padding: 16px 0;
          }

          .nav-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .logo {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 28px;
            font-weight: 900;
            color: #0a0b0d;
          }

          .logo-dot {
            width: 12px;
            height: 12px;
            background: #00d4aa;
            border-radius: 50%;
          }

          .nav-links {
            display: flex;
            gap: 32px;
            list-style: none;
            align-items: center;
          }

          .nav-links a {
            color: #5b616e;
            text-decoration: none;
            font-weight: 500;
            font-size: 16px;
            transition: color 0.2s;
          }

          .nav-links a:hover {
            color: #0a0b0d;
          }

          .auth-section {
            display: flex;
            align-items: center;
            gap: 16px;
          }

          .settings-icon {
            width: 24px;
            height: 24px;
            cursor: pointer;
          }

          .sign-in {
            color: #0a0b0d;
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
            max-width: 1200px;
            margin: 0 auto;
            padding: 32px 24px;
            display: flex;
            gap: 32px;
            min-height: calc(100vh - 200px);
          }

          .content {
            flex: 1;
          }

          .page-header {
            margin-bottom: 24px;
          }

          .page-title {
            font-size: 48px;
            font-weight: 600;
            margin-bottom: 16px;
            color: #0a0b0d;
          }

          .index-info {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #5b616e;
            font-size: 16px;
            margin-bottom: 32px;
          }

          .index-change {
            color: #00d4aa;
            font-weight: 600;
          }

          .search-container {
            margin-bottom: 32px;
          }

          .search-input {
            width: 100%;
            max-width: 400px;
            padding: 12px 16px;
            border: 1px solid #d8dce0;
            border-radius: 8px;
            font-size: 16px;
            background: #f7f8fa;
          }

          .search-input::placeholder {
            color: #8a92a5;
          }

          .section-header {
            margin-bottom: 24px;
          }

          .section-title {
            font-size: 32px;
            font-weight: 600;
            margin-bottom: 8px;
          }

          .section-subtitle {
            color: #5b616e;
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
            border: 1px solid #d8dce0;
            border-radius: 6px;
            background: white;
            cursor: pointer;
            font-size: 14px;
            color: #0a0b0d;
          }

          .crypto-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
          }

          .crypto-table th {
            text-align: left;
            padding: 16px 12px;
            font-weight: 600;
            color: #5b616e;
            font-size: 14px;
            border-bottom: 1px solid #e7ebee;
          }

          .crypto-table td {
            padding: 16px 12px;
            border-bottom: 1px solid #f7f8fa;
          }

          .crypto-table tr:hover {
            background: #f7f8fa;
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
            color: #0a0b0d;
            font-size: 16px;
          }

          .asset-symbol {
            color: #5b616e;
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
            color: #5b616e;
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
            background: white;
            border: 1px solid #e7ebee;
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
            border: 1px solid #e7ebee;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: #5b616e;
          }

          .movers-subtitle {
            color: #5b616e;
            font-size: 14px;
            margin-bottom: 16px;
          }

          .mover-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 0;
            border-bottom: 1px solid #f7f8fa;
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
            color: #5b616e;
            font-size: 12px;
          }

          .mover-change {
            font-weight: 600;
            font-size: 14px;
          }
          
          /* Footer Styles */
          .footer {
            background: #ffffff;
            border-top: 1px solid #e7ebee;
            width: 100%;
            padding: 40px 24px;
          }
          
          .footer-container {
            max-width: 1200px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1fr;
            gap: 40px;
          }
          
          .footer-section h4 {
            font-size: 16px;
            font-weight: 600;
            color: #050f19;
            margin-bottom: 16px;
          }
          
          .footer-section p {
            font-size: 14px;
            color: #5b616e;
            line-height: 1.6;
            margin-bottom: 20px;
          }
          
          .footer-social {
            display: flex;
            gap: 16px;
          }
          
          .social-link {
            color: #5b616e;
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
            border-top: 1px solid #e7ebee;
            padding: 20px 0;
            margin-top: 40px;
          }
          
          .footer-bottom-content {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .footer-bottom p {
            font-size: 14px;
            color: #5b616e;
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

      <div className="promo-banner">
        Get 25 APT and 50 MILLION tokens in rewards when you manage a project to graduation! 🚀
      </div>

      <header className="header">
        <div className="nav-container">
          <div className="logo">
            MoveMint
            <div className="logo-dot"></div>
          </div>
          <nav>
            <ul className="nav-links">
              <li><Link to="/marketplace">Marketplace</Link></li>
              <li><Link to="/boost">Boost</Link></li>
              <li><Link to="/trending">Trending</Link></li>
              <li><Link to="/communities">Communities</Link></li>
              <li><Link to="/learn">Learn</Link></li>
              <li><Link to="/docs">Docs</Link></li>
            </ul>
          </nav>
          <div className="auth-section">
            <div className="settings-icon">⚙️</div>
            <Link to="/launch" className="sign-in">Launch</Link>
            <Link to="/connect" className="sign-up">Connect Wallet</Link>
          </div>
        </div>
      </header>

      <div className="main-container">
        <main className="content">
          <div className="page-header">
            <h1 className="page-title">Explore meme coins</h1>
            <div className="index-info">
              <span>MoveMint Meme Index is up</span>
              <span className="index-change">⬆ 12.34% (24hrs)</span>
              <span>●</span>
            </div>
          </div>

          <div className="search-container">
            <input type="text" className="search-input" placeholder="Search for a meme coin..." />
          </div>

          <section>
            <div className="section-header">
              <h2 className="section-title">Launched Tokens</h2>
              <span style={{ color: '#5b616e', fontSize: '16px' }}>{tokens.length} tokens launched</span>
              <p className="section-subtitle">
                Discover the latest tokens launched on our platform! 🚀 Real tokens created by real users with zero coding required. Join the revolution of decentralized token creation.
              </p>
              <Link to="/launch" className="read-more">Launch Your Token</Link>
            </div>

            <div className="table-controls">
              <div className="control-dropdown">
                <span>🚀 All tokens</span>
                <span>▼</span>
              </div>
              <div className="control-dropdown">
                <span>24h</span>
                <span>▼</span>
              </div>
              <div className="control-dropdown">
                <span>USD</span>
                <span>▼</span>
              </div>
              <div className="control-dropdown">
                <span>{tokens.length} tokens</span>
                <span>▼</span>
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
                      <td className="price">{formatPrice(token.price || 0)}</td>
                      <td>
                        <svg className="chart-mini" viewBox="0 0 80 40">
                          <polyline fill="none" stroke="#00d4aa" strokeWidth="2" points="0,30 20,25 40,15 60,10 80,5"/>
                        </svg>
                      </td>
                      <td className="change-positive">⬆ {token.change24h?.toFixed(2)}%</td>
                      <td className="mkt-cap">{formatMarketCap(token.marketCap || 0)}</td>
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
            <div className="movers-header">
              <h3 className="movers-title">Top Communities 🔥</h3>
            </div>
            <div className="movers-subtitle">Compete with other communities for visibility</div>
            
            <div className="mover-item">
              <div className="mover-icon" style={{ background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)' }}>🚀</div>
              <div className="mover-info">
                <div className="mover-name">MOONSHOT</div>
                <div className="mover-price">$0.00142</div>
              </div>
              <div className="mover-change change-positive">⬆ 420 APT</div>
            </div>

            <div className="mover-item">
              <div className="mover-icon" style={{ background: 'linear-gradient(45deg, #a8edea, #fed6e3)' }}>🎭</div>
              <div className="mover-info">
                <div className="mover-name">GIGACHAD</div>
                <div className="mover-price">$0.0891</div>
              </div>
              <div className="mover-change change-positive">⬆ 234 APT</div>
            </div>
            <div className="mover-item" style={{ marginTop: '1px' }}>
              <div className="mover-icon" style={{ background: 'linear-gradient(45deg, #443101, #764ba2)' }}>😩</div>
              <div className="mover-info">
                <div className="mover-name">SHITFUCK</div>
                <div style={{ color: '#5b616e', fontSize: '12px' }}>$0.0000287</div>
              </div>
              <div className="mover-change change-positive">⬆ 219 APT</div>
            </div>

            <div className="mover-item">
              <div className="mover-icon" style={{ background: 'linear-gradient(45deg, #f093fb, #f5576c)' }}>🦄</div>
              <div className="mover-info">
                <div className="mover-name">UNICORN</div>
                <div style={{ color: '#5b616e', fontSize: '12px' }}>$0.0000078</div>
              </div>
              <div className="mover-change change-positive">⬆ 169 APT</div>
            </div>

            <div className="mover-item" style={{ marginTop: '1px' }}>
              <div className="mover-icon" style={{ background: 'linear-gradient(45deg, #667eea, #764ba2)' }}>🌙</div>
              <div className="mover-info">
                <div className="mover-name">MOONCAT</div>
                <div style={{ color: '#5b616e', fontSize: '12px' }}>$0.000000433</div>
              </div>
              <div className="mover-change change-positive">⬆ 146 APT</div>
            </div>

            <div className="mover-item">
              <div className="mover-icon" style={{ background: 'linear-gradient(45deg, #2d9734, #f5576c)' }}> 💩</div>
              <div className="mover-info">
                <div className="mover-name">FUCKSHIT</div>
                <div style={{ color: '#5b616e', fontSize: '12px' }}>$0.000457</div>
              </div>
              <div className="mover-change change-positive">⬆  138 APT</div>
            </div>
          </div>
        </aside>
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