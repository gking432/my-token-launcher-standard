// Aptos Indexer GraphQL API integration
// Documentation: https://cloud.aptoslabs.com/indexer-api

// Use the correct devnet indexer URL
const APTOS_INDEXER_URL = 'https://api.devnet.aptoslabs.com/v1/graphql';

// Enable indexer calls to test functionality
const isDevnet = true; // Set to true to use devnet indexer

// API key to avoid rate limiting
const API_KEY = 'aptoslabs_AZymB2JNfK3_JdAe5j8VCk3w8YCojaUTrxZGyBdsFZ7Wa';

interface FungibleAssetMetadata {
  symbol: string;
  name: string;
  decimals: number;
  asset_type: string;
  creator_address?: string;
  last_transaction_timestamp?: string;
  __typename: string;
}

interface TokenCreationEvent {
  type: string;
  data: any;
  sequence_number: string;
  __typename: string;
}

interface FungibleAssetBalance {
  asset_type: string;
  amount: string;
  __typename: string;
}

interface TokenDataByName {
  token_uri: string;
  __typename: string;
}

interface GraphQLResponse<T> {
  data: T;
  errors?: any[];
}

// Get fungible asset metadata by asset types
export async function getFungibleAssetInfo(assetTypes: string[], offset: number = 0): Promise<FungibleAssetMetadata[]> {
  const query = `
    query GetFungibleAssetInfo($in: [String!], $offset: Int) {
      fungible_asset_metadata(
        where: {asset_type: {_in: $in}},
        offset: $offset,
        limit: 100
      ) {
        symbol
        name
        decimals
        asset_type
        __typename
      }
    }
  `;

  const variables = {
    in: assetTypes,
    offset
  };

  try {
    const response = await fetch(APTOS_INDEXER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    const result: GraphQLResponse<{ fungible_asset_metadata: FungibleAssetMetadata[] }> = await response.json();
    
    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      throw new Error('GraphQL query failed');
    }

    return result.data.fungible_asset_metadata;
  } catch (error) {
    console.error('Error fetching fungible asset info:', error);
    throw error;
  }
}

// Get token metadata by name within a collection
export async function getTokensDataByName(tokenName: string, collectionId: string): Promise<TokenDataByName[]> {
  const query = `
    query GetTokensDataByName($token_name: String, $collectionId: String) {
      current_token_datas_v2(
        where: {token_name: {_eq: $token_name}, collection_id: {_eq: $collectionId}}
      ) {
        token_uri
        __typename
      }
    }
  `;

  const variables = {
    token_name: tokenName,
    collectionId
  };

  try {
    const response = await fetch(APTOS_INDEXER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    const result: GraphQLResponse<{ current_token_datas_v2: TokenDataByName[] }> = await response.json();
    
    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      throw new Error('GraphQL query failed');
    }

    return result.data.current_token_datas_v2;
  } catch (error) {
    console.error('Error fetching token data by name:', error);
    throw error;
  }
}

// Get fungible asset balances for an account
export async function getFungibleAssetBalances(
  address: string, 
  tokenStandard: string = 'v1', 
  offset: number = 0
): Promise<FungibleAssetBalance[]> {
  const query = `
    query GetFungibleAssetBalances($address: String, $offset: Int, $token_standard: String) {
      current_fungible_asset_balances(
        where: {owner_address: {_eq: $address}, token_standard:{ _eq: $token_standard}},
        offset: $offset,
        limit: 100,
        order_by: {amount: desc}
      ) {
        asset_type
        amount
        __typename
      }
    }
  `;

  const variables = {
    address,
    token_standard: tokenStandard,
    offset
  };

  try {
    const response = await fetch(APTOS_INDEXER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    const result: GraphQLResponse<{ current_fungible_asset_balances: FungibleAssetBalance[] }> = await response.json();
    
    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      throw new Error('GraphQL query failed');
    }

    return result.data.current_fungible_asset_balances;
  } catch (error) {
    console.error('Error fetching fungible asset balances:', error);
    throw error;
  }
}

