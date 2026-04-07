import { useState, useEffect, useCallback } from 'react';
import { getPurchaseEvents, getSaleEvents } from '../utils/aptosIndexer';

export interface OHLCCandle {
  time: number; // Unix timestamp in seconds (for lightweight-charts)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Timeframe = '1m' | '15m' | '1H' | '4H' | '1D' | 'ALL';

const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1m':  60 * 1000,
  '15m': 15 * 60 * 1000,
  '1H':  60 * 60 * 1000,
  '4H':  4 * 60 * 60 * 1000,
  '1D':  24 * 60 * 60 * 1000,
  'ALL': 7 * 24 * 60 * 60 * 1000, // 1-week candles for "ALL"
};

function calculateBondingCurvePrice(tokensSold: number): number {
  const PRICE_NUMERATOR = 19029514756;
  const PRICE_CONSTANT = 61.9053276;
  const MAX_TOKENS = 800000000;
  const denominator = MAX_TOKENS - tokensSold;
  if (denominator <= 0) return 0;
  return (PRICE_NUMERATOR / denominator + PRICE_CONSTANT) / 100_000_000;
}

// Aptos timestamps are in microseconds. Convert to milliseconds.
function toMs(ts: number): number {
  if (ts > 1e15) return ts / 1000;      // nanoseconds → ms
  if (ts > 1e12) return ts / 1000;      // microseconds → ms
  if (ts > 1e9)  return ts;             // already ms
  return ts * 1000;                     // seconds → ms
}

interface UseOHLCDataReturn {
  candles: OHLCCandle[];
  loading: boolean;
  holderCount: number;
  refetch: () => void;
}

export function useOHLCData(
  metadataAddr: string | undefined,
  timeframe: Timeframe,
  refreshSignal?: number,
): UseOHLCDataReturn {
  const [candles, setCandles] = useState<OHLCCandle[]>([]);
  const [loading, setLoading] = useState(false);
  const [holderCount, setHolderCount] = useState(0);

  const fetchAndAggregate = useCallback(async () => {
    if (!metadataAddr || metadataAddr === 'Unknown') return;

    setLoading(true);
    try {
      const [purchases, sales] = await Promise.all([
        getPurchaseEvents(metadataAddr, 1000),
        getSaleEvents(metadataAddr, 1000),
      ]);

      // Count unique buyers for holder count
      const buyers = new Set<string>();
      for (const p of purchases) {
        if (p.buyer) buyers.add(p.buyer.toLowerCase());
      }
      setHolderCount(buyers.size);

      // Combine all trade events
      type TradeEvent = { timestampMs: number; tokensSold: number; amount: number };
      const trades: TradeEvent[] = [];

      for (const p of purchases) {
        const ts = parseInt(p.timestamp || '0');
        const tokensSold = parseInt(p.tokens_sold || '0');
        const amount = parseInt(p.amount || '0');
        if (ts > 0 && amount > 0) {
          trades.push({ timestampMs: toMs(ts), tokensSold, amount });
        }
      }
      for (const s of sales) {
        const ts = parseInt(s.timestamp || '0');
        const tokensSold = parseInt(s.tokens_sold || '0');
        const amount = parseInt(s.amount || '0');
        if (ts > 0 && amount > 0) {
          trades.push({ timestampMs: toMs(ts), tokensSold, amount });
        }
      }

      if (trades.length === 0) {
        setCandles([]);
        return;
      }

      // Sort by timestamp ascending
      trades.sort((a, b) => a.timestampMs - b.timestampMs);

      const intervalMs = TIMEFRAME_MS[timeframe];

      // Build OHLC candles
      const candleMap = new Map<number, OHLCCandle>();

      for (const trade of trades) {
        const bucketMs = Math.floor(trade.timestampMs / intervalMs) * intervalMs;
        const bucketSec = Math.floor(bucketMs / 1000);
        const price = calculateBondingCurvePrice(trade.tokensSold);

        const existing = candleMap.get(bucketSec);
        if (!existing) {
          candleMap.set(bucketSec, {
            time: bucketSec,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: trade.amount,
          });
        } else {
          existing.high = Math.max(existing.high, price);
          existing.low = Math.min(existing.low, price);
          existing.close = price;
          existing.volume += trade.amount;
        }
      }

      const sorted = Array.from(candleMap.values()).sort((a, b) => a.time - b.time);
      setCandles(sorted);
    } catch (err) {
      console.error('useOHLCData error:', err);
      setCandles([]);
    } finally {
      setLoading(false);
    }
  }, [metadataAddr, timeframe, refreshSignal]);

  useEffect(() => {
    fetchAndAggregate();
  }, [fetchAndAggregate]);

  return { candles, loading, holderCount, refetch: fetchAndAggregate };
}
