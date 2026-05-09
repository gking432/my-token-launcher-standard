import { useQuery } from '@tanstack/react-query';

export interface TokenListEntry {
  address: string;
  decimalsFactor: number;
  totalSupply: number;
  tokensSold: number;
  spotPriceAPT: number;
  aptRaisedOctas: number;
  aptRaised: number;
  marketCapAPT: number;
  isGraduated: boolean;
}

async function fetchTokens(addrs: string[]): Promise<Record<string, TokenListEntry>> {
  if (addrs.length === 0) return {};
  const res = await fetch(`/api/tokens?addrs=${encodeURIComponent(addrs.join(','))}`);
  if (!res.ok) throw new Error(`tokens fetch failed: ${res.status}`);
  const json = await res.json();
  const map: Record<string, TokenListEntry> = {};
  for (const t of json.tokens || []) map[t.address.toLowerCase()] = t;
  return map;
}

// Batched live state for many tokens. Polls every 5s; server caches for 5s.
// Result is keyed by lowercase address for O(1) merging into the catalog list.
export function useTokenList(addresses: string[]) {
  const sorted = [...addresses].map(a => a.toLowerCase()).sort();
  return useQuery({
    queryKey: ['tokenList', sorted.join(',')],
    queryFn: () => fetchTokens(sorted),
    enabled: sorted.length > 0,
    refetchInterval: 5_000,
    staleTime: 4_000,
  });
}
