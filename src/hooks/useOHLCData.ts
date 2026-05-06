import { useState, useEffect, useCallback } from 'react';
import { getPurchaseEvents, getSaleEvents, fetchAptRaisedPerToken } from '../utils/aptosIndexer';

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
      // Fetch all events (no server-side filter) and filter client-side.
      // The server-side _eq filter fails when the DB stores addresses in a
      // different case or format than we send — client-side toLowerCase() handles that.
      const [allPurchases, allSales, aptRaisedEvents] = await Promise.all([
        getPurchaseEvents(undefined, 1000),
        getSaleEvents(undefined, 1000),
        fetchAptRaisedPerToken(metadataAddr, 1000),
      ]);
      const purchases = allPurchases.filter((e: any) =>
        (e.metadata_addr || '').toLowerCase() === addrLower
      );
      const sales = allSales.filter((e: any) =>
        (e.metadata_addr || '').toLowerCase() === addrLower
      );
      console.log('[useOHLCData] purchases:', purchases.length, 'sales:', sales.length, 'aptRaisedEvents:', aptRaisedEvents.length);
      if (purchases.length > 0) console.log('[useOHLCData] first purchase:', purchases[0]);

      // Unique buyers → holder count
      const buyers = new Set<string>();
      for (const p of purchases) {
        if (p.buyer) buyers.add(p.buyer.toLowerCase());
      }
      setHolderCount(buyers.size);

      // Sum liquidity_contribution from separate query (fails gracefully if field missing)
      const totalAptRaised = aptRaisedEvents.reduce(
        (sum: number, e: any) => sum + parseInt(e.liquidity_contribution || '0'), 0
      );
      setAptRaised(totalAptRaised);

      // ── Recent trades (for Transactions tab) ──────────────
      const trades: RecentTrade[] = [];
      for (const p of purchases) {
        const ts = parseInt(p.timestamp || '0');
        const amount = parseInt(p.amount || '0');
        const tokensSold = parseInt(p.tokens_sold || '0');
        if (ts > 0 && amount > 0) {
          const aptValue = parseFloat(p.price || '0') > 0
            ? parseFloat(p.price) / 1e8
            : approxAptValue(amount, tokensSold);
          trades.push({ type: 'buy', wallet: p.buyer || '', amount, aptValue, timestampMs: toMs(ts) });
        }
      }
      for (const s of sales) {
        const ts = parseInt(s.timestamp || '0');
        const amount = parseInt(s.amount || '0');
        const tokensSold = parseInt(s.tokens_sold || '0');
        if (ts > 0 && amount > 0) {
          const aptValue = parseFloat(s.apt_returned || '0') > 0
            ? parseFloat(s.apt_returned) / 1e8
            : approxAptValue(amount, tokensSold);
          trades.push({ type: 'sell', wallet: s.seller || '', amount, aptValue, timestampMs: toMs(ts) });
        }
      }
      trades.sort((a, b) => b.timestampMs - a.timestampMs); // newest first
      setRecentTrades(trades);

      // ── OHLC candles ──────────────────────────────────────
      type RawTrade = { timestampMs: number; tokensSold: number; amount: number };
      const raw: RawTrade[] = [];

      for (const p of purchases) {
        const ts = parseInt(p.timestamp || '0');
        const tokensSold = parseInt(p.tokens_sold || '0');
        const amount = parseInt(p.amount || '0');
        if (ts > 0 && amount > 0) raw.push({ timestampMs: toMs(ts), tokensSold, amount });
      }
      for (const s of sales) {
        const ts = parseInt(s.timestamp || '0');
        const tokensSold = parseInt(s.tokens_sold || '0');
        const amount = parseInt(s.amount || '0');
        if (ts > 0 && amount > 0) raw.push({ timestampMs: toMs(ts), tokensSold, amount });
      }

      console.log('[useOHLCData] raw trades for OHLC:', raw.length);
      if (raw.length === 0) { setCandles([]); return; }

      raw.sort((a, b) => a.timestampMs - b.timestampMs);

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
      console.log('[useOHLCData] candles built:', sortedCandles.length, sortedCandles[0] ?? null);
      setCandles(sortedCandles);
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
