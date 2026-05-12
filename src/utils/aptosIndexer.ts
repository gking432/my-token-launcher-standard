import { GEOMI_GRAPHQL_ENDPOINT, GEOMI_API_KEY, MODULE_ADDRESS } from "../config";

// Helper function for bonding curve calculation
function calculateBondingCurvePrice(tokensSold: number): number {
  const PRICE_NUMERATOR = 19029514756; // 19,029,514,756
  const PRICE_CONSTANT = 61.9053276; // 61.9053276 Octas
  const MAX_TOKENS = 800000000; // 800,000,000 total supply
  
  const denominator = MAX_TOKENS - tokensSold;
  
  if (denominator <= 0) {
    throw new Error("All tokens have been sold");
  }
  
  // Calculate hyperbolic term: numerator / denominator (floating point division)
  const hyperbolicTerm = PRICE_NUMERATOR / denominator;
  
  // Add constant term (61.9053276 Octas)
  const constantTerm = PRICE_CONSTANT;
  
  // Total price in Octas (smallest APT unit)
  const priceInOctas = hyperbolicTerm + constantTerm;
  
  // Convert to APT (divide by 10^8)
  return priceInOctas / 100_000_000;
}

interface TokenCreationEvent {
  type: string;
  data: any;
  sequence_number: string;
  __typename: string;
}

interface GraduationEvent {
  transaction_version: string;
  event_index: string;
  data: any;
  __typename: string;
}

interface TokenData {
  token_uri: string;
  token_name: string;
  collection_id: string;
  __typename: string;
}

interface FungibleAsset {
  symbol: string;
  name: string;
  decimals: number;
  asset_type: string;
  creator_address: string;
  __typename: string;
}

interface TokenBalance {
  asset_type: string;
  amount: string;
  owner_address: string;
  __typename: string;
}

interface OptimizedTokenData {
  usdPrices: Map<string, number>;
  marketCaps: Map<string, number>;
  tokenEvents: TokenCreationEvent[];
  graduationEvents: GraduationEvent[];
  tokenDatas: TokenData[];
  fungibleAssets: FungibleAsset[];
  balances: TokenBalance[];
}

interface CacheEntry {
  data: OptimizedTokenData;
  timestamp: number;
  ttl: number;
}

// Cache for token data to avoid repeated API calls
let tokenCache: CacheEntry | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

// Request deduplication
let activeRequest: Promise<TokenCreationEvent[]> | null = null;

