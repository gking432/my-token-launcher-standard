import React, { useState, useEffect, useMemo } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { InputTransactionData } from "@aptos-labs/wallet-adapter-core";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { MODULE_ADDRESS } from "../config";
import GlobalSidebar from './GlobalSidebar';
import GlobalHeaderBar from './GlobalHeaderBar';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTokenData } from '../hooks/useTokenData';
import { useTokenList } from '../data/useTokenList';
import { useAptPrice } from '../contexts/AptPriceContext';
import { useBalanceContext } from '../contexts/BalanceContext';
import { useWatchlist } from '../contexts/WatchlistContext';
import { useTheme } from '../contexts/ThemeContext';

const Marketplace: React.FC = () => {
  const { theme: t } = useTheme();
  const { account, signAndSubmitTransaction } = useWallet();
  const { metadataAddress } = useParams<{ metadataAddress?: string }>();
  const navigate = useNavigate();
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState(0.001);
  const [amountString, setAmountString] = useState('0.001');
  const [total, setTotal] = useState('0.000');
  const [slippageExpanded, setSlippageExpanded] = useState(false);
  const [selectedSlippage, setSelectedSlippage] = useState('1.0');
  const [slippage, setSlippage] = useState(100);
  const [headerMinimized, setHeaderMinimized] = useState(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  // Use the global balance context
  const { balances: tokenBalanceMap, loading: isLoadingBalances, getTokenBalance, refreshBalances } = useBalanceContext();
  
  // Use watchlist context
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  
  // Local state for current token balance display
  const [tokenBalance, setTokenBalance] = useState<string>('0.000');

  // Use the shared token data hook
  const { tokens: catalogTokens, loading, error, refetch } = useTokenData();
  const { aptPrice } = useAptPrice();

  // Live vault state — same merge pattern as HomePage so prices match exactly.
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
    marketCap?: number;
    volume?: number;
    change24h?: number;
    creatorAddress?: string;
  }

  // Helper functions from NEWtokenpage
  const stringToBytes = (str: string): number[] => {
    return Array.from(Buffer.from(str, 'utf8'));
  };

  const stringToHex = (str: string): string => {
    return Buffer.from(str, 'utf8').toString('hex');
  };

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



  // Use tokens directly from the shared hook (they're already processed)
  const tokens = rawTokens;

  // Auto-select token based on URL parameter
  useEffect(() => {
    console.log('🔍 URL metadataAddress:', metadataAddress);
    console.log('🔍 Available tokens:', tokens.map(t => ({ symbol: t.symbol, metadataAddress: t.metadataAddress })));
    
    // Log data source for debugging
    if (tokens.length > 0) {
      console.log(`✅ Marketplace loaded ${tokens.length} tokens successfully`);
    } else if (loading) {
      console.log('⏳ Marketplace is loading tokens...');
    } else if (error) {
      console.log('❌ Marketplace failed to load tokens due to error:', error);
    } else {
      console.log('⚠️ Marketplace has no tokens and is not loading');
    }
    
    if (metadataAddress && tokens.length > 0) {
      const token = tokens.find(t => t.metadataAddress === metadataAddress);
      if (token) {
        setSelectedToken(token);
        console.log('✅ Auto-selected token from URL:', token);
      } else {
        console.log('❌ Token not found for metadata address:', metadataAddress);
        console.log('🔍 Available metadata addresses:', tokens.map(t => t.metadataAddress));
      }
    }
  }, [metadataAddress, tokens]);

  // Fetch balance when selected token changes
  useEffect(() => {
    if (selectedToken && account?.address) {
      refreshBalances();
    }
  }, [selectedToken, account?.address]); // Remove refreshBalances dependency

  // Fetch all token balances when account changes or component mounts
  useEffect(() => {
    if (account?.address) {
      refreshBalances();
    }
  }, [account?.address]); // Remove refreshBalances dependency

  // Update current token balance when selected token changes
  useEffect(() => {
    if (selectedToken?.metadataAddress && tokenBalanceMap.size > 0) {
      const currentBalance = getTokenBalance(selectedToken.metadataAddress);
      setTokenBalance(currentBalance);
    }
  }, [selectedToken, tokenBalanceMap, getTokenBalance]);





  // Trading functions from NEWtokenpage
  const handleBuy = async () => {
    console.log("handleBuy - account:", account, "amount:", amount, "creatorAddress:", selectedToken?.creatorAddress, "symbol:", selectedToken?.symbol, "slippage:", slippage);
    if (!account || amount <= 0 || !selectedToken?.creatorAddress || !selectedToken?.symbol) {
      alert("Connect wallet, enter a valid amount, or ensure token details are available.");
      return;
    }

    try {
      const tokenAmount = Math.floor(amount);
      const tickerBytes = stringToBytes(selectedToken.symbol);

      console.log("Buying tokens with params:", {
        creatorAddress: selectedToken.creatorAddress,
        ticker: tickerBytes,
        tokenAmount: tokenAmount,
        maxSlippageBps: slippage
      });

      const buyTransaction: InputTransactionData = {
        data: {
          function: `${tokenLauncherAddress}::token_launcher::buy_tokens`,
          typeArguments: [],
          functionArguments: [
            selectedToken.creatorAddress,
            tickerBytes,
            tokenAmount,
            slippage
          ],
        },
      };

      const response = await signAndSubmitTransaction(buyTransaction);
      console.log("Buy response:", response);
      await client.waitForTransaction({ transactionHash: response.hash });
      alert(`Bought ${amount} ${selectedToken.symbol}! Tx: ${response.hash}`);

      // Refresh all token balances (force refresh after trade)
      await refreshBalances(true);
    } catch (error: any) {
      console.error("Buy error:", error);
      
      // Enhanced error handling for slippage protection
      if (error.errorCode === '1012' || error.message?.includes('1012')) {
        const currentSlippage = slippage / 100;
        const suggestedSlippage = Math.min(currentSlippage * 1.5, 10);
        alert(`Slippage exceeded: ${currentSlippage}% is too low. Try increasing to ${suggestedSlippage}% or reduce your trade size.`);
      } else if (error.errorCode === '1017' || error.message?.includes('1017')) {
        alert('Invalid slippage setting. Please use a value between 0.1% and 10%.');
      } else {
        alert("Failed to buy tokens. Check console.");
      }
    }
  };

  const handleSell = async () => {
    if (!account || amount <= 0 || !selectedToken?.creatorAddress || !selectedToken?.symbol) {
      alert("Connect wallet, enter a valid amount, or ensure token details are available.");
      return;
    }

    // Check if user has no enough tokens to sell
      const currentTokenBalance = parseFloat(tokenBalance || '0');
      if (amount > currentTokenBalance) {
        alert(`Insufficient token balance. You have ${currentTokenBalance.toFixed(6)} tokens, but trying to sell ${amount.toFixed(6)} tokens.`);
        return;
      }

    try {
      const tokenAmount = Math.floor(amount);
      const tickerBytes = stringToBytes(selectedToken.symbol);

      console.log("Selling tokens with params:", {
        creatorAddress: selectedToken.creatorAddress,
        ticker: tickerBytes,
        tokenAmount: tokenAmount,
        maxSlippageBps: slippage
      });

      const sellTransaction: InputTransactionData = {
        data: {
          function: `${tokenLauncherAddress}::token_launcher::sell_tokens`,
          typeArguments: [],
          functionArguments: [
            selectedToken.creatorAddress,
            tickerBytes,
            tokenAmount,
            slippage
          ],
        },
      };
      const response = await signAndSubmitTransaction(sellTransaction);
      console.log("Sell response:", response);
      await client.waitForTransaction({ transactionHash: response.hash });
      alert(`Sold ${amount} ${selectedToken.symbol}! Tx: ${response.hash}`);

      // Refresh all token balances (force refresh after trade)
      await refreshBalances(true);
    } catch (error: any) {
      console.error("Sell error:", error);
      
      // Enhanced error handling for slippage protection
      if (error.errorCode === '1012' || error.message?.includes('1012')) {
        const currentSlippage = slippage / 100;
        const suggestedSlippage = Math.min(currentSlippage * 1.5, 10);
        alert(`Slippage exceeded: ${currentSlippage}% is too low. Try increasing to ${suggestedSlippage}% or reduce your trade size.`);
      } else if (error.errorCode === '1017' || error.message?.includes('1017')) {
        alert('Invalid slippage setting. Please use a value between 0.1% and 10%.');
      } else {
        alert("Failed to sell tokens. Check console.");
      }
    }
  };

  const handleTrade = () => {
    if (activeTab === 'buy') {
      handleBuy();
    } else {
      handleSell();
    }
  };

  const handleSlippageToggle = () => {
    setSlippageExpanded(!slippageExpanded);
  };

  const handleSlippageSelect = (slippageValue: string) => {
    setSelectedSlippage(slippageValue);
    // Convert percentage to basis points for the contract
    const percentage = parseFloat(slippageValue);
    const basisPoints = Math.round(percentage * 100);
    setSlippage(basisPoints);
  };

  const toggleWalletDropdown = () => {
    setWalletDropdownOpen(!walletDropdownOpen);
  };

  const handleDisconnect = () => {
    // This will be handled by the wallet adapter
    setWalletDropdownOpen(false);
  };

  // Function to calculate total cost/return based on amount and current price (from NEWtokenpage)
  const calculateTotal = (amount: number) => {
    if (!amount || amount <= 0) return 0;
    
    const total_supply = 800_000_000;
    const tokens_sold_before = 0; // For first purchase
    const tokens_sold_after = tokens_sold_before + amount;
    
    const scale = 100_000_000; // 10^8 for APT Octas
    const price_scale = 1_000_000; // 10^6 for price scaling
    const price_numerator = 19_029_514_756; // New price numerator
    const price_constant = 6_190_532_760; // 61.9053276 * 10^8

    // For large purchases (over 100M tokens), use segmented approximation
    if (amount > 100_000_000) {
      const segments = 10; // Divide the purchase into 10 segments
      const segment_size = amount / segments;
      let total_cost = 0;

      for (let i = 0; i < segments; i++) {
        const segment_start = tokens_sold_before + (i * segment_size);
        const segment_end = segment_start + segment_size;
        
        // Calculate price at start and end of segment
        const denominator_start = total_supply - segment_start;
        const denominator_end = total_supply - segment_end;
        
        const hyperbolic_start = (price_numerator * price_scale) / denominator_start;
        const hyperbolic_end = (price_numerator * price_scale) / denominator_end;
        
        const constant_term = price_constant / (scale / price_scale);
        
        const price_start = hyperbolic_start + constant_term;
        const price_end = hyperbolic_end + constant_term;
        
        // Use average price for this segment
        const segment_avg_price = (price_start + price_end) / 2;
        const segment_cost = (segment_avg_price * segment_size * 100) / scale;
        
        total_cost += segment_cost;
      }
      
      return (total_cost / 10 ** 8).toFixed(6); // Convert to APT
    }
    
    // For smaller purchases, use the original average price method
    const denominator_before = total_supply - tokens_sold_before;
    const denominator_after = total_supply - tokens_sold_after;
    
    const hyperbolic_before = (price_numerator * price_scale) / denominator_before;
    const hyperbolic_after = (price_numerator * price_scale) / denominator_after;
    
    const constant_term = price_constant / (scale / price_scale);
    
    const price_before = hyperbolic_before + constant_term;
    const price_after = hyperbolic_after + constant_term;
    const average_price = (price_before + price_after) / 2;
    
    const apt_cost = (average_price * amount * 100) / scale;
    
    return (apt_cost / 10 ** 8).toFixed(6); // Convert to APT
  };

  // Calculate total based on amount
  useEffect(() => {
    if (selectedToken && amount) {
      const calculatedTotal = calculateTotal(amount);
      setTotal(calculatedTotal.toString());
    }
  }, [amount, selectedToken]);

  // Update amount when amountString changes
  useEffect(() => {
    const numAmount = parseFloat(amountString) || 0;
    setAmount(numAmount);
  }, [amountString]);

  // Tokens are now fetched by the shared useTokenData hook
  // No need for local fetching logic

  // Handle click outside wallet dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (walletDropdownOpen) {
        setWalletDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [walletDropdownOpen]);

  const handleTokenSelect = (token: any) => {
    console.log('🔄 handleTokenSelect called with token:', token);
    console.log('🔄 Token metadataAddress:', token.metadataAddress);
    
    // Navigate to the token's trading URL
    if (token.metadataAddress) {
      const url = `/marketplace/${token.metadataAddress}`;
      console.log('🔄 Navigating to:', url);
      navigate(url);
    } else {
      setSelectedToken(token);
      console.log('Selected token (no metadata address):', token);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    console.log('Search query:', query);
  };

  const handleHeaderToggle = () => {
    setHeaderMinimized(!headerMinimized);
  };

  // Generate a consistent color based on token symbol
  const generateColorFromString = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  // Handle star button click for watchlist
  const handleStarClick = (token: Token, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click from triggering
    
    // Generate icon and color based on token symbol
    const firstLetter = token.symbol.charAt(0).toUpperCase();
    const iconBg = generateColorFromString(token.symbol);
    
    const watchlistItem = {
      name: token.name.replace('$', ''),
      symbol: token.symbol,
      icon: firstLetter,
      iconBg: iconBg,
      metadataAddress: token.metadataAddress || token.txHash,
      creatorAddress: token.creatorAddress
    };
    
    toggleWatchlist(watchlistItem);
  };


  return (
    <>
      <style>
        {`
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
        `}
      </style>
              <div style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          width: '100vw',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          margin: 0,
          padding: 0,
          overflow: 'hidden',
          background: t.bgPrimary,
          color: t.textPrimary,
          transition: 'background 0.2s ease, color 0.2s ease',
        }}>
                            {/* Header */}
        {/* Token Leaderboard - Commented out for future CTA */}
        {/* <div style={{
          background: t.bgPrimary,
          borderBottom: `1px solid ${t.border}`,
          padding: headerMinimized ? '4px 24px' : '8px 24px',
          width: '100%',
          flexShrink: 0,
          position: 'relative',
          transition: 'all 0.3s ease',
          height: headerMinimized ? '30px' : 'auto',
          overflow: headerMinimized ? 'hidden' : 'visible'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: headerMinimized ? '0' : '8px'
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: t.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              TOKEN LEADERBOARD
            </div>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#00d4aa'
            }}>
              1:00
            </div>
          </div>
          <div style={{
            display: 'flex',
            gap: '0px',
            overflowX: 'auto',
            paddingBottom: '4px',
            width: '100%',
            justifyContent: 'space-between',
            opacity: headerMinimized ? '0' : '1',
            transition: 'opacity 0.3s ease'
          }}>
            {[
              { rank: 1, name: 'DogeMax', apt: 420, icon: '₿', iconBg: '#f7931a' },
              { rank: 2, name: 'PepeCoin', apt: 234, icon: 'Ξ', iconBg: '#627eea' },
              { rank: 3, name: 'ShibaMax', apt: 189, icon: '₮', iconBg: '#50af95' },
              { rank: 4, name: 'FlokiInu', apt: 156, icon: '◉', iconBg: '#f0b90b' },
              { rank: 5, name: 'SafeMoon', apt: 123, icon: '◆', iconBg: '#1e88e5' },
              { rank: 6, name: 'MoonToken', apt: 98, icon: '🌸', iconBg: '#e91e63' },
              { rank: 7, name: 'LunaCoin', apt: 87, icon: '🌙', iconBg: '#9c27b0' },
              { rank: 8, name: 'FireToken', apt: 76, icon: '🔥', iconBg: '#ff5722' },
              { rank: 9, name: 'EcoCoin', apt: 65, icon: '🌿', iconBg: '#4caf50' },
              { rank: 10, name: 'Diamond', apt: 54, icon: '💎', iconBg: '#2196f3' }
            ].map((token) => (
              <div 
                key={token.rank}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  flex: 1,
                  minWidth: 0
                }}
                onClick={() => handleTokenSelect(token)}
              >
                <span style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: t.textSecondary,
                  minWidth: '16px'
                }}>
                  {token.rank}
                </span>
                <div 
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    background: token.iconBg
                  }}
                >
                  {token.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: t.textPrimary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {token.name}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: t.textSecondary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {token.apt} APT
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div> */}
        
        {/* Global Header Bar */}
        <GlobalHeaderBar />

        <div style={{
          display: 'flex',
          flex: 1,
          width: '100%',
          overflow: 'hidden'
        }}>
          {/* Sidebar */}
          <GlobalSidebar 
            activeTab="marketplace"
          />

          {/* Main Content */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            width: '100%'
          }}>
            {/* Token Title Bar */}
            <div style={{
              background: t.bgPrimary,
              borderBottom: `1px solid ${t.border}`,
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              flexShrink: 0
            }}>
              <div style={{
                fontSize: '32px',
                fontWeight: '600',
                color: t.textPrimary,
                flexShrink: 0
              }}>
                Marketplace
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                margin: '0 20px'
              }}>
                <input 
                  type="text" 
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  style={{
                    width: '400px',
                    padding: '8px 12px',
                    border: `1px solid ${t.border}`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    background: t.bgSecondary,
                    color: t.textPrimary
                  }}
                />
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginLeft: 'auto'
              }}>
                <span>⚙️</span>
                <a href="#" style={{
                  color: t.textSecondary,
                  textDecoration: 'none'
                }}>
                  Launch
                </a>
                {account ? (
                  <div style={{ position: 'relative' }} data-wallet-dropdown>
                    <button
                      onClick={toggleWalletDropdown}
                      style={{
                        background: '#00d4aa',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <span style={{ fontSize: '12px' }}>
                        {String(account.address).slice(0, 6)}...{String(account.address).slice(-4)}
                      </span>
                    </button>
                    
                    {walletDropdownOpen && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        background: t.bgPrimary,
                        border: `1px solid ${t.border}`,
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        zIndex: 1000,
                        minWidth: '200px',
                        marginTop: '4px'
                      }}>
                        <button
                          onClick={() => {
                            // Navigate to profile
                            window.location.href = `/profile/${account.address}`;
                            setWalletDropdownOpen(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            color: t.textPrimary,
                            borderBottom: '1px solid #f0f0f0'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          👤 Profile
                        </button>
                        <button
                          onClick={handleDisconnect}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            color: '#dc3545'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          🚪 Disconnect
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    gap: '8px'
                  }}>
                    {/* This section is now handled by the wallet adapter */}
                  </div>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div style={{
              display: 'flex',
              flex: 1,
              minHeight: 0,
              width: '100%',
              background: t.bgPrimary,
            }}>
              {/* Content Left */}
              <div style={{
                flex: 1,
                padding: '20px',
                background: t.bgPrimary,
                overflowY: 'auto',
                minWidth: 0
              }}>


                {/* Trading Section */}
                <div style={{
                  background: t.bgSecondary,
                  borderRadius: '12px',
                  padding: '20px',
                  border: `1px solid ${t.border}`,
                }}>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: t.textPrimary,
                    marginBottom: '20px'
                  }}>
                    Tokens
                  </div>

                  {/* Controls */}
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    marginBottom: '20px',
                    flexWrap: 'wrap'
                  }}>
                    <input
                      type="text"
                      placeholder="Filter by name"
                      style={{
                        padding: '8px 12px',
                        border: `1px solid ${t.border}`,
                        borderRadius: '4px',
                        fontSize: '14px',
                        minWidth: '200px',
                        background: t.bgPrimary,
                        color: t.textPrimary,
                      }}
                    />
                    <select style={{
                      padding: '8px 12px',
                      border: `1px solid ${t.border}`,
                      borderRadius: '4px',
                      fontSize: '14px',
                      background: t.bgPrimary
                    }}>
                      <option>1h</option>
                      <option>4h</option>
                      <option>12h</option>
                      <option>1D</option>
                      <option>All</option>
                    </select>
                    <select style={{
                      padding: '8px 12px',
                      border: `1px solid ${t.border}`,
                      borderRadius: '4px',
                      fontSize: '14px',
                      background: t.bgPrimary,
                      color: t.textPrimary,
                    }}>
                      <option>All Status</option>
                      <option>Verified</option>
                      <option>Unverified</option>
                    </select>
                  </div>

                  {/* Trading Table */}
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '14px'
                  }}>
                    <thead>
                      <tr style={{
                        borderBottom: `1px solid ${t.border}`,
                      }}>
                        <th style={{
                          textAlign: 'left',
                          padding: '12px 8px',
                          fontWeight: '600',
                          color: t.textMuted,
                        }}>
                          Name
                        </th>
                        <th style={{
                          textAlign: 'right',
                          padding: '12px 8px',
                          fontWeight: '600',
                          color: t.textMuted,
                          width: '150px'
                        }}>
                          Price
                        </th>
                        <th style={{
                          textAlign: 'right',
                          padding: '12px 8px',
                          fontWeight: '600',
                          color: t.textMuted,
                        }}>
                          Change
                        </th>
                        <th style={{
                          textAlign: 'right',
                          padding: '12px 8px',
                          fontWeight: '600',
                          color: t.textMuted
                        }}>
                          Market cap
                        </th>
                        <th style={{
                          textAlign: 'right',
                          padding: '12px 8px',
                          fontWeight: '600',
                          color: t.textMuted,
                          width: '200px'
                        }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>
                            <div style={{ padding: '20px' }}>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: t.textPrimary, marginBottom: '8px' }}>
                                Loading tokens...
                              </div>
                              <div style={{ fontSize: '14px', color: t.textMuted }}>
                                {error ? 'Retrying after rate limit...' : 'Fetching from Aptos network...'}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : tokens.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>
                            <div style={{ padding: '20px' }}>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: t.textPrimary, marginBottom: '8px' }}>
                                Unable to load tokens
                              </div>
                              <div style={{ fontSize: '14px', color: t.textMuted, marginBottom: '16px' }}>
                                The Aptos network is experiencing high traffic. This usually resolves in a few minutes.
                                <br />
                                <strong>Tip:</strong> Try refreshing the page or wait a moment before retrying.
                              </div>
                              <button 
                                onClick={() => refetch()} 
                                style={{
                                  background: '#00d4aa',
                                  color: 'white',
                                  border: 'none',
                                  padding: '8px 16px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  marginRight: '8px'
                                }}
                              >
                                Retry
                              </button>
                              <button 
                                onClick={() => window.location.reload()} 
                                style={{
                                  background: 'transparent',
                                  color: t.textMuted,
                                  border: '1px solid #e0e0e0',
                                  padding: '8px 16px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '14px'
                                }}
                              >
                                Refresh Page
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        tokens.map((token, index) => (
                          <tr key={index} style={{
                            borderBottom: '1px solid #f0f0f0'
                          }}>
                            <td style={{
                              padding: '12px 8px'
                            }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                              }}>
                                <div style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 'bold',
                                  fontSize: '16px',
                                  background: token.image ? 'transparent' : '#e0e0e0',
                                  overflow: 'hidden'
                                }}>
                                  {token.image ? (
                                    <img 
                                      src={token.image} 
                                      alt={`${token.name} logo`}
                                      style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                      }}
                                    />
                                  ) : null}
                                </div>
                                <div>
                                  <div style={{
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: t.textPrimary
                                  }}>
                                    {token.name}
                                  </div>
                                  <div style={{
                                    fontSize: '12px',
                                    color: t.textMuted
                                  }}>
                                    {token.symbol}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{
                              textAlign: 'right',
                              padding: '12px 8px',
                              fontWeight: '600',
                              color: t.textPrimary,
                              width: '150px'
                            }}>
                              {token.price?.toFixed(7)}
                            </td>
                            <td style={{
                              textAlign: 'right',
                              padding: '12px 8px',
                              color: token.change24h && token.change24h > 0 ? '#00d4aa' : '#ff4757',
                              fontWeight: '600'
                            }}>
                              {token.change24h ? `${token.change24h.toFixed(2)}%` : 'N/A'}
                            </td>
                            <td style={{
                              textAlign: 'right',
                              padding: '12px 8px',
                              color: t.textMuted
                            }}>
                              {token.marketCapUSD
                                ? (token.marketCapUSD >= 1e9 ? `$${(token.marketCapUSD/1e9).toFixed(2)}B`
                                  : token.marketCapUSD >= 1e6 ? `$${(token.marketCapUSD/1e6).toFixed(2)}M`
                                  : token.marketCapUSD >= 1e3 ? `$${(token.marketCapUSD/1e3).toFixed(2)}K`
                                  : `$${token.marketCapUSD.toFixed(2)}`)
                                : 'N/A'}
                            </td>
                            <td style={{
                              textAlign: 'right',
                              padding: '12px 8px',
                              width: '200px'
                            }}>
                              <div style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '12px',
                                alignItems: 'center'
                              }}>
                                <button 
                                  onClick={async () => {
                                    console.log("Trade button clicked for token:", token);
                                    console.log("Token metadataAddress:", token.metadataAddress);
                                    console.log("Token txHash:", token.txHash);
                                    console.log("Token creatorAddress:", token.creatorAddress);
                                    console.log("Token creator:", token.creator);
                                    setSelectedToken(token);
                                    // Use cached balance if available, otherwise refresh
                                    if (token.metadataAddress) {
                                      const cachedBalance = tokenBalanceMap.get(token.metadataAddress);
                                      if (cachedBalance !== undefined) {
                                        setTokenBalance(cachedBalance);
                                      } else if (account?.address) {
                                        await refreshBalances(true);
                                      }
                                    }
                                  }}
                                  style={{
                                    padding: '8px 16px',
                                    background: '#00d4aa',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: 'pointer'
                                  }}>
                                  Trade
                                </button>
                                {/* Boost button - commented out for future deployment */}
                                {/* <button style={{
                                  padding: '8px 16px',
                                  background: t.bgPrimary,
                                  color: '#FF6B35',
                                  border: '1px solid #FF6B35',
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  cursor: 'pointer'
                                }}>
                                  Boost
                                </button> */}
                                {/* Verify button - commented out for future deployment */}
                                {/* <button style={{
                                  padding: '8px 16px',
                                  background: t.bgPrimary,
                                  color: '#00BFFF',
                                  border: '1px solid #00BFFF',
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  cursor: 'pointer'
                                }}>
                                  Verify
                                </button> */}
                                <button 
                                  onClick={(e) => handleStarClick(token, e)}
                                  style={{
                                    background: '#fff',
                                    border: `1px solid ${t.border}`,
                                    color: (token.metadataAddress || token.txHash) && isInWatchlist(token.metadataAddress || token.txHash) ? '#FFD700' : '#666',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'all 0.2s'
                                  }}
                                  title={(token.metadataAddress || token.txHash) && isInWatchlist(token.metadataAddress || token.txHash) ? 'Remove from watchlist' : 'Add to watchlist'}
                                >
                                  {(token.metadataAddress || token.txHash) && isInWatchlist(token.metadataAddress || token.txHash) ? '★' : '☆'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Trading Panel */}
              <div style={{
                width: '400px',
                background: t.bgPrimary,
                borderLeft: '1px solid #d3d3d3',
                padding: '20px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0
              }}>
                <div style={{
                  background: t.bgSecondary,
                  borderRadius: '12px',
                  padding: '20px',
                  border: `1px solid ${t.border}`,
                  height: '100%'
                }}>
                  {/* Token Info Section */}
                  {selectedToken ? (
                    <div style={{ 
                      marginBottom: '20px',
                      padding: '16px',
                      background: t.bgPrimary,
                      borderRadius: '8px',
                      border: `1px solid ${t.border}`
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '8px'
                      }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          background: '#00d4aa',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          marginRight: '12px'
                        }}>
                          {selectedToken.symbol.charAt(0)}
                        </div>
                        <div>
                          <h4 style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            color: t.textPrimary,
                            margin: '0'
                          }}>
                            {selectedToken.symbol}
                          </h4>
                          <p style={{
                            fontSize: '14px',
                            color: t.textSecondary,
                            margin: '0'
                          }}>
                            {selectedToken.name}
                          </p>
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div style={{ 
                      marginBottom: '20px',
                      padding: '16px',
                      background: t.bgSecondary,
                      borderRadius: '8px',
                      border: `1px solid ${t.border}`,
                      textAlign: 'center'
                    }}>
                      <p style={{
                        fontSize: '14px',
                        color: t.textSecondary,
                        margin: '0'
                      }}>
                        Select a token to start trading
                      </p>
                    </div>
                  )}

                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: t.textPrimary,
                      marginBottom: '8px'
                    }}>
                      Your Balance {selectedToken && <span style={{ color: '#000000', fontWeight: '600' }}>({selectedToken.symbol})</span>}
                    </h3>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: '#00d4aa'
                    }}>
                      {tokenBalance || '0.000'}
                    </div>
                  </div>
                  
                  <ul style={{
                    display: 'flex',
                    background: t.bgSecondary,
                    borderRadius: '8px',
                    padding: '4px',
                    marginBottom: '20px',
                    listStyle: 'none'
                  }}>
                    <li 
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '14px',
                        background: activeTab === 'buy' ? '#00d4aa' : 'transparent',
                        color: activeTab === 'buy' ? 'white' : '#6c757d'
                      }}
                      onClick={() => setActiveTab('buy')}
                    >
                      Buy
                    </li>
                    <li 
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '14px',
                        background: activeTab === 'sell' ? '#ff4757' : 'transparent',
                        color: activeTab === 'sell' ? 'white' : '#6c757d'
                      }}
                      onClick={() => setActiveTab('sell')}
                    >
                      Sell
                    </li>
                  </ul>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: t.textPrimary,
                      marginBottom: '8px'
                    }}>
                      Amount
                    </label>
                    <input 
                      type="text" 
                      value={amountString}
                      onChange={(e) => setAmountString(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `1px solid ${t.border}`,
                        borderRadius: '8px',
                        fontSize: '16px',
                        background: t.bgPrimary
                      }}
                    />
                  </div>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: t.textPrimary,
                      marginBottom: '8px'
                    }}>
                      Total (APT)
                    </label>
                    <input 
                      type="text" 
                      value={total}
                      readOnly
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `1px solid ${t.border}`,
                        borderRadius: '8px',
                        fontSize: '16px',
                        background: t.bgSecondary,
                        color: t.textSecondary
                      }}
                    />
                  </div>

                  {/* Slippage Protection Section */}
                  <div style={{
                    margin: '20px 0',
                    padding: '15px',
                    background: t.bgSecondary,
                    borderRadius: '8px',
                    border: `1px solid ${t.border}`,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: slippageExpanded ? '12px' : '0',
                        transition: 'margin-bottom 0.3s ease'
                      }}
                      onClick={handleSlippageToggle}
                    >
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: t.textPrimary
                      }}>
                        Slippage Protection
                      </span>
                      <span style={{
                        fontSize: '12px',
                        color: t.textMuted,
                        cursor: 'pointer',
                        transition: 'transform 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        transform: slippageExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                      }}>
                        ▼
                      </span>
                    </div>
                    <div style={{
                      maxHeight: slippageExpanded ? '200px' : '0',
                      overflow: 'hidden',
                      transition: 'max-height 0.3s ease'
                    }}>
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        marginBottom: '12px',
                        marginTop: '12px'
                      }}>
                        {['0.5', '1.0', '2.0', '5.0'].map((slippage) => (
                          <button
                            key={slippage}
                            onClick={() => handleSlippageSelect(slippage)}
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              border: `1px solid ${selectedSlippage === slippage ? '#00d4aa' : '#d3d3d3'}`,
                              background: selectedSlippage === slippage ? '#00d4aa' : '#ffffff',
                              color: selectedSlippage === slippage ? '#ffffff' : '#5b616e',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            {slippage}%
                          </button>
                        ))}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <input
                          type="number"
                          placeholder="Custom"
                          min="0.1"
                          max="50"
                          step="0.1"
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: `1px solid ${t.border}`,
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: t.bgPrimary,
                            color: t.textPrimary
                          }}
                        />
                        <span style={{
                          fontSize: '12px',
                          color: t.textMuted,
                          fontWeight: '500'
                        }}>
                          %
                        </span>
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: '#ff4757',
                        marginTop: '8px',
                        display: parseFloat(selectedSlippage) > 5.0 ? 'block' : 'none'
                      }}>
                        ⚠️ High slippage may result in unfavorable trade execution
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleTrade}
                    style={{
                      width: '100%',
                      padding: '14px 24px',
                      background: activeTab === 'buy' ? '#00d4aa' : '#ff4757',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      marginBottom: '12px'
                    }}
                  >
                    {activeTab === 'buy' ? 'Buy' : 'Sell'}
                  </button>
                  
                  {selectedToken && (
                    <Link 
                      to={`/newtoken/${selectedToken.txHash}`}
                      style={{
                        width: '100%',
                        padding: '12px 24px',
                        background: 'transparent',
                        color: t.textSecondary,
                        border: `1px solid ${t.border}`,
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        display: 'block',
                        textAlign: 'center'
                      }}
                    >
                      Full Trade View
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              background: t.bgPrimary,
              borderTop: '1px solid #e7ebee',
              padding: '20px 24px',
              width: '100%',
              flexShrink: 0
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{
                  display: 'flex',
                  gap: '20px'
                }}>
                  <a href="#" style={{
                    color: t.textSecondary,
                    textDecoration: 'none',
                    fontSize: '14px'
                  }}>
                    Careers
                  </a>
                  <a href="#" style={{
                    color: t.textSecondary,
                    textDecoration: 'none',
                    fontSize: '14px'
                  }}>
                    Privacy & Legal
                  </a>
                  <a href="#" style={{
                    color: t.textSecondary,
                    textDecoration: 'none',
                    fontSize: '14px'
                  }}>
                    Docs
                  </a>
                  <a href="#" style={{
                    color: t.textSecondary,
                    textDecoration: 'none',
                    fontSize: '14px'
                  }}>
                    Accessibility
                  </a>
                </div>
                <p style={{
                  fontSize: '14px',
                  color: t.textSecondary
                }}>
                  &copy; 2025 MoveMint
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Marketplace; 