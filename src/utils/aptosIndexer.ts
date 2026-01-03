// Aptos Indexer GraphQL API integration - Using Geomi No-Code Indexer
// Efficient GraphQL queries to fetch indexed events

import { GEOMI_GRAPHQL_ENDPOINT, GEOMI_API_KEY } from "../config";

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

// Fetch purchase events from Geomi indexer (optional, for trading data)
export async function fetchPurchaseEvents(metadataAddr?: string, limit: number = 100): Promise<any[]> {
  const tableName = 'token_purchase_events';
  let query = `
    query GetPurchaseEvents($limit: Int) {
      ${tableName}(order_by: {timestamp: desc}, limit: $limit) {
        event_index
        sequence_number
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

  if (metadataAddr) {
    query = `
      query GetPurchaseEvents($metadataAddr: String!, $limit: Int) {
        ${tableName}(
          where: {metadata_addr: {_eq: $metadataAddr}}
          order_by: {timestamp: desc}
          limit: $limit
        ) {
          event_index
          sequence_number
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
  }

  const variables: any = { limit };
  if (metadataAddr) {
    variables.metadataAddr = metadataAddr;
  }

  try {
    const data = await graphqlQuery(query, variables);
    return data[tableName] || [];
  } catch (error: any) {
    console.error(`❌ Failed to query ${tableName}:`, error);
    return [];
  }
}

// Fetch sale events from Geomi indexer (optional, for trading data)
async function fetchSaleEvents(metadataAddr?: string, limit: number = 100): Promise<any[]> {
  const tableName = 'token_sale_events';
  let query = `
    query GetSaleEvents($limit: Int) {
      ${tableName}(order_by: {timestamp: desc}, limit: $limit) {
        event_index
        sequence_number
        seller
        metadata_addr
        amount
        price
        apt_returned
        timestamp
        tokens_sold
      }
    }
  `;

  if (metadataAddr) {
    query = `
      query GetSaleEvents($metadataAddr: String!, $limit: Int) {
        ${tableName}(
          where: {metadata_addr: {_eq: $metadataAddr}}
          order_by: {timestamp: desc}
          limit: $limit
        ) {
          event_index
          sequence_number
          seller
          metadata_addr
          amount
          price
          apt_returned
          timestamp
          tokens_sold
        }
      }
    `;
  }

  const variables: any = { limit };
  if (metadataAddr) {
    variables.metadataAddr = metadataAddr;
  }

  try {
    const data = await graphqlQuery(query, variables);
    return data[tableName] || [];
  } catch (error: any) {
    console.error(`❌ Failed to query ${tableName}:`, error);
    return [];
  }
}

// Main function to get optimized token data via GraphQL
async function getOptimizedTokenData(moduleAddress: string, ownerAddress?: string, aptPrice: number = 0): Promise<OptimizedTokenData> {
  console.log('🚀 GraphQL: Getting ALL token data via Geomi indexer...');

  try {
    // 1. Get token creation events
    console.log("🔍 Fetching TokenCreatedEvents from indexer...");
    const createdEvents = await fetchTokenCreatedEvents();
    console.log(`✅ Token events: ${createdEvents.length}`);

    // Convert to expected format
    const tokenEvents: TokenCreationEvent[] = createdEvents.map((event: any) => ({
      type: 'TokenCreatedEvent',
      sequence_number: event.sequence_number?.toString() || event.event_index?.toString() || '',
      data: {
        creator: event.creator,
        metadata_address: event.metadata_addr,
        ticker: event.ticker,
        total_supply: event.total_supply,
        tokens_sold: event.minted_supply || 0, // Use minted_supply as tokens_sold
        remaining_supply: event.remaining_supply,
        decimals_factor: event.decimals_factor,
        premint_amount: event.premint_amount,
        timestamp: event.timestamp,
      },
      __typename: 'TokenCreatedEvent'
    }));

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
          const totalSupply = event.data.total_supply || 1000000;
          
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