// GraphQL query helper
async function graphqlQuery(query: string, variables?: any): Promise<any> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Add API key if available
  if (GEOMI_API_KEY) {
    // Try Authorization header format (Bearer token)
    headers["Authorization"] = `Bearer ${GEOMI_API_KEY}`;
    // Also try x-api-key as fallback
    headers["x-api-key"] = GEOMI_API_KEY;
    console.log("🔑 Using API key for GraphQL query (length:", GEOMI_API_KEY.length, ")");
  } else {
    console.warn("⚠️ No GEOMI_API_KEY found! Check your .env.local file.");
  }

  const response = await fetch(GEOMI_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL query failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    console.error("GraphQL errors:", result.errors);
    throw new Error(`GraphQL query errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

// Query Geomi No-Code Indexer for purchase events.
// Requires token_purchase_events to be configured in the Geomi dashboard.
async function fetchGeomiPurchaseEvents(metadataAddr?: string, limit: number = 1000): Promise<any[]> {
  const whereClause = metadataAddr
    ? `where: { metadata_addr: { _eq: "${metadataAddr}" } }`
    : '';
  const query = `
    query GetPurchaseEvents {
      token_purchase_events(
        ${whereClause}
        order_by: { timestamp: asc }
        limit: ${limit}
      ) {
        buyer
        metadata_addr
        amount
        price
        liquidity_contribution
        timestamp
        tokens_sold
        transaction_version
      }
    }
  `;
  const data = await graphqlQuery(query);
  const events: any[] = data?.token_purchase_events || [];
  if (!events.length || !metadataAddr) return events;

  // Contract emits amount = tokens_bought * decimals_factor (atomic units).
  // tokens_sold is in whole tokens. Normalize amount → whole tokens so both
  // fields use the same unit and the bonding curve math doesn't overflow.
  const decimals = await getTokenDecimals(metadataAddr);
  const df = Math.pow(10, decimals);
  return events.map(e => ({
    ...e,
    amount: String(Math.round(parseInt(e.amount || '0') / df)),
  }));
}

// Query Geomi No-Code Indexer for sale events.
// Requires token_sale_events to be configured in the Geomi dashboard.
async function fetchGeomiSaleEvents(metadataAddr?: string, limit: number = 1000): Promise<any[]> {
  const whereClause = metadataAddr
    ? `where: { metadata_addr: { _eq: "${metadataAddr}" } }`
    : '';
  const query = `
    query GetSaleEvents {
      token_sale_events(
        ${whereClause}
        order_by: { timestamp: asc }
        limit: ${limit}
      ) {
        seller
        metadata_addr
        amount
        apt_returned
        timestamp
        tokens_sold
        transaction_version
      }
    }
  `;
  const data = await graphqlQuery(query);
  const events: any[] = data?.token_sale_events || [];
  if (!events.length || !metadataAddr) return events;

  // Contract emits amount in atomic units; tokens_sold is pre-sell whole tokens.
  // Normalize amount → whole tokens and convert tokens_sold → post-sell so the
  // OHLC builder sees a price drop (matching what fetchActivitiesFallback does).
  const decimals = await getTokenDecimals(metadataAddr);
  const df = Math.pow(10, decimals);
  return events.map(e => {
    const amountWhole = Math.round(parseInt(e.amount || '0') / df);
    const tokensSoldPreSell = parseInt(e.tokens_sold || '0');
    return {
      ...e,
      amount: String(amountWhole),
      tokens_sold: String(Math.max(0, tokensSoldPreSell - amountWhole)),
    };
  });
}

// Introspect schema to find correct table names
async function introspectSchema(): Promise<any> {
  const query = `
    query IntrospectQuery {
      __schema {
        queryType {
          fields {
            name
            type {
              name
            }
          }
        }
      }
    }
  `;
  
  try {
    const data = await graphqlQuery(query);
    console.log("📋 Available GraphQL fields:", data.__schema?.queryType?.fields?.map((f: any) => f.name));
    return data;
  } catch (error) {
    console.warn("⚠️ Schema introspection failed, trying direct queries...");
    return null;
  }
}

// Fetch token creation events via the server-side /api/catalog proxy.
// The proxy caches results for 30s and holds the Geomi API key server-side,
// preventing per-user 429s from direct browser→Geomi calls.
async function fetchTokenCreatedEvents(): Promise<any[]> {
  const res = await fetch('/api/catalog');
  if (!res.ok) throw new Error(`/api/catalog failed: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  console.log(`✅ /api/catalog: ${(json.tokens || []).length} tokens`);
  return json.tokens || [];
}

// Fetch graduation events from the Aptos fullnode event handle (free, no API key).
async function fetchGraduationEvents(): Promise<any[]> {
  try {
    const url = `https://fullnode.testnet.aptoslabs.com/v1/accounts/${MODULE_ADDRESS}/events/${MODULE_ADDRESS}::token_launcher::ModuleState/graduation_events?limit=100`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`⚠️ Graduation events fetch returned ${res.status}`);
      return [];
    }
    const events = await res.json();
    if (!Array.isArray(events)) return [];
    // Normalise to the shape the rest of the code expects
    return events.map((e: any, idx: number) => ({
      event_index: idx,
      sequence_number: e.sequence_number ?? idx,
      metadata_addr: e.data?.metadata_addr ?? '',
      market_cap_at_graduation: e.data?.market_cap_at_graduation ?? '0',
      timestamp: e.data?.timestamp ?? '0',
    }));
  } catch (error: any) {
    console.error('❌ Failed to fetch graduation events:', error);
    return [];
  }
}

