import React, { useState, useEffect, useRef } from 'react';
import { useRealTimePrice } from '../contexts/RealTimePriceContext';
import './LiveTradeFeed.css';

interface Trade {
  id: string;
  type: 'buy' | 'sell';
  tokenAddress: string;
  tokenSymbol: string;
  amount: number;
  priceAPT: number;
  priceUSD: number;
  timestamp: number;
  buyer?: string;
  seller?: string;
}

interface LiveTradeFeedProps {
  tokenAddress?: string; // If provided, only show trades for this token
  maxTrades?: number; // Maximum number of trades to display
  showAnimations?: boolean; // Whether to show trade animations
}

const LiveTradeFeed: React.FC<LiveTradeFeedProps> = ({ 
  tokenAddress, 
  maxTrades = 20,
  showAnimations = true 
}) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const { getTokenPrice } = useRealTimePrice();
  const tradesEndRef = useRef<HTMLDivElement>(null);

  // Mock trade data generator (replace with real data from your API)
  const generateMockTrade = (): Trade => {
    const tokens = [
      { address: '0x123...abc', symbol: 'DOGE' },
      { address: '0x456...def', symbol: 'SHIB' },
      { address: '0x789...ghi', symbol: 'PEPE' },
    ];
    
    const token = tokens[Math.floor(Math.random() * tokens.length)];
    const type = Math.random() > 0.5 ? 'buy' : 'sell';
    const amount = Math.random() * 1000000 + 10000; // 10k to 1M tokens
    const priceAPT = Math.random() * 0.001 + 0.0001; // 0.0001 to 0.001 APT
    const tokenPrice = getTokenPrice(token.address);
    const priceUSD = tokenPrice ? tokenPrice.priceUSD : priceAPT * 8; // Fallback to $8 APT

    return {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      tokenAddress: token.address,
      tokenSymbol: token.symbol,
      amount,
      priceAPT,
      priceUSD,
      timestamp: Date.now(),
      buyer: type === 'buy' ? `0x${Math.random().toString(16).substr(2, 8)}...` : undefined,
      seller: type === 'sell' ? `0x${Math.random().toString(16).substr(2, 8)}...` : undefined,
    };
  };

  // Simulate real-time trades (replace with actual WebSocket or polling)
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      const newTrade = generateMockTrade();
      
      // Filter by token address if specified
      if (tokenAddress && newTrade.tokenAddress !== tokenAddress) {
        return;
      }

      setTrades(prevTrades => {
        const updatedTrades = [newTrade, ...prevTrades].slice(0, maxTrades);
        return updatedTrades;
      });

      // Auto-scroll to bottom
      if (tradesEndRef.current) {
        tradesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 2000 + Math.random() * 3000); // Random interval between 2-5 seconds

    return () => clearInterval(interval);
  }, [isVisible, tokenAddress, maxTrades, getTokenPrice]);

  const formatAmount = (amount: number): string => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toFixed(0);
  };

  const formatPrice = (price: number): string => {
    if (price >= 1) {
      return `$${price.toFixed(2)}`;
    } else if (price >= 0.01) {
      return `$${price.toFixed(4)}`;
    } else {
      return `$${price.toFixed(6)}`;
    }
  };

  const formatTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) { // Less than 1 minute
      return `${Math.floor(diff / 1000)}s ago`;
    } else if (diff < 3600000) { // Less than 1 hour
      return `${Math.floor(diff / 60000)}m ago`;
    } else {
      return new Date(timestamp).toLocaleTimeString();
    }
  };

  const filteredTrades = tokenAddress 
    ? trades.filter(trade => trade.tokenAddress === tokenAddress)
    : trades;

  return (
    <div className="live-trade-feed">
      <div className="trade-feed-header">
        <h3>Live Trades</h3>
        <div className="feed-controls">
          <button 
            className={`toggle-btn ${isVisible ? 'active' : ''}`}
            onClick={() => setIsVisible(!isVisible)}
          >
            {isVisible ? '⏸️' : '▶️'}
          </button>
          <span className="trade-count">{filteredTrades.length} trades</span>
        </div>
      </div>

      <div className="trades-container">
        {filteredTrades.length === 0 ? (
          <div className="no-trades">
            <p>No trades yet</p>
            <small>Waiting for trading activity...</small>
          </div>
        ) : (
          filteredTrades.map((trade, index) => (
            <div 
              key={trade.id} 
              className={`trade-item ${trade.type} ${showAnimations ? 'animate-in' : ''}`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="trade-main">
                <div className="trade-type">
                  <span className={`type-badge ${trade.type}`}>
                    {trade.type === 'buy' ? '🟢 BUY' : '🔴 SELL'}
                  </span>
                </div>
                
                <div className="trade-details">
                  <div className="token-info">
                    <span className="token-symbol">{trade.tokenSymbol}</span>
                    <span className="trade-amount">{formatAmount(trade.amount)}</span>
                  </div>
                  
                  <div className="price-info">
                    <span className="price-usd">{formatPrice(trade.priceUSD)}</span>
                    <span className="price-apt">{trade.priceAPT.toFixed(6)} APT</span>
                  </div>
                </div>
              </div>
              
              <div className="trade-meta">
                <span className="trade-time">{formatTime(trade.timestamp)}</span>
                {trade.buyer && <span className="trader">Buyer: {trade.buyer}</span>}
                {trade.seller && <span className="trader">Seller: {trade.seller}</span>}
              </div>
            </div>
          ))
        )}
        <div ref={tradesEndRef} />
      </div>
    </div>
  );
};

export default LiveTradeFeed;
