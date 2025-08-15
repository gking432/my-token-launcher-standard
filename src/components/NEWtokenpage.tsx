import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network, UserTransactionResponse } from "@aptos-labs/ts-sdk";
import { InputTransactionData } from "@aptos-labs/wallet-adapter-core";
import { createChart, IChartApi, ISeriesApi, Time } from "lightweight-charts";
import GlobalSidebar from './GlobalSidebar';
import { MODULE_ADDRESS, APTOS_API_KEY } from "../config";

console.log("API Key:", process.env.REACT_APP_APTOS_API_KEY);
// Contract addresses for different networks
const CONTRACT_ADDRESSES: Record<string, string> = {
  devnet: MODULE_ADDRESS,
  testnet: "",
  mainnet: "",
};

const TokenPage: React.FC = () => {
  const { coinHash } = useParams<{ coinHash?: string }>();
  const { account, signAndSubmitTransaction, connect, wallets, disconnect } = useWallet();
  const [tokenDetails, setTokenDetails] = useState<TokenDetails | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [timeframe, setTimeframe] = useState<string>("1m");
  const [isMounted, setIsMounted] = useState(false);
  const [refreshChart, setRefreshChart] = useState<number>(0);
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);

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
    network: Network.DEVNET,
    clientConfig: {
      HEADERS: {
        'Authorization': `Bearer ${process.env.REACT_APP_APTOS_API_KEY}`
      }
    }
  }), []);
  const client = useMemo(() => new Aptos(config), [config]);
  const tokenLauncherAddress = CONTRACT_ADDRESSES['devnet'];

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

  // Watchlist data for the sidebar
  const watchlistData = [
    { name: 'Bitcoin', symbol: 'BTC', icon: '₿', iconBg: '#f7931a' },
    { name: 'Ethereum', symbol: 'ETH', icon: 'Ξ', iconBg: '#627eea' },
    { name: 'Tether', symbol: 'USDT', icon: '₮', iconBg: '#50af95' },
    { name: 'BNB', symbol: 'BNB', icon: '◉', iconBg: '#f0b90b' }
  ];

  // Transplant the working token details fetching from TokenPage
  const fetchTokenDetails = async () => {
    if (!coinHash) return;

    try {
      let initialData: TokenDetails | undefined = location.state as TokenDetails;
      console.log("Location state:", location.state);
  
      // Use localStorage as a cache (optional)
      if (!initialData) {
        const users = JSON.parse(localStorage.getItem("users") || "{}");
        const targetAddress = account?.address ? String(account.address) : null;
        console.log("Target address:", targetAddress);
        console.log("Users from localStorage:", users);
        if (targetAddress && users[targetAddress]?.launchedTokens) {
          const storedToken = users[targetAddress].launchedTokens.find(
            (token: Token) => token.txHash === coinHash
          );
          console.log("Stored token:", storedToken);
          if (storedToken) {
            const candidateData: TokenDetails = {
              name: storedToken.name,
              symbol: storedToken.symbol,
              supply: storedToken.supply,
              txHash: storedToken.txHash,
              twitterLink: null,
              websiteLink: null,
              metadataAddress: storedToken.metadataAddress,
              creatorAddress: storedToken.creator,
              creationDate: new Date(storedToken.launchDate).getTime() / 1000,
            };
            console.log("Loaded from localStorage:", candidateData);
  
            // Validate metadataAddress
            if (candidateData.metadataAddress && candidateData.metadataAddress !== "0x0") {
              initialData = candidateData;
            } else {
              console.log("Invalid metadataAddress in localStorage, refetching...");
            }
          }
        }
      }
  
      // Fetch from blockchain if not found or invalid
      if (!initialData && coinHash) {
        console.log("Fetching transaction with coinHash:", coinHash);
        let transaction;
        try {
          transaction = await client.getTransactionByHash({ transactionHash: coinHash });
        } catch (error) {
          console.error("Failed to fetch transaction:", error);
          throw new Error("Unable to fetch transaction data");
        }
        console.log("Fetched transaction:", transaction);
  
        if (transaction.type !== "user_transaction") {
          console.error("Not a user transaction:", transaction);
          throw new Error("Invalid transaction type");
        }
  
        // Log all events to debug
        console.log("Transaction events:", transaction.events);
  
        // Look for the correct event type
        const tokenCreationEvent = transaction.events.find((event: any) =>
          event.type.includes("token_launcher::TokenCreationEvent") || event.type.includes("TokenCreated")
        );
        if (!tokenCreationEvent) {
          console.error("Token creation event not found:", transaction.events);
          throw new Error("Token creation event missing");
        }
  
        console.log("Token creation event data:", tokenCreationEvent.data);
        const creator = tokenCreationEvent.data.creator;
  
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
  
        // Handle ticker (symbol)
        let symbol = "N/A";
        const ticker = tokenCreationEvent.data.ticker;
        console.log("Raw ticker:", ticker);
        if (typeof ticker === "string" && ticker.startsWith("0x")) {
          symbol = hexToString(ticker);
        } else if (Array.isArray(ticker)) {
          symbol = String.fromCharCode(...ticker);
        }
        console.log("Parsed symbol:", symbol);
  
        // Handle name
        let name = "Unknown";
        const originalName = tokenCreationEvent.data.original_name;
        console.log("Raw original_name:", originalName);
        if (typeof originalName === "string" && originalName.startsWith("0x")) {
          name = hexToString(originalName);
        } else if (Array.isArray(originalName)) {
          name = String.fromCharCode(...originalName);
        }
        console.log("Parsed name:", name);
  
        // Handle supply
        const supply = Number(tokenCreationEvent.data.total_supply || tokenCreationEvent.data.supply || 0);
        console.log("Parsed supply:", supply);
  
        // Handle metadata address
        const metadataAddress = tokenCreationEvent.data.metadata_addr || tokenCreationEvent.data.metadata_address;
        console.log("Parsed metadataAddress:", metadataAddress);
  
        // Handle creation date
        const creationDate = Number(transaction.timestamp) / 1000000; // Convert from microseconds
        console.log("Parsed creationDate:", creationDate);
  
        initialData = {
          name: name || "Unknown Token",
          symbol: symbol || "N/A",
          supply,
          txHash: coinHash,
          metadataAddress,
          creatorAddress: creator,
          creationDate,
          twitterLink: null,
          websiteLink: null,
        };
      }
  
      if (initialData) {
        console.log("Setting token details:", initialData);
        setTokenDetails(initialData);
      } else {
        console.error("No token details found");
      }
    } catch (error) {
      console.error("Error fetching token details:", error);
    }
  };

  // Transplant the working buy/sell functions from TokenPage
  const handleBuy = async () => {
    console.log("handleBuy - account:", account, "amount:", amount, "creatorAddress:", tokenDetails?.creatorAddress, "symbol:", tokenDetails?.symbol, "slippage:", slippage);
    if (!account || amount <= 0 || !tokenDetails?.creatorAddress || !tokenDetails?.symbol) {
      alert("Connect wallet, enter a valid amount, or ensure token details are available.");
      return;
    }


  
    try {
      const tokenAmount = Math.floor(amount);
      const tickerBytes = stringToBytes(tokenDetails.symbol);
  
      console.log("Buying tokens with params:", {
        creatorAddress: tokenDetails.creatorAddress,
        ticker: tickerBytes,
        tokenAmount: tokenAmount,
        maxSlippageBps: slippage
      });
  
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
      await client.waitForTransaction({ transactionHash: response.hash });
      alert(`Bought ${amount} ${tokenDetails.symbol}! Tx: ${response.hash}`);
  
      // Refresh token balance and chart
      setRefreshChart((prev) => prev + 1);
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
    if (!account || amount <= 0 || !tokenDetails?.creatorAddress || !tokenDetails?.symbol) {
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
      const tickerBytes = stringToBytes(tokenDetails.symbol);
  
      console.log("Selling tokens with params:", {
        creatorAddress: tokenDetails.creatorAddress,
        ticker: tickerBytes,
        tokenAmount: tokenAmount,
        maxSlippageBps: slippage
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
      await client.waitForTransaction({ transactionHash: response.hash });
      alert(`Sold ${amount} ${tokenDetails.symbol}! Tx: ${response.hash}`);
  
      // Refresh token balance and chart
      setRefreshChart((prev) => prev + 1);
      
      // Refresh balances after successful trade
      await fetchUserTokenBalance();

    } catch (error: any) {
      console.error("Sell failed:", error);
      
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

  // Add useEffect to fetch token details when component mounts
  useEffect(() => {
    fetchTokenDetails();
  }, [coinHash, account?.address]);

  // Add useEffect to fetch user's token balance
  useEffect(() => {
    if (tokenDetails?.metadataAddress && account?.address) {
      fetchUserTokenBalance();
    }
  }, [tokenDetails?.metadataAddress, account?.address]);

  // Add useEffect to fetch user's APT balance
  

  // Add useEffect to calculate total when amount changes
  useEffect(() => {
    const calculatedTotal = calculateTotal(amount);
    setTotal(calculatedTotal.toString());
  }, [amount]);

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

  // Function to fetch user's token balance
  const fetchUserTokenBalance = async (retryCount = 3, delayMs = 5000): Promise<boolean> => {
    const metadataAddress = tokenDetails?.metadataAddress || location.state?.metadataAddress || "0x0";
    console.log("Fetching balance - Attempt:", 4 - retryCount, "Account:", account?.address, "Metadata Address:", metadataAddress);
    console.log("tokenDetails:", tokenDetails);
    console.log("location.state:", location.state);
    
    // Debug: Check localStorage for this token
    if (account?.address) {
      const users = JSON.parse(localStorage.getItem("users") || "{}");
      const targetAddress = String(account.address);
      const userTokens = users[targetAddress]?.launchedTokens || [];
      const storedToken = userTokens.find((t: any) => t.txHash === tokenDetails?.txHash);
      console.log("Stored token in localStorage:", storedToken);
      if (storedToken) {
        console.log("Stored token metadataAddress:", storedToken.metadataAddress);
      }
    }
  
    if (!metadataAddress || metadataAddress === "0x0") {
      console.log("No metadata address, can't fetch balance.");
      return false;
    }
  
    if (!account?.address) {
      console.log("No wallet connected, setting balance to 0.");
      setTokenBalance("0");
      return false;
    }
  
    try {
      const accountAddress = account.address.toString();
      console.log("Checking wallet:", accountAddress);
      const resources = await client.getAccountResources({ accountAddress });
      console.log("Wallet resources:", JSON.stringify(resources, null, 2));
  
      type BuyerStoreData = {
        stores: { metadata_addr: string; store: { inner: string } }[];
      };
  
      const buyerStore = resources.find(
        (r: any) => r.type === "0x660bb7df7eaf94ac70403e64698faf8b68e5bffe68f1051a97d130068afc7a6b::token_launcher::BuyerStore"
      ) as { data: BuyerStoreData } | undefined;
  
      if (!buyerStore) {
        console.warn("No BuyerStore found for this contract in wallet:", accountAddress);
        if (retryCount > 0) {
          console.log(`Retrying balance fetch in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return await fetchUserTokenBalance(retryCount - 1, delayMs);
        }
        return false;
      }
      console.log("BuyerStore found:", JSON.stringify(buyerStore, null, 2));
  
      // If we can't find the exact metadata address, try to find any token in the BuyerStore
      let storeEntry = buyerStore.data.stores.find((s) => s.metadata_addr === metadataAddress);
      if (!storeEntry && buyerStore.data.stores.length > 0) {
        console.log("Using first available token in BuyerStore as fallback");
        storeEntry = buyerStore.data.stores[0];
        // Update the token details with the correct metadata address
        if (tokenDetails && storeEntry.metadata_addr !== tokenDetails.metadataAddress) {
          console.log("Updating token details with correct metadata address:", storeEntry.metadata_addr);
          setTokenDetails({
            ...tokenDetails,
            metadataAddress: storeEntry.metadata_addr
          });
        }
      }
      
      if (!storeEntry) {
        console.warn("No tokens found in BuyerStore");
        if (retryCount > 0) {
          console.log(`Retrying balance fetch in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return await fetchUserTokenBalance(retryCount - 1, delayMs);
        }
        return false;
      }
      console.log("Store entry found:", JSON.stringify(storeEntry, null, 2));
  
      const storeAddress = storeEntry.store.inner;
      console.log("Checking token store:", storeAddress);
      const storeResources = await client.getAccountResources({ accountAddress: storeAddress });
      console.log("Store resources:", JSON.stringify(storeResources, null, 2));
  
      const fungibleStore = storeResources.find((r: any) => r.type === "0x1::fungible_asset::FungibleStore") as { data: { balance: string } } | undefined;
      if (!fungibleStore) {
        console.warn("No FungibleStore found at:", storeAddress);
        if (retryCount > 0) {
          console.log(`Retrying balance fetch in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return await fetchUserTokenBalance(retryCount - 1, delayMs);
        }
        return false;
      }
      console.log("FungibleStore found:", JSON.stringify(fungibleStore, null, 2));
  
      const balance = Number(fungibleStore.data.balance || 0) / 10 ** 6;
      console.log(`Found balance for ${accountAddress} at ${storeAddress}:`, balance);
      setTokenBalance(balance.toString());
      return true;
    } catch (error: any) {
      console.error("Error getting balance:", error);
      if (error.message?.includes("429") && retryCount > 0) {
        console.log(`Rate limit hit, retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return await fetchUserTokenBalance(retryCount - 1, delayMs);
      }
      console.warn("Failed to fetch balance, keeping last known balance.");
      return false;
    }
  };

  // Function to calculate total cost/return based on amount and current price
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

  return (
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

        {/* Toggle Button */}
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
      </div>

      {/* Main Layout */}
      <div style={{
        display: 'flex',
        flex: 1,
        width: '100%',
        overflow: 'hidden'
      }}>
        {/* Sidebar */}
        <GlobalSidebar 
          watchlistData={watchlistData}
          activeTab="trade"
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
            justifyContent: 'space-between'
          }}>
            <div style={{
              fontSize: '32px',
              fontWeight: '600',
              color: '#050f19',
              flexShrink: 0
            }}>
                              {tokenDetails ? tokenDetails.name.replace('$', '') : 'Token Page'}
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
              {/* Token Header */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                marginBottom: '8px',
                background: '#ffffff',
                width: '100%',
                padding: '0px'
              }}>
                <div style={{
                  fontSize: '28px',
                  fontWeight: '600',
                  color: '#050f19',
                  marginBottom: '8px',
                  lineHeight: '1',
                  padding: '0 0px'
                }}>
                  {tokenDetails ? '$0.00142' : 'Loading...'}
                </div>
                <div style={{
                  color: tokenDetails ? getPercentageColor('+12.5%') : '#5b616e',
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '20px',
                  padding: '0 0px',
                  fontWeight: '600',
                  fontSize: '18px'
                }}>
                  {tokenDetails ? '-8.3%' : 'Loading token details...'}
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0 0px',
                  marginBottom: '20px',
                  width: '100%'
                }}>
                  <div style={{
                    display: 'flex',
                    gap: '0'
                  }}>
                    {['1m', '15m', '1H', '4H', '1D', 'ALL'].map((time, index) => (
                      <button
                        key={time}
                        style={{
                          padding: '8px 16px',
                          border: '0px solid #d3d3d3',
                          borderRadius: '6px',
                          background: index === 1 ? '#d6f0ea' : '#ffffff',
                          color: index === 1 ? '#00d4aa' : '#292929',
                          fontSize: '16px',
                          fontWeight: '100',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '0 20px'
                  }}>
                    <button style={{
                      background: '#fff',
                      border: '1px solid #e6e8ea',
                      color: '#666',
                      cursor: 'pointer',
                      fontSize: '24px',
                      padding: '5px 12px',
                      borderRadius: '6px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      ☆
                    </button>
                    <button style={{
                      padding: '8px 16px',
                      background: '#00BFFF',
                      color: '#ffffff',
                      border: '1px solid #00BFFF',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}>
                      Verify Community
                    </button>
                    <button style={{
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
                    </button>
                  </div>
                </div>
              </div>

              {/* Chart Container */}
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '30px',
                height: '400px',
                position: 'relative'
              }}>
                <div style={{
                  width: '100%',
                  height: '320px',
                  background: '#fbfbfb',
                  borderRadius: '8px',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <svg style={{ width: '100%', height: '100%' }}>
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#ff4757', stopOpacity: 0.3 }} />
                        <stop offset="100%" style={{ stopColor: '#ff4757', stopOpacity: 0 }} />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    <g style={{ stroke: '#b3b3b4', strokeWidth: 0.5, opacity: 0.5 }}>
                      <line x1="0" y1="50" x2="100%" y2="50" />
                      <line x1="0" y1="100" x2="100%" y2="100" />
                      <line x1="0" y1="150" x2="100%" y2="150" />
                      <line x1="0" y1="200" x2="100%" y2="200" />
                      <line x1="0" y1="250" x2="100%" y2="250" />
                    </g>

                    {/* Chart line */}
                    <path
                      style={{ fill: 'none', stroke: '#ff4757', strokeWidth: 2 }}
                      d="M 0 180 L 50 120 L 100 140 L 150 110 L 200 100 L 250 130 L 300 120 L 350 140 L 400 160 L 450 180 L 500 200 L 550 190 L 600 210 L 650 220 L 700 240 L 750 260 L 800 280 L 850 270 L 900 290 L 950 280 L 1000 300"
                    />

                    {/* Area fill */}
                    <path
                      style={{ fill: 'url(#gradient)' }}
                      d="M 0 180 L 50 120 L 100 140 L 150 110 L 200 100 L 250 130 L 300 120 L 350 140 L 400 160 L 450 180 L 500 200 L 550 190 L 600 210 L 650 220 L 700 240 L 750 260 L 800 280 L 850 270 L 900 290 L 950 280 L 1000 300 L 1000 320 L 0 320 Z"
                    />
                  </svg>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '10px',
                  fontSize: '12px',
                  color: '#666'
                }}>
                  <span>3:35 PM</span>
                  <span>6:45 PM</span>
                  <span>9:55 PM</span>
                  <span>1:05 AM</span>
                  <span>4:15 AM</span>
                  <span>7:25 AM</span>
                  <span>10:35 AM</span>
                  <span>1:45 PM</span>
                </div>
              </div>

              {/* Balance Section with Tabs */}
              <div style={{ marginTop: '20px' }}>
                <div style={{
                  display: 'flex',
                  borderBottom: '1px solid #d3d3d3',
                  justifyContent: 'flex-start',
                  textAlign: 'left'
                }}>
                  {['Insights', 'Transactions', 'Top Holders'].map((tab, index) => (
                    <div
                      key={tab}
                      style={{
                        padding: '12px 0',
                        marginRight: '24px',
                        color: index === 0 ? '#00d4aa' : '#8a9ba8',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        borderBottom: `2px solid ${index === 0 ? '#00d4aa' : 'transparent'}`,
                        transition: 'all 0.2s'
                      }}
                    >
                      {tab}
                    </div>
                  ))}
                </div>

                {/* Insights Tab Content */}
                <div style={{
                  display: 'block',
                  border: '1px solid #f2f1f1',
                  borderBottomLeftRadius: '12px',
                  borderBottomRightRadius: '12px',
                  borderTop: '0px'
                }}>
                  {/* Token Info Section */}
                  <div style={{
                    display: 'flex',
                    marginBottom: '30px',
                    background: '#f8f9fa',
                    borderBottomLeftRadius: '12px',
                    borderBottomRightRadius: '12px',
                    minHeight: '200px'
                  }}>
                    <div style={{
                      width: '300px',
                      background: '#e0e0e0',
                      borderBottomLeftRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      color: '#666',
                      flexShrink: 0,
                      textAlign: 'center',
                      padding: '20px'
                    }}>
                      {tokenDetails?.image ? (
                        <img 
                          src={tokenDetails.image} 
                          alt={`${tokenDetails.name} logo`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: '0 0 0 12px'
                          }}
                        />
                      ) : (
                        'No image available'
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
                            color: '#050f19'
                          }}>
                            {tokenDetails ? tokenDetails.name.replace('$', '') : 'Loading...'}
                          </div>
                          <div style={{
                            fontSize: '16px',
                            color: '#8a9ba8',
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
                              color: '#8a9ba8',
                              fontWeight: '500',
                              fontSize: '12px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Launched:
                            </span>
                            <span style={{
                              color: '#050f19',
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
                              color: '#8a9ba8',
                              fontWeight: '500',
                              fontSize: '12px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Holders:
                            </span>
                            <span style={{
                              color: '#050f19',
                              fontWeight: '600',
                              fontSize: '14px'
                            }}>
                              1,247 wallets
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
                              color: '#8a9ba8',
                              fontWeight: '500',
                              fontSize: '12px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Created by:
                            </span>
                            <span style={{
                              color: '#050f19',
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
                        color: '#6c757d',
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
                            color: '#050f19',
                            lineHeight: '1',
                            marginBottom: '10px'
                          }}>
                            $67,856
                          </div>
                          <div style={{
                            fontSize: '16px',
                            color: '#8a9ba8',
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
                            color: '#050f19',
                            lineHeight: '1',
                            marginBottom: '10px'
                          }}>
                            $24,656
                          </div>
                          <div style={{
                            fontSize: '16px',
                            color: '#8a9ba8',
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
                            color: '#00d4aa',
                            lineHeight: '1',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginBottom: '10px'
                          }}>
                            <span style={{ fontSize: '16px' }}>↑</span>
                            <span>+12.5%</span>
                          </div>
                          <div style={{
                            fontSize: '16px',
                            color: '#8a9ba8',
                            marginBottom: '20px'
                          }}>
                            Change % (24h)
                          </div>
                        </div>
                      </div>

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
                            color: '#050f19',
                            lineHeight: '1'
                          }}>
                            962 / 1283 APT
                          </div>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#8a9ba8',
                            letterSpacing: '0.5px'
                          }}>
                            75% Complete
                          </div>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '8px',
                          background: '#f0f0f0',
                          borderRadius: '4px',
                          overflow: 'hidden',
                          marginBottom: '8px'
                        }}>
                          <div style={{
                            height: '100%',
                            background: 'linear-gradient(90deg, #00d4aa, #00b894)',
                            borderRadius: '4px',
                            width: '75%'
                          }}></div>
                        </div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#8a9ba8',
                          marginTop: '8px',
                          letterSpacing: '0.5px'
                        }}>
                          Graduation Progress
                        </div>
                      </div>
                    </div>

                    <div style={{
                      flex: 1,
                      maxWidth: '50%'
                    }}>
                      <div style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '20px',
                        marginTop: '-20px'
                      }}>
                        <p style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#8a9ba8',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          paddingBottom: '8px'
                        }}>
                          Links
                        </p>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}>
                          <div style={{
                            display: 'flex',
                            gap: '12px'
                          }}>
                            <button 
                              onClick={handleCopyCA}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '12px 16px',
                                border: '1px solid #e6e8ea',
                                borderRadius: '8px',
                                background: 'white',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                fontSize: '13px',
                                fontWeight: '500',
                                color: '#050f19',
                                textAlign: 'left',
                                flex: 1,
                                minWidth: 0
                              }}
                            >
                              <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>🔗</span>
                              <span style={{ flex: 1 }}>{copied ? 'Copied!' : 'Copy CA'}</span>
                            </button>
                            <button style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '12px 16px',
                              border: '1px solid #e6e8ea',
                              borderRadius: '8px',
                              background: 'white',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              fontSize: '13px',
                              fontWeight: '500',
                              color: '#050f19',
                              textAlign: 'left',
                              flex: 1,
                              minWidth: 0
                            }}>
                              <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>🌐</span>
                              <span style={{ flex: 1 }}>Website</span>
                            </button>
                          </div>
                          <div style={{
                            display: 'flex',
                            gap: '12px'
                          }}>
                            <button style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '12px 16px',
                              border: '1px solid #e6e8ea',
                              borderRadius: '8px',
                              background: 'white',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              fontSize: '13px',
                              fontWeight: '500',
                              color: '#050f19',
                              textAlign: 'left',
                              flex: 1,
                              minWidth: 0
                            }}>
                              <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>🐦</span>
                              <span style={{ flex: 1 }}>Twitter</span>
                            </button>
                            <button style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '12px 16px',
                              border: '1px solid #e6e8ea',
                              borderRadius: '8px',
                              background: 'white',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              fontSize: '13px',
                              fontWeight: '500',
                              color: '#050f19',
                              textAlign: 'left',
                              flex: 1,
                              minWidth: 0
                            }}>
                              <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>📱</span>
                              <span style={{ flex: 1 }}>Telegram</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#0a0b0d',
                    marginBottom: '8px'
                  }}>
                    Your Balance
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
                      background: activeTab === 'sell' ? '#00d4aa' : 'transparent',
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
  );
};

export default TokenPage;