// Fetch the decimals for a fungible asset from the Aptos fullnode.
// Returns 0 (decimals_factor = 1) on any failure.
async function getTokenDecimals(metadataAddr: string): Promise<number> {
  try {
    const res = await fetch(
      `https://fullnode.testnet.aptoslabs.com/v1/accounts/${metadataAddr}/resource/0x1::fungible_asset::Metadata`
    );
    if (!res.ok) return 0;
    const json = await res.json();
    const dec = (json.data ?? json)?.decimals;
    return parseInt(dec ?? '0', 10);
  } catch {
    return 0;
  }
}

// Fallback: reconstruct purchase/sale events from fungible_asset_activities.
// Queries the standard Aptos indexer via the /api/events proxy (server-side, no CORS).
// Works for ALL buyers — not indexer-dependent. Used when Geomi has no data yet.
export async function fetchActivitiesFallback(
  metadataAddr: string,
): Promise<{ purchases: any[]; sales: any[] }> {
  // Fetch decimals first so amounts are normalised to whole-token units
  const decimals = await getTokenDecimals(metadataAddr);
  const decimalsFactor = Math.pow(10, decimals);
  console.log(`[fetchActivitiesFallback] ${metadataAddr} decimals=${decimals} factor=${decimalsFactor}`);

  const params = new URLSearchParams({ type: 'activities', addr: metadataAddr, limit: '1000' });
  const response = await fetch(`/api/events?${params}`);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Activities proxy error ${response.status}: ${body.slice(0, 200)}`);
  }
  const data = await response.json();
  if (data.error) throw new Error(`Activities error: ${JSON.stringify(data.error)}`);

  const activities: any[] = data.activities || [];
  console.log(`[fetchActivitiesFallback] ${activities.length} activities for ${metadataAddr}`);

  // Sort ascending to accumulate tokens_sold state correctly
  const sorted = [...activities].sort(
    (a, b) => parseInt(a.transaction_version) - parseInt(b.transaction_version),
  );

  const RESOURCE_ADDR = '0x2867f67700ccd1b3575ecf551137729c06af169a266fc2340d64f667ed9ac9d5';
  let tokensSold = 0; // whole token units
  const purchases: any[] = [];
  const sales: any[] = [];

  for (const act of sorted) {
    const owner: string = (act.owner_address || '').toLowerCase();
    if (owner === RESOURCE_ADDR.toLowerCase()) continue; // skip graduation mints

    const amountAtomic = parseInt(act.amount || '0');
    if (amountAtomic <= 0) continue;
    // Normalize to whole tokens so bonding curve formula and display are correct
    const amountTokens = Math.round(amountAtomic / decimalsFactor);

    const type: string = (act.type || '').toLowerCase();
    const tsMs = new Date(act.transaction_timestamp || 0).getTime();
    const tsMicros = String(tsMs * 1000); // microseconds, matching contract timestamp format

    console.log(`[fetchActivitiesFallback] type="${act.type}" owner=${act.owner_address} atomic=${amountAtomic} tokens=${amountTokens}`);

    // Aptos indexer stores types as "0x1::fungible_asset::Deposit" / "Withdraw"
    if (type.includes('deposit')) {
      const p0 = calculateBondingCurvePrice(tokensSold);
      const p1 = calculateBondingCurvePrice(tokensSold + amountTokens);
      const liquidityOctas = Math.round(((p0 + p1) / 2) * amountTokens * 1e8);
      purchases.push({
        buyer: act.owner_address,
        metadata_addr: metadataAddr,
        amount: String(amountTokens),
        tokens_sold: String(tokensSold),
        liquidity_contribution: String(liquidityOctas),
        price: '0',
        timestamp: tsMicros,
        transaction_version: act.transaction_version,
      });
      tokensSold += amountTokens;
    } else if (type.includes('withdraw')) {
      tokensSold = Math.max(0, tokensSold - amountTokens);
      sales.push({
        seller: act.owner_address,
        metadata_addr: metadataAddr,
        amount: String(amountTokens),
        tokens_sold: String(tokensSold),
        apt_returned: '0',
        price: '0',
        timestamp: tsMicros,
        transaction_version: act.transaction_version,
      });
    }
  }

  return { purchases, sales };
}

export async function fetchPurchaseEvents(metadataAddr?: string, limit: number = 1000): Promise<any[]> {
  if (!metadataAddr) {
    try {
      const res = await fetch('/api/purchases');
      if (!res.ok) throw new Error(`/api/purchases ${res.status}`);
      const json = await res.json();
      return json.purchases || [];
    } catch (err) {
      console.warn('[fetchPurchaseEvents] /api/purchases failed:', err);
      return [];
    }
  }
  // Per-token: use /api/trades/{addr} (standard indexer + fullnode, free)
  try {
    const res = await fetch(`/api/trades/${metadataAddr.toLowerCase()}`);
    if (!res.ok) throw new Error(`/api/trades ${res.status}`);
    const json = await res.json();
    return (json.trades || []).filter((t: any) => t.type === 'buy').map((t: any) => ({
      buyer: t.wallet,
      metadata_addr: metadataAddr,
      amount: String(t.amount),
      price: '0',
      liquidity_contribution: String(Math.round(t.aptValue * 1e8)),
      timestamp: String(t.timestampMs * 1000),
      tokens_sold: String(t.tokensSoldBefore),
      transaction_version: String(t.txVersion),
    }));
  } catch (err) {
    console.warn('[fetchPurchaseEvents] /api/trades failed:', err);
    return [];
  }
}

async function fetchSaleEvents(metadataAddr?: string, limit: number = 1000): Promise<any[]> {
  if (!metadataAddr) return [];
  try {
    const res = await fetch(`/api/trades/${metadataAddr.toLowerCase()}`);
    if (!res.ok) throw new Error(`/api/trades ${res.status}`);
    const json = await res.json();
    return (json.trades || []).filter((t: any) => t.type === 'sell').map((t: any) => ({
      seller: t.wallet,
      metadata_addr: metadataAddr,
      amount: String(t.amount),
      apt_returned: String(Math.round(t.aptValue * 1e8)),
      timestamp: String(t.timestampMs * 1000),
      tokens_sold: String(t.tokensSoldBefore),
      transaction_version: String(t.txVersion),
    }));
  } catch (err) {
    console.warn('[fetchSaleEvents] /api/trades failed:', err);
    return [];
  }
}

// Kept for backward compatibility — callers that used this separately can now
// use fetchPurchaseEvents directly since liquidity_contribution is included.
export async function fetchAptRaisedPerToken(metadataAddr?: string, limit: number = 1000): Promise<any[]> {
  return fetchPurchaseEvents(metadataAddr, limit);
}

// Fetch the latest tokens_sold and cumulative apt_raised per token from purchase events.
// Since we now use the Aptos standard indexer, liquidity_contribution is always present.
async function fetchLatestPurchaseStates(): Promise<Map<string, { tokensSold: number; aptRaised: number }>> {
  const events = await fetchPurchaseEvents(undefined, 1000).catch(() => [] as any[]);

  const tokensSoldMap = new Map<string, number>();
  const aptRaisedMap = new Map<string, number>();

  for (const e of events) {
    const addr: string = e.metadata_addr;
    if (!addr) continue;
    // tokens_sold: keep the latest value (events ordered desc, so first occurrence = most recent)
    if (!tokensSoldMap.has(addr)) {
      // tokens_sold in the event is BEFORE the purchase; add amount to get post-purchase value
      const tsBefore = parseInt(e.tokens_sold || '0');
      const amount = parseInt(e.amount || '0');
      tokensSoldMap.set(addr, tsBefore + amount);
    }
    // apt_raised: sum all contributions
    aptRaisedMap.set(addr, (aptRaisedMap.get(addr) ?? 0) + parseInt(e.liquidity_contribution || '0'));
  }

  const result = new Map<string, { tokensSold: number; aptRaised: number }>();
  tokensSoldMap.forEach((_, addr) => {
    result.set(addr, {
      tokensSold: tokensSoldMap.get(addr) ?? 0,
      aptRaised: aptRaisedMap.get(addr) ?? 0,
    });
  });
  return result;
}

// Main function to get optimized token data via GraphQL
async function getOptimizedTokenData(moduleAddress: string, ownerAddress?: string, aptPrice: number = 0): Promise<OptimizedTokenData> {
  console.log('🚀 GraphQL: Getting ALL token data via Geomi indexer...');

  try {
    // 1. Get token creation events + latest purchase states in parallel
    console.log("🔍 Fetching TokenCreatedEvents and latest purchase states...");
    const [createdEvents, purchaseStates] = await Promise.all([
      fetchTokenCreatedEvents(),
      fetchLatestPurchaseStates(),
    ]);
    console.log(`✅ Token events: ${createdEvents.length}, purchase states: ${purchaseStates.size}`);

    // Convert to expected format — use real tokens_sold/apt_raised from purchase events
    const tokenEvents: TokenCreationEvent[] = createdEvents.map((event: any) => {
      const state = purchaseStates.get(event.metadata_addr);
      return {
        type: 'TokenCreatedEvent',
        sequence_number: event.sequence_number?.toString() || event.event_index?.toString() || '',
        data: {
          creator: event.creator,
          metadata_address: event.metadata_addr,
          ticker: event.ticker,
          name: event.name || event.ticker_decoded || event.ticker,
          symbol: event.symbol || event.ticker_decoded || event.ticker,
          icon_uri: event.icon_uri || '',
          total_supply: event.total_supply,
          tokens_sold: state?.tokensSold ?? 0,
          apt_raised: state?.aptRaised ?? 0,
          remaining_supply: event.remaining_supply,
          decimals_factor: event.decimals_factor,
          premint_amount: event.premint_amount,
          timestamp: event.timestamp,
        },
        __typename: 'TokenCreatedEvent'
      };
    });

    // 2. Get graduation events
    console.log("🔍 Fetching TokenGraduatedEvents from indexer...");
    const graduationEventsRaw = await fetchGraduationEvents();
    const graduationEvents: GraduationEvent[] = graduationEventsRaw.map((event: any) => ({
      transaction_version: event.sequence_number?.toString() || '',
      event_index: event.event_index?.toString() || '',
      data: {
        metadata_address: event.metadata_addr,
        market_cap_at_graduation: event.market_cap_at_graduation,
        timestamp: event.timestamp,
      },
      __typename: 'GraduationEvent'
    }));
    console.log(`✅ Graduation events: ${graduationEvents.length}`);

    // 3. Placeholder for token metadata (can be enhanced later)
    const tokenDatas: TokenData[] = [];
    console.log(`✅ Token metadata: ${tokenDatas.length} (placeholder)`);

    // 4. Placeholder for fungible assets (can be enhanced later)
    const fungibleAssets: FungibleAsset[] = [];
    console.log(`✅ Fungible assets: ${fungibleAssets.length} (placeholder)`);

    // 5. Placeholder for balances (can be enhanced with SDK if needed)
    const balances: TokenBalance[] = [];
    if (ownerAddress) {
      console.log(`ℹ️ Balance fetching not yet implemented via GraphQL`);
    }

    console.log(`🚀 COMPREHENSIVE SUCCESS: ${tokenEvents.length} tokens, ${graduationEvents.length} graduations`);

    // Calculate USD prices and market caps
    const usdPrices = new Map<string, number>();
    const marketCaps = new Map<string, number>();

    if (aptPrice > 0) {
      tokenEvents.forEach((event) => {
        if (event.data && event.data.metadata_address) {
          const metadataAddress = event.data.metadata_address;
          const tokensSold = event.data.tokens_sold || 0;
          const totalSupply = event.data.total_supply || 1_000_000_000;
          
          // Calculate price using bonding curve
          const priceAPT = calculateBondingCurvePrice(tokensSold);
          
          // Convert to USD
          const priceUSD = priceAPT * aptPrice;
          usdPrices.set(metadataAddress, priceUSD);
          
          // Calculate market cap (price × total supply)
          const marketCap = priceUSD * totalSupply;
          marketCaps.set(metadataAddress, marketCap);
        }
      });
      
      console.log(`✅ USD calculations: ${usdPrices.size} prices, ${marketCaps.size} market caps`);
    } else {
      console.log(`ℹ️ No APT price provided, skipping USD calculations`);
    }

    return {
      usdPrices,
      marketCaps,
      tokenEvents,
      graduationEvents,
      tokenDatas,
      fungibleAssets,
      balances
    };
    
  } catch (error) {
    console.error("❌ GraphQL query failed:", error);
    throw error;
  }
}

// Main function to get token launcher tokens - OPTIMIZED VERSION
export async function getTokenLauncherTokens(moduleAddress: string, ownerAddress?: string): Promise<TokenCreationEvent[]> {
  // Check cache first
  if (tokenCache && (Date.now() - tokenCache.timestamp) < tokenCache.ttl) {
    console.log("💾 CACHE HIT: Returning cached token data");
    return tokenCache.data.tokenEvents;
  }

  // Prevent multiple simultaneous requests
  if (activeRequest) {
    console.log("🔄 Request already in progress, waiting for result...");
    return activeRequest;
  }

  console.log(`🚀 OPTIMIZED: Getting tokens launched through module: ${moduleAddress}`);
  const startTime = Date.now();

  // Create the request and store it
  activeRequest = (async () => {
    try {
      const optimizedData = await getOptimizedTokenData(moduleAddress, ownerAddress);
      const loadTime = Date.now() - startTime;
      console.log(`✅ OPTIMIZED SUCCESS: ${optimizedData.tokenEvents.length} tokens in ${loadTime}ms`);
      
      // Cache successful result
      tokenCache = {
        data: optimizedData,
        timestamp: Date.now(),
        ttl: CACHE_TTL
      };
      console.log(`💾 CACHED: ${optimizedData.tokenEvents.length} tokens for 10 minutes`);
      
      return optimizedData.tokenEvents;
    } catch (error) {
      console.log("❌ Optimized query failed:", error);
      return tokenCache?.data.tokenEvents || [];
    }
  })();

  try {
    const result = await activeRequest;
    activeRequest = null;
    return result;
  } catch (error) {
    activeRequest = null;
    throw error;
  }
}

// Helper function to clear cache (for testing)
export function clearTokenCache(): void {
  tokenCache = null;
  console.log("🗑️ Token cache cleared");
}

// Export functions for fetching purchase/sale events
export async function getPurchaseEvents(metadataAddr?: string, limit: number = 100): Promise<any[]> {
  return fetchPurchaseEvents(metadataAddr, limit);
}

export async function getSaleEvents(metadataAddr?: string, limit: number = 100): Promise<any[]> {
  return fetchSaleEvents(metadataAddr, limit);
}

// Legacy functions for backward compatibility - these now use the optimized data
export async function getFungibleAssetInfo(assetTypes: string[], offset: number = 0): Promise<any[]> {
  console.log("🔄 Using optimized data for getFungibleAssetInfo");
  if (tokenCache && tokenCache.data.fungibleAssets) {
    console.log(`✅ Returning ${tokenCache.data.fungibleAssets.length} cached fungible assets`);
    return tokenCache.data.fungibleAssets;
  }
  console.log("⚠️ No cached data available, returning empty array");
  return [];
}

export async function getTokenMetadataURI(tokenName: string, collectionId: string): Promise<any[]> {
  console.log("🔄 Using optimized data for getTokenMetadataURI");
  if (tokenCache && tokenCache.data.tokenDatas) {
    console.log(`✅ Returning ${tokenCache.data.tokenDatas.length} cached token metadata`);
    return tokenCache.data.tokenDatas;
  }
  console.log("⚠️ No cached data available, returning empty array");
  return [];
}

export async function getTokenMetadataForLeaderboard(tokenName: string, collectionId: string): Promise<any[]> {
  console.log("🔄 Using optimized data for getTokenMetadataForLeaderboard");
  if (tokenCache && tokenCache.data.tokenDatas) {
    console.log(`✅ Returning ${tokenCache.data.tokenDatas.length} cached token metadata`);
    return tokenCache.data.tokenDatas;
  }
  console.log("⚠️ No cached data available, returning empty array");
  return [];
}