// Helper function to generate collection ID from creator address and collection name
export async function generateCollectionId(creatorAddress: string, collectionName: string): Promise<string> {
  // Remove '0x' prefix if present
  const handle = creatorAddress.startsWith('0x') ? creatorAddress.slice(2) : creatorAddress;
  const standardizedAddress = `0x${handle.padStart(64, '0')}`;
  
  // Combine creator address and collection name
  const combinedString = `${creatorAddress}::${collectionName}`;
  
  // Compute SHA256 hash using Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(combinedString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `0x${hashHex}`;
}

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Get all tokens launched through our token launcher module
export async function getTokenLauncherTokens(moduleAddress: string): Promise<TokenCreationEvent[]> {
  // Query for events from our token launcher contract to find tokens created through it
  const query = `
    query GetTokenLauncherTokens {
      events(
        where: {
          type: {_like: "0x660bb7df7eaf94ac70403e64698faf8b68e5bffe68f1051a97d130068afc7a6b::token_launcher::%"}
        },
        order_by: {sequence_number: desc},
        limit: 100
      ) {
        type
        data
        sequence_number
        __typename
      }
    }
  `;

  const maxRetries = 3;
  const baseDelay = 2000; // 2 seconds

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Querying indexer for events from module: ${moduleAddress} (attempt ${attempt + 1}/${maxRetries})`);
      
      const response = await fetch(APTOS_INDEXER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          query
        })
      });

      console.log('Indexer response status:', response.status);

      if (response.status === 429) {
        console.log(`Rate limited (429). Waiting ${baseDelay * (attempt + 1)}ms before retry...`);
        await delay(baseDelay * (attempt + 1));
        continue;
      }

      if (!response.ok) {
        console.error('HTTP error:', response.status, response.statusText);
        return [];
      }

      const result: GraphQLResponse<{ events: TokenCreationEvent[] }> = await response.json();
      
      if (result.errors) {
        console.error('GraphQL errors:', result.errors);
        console.error('Full error details:', JSON.stringify(result.errors, null, 2));
        return [];
      }

      console.log('Found events:', result.data.events.length);
      return result.data.events;
    } catch (error) {
      console.error(`Error fetching token launcher tokens (attempt ${attempt + 1}):`, error);
      if (attempt < maxRetries - 1) {
        console.log(`Retrying in ${baseDelay * (attempt + 1)}ms...`);
        await delay(baseDelay * (attempt + 1));
      }
    }
  }

  console.error('All retry attempts failed');
  return [];
}

// Get token metadata for leaderboard display
export async function getTokenMetadataForLeaderboard(tokenAssetTypes: string[]): Promise<FungibleAssetMetadata[]> {
  return getFungibleAssetInfo(tokenAssetTypes);
}

// Fetch token metadata URI for additional token information
export async function getTokenMetadataURI(tokenName: string, creatorAddress: string, collectionName: string): Promise<string | null> {
  try {
    const collectionId = await generateCollectionId(creatorAddress, collectionName);
    const tokenData = await getTokensDataByName(tokenName, collectionId);
    
    if (tokenData.length > 0) {
      return tokenData[0].token_uri;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching token metadata URI:', error);
    return null;
  }
}

// Get token metadata for a specific asset type
export async function getTokenMetadata(assetType: string): Promise<FungibleAssetMetadata | null> {
  try {
    const metadata = await getFungibleAssetInfo([assetType]);
    return metadata.length > 0 ? metadata[0] : null;
  } catch (error) {
    console.error('Error fetching token metadata:', error);
    return null;
  }
}

// Get token balance for a specific asset type and address
export async function getTokenBalance(address: string, assetType: string): Promise<string> {
  try {
    const balances = await getFungibleAssetBalances(address);
    const balance = balances.find(b => b.asset_type === assetType);
    return balance ? balance.amount : '0';
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return '0';
  }
}