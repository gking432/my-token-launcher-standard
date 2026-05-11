// Server-side proxy for Geomi token_created_events.
// - 60s fresh cache, 1 hour stale-on-error window
// - Retries 429s with exponential backoff
// - Returns last good data even if Geomi is currently rate-limited

const https = require('https');

const GEOMI_HOST = 'api.testnet.aptoslabs.com';
const GEOMI_PATH = '/nocode/v1/api/cmhtiqv8w005ps601yfd1g4ur/v1/graphql';

const FRESH_TTL_MS = 60_000;        // serve from cache without hitting Geomi
const STALE_TTL_MS = 60 * 60_000;   // serve stale data on error within 1 hour

let cache = null;     // { value, freshUntil, staleUntil, cachedAt }
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
            const err = new Error(`Geomi ${res.statusCode}: ${raw.slice(0, 200)}`);
            err.status = res.statusCode;
            return reject(err);
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

async function fetchCatalogWithRetry() {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const data = await postGeomi(CATALOG_QUERY);
      return data.token_created_events || [];
    } catch (err) {
      lastErr = err;
      // Retry on rate-limit / transient errors with exponential backoff
      if ((err.status === 429 || err.status >= 500) && attempt < 3) {
        const delay = 500 * Math.pow(2, attempt); // 500ms, 1s, 2s
        await new Promise(r => setTimeout(r, delay));
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

  // Serve from fresh cache
  if (cache && now < cache.freshUntil) {
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.json({ tokens: cache.value, cached: true });
  }

  // Coalesce concurrent requests
  if (!inFlight) {
    inFlight = fetchCatalogWithRetry().finally(() => { inFlight = null; });
  }

  try {
    const value = await inFlight;
    cache = {
      value,
      freshUntil: now + FRESH_TTL_MS,
      staleUntil: now + STALE_TTL_MS,
      cachedAt: now,
    };
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.json({ tokens: value });
  } catch (err) {
    console.error('[/api/catalog] fetch failed:', err.message);
    // Serve stale data if we have it
    if (cache && now < cache.staleUntil) {
      console.warn('[/api/catalog] serving stale cache');
      res.setHeader('Cache-Control', 'public, s-maxage=10');
      return res.json({ tokens: cache.value, stale: true, error: err.message });
    }
    // No cache at all — return empty array so frontend doesn't crash
    return res.status(200).json({ tokens: [], error: err.message });
  }
};
