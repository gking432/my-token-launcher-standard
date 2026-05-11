// Server-side proxy for Geomi token_created_events.
// Browser calls /api/catalog; this calls Geomi once and caches the result.
// Prevents per-user rate limiting (429) from direct browser→Geomi calls.

const https = require('https');

const GEOMI_HOST = 'api.testnet.aptoslabs.com';
const GEOMI_PATH = '/nocode/v1/api/cmhtiqv8w005ps601yfd1g4ur/v1/graphql';

const CACHE_TTL_MS = 30_000; // 30s — token list changes slowly
let cache = null; // { value, expiresAt }
let inFlight = null;

const CATALOG_QUERY = `query GetTokenCreatedEvents {
  token_created_events(order_by: { timestamp: desc }) {
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
}`;

function postGeomi(query) {
  const apiKey = process.env.GEOMI_API_KEY || process.env.REACT_APP_GEOMI_API_KEY || '';
  const payload = JSON.stringify({ query });
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
            return reject(new Error(`Geomi ${res.statusCode}: ${raw.slice(0, 200)}`));
          }
          try {
            const json = JSON.parse(raw);
            if (json.errors) return reject(new Error(`Geomi errors: ${JSON.stringify(json.errors)}`));
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

async function fetchCatalog() {
  const data = await postGeomi(CATALOG_QUERY);
  return data.token_created_events || [];
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return res.json({ tokens: cache.value });
  }

  if (!inFlight) {
    inFlight = fetchCatalog().finally(() => { inFlight = null; });
  }

  try {
    const value = await inFlight;
    cache = { value, expiresAt: now + CACHE_TTL_MS };
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return res.json({ tokens: value });
  } catch (err) {
    console.error('[/api/catalog] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
