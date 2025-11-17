import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network, UserTransactionResponse } from "@aptos-labs/ts-sdk";
import { InputTransactionData } from "@aptos-labs/wallet-adapter-core";
import { createChart, IChartApi, ISeriesApi, Time } from "lightweight-charts";
import "../MoveMint.css";
import "../styles/TokenPage.css";
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
  const { account, signAndSubmitTransaction } = useWallet();
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

  interface Token {
    name: string;
    symbol: string;
    supply: number;
    txHash: string;
    image: string | null;
    launchDate: string;
    creator: string;
    metadataAddress?: string; // Optional, added for compatibility
  }

  interface CustomTokenResource {
    balance?: string | number; // Could be either, depending on your Move code
    amount?: string | number;  // Fallback if named differently
    metadata?: string;         // To match metadataAddress
  }

  interface CoinStoreData {
    coin?: { value: string }; // For CoinStore resource
    balance?: string; // For FungibleStore or direct balance
  }

  interface FungibleStoreData {
    amount: string; // Balance as a string (e.g., "1000000")
    metadata: string; // Metadata address (e.g., "0xbaf2876c1e...")
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
  }

  interface OHLC {
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number; // Added for volume data
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

 

  function isUserTransactionResponse(transaction: any): transaction is UserTransactionResponse {
    return transaction.type === "user_transaction";
  }

  const handleCopyCA = () => {
    if (!tokenDetails?.metadataAddress) {
      console.error("Metadata address not available to copy.");
      return;
    }
    const customCA = `${tokenDetails.metadataAddress}::mint`;
    navigator.clipboard.writeText(customCA).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch((error) => {
      console.error("Failed to copy CA:", error);
    });
  };

  function stringToBytes(str: string): number[] {
    return Array.from(new TextEncoder().encode(str));
}

  const location = useLocation();

  const fetchTokenMetadata = async (creator: string, name: string, symbol: string) => {
    try {
        const moduleState = await client.getAccountResource({
            accountAddress: tokenLauncherAddress,
            resourceType: `${tokenLauncherAddress}::token_launcher::ModuleState`,
        });

        console.log("ModuleState:", moduleState);

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

        console.log("TokenMetadata for creator:", tokenMetadata);

        const nameBytes = stringToBytes(name);
        const symbolBytes = stringToBytes(symbol);
        console.log("Looking for token with name:", name, "symbol:", symbol);
        console.log("Name bytes:", nameBytes, "Symbol bytes:", symbolBytes);

        const tokenInfo = tokenMetadata.entries.find((t) => {
            console.log("Comparing with entry:", t);
            return (
                t.original_name.toString() === nameBytes.toString() &&
                t.ticker.toString() === symbolBytes.toString()
            );
        });

        if (!tokenInfo) {
            console.error("Token not found in entries. Available entries:", tokenMetadata.entries);
            return null;
        }

        console.log("Found token info:", tokenInfo);
        return tokenInfo.metadata_addr || null;
    } catch (error) {
        console.error("Error fetching token metadata:", error);
        return null;
    }
};

  useEffect(() => {
    if (!coinHash) return;

    const fetchTokenDetails = async () => {
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
          let name = symbol; // Default to symbol if name not provided
          const originalName = tokenCreationEvent.data.original_name;
          console.log("Raw original_name:", originalName);
          if (typeof originalName === "string" && originalName.startsWith("0x")) {
            name = hexToString(originalName);
          } else if (Array.isArray(originalName)) {
            name = String.fromCharCode(...originalName);
          }
          console.log("Parsed name:", name);
    
          const supply = Number(tokenCreationEvent.data.total_supply || 0);
          const metadataAddress = tokenCreationEvent.data.metadata_addr;
    
          initialData = {
            name: name || "Unnamed Token",
            symbol: symbol || "N/A",
            supply,
            txHash: coinHash,
            twitterLink: null,
            websiteLink: null,
            metadataAddress,
            creatorAddress: creator,
            creationDate: Number(transaction.timestamp) / 1000 || new Date().getTime() / 1000,
          };
          console.log("Constructed initialData from transaction:", initialData);
    
          // Save to localStorage to cache for this user
          if (account?.address) {
            const users = JSON.parse(localStorage.getItem("users") || "{}");
            const targetAddress = String(account.address);
            if (!users[targetAddress]) users[targetAddress] = { launchedTokens: [] };
            if (!users[targetAddress].launchedTokens.find((t: Token) => t.txHash === coinHash)) {
              users[targetAddress].launchedTokens.push({
                name: initialData.name,
                symbol: initialData.symbol,
                supply: initialData.supply,
                txHash: initialData.txHash,
                image: null,
                launchDate: new Date(initialData.creationDate * 1000).toISOString(),
                creator: initialData.creatorAddress,
                metadataAddress: initialData.metadataAddress,
              });
              localStorage.setItem("users", JSON.stringify(users));
            }
          }
        }
    
        if (!initialData) {
          console.error("No token data available");
          initialData = {
            name: "Error",
            symbol: "N/A",
            supply: 0,
            txHash: coinHash,
            twitterLink: null,
            websiteLink: null,
            metadataAddress: undefined,
            creatorAddress: undefined,
            creationDate: new Date().getTime() / 1000,
          } as TokenDetails;
        }
    
        console.log("Setting token details:", initialData);
        setTokenDetails(initialData);
      } catch (error) {
        console.error("Error fetching token details:", error);
        const errorData: TokenDetails = {
          name: "Error",
          symbol: "N/A",
          supply: 0,
          txHash: coinHash,
          twitterLink: null,
          websiteLink: null,
          metadataAddress: undefined,
          creatorAddress: undefined,
          creationDate: new Date().getTime() / 1000,
        };
        console.log("Setting error token details:", errorData);
        setTokenDetails(errorData);
      }
    };
    
    fetchTokenDetails();
}, [coinHash, location.state, client, account]);


  useEffect(() => {
    

    fetchTokenBalance();
}, [account?.address, tokenDetails, location.state, client, refreshChart, tokenLauncherAddress]);

  useEffect(() => {
    console.log("Chart useEffect running...");
    if (!chartContainerRef.current) {
      console.log("Chart container ref not ready, waiting...");
        return;
      }
  
    // Set isMounted to true immediately
    setIsMounted(true);

      console.log("Chart container ready, initializing chart...");
      chartRef.current = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
      height: 695,
      layout: {
        background: { color: "#212121" },
        textColor: "#b2b5be",
      },
      grid: {
        vertLines: { color: "#2B2B43" },
        horzLines: { color: "#2B2B43" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: "#2B2B43",
        barSpacing: 5,
        rightOffset: 5,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      rightPriceScale: {
        borderColor: "#2B2B43",
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      leftPriceScale: {
        visible: false,
      },
      crosshair: {
        mode: 1,
        vertLine: { color: "#b2b5be", width: 1, style: 2, labelBackgroundColor: "#212121" },
        horzLine: { color: "#b2b5be", width: 1, style: 2, labelBackgroundColor: "#212121" },
      },
      handleScroll: true,
      handleScale: true,
    });
  
        seriesRef.current = chartRef.current.addCandlestickSeries({
      upColor: "#4CAF50",
      downColor: "#F44336",
      borderVisible: true,
      borderColor: "#b2b5be",
      wickUpColor: "#4CAF50",
      wickDownColor: "#F44336",
      priceFormat: {
        type: "price",
        precision: 6,
      },
      lastValueVisible: true,
      priceLineVisible: true,
    });
  
    volumeSeriesRef.current = chartRef.current.addHistogramSeries({
      color: "#4CAF50",
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "",
      priceLineVisible: false,
    });

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: 695,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [timeframe, refreshChart, account?.address]);

  // Separate effect for updating chart data
  useEffect(() => {
    const fetchAndUpdateChart = async () => {
      console.log("Fetching chart data for timeframe:", timeframe);
      if (seriesRef.current && chartRef.current && volumeSeriesRef.current) {
        seriesRef.current.setData([]);
        volumeSeriesRef.current.setData([]);
        chartRef.current.applyOptions({
          watermark: {
            visible: true,
            text: "Loading chart data...",
            color: "rgba(178, 181, 190, 0.5)",
            fontSize: 24,
            horzAlign: "center",
            vertAlign: "center",
          },
        });
      }
  
      try {
        const ohlcData = await fetchDepositEvents(timeframe);
        console.log("OHLC Data from events:", ohlcData);
        if (ohlcData.length > 0 && seriesRef.current && chartRef.current && volumeSeriesRef.current) {
          console.log("Setting real chart data from events:", ohlcData);
          seriesRef.current.setData(ohlcData);
          volumeSeriesRef.current.setData(ohlcData);
          chartRef.current.timeScale().fitContent();
          chartRef.current.applyOptions({ watermark: { visible: false } });
        } else {
          console.log("No events found, trying balance polling...");
          const balanceData = await fetchBalanceChanges(timeframe);
          console.log("Balance data:", balanceData);
          if (balanceData.length > 0 && seriesRef.current && chartRef.current && volumeSeriesRef.current) {
            console.log("Setting balance data:", balanceData);
            seriesRef.current.setData(balanceData);
            volumeSeriesRef.current.setData(balanceData);
            chartRef.current.timeScale().fitContent();
            chartRef.current.applyOptions({ watermark: { visible: false } });
          } else {
            console.warn("No valid data available...");
            if (chartRef.current) {
              chartRef.current.applyOptions({
                watermark: {
                  visible: true,
                  text: "No data available",
                  color: "rgba(178, 181, 190, 0.5)",
                  fontSize: 24,
                  horzAlign: "center",
                  vertAlign: "center",
                },
              });
            }
          }
        }
      } catch (error) {
        console.error("Error in fetchAndUpdateChart:", error);
        if (chartRef.current) {
          chartRef.current.applyOptions({
            watermark: {
              visible: true,
              text: "Error loading data",
              color: "rgba(244, 67, 54, 0.5)",
              fontSize: 24,
              horzAlign: "center",
              vertAlign: "center",
            },
          });
        }
      }
    };

    if (chartRef.current) {
      fetchAndUpdateChart();
    }
  }, [timeframe, refreshChart, account?.address]); // Update data when these change

  // Remove unwanted elements
  useEffect(() => {
    const removeUnwantedElements = () => {
      const statsElements = document.querySelectorAll(".token-trading-chart-stats");
      const toolsElements = document.querySelectorAll(".token-trading-chart-tools");
      statsElements.forEach((el) => el.remove());
      toolsElements.forEach((el) => el.remove());
    };

    removeUnwantedElements();

    const observer = new MutationObserver(() => {
      removeUnwantedElements();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  async function fetchDepositEvents(timeframe: string) {
    try {
      if (!account?.address || !tokenDetails?.metadataAddress) {
        console.warn("No wallet connected or metadata address missing, cannot fetch events.");
        return [];
      }
      const walletAddresses = [account.address, tokenLauncherAddress];
      let allEvents: any[] = [];

      const maxRetries = 3;
      for (let retry = 0; retry < maxRetries; retry++) {
        allEvents = [];
        for (const walletAddress of walletAddresses) {
          console.log(`Fetching events for wallet (attempt ${retry + 1}):`, walletAddress);
          const eventTypes = [
            `0x1::fungible_asset::DepositEvent`,
            `0x1::fungible_asset::WithdrawEvent`,
                    `${tokenLauncherAddress}::token_launcher::TokenPurchaseEvent`,
          ];

          for (const eventType of eventTypes) {
            console.log(`Trying event type: ${eventType}`);
            const events = await client.getAccountEventsByEventType({
              accountAddress: walletAddress,
              eventType: eventType as `${string}::${string}::${string}`,
              options: { limit: 100, orderBy: [{ transaction_version: "desc" }] },
            });
            console.log(`Raw events for ${walletAddress} (${eventType}):`, events);
            allEvents = allEvents.concat(events);
          }
        }
        if (allEvents.length > 0) break;
        console.log(`No events found on attempt ${retry + 1}, retrying after delay...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      const eventsWithTimestamps = await Promise.all(
        allEvents.map(async (event: any) => {
          if (event.transaction_version && !isNaN(Number(event.transaction_version))) {
            console.log(`Fetching transaction for version: ${event.transaction_version}`);
            const transaction = await client.getTransactionByVersion({
              ledgerVersion: BigInt(event.transaction_version),
            });
            if (isUserTransactionResponse(transaction)) {
              return { ...event, transaction_timestamp: transaction.timestamp };
            }
            console.warn(`Transaction ${event.transaction_version} has no timestamp:`, transaction);
            return { ...event, transaction_timestamp: "0" };
          }
          return { ...event, transaction_timestamp: "0" };
        })
      );

      console.log("Events with timestamps:", eventsWithTimestamps);
      return processEventsToOHLC(eventsWithTimestamps, timeframe);
    } catch (error) {
      console.error("Error fetching events:", error);
      return [];
    }
  }

  async function fetchBalanceChanges(timeframe: string): Promise<OHLC[]> {
    try {
      if (!account?.address || !tokenDetails?.metadataAddress) {
        console.warn("No wallet connected or metadata address missing, cannot fetch balance changes.");
        return [];
      }

      const ohlcData: OHLC[] = [];
      const timeframeSeconds = {
          "1s": 1,
          "1m": 60,
          "5m": 300,
          "15m": 900,
          "1h": 3600,
          "4h": 14400,
          "D": 86400,
      }[timeframe] || 86400;
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - timeframeSeconds * 5;
      const interval = timeframeSeconds / 5;

      for (let t = startTime; t <= now; t += interval) {
        let balance = 0;
        try {
              const resources = await client.getAccountResources({
                  accountAddress: account.address,
              });
              console.log(`Resources for ${account.address} at time ${t}:`, resources);

              const fungibleAssetStore = resources.find((resource: any) =>
                  resource.type === "0x1::fungible_asset::FungibleAssetStore"
              );

              if (!fungibleAssetStore) {
                  console.warn("FungibleAssetStore not found for account:", account.address);
                  balance = 0;
              } else {
                  // Type assertion with runtime check
                  const storeData = fungibleAssetStore.data as { stores?: Array<{ metadata: string, balance: string }> };
                  if (!storeData.stores) {
                      console.warn("FungibleAssetStore data does not contain 'stores' field:", fungibleAssetStore);
                      balance = 0;
                  } else {
                      const stores = storeData.stores;
                      const store = stores.find((s) => s.metadata === tokenDetails.metadataAddress);
          if (!store) {
            console.warn("FungibleAssetStore not found for metadata address:", tokenDetails.metadataAddress);
            balance = 0;
          } else {
            balance = Number(store.balance) / 10 ** 6;
                      }
                  }
          }
        } catch (error: any) {
          console.error(`Error fetching balance at time ${t}:`, error);
          balance = 0;
        }

        const price = fixedPrice * (1 + balance / 1000000);
        ohlcData.push({
          time: t as Time,
          open: price,
          high: price,
          low: price,
          close: price,
              volume: balance * 100, // Mock volume
        });
      }

      return ohlcData;
    } catch (error) {
      console.error("Error fetching balance changes:", error);
      return [];
    }
  }

  function processEventsToOHLC(events: any[], timeframe: string): OHLC[] {
    const ohlcData: OHLC[] = [];
    const timeframeSeconds = {
      "1s": 1,
      "1m": 60,
      "5m": 300,
      "15m": 900,
      "1h": 3600,
      "4h": 14400,
      "D": 86400,
    }[timeframe] || 86400;
    const groupedByTime: { [key: number]: { prices: number[]; volumes: number[] } } = {};

    events.forEach((event: any) => {
      console.log("Event:", event);
      const timestamp = Math.floor(Number(event.transaction_timestamp) / 1000000);
      if (!timestamp || timestamp <= 0) {
        console.warn("Skipping event with invalid timestamp:", event);
        return;
      }

      const bucket = Math.floor(timestamp / timeframeSeconds) * timeframeSeconds;
      if (!groupedByTime[bucket]) groupedByTime[bucket] = { prices: [], volumes: [] };
      groupedByTime[bucket].prices.push(fixedPrice);
      groupedByTime[bucket].volumes.push(Math.random() * 1000); // Mock volume
    });

    for (const bucket in groupedByTime) {
      const { prices, volumes } = groupedByTime[bucket];
      if (prices.length === 0) continue;
      ohlcData.push({
        time: Number(bucket) as Time,
        open: prices[0],
        high: Math.max(...prices),
        low: Math.min(...prices),
        close: prices[prices.length - 1],
        volume: volumes.reduce((a, b) => a + b, 0),
      });
    }
    return ohlcData.sort((a, b) => Number(a.time) - Number(b.time));
  }

  const fetchTokenBalance = async (retryCount = 3, delayMs = 5000): Promise<boolean> => {
    const metadataAddress = tokenDetails?.metadataAddress || location.state?.metadataAddress || "0x0";
    console.log("Fetching balance - Attempt:", 4 - retryCount, "Account:", account?.address, "Metadata Address:", metadataAddress);
  
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
        (r: any) => r.type === "0x965f2de54b3037c386d4d28500b0cd5771942b10704a0324c8464348c15ce090::token_launcher::BuyerStore"
      ) as unknown as { data: BuyerStoreData } | undefined;
  
      if (!buyerStore) {
        console.warn("No BuyerStore found for this contract in wallet:", accountAddress);
        if (retryCount > 0) {
          console.log(`Retrying balance fetch in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return await fetchTokenBalance(retryCount - 1, delayMs);
        }
        return false;
      }
      console.log("BuyerStore found:", JSON.stringify(buyerStore, null, 2));
  
      const storeEntry = buyerStore.data.stores.find((s) => s.metadata_addr === metadataAddress);
      if (!storeEntry) {
        console.warn("Token not in BuyerStore - Expected metadata:", metadataAddress, "Stores:", JSON.stringify(buyerStore.data.stores, null, 2));
        if (retryCount > 0) {
          console.log(`Retrying balance fetch in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return await fetchTokenBalance(retryCount - 1, delayMs);
        }
        return false;
      }
      console.log("Store entry found:", JSON.stringify(storeEntry, null, 2));
  
      const storeAddress = storeEntry.store.inner;
      console.log("Checking token store:", storeAddress);
      const storeResources = await client.getAccountResources({ accountAddress: storeAddress });
      console.log("Store resources:", JSON.stringify(storeResources, null, 2));
  
      const fungibleStore = storeResources.find((r: any) => r.type === "0x1::fungible_asset::FungibleStore") as unknown as { data: { balance: string } } | undefined;
      if (!fungibleStore) {
        console.warn("No FungibleStore found at:", storeAddress);
        if (retryCount > 0) {
          console.log(`Retrying balance fetch in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return await fetchTokenBalance(retryCount - 1, delayMs);
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
        return await fetchTokenBalance(retryCount - 1, delayMs);
      }
      console.warn("Failed to fetch balance, keeping last known balance.");
      return false;
    }
  };

    async function fetchCurrentPrice(creatorAddress: string, ticker: string): Promise<number> {
      const metadataAddr = await getMetadataAddress(creatorAddress, ticker);
      const vaultResources = await client.getAccountResources({ accountAddress: metadataAddr });
      const vault = vaultResources.find(r => r.type === `${tokenLauncherAddress}::token_launcher::TokenVault`);
      if (!vault) throw new Error(`TokenVault not found at ${metadataAddr}`);
      // Define the expected structure of TokenVault data
      const vaultData = vault.data as { price_per_token: string };
      return Number(vaultData.price_per_token);
    }
    
    async function getMetadataAddress(creatorAddress: string, ticker: string): Promise<string> {
      // Fetch the ModuleState to get the table handle
      const moduleState = await client.getAccountResource({
        accountAddress: tokenLauncherAddress,
        resourceType: `${tokenLauncherAddress}::token_launcher::ModuleState`
      });
    
      if (!moduleState || !moduleState.token_metadata || !moduleState.token_metadata.handle) {
        throw new Error("ModuleState is not properly initialized or token_metadata handle is missing");
      }
    
      // Query the table for the creator's metadata
      const tokenMetadata = await client.getTableItem({
        handle: moduleState.token_metadata.handle,
        data: {
          key: creatorAddress,
          key_type: "address",
          value_type: `${tokenLauncherAddress}::token_launcher::TokenMetadata`
        }
      }) as { entries: Array<{ ticker: string; metadata_addr: string }> };
    
      const tickerHex = `0x${Buffer.from(ticker, "utf8").toString("hex")}`;
      const entry = tokenMetadata.entries.find(e => e.ticker === tickerHex);
      if (!entry) throw new Error(`No token found with ticker ${ticker} for creator ${creatorAddress}`);
    
      return entry.metadata_addr;
    }

    const handleBuy = async () => {
      console.log("handleBuy - account:", account, "amount:", amount, "creatorAddress:", tokenDetails?.creatorAddress, "symbol:", tokenDetails?.symbol, "slippage:", slippage);
      if (!account || amount <= 0 || !tokenDetails?.creatorAddress || !tokenDetails?.symbol) {
        alert("Connect wallet, enter a valid amount, or ensure token details are available.");
        return;
      }
    
      try {
        const tokenAmount = Math.floor(amount);
        const aptAmount = Math.floor(tokenAmount * 0.0001 * 10 ** 8 / 10 ** 6);
        const tickerBytes = stringToBytes(tokenDetails.symbol);
    
        console.log("Buying tokens with params:", {
          creatorAddress: tokenDetails.creatorAddress,
          ticker: tickerBytes,
          aptAmount: aptAmount,
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
    
        let balanceUpdated = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          balanceUpdated = await fetchTokenBalance();
          if (balanceUpdated) break;
          console.log(`Balance fetch attempt ${attempt + 1} failed, retrying...`);
        }
        if (!balanceUpdated) {
          console.warn("Failed to update balance after 3 attempts.");
        }
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
    
        let balanceUpdated = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          balanceUpdated = await fetchTokenBalance();
          if (balanceUpdated) break;
          console.log(`Balance fetch attempt ${attempt + 1} failed, retrying...`);
        }
        if (!balanceUpdated) {
          console.warn("Failed to update balance after 3 attempts.");
        }
        setRefreshChart((prev) => prev + 1);
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
  const handleTrade = (type: 'buy' | 'sell') => {
    if (!account) {
      alert("Please connect your wallet to trade");
      return;
    }
    if (!tokenDetails) {
      alert("Token details not available");
      return;
    }
    console.log(`${type} ${amount} ${tokenDetails.symbol}`);
  };

  const calculateEstimatedCost = (tokenAmount: number): number => {
    const total_supply = 800_000_000;
    const tokens_sold_before = 0; // For first purchase
    const tokens_sold_after = tokens_sold_before + tokenAmount;
    
    const scale = 100_000_000; // 10^8 for APT Octas
    const price_scale = 1_000_000; // 10^6 for price scaling
    const price_numerator = 19_029_514_756; // New price numerator
    const price_constant = 6_190_532_760; // 61.9053276 * 10^8

    // For large purchases (over 100M tokens), use segmented approximation
    if (tokenAmount > 100_000_000) {
      const segments = 10; // Divide the purchase into 10 segments
      const segment_size = tokenAmount / segments;
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
      
      return total_cost / 10 ** 8; // Convert to APT
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
    
    const apt_cost = (average_price * tokenAmount * 100) / scale;
    
    return apt_cost / 10 ** 8; // Convert to APT
  };

  // Helper function to handle slippage changes
  const handleSlippageChange = (value: number) => {
    if (value >= 1 && value <= maxSlippage) {
      setSlippage(value);
    } else {
      alert(`Slippage must be between 0.1% and 10%`);
    }
  };

  // Helper function to calculate price impact (simplified version)
  const calculatePriceImpact = (tokenAmount: number): number => {
    if (tokenAmount <= 0) return 0;
    
    // Simplified price impact calculation based on bonding curve
    const total_supply = 800_000_000;
    const tokens_sold_before = 0; // For first purchase
    const tokens_sold_after = tokens_sold_before + tokenAmount;
    
    const price_numerator = 19_029_514_756;
    const price_scale = 1_000_000;
    
    const denominator_before = total_supply - tokens_sold_before;
    const denominator_after = total_supply - tokens_sold_after;
    
    const hyperbolic_before = (price_numerator * price_scale) / denominator_before;
    const hyperbolic_after = (price_numerator * price_scale) / denominator_after;
    
    const price_before = hyperbolic_before + 61_905_327;
    const price_after = hyperbolic_after + 61_905_327;
    
    return ((price_after - price_before) * 10000) / price_before;
  };

  // Helper function to get price impact color
  const getPriceImpactColor = (impact: number): string => {
    if (impact < 200) return '#22c55e'; // Green for < 2%
    if (impact < 500) return '#eab308'; // Yellow for 2-5%
    return '#ef4444'; // Red for > 5%
  };

  if (!coinHash) return <div className="token-trading-page">No coin hash provided.</div>;
  if (!tokenDetails) return <div className="token-trading-page">
    <div className="token-trading-header">
      <div className="token-trading-info">
        <div className="token-trading-name-section">
          <h1>Loading...</h1>
        </div>
      </div>
    </div>
  </div>;

  return (
    <div className="token-trading-page">
      <div className="token-trading-header">
        <div className="token-trading-info">
          <div className="token-trading-name-section">
            <h1>{tokenDetails.name}</h1>
            <div className="token-trading-stats">
              <span>Symbol: {tokenDetails.symbol}</span>
              <span>Created: {new Date(Number(tokenDetails.txHash)).toLocaleDateString()}</span>
              <span>Market Cap: ${(tokenDetails.supply * fixedPrice).toLocaleString()}</span>
              <span>Creator: <a href={`/profile/${tokenDetails.creatorAddress}`} className="token-trading-creator-link">{tokenDetails.creatorAddress?.slice(0, 6)}...{tokenDetails.creatorAddress?.slice(-4)}</a></span>
            
            </div>
          </div>
        </div>
      </div>

      <div className="token-trading-layout">
        <div className="token-trading-chart-section">
          <div className="token-trading-chart-header">
          <div className="token-trading-timeframe-selector">
  <button className={`token-trading-timeframe-button ${timeframe === "1s" ? "active" : ""}`} onClick={() => setTimeframe("1s")}>1s</button>
  <button className={`token-trading-timeframe-button ${timeframe === "1m" ? "active" : ""}`} onClick={() => setTimeframe("1m")}>1m</button>
  <button className={`token-trading-timeframe-button ${timeframe === "5m" ? "active" : ""}`} onClick={() => setTimeframe("5m")}>5m</button>
  <button className={`token-trading-timeframe-button ${timeframe === "15m" ? "active" : ""}`} onClick={() => setTimeframe("15m")}>15m</button>
  <button className={`token-trading-timeframe-button ${timeframe === "1h" ? "active" : ""}`} onClick={() => setTimeframe("1h")}>1h</button>
  <button className={`token-trading-timeframe-button ${timeframe === "4h" ? "active" : ""}`} onClick={() => setTimeframe("4h")}>4h</button>
  <button className={`token-trading-timeframe-button ${timeframe === "D" ? "active" : ""}`} onClick={() => setTimeframe("D")}>D</button>
</div>
          </div>
          <div className="token-trading-chart-container" ref={chartContainerRef} />
        </div>

        <div className="token-trading-sidebar">
          <div className="token-trading-panel">
            <div className="token-trading-balance">
              <div className="token-trading-balance-label">Your Balance</div>
              <div className="token-trading-balance-value">{tokenBalance || "0"}</div>
            </div>

            <div className="token-trading-type-selector">
              <button 
                className={`token-trading-type-button ${tradeType === 'buy' ? 'active' : ''}`}
                onClick={() => setTradeType('buy')}
              >
                Buy
              </button>
              <button 
                className={`token-trading-type-button ${tradeType === 'sell' ? 'active' : ''}`}
                onClick={() => setTradeType('sell')}
              >
                Sell
              </button>
            </div>

            <div className="token-trading-input-group">
              <label className="token-trading-input-label">Amount</label>
              <input
                type="number"
                className="token-trading-input"
                value={amount}
                onChange={(e) => {
                  const newAmount = Number(e.target.value);
                  setAmount(newAmount);
                  if (newAmount > 0) {
                    const cost = calculateEstimatedCost(newAmount);
                    setEstimatedCost(cost);
                    const impact = calculatePriceImpact(newAmount);
                    setPriceImpact(impact);
                  } else {
                    setEstimatedCost(0);
                    setPriceImpact(0);
                  }
                }}
                placeholder="Enter amount"
              />
              {amount > 0 && (
                <div className="token-trading-cost-estimate">
                  Estimated cost: {estimatedCost.toFixed(8)} APT
                </div>
              )}
            </div>

            {/* Slippage Protection Section */}
            <div className="token-trading-input-group">
              <label className="token-trading-input-label">
                Slippage Tolerance
                <button 
                  className="token-trading-slippage-toggle"
                  onClick={() => setShowSlippageInput(!showSlippageInput)}
                >
                  {showSlippageInput ? '▼' : '▶'}
                </button>
              </label>
              
              {showSlippageInput && (
                <div className="token-trading-slippage-container">
                  <div className="token-trading-slippage-presets">
                    {slippageOptions.map((option) => (
                      <button
                        key={option}
                        className={`token-trading-slippage-preset ${slippage === option ? 'active' : ''}`}
                        onClick={() => handleSlippageChange(option)}
                      >
                        {(option / 100).toFixed(1)}%
                      </button>
                    ))}
                  </div>
                  
                  <div className="token-trading-slippage-custom">
                    <input
                      type="number"
                      className="token-trading-input"
                      value={(slippage / 100).toFixed(1)}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        handleSlippageChange(Math.round(value * 100));
                      }}
                      placeholder="Custom %"
                      min="0.1"
                      max="10"
                      step="0.1"
                    />
                    <span className="token-trading-slippage-unit">%</span>
                  </div>
                </div>
              )}
              
              {/* Price Impact Display */}
              {amount > 0 && priceImpact > 0 && (
                <div className="token-trading-price-impact">
                  <span>Estimated Price Impact: </span>
                  <span 
                    style={{ color: getPriceImpactColor(priceImpact) }}
                    className="token-trading-price-impact-value"
                  >
                    {(priceImpact / 100).toFixed(2)}%
                  </span>
                  {priceImpact > slippage && (
                    <div className="token-trading-slippage-warning">
                      ⚠️ Price impact exceeds slippage tolerance
                    </div>
                  )}
                </div>
              )}
            </div>

            <button 
              className={`token-trading-button ${tradeType === 'buy' ? 'token-trading-buy-button' : 'token-trading-sell-button'}`}
              onClick={() => tradeType === 'buy' ? handleBuy() : handleSell()}
            >
              {tradeType === 'buy' ? 'Buy' : 'Sell'}
            </button>
          </div>

          <div className="token-trading-data">
            <div className="token-trading-data-image">
              {tokenDetails.image ? (
                <img 
                  src={tokenDetails.image} 
                  alt={tokenDetails.name} 
                />
              ) : (
                <div className="no-image">No Image</div>
              )}
            </div>
            <div className="token-trading-data-name">{tokenDetails.name}</div>
            
            <div className="token-trading-progress-container">
              <div className="token-trading-progress-label">
                <span>DEX Listing Progress</span>
                <span>45%</span>
              </div>
              <div className="token-trading-progress-bar">
                <div className="token-trading-progress-fill"></div>
              </div>
            </div>

            <div className="token-trading-links">
              <button 
                className="token-trading-link-button"
                onClick={() => tokenDetails.twitterLink && window.open(tokenDetails.twitterLink, '_blank')}
                disabled={!tokenDetails.twitterLink}
              >
                Twitter
              </button>
              <button 
                className="token-trading-link-button"
                onClick={() => tokenDetails.websiteLink && window.open(tokenDetails.websiteLink, '_blank')}
                disabled={!tokenDetails.websiteLink}
              >
                Website
              </button>
            </div>

            <button 
              className={`token-trading-copy-button ${copied ? 'copied' : ''}`}
              onClick={handleCopyCA}
            >
              {copied ? 'Copied!' : 'Copy Contract Address'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenPage;