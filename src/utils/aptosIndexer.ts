// Aptos Indexer GraphQL API integration
// - token_created_events / token_graduated_events: Geomi No-Code Indexer
// - token_purchase_events / token_sale_events: Aptos standard indexer
//   (Geomi does not reliably capture these for this contract)

import { GEOMI_GRAPHQL_ENDPOINT, GEOMI_API_KEY, APTOS_INDEXER_ENDPOINT, APTOS_API_KEY, MODULE_ADDRESS } from "../config";

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

// Query the official Aptos standard indexer (requires REACT_APP_APTOS_API_KEY).
async function fetchAptosIndexerEvents(eventType: string, limit: number = 1000): Promise<any[]> {
  if (!APTOS_API_KEY) throw new Error('REACT_APP_APTOS_API_KEY not configured');

  const query = `
    query GetModuleEvents($type: String!, $limit: Int!) {
      events(
        where: { indexed_type: { _eq: $type } }
        order_by: { transaction_version: desc }
        limit: $limit
      ) {
        data
        transaction_version
        event_index
      }
    }
  `;

  const response = await fetch(APTOS_INDEXER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${APTOS_API_KEY}`,
    },
    body: JSON.stringify({ query, variables: { type: eventType, limit } }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Aptos indexer query failed: ${response.status} ${body}`);
  }

  const result = await response.json();
  if (result.errors) throw new Error(`Aptos indexer errors: ${JSON.stringify(result.errors)}`);

  return (result.data?.events || []).map((e: any) => ({
    ...e.data,
    event_index: e.event_index,
    transaction_version: e.transaction_version,
  }));
}

// Query the Aptos fullnode REST API for module events.
// Uses the GEOMI key which may have browser-CORS permission even when
// the standard indexer does not.  Works for Move-v2 (event::emit) events.
async function fetchAptosRestEvents(eventTypeSuffix: string, limit: number = 100): Promise<any[]> {
  const key = APTOS_API_KEY || GEOMI_API_KEY;
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;

  const cap = Math.min(limit, 100); // REST API caps at 100 per page
  const url = `https://api.testnet.aptoslabs.com/v1/accounts/${MODULE_ADDRESS}/events/${MODULE_ADDRESS}::token_launcher::${eventTypeSuffix}?limit=${cap}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Aptos REST API failed: ${response.status} ${body}`);
  }

  const events: any[] = await response.json();
  return events.map((e: any) => ({
    ...e.data,
    transaction_version: e.version,
  }));
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
        order_by: { timestamp: desc }
        limit: ${limit}
      ) {
        buyer
        metadata_addr
        amount
        price
        liquidity_contribution
        timestamp
        tokens_sold
      }
    }
  `;
  const data = await graphqlQuery(query);
  return data?.token_purchase_events || [];
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
        order_by: { timestamp: desc }
        limit: ${limit}
      ) {
        seller
        metadata_addr
        amount
        apt_returned
        timestamp
        tokens_sold
      }
    }
  `;
  const data = await graphqlQuery(query);
  return data?.token_sale_events || [];
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

// Fetch token creation events from Geomi indexer
async function fetchTokenCreatedEvents(): Promise<any[]> {
  // Query the table directly using the exact name from Hasura
  const tableName = 'token_created_events';
  console.log(`🔍 Querying ${tableName} table...`);
  
  const query = `
    query GetTokenCreatedEvents {
      ${tableName}(order_by: {timestamp: desc}) {
        event_index
        sequence_number
        creator
        metadata_addr
        ticker
        total_supply
        minted_supply
        remaining_supply
        decimals_factor
        premint_amount
        timestamp
      }
    }
  `;

  try {
    const data = await graphqlQuery(query);
    if (data[tableName]) {
      console.log(`✅ Successfully queried ${tableName}: ${data[tableName].length} events`);
      return data[tableName] || [];
    }
    console.warn(`⚠️ Query succeeded but no data returned for ${tableName}`);
    return [];
  } catch (error: any) {
    console.error(`❌ Failed to query ${tableName}:`, error);
    throw error;
  }
}

// Fetch graduation events from Geomi indexer
async function fetchGraduationEvents(): Promise<any[]> {
  const tableName = 'token_graduated_events';
  console.log(`🔍 Querying ${tableName} table...`);
  
  const query = `
    query GetGraduationEvents {
      ${tableName}(order_by: {timestamp: desc}) {
        event_index
        sequence_number
        metadata_addr
        market_cap_at_graduation
        timestamp
      }
    }
  `;

  try {
    const data = await graphqlQuery(query);
    if (data[tableName]) {
      console.log(`✅ Successfully queried ${tableName}: ${data[tableName].length} events`);
      return data[tableName] || [];
    }
    return [];
  } catch (error: any) {
    console.error(`❌ Failed to query ${tableName}:`, error);
    return []; // Return empty array on error for graduation events
  }
}

// Call the Vercel serverless proxy (/api/events) which queries the Aptos
// standard indexer server-side, avoiding browser CORS restrictions entirely.
async function fetchViaProxy(type: 'purchase' | 'sale', metadataAddr?: string, limit: number = 1000): Promise<any[]> {
  const params = new URLSearchParams({ type, limit: String(limit) });
  if (metadataAddr) params.set('addr', metadataAddr);
  const response = await fetch(`/api/events?${params}`);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Proxy error ${response.status}: ${body}`);
  }
  const { events } = await response.json();
  return events || [];
}

// Fetch purchase events. Priority chain:
// 0. Vercel proxy /api/events — server-side call, no CORS issues (needs APTOS_API_KEY in Vercel env)
// 1. Geomi No-Code Indexer — works once token_purchase_events is added in the Geomi dashboard
// 2. Aptos fullnode REST API — may work from browser with Geomi key
// 3. Aptos standard indexer GraphQL — requires REACT_APP_APTOS_API_KEY
export async function fetchPurchaseEvents(metadataAddr?: string, limit: number = 1000): Promise<any[]> {
  const addrLower = metadataAddr?.toLowerCase();

  // 0. Vercel proxy (server-side, no CORS restriction)
  try {
    const events = await fetchViaProxy('purchase', addrLower, limit);
    if (events.length > 0) {
      console.log(`[fetchPurchaseEvents] proxy returned ${events.length} events`);
      return events;
    }
  } catch (err: any) {
    console.warn('[fetchPurchaseEvents] proxy unavailable:', err?.message);
  }

  // 1. Geomi No-Code Indexer
  try {
    const events = await fetchGeomiPurchaseEvents(addrLower, limit);
    if (events.length > 0) {
      console.log(`[fetchPurchaseEvents] Geomi returned ${events.length} events`);
      return events;
    }
  } catch (err: any) {
    if (!err?.message?.includes('token_purchase_events')) {
      console.warn('[fetchPurchaseEvents] Geomi error:', err?.message);
    }
  }

  // 2. Aptos fullnode REST API
  try {
    const events = await fetchAptosRestEvents('TokenPurchaseEvent', limit);
    if (events.length > 0) {
      console.log(`[fetchPurchaseEvents] REST API returned ${events.length} events`);
      if (!addrLower) return events;
      return events.filter((e: any) => (e.metadata_addr || '').toLowerCase() === addrLower);
    }
  } catch (err: any) {
    console.warn('[fetchPurchaseEvents] REST API unavailable:', err?.message);
  }

  // 3. Aptos standard indexer (needs REACT_APP_APTOS_API_KEY)
  try {
    const events = await fetchAptosIndexerEvents(`${MODULE_ADDRESS}::token_launcher::TokenPurchaseEvent`, limit);
    console.log(`[fetchPurchaseEvents] Aptos indexer returned ${events.length} events`);
    if (!addrLower) return events;
    return events.filter((e: any) => (e.metadata_addr || '').toLowerCase() === addrLower);
  } catch (err: any) {
    console.warn('[fetchPurchaseEvents] Aptos indexer unavailable:', err?.message);
  }

  return [];
}

// Fetch sale events. Same priority chain as fetchPurchaseEvents.
async function fetchSaleEvents(metadataAddr?: string, limit: number = 1000): Promise<any[]> {
  const addrLower = metadataAddr?.toLowerCase();

  // 0. Vercel proxy
  try {
    const events = await fetchViaProxy('sale', addrLower, limit);
    if (events.length > 0) {
      console.log(`[fetchSaleEvents] proxy returned ${events.length} events`);
      return events;
    }
  } catch (err: any) {
    console.warn('[fetchSaleEvents] proxy unavailable:', err?.message);
  }

  // 1. Geomi No-Code Indexer
  try {
    const events = await fetchGeomiSaleEvents(addrLower, limit);
    if (events.length > 0) {
      console.log(`[fetchSaleEvents] Geomi returned ${events.length} events`);
      return events;
    }
  } catch (err: any) {
    if (!err?.message?.includes('token_sale_events')) {
      console.warn('[fetchSaleEvents] Geomi error:', err?.message);
    }
  }

  // 2. Aptos fullnode REST API
  try {
    const events = await fetchAptosRestEvents('TokenSaleEvent', limit);
    if (events.length > 0) {
      if (!addrLower) return events;
      return events.filter((e: any) => (e.metadata_addr || '').toLowerCase() === addrLower);
    }
  } catch (err: any) {
    console.warn('[fetchSaleEvents] REST API unavailable:', err?.message);
  }

  // 3. Aptos standard indexer (needs REACT_APP_APTOS_API_KEY)
  try {
    const events = await fetchAptosIndexerEvents(`${MODULE_ADDRESS}::token_launcher::TokenSaleEvent`, limit);
    if (!addrLower) return events;
    return events.filter((e: any) => (e.metadata_addr || '').toLowerCase() === addrLower);
  } catch (err: any) {
    console.warn('[fetchSaleEvents] Aptos indexer unavailable:', err?.message);
  }

  return [];
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
