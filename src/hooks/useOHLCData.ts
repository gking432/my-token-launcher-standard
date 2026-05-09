import { useState, useEffect, useCallback } from 'react';
import { getPurchaseEvents, getSaleEvents, fetchActivitiesFallback } from '../utils/aptosIndexer';

export interface OHLCCandle {
  time: number; // Unix timestamp in seconds (for lightweight-charts)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RecentTrade {
  type: 'buy' | 'sell';
  wallet: string;
  amount: number;       // tokens
  aptValue: number;     // APT
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

function calculateBondingCurvePrice(tokensSold: number): number {
  const PRICE_NUMERATOR = 19029514756;
  const PRICE_CONSTANT = 61.9053276;
  const MAX_TOKENS = 800000000;
  const denominator = MAX_TOKENS - tokensSold;
  if (denominator <= 0) return 0;
  return (PRICE_NUMERATOR / denominator + PRICE_CONSTANT) / 100_000_000;
}

function approxAptValue(amount: number, tokensSoldAfter: number): number {
  const before = Math.max(0, tokensSoldAfter - amount);
  const p0 = calculateBondingCurvePrice(before);
  const p1 = calculateBondingCurvePrice(tokensSoldAfter);
  return ((p0 + p1) / 2) * amount;
}

// Aptos timestamps are in microseconds → convert to ms.
function toMs(ts: number): number {
  if (ts > 1e15) return ts / 1000;
  if (ts > 1e12) return ts / 1000;
  if (ts > 1e9)  return ts;
  return ts * 1000;
}

interface UseOHLCDataReturn {
  candles: OHLCCandle[];
  recentTrades: RecentTrade[];
  loading: boolean;
  holderCount: number;
  aptRaised: number; // cumulative APT raised via bonding curve, in Octas
  refetch: () => void;
}

export function useOHLCData(
  metadataAddr: string | undefined,
  timeframe: Timeframe,
  refreshSignal?: number,
): UseOHLCDataReturn {
  const [candles, setCandles] = useState<OHLCCandle[]>([]);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [holderCount, setHolderCount] = useState(0);
  const [aptRaised, setAptRaised] = useState(0);

  const fetchAndAggregate = useCallback(async () => {
    if (!metadataAddr || metadataAddr === 'Unknown') return;

    console.log('[useOHLCData] fetching for addr:', metadataAddr, 'timeframe:', timeframe);
    setLoading(true);
    const addrLower = metadataAddr.toLowerCase();
    try {
      let [purchases, sales] = await Promise.all([
        getPurchaseEvents(addrLower, 1000).catch(() => [] as any[]),
        getSaleEvents(addrLower, 1000).catch(() => [] as any[]),
      ]);

      // Geomi indexer has no data yet (catching up after pause) — fall back to
      // fungible_asset_activities from the standard Aptos indexer. This covers
      // ALL buyers and sellers via Mint/Burn events, no indexer dependency.
      if (purchases.length === 0 && sales.length === 0) {
        console.log('[useOHLCData] Geomi empty, trying fungible_asset_activities fallback...');
        try {
          const fallback = await fetchActivitiesFallback(addrLower);
          purchases = fallback.purchases;
          sales = fallback.sales;
          if (purchases.length > 0 || sales.length > 0) {
            console.log('[useOHLCData] activities fallback:', purchases.length, 'purchases,', sales.length, 'sales');
          }
        } catch (err: any) {
          console.warn('[useOHLCData] activities fallback failed:', err?.message);
        }
      }
      console.log('[useOHLCData] purchases:', purchases.length, 'sales:', sales.length);
      if (purchases.length > 0) console.log('[useOHLCData] first purchase:', purchases[0]);

      // Unique buyers → holder count
      const buyers = new Set<string>();
      for (const p of purchases) {
        if (p.buyer) buyers.add(p.buyer.toLowerCase());
      }
      setHolderCount(buyers.size);

      // liquidity_contribution is now included in every purchase event from the standard indexer
      const totalAptRaised = purchases.reduce(
        (sum: number, e: any) => sum + parseInt(e.liquidity_contribution || '0'), 0
      );
      setAptRaised(totalAptRaised);

      // ── Recent trades (for Transactions tab) ──────────────
      const trades: RecentTrade[] = [];
      for (const p of purchases) {
        const ts = parseInt(p.timestamp || '0');
        const amount = parseInt(p.amount || '0');
        const tokensSoldBefore = parseInt(p.tokens_sold || '0');
        if (ts > 0 && amount > 0) {
          // liquidity_contribution = total APT cost in octas (from contract or bonding curve estimate).
          // p.price is per-token price — don't use it for total cost.
          const aptValue = parseFloat(p.liquidity_contribution || '0') > 0
            ? parseFloat(p.liquidity_contribution) / 1e8
            : approxAptValue(amount, tokensSoldBefore + amount);
          trades.push({ type: 'buy', wallet: p.buyer || '', amount, aptValue, timestampMs: toMs(ts) });
        }
      }
      for (const s of sales) {
        const ts = parseInt(s.timestamp || '0');
        const amount = parseInt(s.amount || '0');
        const tokensSoldPost = parseInt(s.tokens_sold || '0'); // post-sell state (our convention)
        if (ts > 0 && amount > 0) {
          // apt_returned = total APT received in octas (from contract).
          // Fallback: approxAptValue expects the pre-sell tokensSold (= post + amount).
          const aptValue = parseFloat(s.apt_returned || '0') > 0
            ? parseFloat(s.apt_returned) / 1e8
            : approxAptValue(amount, tokensSoldPost + amount);
          trades.push({ type: 'sell', wallet: s.seller || '', amount, aptValue, timestampMs: toMs(ts) });
        }
      }
      trades.sort((a, b) => b.timestampMs - a.timestampMs); // newest first
      setRecentTrades(trades);

      // ── OHLC candles ──────────────────────────────────────
      type RawTrade = { timestampMs: number; txVersion: number; tokensSold: number; amount: number };
      const raw: RawTrade[] = [];

      for (const p of purchases) {
        const ts = parseInt(p.timestamp || '0');
        // Contract emits tokens_sold BEFORE this purchase; add amount to get post-purchase state
        const tokensSoldBefore = parseInt(p.tokens_sold || '0');
        const amount = parseInt(p.amount || '0');
        const tokensSoldAfter = tokensSoldBefore + amount;
        const txVersion = parseInt(p.transaction_version || '0');
        if (ts > 0 && amount > 0) raw.push({ timestampMs: toMs(ts), txVersion, tokensSold: tokensSoldAfter, amount });
      }
      for (const s of sales) {
        const ts = parseInt(s.timestamp || '0');
        const tokensSold = parseInt(s.tokens_sold || '0');
        const amount = parseInt(s.amount || '0');
        const txVersion = parseInt(s.transaction_version || '0');
        if (ts > 0 && amount > 0) raw.push({ timestampMs: toMs(ts), txVersion, tokensSold, amount });
      }

      console.log('[useOHLCData] raw trades for OHLC:', raw.length);
      if (raw.length === 0) { setCandles([]); return; }

      // Sort by timestamp, then by transaction_version as tiebreaker so buy always
      // precedes sell when they land in the same millisecond bucket.
      raw.sort((a, b) => a.timestampMs - b.timestampMs || a.txVersion - b.txVersion);

      const intervalMs = TIMEFRAME_MS[timeframe];
      const candleMap = new Map<number, OHLCCandle>();

      for (const trade of raw) {
        const bucketSec = Math.floor(Math.floor(trade.timestampMs / intervalMs) * intervalMs / 1000);
        const price = calculateBondingCurvePrice(trade.tokensSold);
        const ex = candleMap.get(bucketSec);
        if (!ex) {
          candleMap.set(bucketSec, { time: bucketSec, open: price, high: price, low: price, close: price, volume: trade.amount });
        } else {
          ex.high = Math.max(ex.high, price);
          ex.low  = Math.min(ex.low, price);
          ex.close = price;
          ex.volume += trade.amount;
        }
      }

      const sortedCandles = Array.from(candleMap.values()).sort((a, b) => a.time - b.time);

      // Fill gaps between first trade and now with flat candles (prev close repeated)
      // so every timeframe shows a continuous price line, not isolated dots.
      // Upper bound: take the larger of "now" and the last traded candle — the Aptos
      // node clock can run slightly ahead of the browser, which would otherwise drop
      // the most recent candle if its bucket timestamp is technically in the future.
      const filled: OHLCCandle[] = [];
      if (sortedCandles.length > 0) {
        const intervalSec = Math.floor(intervalMs / 1000);
        const nowBucketSec = Math.floor(Date.now() / 1000 / intervalSec) * intervalSec;
        const lastCandleSec = sortedCandles[sortedCandles.length - 1].time;
        const endSec = Math.max(nowBucketSec, lastCandleSec);
        let prevClose = sortedCandles[0].open;
        let si = 0;
        for (let t = sortedCandles[0].time; t <= endSec; t += intervalSec) {
          if (si < sortedCandles.length && sortedCandles[si].time === t) {
            filled.push(sortedCandles[si]);
            prevClose = sortedCandles[si].close;
            si++;
          } else {
            filled.push({ time: t, open: prevClose, high: prevClose, low: prevClose, close: prevClose, volume: 0 });
          }
        }
      }

      console.log('[useOHLCData] candles built:', filled.length, '(', sortedCandles.length, 'traded )', filled[0] ?? null);
      setCandles(filled);
    } catch (err) {
      console.error('useOHLCData error:', err);
      setCandles([]);
      setRecentTrades([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadataAddr, timeframe, refreshSignal]);

  useEffect(() => { fetchAndAggregate(); }, [fetchAndAggregate]);

  return { candles, recentTrades, loading, holderCount, aptRaised, refetch: fetchAndAggregate };
}
