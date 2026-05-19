import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import PageShell from './PageShell';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network, UserTransactionResponse } from "@aptos-labs/ts-sdk";
import { InputTransactionData } from "@aptos-labs/wallet-adapter-core";
import { createChart, IChartApi, ISeriesApi, Time, ColorType } from "lightweight-charts";

import { MODULE_ADDRESS } from "../config";
import { useTokenData } from '../hooks/useTokenData';
import { useBalanceContext } from '../contexts/BalanceContext';
import { useWatchlist } from '../contexts/WatchlistContext';
import { useOHLCData, Timeframe } from '../hooks/useOHLCData';
import { priceAtAPT, BONDING_CURVE } from '../lib/bondingCurve';
import { useTheme } from '../contexts/ThemeContext';
import { useAptPrice } from '../contexts/AptPriceContext';
import { useTokenLive } from '../data/useTokenLive';
import { useQueryClient } from '@tanstack/react-query';
import { truncateAddress } from '../utils/format';
import { useToast } from '../contexts/ToastContext';
import { getLocalSocials } from '../lib/localSocials';

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
  const toast = useToast();
  const explorerTxLink = (hash: string) => ({
    label: 'View on explorer',
    href: `https://explorer.aptoslabs.com/txn/${hash}?network=testnet`,
  });

  const [copied, setCopied] = useState(false);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [slippage, setSlippage] = useState<number>(100); // Default 1% (100 bps)
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [showSlippageInput, setShowSlippageInput] = useState<boolean>(false);

  // Keep the existing UI state from NEWtokenpage
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [amountString, setAmountString] = useState('1');
  const [inputMode, setInputMode] = useState<'tokens' | 'apt'>('tokens');
  const [total, setTotal] = useState('0');
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
    telegram?: string | null;
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

  const [linkCopied, setLinkCopied] = useState(false);
  const handleShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
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
        const cachedSocials = getLocalSocials(stateData.metadataAddress || stateData.txHash || coinHash);
        const tokenDetailsData: TokenDetails = {
          name: stateData.name || 'Unknown',
          symbol: stateData.symbol || 'UNK',
          supply: stateData.supply || 0,
          txHash: stateData.txHash || coinHash,
          metadataAddress: stateData.metadataAddress || stateData.txHash || coinHash,
          creatorAddress: stateData.creatorAddress || stateData.creator || '',
          creationDate: stateData.creationDate || Math.floor(Date.now() / 1000),
          description: stateData.description ?? cachedSocials?.description,
          twitterLink: stateData.twitterLink ?? cachedSocials?.twitterLink ?? null,
          websiteLink: stateData.websiteLink ?? cachedSocials?.websiteLink ?? null,
          telegram: stateData.telegram ?? cachedSocials?.telegram ?? null,
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
        
        const cachedSocials = getLocalSocials(token.metadataAddress || token.txHash);
        const tokenDetailsData: TokenDetails = {
          name: token.name,
          symbol: token.symbol,
          supply: token.supply,
          txHash: token.txHash,
          metadataAddress: token.metadataAddress || token.txHash || '',
          creatorAddress: token.creatorAddress || token.creator || '',
          creationDate: new Date(token.launchDate).getTime() / 1000,
          description: cachedSocials?.description,
          twitterLink: cachedSocials?.twitterLink ?? null,
          websiteLink: cachedSocials?.websiteLink ?? null,
          telegram: cachedSocials?.telegram ?? null,
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
      toast.warning("Can't buy yet", "Connect a wallet and enter a valid amount.");
      return;
    }

    // Validate that we're buying at least 1 whole token (contract doesn't support fractional tokens)
    const tokenAmount = Math.floor(amount);
    if (tokenAmount < 1) {
      toast.warning('Minimum is 1 token', `You entered ${amount} — round up to at least 1 whole token.`);
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
      
      toast.success(`Bought ${tokenAmount} ${tokenDetails.symbol}`, undefined, explorerTxLink(response.hash));

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
        toast.error('Transaction rejected', 'The wallet declined the transaction. Wallet simulations sometimes fail on fungible assets — you can still approve through the warning.');
      } else if (error.message?.includes('Insufficient balance') || error.message?.includes('insufficient balance')) {
        toast.error('Wallet simulation error', 'The wallet cannot verify FA transactions during simulation. Try approving anyway, or refresh and retry.');
      } else if (error.errorCode === '1012' || error.message?.includes('1012')) {
        const currentSlippage = slippage / 100;
        const suggestedSlippage = Math.min(currentSlippage * 1.5, 10);
        toast.error('Slippage exceeded', `${currentSlippage}% was too tight. Try ${suggestedSlippage}% or reduce trade size.`);
      } else if (error.errorCode === '1017' || error.message?.includes('1017')) {
        toast.error('Invalid slippage', 'Use a value between 0.1% and 10%.');
      } else {
        toast.error('Buy failed', error.message || 'Unknown error. Check the console for details.');
      }
    }
  };
  
  const handleSell = async () => {
    if (!account || amount <= 0 || !tokenDetails?.creatorAddress || !tokenDetails?.symbol) {
      toast.warning("Can't sell yet", "Connect a wallet and enter a valid amount.");
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
      toast.error('Not enough tokens', `You hold ${currentTokenBalance.toFixed(2)} ${tokenDetails.symbol} — can't sell ${amount.toFixed(2)}.`);
      return;
    }

    // Validate that we're selling at least 1 whole token (contract doesn't support fractional tokens)
    const tokenAmount = Math.floor(amount);
    if (tokenAmount < 1) {
      toast.warning('Minimum is 1 token', `You entered ${amount} — round up to at least 1 whole token.`);
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
      
      toast.success(`Sold ${tokenAmount} ${tokenDetails.symbol}`, undefined, explorerTxLink(response.hash));

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
        toast.error('Transaction rejected', 'The wallet declined the transaction. FA simulation warnings can be approved through if your balance is sufficient.');
      } else if (error.message?.includes('Insufficient balance') || error.message?.includes('insufficient balance')) {
        toast.error('Wallet simulation error', `Your balance shows ${currentTokenBalance.toFixed(2)} ${tokenDetails.symbol}. Try approving anyway or reconnect the wallet.`);
      } else if (error.errorCode === '1012' || error.message?.includes('1012')) {
        const currentSlippage = slippage / 100;
        const suggestedSlippage = Math.min(currentSlippage * 1.5, 10);
        toast.error('Slippage exceeded', `${currentSlippage}% was too tight. Try ${suggestedSlippage}% or reduce trade size.`);
      } else if (error.errorCode === '1017' || error.message?.includes('1017')) {
        toast.error('Invalid slippage', 'Use a value between 0.1% and 10%.');
      } else {
        toast.error('Sell failed', error.message || 'Unknown error. Check the console for details.');
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
  

  // calculateTotal is defined further down; its tokensSold param is passed at call-site.

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
    if (percentage.startsWith('+')) return t.accent; // Green for positive
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





  // Function to calculate total cost/return based on amount and current price.
  // tokensSold is passed explicitly so this function can be defined before tokenData.
  const calculateTotal = (amount: number, tokensSold: number = 0) => {
    if (!amount || amount <= 0) return 0;

    const total_supply = 800_000_000;
    const tokens_sold_before = tokensSold;
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

  // Invert the bonding curve: find token count whose cost ≈ aptInput.
  const calculateTokensFromAPT = (aptInput: number, tokensSold: number = 0): number => {
    if (!aptInput || aptInput <= 0) return 0;
    const remaining = 800_000_000 - tokensSold;
    if (remaining <= 1) return 0;
    let low = 0;
    let high = remaining - 1;
    const maxCost = parseFloat(String(calculateTotal(high, tokensSold)));
    if (aptInput >= maxCost) return Math.floor(high);
    for (let i = 0; i < 60; i++) {
      const mid = (low + high) / 2;
      const cost = parseFloat(String(calculateTotal(mid, tokensSold)));
      if (aptInput > 0 && Math.abs(cost - aptInput) / aptInput < 0.0001) {
        return Math.floor(mid);
      }
      if (cost < aptInput) low = mid; else high = mid;
      if (high - low < 0.5) break;
    }
    return Math.floor((low + high) / 2);
  };

  // Recompute amount + total whenever the user input, mode, or curve state changes.
  useEffect(() => {
    const num = parseFloat(amountString);
    if (isNaN(num) || num <= 0) {
      setAmount(0);
      setTotal('0');
      setPriceImpact(0);
      return;
    }
    const tokensSold = tokenData?.tokensSold ?? 0;
    let tokens: number;
    if (inputMode === 'tokens') {
      tokens = num;
      setAmount(num);
      setTotal(String(calculateTotal(num, tokensSold)));
    } else {
      tokens = calculateTokensFromAPT(num, tokensSold);
      setAmount(tokens);
      setTotal(String(tokens));
    }
    const tokensSoldAfter = activeTab === 'buy'
      ? tokensSold + tokens
      : Math.max(0, tokensSold - tokens);
    const priceBefore = priceAtAPT(tokensSold);
    const priceAfter = priceAtAPT(tokensSoldAfter);
    if (priceBefore > 0 && tokens > 0) {
      const impact = Math.abs(priceAfter - priceBefore) / priceBefore * 100;
      setPriceImpact(impact);
    } else {
      setPriceImpact(0);
    }
  }, [amountString, inputMode, activeTab, tokenData?.tokensSold]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwapInputMode = () => {
    setAmountString(total);
    setInputMode(m => m === 'tokens' ? 'apt' : 'tokens');
  };

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
      upColor: t.accent,
      downColor: t.negative,
      borderUpColor: t.accent,
      borderDownColor: t.negative,
      wickUpColor: t.accent,
      wickDownColor: t.negative,
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
      color: t.accent,
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
      color: c.close >= c.open ? t.accent + '44' : t.negative + '44',
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

  // Show a "just launched" banner when navigated here directly from the launch page
  const justLaunched = !!(location.state as any)?.creationDate &&
    Date.now() - ((location.state as any).creationDate * 1000 || 0) < 5 * 60_000;


  const symbolWithDollar = (s: string) => (s.startsWith('$') ? s : `$${s}`);

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .tp-page { width: 100%; min-height: 100vh; background: var(--bg-primary); }

        /* ── BANNER ── */
        .tp-banner {
          background: linear-gradient(90deg, var(--accent), var(--accent-hover));
          color: #fff; text-align: center;
          padding: 10px 20px; font-size: 13px; font-weight: 600;
          letter-spacing: 0.02em;
        }

        /* ── MAIN ── */
        .tp-main { padding: 32px 40px 80px; }

        /* ── TOKEN HEADER ── */
        .tp-token-head {
          display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
          margin-bottom: 28px; padding-bottom: 24px;
          border-bottom: 1px solid var(--border);
        }
        .tp-token-identity { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
        .tp-token-avatar {
          width: 48px; height: 48px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; font-weight: 800; color: #fff; flex-shrink: 0;
          object-fit: cover;
        }
        .tp-token-label { min-width: 0; }
        .tp-token-name-row { display: flex; align-items: center; gap: 8px; }
        .tp-token-name {
          font-size: 22px; font-weight: 800; color: var(--text-primary);
          letter-spacing: -0.025em; line-height: 1.1;
        }
        .tp-watch-star {
          background: transparent; border: 0; cursor: pointer;
          font-size: 20px; line-height: 1; padding: 2px 4px;
          color: var(--text-muted); font-family: inherit;
          transition: color 0.15s, transform 0.1s;
        }
        .tp-watch-star:hover { color: var(--text-primary); transform: scale(1.1); }
        .tp-watch-star.on { color: #f5c518; }
        .tp-token-sym { font-size: 13px; color: var(--text-muted); font-weight: 600; margin-top: 2px; }

        .tp-price-block { display: flex; align-items: baseline; gap: 10px; }
        .tp-price {
          font-size: 28px; font-weight: 800; color: var(--text-primary);
          letter-spacing: -0.03em; font-variant-numeric: tabular-nums;
        }
        .tp-change {
          font-size: 14px; font-weight: 700;
          padding: 4px 9px; border-radius: 7px;
        }

        .tp-head-stats { display: flex; gap: 28px; flex-wrap: wrap; }
        .tp-head-stat-label {
          font-size: 10.5px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 3px;
        }
        .tp-head-stat-value {
          font-size: 14px; font-weight: 700; color: var(--text-primary);
          font-variant-numeric: tabular-nums;
        }

        .tp-boost-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 9px 14px; border-radius: 10px;
          background: var(--boost); border: 1.5px solid var(--boost);
          font-size: 13px; font-weight: 700; color: #fff;
          text-decoration: none; flex-shrink: 0; margin-left: auto;
          box-shadow: 0 2px 10px rgba(234,88,12,0.3);
          transition: background 0.15s, border-color 0.15s, transform 0.05s;
        }
        .tp-boost-btn:hover { background: var(--boost-hover); border-color: var(--boost-hover); transform: translateY(-1px); }
        .tp-share-btn {
          padding: 9px 12px; border-radius: 10px;
          background: var(--bg-secondary); border: 1.5px solid var(--border);
          font-size: 13px; font-weight: 600; color: var(--text-primary);
          cursor: pointer; font-family: inherit; flex-shrink: 0;
          transition: background 0.12s, border-color 0.12s;
        }
        .tp-share-btn:hover { background: var(--bg-hover); border-color: var(--text-muted); }
        .tp-star-btn {
          background: var(--bg-secondary);
          border: 1.5px solid var(--border); border-radius: 10px;
          width: 40px; height: 40px; font-size: 18px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: color 0.15s, border-color 0.15s; flex-shrink: 0;
          color: var(--text-muted);
        }
        .tp-star-btn.starred { color: #f5c518; border-color: #f5c518; }
        .tp-star-btn:hover { border-color: var(--text-muted); }

        /* ── TWO-COLUMN LAYOUT ── */
        .tp-layout {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 20px; align-items: start;
        }

        /* ── CHART AREA ── */
        .tp-chart-controls {
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px; margin-bottom: 14px; flex-wrap: wrap;
        }
        .tp-tf-group, .tp-mode-group { display: flex; gap: 4px; }
        .tp-tf-btn, .tp-mode-btn {
          padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border);
          background: var(--bg-secondary); color: var(--text-secondary);
          font-size: 12.5px; font-weight: 600; cursor: pointer;
          font-family: inherit; transition: all 0.12s;
        }
        .tp-tf-btn:hover, .tp-mode-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .tp-tf-btn.active, .tp-mode-btn.active {
          background: var(--accent); color: #fff; border-color: var(--accent);
        }

        .tp-chart-card {
          background: var(--bg-primary); border: 1px solid var(--border);
          border-radius: 16px; overflow: hidden; position: relative;
          box-shadow: 0 1px 4px rgba(0,0,0,${isDark ? '0.3' : '0.05'});
        }
        .tp-chart-inner { height: 500px; width: 100%; }
        .tp-chart-overlay {
          position: absolute; inset: 0; display: flex;
          align-items: center; justify-content: center;
          font-size: 14px; color: var(--text-muted); pointer-events: none;
          background: var(--bg-primary);
        }

        /* ── INFO TABS ── */
        .tp-tabs {
          display: flex; gap: 0; margin-top: 20px;
          border-bottom: 1px solid var(--border);
        }
        .tp-tab {
          padding: 10px 20px; font-size: 14px; font-weight: 600;
          color: var(--text-muted); background: none; border: none; cursor: pointer;
          border-bottom: 2.5px solid transparent; margin-bottom: -1px;
          font-family: inherit; transition: color 0.15s, border-color 0.15s;
        }
        .tp-tab:hover { color: var(--text-primary); }
        .tp-tab.active { color: var(--text-primary); border-bottom-color: var(--accent); }

        .tp-tab-panel { padding: 20px 0; }

        /* Graduation progress */
        .tp-grad-card {
          background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: 14px; padding: 18px 20px; margin-bottom: 14px;
        }
        .tp-grad-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 12px; margin-bottom: 12px;
        }
        .tp-grad-title {
          font-size: 13px; font-weight: 700; color: var(--text-primary);
          margin-bottom: 4px;
        }
        .tp-grad-sub {
          font-size: 12.5px; color: var(--text-muted); font-weight: 500;
        }
        .tp-grad-pct {
          font-size: 22px; font-weight: 800; color: var(--accent);
          font-variant-numeric: tabular-nums; letter-spacing: -0.02em;
        }
        .tp-grad-bar {
          height: 10px; border-radius: 999px;
          background: var(--bg-tertiary); overflow: hidden;
        }
        .tp-grad-bar-fill {
          height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-hover));
          border-radius: 999px; transition: width 0.4s ease;
        }
        .tp-grad-meta {
          display: flex; justify-content: space-between;
          font-size: 12px; color: var(--text-muted);
          font-variant-numeric: tabular-nums; margin-top: 8px; font-weight: 500;
        }

        /* Insights grid */
        .tp-insight-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;
        }
        .tp-insight-card {
          background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: 12px; padding: 16px;
        }
        .tp-insight-label {
          font-size: 10.5px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 8px;
        }
        .tp-insight-value {
          font-size: 18px; font-weight: 700; color: var(--text-primary);
          font-variant-numeric: tabular-nums;
        }

        /* Transactions table */
        .tp-tx-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .tp-tx-table thead tr { border-bottom: 1px solid var(--border); }
        .tp-tx-th {
          padding: 8px 10px; font-size: 11px; font-weight: 700;
          color: var(--text-muted); text-transform: uppercase;
          letter-spacing: 0.06em; text-align: left;
        }
        .tp-tx-table tbody tr { border-bottom: 1px solid var(--border); transition: background 0.1s; }
        .tp-tx-table tbody tr:last-child { border-bottom: none; }
        .tp-tx-table tbody tr:hover { background: var(--bg-hover); }
        .tp-tx-td { padding: 10px 10px; vertical-align: middle; font-variant-numeric: tabular-nums; }
        .tp-tx-you {
          font-size: 10px; font-weight: 700; background: var(--accent);
          color: #fff; padding: 2px 7px; border-radius: 5px; margin-left: 6px;
        }

        /* ── TRADING PANEL ── */
        .tp-right { display: flex; flex-direction: column; gap: 14px; }

        .tp-trade-card {
          background: var(--bg-primary); border: 1px solid var(--border);
          border-radius: 18px; padding: 20px;
          box-shadow: 0 4px 14px rgba(0,0,0,${isDark ? '0.35' : '0.07'});
        }
        .tp-trade-tabs {
          display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 18px;
        }
        .tp-trade-tab {
          padding: 11px; border-radius: 11px; font-size: 15px; font-weight: 700;
          cursor: pointer; border: 1.5px solid var(--border);
          background: var(--bg-secondary); color: var(--text-secondary);
          font-family: inherit; transition: all 0.15s;
        }
        .tp-trade-tab:hover { background: var(--bg-hover); color: var(--text-primary); }
        .tp-trade-tab.buy-active {
          background: var(--accent); color: #fff; border-color: var(--accent);
          box-shadow: 0 3px 12px rgba(5,150,105,0.3);
        }
        .tp-trade-tab.sell-active {
          background: var(--negative); color: #fff; border-color: var(--negative);
        }

        .tp-balance {
          font-size: 12.5px; color: var(--text-muted); font-weight: 600;
          margin-bottom: 14px; padding: 10px 14px;
          background: var(--bg-secondary); border-radius: 10px;
        }
        .tp-balance strong { color: var(--text-primary); }

        .tp-field { margin-bottom: 12px; }
        .tp-field-label {
          font-size: 11px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 7px;
          display: block;
        }
        .tp-input {
          width: 100%; background: var(--bg-secondary); border: 1.5px solid var(--border);
          border-radius: 11px; padding: 12px 14px; font-size: 16px;
          color: var(--text-primary); outline: none; font-family: inherit;
          transition: border-color 0.15s, box-shadow 0.15s; font-variant-numeric: tabular-nums;
        }
        .tp-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
        .tp-input::placeholder { color: var(--text-muted); }
        .tp-total-val {
          width: 100%; padding: 12px 14px; font-size: 16px;
          font-weight: 600; color: var(--text-primary);
          background: var(--bg-secondary); border-radius: 11px;
          font-variant-numeric: tabular-nums;
        }
        .tp-presets {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 8px;
        }
        .tp-preset-btn {
          padding: 8px 0; border-radius: 9px;
          font-size: 12.5px; font-weight: 600;
          background: var(--bg-secondary); border: 1.5px solid var(--border);
          color: var(--text-secondary); cursor: pointer;
          font-family: inherit; transition: all 0.12s;
          font-variant-numeric: tabular-nums;
        }
        .tp-preset-btn:hover { background: var(--bg-hover); color: var(--text-primary); border-color: var(--accent); }
        .tp-swap-row {
          display: flex; justify-content: center; margin: 2px 0 -4px;
        }
        .tp-swap-btn {
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--bg-secondary); border: 1.5px solid var(--border);
          color: var(--text-secondary); font-size: 14px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-family: inherit;
          transition: background 0.12s, color 0.12s, border-color 0.12s, transform 0.12s;
        }
        .tp-swap-btn:hover {
          background: var(--bg-hover); color: var(--text-primary);
          border-color: var(--accent); transform: rotate(180deg);
        }

        .tp-slippage-header {
          display: flex; align-items: center; justify-content: space-between;
          margin: 14px 0 0;
        }
        .tp-slippage-label {
          font-size: 11px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.07em;
        }
        .tp-slippage-toggle {
          background: none; border: none; cursor: pointer;
          font-size: 13px; font-weight: 600; color: var(--accent);
          font-family: inherit; padding: 0;
        }
        .tp-slippage-options {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 10px;
        }
        .tp-slip-btn {
          padding: 8px; border-radius: 9px; font-size: 12.5px; font-weight: 600;
          cursor: pointer; border: 1.5px solid var(--border);
          background: var(--bg-secondary); color: var(--text-secondary);
          font-family: inherit; transition: all 0.12s;
        }
        .tp-slip-btn:hover { background: var(--bg-hover); }
        .tp-slip-btn.active { border-color: var(--accent); background: var(--accent-light); color: var(--accent); }

        .tp-impact-warn {
          margin-top: 12px; padding: 10px 12px; border-radius: 10px;
          font-size: 12.5px; font-weight: 600;
        }

        .tp-trade-action {
          width: 100%; padding: 14px; border-radius: 12px;
          font-size: 16px; font-weight: 700; cursor: pointer;
          border: none; font-family: inherit; margin-top: 14px;
          transition: filter 0.15s, transform 0.1s;
        }
        .tp-trade-action:active { transform: scale(0.98); }
        .tp-trade-action.buy { background: var(--accent); color: #fff; box-shadow: 0 4px 16px rgba(5,150,105,0.3); }
        .tp-trade-action.buy:hover { filter: brightness(1.06); }
        .tp-trade-action.sell { background: var(--negative); color: #fff; }
        .tp-trade-action.sell:hover { filter: brightness(0.92); }
        .tp-trade-action.disabled { background: var(--bg-secondary); color: var(--text-muted); cursor: not-allowed; }

        /* ── TOKEN INFO CARD ── */
        .tp-info-card {
          background: var(--bg-primary); border: 1px solid var(--border);
          border-radius: 16px; padding: 18px;
        }
        .tp-info-title {
          font-size: 12px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 14px;
        }
        .tp-info-row {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--border);
          font-size: 13px;
        }
        .tp-info-row:last-child { border-bottom: none; }
        .tp-info-key { color: var(--text-muted); font-weight: 600; flex-shrink: 0; }
        .tp-info-val { color: var(--text-primary); font-weight: 600; text-align: right; min-width: 0; }
        .tp-info-desc {
          color: var(--text-secondary); font-size: 13px; line-height: 1.5;
          padding: 4px 0 14px; margin-bottom: 4px;
          border-bottom: 1px solid var(--border); white-space: pre-wrap;
          word-break: break-word;
        }
        .tp-ca-row { display: flex; align-items: center; gap: 8px; }
        .tp-ca-code {
          font-family: 'SF Mono', ui-monospace, monospace;
          font-size: 12px; color: var(--text-secondary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .tp-copy-btn {
          background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: 7px; padding: 4px 10px; font-size: 11px;
          font-weight: 700; cursor: pointer; color: var(--text-secondary);
          font-family: inherit; transition: background 0.12s, color 0.12s; flex-shrink: 0;
        }
        .tp-copy-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .tp-copy-btn.copied { color: var(--accent); border-color: var(--accent); }

        /* ── RESPONSIVE ── */
        @media (max-width: 1000px) {
          .tp-layout { grid-template-columns: 1fr; }
          .tp-right { order: -1; }
        }
        @media (max-width: 700px) {
          .tp-main { padding: 20px 14px 60px; }
          .tp-token-head { gap: 10px; padding-bottom: 16px; margin-bottom: 18px; }
          .tp-token-avatar { width: 40px; height: 40px; font-size: 17px; border-radius: 11px; }
          .tp-token-name { font-size: 17px; }
          .tp-token-sym { font-size: 12px; }
          .tp-price { font-size: 24px; }
          .tp-head-stats {
            display: flex; gap: 14px; width: 100%; order: 99;
            padding-top: 14px; border-top: 1px solid var(--border);
          }
          .tp-head-stat-label { font-size: 10px; }
          .tp-head-stat-value { font-size: 14px; }
          .tp-boost-btn { padding: 7px 11px; font-size: 12px; margin-left: 0; }
          .tp-share-btn { padding: 7px 10px; font-size: 12px; }
          .tp-star-btn { width: 34px; height: 34px; font-size: 16px; }
          .tp-chart-card { padding: 8px; }
          .tp-chart-inner { height: 340px; }
          .tp-insight-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
          .tp-insight-card { padding: 12px; }
          .tp-insight-value { font-size: 15px; }
          .tp-grad-pct { font-size: 18px; }
          .tp-tf-group .tp-tf-btn:nth-child(n+5) { display: none; }
          .tp-tx-th, .tp-tx-td { padding: 8px 6px; font-size: 12px; }
        }
        @media (max-width: 460px) {
          .tp-tabs { gap: 0; }
          .tp-tab { padding: 10px 8px; font-size: 13px; }
          .tp-trade-card { padding: 16px; border-radius: 14px; }
          .tp-trade-tabs { margin-bottom: 14px; }
          .tp-trade-tab { padding: 12px; font-size: 14px; }
          .tp-field { margin-bottom: 14px; }
          .tp-input { padding: 14px; font-size: 16px; }
          .tp-total-val { padding: 14px; font-size: 15px; }
          .tp-balance { padding: 12px 14px; }
          .tp-preset-btn { padding: 10px 0; font-size: 13px; }
          .tp-slip-btn { padding: 10px 0; font-size: 13px; }
          .tp-trade-action { padding: 16px; font-size: 16px; margin-top: 10px; }
          .tp-quick-grid { grid-template-columns: repeat(4, 1fr); gap: 4px; }
        }
      `}</style>

      <div className="tp-page">
        <PageShell>
        {/* ── JUST LAUNCHED BANNER ── */}
        {justLaunched && (
          <div className="tp-banner">
            Token just launched — you're early. Be the first buyer.
          </div>
        )}

        <main className="tp-main">
          {/* ── TOKEN IDENTITY HEADER ── */}
          <div className="tp-token-head">
            <div className="tp-token-identity">
              {catalogRow?.image ? (
                <img
                  src={catalogRow.image}
                  alt={tokenDetails?.symbol}
                  className="tp-token-avatar"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="tp-token-avatar" style={{ background: tokenAvatarBg }}>
                  {(tokenDetails?.symbol || '?').replace('$', '').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="tp-token-label">
                <div className="tp-token-name-row">
                  <div className="tp-token-name">{tokenDetails?.name || 'Loading…'}</div>
                  {tokenDetails && (
                    <button
                      type="button"
                      className={`tp-watch-star${currentTokenInWatchlist ? ' on' : ''}`}
                      onClick={handleStarClick}
                      title={currentTokenInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
                      aria-label="Toggle watchlist"
                    >{currentTokenInWatchlist ? '★' : '☆'}</button>
                  )}
                </div>
                <div className="tp-token-sym">{tokenDetails?.symbol ? symbolWithDollar(tokenDetails.symbol) : '—'}</div>
              </div>
            </div>

            <div>
              <div className="tp-price-block">
                <div className="tp-price">{formatCurrentPrice()}</div>
                {tokenData?.change24h != null && (
                  <span
                    className="tp-change"
                    style={{
                      color: tokenData.change24h >= 0 ? 'var(--positive)' : 'var(--negative)',
                      background: tokenData.change24h >= 0
                        ? (isDark ? 'rgba(16,185,129,0.15)' : 'rgba(5,150,105,0.10)')
                        : (isDark ? 'rgba(255,69,58,0.15)' : 'rgba(215,0,21,0.10)'),
                    }}
                  >
                    {tokenData.change24h >= 0 ? '+' : ''}{tokenData.change24h.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>

            <div className="tp-head-stats">
              <div>
                <div className="tp-head-stat-label">Market cap</div>
                <div className="tp-head-stat-value">{formatLargeNumber(tokenData?.marketCapUSD)}</div>
              </div>
              <div>
                <div className="tp-head-stat-label">APT raised</div>
                <div className="tp-head-stat-value">
                  {aptRaised ? `${(aptRaised / 1e8).toFixed(2)} APT` : '—'}
                </div>
              </div>
              <div>
                <div className="tp-head-stat-label">Holders</div>
                <div className="tp-head-stat-value">{holderCount ?? '—'}</div>
              </div>
            </div>

            {tokenDetails?.metadataAddress && (
              <Link
                to={`/boost?token=${tokenDetails.metadataAddress}`}
                className="tp-boost-btn"
                title="Boost this token on the leaderboard"
              >
                Boost
              </Link>
            )}
            <button
              className="tp-share-btn"
              onClick={handleShareLink}
              title={linkCopied ? 'Link copied' : 'Copy share link'}
            >
              {linkCopied ? '✓ Copied' : '↗ Share'}
            </button>
            <button
              className={`tp-star-btn${currentTokenInWatchlist ? ' starred' : ''}`}
              onClick={handleStarClick}
              title={currentTokenInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              {currentTokenInWatchlist ? '★' : '☆'}
            </button>
          </div>

          {/* ── TWO-COLUMN LAYOUT ── */}
          <div className="tp-layout">
            {/* ── LEFT: Chart + Tabs ── */}
            <div className="tp-left">
              {/* Chart controls */}
              <div className="tp-chart-controls">
                <div className="tp-tf-group">
                  {(['1m','15m','1H','4H','1D','ALL'] as Timeframe[]).map(tf => (
                    <button
                      key={tf}
                      className={`tp-tf-btn${timeframe === tf ? ' active' : ''}`}
                      onClick={() => setTimeframe(tf)}
                    >{tf}</button>
                  ))}
                </div>
                <div className="tp-mode-group">
                  {(['mcap','usd','apt'] as ChartMode[]).map(mode => (
                    <button
                      key={mode}
                      className={`tp-mode-btn${chartMode === mode ? ' active' : ''}`}
                      onClick={() => setChartMode(mode)}
                    >{mode === 'mcap' ? 'MCap' : mode.toUpperCase()}</button>
                  ))}
                </div>
              </div>

              {/* Chart */}
              <div className="tp-chart-card">
                <div ref={chartContainerRef} className="tp-chart-inner" />
                {chartLoading && displayCandles.length === 0 && (
                  <div className="tp-chart-overlay">Loading chart…</div>
                )}
                {!chartLoading && displayCandles.length === 0 && (
                  <div className="tp-chart-overlay">No trades yet — be the first to buy</div>
                )}
              </div>

              {/* Tabs */}
              <div className="tp-tabs">
                {(['insights','transactions','holders'] as const).map(tab => (
                  <button
                    key={tab}
                    className={`tp-tab${activeInsightTab === tab ? ' active' : ''}`}
                    onClick={() => setActiveInsightTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              <div className="tp-tab-panel">
                {/* ── INSIGHTS ── */}
                {activeInsightTab === 'insights' && (() => {
                  const aptRaisedNum = aptRaised ? aptRaised / 1e8 : 0;
                  const gradPct = Math.min(100, (aptRaisedNum / BONDING_CURVE.GRADUATION_APT) * 100);
                  const aptToGo = Math.max(0, BONDING_CURVE.GRADUATION_APT - aptRaisedNum);
                  const tokensSold = tokenData?.tokensSold ?? 0;
                  const curvePct = Math.min(100, (tokensSold / BONDING_CURVE.MAX_TOKENS) * 100);
                  return (
                  <>
                  <div className="tp-grad-card">
                    <div className="tp-grad-header">
                      <div>
                        <div className="tp-grad-title">Graduation progress</div>
                        <div className="tp-grad-sub">
                          {gradPct >= 100
                            ? 'Graduated · all supply unlocked'
                            : `${aptToGo.toFixed(2)} APT until this token graduates`}
                        </div>
                      </div>
                      <div className="tp-grad-pct">{gradPct.toFixed(1)}%</div>
                    </div>
                    <div className="tp-grad-bar">
                      <div className="tp-grad-bar-fill" style={{ width: `${gradPct}%` }} />
                    </div>
                    <div className="tp-grad-meta">
                      <span>{aptRaisedNum.toFixed(2)} APT raised</span>
                      <span>{BONDING_CURVE.GRADUATION_APT} APT target</span>
                    </div>
                  </div>

                  <div className="tp-insight-grid">
                    <div className="tp-insight-card">
                      <div className="tp-insight-label">Price (USD)</div>
                      <div className="tp-insight-value">{formatPrice(tokenData?.priceUSD)}</div>
                    </div>
                    <div className="tp-insight-card">
                      <div className="tp-insight-label">Price (APT)</div>
                      <div className="tp-insight-value">{formatApt(tokenData?.price)}</div>
                    </div>
                    <div className="tp-insight-card">
                      <div className="tp-insight-label">Market cap</div>
                      <div className="tp-insight-value">{formatLargeNumber(tokenData?.marketCapUSD)}</div>
                    </div>
                    <div className="tp-insight-card">
                      <div className="tp-insight-label">Holders</div>
                      <div className="tp-insight-value">{holderCount ?? '—'}</div>
                    </div>
                    <div className="tp-insight-card">
                      <div className="tp-insight-label">24h change</div>
                      <div
                        className="tp-insight-value"
                        style={{ color: (tokenData?.change24h ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)' }}
                      >
                        {tokenData?.change24h != null ? `${tokenData.change24h >= 0 ? '+' : ''}${tokenData.change24h.toFixed(2)}%` : '—'}
                      </div>
                    </div>
                    <div className="tp-insight-card">
                      <div className="tp-insight-label">Curve sold</div>
                      <div className="tp-insight-value">{curvePct.toFixed(2)}%</div>
                    </div>
                    <div className="tp-insight-card">
                      <div className="tp-insight-label">Tokens sold</div>
                      <div className="tp-insight-value">{formatLargeNumber(tokensSold)}</div>
                    </div>
                    <div className="tp-insight-card">
                      <div className="tp-insight-label">Total supply</div>
                      <div className="tp-insight-value">{formatLargeNumber(BONDING_CURVE.TOTAL_SUPPLY)}</div>
                    </div>
                  </div>
                  </>
                  );
                })()}

                {/* ── TRANSACTIONS ── */}
                {activeInsightTab === 'transactions' && (
                  recentTrades.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
                      No trades yet — be the first buyer
                    </div>
                  ) : (
                    <table className="tp-tx-table">
                      <thead>
                        <tr>
                          <th className="tp-tx-th">Type</th>
                          <th className="tp-tx-th">Amount</th>
                          <th className="tp-tx-th">APT</th>
                          <th className="tp-tx-th">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentTrades.slice(0, 50).map((trade, i) => {
                          const isBuy = trade.type === 'buy';
                          const isYou = trade.wallet?.toLowerCase() === account?.address?.toString().toLowerCase();
                          // Contract events store pre-fee curve value. Adjust to show what
                          // the user actually paid (buys: +1% fee) or received (sells: -1% fee).
                          const adjustedApt = isBuy
                            ? trade.aptValue * 1.01
                            : trade.aptValue * 0.99;
                          return (
                            <tr key={i}>
                              <td className="tp-tx-td" style={{ color: isBuy ? 'var(--positive)' : 'var(--negative)', fontWeight: 700 }}>
                                {isBuy ? 'Buy' : 'Sell'}
                                {isYou && <span className="tp-tx-you">YOU</span>}
                              </td>
                              <td className="tp-tx-td">{Number(trade.amount).toLocaleString()}</td>
                              <td className="tp-tx-td">{adjustedApt.toFixed(4)} APT</td>
                              <td className="tp-tx-td" style={{ color: 'var(--text-muted)' }}>{timeAgo(trade.timestampMs)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )
                )}

                {/* ── HOLDERS ── */}
                {activeInsightTab === 'holders' && (() => {
                  const balanceMap = new Map<string, number>();
                  for (const t of recentTrades) {
                    const w = t.wallet?.toLowerCase();
                    if (!w) continue;
                    balanceMap.set(w, (balanceMap.get(w) ?? 0) + (t.type === 'buy' ? t.amount : -t.amount));
                  }
                  const sorted = Array.from(balanceMap.entries())
                    .filter(([, bal]) => bal > 0)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 100);
                  return sorted.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
                      No holder data yet
                    </div>
                  ) : (
                    <table className="tp-tx-table">
                      <thead>
                        <tr>
                          <th className="tp-tx-th" style={{ width: 36 }}>#</th>
                          <th className="tp-tx-th">Wallet</th>
                          <th className="tp-tx-th" style={{ textAlign: 'right' }}>Tokens</th>
                          <th className="tp-tx-th" style={{ textAlign: 'right' }}>Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map(([wallet, bal], i) => {
                          const isYou = wallet === account?.address?.toString().toLowerCase();
                          const pct = ((bal / 1_000_000_000) * 100).toFixed(2);
                          return (
                            <tr key={wallet}>
                              <td className="tp-tx-td" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                              <td className="tp-tx-td" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                                {truncateAddress(wallet)}
                                {isYou && <span className="tp-tx-you">YOU</span>}
                              </td>
                              <td className="tp-tx-td" style={{ textAlign: 'right' }}>{Number(bal).toLocaleString()}</td>
                              <td className="tp-tx-td" style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{pct}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>

            {/* ── RIGHT: Trade Panel + Info ── */}
            <div className="tp-right">
              {/* Trading card */}
              <div className="tp-trade-card">
                <div className="tp-trade-tabs">
                  <button
                    className={`tp-trade-tab${activeTab === 'buy' ? ' buy-active' : ''}`}
                    onClick={() => setActiveTab('buy')}
                  >Buy</button>
                  <button
                    className={`tp-trade-tab${activeTab === 'sell' ? ' sell-active' : ''}`}
                    onClick={() => setActiveTab('sell')}
                  >Sell</button>
                </div>

                {account && (
                  <div className="tp-balance">
                    Balance: <strong>{getTokenBalance(tokenDetails?.metadataAddress || '')} {tokenDetails?.symbol?.replace('$', '') || 'tokens'}</strong>
                  </div>
                )}

                <div className="tp-field">
                  <label className="tp-field-label">
                    {inputMode === 'tokens'
                      ? `Amount (${tokenDetails?.symbol?.replace('$', '') || 'tokens'})`
                      : 'Amount (APT)'}
                  </label>
                  <input
                    type="number"
                    className="tp-input"
                    value={amountString}
                    onChange={e => setAmountString(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="any"
                  />
                  {activeTab === 'buy' && (
                    <div className="tp-presets">
                      {['0.1', '0.5', '1', '5'].map(v => (
                        <button
                          key={v}
                          type="button"
                          className="tp-preset-btn"
                          onClick={() => { setInputMode('apt'); setAmountString(v); }}
                        >{v} APT</button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="tp-swap-row">
                  <button
                    className="tp-swap-btn"
                    onClick={handleSwapInputMode}
                    title="Switch between token and APT amount"
                  >
                    ⇅
                  </button>
                </div>

                <div className="tp-field">
                  <label className="tp-field-label">
                    {inputMode === 'tokens' ? 'Total (APT)' : `You ${activeTab === 'buy' ? 'get' : 'sell'} (${tokenDetails?.symbol?.replace('$', '') || 'tokens'})`}
                  </label>
                  <div className="tp-total-val">
                    {inputMode === 'tokens'
                      ? `${total} APT`
                      : `${Math.floor(parseFloat(total) || 0).toLocaleString()}`}
                  </div>
                </div>

                {/* Slippage */}
                <div className="tp-slippage-header">
                  <span className="tp-slippage-label">Slippage protection</span>
                  <button className="tp-slippage-toggle" onClick={() => setSlippageExpanded(!slippageExpanded)}>
                    {slippage / 100}% {slippageExpanded ? '▲' : '▼'}
                  </button>
                </div>
                {slippageExpanded && (
                  <div className="tp-slippage-options">
                    {['0.5','1.0','2.0','5.0'].map(val => (
                      <button
                        key={val}
                        className={`tp-slip-btn${selectedSlippage === val ? ' active' : ''}`}
                        onClick={() => handleSlippageSelect(val)}
                      >{val}%</button>
                    ))}
                  </div>
                )}

                {/* Price impact */}
                {priceImpact >= 1 && (
                  <div
                    className="tp-impact-warn"
                    style={{
                      background: priceImpact > 15
                        ? (isDark ? 'rgba(255,69,58,0.15)' : 'rgba(215,0,21,0.08)')
                        : priceImpact > 5
                          ? (isDark ? 'rgba(255,159,10,0.15)' : 'rgba(255,159,10,0.10)')
                          : (isDark ? 'rgba(160,160,170,0.10)' : 'rgba(0,0,0,0.04)'),
                      color: priceImpact > 15
                        ? 'var(--negative)'
                        : priceImpact > 5
                          ? '#c77d00'
                          : 'var(--text-secondary)',
                    }}
                  >
                    Price impact: ~{priceImpact.toFixed(priceImpact < 0.1 ? 3 : priceImpact < 1 ? 2 : 1)}%
                    {priceImpact > 5 && ' — consider a smaller trade'}
                  </div>
                )}

                <button
                  className={`tp-trade-action${account ? (activeTab === 'buy' ? ' buy' : ' sell') : ' disabled'}`}
                  onClick={account ? handleTrade : undefined}
                >
                  {account
                    ? `${activeTab === 'buy' ? 'Buy' : 'Sell'} ${tokenDetails?.symbol?.replace('$', '') || 'tokens'}`
                    : 'Connect wallet to trade'
                  }
                </button>
              </div>

              {/* Token info card */}
              <div className="tp-info-card">
                <div className="tp-info-title">Token info</div>

                {tokenDetails?.description && (
                  <div className="tp-info-desc">{tokenDetails.description}</div>
                )}

                {tokenDetails?.metadataAddress && (
                  <div className="tp-info-row">
                    <span className="tp-info-key">Contract</span>
                    <div className="tp-ca-row">
                      <span className="tp-ca-code">{truncateAddress(tokenDetails.metadataAddress)}</span>
                      <button
                        className={`tp-copy-btn${copied ? ' copied' : ''}`}
                        onClick={handleCopyCA}
                      >{copied ? 'Copied' : 'Copy'}</button>
                    </div>
                  </div>
                )}
                {tokenDetails?.creatorAddress && (
                  <div className="tp-info-row">
                    <span className="tp-info-key">Creator</span>
                    <Link
                      to={`/profile/${tokenDetails.creatorAddress}`}
                      className="tp-info-val"
                      style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}
                    >
                      {truncateAddress(tokenDetails.creatorAddress)}
                    </Link>
                  </div>
                )}
                {tokenDetails?.creationDate && (
                  <div className="tp-info-row">
                    <span className="tp-info-key">Launched</span>
                    <span className="tp-info-val">{new Date(tokenDetails.creationDate * 1000).toLocaleDateString()}</span>
                  </div>
                )}
                {tokenDetails?.twitterLink && (
                  <div className="tp-info-row">
                    <span className="tp-info-key">Twitter</span>
                    <a href={tokenDetails.twitterLink} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                      View
                    </a>
                  </div>
                )}
                {tokenDetails?.websiteLink && (
                  <div className="tp-info-row">
                    <span className="tp-info-key">Website</span>
                    <a href={tokenDetails.websiteLink} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                      Visit
                    </a>
                  </div>
                )}
                {tokenDetails?.telegram && (
                  <div className="tp-info-row">
                    <span className="tp-info-key">Telegram</span>
                    <a href={tokenDetails.telegram} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                      Join
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
        </PageShell>
      </div>
    </>
  );
};

export default TokenPage;
