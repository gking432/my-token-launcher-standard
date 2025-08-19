import React, { useState, useEffect, useMemo } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { InputTransactionData } from "@aptos-labs/wallet-adapter-core";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { MODULE_ADDRESS } from "../config";
import GlobalSidebar from './GlobalSidebar';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTokenData } from '../hooks/useTokenData';

const Marketplace: React.FC = () => {
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
  const [tokenBalance, setTokenBalance] = useState<string>('0.000');
  const [tokenBalanceMap, setTokenBalanceMap] = useState<Map<string, string>>(new Map());
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [lastBalanceFetch, setLastBalanceFetch] = useState(0);

  // Use the shared token data hook
  const { tokens: rawTokens, loading, error, refetch } = useTokenData();

  // Aptos client setup
  const config = useMemo(() => new AptosConfig({ 
    network: Network.DEVNET,
    fullnode: "https://fullnode.devnet.aptoslabs.com/v1",
  }), []);
  const client = useMemo(() => new Aptos(config), [config]);
  const tokenLauncherAddress = MODULE_ADDRESS;

  // Create a separate client without API key for balance fetching (to avoid rate limits)
  const balanceClient = useMemo(() => new Aptos(new AptosConfig({ 
    network: Network.DEVNET
  })), []);

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
      fetchAllTokenBalances();
    }
  }, [selectedToken, account?.address]);

  // Fetch all token balances when account changes or component mounts
  useEffect(() => {
    if (account?.address) {
      fetchAllTokenBalances();
    }
  }, [account?.address]);

  // Batch fetch all token balances for the user with fallbacks
  const fetchAllTokenBalances = async (force = false) => {
    if (!account) return;
    
    // Debounce: Don't fetch if we've fetched recently (within 5 seconds)
    const now = Date.now();
    if (!force && now - lastBalanceFetch < 5000) {
      console.log("⏱️ Balance fetch debounced, using cached data");
      if (selectedToken?.metadataAddress) {
        const cachedBalance = tokenBalanceMap.get(selectedToken.metadataAddress) || "0.000";
        setTokenBalance(cachedBalance);
      }
      return;
    }
    
    // Prevent multiple simultaneous calls
    if (isLoadingBalances) {
      console.log("⏳ Balance fetch already in progress, skipping");
      return;
    }
    
    setIsLoadingBalances(true);
    setLastBalanceFetch(now);
    
    try {
      const accountAddress = account.address.toString();
      console.log("💰 Batch fetching all token balances for:", accountAddress);
      
      // Try to get user resources with fallback
      let resources;
      try {
        // Primary method: Direct API call
        resources = await balanceClient.getAccountResources({ accountAddress });
        console.log("✅ Primary balance fetch successful");
      } catch (error: any) {
        console.log("⚠️ Primary balance fetch failed, trying fallback...");
        
        // Fallback: Try with different client configuration
        try {
          const fallbackClient = new Aptos(new AptosConfig({ 
            network: Network.DEVNET,
            fullnode: "https://fullnode.devnet.aptoslabs.com/v1"
          }));
          resources = await fallbackClient.getAccountResources({ accountAddress });
          console.log("✅ Fallback balance fetch successful");
        } catch (fallbackError) {
          console.log("❌ All balance fetch methods failed, using cached data if available");
          
          // If we have cached balances, use them
          if (tokenBalanceMap.size > 0) {
            console.log("📊 Using cached balance data");
            return;
          }
          
          // Set default balance and return
          setTokenBalance("0.000");
          return;
        }
      }
      
      type BuyerStoreData = {
        stores: { metadata_addr: string; store: { inner: string } }[];
      };

      const buyerStore = resources.find(
        (r: any) => r.type === "0x660bb7df7eaf94ac70403e64698faf8b68e5bffe68f1051a97d130068afc7a6b::token_launcher::BuyerStore"
      ) as { data: BuyerStoreData } | undefined;

      if (!buyerStore) {
        console.log("❌ No BuyerStore found for user");
        setTokenBalance("0.000");
        return;
      }

      // Create a map of metadata addresses to store addresses
      const storeMap = new Map<string, string>();
      buyerStore.data.stores?.forEach((s) => {
        storeMap.set(s.metadata_addr, s.store.inner);
      });

      console.log(`📊 Found ${storeMap.size} token stores for user`);

      // Batch fetch all store resources with individual fallbacks
      const storeAddresses = Array.from(storeMap.values());
      const balanceMap = new Map<string, string>();
      
      // Process stores one by one with fallbacks to avoid overwhelming the API
      for (const storeAddress of storeAddresses) {
        try {
          let storeResources;
          
          // Primary method
          try {
            storeResources = await balanceClient.getAccountResources({ accountAddress: storeAddress });
          } catch (error) {
            // Fallback method
            try {
              const fallbackClient = new Aptos(new AptosConfig({ 
                network: Network.DEVNET,
                fullnode: "https://fullnode.devnet.aptoslabs.com/v1"
              }));
              storeResources = await fallbackClient.getAccountResources({ accountAddress: storeAddress });
            } catch (fallbackError) {
              console.log(`⚠️ Store ${storeAddress} failed both methods, skipping`);
              continue;
            }
          }
          
          const fungibleStore = storeResources.find((r: any) => r.type === "0x1::fungible_asset::FungibleStore") as { data: { balance: string } } | undefined;
          
          if (fungibleStore) {
            const balanceNumber = Number(fungibleStore.data.balance || 0) / 10 ** 6;
            // Find the metadata address for this store
            storeMap.forEach((storeAddr, metadataAddr) => {
              if (storeAddr === storeAddress) {
                balanceMap.set(metadataAddr, balanceNumber.toString());
              }
            });
          }
          
          // Add small delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Error processing store ${storeAddress}:`, error);
          continue;
        }
      }

      console.log(`✅ Batch balance fetch complete. Found ${balanceMap.size} token balances`);
      
      // Store the balance map for quick access
      setTokenBalanceMap(balanceMap);
      
      // Update current token balance if a token is selected
      if (selectedToken?.metadataAddress) {
        const currentBalance = balanceMap.get(selectedToken.metadataAddress) || "0.000";
        setTokenBalance(currentBalance);
      }
      
    } catch (error) {
      console.error("Error in batch balance fetch:", error);
      // If we have cached data, use it
      if (tokenBalanceMap.size > 0) {
        console.log("📊 Using cached balance data after error");
        if (selectedToken?.metadataAddress) {
          const cachedBalance = tokenBalanceMap.get(selectedToken.metadataAddress) || "0.000";
          setTokenBalance(cachedBalance);
        }
      }
    } finally {
      setIsLoadingBalances(false);
    }
  };

  // Get balance for a specific token from the cached map
  const getTokenBalance = (metadataAddress: string): string => {
    return tokenBalanceMap.get(metadataAddress) || "0.000";
  };

  // Legacy individual balance fetch (kept for compatibility, but should use batch approach)
  const fetchUserTokenBalance = async () => {
    if (!account || !selectedToken) {
      console.log("No token selected or wallet not connected");
      return false;
    }

    try {
      const accountAddress = account.address.toString();
      const metadataAddress = selectedToken.metadataAddress;
      console.log("💰 Fetching balance for:", accountAddress, "Token:", metadataAddress);
      
      // Use the same logic as NEWtokenpage - Fullnode without API key
      const resources = await balanceClient.getAccountResources({ accountAddress });
      
      type BuyerStoreData = {
        stores: { metadata_addr: string; store: { inner: string } }[];
      };

      const buyerStore = resources.find(
        (r: any) => r.type === "0x660bb7df7eaf94ac70403e64698faf8b68e5bffe68f1051a97d130068afc7a6b::token_launcher::BuyerStore"
      ) as { data: BuyerStoreData } | undefined;

      if (!buyerStore) {
        console.log("❌ No BuyerStore found for user");
        setTokenBalance("0.000");
        return false;
      }

      const storeEntry = buyerStore.data.stores?.find((s) => s.metadata_addr === metadataAddress);
      if (!storeEntry) {
        console.log("❌ Token not found in BuyerStore for metadata:", metadataAddress);
        setTokenBalance("0.000");
        return false;
      }

      const storeAddress = storeEntry.store.inner;
      const storeResources = await balanceClient.getAccountResources({ accountAddress: storeAddress });

      const fungibleStore = storeResources.find((r: any) => r.type === "0x1::fungible_asset::FungibleStore") as { data: { balance: string } } | undefined;
      if (!fungibleStore) {
        console.log("❌ No FungibleStore found at store address:", storeAddress);
        setTokenBalance("0.000");
        return false;
      }

      const balanceNumber = Number(fungibleStore.data.balance || 0) / 10 ** 6;
      console.log(`✅ Balance found: ${balanceNumber}`);
      setTokenBalance(balanceNumber.toString());
      return true;
    } catch (error) {
      console.error("Error getting balance:", error);
      setTokenBalance("0.000");
      return false;
    }
  };

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
      await fetchAllTokenBalances(true);
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

    // Check if user has enough tokens to sell
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
      await fetchAllTokenBalances(true);
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

  // Watchlist data for the sidebar
  const watchlistData = [
    { name: 'Bitcoin', symbol: 'BTC', icon: '₿', iconBg: '#f7931a' },
    { name: 'Ethereum', symbol: 'ETH', icon: 'Ξ', iconBg: '#627eea' },
    { name: 'Tether', symbol: 'USDT', icon: '₮', iconBg: '#50af95' },
    { name: 'BNB', symbol: 'BNB', icon: '◉', iconBg: '#f0b90b' }
  ];

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
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          margin: 0,
          padding: 0,
          overflow: 'hidden'
        }}>
                            {/* Header */}
        <div style={{
          background: '#ffffff',
          borderBottom: '1px solid #e7ebee',
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
              color: '#5b616e',
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
                  color: '#5b616e',
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
                    color: '#0a0b0d',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {token.name}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: '#5b616e',
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
        </div>

        <div style={{
          display: 'flex',
          flex: 1,
          width: '100%',
          overflow: 'hidden'
        }}>
          {/* Sidebar */}
          <GlobalSidebar 
            watchlistData={watchlistData}
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
              background: 'white',
              borderBottom: '1px solid #e7ebee',
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
                color: '#050f19',
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
                    border: '1px solid #d3d3d3',
                    borderRadius: '6px',
                    fontSize: '14px',
                    background: '#f8f9fa',
                    color: '#050f19'
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
                  color: '#5b616e',
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
                        background: 'white',
                        border: '1px solid #e6e8ea',
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
                            color: '#050f19',
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
              width: '100%'
            }}>
              {/* Content Left */}
              <div style={{
                flex: 1,
                padding: '20px',
                background: '#ffffff',
                overflowY: 'auto',
                minWidth: 0
              }}>


                {/* Trading Section */}
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  border: '1px solid #e6e8ea'
                }}>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#050f19',
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
                        border: '1px solid #d3d3d3',
                        borderRadius: '4px',
                        fontSize: '14px',
                        minWidth: '200px'
                      }}
                    />
                    <select style={{
                      padding: '8px 12px',
                      border: '1px solid #d3d3d3',
                      borderRadius: '4px',
                      fontSize: '14px',
                      background: 'white'
                    }}>
                      <option>1h</option>
                      <option>4h</option>
                      <option>12h</option>
                      <option>1D</option>
                      <option>All</option>
                    </select>
                    <select style={{
                      padding: '8px 12px',
                      border: '1px solid #d3d3d3',
                      borderRadius: '4px',
                      fontSize: '14px',
                      background: 'white'
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
                        borderBottom: '1px solid #e6e8ea'
                      }}>
                        <th style={{
                          textAlign: 'left',
                          padding: '12px 8px',
                          fontWeight: '600',
                          color: '#8a9ba8'
                        }}>
                          Name
                        </th>
                        <th style={{
                          textAlign: 'right',
                          padding: '12px 8px',
                          fontWeight: '600',
                          color: '#8a9ba8'
                        }}>
                          Price
                        </th>
                        <th style={{
                          textAlign: 'right',
                          padding: '12px 8px',
                          fontWeight: '600',
                          color: '#8a9ba8'
                        }}>
                          Change
                        </th>
                        <th style={{
                          textAlign: 'right',
                          padding: '12px 8px',
                          fontWeight: '600',
                          color: '#8a9ba8'
                        }}>
                          Market cap
                        </th>
                        <th style={{
                          textAlign: 'right',
                          padding: '12px 8px',
                          fontWeight: '600',
                          color: '#8a9ba8',
                          width: '440px'
                        }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>Loading tokens...</td>
                        </tr>
                      ) : tokens.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>No tokens found.</td>
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
                                    color: '#050f19'
                                  }}>
                                    {token.name}
                                  </div>
                                  <div style={{
                                    fontSize: '12px',
                                    color: '#8a9ba8'
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
                              color: '#050f19'
                            }}>
                              {token.price?.toFixed(4)}
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
                              color: '#8a9ba8'
                            }}>
                              {token.marketCap?.toLocaleString()}
                            </td>
                            <td style={{
                              textAlign: 'right',
                              padding: '12px 8px',
                              width: '440px'
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
                                    // Use cached balance if available, otherwise fetch all
                                    if (token.metadataAddress) {
                                      const cachedBalance = tokenBalanceMap.get(token.metadataAddress);
                                      if (cachedBalance !== undefined) {
                                        setTokenBalance(cachedBalance);
                                      } else if (account?.address) {
                                        await fetchAllTokenBalances();
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
                                <button style={{
                                  padding: '8px 16px',
                                  background: 'white',
                                  color: '#FF6B35',
                                  border: '1px solid #FF6B35',
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  cursor: 'pointer'
                                }}>
                                  Boost
                                </button>
                                <button style={{
                                  padding: '8px 16px',
                                  background: 'white',
                                  color: '#00BFFF',
                                  border: '1px solid #00BFFF',
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  cursor: 'pointer'
                                }}>
                                  Verify
                                </button>
                                <button style={{
                                  background: '#fff',
                                  border: '1px solid #e6e8ea',
                                  color: '#666',
                                  cursor: 'pointer',
                                  fontSize: '16px',
                                  padding: '8px 16px',
                                  borderRadius: '6px',
                                  height: '36px',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}>
                                  ⭐
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
                background: '#ffffff',
                borderLeft: '1px solid #d3d3d3',
                padding: '20px',
                flexShrink: 0
              }}>
                <div style={{
                  background: '#f8f9fa',
                  borderRadius: '12px',
                  padding: '20px',
                  border: '1px solid #e6e8ea',
                  height: '100%'
                }}>
                  {/* Token Info Section */}
                  {selectedToken ? (
                    <div style={{ 
                      marginBottom: '20px',
                      padding: '16px',
                      background: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e6e8ea'
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
                            color: '#0a0b0d',
                            margin: '0'
                          }}>
                            {selectedToken.symbol}
                          </h4>
                          <p style={{
                            fontSize: '14px',
                            color: '#6c757d',
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
                      background: '#f8f9fa',
                      borderRadius: '8px',
                      border: '1px solid #e6e8ea',
                      textAlign: 'center'
                    }}>
                      <p style={{
                        fontSize: '14px',
                        color: '#6c757d',
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
                      color: '#0a0b0d',
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
                    background: '#e9ecef',
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
                      color: '#0a0b0d',
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
                        border: '1px solid #e6e8ea',
                        borderRadius: '8px',
                        fontSize: '16px',
                        background: 'white'
                      }}
                    />
                  </div>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#0a0b0d',
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
                        border: '1px solid #e6e8ea',
                        borderRadius: '8px',
                        fontSize: '16px',
                        background: '#f8f9fa',
                        color: '#6c757d'
                      }}
                    />
                  </div>

                  {/* Slippage Protection Section */}
                  <div style={{
                    margin: '20px 0',
                    padding: '15px',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    border: '1px solid #e6e8ea',
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
                        color: '#050f19'
                      }}>
                        Slippage Protection
                      </span>
                      <span style={{
                        fontSize: '12px',
                        color: '#8a9ba8',
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
                            border: '1px solid #d3d3d3',
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: '#ffffff',
                            color: '#050f19'
                          }}
                        />
                        <span style={{
                          fontSize: '12px',
                          color: '#8a9ba8',
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
                        color: '#5b616e',
                        border: '1px solid #d3d3d3',
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
              background: '#ffffff',
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
                    color: '#5b616e',
                    textDecoration: 'none',
                    fontSize: '14px'
                  }}>
                    Careers
                  </a>
                  <a href="#" style={{
                    color: '#5b616e',
                    textDecoration: 'none',
                    fontSize: '14px'
                  }}>
                    Privacy & Legal
                  </a>
                  <a href="#" style={{
                    color: '#5b616e',
                    textDecoration: 'none',
                    fontSize: '14px'
                  }}>
                    Docs
                  </a>
                  <a href="#" style={{
                    color: '#5b616e',
                    textDecoration: 'none',
                    fontSize: '14px'
                  }}>
                    Accessibility
                  </a>
                </div>
                <p style={{
                  fontSize: '14px',
                  color: '#5b616e'
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