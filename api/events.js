const https = require('https');

const GEOMI_HOST = 'api.testnet.aptoslabs.com';
const GEOMI_PATH = '/nocode/v1/api/cmhtiqv8w005ps601yfd1g4ur/v1/graphql';
const APTOS_INDEXER_PATH = '/v1/graphql';

const PURCHASE_QUERY = `query GetPurchaseEvents($addr: String!, $limit: Int!) {
  token_purchase_events(
    where: { metadata_addr: { _eq: $addr } }
    order_by: { timestamp: desc }
    limit: $limit
  ) { buyer metadata_addr amount price liquidity_contribution timestamp tokens_sold }
}`;

const PURCHASE_QUERY_ALL = `query GetAllPurchaseEvents($limit: Int!) {
  token_purchase_events(
    order_by: { timestamp: desc }
    limit: $limit
  ) { buyer metadata_addr amount price liquidity_contribution timestamp tokens_sold }
}`;

const SALE_QUERY = `query GetSaleEvents($addr: String!, $limit: Int!) {
  token_sale_events(
    where: { metadata_addr: { _eq: $addr } }
    order_by: { timestamp: desc }
    limit: $limit
  ) { seller metadata_addr amount apt_returned timestamp tokens_sold }
}`;

const SALE_QUERY_ALL = `query GetAllSaleEvents($limit: Int!) {
  token_sale_events(
    order_by: { timestamp: desc }
    limit: $limit
  ) { seller metadata_addr amount apt_returned timestamp tokens_sold }
}`;

// Queries the standard Aptos indexer (fungible_asset_activities is NOT deprecated)
const ACTIVITIES_QUERY = `query GetFungibleAssetActivities($asset_type: String!, $limit: Int!) {
  fungible_asset_activities(
    where: { asset_type: { _eq: $asset_type } }
    order_by: { transaction_version: asc }
    limit: $limit
  ) {
    owner_address
    amount
    type
    transaction_version
    transaction_timestamp
  }
}`;

function post(body, apiKey, hostname, path) {
  const payload = JSON.stringify(body);
  const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['x-api-key'] = apiKey;
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method: 'POST', headers },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => resolve({ status: res.statusCode, body: raw }));
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, addr, limit = '1000' } = req.query;
  if (type !== 'purchase' && type !== 'sale' && type !== 'activities') {
    return res.status(400).json({ error: 'type must be purchase, sale, or activities' });
  }

  const limitNum = Math.min(parseInt(limit, 10) || 1000, 1000);
  const geomiApiKey = process.env.GEOMI_API_KEY || process.env.REACT_APP_GEOMI_API_KEY || '';

  try {
    // activities — query fungible_asset_activities from the standard Aptos indexer
    if (type === 'activities') {
      if (!addr) return res.status(400).json({ error: 'addr required for activities' });
      const aptosApiKey = process.env.APTOS_API_KEY || process.env.REACT_APP_APTOS_API_KEY || '';
      const { status, body } = await post(
        { query: ACTIVITIES_QUERY, variables: { asset_type: addr.toLowerCase(), limit: limitNum } },
        aptosApiKey,
        GEOMI_HOST,
        APTOS_INDEXER_PATH
      );

      if (status >= 400) {
        console.error('[/api/events] activities upstream error', status, body.slice(0, 300));
        return res.status(status).json({ error: `Upstream ${status}: ${body.slice(0, 200)}` });
      }

      const result = JSON.parse(body);
      if (result.errors) {
        console.error('[/api/events] activities GraphQL errors', result.errors);
        return res.status(500).json({ error: result.errors });
      }

      const activities = result.data?.fungible_asset_activities || [];
      console.log(`[/api/events] activities addr=${addr} => ${activities.length} records`);
      return res.json({ activities });
    }

    // purchase / sale — query Geomi No-Code Indexer
    let query, variables;
    if (type === 'purchase') {
      if (addr) {
        query = PURCHASE_QUERY;
        variables = { addr: addr.toLowerCase(), limit: limitNum };
      } else {
        query = PURCHASE_QUERY_ALL;
        variables = { limit: limitNum };
      }
    } else {
      if (addr) {
        query = SALE_QUERY;
        variables = { addr: addr.toLowerCase(), limit: limitNum };
      } else {
        query = SALE_QUERY_ALL;
        variables = { limit: limitNum };
      }
    }

    const { status, body } = await post({ query, variables }, geomiApiKey, GEOMI_HOST, GEOMI_PATH);

    if (status >= 400) {
      console.error('[/api/events] upstream error', status, body.slice(0, 300));
      return res.status(status).json({ error: `Upstream ${status}: ${body.slice(0, 200)}` });
    }

    const result = JSON.parse(body);
    if (result.errors) {
      console.error('[/api/events] GraphQL errors', result.errors);
      return res.status(500).json({ error: result.errors });
    }

    const tableKey = type === 'purchase' ? 'token_purchase_events' : 'token_sale_events';
    const events = result.data?.[tableKey] || [];

    console.log(`[/api/events] type=${type} addr=${addr || 'all'} => ${events.length} events`);
    return res.json({ events });
  } catch (err) {
    console.error('[/api/events] exception', err.message);
    return res.status(500).json({ error: err.message });
  }
};
