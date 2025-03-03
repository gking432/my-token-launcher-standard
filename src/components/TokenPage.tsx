import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network, UserTransactionResponse } from "@aptos-labs/ts-sdk";
import { InputTransactionData } from "@aptos-labs/wallet-adapter-core";
import { createChart, IChartApi, ISeriesApi, Time } from "lightweight-charts";
import "../MoveMint.css";

const config = new AptosConfig({ network: Network.DEVNET });
const client = new Aptos(config);

interface TokenDetails {
  name: string;
  symbol: string;
  supply: number;
  txHash: string;
}

interface OHLC {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

function isUserTransactionResponse(transaction: any): transaction is UserTransactionResponse {
  return transaction.type === "user_transaction";
}

const TokenPage: React.FC = () => {
  const { coinHash } = useParams<{ coinHash?: string }>();
  const { account, signAndSubmitTransaction } = useWallet();
  const [tokenDetails, setTokenDetails] = useState<TokenDetails | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [timeframe, setTimeframe] = useState<string>("1d");
  const [isMounted, setIsMounted] = useState(false);
  const [refreshChart, setRefreshChart] = useState<number>(0);
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const fixedPrice = 0.001;
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick", Time> | null>(null);
  const tokenLauncherAddress = "0xc156a41155e21f972e4158caf1cac90311543b062f49b45536d6fd17708a4198";
  const coinType = `${tokenLauncherAddress}::token_launcher::GenericMemecoin`;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch token details
  useEffect(() => {
    if (!coinHash) return;

    try {
      console.log("Fetching token details from localStorage...");
      const usersRaw = localStorage.getItem("users");
      console.log("Raw users data:", usersRaw);
      const users = JSON.parse(usersRaw || "{}");
      console.log("Parsed users:", users);

      let foundToken: TokenDetails | null = null;
      for (const wallet in users) {
        if (users[wallet]?.launchedTokens) {
          const token = users[wallet].launchedTokens.find(
            (t: TokenDetails) => t.txHash === coinHash
          );
          if (token) {
            foundToken = token;
            break;
          }
        }
      }
      console.log("Found token:", foundToken);
      setTokenDetails(foundToken);
    } catch (error) {
      console.error("Error fetching token details from localStorage:", error);
      setTokenDetails(null);
    }
  }, [coinHash]);

  // Register and fetch balance with improved retry logic
  useEffect(() => {
    const registerAndFetchTokenBalance = async () => {
      if (!account?.address) {
        console.log("No wallet connected, cannot fetch token balance.");
        setTokenBalance(null);
        return;
      }

      try {
        console.log("Checking if wallet is registered for GenericMemecoin...");
        let resource: any = null;
        const maxRetries = 3;
        let retries = 0;

        // Initial check for CoinStore
        try {
          resource = await client.getAccountResource({
            accountAddress: account.address,
            resourceType: `0x1::coin::CoinStore<${coinType}>`,
          });
          console.log("Initial CoinStore resource:", resource);
        } catch (error: any) {
          if (error.message.includes("Resource not found")) {
            console.log("CoinStore not found, registering GenericMemecoin...");
            const registerTransaction: InputTransactionData = {
              data: {
                function: "0x1::coin::register",
                typeArguments: [coinType],
                functionArguments: [],
              },
            };
            const response = await signAndSubmitTransaction(registerTransaction);
            console.log("Register transaction response:", response);
            await client.waitForTransaction({ transactionHash: response.hash });
            console.log(`Registered GenericMemecoin. Tx: ${response.hash}`);

            // Retry fetching with delay
            let retryError: any = null;
            while (retries < maxRetries) {
              try {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                resource = await client.getAccountResource({
                  accountAddress: account.address,
                  resourceType: `0x1::coin::CoinStore<${coinType}>`,
                });
                console.log(`Retry ${retries + 1} - CoinStore resource:`, resource);
                retryError = null; // Clear error if successful
                break;
              } catch (err) {
                retries++;
                retryError = err;
                console.error(`Retry ${retries} failed:`, retryError);
                if (retries === maxRetries) {
                  throw new Error(`Failed to fetch CoinStore after ${maxRetries} retries: ${retryError}`);
                }
              }
            }
            if (retryError) throw retryError; // Ensure error is thrown if all retries fail
          } else {
            throw error;
          }
        }

        // Ensure resource is set before proceeding
        if (!resource || !resource.data) {
          console.error("Resource fetch failed or returned no data after all retries:", resource);
          setTokenBalance("0");
          return;
        }

        // Access balance directly
        const balanceData = resource.data.coin?.value;
        if (balanceData === undefined || balanceData === null) {
          console.error("Balance data is undefined or null:", resource.data);
          setTokenBalance("0");
          return;
        }

        const balance = Number(balanceData) / 10 ** 6;
        setTokenBalance(balance.toString());
        console.log(`Token balance for ${account.address}: ${balance}`);
      } catch (error) {
        console.error("Error fetching token balance:", error);
        setTokenBalance("0");
      }
    };

    registerAndFetchTokenBalance();
  }, [account?.address, refreshChart]);

  // Chart setup
  useEffect(() => {
    try {
      if (!isMounted || !chartContainerRef.current) {
        console.log("Component not yet mounted or chart container null, waiting...");
        return;
      }

      console.log("Chart container ready, initializing chart...");
      chartRef.current = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 400,
        layout: { background: { color: "#ffffff" }, textColor: "#333" },
        grid: { vertLines: { color: "#f0f0f0" }, horzLines: { color: "#f0f0f0" } },
        timeScale: { timeVisible: true, secondsVisible: false },
      });

      if (chartRef.current && typeof chartRef.current.addCandlestickSeries === "function") {
        seriesRef.current = chartRef.current.addCandlestickSeries({
          upColor: "#26a69a",
          downColor: "#ef5350",
          borderVisible: false,
          wickUpColor: "#26a69a",
          wickDownColor: "#ef5350",
        });
        console.log("Chart and series initialized:", { chartRef: chartRef.current, seriesRef: seriesRef.current });

        const mockData: OHLC[] = [
          { time: Math.floor(Date.now() / 1000) - 86400 * 2 as Time, open: 0.001, high: 0.002, low: 0.001, close: 0.0015 },
          { time: Math.floor(Date.now() / 1000) - 86400 as Time, open: 0.0015, high: 0.003, low: 0.0015, close: 0.002 },
          { time: Math.floor(Date.now() / 1000) as Time, open: 0.002, high: 0.0025, low: 0.0018, close: 0.0023 },
        ];
        seriesRef.current.setData(mockData);
        chartRef.current.timeScale().fitContent();
        console.log("Set mock chart data:", mockData);
      } else {
        console.error("Failed to initialize chart:", chartRef.current);
        return;
      }

      const fetchAndUpdateChart = async () => {
        console.log("Fetching chart data...");
        try {
          const ohlcData = await fetchDepositEvents(timeframe);
          console.log("OHLC Data from events:", ohlcData);
          if (ohlcData.length > 0 && seriesRef.current && chartRef.current) {
            console.log("Setting real chart data from events:", ohlcData);
            seriesRef.current.setData(ohlcData);
            chartRef.current.timeScale().fitContent();
          } else {
            console.log("No events found, trying balance polling...");
            const balanceData = await fetchBalanceChanges(timeframe);
            if (balanceData.length > 0 && seriesRef.current && chartRef.current) {
              console.log("Setting chart data from balance polling:", balanceData);
              seriesRef.current.setData(balanceData);
              chartRef.current.timeScale().fitContent();
            } else {
              console.log("No real data to display, keeping mock data.");
            }
          }
        } catch (error) {
          console.error("Error in fetchAndUpdateChart:", error);
        }
      };
      fetchAndUpdateChart();
    } catch (error) {
      console.error("Error in chart useEffect:", error);
      throw error;
    }

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: 400,
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
  }, [isMounted, timeframe, refreshChart, account?.address]);

  async function fetchDepositEvents(timeframe: string) {
    try {
      if (!account?.address) {
        console.warn("No wallet connected, cannot fetch events.");
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
            `0x1::coin::DepositEvent<${coinType}>`,
            `0x1::coin::WithdrawEvent<${coinType}>`,
            `${tokenLauncherAddress}::token_launcher::DepositEvent`,
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
      if (!account?.address) {
        console.warn("No wallet connected, cannot fetch balance changes.");
        return [];
      }

      // Fetch balance of token launcher over time (simplified polling simulation)
      const ohlcData: OHLC[] = [];
      const timeframeSeconds = { "1h": 3600, "1d": 86400, "1w": 604800 }[timeframe] || 86400;
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - timeframeSeconds * 5; // Last 5 timeframes
      const interval = timeframeSeconds / 5; // 5 data points

      for (let t = startTime; t <= now; t += interval) {
        let balance = 0;
        try {
          const resource = await client.getAccountResource({
            accountAddress: tokenLauncherAddress,
            resourceType: `0x1::coin::CoinStore<${coinType}>`,
          });
          console.log(`Balance resource at time ${t} for token launcher:`, resource);
          const balanceData = resource?.data?.coin?.value;
          if (balanceData === undefined || balanceData === null) {
            console.warn(`No valid balance data for token launcher at time ${t}:`, resource?.data);
            balance = 0;
          } else {
            balance = Number(balanceData) / 10 ** 6;
          }
        } catch (error: any) {
          if (error.message.includes("Resource not found")) {
            console.log("Token launcher has not registered CoinStore for GenericMemecoin at time", t);
            balance = 0;
          } else {
            console.error(`Error fetching balance at time ${t}:`, error);
            balance = 0;
          }
        }

        // Simulate price based on balance (arbitrary logic for demo)
        const price = fixedPrice * (1 + balance / 1000000); // Adjust price based on balance
        ohlcData.push({
          time: t as Time,
          open: price,
          high: price,
          low: price,
          close: price,
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
    const timeframeSeconds = { "1h": 3600, "1d": 86400, "1w": 604800 }[timeframe] || 86400;
    const groupedByTime: { [key: number]: number[] } = {};

    events.forEach((event: any) => {
      console.log("Event:", event);
      const timestamp = Math.floor(Number(event.transaction_timestamp) / 1000000);
      if (!timestamp || timestamp <= 0) {
        console.warn("Skipping event with invalid timestamp:", event);
        return;
      }

      const bucket = Math.floor(timestamp / timeframeSeconds) * timeframeSeconds;
      if (!groupedByTime[bucket]) groupedByTime[bucket] = [];
      groupedByTime[bucket].push(fixedPrice);
    });

    for (const bucket in groupedByTime) {
      const prices = groupedByTime[bucket];
      if (prices.length === 0) continue;
      ohlcData.push({
        time: Number(bucket) as Time,
        open: prices[0],
        high: Math.max(...prices),
        low: Math.min(...prices),
        close: prices[prices.length - 1],
      });
    }
    return ohlcData.sort((a, b) => Number(a.time) - Number(b.time));
  }

  const handleBuy = async () => {
    if (!account || amount <= 0) {
      alert("Connect wallet and enter a valid amount.");
      return;
    }

    try {
      // First, transfer APT to the token launcher to "pay" for the tokens
      const aptAmount = Math.floor(amount * fixedPrice * 10 ** 8); // APT has 8 decimals
      const payTransaction: InputTransactionData = {
        data: {
          function: "0x1::aptos_account::transfer",
          typeArguments: [],
          functionArguments: [tokenLauncherAddress, aptAmount],
        },
      };
      const payResponse = await signAndSubmitTransaction(payTransaction);
      console.log("APT transfer response:", payResponse);
      await client.waitForTransaction({ transactionHash: payResponse.hash });
      console.log(`Transferred ${aptAmount} APT to token launcher. Tx: ${payResponse.hash}`);

      // Then, call the token launcher's buy function to receive tokens
      const buyTransaction: InputTransactionData = {
        data: {
          function: `${tokenLauncherAddress}::token_launcher::buy_tokens`,
          typeArguments: [],
          functionArguments: [amount * 10 ** 6], // Token amount (assuming 6 decimals)
        },
      };
      const response = await signAndSubmitTransaction(buyTransaction);
      console.log("Buy transaction response:", response);
      await client.waitForTransaction({ transactionHash: response.hash });
      alert(`Bought ${amount} ${tokenDetails?.symbol}! Tx: ${response.hash}`);

      const txDetails = await client.getTransactionByHash({ transactionHash: response.hash });
      console.log("Transaction details:", txDetails);
      if (isUserTransactionResponse(txDetails)) {
        console.log("Events emitted by BUY transaction:", txDetails.events);
      } else {
        console.log("BUY transaction is not a UserTransactionResponse or has no events:", txDetails);
      }

      setTimeout(() => setRefreshChart((prev) => prev + 1), 2000);
    } catch (error) {
      console.error("Buy failed:", error);
      alert("Failed to buy tokens. Please check the console for details.");
    }
  };

  const handleSell = async () => {
    if (!account || amount <= 0) {
      alert("Connect wallet and enter a valid amount.");
      return;
    }

    try {
      const sellTransaction: InputTransactionData = {
        data: {
          function: "0x1::coin::transfer",
          typeArguments: [coinType],
          functionArguments: [tokenLauncherAddress, amount * 10 ** 6],
        },
      };
      const response = await signAndSubmitTransaction(sellTransaction);
      console.log("Sell transaction response:", response);
      await client.waitForTransaction({ transactionHash: response.hash });
      alert(`Sold ${amount} ${tokenDetails?.symbol}! Tx: ${response.hash}`);

      const txDetails = await client.getTransactionByHash({ transactionHash: response.hash });
      console.log("Transaction details:", txDetails);
      if (isUserTransactionResponse(txDetails)) {
        console.log("Events emitted by SELL transaction:", txDetails.events);
      } else {
        console.log("SELL transaction is not a UserTransactionResponse or has no events:", txDetails);
      }

      setTimeout(() => setRefreshChart((prev) => prev + 1), 2000);
    } catch (error) {
      console.error("Sell failed:", error);
      alert("Failed to sell tokens. Please check the console for details.");
    }
  };

  if (!coinHash) return <div className="token-page">No coin hash provided.</div>;
  if (!tokenDetails) return <div className="token-page">Loading token data or token not found...</div>;

  console.log("Rendering chart container...");
  return (
    <div className="token-page">
      <div className="token-container">
        <h1>{tokenDetails?.name || "Loading..."} ({tokenDetails?.symbol || "N/A"})</h1>
        <p><strong>Total Supply:</strong> {tokenDetails?.supply != null ? Number(tokenDetails.supply).toLocaleString() : "N/A"}</p>
        {account && (
          <p><strong>Your Balance:</strong> {tokenBalance !== null ? `${tokenBalance} ${tokenDetails?.symbol}` : "Loading..."}</p>
        )}
        <p>
          <strong>Transaction Hash:</strong>{" "}
          {tokenDetails?.txHash ? (
            <a href={`https://explorer.aptoslabs.com/txn/${tokenDetails.txHash}?network=devnet`} target="_blank" rel="noopener noreferrer">
              {tokenDetails.txHash.slice(0, 6)}...{tokenDetails.txHash.slice(-6)}
            </a>
          ) : "N/A"}
        </p>
        <div className="chart-section">
          <h2>Price Chart</h2>
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} style={{ marginBottom: "10px" }}>
            <option value="1h">1 Hour</option>
            <option value="1d">1 Day</option>
            <option value="1w">1 Week</option>
          </select>
          <div ref={chartContainerRef} style={{ position: "relative", width: "100%", height: "400px" }} />
        </div>
        <div className="buy-sell-section">
          <h2>Trade {tokenDetails?.symbol || "N/A"}</h2>
          <p>Price: {fixedPrice} APT per token</p>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="Enter amount"
            min="0"
          />
          <div className="buy-sell-buttons">
            <button className="buy-btn" onClick={handleBuy} disabled={!account}>Buy</button>
            <button className="sell-btn" onClick={handleSell} disabled={!account}>Sell</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenPage;