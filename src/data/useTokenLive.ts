import { useQuery } from '@tanstack/react-query';

export interface TokenLive {
  address: string;
  decimals: number;
  decimalsFactor: number;
  totalSupply: number;       // whole tokens (1B)
  remainingSupply: number;   // whole tokens still on the curve
  tokensSold: number;        // whole tokens sold (800M cap)
  spotPriceAPT: number;      // current bonding-curve price, APT per whole token
  avgPriceOctas: number;     // contract running average (octas per whole token)
  aptRaisedOctas: number;    // total APT spent through the vault, in octas
  aptRaised: number;         // same, in APT
  marketCapAPT: number;      // spotPriceAPT * totalSupply
  isGraduated: boolean;
  symbol: string | null;
  name: string | null;
  iconUri: string | null;
  fetchedAt: number;
}

async function fetchTokenLive(addr: string): Promise<TokenLive> {
  const res = await fetch(`/api/token/${addr}`);
  if (!res.ok) throw new Error(`token fetch failed: ${res.status}`);
  return res.json();
}

// Live vault state for one token. Polls every 3 seconds; the API endpoint
// caches for 2 seconds server-side so this scales linearly with regions, not users.
export function useTokenLive(addr: string | undefined) {
  return useQuery({
    queryKey: ['tokenLive', addr?.toLowerCase()],
    queryFn: () => fetchTokenLive(addr!.toLowerCase()),
    enabled: !!addr,
    refetchInterval: 3_000,
    staleTime: 2_000,
  });
}
