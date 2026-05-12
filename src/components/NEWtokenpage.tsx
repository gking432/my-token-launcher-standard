import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network, UserTransactionResponse } from "@aptos-labs/ts-sdk";
import { InputTransactionData } from "@aptos-labs/wallet-adapter-core";
import { createChart, IChartApi, ISeriesApi, Time, ColorType } from "lightweight-charts";
import GlobalSidebar from './GlobalSidebar';
import { MODULE_ADDRESS } from "../config";
import { useTokenData } from '../hooks/useTokenData';
import { useBalanceContext } from '../contexts/BalanceContext';
import { useWatchlist } from '../contexts/WatchlistContext';
import { useOHLCData, Timeframe } from '../hooks/useOHLCData';
import { useTheme } from '../contexts/ThemeContext';
import { useAptPrice } from '../contexts/AptPriceContext';
import { useTokenLive } from '../data/useTokenLive';
import { useQueryClient } from '@tanstack/react-query';

console.log("API Key:", process.env.REACT_APP_APTOS_API_KEY);
// Contract addresses for different networks
const CONTRACT_ADDRESSES: Record<string, string> = {
  devnet: MODULE_ADDRESS,
  testnet: MODULE_ADDRESS,
  mainnet: "",
};

type ChartMode = 'apt' | 'usd' | 'mcap';

