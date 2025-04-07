import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network, UserTransactionResponse } from "@aptos-labs/ts-sdk";
import { InputTransactionData } from "@aptos-labs/wallet-adapter-core";
import { createChart, IChartApi, ISeriesApi, Time } from "lightweight-charts";
import "../MoveMint.css";
import "../styles/TokenPage.css";

// Contract addresses for different networks
const CONTRACT_ADDRESSES: Record<string, string> = {
  devnet: "0x01a528fbcae190eee5b60e58c9971af4a2143fe2c706b681d4de5d005fc0ec7f",
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

  const fixedPrice = 0.001;
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick", Time> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram", Time> | null>(null);

  const config = useMemo(() => new AptosConfig({ network: Network.DEVNET }), []);
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

  const fetchTokenBalance = async () => {
    const metadataAddress = tokenDetails?.metadataAddress || location.state?.metadataAddress || "0x0";
    console.log("Fetching balance - Account:", account?.address, "Metadata Address:", metadataAddress);

    if (!metadataAddress || metadataAddress === "0x0") {
      console.log("Metadata address not found, cannot fetch token balance.");
      setTokenBalance("0");
      return;
    }

    if (!account?.address) {
      console.log("No wallet connected, setting default balance.");
      setTokenBalance("0");
      return;
    }

    try {
      const accountAddressString = account.address.toString();
      console.log("Querying account resources for:", accountAddressString);
      const resources = await client.getAccountResources({ accountAddress: accountAddressString });
      console.log("Account resources (full):", JSON.stringify(resources, null, 2));

      const buyerStore = resources.find((r: any) => r.type.includes("token_launcher::BuyerStore")) as { data: { stores: { metadata_addr: string; store: { inner: string } }[] } } | undefined;

      if (!buyerStore) {
        console.warn("No BuyerStore found for account:", accountAddressString);
        setTokenBalance("0");
        return;
      }

      const storeEntry = buyerStore.data.stores.find((s: any) => s.metadata_addr === metadataAddress);
      if (!storeEntry) {
        console.warn("No store entry found for metadata address:", metadataAddress);
          setTokenBalance("0");
          return;
        }

      const storeAddress = storeEntry.store.inner;
      console.log("Fetching resources for store address:", storeAddress);
      const storeResources = await client.getAccountResources({ accountAddress: storeAddress });
      console.log("Store resources (full):", JSON.stringify(storeResources, null, 2));

      const fungibleStore = storeResources.find((r: any) => r.type.includes("fungible_asset::FungibleStore")) as { data: { balance: string } } | undefined;
      if (!fungibleStore) {
        console.warn("No FungibleStore found at:", storeAddress);
        setTokenBalance("0");
        return;
      }

      const balance = Number(fungibleStore.data.balance || 0) / 10 ** 6; // 6 decimals
      console.log(`Token balance for ${accountAddressString} from store ${storeAddress}:`, balance);
      setTokenBalance(balance.toString());
    } catch (error) {
      console.error("Error fetching token balance:", error);
        setTokenBalance("0");
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
      console.log("Full tokenDetails:", tokenDetails);
      console.log("handleBuy - account:", account, "amount:", amount, "creatorAddress:", tokenDetails?.creatorAddress, "symbol:", tokenDetails?.symbol);
      if (!account || amount <= 0 || !tokenDetails?.creatorAddress || !tokenDetails?.symbol) {
        alert("Connect wallet, enter a valid amount, or ensure token details are available.");
        return;
      }
    
      try {
        // Price per token is 0.0001 APT (10,000 octas)
        // If user enters N tokens, we need N * 10,000 octas
        const aptAmount = Math.floor(amount * 10000); // Convert token amount to APT octas
    
        const resources = await client.getAccountResources({
          accountAddress: account.address,
        });
        const aptosCoinStore = resources.find((r) =>
          r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
        ) as AptosCoinStore | undefined;
        if (!aptosCoinStore) {
          alert("Could not find APT balance.");
          return;
        }
        const balance = BigInt(aptosCoinStore.data.coin.value);
        if (balance < BigInt(aptAmount)) {
          alert("Insufficient APT balance.");
          return;
        }
    
        const tickerBytes = Buffer.from(tokenDetails.symbol, "utf8");
        console.log("Ticker sent (hex):", tickerBytes.toString("hex"));
        console.log("Buying tokens with params:", {
          creatorAddress: tokenDetails.creatorAddress,
          ticker: tickerBytes.toString("hex"),
          aptAmount: aptAmount
        });
    
        const buyTransaction: InputTransactionData = {
          data: {
            function: `${tokenLauncherAddress}::token_launcher::buy_tokens`,
            typeArguments: [],
            functionArguments: [
              tokenDetails.creatorAddress,
              tickerBytes,
              aptAmount
            ],
          },
        };
    
        try {
          const response = await signAndSubmitTransaction(buyTransaction);
          console.log("Buy response:", response);
        } catch (error) {
          console.error("Raw wallet error:", JSON.stringify(error, null, 2));
          throw error;
        }
    
        await fetchTokenBalance();
        setRefreshChart((prev) => prev + 1);
        setTimeout(() => setRefreshChart((prev) => prev + 1), 2000);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error("Buy error details:", {
          message: err.message,
          stack: err.stack,
          fullError: err
        });
        alert("Failed to buy tokens. Check console for details.");
      }
    };
  const handleSell = async () => {
    if (!account || amount <= 0 || !tokenDetails?.creatorAddress || !tokenDetails?.symbol) {
      alert("Connect wallet, enter a valid amount, or ensure token details are available.");
      return;
    }
  
    try {
      const tokenAmount = Math.floor(amount * 10 ** 6); // 1 token = 1M units
      const aptAmount = Math.floor(tokenAmount * 10000 / 10 ** 6); // For display
  
      // Debug tokenDetails
      console.log("tokenDetails:", JSON.stringify(tokenDetails, null, 2));
  
      // Fetch FA store address for debugging
      const metadataAddress = tokenDetails?.metadataAddress || location.state?.metadataAddress || "0xc3095335a9984a5234c032e77e8f6777b6d3265300facb1325f57478f8a51d16";
      console.log("Metadata address being searched:", metadataAddress);
  
      const resources = await client.getAccountResources({ accountAddress: account.address });
      console.log("All account resources:", JSON.stringify(resources, null, 2));
  
      const buyerStore = resources.find((r: any) => r.type.includes("token_launcher::BuyerStore")) as BuyerStoreResource | undefined;
      if (!buyerStore || !buyerStore.data) {
        alert("No BuyerStore found—can't sell.");
        return;
      }
      console.log("BuyerStore data:", JSON.stringify(buyerStore.data, null, 2));
  
      const storeEntry = buyerStore.data.stores?.find((s) => s.metadata_addr === metadataAddress);
      if (!storeEntry) {
        alert("No store for $gl2—can't sell.");
        return;
      }
      const storeAddress = storeEntry.store.inner;
      console.log(`Found $gl2 store at: ${storeAddress}`);
  
      // Log balance
      await fetchTokenBalance();
      console.log(`Pre-sell balance check: ${tokenBalance} $gl2 (need ${tokenAmount / 10 ** 6})`);
  
      console.log("Selling tokens with params:", {
        creatorAddress: tokenDetails.creatorAddress,
        ticker: tokenDetails.symbol,
        tokenAmount: tokenAmount
      });
  
      const sellTransaction: InputTransactionData = {
        data: {
          function: `${tokenLauncherAddress}::token_launcher::sell_tokens`,
          typeArguments: [],
          functionArguments: [
            tokenDetails.creatorAddress,
            tokenDetails.symbol,
            tokenAmount
          ],
        },
      };
      const response = await signAndSubmitTransaction(sellTransaction);
      console.log("Sell transaction response:", response);
      await client.waitForTransaction({ transactionHash: response.hash });
      alert(`Sold ${amount} ${tokenDetails.symbol} for ${aptAmount / 10 ** 8} APT! Tx: ${response.hash}`);
  
      await fetchTokenBalance();
      setRefreshChart((prev) => prev + 1);
      setTimeout(() => setRefreshChart((prev) => prev + 1), 2000);
    } catch (error) {
      console.error("Sell failed:", error);
      alert("Failed to sell tokens. Check console.");
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
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="Enter amount"
              />
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