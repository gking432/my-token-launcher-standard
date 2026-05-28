import { useQuery } from '@tanstack/react-query';

export interface NormalizedTrade {
  type: 'buy' | 'sell';
  wallet: string;
  amount: number;       // whole tokens
  aptValue: number;     // APT — exact value from the contract event
                        // (liquidity_contribution for buys, apt_returned for sells)
  timestampMs: number;
  txVersion: number;
  eventIndex?: number;
  tokensSoldBefore: number;
  tokensSoldAfter: number;
}

export interface TokenTradesResult {
  trades: NormalizedTrade[];
  decimals: number;
  finalTokensSold: number;
}

async function fetchTrades(addr: string): Promise<TokenTradesResult> {
  const res = await fetch(`/api/trades/${addr}`);
  if (!res.ok) throw new Error(`trades fetch failed: ${res.status}`);
  return res.json();
}

// Trade history (chronological, ascending). Polls every 60s; server-cached for 60s.
// Used by transactions tab, OHLC chart, top holders — all see the same data.
export function useTokenTrades(addr: string | undefined) {
  return useQuery({
    queryKey: ['tokenTrades', addr?.toLowerCase()],
    queryFn: () => fetchTrades(addr!.toLowerCase()),
    enabled: !!addr,
    refetchInterval: 60_000,
    staleTime: 55_000,
  });
}
