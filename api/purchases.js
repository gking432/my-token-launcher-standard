// Server-side proxy for ALL purchase events (across all tokens).
// Used by useTokenData to calculate 24h volume + price change on the homepage.
// Without this, every browser was hitting Geomi directly → 429.

const https = require('https');

const GEOMI_HOST = 'api.testnet.aptoslabs.com';
const GEOMI_PATH = '/nocode/v1/api/cmhtiqv8w005ps601yfd1g4ur/v1/graphql';

const FRESH_TTL_MS = 30_000;
const STALE_TTL_MS = 60 * 60_000;

let cache = null;
let inFlight = null;

const QUERY = `query GetAllPurchases($limit: Int!) {
  token_purchase_events(
    order_by: { timestamp: desc }
    limit: $limit
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
}`;

function postGeomi(query, variables) {
  const apiKey = process.env.GEOMI_API_KEY || process.env.REACT_APP_GEOMI_API_KEY || '';
  const payload = JSON.stringify({ query, variables });
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  };
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
        res.on('end', () => {
          if (res.statusCode >= 400) {
            const err = new Error(`Geomi ${res.statusCode}: ${raw.slice(0, 200)}`);
            err.status = res.statusCode;
            return reject(err);
          }
          try {
            const json = JSON.parse(raw);
            if (json.errors) return reject(new Error(JSON.stringify(json.errors)));
            resolve(json.data || {});
          } catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function fetchAllPurchases() {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const data = await postGeomi(QUERY, { limit: 1000 });
      return data.token_purchase_events || [];
    } catch (err) {
      lastErr = err;
      if ((err.status === 429 || err.status >= 500) && attempt < 3) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const now = Date.now();
  if (cache && now < cache.freshUntil) {
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    return res.json({ purchases: cache.value, cached: true });
  }

  if (!inFlight) {
    inFlight = fetchAllPurchases().finally(() => { inFlight = null; });
  }

  try {
    const value = await inFlight;
    cache = { value, freshUntil: now + FRESH_TTL_MS, staleUntil: now + STALE_TTL_MS };
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    return res.json({ purchases: value });
  } catch (err) {
    console.error('[/api/purchases] fetch failed:', err.message);
    if (cache && now < cache.staleUntil) {
      return res.json({ purchases: cache.value, stale: true, error: err.message });
    }
    return res.status(200).json({ purchases: [], error: err.message });
  }
};