const TokenPage: React.FC = () => {
  const { coinHash } = useParams<{ coinHash?: string }>();
  const { account, signAndSubmitTransaction, connect, wallets, disconnect } = useWallet();
  const [tokenDetails, setTokenDetails] = useState<TokenDetails | null>(null);
  const { isDark, theme: t } = useTheme();

  // Use the shared token data hook
  const { tokens, loading: tokensLoading } = useTokenData();
  const { aptPrice } = useAptPrice();
  const [amount, setAmount] = useState<number>(0);
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [chartMode, setChartMode] = useState<ChartMode>('mcap');
  const [activeInsightTab, setActiveInsightTab] = useState<'insights' | 'transactions' | 'holders'>('insights');
  const [isMounted, setIsMounted] = useState(false);
  // React Query in useTokenLive (3s) and useTokenTrades (8s) handles polling.
  // After a buy/sell we invalidate those caches so the new state shows
  // immediately instead of waiting for the next interval.
  const [refreshChart, setRefreshChart] = useState<number>(0);
  const queryClient = useQueryClient();
  const invalidateTokenData = () => {
    queryClient.invalidateQueries({ queryKey: ['tokenLive'] });
    queryClient.invalidateQueries({ queryKey: ['tokenTrades'] });
    queryClient.invalidateQueries({ queryKey: ['tokenList'] });
    setRefreshChart(n => n + 1);
  };
  
  // Use global balance context instead of local balance fetching
  const { balances, loading: balanceLoading, getTokenBalance, refreshBalances } = useBalanceContext();
  
  // Use watchlist context
  const { isInWatchlist, toggleWatchlist } = useWatchlist();

  const [copied, setCopied] = useState(false);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [slippage, setSlippage] = useState<number>(500); // Default 5% (500 bps)
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [showSlippageInput, setShowSlippageInput] = useState<boolean>(false);

  // Keep the existing UI state from NEWtokenpage
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [amountString, setAmountString] = useState('0.001');
  
  // Update amount when amountString changes
  useEffect(() => {
    const numAmount = parseFloat(amountString);
    setAmount(isNaN(numAmount) ? 0 : numAmount);
  }, [amountString]);
  const [total, setTotal] = useState('108.18');
  const [slippageExpanded, setSlippageExpanded] = useState(false);
  const [selectedSlippage, setSelectedSlippage] = useState('1.0');
  const [headerMinimized, setHeaderMinimized] = useState(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const location = useLocation();

  const fixedPrice = 0.001;
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick", Time> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram", Time> | null>(null);

  // Slippage options (in basis points)
  const slippageOptions = [50, 100, 200, 500, 1000]; // 0.5%, 1%, 2%, 5%, 10%
  const maxSlippage = 1000; // 10% max

  const config = useMemo(() => new AptosConfig({ 
    network: Network.TESTNET,
    fullnode: "https://fullnode.testnet.aptoslabs.com/v1",
    clientConfig: {
      HEADERS: {
        'Authorization': `Bearer ${process.env.REACT_APP_APTOS_API_KEY}`
      }
    }
  }), []);
  const client = useMemo(() => new Aptos(config), [config]);
  

  const tokenLauncherAddress = CONTRACT_ADDRESSES['testnet'];

  // Transplant the working interfaces from TokenPage
  interface Token {
    name: string;
    symbol: string;
    supply: number;
    txHash: string;
    image: string | null;
    launchDate: string;
    creator: string;
    metadataAddress?: string;
  }

  interface CustomTokenResource {
    balance?: string | number;
    amount?: string | number;
    metadata?: string;
  }

  interface CoinStoreData {
    coin?: { value: string };
    balance?: string;
  }

  interface FungibleStoreData {
    amount: string;
    metadata: string;
  }

  interface TokenDetails {
    name: string;
    symbol: string;
    supply: number;
    txHash: string;
    metadataAddress?: string;
    image?: string;
    creatorAddress?: string;
    creationDate: number;
    twitterLink?: string | null;
    websiteLink?: string | null;
    description?: string;
  }

  interface OHLC {
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }

  interface AptosCoinStore {
    type: string;
    data: {
      coin: {
        value: string;
      };
    };
  }

  interface BuyerStoreData {
    stores: { metadata_addr: string; store: { inner: string } }[];
  }

  interface BuyerStoreResource {
    type: string;
    data: BuyerStoreData;
  }

  // Transplant the working helper functions from TokenPage
  function isUserTransactionResponse(transaction: any): transaction is UserTransactionResponse {
    return transaction.type === "user_transaction";
  }

  const handleCopyCA = () => {
    if (tokenDetails?.metadataAddress) {
      navigator.clipboard.writeText(tokenDetails.metadataAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  function stringToBytes(str: string): number[] {
    return Array.from(new TextEncoder().encode(str));
  }

  // Transplant the working token fetching logic from TokenPage
  const fetchTokenMetadata = async (creator: string, name: string, symbol: string) => {
    try {
      const moduleState = await client.getAccountResource({
        accountAddress: tokenLauncherAddress,
        resourceType: `${tokenLauncherAddress}::token_launcher::ModuleState`,
      });

      if (!moduleState.data || !moduleState.data.token_metadata || !moduleState.data.token_metadata.handle) {
        throw new Error("ModuleState is not properly initialized");
      }

      const tokenMetadata = await client.getTableItem({
        handle: moduleState.data.token_metadata.handle,
        data: {
          key: creator,
          key_type: "address",
          value_type: `${tokenLauncherAddress}::token_launcher::TokenMetadata`,
        },
      }) as { entries: Array<{ original_name: number[]; ticker: number[]; metadata_addr: string }> };

      const nameBytes = stringToBytes(name);
      const symbolBytes = stringToBytes(symbol);

      const tokenInfo = tokenMetadata.entries.find((t) => {
        return (
          t.original_name.toString() === nameBytes.toString() &&
          t.ticker.toString() === symbolBytes.toString()
        );
      });

      if (!tokenInfo) {
        throw new Error(`No token found with ticker ${symbol} for creator ${creator}`);
      }

      return tokenInfo.metadata_addr || null;
    } catch (error) {
      console.error("Error fetching token metadata:", error);
      return null;
    }
  };

  // Check if current token is in watchlist
  const currentTokenInWatchlist = tokenDetails?.metadataAddress 
    ? isInWatchlist(tokenDetails.metadataAddress) 
    : false;
  
  // Generate a consistent color based on token symbol
  const generateColorFromString = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };
  
  // Handle star button click
  const handleStarClick = () => {
    if (!tokenDetails) return;
    
    // Generate icon and color based on token symbol
    const firstLetter = tokenDetails.symbol.charAt(0).toUpperCase();
    const iconBg = generateColorFromString(tokenDetails.symbol);
    
    const watchlistItem = {
      name: tokenDetails.name.replace('$', ''),
      symbol: tokenDetails.symbol,
      icon: firstLetter,
      iconBg: iconBg,
      metadataAddress: tokenDetails.metadataAddress || tokenDetails.txHash,
      creatorAddress: tokenDetails.creatorAddress
    };
    
    toggleWatchlist(watchlistItem);
  };

  // Load token details - first try location.state (passed from HomePage), then search tokens
  const fetchTokenDetails = async () => {
    if (!coinHash) return;

    try {
      // First, try to use location.state (data passed from HomePage/Marketplace navigation)
      if (location.state) {
        console.log("✅ Using token data from location.state:", location.state);
        const stateData = location.state as any;
        const tokenDetailsData: TokenDetails = {
          name: stateData.name || 'Unknown',
          symbol: stateData.symbol || 'UNK',
          supply: stateData.supply || 0,
          txHash: stateData.txHash || coinHash,
          metadataAddress: stateData.metadataAddress || stateData.txHash || coinHash,
          creatorAddress: stateData.creatorAddress || stateData.creator || '',
          creationDate: stateData.creationDate || Math.floor(Date.now() / 1000),
          twitterLink: stateData.twitterLink || null,
          websiteLink: stateData.websiteLink || null,
        };
        console.log("🎯 Setting token details from state:", tokenDetailsData);
        setTokenDetails(tokenDetailsData);
        return;
      }

      // Fallback: Search in tokens array
      console.log("🔍 No location.state, searching in tokens array...");
      console.log("🔍 Looking for token with metadata address:", coinHash);
      console.log("📊 Available tokens:", tokens);
      
      // Normalize the coinHash (lowercase, ensure 0x prefix)
      const normalizedCoinHash = coinHash.toLowerCase().startsWith('0x') 
        ? coinHash.toLowerCase() 
        : `0x${coinHash.toLowerCase()}`;
      
      // Remove 0x prefix for comparison
      const coinHashNoPrefix = normalizedCoinHash.replace('0x', '');
      
      // Find token by metadata address - try multiple matching strategies
      let token = tokens.find(t => {
        const tokenAddr = (t.metadataAddress || t.txHash || '').toLowerCase();
        const tokenAddrNoPrefix = tokenAddr.replace('0x', '');
        
        // Exact match
        if (tokenAddr === normalizedCoinHash) return true;
        // Match without 0x prefix
        if (tokenAddrNoPrefix === coinHashNoPrefix) return true;
        // Match if coinHash is a prefix of the full address (handles truncated URLs)
        if (tokenAddrNoPrefix.startsWith(coinHashNoPrefix) || coinHashNoPrefix.startsWith(tokenAddrNoPrefix)) return true;
        return false;
      });
      
      if (token) {
        console.log("✅ Found token in array:", token);
        
        const tokenDetailsData: TokenDetails = {
          name: token.name,
          symbol: token.symbol,
          supply: token.supply,
          txHash: token.txHash,
          metadataAddress: token.metadataAddress || token.txHash || '',
          creatorAddress: token.creatorAddress || token.creator || '',
          creationDate: new Date(token.launchDate).getTime() / 1000,
          twitterLink: null,
          websiteLink: null,
        };
        
        console.log("🎯 Setting token details from array:", tokenDetailsData);
        setTokenDetails(tokenDetailsData);
      } else {
        console.error("❌ Token not found for metadata address:", coinHash);
        console.error("📋 Available tokens:", tokens.map(t => ({
          metadataAddress: t.metadataAddress,
          txHash: t.txHash,
          symbol: t.symbol,
          name: t.name
        })));
      }
    } catch (error) {
      console.error("Error loading token details:", error);
    }
  };

  // Transplant the working buy/sell functions from TokenPage
  const handleBuy = async () => {
    console.log("handleBuy - account:", account, "amount:", amount, "creatorAddress:", tokenDetails?.creatorAddress, "symbol:", tokenDetails?.symbol, "slippage:", slippage);
    if (!account || amount <= 0 || !tokenDetails?.creatorAddress || !tokenDetails?.symbol) {
      alert("Connect wallet, enter a valid amount, or ensure token details are available.");
      return;
    }

    // Validate that we're buying at least 1 whole token (contract doesn't support fractional tokens)
    const tokenAmount = Math.floor(amount);
    if (tokenAmount < 1) {
      alert(`⚠️ Cannot buy fractional tokens. You entered ${amount}, but the minimum is 1 whole token.\n\nPlease enter at least 1 token to buy.`);
      return;
    }
  
    try {
      const tickerBytes = stringToBytes(tokenDetails.symbol);
  
      console.log("💰 Buying tokens with params:", {
        creatorAddress: tokenDetails.creatorAddress,
        ticker: tickerBytes,
        tokenAmount: tokenAmount,
        maxSlippageBps: slippage
      });
  
      // Build transaction using the same format that worked on devnet
      // Use simple format without options - let wallet handle gas estimation
      const buyTransaction: InputTransactionData = {
        data: {
          function: `${tokenLauncherAddress}::token_launcher::buy_tokens`,
          typeArguments: [],
          functionArguments: [
            tokenDetails.creatorAddress,
            tickerBytes,
            tokenAmount,
            slippage
          ],
        },
      };
  
      const response = await signAndSubmitTransaction(buyTransaction);
      console.log("Buy response:", response);
      
      // Try to wait for transaction confirmation, but don't fail if API is rate limited
      try {
        await client.waitForTransaction({ transactionHash: response.hash });
        console.log("✅ Transaction confirmed");
      } catch (confirmError: any) {
        console.log("⚠️ Could not confirm transaction (API rate limited), but transaction was submitted successfully");
        console.log("Transaction hash:", response.hash);
      }
      
      alert(`Bought ${amount} ${tokenDetails.symbol}! Tx: ${response.hash}`);

      // Refresh token balance and chart
      invalidateTokenData();
      
      // Wait a bit for blockchain state to propagate before refreshing balances
      // This ensures BuyerStore is updated on-chain before we query it
      console.log("⏳ Waiting 3 seconds for blockchain state to propagate...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Refresh balances after successful trade (force fresh data with retries)
      console.log("🔄 Refreshing balances after buy...");
      await refreshBalances(true);
    } catch (error: any) {
      console.error("Buy error:", error);
      console.error("Error details:", {
        message: error.message,
        errorCode: error.errorCode,
        error: error.error,
        fullError: error
      });
      
      // Enhanced error handling
      if (error.message?.includes('rejected') || error.fullError?.includes('rejected')) {
        // User rejected the transaction - likely due to wallet simulation error
        alert(`⚠️ Transaction was rejected in wallet.\n\n` +
              `This is often caused by wallet simulation errors with fungible assets, especially for larger amounts.\n\n` +
              `If you're trying to buy more than 1 token, try:\n` +
              `1. Approving the transaction despite the simulation warning\n` +
              `2. Buying 1 token at a time (you can do multiple transactions)\n` +
              `3. Refreshing the page and reconnecting your wallet\n` +
              `4. Using a different wallet if available\n\n` +
              `The transaction may work even if the simulation shows an error.`);
      } else if (error.message?.includes('Insufficient balance') || error.message?.includes('insufficient balance')) {
        // This is likely a wallet simulation error - fungible assets can't be verified during simulation
        alert(`⚠️ Wallet simulation error: The wallet cannot verify fungible asset transactions during simulation.\n\n` +
              `If you're trying to buy more than 1 token, try:\n` +
              `1. Approving the transaction despite the simulation warning\n` +
              `2. Buying 1 token at a time (you can do multiple transactions)\n` +
              `3. Refreshing the page\n\n` +
              `The transaction may still work - check the transaction hash in the console.`);
      } else if (error.errorCode === '1012' || error.message?.includes('1012')) {
        const currentSlippage = slippage / 100;
        const suggestedSlippage = Math.min(currentSlippage * 1.5, 10);
        alert(`Slippage exceeded: ${currentSlippage}% is too low. Try increasing to ${suggestedSlippage}% or reduce your trade size.`);
      } else if (error.errorCode === '1017' || error.message?.includes('1017')) {
        alert('Invalid slippage setting. Please use a value between 0.1% and 10%.');
      } else {
        alert(`Failed to buy tokens: ${error.message || 'Unknown error'}\n\nCheck console for details.`);
      }
    }
  };
  
  const handleSell = async () => {
    if (!account || amount <= 0 || !tokenDetails?.creatorAddress || !tokenDetails?.symbol) {
      alert("Connect wallet, enter a valid amount, or ensure token details are available.");
      return;
    }

    // Check if user has enough tokens to sell
    const metadataAddress = tokenDetails?.metadataAddress || location.state?.metadataAddress || "0x0";
    const currentTokenBalance = parseFloat(getTokenBalance(metadataAddress));
    console.log("🔍 Sell balance check:", {
      metadataAddress,
      currentTokenBalance,
      amountToSell: amount,
      hasEnough: amount <= currentTokenBalance
    });
    
    if (amount > currentTokenBalance) {
      alert(`Insufficient token balance. You have ${currentTokenBalance.toFixed(6)} tokens, but trying to sell ${amount.toFixed(6)} tokens.`);
      return;
    }

    // Validate that we're selling at least 1 whole token (contract doesn't support fractional tokens)
    const tokenAmount = Math.floor(amount);
    if (tokenAmount < 1) {
      alert(`⚠️ Cannot sell fractional tokens. You entered ${amount}, but the minimum is 1 whole token.\n\nPlease enter at least 1 token to sell.`);
      return;
    }
  
    try {
      // The contract expects amount in tokens (not scaled), it will multiply by decimals_factor internally
      const tickerBytes = stringToBytes(tokenDetails.symbol);
  
      console.log("💰 Selling tokens with params:", {
        creatorAddress: tokenDetails.creatorAddress,
        ticker: tickerBytes,
        tokenAmount: tokenAmount,
        maxSlippageBps: slippage,
        metadataAddress: metadataAddress,
        userBalance: currentTokenBalance
      });
  
      const sellTransaction: InputTransactionData = {
        data: {
          function: `${tokenLauncherAddress}::token_launcher::sell_tokens`,
          typeArguments: [],
          functionArguments: [
            tokenDetails.creatorAddress,
            tickerBytes,
            tokenAmount,
            slippage
          ],
        },
      };
            const response = await signAndSubmitTransaction(sellTransaction);
      console.log("Sell response:", response);
      
      // Try to wait for transaction confirmation, but don't fail if API is rate limited
      try {
        await client.waitForTransaction({ transactionHash: response.hash });
        console.log("✅ Transaction confirmed");
      } catch (confirmError: any) {
        console.log("⚠️ Could not confirm transaction (API rate limited), but transaction was submitted successfully");
        console.log("Transaction hash:", response.hash);
      }
      
      alert(`Sold ${amount} ${tokenDetails.symbol}! Tx: ${response.hash}`);

      // Refresh token balance and chart
      invalidateTokenData();
      
      // Wait a bit for blockchain state to propagate before refreshing balances
      console.log("⏳ Waiting 3 seconds for blockchain state to propagate...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Refresh balances after successful trade (force fresh data with retries)
      console.log("🔄 Refreshing balances after sell...");
      await refreshBalances(true);

    } catch (error: any) {
      console.error("Sell failed:", error);
      console.error("Error details:", {
        message: error.message,
        errorCode: error.errorCode,
        error: error.error,
        fullError: error
      });
      
      // Enhanced error handling
      if (error.message?.includes('rejected') || error.fullError?.includes('rejected')) {
        // User rejected the transaction - likely due to wallet simulation error
        alert(`⚠️ Transaction was rejected in wallet.\n\n` +
              `This is often caused by wallet simulation errors with fungible assets.\n\n` +
              `Your balance shows ${currentTokenBalance.toFixed(6)} tokens. ` +
              `If you're sure you have enough tokens, try:\n` +
              `1. Approving the transaction despite the simulation warning\n` +
              `2. Refreshing the page and reconnecting your wallet\n` +
              `3. Using a different wallet if available\n\n` +
              `The transaction may work even if the simulation shows an error.`);
      } else if (error.message?.includes('Insufficient balance') || error.message?.includes('insufficient balance')) {
        // This is likely a wallet simulation error - fungible assets can't be verified during simulation
        alert(`⚠️ Wallet simulation error: The wallet cannot verify fungible asset balances during simulation.\n\n` +
              `Your balance shows ${currentTokenBalance.toFixed(6)} tokens. ` +
              `If you're sure you have enough tokens, try:\n` +
              `1. Approving the transaction despite the simulation warning\n` +
              `2. Refreshing the page\n` +
              `3. Disconnecting and reconnecting your wallet\n\n` +
              `The transaction may still work - check the transaction hash in the console.`);
      } else if (error.errorCode === '1012' || error.message?.includes('1012')) {
        const currentSlippage = slippage / 100;
        const suggestedSlippage = Math.min(currentSlippage * 1.5, 10);
        alert(`Slippage exceeded: ${currentSlippage}% is too low. Try increasing to ${suggestedSlippage}% or reduce your trade size.`);
      } else if (error.errorCode === '1017' || error.message?.includes('1017')) {
        alert('Invalid slippage setting. Please use a value between 0.1% and 10%.');
      } else {
        alert(`Failed to sell tokens: ${error.message || 'Unknown error'}\n\nCheck console for details.`);
      }
    }
  };

  // Add useEffect to fetch token details when component mounts
  useEffect(() => {
    // If location.state is available, use it immediately (no need to wait for tokens)
    if (location.state) {
      fetchTokenDetails();
      return;
    }
    
    // Otherwise, wait for tokens to finish loading before trying to find the token
    if (!tokensLoading && tokens.length > 0) {
      fetchTokenDetails();
    } else if (!tokensLoading && tokens.length === 0) {
      console.warn("⚠️ No tokens loaded, cannot find token for:", coinHash);
    }
  }, [coinHash, tokens, tokensLoading, location.state]);

  // Add useEffect to fetch user's token balance
  useEffect(() => {
    if (tokenDetails?.metadataAddress && account?.address) {
      refreshBalances();
    }
  }, [tokenDetails?.metadataAddress, account?.address]);

  // Force refresh balance function (for manual refresh)
  const forceRefreshBalance = async () => {
    console.log("🔄 Force refreshing balance...");
    await refreshBalances();
  };

  // Add useEffect to fetch user's APT balance
  

  // Add useEffect to calculate total when amount changes
  useEffect(() => {
    const calculatedTotal = calculateTotal(amount);
    setTotal(calculatedTotal.toString());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, tokenData?.tokensSold]);

  // Debug logging to see what's in tokenDetails
  useEffect(() => {
    if (tokenDetails) {
      console.log('NEWtokenpage - tokenDetails:', tokenDetails);
      console.log('Name:', tokenDetails.name);
      console.log('Symbol:', tokenDetails.symbol);
    }
  }, [tokenDetails]);

  // Helper function to get percentage change color
  const getPercentageColor = (percentage: string) => {
    if (percentage.startsWith('+')) return '#00d4aa'; // Green for positive
    if (percentage.startsWith('-')) return '#ff6b6b'; // Red for negative
    return '#5b616e'; // Default color for neutral
  };

  // Function to toggle wallet dropdown
  const toggleWalletDropdown = () => {
    setWalletDropdownOpen(!walletDropdownOpen);
  };

  // Function to handle disconnect
  const handleDisconnect = () => {
    disconnect();
    setWalletDropdownOpen(false);
  };

  // Function to handle clicking outside the dropdown
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Element;
    if (!target.closest('[data-wallet-dropdown]')) {
      setWalletDropdownOpen(false);
    }
  };

  // Add effect to handle clicking outside dropdown
  useEffect(() => {
    if (walletDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [walletDropdownOpen]);

  // Balance fetching is now handled by BalanceContext - no local logic needed





  // Function to calculate total cost/return based on amount and current price
  const calculateTotal = (amount: number) => {
    if (!amount || amount <= 0) return 0;
    
    const total_supply = 800_000_000;
    const tokens_sold_before = tokenData?.tokensSold ?? 0;
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



  // Add useEffect for component mount
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const handleTokenSelect = (token: any) => {
    setSelectedToken(token);
    console.log('Selected token:', token);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    console.log('Search query:', query);
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

  const handleHeaderToggle = () => {
    setHeaderMinimized(!headerMinimized);
  };

  // Add formatTimeAgo function from the transplanted engine
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    if (diffInHours < 1) return `${Math.floor(diffInHours * 60)} minutes ago`;
    if (diffInHours < 24) return `${Math.floor(diffInHours)} hours ago`;
    return date.toLocaleDateString();
  };

  // Add truncateAddress function from the transplanted engine
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Helper to find token from tokens array using metadataAddress
  // Static catalog row (name, symbol, image, creator) — slow-changing data
  const catalogRow = useMemo(() => {
    if (!tokenDetails?.metadataAddress || tokens.length === 0) return null;
    return tokens.find(t =>
      t.metadataAddress?.toLowerCase() === tokenDetails.metadataAddress?.toLowerCase() ||
      t.txHash?.toLowerCase() === tokenDetails.metadataAddress?.toLowerCase() ||
      t.metadataAddress?.toLowerCase() === coinHash?.toLowerCase() ||
      t.txHash?.toLowerCase() === coinHash?.toLowerCase()
    );
  }, [tokenDetails?.metadataAddress, tokens, coinHash]);

  // Resolve metadataAddress for chart & holder data
  const resolvedMetadataAddr = tokenDetails?.metadataAddress || coinHash;

  // Live, canonical state from the on-chain vault (3s polling, server-side cached)
  const { data: live } = useTokenLive(resolvedMetadataAddr);

  // Single composite tokenData: catalog metadata overridden by live vault state.
  // Every numeric field below is the same value used everywhere on the page.
  const tokenData = useMemo(() => {
    if (!catalogRow && !live) return null;
    const priceAPT = live?.spotPriceAPT ?? catalogRow?.price;
    const supply = live?.totalSupply ?? catalogRow?.supply ?? 1_000_000_000;
    const aptUsd = aptPrice ?? 0;
    const priceUSD = priceAPT !== undefined && aptUsd > 0 ? priceAPT * aptUsd : catalogRow?.priceUSD;
    const marketCapAPT = live?.marketCapAPT ?? (priceAPT !== undefined ? priceAPT * supply : undefined);
    const marketCapUSD = marketCapAPT !== undefined && aptUsd > 0 ? marketCapAPT * aptUsd : catalogRow?.marketCapUSD;
    return {
      ...(catalogRow || {}),
      price: priceAPT,
      priceUSD,
      supply,
      marketCap: marketCapAPT,
      marketCapUSD,
      aptRaised: live?.aptRaised ?? catalogRow?.aptRaised,
      tokensSold: live?.tokensSold ?? catalogRow?.tokensSold,
      isGraduated: live?.isGraduated ?? (catalogRow as any)?.isGraduated,
      // volume + change24h still come from the catalog row (trade history) until useTokenTrades lands
      volume: catalogRow?.volume,
      change24h: catalogRow?.change24h,
    } as any;
  }, [catalogRow, live, aptPrice]);

  // Fetch OHLC candles, holder count, apt raised, and raw trades
  const { candles, recentTrades, loading: chartLoading, holderCount, aptRaised } = useOHLCData(
    resolvedMetadataAddr,
    timeframe,
    refreshChart,
  );

  // Apply chart mode multiplier to candle prices
  const displayCandles = useMemo(() => {
    if (!candles.length) return candles;
    const supply = tokenData?.supply ?? 1_000_000_000;
    const apt = aptPrice ?? 0;
    const mult = chartMode === 'usd'  ? apt
               : chartMode === 'mcap' ? apt * supply
               : 1; // 'apt' = no transform
    if (mult === 1 || mult === 0) return candles;
    return candles.map(c => ({
      ...c,
      open:  c.open  * mult,
      high:  c.high  * mult,
      low:   c.low   * mult,
      close: c.close * mult,
    }));
  }, [candles, chartMode, aptPrice, tokenData?.supply]);

  // Initialize lightweight-charts once the container is mounted
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: t.chartBg },
        textColor: t.chartText,
        fontFamily: "'Inter', sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: t.chartGrid },
        horzLines: { color: t.chartGrid },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: t.border },
      timeScale: { borderColor: t.border, timeVisible: true, secondsVisible: false },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00d4aa',
      downColor: '#ff4757',
      borderUpColor: '#00d4aa',
      borderDownColor: '#ff4757',
      wickUpColor: '#00d4aa',
      wickDownColor: '#ff4757',
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => {
          if (price === 0) return '0';
          if (price < 0.000001) return price.toFixed(10);
          if (price < 0.0001)   return price.toFixed(8);
          if (price < 0.01)     return price.toFixed(6);
          if (price < 1)        return price.toFixed(4);
          return price.toFixed(2);
        },
        minMove: 0.0000000001,
      },
    });

    const volSeries = chart.addHistogramSeries({
      color: '#00d4aa',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    seriesRef.current = candleSeries as unknown as ISeriesApi<"Candlestick", Time>;
    volumeSeriesRef.current = volSeries as unknown as ISeriesApi<"Histogram", Time>;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []); // intentionally run once on mount

  // Update chart colors when theme changes
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: t.chartBg },
        textColor: t.chartText,
      },
      grid: {
        vertLines: { color: t.chartGrid },
        horzLines: { color: t.chartGrid },
      },
      rightPriceScale: { borderColor: t.border },
      timeScale: { borderColor: t.border },
    });
  }, [isDark]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update chart data whenever candles or chart mode changes
  useEffect(() => {
    if (!seriesRef.current || !volumeSeriesRef.current) return;
    if (displayCandles.length === 0) {
      seriesRef.current.setData([]);
      volumeSeriesRef.current.setData([]);
      return;
    }

    seriesRef.current.setData(displayCandles.map(c => ({
      time: c.time as Time,
      open: c.open, high: c.high, low: c.low, close: c.close,
    })));

    volumeSeriesRef.current.setData(displayCandles.map(c => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? '#00d4aa44' : '#ff475744',
    })));

    chartRef.current?.timeScale().fitContent();
  }, [displayCandles]);

  // Format currency (for USD prices)
  const formatCurrency = (value: number | undefined): string => {
    if (value === undefined || value === null || isNaN(value)) return 'Loading...';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 6,
      maximumFractionDigits: 6
    }).format(value);
  };

  // Format price (for APT prices) - matches HomePage and Marketplace format
  const formatPrice = (price: number | undefined): string => {
    if (price === undefined || price === null || isNaN(price)) return 'Loading...';
    if (price < 0.0001) return `$${price.toFixed(8)}`;
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  // Format large numbers (market cap, volume)
  const formatLargeNumber = (value: number | undefined): string => {
    if (value === undefined || value === null || isNaN(value)) return 'Loading...';
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  // Format percentage
  const formatPercentage = (value: number | undefined): string => {
    if (value === undefined || value === null || isNaN(value)) return '0%';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  // Format APT value
  const formatApt = (value: number | undefined): string => {
    if (value === undefined || value === null || isNaN(value)) return 'Loading...';
    if (value < 0.0001) return `${value.toFixed(8)} APT`;
    if (value < 0.01)   return `${value.toFixed(6)} APT`;
    if (value < 1)      return `${value.toFixed(4)} APT`;
    return `${value.toFixed(3)} APT`;
  };

  // Format the top-line price display based on current chart mode
  const formatCurrentPrice = (): string => {
    if (!tokenData) return 'Loading...';
    if (chartMode === 'apt')  return formatApt(tokenData.price);
    if (chartMode === 'mcap') return formatLargeNumber(tokenData.marketCapUSD);
    return tokenData.priceUSD !== undefined ? formatPrice(tokenData.priceUSD)
         : tokenData.price !== undefined    ? `${tokenData.price.toFixed(8)} APT`
         : 'Loading...';
  };

  // Compute a reference "now" that compensates for Aptos testnet clock running ahead
  // of the user's browser. We use whichever is later: browser time or the most recent
  // trade's timestamp. This makes relative times ("5m ago") correct regardless of
  // node clock drift.
  const referenceNow = useMemo(() => {
    if (recentTrades.length === 0) return Date.now();
    const latestTrade = Math.max(...recentTrades.map(t => t.timestampMs));
    return Math.max(Date.now(), latestTrade);
  }, [recentTrades]);

  const timeAgo = (ms: number): string => {
    const diff = referenceNow - ms;
    const s = Math.floor(diff / 1000);
    if (s <= 5) return 'just now';
    if (s < 60)  return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  // Generate avatar for token with no image
  const tokenAvatarBg = useMemo(() => {
    const sym = tokenDetails?.symbol || '';
    let hash = 0;
    for (let i = 0; i < sym.length; i++) hash = sym.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return `linear-gradient(135deg, hsl(${hue},65%,45%), hsl(${(hue + 40) % 360},70%,55%))`;
  }, [tokenDetails?.symbol]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      width: '100vw',
      fontFamily: "'Inter', sans-serif",
      margin: 0,
      padding: 0,
      overflow: 'visible',
      background: t.bgPrimary,
      color: t.textPrimary,
      transition: 'background 0.2s ease, color 0.2s ease',
    }}>
      {/* Header */}
      {/* Token Leaderboard - Commented out for future CTA */}
      {/* <div style={{
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
                  lineHeight: '1.2',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {token.name}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: '#5b616e',
                  marginTop: '1px',
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

        Toggle Button
        <button
          onClick={handleHeaderToggle}
          style={{
            position: 'absolute',
            bottom: '2px',
            right: '10px',
            background: '#ffffff',
            border: '0px solid #d3d3d3',
            borderRadius: '4px',
            padding: '6px 12px',
            fontSize: '12px',
            cursor: 'pointer',
            color: headerMinimized ? '#00d4aa' : '#878788',
            transition: 'all 0.2s ease',
            zIndex: 10
          }}
        >
          {headerMinimized ? 'View Token Leaderboard' : '__'}
        </button>
      </div> */}
      
      {/* Blank white bar - placeholder for future CTA */}
      <div style={{
        background: '#ffffff',
        width: '100%',
        height: '40px',
        borderBottom: '1px solid #e7ebee',
        flexShrink: 0
      }}>
      </div>

      {/* Main Layout */}
      <div style={{
        display: 'flex',
        flex: 1,
        width: '100%',
        overflow: 'visible',
        alignSelf: 'stretch',
        minHeight: '100%',
        position: 'relative',
        background: '#ffffff'
      }}>
        {/* Sidebar */}
        <div style={{
          position: 'relative',
          alignSelf: 'stretch',
          minHeight: '100%'
        }}>
          <GlobalSidebar 
            activeTab="trade"
          />
        </div>

        {/* Main Content */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          width: '100%',
          background: t.bgPrimary,
        }}>
          {/* Token Title Bar */}
          <div style={{
            background: t.bgPrimary,
            borderBottom: `1px solid ${t.border}`,
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{
              fontSize: '22px',
              fontWeight: 700,
              color: t.textPrimary,
              flexShrink: 0,
              letterSpacing: '-0.3px',
            }}>
                              {tokenDetails ? tokenDetails.name.replace('$', '') : 'Token Page'}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              fontSize: '14px',
              flexShrink: 0
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
                  {wallets.map((wallet: any) => (
                    <button
                      key={wallet.name}
                      onClick={() => connect(wallet.name)}
                      style={{
                        background: '#00d4aa',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      Connect Wallet
                    </button>
                  ))}
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
            overflowY: 'auto',
            position: 'relative'
          }}>
            {/* Content Left */}
            <div style={{
              flex: 1,
              padding: '20px',
              background: t.bgPrimary,
              minWidth: 0
            }}>
              {/* Token Header */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                marginBottom: '8px',
                background: t.bgPrimary,
                width: '100%',
              }}>
                {/* Price */}
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: t.textPrimary,
                  marginBottom: '4px',
                  lineHeight: 1,
                  letterSpacing: '-0.5px',
                }}>
                  {formatCurrentPrice()}
                </div>
                {/* 24h change */}
                <div style={{
                  color: tokenData?.change24h !== undefined
                    ? (tokenData.change24h >= 0 ? t.positive : t.negative)
                    : t.textMuted,
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '16px',
                  fontWeight: 600,
                  fontSize: '15px',
                  gap: '4px',
                }}>
                  <span>{tokenData?.change24h !== undefined ? (tokenData.change24h >= 0 ? '▲' : '▼') : ''}</span>
                  <span>{tokenData?.change24h !== undefined ? formatPercentage(tokenData.change24h) : t.textMuted ? '' : ''}</span>
                  {tokenData?.change24h === undefined && <span style={{ color: t.textMuted, fontWeight: 400, fontSize: '13px' }}>24h</span>}
                </div>

                {/* Controls row: timeframe + mode toggle + actions */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  width: '100%',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}>
                  {/* Left: timeframe + chart mode */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {/* Timeframe buttons */}
                    <div style={{
                      display: 'flex',
                      background: t.bgSecondary,
                      borderRadius: '8px',
                      padding: '3px',
                      gap: '2px',
                      border: `1px solid ${t.border}`,
                    }}>
                      {(['1m', '15m', '1H', '4H', '1D', 'ALL'] as Timeframe[]).map((time) => (
                        <button
                          key={time}
                          onClick={() => setTimeframe(time)}
                          style={{
                            padding: '5px 11px',
                            border: 'none',
                            borderRadius: '6px',
                            background: timeframe === time ? t.accent : 'transparent',
                            color: timeframe === time ? '#fff' : t.textSecondary,
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          {time}
                        </button>
                      ))}
                    </div>

                    {/* Chart mode toggle: APT / USD / MCap */}
                    <div style={{
                      display: 'flex',
                      background: t.bgSecondary,
                      borderRadius: '8px',
                      padding: '3px',
                      gap: '2px',
                      border: `1px solid ${t.border}`,
                    }}>
                      {(['apt', 'usd', 'mcap'] as ChartMode[]).map((mode) => {
                        const labels: Record<ChartMode, string> = { apt: 'APT', usd: 'USD', mcap: 'MCap' };
                        return (
                          <button
                            key={mode}
                            onClick={() => setChartMode(mode)}
                            style={{
                              padding: '5px 11px',
                              border: 'none',
                              borderRadius: '6px',
                              background: chartMode === mode ? t.accentLight : 'transparent',
                              color: chartMode === mode ? t.accent : t.textSecondary,
                              fontSize: '13px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              fontFamily: "'Inter', sans-serif",
                            }}
                          >
                            {labels[mode]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: star + share */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={handleStarClick}
                      style={{
                        background: t.bgSecondary,
                        border: `1px solid ${t.border}`,
                        color: currentTokenInWatchlist ? '#FFD700' : t.textSecondary,
                        cursor: 'pointer',
                        fontSize: '18px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        height: '34px',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'all 0.15s',
                      }}
                      title={currentTokenInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
                    >
                      {currentTokenInWatchlist ? '★' : '☆'}
                    </button>
                    <button style={{
                      padding: '6px 16px',
                      background: t.bgSecondary,
                      color: t.textSecondary,
                      border: `1px solid ${t.border}`,
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      height: '34px',
                    }}>
                      Share
                    </button>
                    {/* <button style={{
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #FF6B35, #FF8C42)',
                      color: '#ffffff',
                      border: '1px solid #FF6B35',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 8px rgba(255, 107, 53, 0.3)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      Boost Token
                    </button> */}
                  </div>
                </div>
              </div>

              {/* Chart Container */}
              <div style={{
                background: t.bgPrimary,
                border: `1px solid ${t.border}`,
                borderRadius: '10px',
                marginBottom: '24px',
                height: '340px',
                position: 'relative',
              }}>
                {/* lightweight-charts mounts here */}
                <div
                  ref={chartContainerRef}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}
                />
                {/* Overlay when no data yet */}
                {!chartLoading && candles.length === 0 && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#8a9ba8',
                    fontSize: '14px',
                    pointerEvents: 'none',
                  }}>
                    No trades yet — be the first to buy!
                  </div>
                )}
                {chartLoading && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#8a9ba8',
                    fontSize: '14px',
                    pointerEvents: 'none',
                  }}>
                    Loading chart…
                  </div>
                )}
              </div>

              {/* Tabs: Insights / Transactions / Top Holders */}
              <div style={{ marginTop: '16px' }}>
                <div style={{
                  display: 'flex',
                  borderBottom: `1px solid ${t.border}`,
                  justifyContent: 'flex-start',
                }}>
                  {(['insights', 'transactions', 'holders'] as const).map((tab) => {
                    const labels = { insights: 'Insights', transactions: 'Transactions', holders: 'Top Holders' };
                    const active = activeInsightTab === tab;
                    return (
                      <div
                        key={tab}
                        onClick={() => setActiveInsightTab(tab)}
                        style={{
                          padding: '10px 0',
                          marginRight: '24px',
                          color: active ? t.accent : t.textMuted,
                          fontSize: '14px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          borderBottom: `2px solid ${active ? t.accent : 'transparent'}`,
                          transition: 'all 0.15s',
                          userSelect: 'none',
                        }}
                      >
                        {labels[tab]}
                      </div>
                    );
                  })}
                </div>

                {/* ── INSIGHTS TAB ───────────────────────────────────── */}
                {activeInsightTab === 'insights' && (
                <div style={{
                  border: `1px solid ${t.border}`,
                  borderTop: 'none',
                  borderBottomLeftRadius: '12px',
                  borderBottomRightRadius: '12px',
                }}>
                  {/* Token Info Section */}
                  <div style={{
                    display: 'flex',
                    marginBottom: '0',
                    background: t.bgSecondary,
                    borderBottomLeftRadius: '12px',
                    borderBottomRightRadius: '12px',
                    minHeight: '200px',
                  }}>
                    {/* Token image / avatar */}
                    <div style={{
                      width: '220px',
                      flexShrink: 0,
                      borderBottomLeftRadius: '12px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}>
                      {tokenDetails?.image ? (
                        <img
                          src={tokenDetails.image}
                          alt={`${tokenDetails.name} logo`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        <div style={{
                          width: '100%', height: '100%', minHeight: '200px',
                          background: tokenAvatarBg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ fontSize: '72px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '-2px' }}>
                            {tokenDetails?.symbol?.charAt(0) ?? '?'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      padding: '20px'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '16px'
                      }}>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}>
                          <div style={{
                            fontSize: '24px',
                            fontWeight: '700',
                            color: t.textPrimary,
                          }}>
                            {tokenDetails ? tokenDetails.name.replace('$', '') : 'Loading...'}
                          </div>
                          <div style={{
                            fontSize: '16px',
                            color: t.textMuted,
                            fontWeight: '500'
                          }}>
                            {tokenDetails ? tokenDetails.symbol : 'Loading...'}
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          gap: '30px'
                        }}>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: '4px',
                            fontSize: '14px'
                          }}>
                            <span style={{
                              color: t.textMuted,
                              fontWeight: '500',
                              fontSize: '12px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Launched:
                            </span>
                            <span style={{
                              color: t.textPrimary,
                              fontWeight: '600',
                              fontSize: '14px'
                            }}>
                              {tokenDetails ? formatTimeAgo(new Date(tokenDetails.creationDate * 1000).toISOString()) : 'Loading...'}
                            </span>
                          </div>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: '4px',
                            fontSize: '14px'
                          }}>
                            <span style={{
                              color: t.textMuted,
                              fontWeight: '500',
                              fontSize: '12px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Holders:
                            </span>
                            <span style={{
                              color: t.textPrimary,
                              fontWeight: '600',
                              fontSize: '14px'
                            }}>
                              {holderCount > 0 ? `${holderCount.toLocaleString()} wallets` : 'Loading...'}
                            </span>
                          </div>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: '4px',
                            fontSize: '14px'
                          }}>
                            <span style={{
                              color: t.textMuted,
                              fontWeight: '500',
                              fontSize: '12px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Created by:
                            </span>
                            <span style={{
                              color: t.textPrimary,
                              fontWeight: '600',
                              fontSize: '14px'
                            }}>
                              {tokenDetails ? truncateAddress(tokenDetails.creatorAddress || '') : 'Loading...'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: t.textSecondary,
                        fontWeight: '400',
                        lineHeight: '1.5',
                        marginTop: '4px',
                        maxWidth: '400px'
                      }}>
                        {tokenDetails?.description || 'No description available for this token.'}
                      </div>
                    </div>
                  </div>



                  <div style={{
                    display: 'flex',
                    gap: '100px',
                    width: '100%',
                    margin: '40px 0px'
                  }}>
                    <div style={{
                      flex: 1,
                      maxWidth: '50%',
                      marginLeft: '20px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '20px',
                        width: '100%'
                      }}>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          <div style={{
                            fontSize: '22px',
                            fontWeight: '700',
                            color: t.textPrimary,
                            lineHeight: '1',
                            marginBottom: '10px'
                          }}>
                            {tokenData?.marketCapUSD !== undefined ? formatLargeNumber(tokenData.marketCapUSD) : 'Loading...'}
                          </div>
                          <div style={{
                            fontSize: '16px',
                            color: t.textMuted,
                            marginBottom: '20px'
                          }}>
                            Market Cap
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          <div style={{
                            fontSize: '22px',
                            fontWeight: '700',
                            color: t.textPrimary,
                            lineHeight: '1',
                            marginBottom: '10px'
                          }}>
                            {tokenData?.volume !== undefined ? formatLargeNumber(tokenData.volume) : 'Loading...'}
                          </div>
                          <div style={{
                            fontSize: '16px',
                            color: t.textMuted,
                            marginBottom: '20px'
                          }}>
                            Volume (24h)
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start'
                        }}>
                          <div style={{
                            fontSize: '22px',
                            fontWeight: '700',
                            color: tokenData?.change24h !== undefined && tokenData.change24h >= 0 ? t.positive : t.negative,
                            lineHeight: '1',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginBottom: '10px'
                          }}>
                            <span style={{ fontSize: '16px' }}>{tokenData?.change24h !== undefined && tokenData.change24h >= 0 ? '↑' : '↓'}</span>
                            <span>{tokenData?.change24h !== undefined ? formatPercentage(tokenData.change24h) : '0%'}</span>
                          </div>
                          <div style={{
                            fontSize: '16px',
                            color: t.textMuted,
                            marginBottom: '20px'
                          }}>
                            Change % (24h)
                          </div>
                        </div>
                      </div>

                      {(() => {
                        const GRADUATION_TARGET_OCTAS = 128_300_000_000; // 1283 APT in Octas
                        const GRAD_TARGET_APT = 1283;
                        // Use live vault total_apt_spent (nets out sells, single source of truth)
                        const aptRaisedOctas = live?.aptRaisedOctas ?? aptRaised;
                        const aptRaisedAPT = aptRaisedOctas / 1e8;
                        const progressPct = Math.min((aptRaisedOctas / GRADUATION_TARGET_OCTAS) * 100, 100);
                        return (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            marginTop: '20px',
                            width: '100%'
                          }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '8px'
                            }}>
                              <div style={{
                                fontSize: '22px',
                                fontWeight: '700',
                                color: t.textPrimary,
                                lineHeight: '1'
                              }}>
                                {aptRaisedAPT.toFixed(2)} / {GRAD_TARGET_APT} APT
                              </div>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: t.accent,
                                letterSpacing: '0.5px'
                              }}>
                                {progressPct.toFixed(1)}% Complete
                              </div>
                            </div>
                            <div style={{
                              width: '100%',
                              height: '14px',
                              background: t.bgSecondary,
                              borderRadius: '7px',
                              overflow: 'hidden',
                              marginBottom: '8px',
                              border: `1px solid ${t.border}`,
                            }}>
                              <div style={{
                                height: '100%',
                                background: 'linear-gradient(90deg, #00d4aa, #00b894)',
                                borderRadius: '7px',
                                width: `${progressPct}%`,
                                transition: 'width 0.5s ease',
                                boxShadow: progressPct > 85 ? '0 0 10px rgba(0, 212, 170, 0.6)' : 'none',
                              }}></div>
                            </div>
                            <div style={{
                              fontSize: '13px',
                              fontWeight: '500',
                              color: t.textMuted,
                              marginTop: '6px',
                              letterSpacing: '0.4px'
                            }}>
                              Graduation Progress — reaches DEX at {GRAD_TARGET_APT} APT raised
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div style={{
                      flex: 1,
                      maxWidth: '50%'
                    }}>
                      <div style={{
                        background: t.bgPrimary,
                        borderRadius: '12px',
                        padding: '20px',
                        marginTop: '-20px',
                        border: `1px solid ${t.border}`,
                      }}>
                        <p style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: t.textMuted,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          paddingBottom: '8px',
                          margin: 0,
                        }}>
                          Links
                        </p>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          marginTop: '10px',
                        }}>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              onClick={handleCopyCA}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 14px',
                                border: `1px solid ${t.border}`,
                                borderRadius: '8px',
                                background: t.bgSecondary,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                fontSize: '13px',
                                fontWeight: '500',
                                color: t.textPrimary,
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>🔗</span>
                              <span style={{ flex: 1 }}>{copied ? 'Copied!' : 'Copy CA'}</span>
                            </button>
                            {tokenDetails?.websiteLink ? (
                              <a href={tokenDetails.websiteLink} target="_blank" rel="noopener noreferrer"
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '8px',
                                  padding: '10px 14px', border: `1px solid ${t.border}`,
                                  borderRadius: '8px', background: t.bgSecondary,
                                  textDecoration: 'none', fontSize: '13px', fontWeight: '500',
                                  color: t.textPrimary, flex: 1, minWidth: 0,
                                }}>
                                <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>🌐</span>
                                <span>Website</span>
                              </a>
                            ) : (
                              <button disabled style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '10px 14px', border: `1px solid ${t.border}`,
                                borderRadius: '8px', background: t.bgSecondary,
                                fontSize: '13px', fontWeight: '500', color: t.textMuted,
                                flex: 1, minWidth: 0, cursor: 'default', opacity: 0.5,
                              }}>
                                <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>🌐</span>
                                <span>Website</span>
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            {tokenDetails?.twitterLink ? (
                              <a href={tokenDetails.twitterLink} target="_blank" rel="noopener noreferrer"
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '8px',
                                  padding: '10px 14px', border: `1px solid ${t.border}`,
                                  borderRadius: '8px', background: t.bgSecondary,
                                  textDecoration: 'none', fontSize: '13px', fontWeight: '500',
                                  color: t.textPrimary, flex: 1, minWidth: 0,
                                }}>
                                <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>🐦</span>
                                <span>Twitter</span>
                              </a>
                            ) : (
                              <button disabled style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '10px 14px', border: `1px solid ${t.border}`,
                                borderRadius: '8px', background: t.bgSecondary,
                                fontSize: '13px', fontWeight: '500', color: t.textMuted,
                                flex: 1, minWidth: 0, cursor: 'default', opacity: 0.5,
                              }}>
                                <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>🐦</span>
                                <span>Twitter</span>
                              </button>
                            )}
                            <button disabled style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '10px 14px', border: `1px solid ${t.border}`,
                              borderRadius: '8px', background: t.bgSecondary,
                              fontSize: '13px', fontWeight: '500', color: t.textMuted,
                              flex: 1, minWidth: 0, cursor: 'default', opacity: 0.5,
                            }}>
                              <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>💬</span>
                              <span>Telegram</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {/* ── TRANSACTIONS TAB ─────────────────────────────── */}
                {activeInsightTab === 'transactions' && (
                <div style={{
                  border: `1px solid ${t.border}`,
                  borderTop: 'none',
                  borderBottomLeftRadius: '12px',
                  borderBottomRightRadius: '12px',
                  overflow: 'hidden',
                }}>
                  {recentTrades.length === 0 ? (
                    <div style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: t.textMuted,
                      fontSize: '14px',
                    }}>
                      No trades yet — be the first to buy!
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: t.bgSecondary, borderBottom: `1px solid ${t.border}` }}>
                          {['Type', 'Wallet', 'Tokens', 'APT Value', 'Time'].map(h => (
                            <th key={h} style={{
                              padding: '10px 16px',
                              textAlign: 'left',
                              fontWeight: 600,
                              fontSize: '11px',
                              color: t.textMuted,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recentTrades.slice(0, 50).map((trade, i) => (
                          <tr key={i} style={{
                            borderBottom: `1px solid ${t.border}`,
                            background: i % 2 === 0 ? 'transparent' : t.bgSecondary,
                          }}>
                            <td style={{ padding: '10px 16px' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: trade.type === 'buy' ? 'rgba(0,212,170,0.12)' : 'rgba(255,71,87,0.12)',
                                color: trade.type === 'buy' ? t.positive : t.negative,
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px',
                              }}>
                                {trade.type}
                              </span>
                            </td>
                            <td style={{ padding: '10px 16px', color: t.textSecondary, fontFamily: 'monospace', fontSize: '12px' }}>
                              {trade.wallet ? `${trade.wallet.slice(0, 6)}…${trade.wallet.slice(-4)}` : '—'}
                            </td>
                            <td style={{ padding: '10px 16px', color: t.textPrimary, fontWeight: 500 }}>
                              {trade.amount.toLocaleString()}
                            </td>
                            <td style={{ padding: '10px 16px', color: t.textPrimary, fontWeight: 500 }}>
                              {trade.aptValue.toFixed(4)} APT
                            </td>
                            <td style={{ padding: '10px 16px', color: t.textMuted, fontSize: '12px' }}>
                              {timeAgo(trade.timestampMs)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                )}

                {/* ── TOP HOLDERS TAB ───────────────────────────────── */}
                {activeInsightTab === 'holders' && (() => {
                  // Aggregate total tokens bought per wallet from recentTrades
                  const holderMap = new Map<string, number>();
                  for (const t2 of recentTrades) {
                    if (t2.type === 'buy' && t2.wallet) {
                      holderMap.set(t2.wallet, (holderMap.get(t2.wallet) ?? 0) + t2.amount);
                    }
                  }
                  const sorted = Array.from(holderMap.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 20);
                  return (
                    <div style={{
                      border: `1px solid ${t.border}`,
                      borderTop: 'none',
                      borderBottomLeftRadius: '12px',
                      borderBottomRightRadius: '12px',
                      overflow: 'hidden',
                    }}>
                      {sorted.length === 0 ? (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: t.textMuted, fontSize: '14px' }}>
                          No holder data yet.
                        </div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: t.bgSecondary, borderBottom: `1px solid ${t.border}` }}>
                              {['Rank', 'Wallet', 'Tokens Bought', '% of Supply'].map(h => (
                                <th key={h} style={{
                                  padding: '10px 16px',
                                  textAlign: 'left',
                                  fontWeight: 600,
                                  fontSize: '11px',
                                  color: t.textMuted,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sorted.map(([wallet, amount], i) => (
                              <tr key={wallet} style={{ borderBottom: `1px solid ${t.border}`, background: i % 2 === 0 ? 'transparent' : t.bgSecondary }}>
                                <td style={{ padding: '10px 16px', color: t.textMuted, fontWeight: 600 }}>#{i + 1}</td>
                                <td style={{ padding: '10px 16px', color: t.textSecondary, fontFamily: 'monospace', fontSize: '12px' }}>
                                  {`${wallet.slice(0, 8)}…${wallet.slice(-6)}`}
                                </td>
                                <td style={{ padding: '10px 16px', color: t.textPrimary, fontWeight: 500 }}>
                                  {amount.toLocaleString()}
                                </td>
                                <td style={{ padding: '10px 16px', color: t.textMuted }}>
                                  {((amount / 1_000_000_000) * 100).toFixed(3)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })()}

              </div>
            </div>

            {/* Trading Panel */}
            <div style={{
              width: '400px',
              background: t.bgPrimary,
              borderLeft: `1px solid ${t.border}`,
              padding: '20px',
              flexShrink: 0,
              position: 'sticky',
              top: 0,
              alignSelf: 'flex-start',
              maxHeight: '100vh',
              overflowY: 'auto'
            }}>
              <div style={{
                background: t.bgSecondary,
                borderRadius: '12px',
                padding: '20px',
                border: `1px solid ${t.border}`,
                height: '100%'
              }}>
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: t.textPrimary,
                    marginBottom: '8px'
                  }}>
                    Your Balance
                  </h3>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#00d4aa'
                  }}>
                    {tokenDetails?.metadataAddress ? getTokenBalance(tokenDetails.metadataAddress) : '0.000'}
                  </div>
                </div>

                <ul style={{
                  display: 'flex',
                  background: t.bgPrimary,
                  borderRadius: '8px',
                  padding: '4px',
                  marginBottom: '20px',
                  listStyle: 'none',
                  border: `1px solid ${t.border}`,
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
                      background: activeTab === 'buy' ? t.positive : 'transparent',
                      color: activeTab === 'buy' ? 'white' : t.textSecondary,
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
                      background: activeTab === 'sell' ? t.negative : 'transparent',
                      color: activeTab === 'sell' ? 'white' : t.textSecondary,
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
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmountString(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: `1px solid ${t.border}`,
                      borderRadius: '8px',
                      fontSize: '16px',
                      background: t.bgPrimary,
                      color: t.textPrimary,
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
                      color: t.textSecondary,
                    }}
                  />
                </div>

                {/* Slippage Protection Section */}
                <div style={{
                  margin: '20px 0',
                  padding: '15px',
                  background: t.bgPrimary,
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
                      color: t.textPrimary,
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
                            border: `1px solid ${selectedSlippage === slippage ? t.accent : t.border}`,
                            background: selectedSlippage === slippage ? t.accent : t.bgSecondary,
                            color: selectedSlippage === slippage ? '#ffffff' : t.textSecondary,
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
                          background: t.bgSecondary,
                          color: t.textPrimary,
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
                      color: t.negative,
                      marginTop: '8px',
                      display: parseFloat(selectedSlippage) > 5.0 ? 'block' : 'none'
                    }}>
                      High slippage may result in unfavorable trade execution
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleTrade}
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    background: '#00d4aa',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {activeTab === 'buy' ? 'Buy' : 'Sell'}
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            background: t.bgPrimary,
            borderTop: `1px solid ${t.border}`,
            padding: '16px 24px',
            width: '100%',
            flexShrink: 0
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', gap: '20px' }}>
                {['Careers', 'Privacy & Legal', 'Docs', 'Accessibility'].map(label => (
                  <a key={label} href="#" style={{
                    color: t.textMuted,
                    textDecoration: 'none',
                    fontSize: '13px',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = t.textSecondary)}
                  onMouseLeave={e => (e.currentTarget.style.color = t.textMuted)}
                  >
                    {label}
                  </a>
                ))}
              </div>
              <p style={{ fontSize: '13px', color: t.textMuted, margin: 0 }}>
                &copy; 2025 MoveMint
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenPage;