import { useQuery } from '@tanstack/react-query';

export interface NormalizedTrade {
  type: 'buy' | 'sell';
  wallet: string;
  amount: number;       // whole tokens
  aptValue: number;     // APT (computed via bonding curve, deterministic)
  timestampMs: number;
  txVersion: number;
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

// Trade history (chronological, ascending). Polls every 8s; server-cached for 5s.
// Used by transactions tab, OHLC chart, top holders — all see the same data.
export function useTokenTrades(addr: string | undefined) {
  return useQuery({
    queryKey: ['tokenTrades', addr?.toLowerCase()],
    queryFn: () => fetchTrades(addr!.toLowerCase()),
    enabled: !!addr,
    refetchInterval: 8_000,
    staleTime: 4_000,
  });
}
