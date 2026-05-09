import { useMemo } from 'react';
import { useTokenTrades } from '../data/useTokenTrades';
import { priceAtAPT } from '../lib/bondingCurve';

export interface OHLCCandle {
  time: number; // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RecentTrade {
  type: 'buy' | 'sell';
  wallet: string;
  amount: number;
  aptValue: number;
  timestampMs: number;
}

export type Timeframe = '1m' | '15m' | '1H' | '4H' | '1D' | 'ALL';

const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1m':  60 * 1000,
  '15m': 15 * 60 * 1000,
  '1H':  60 * 60 * 1000,
  '4H':  4 * 60 * 60 * 1000,
  '1D':  24 * 60 * 60 * 1000,
  'ALL': 7 * 24 * 60 * 60 * 1000,
};

interface UseOHLCDataReturn {
  candles: OHLCCandle[];
  recentTrades: RecentTrade[];
  loading: boolean;
  holderCount: number;
  aptRaised: number; // octas
  refetch: () => void;
}

// Pure transformation over useTokenTrades. No fetching, no fallbacks, no unit
// conversions — every consumer of trade history shares the same source.
export function useOHLCData(
  metadataAddr: string | undefined,
  timeframe: Timeframe,
  // refreshSignal kept for backward compatibility but ignored — React Query polls
  _refreshSignal?: number,
): UseOHLCDataReturn {
  const { data, isLoading, refetch } = useTokenTrades(metadataAddr);
  const trades = data?.trades ?? [];

  const recentTrades = useMemo<RecentTrade[]>(() => {
    return [...trades]
      .sort((a, b) => b.timestampMs - a.timestampMs || b.txVersion - a.txVersion)
      .map(t => ({
        type: t.type,
        wallet: t.wallet,
        amount: t.amount,
        aptValue: t.aptValue,
        timestampMs: t.timestampMs,
      }));
  }, [trades]);

  const holderCount = useMemo(() => {
    const buyers = new Set<string>();
    for (const t of trades) if (t.type === 'buy' && t.wallet) buyers.add(t.wallet.toLowerCase());
    return buyers.size;
  }, [trades]);

  const aptRaised = useMemo(() => {
    // Sum buy aptValue minus sell aptValue. Octas. (Live vault total_apt_spent
    // from useTokenLive is the canonical value — this is here for components
    // that haven't migrated yet.)
    let octas = 0;
    for (const t of trades) {
      const sign = t.type === 'buy' ? 1 : -1;
      octas += sign * t.aptValue * 1e8;
    }
    return Math.max(0, Math.round(octas));
  }, [trades]);

  const candles = useMemo<OHLCCandle[]>(() => {
    if (trades.length === 0) return [];
    const intervalMs = TIMEFRAME_MS[timeframe];
    const intervalSec = Math.floor(intervalMs / 1000);
    const candleMap = new Map<number, OHLCCandle>();

    // Trades are already sorted ascending by tx version from the endpoint
    for (const t of trades) {
      const bucketSec = Math.floor(Math.floor(t.timestampMs / intervalMs) * intervalMs / 1000);
      const price = priceAtAPT(t.tokensSoldAfter);
      const ex = candleMap.get(bucketSec);
      if (!ex) {
        candleMap.set(bucketSec, {
          time: bucketSec, open: price, high: price, low: price, close: price, volume: t.amount,
        });
      } else {
        ex.high = Math.max(ex.high, price);
        ex.low = Math.min(ex.low, price);
        ex.close = price;
        ex.volume += t.amount;
      }
    }

    const sortedCandles = Array.from(candleMap.values()).sort((a, b) => a.time - b.time);

    // Fill empty buckets with flat candles so every timeframe shows a continuous
    // line. Upper bound includes "now" and the latest candle, whichever is later
    // (Aptos node clock can run ahead of browser).
    const filled: OHLCCandle[] = [];
    const nowBucket = Math.floor(Date.now() / 1000 / intervalSec) * intervalSec;
    const lastBucket = sortedCandles[sortedCandles.length - 1].time;
    const endSec = Math.max(nowBucket, lastBucket);
    let prevClose = sortedCandles[0].open;
    let si = 0;
    for (let s = sortedCandles[0].time; s <= endSec; s += intervalSec) {
      if (si < sortedCandles.length && sortedCandles[si].time === s) {
        filled.push(sortedCandles[si]);
        prevClose = sortedCandles[si].close;
        si++;
      } else {
        filled.push({ time: s, open: prevClose, high: prevClose, low: prevClose, close: prevClose, volume: 0 });
      }
    }
    return filled;
  }, [trades, timeframe]);

  return {
    candles,
    recentTrades,
    loading: isLoading,
    holderCount,
    aptRaised,
    refetch: () => { refetch(); },
  };
}
