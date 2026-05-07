const https = require('https');

const GEOMI_HOST = 'api.testnet.aptoslabs.com';
const GEOMI_PATH = '/nocode/v1/api/cmhtiqv8w005ps601yfd1g4ur/v1/graphql';

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

function post(body, apiKey) {
  const payload = JSON.stringify(body);
  const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['x-api-key'] = apiKey;
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: GEOMI_HOST, path: GEOMI_PATH, method: 'POST', headers },
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
  if (type !== 'purchase' && type !== 'sale') {
    return res.status(400).json({ error: 'type must be purchase or sale' });
  }

  const limitNum = Math.min(parseInt(limit, 10) || 1000, 1000);
  const apiKey = process.env.GEOMI_API_KEY || process.env.REACT_APP_GEOMI_API_KEY || '';

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

  try {
    const { status, body } = await post({ query, variables }, apiKey);

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
