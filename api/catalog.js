// Token catalog — finds all tokens ever created via the launcher contract.
//
// Data sources (Geomi-free):
//   1. Standard Aptos indexer (account_transactions) — list of all tx versions
//      that called token_launcher::create_token
//   2. Fullnode (transactions/by_version/{v}) — actual event data per tx
//
// One indexer call + N fullnode calls per cold fetch. Results cached for 5
// minutes, then served stale-while-revalidate. N is small (≈ # tokens ever
// created), so the cold fetch is 2-10s; subsequent reads are <1ms from cache.

const https = require('https');

const MODULE_ADDRESS = '0x8c699e8fa969a555f46629c345d6c10d9512a3398a4353e7af4c2bcf95b9c96d';
const ENTRY_FUNCTION = `${MODULE_ADDRESS}::token_launcher::create_token`;
const EVENT_TYPE = `${MODULE_ADDRESS}::token_launcher::TokenCreatedEvent`;

const INDEXER_HOST = 'api.testnet.aptoslabs.com';
const INDEXER_PATH = '/v1/graphql';
const FULLNODE = 'https://fullnode.testnet.aptoslabs.com/v1';

const FRESH_TTL_MS = 5 * 60_000;   // 5 minutes fresh
const STALE_TTL_MS = 60 * 60_000;  // 1 hour stale-on-error
const FULLNODE_CONCURRENCY = 8;

let cache = null;
let inFlight = null;

const CREATE_TXS_QUERY = `query GetCreateTxs($entryFn: String!, $limit: Int!) {
  user_transactions(
    where: {
      entry_function_id_str: { _eq: $entryFn }
    }
    order_by: { version: desc }
    limit: $limit
  ) {
    version
    timestamp
  }
}`;

function postIndexer(query, variables) {
  // No API key — the monthly credit cap only applies to authenticated requests.
  // Public/unauthenticated requests to the standard Aptos indexer use a separate
  // rate-limit pool that is not subject to the org's MonthlyCredit cap.
  const payload = JSON.stringify({ query, variables });
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  };

  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: INDEXER_HOST, path: INDEXER_PATH, method: 'POST', headers },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            return reject(new Error(`Indexer ${res.statusCode}: ${raw.slice(0, 200)}`));
          }
          try {
            const json = JSON.parse(raw);
            if (json.errors) return reject(new Error(`Indexer errors: ${JSON.stringify(json.errors)}`));
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

async function fetchTxByVersion(version) {
  const res = await fetch(`${FULLNODE}/transactions/by_version/${version}`);
  if (!res.ok) return null;
  return res.json();
}

// Bounded-concurrency map so we don't fan out 100 parallel fullnode calls
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      try { out[idx] = await fn(items[idx]); }
      catch (e) { out[idx] = null; }
    }
  });
  await Promise.all(workers);
  return out;
}

// Hex string ("0x46") → readable utf8 ("F" or "FOO")
function hexToUtf8(hex) {
  if (!hex || typeof hex !== 'string') return '';
  const clean = hex.replace(/^0x/, '');
  let out = '';
  for (let i = 0; i < clean.length; i += 2) {
    out += String.fromCharCode(parseInt(clean.substr(i, 2), 16));
  }
  return out;
}

async function fetchCatalog() {
  // 1. Indexer: find all tx versions that called create_token
  const data = await postIndexer(CREATE_TXS_QUERY, {
    entryFn: ENTRY_FUNCTION,
    limit: 500,
  });
  const txs = data.user_transactions || [];
  console.log(`[catalog] indexer returned ${txs.length} create_token txs`);

  if (txs.length === 0) return [];

  // 2. Fullnode: fetch each transaction and pull the TokenCreatedEvent out
  const versions = txs.map(t => t.version);
  const fullTxs = await mapLimit(versions, FULLNODE_CONCURRENCY, fetchTxByVersion);

  const tokens = [];
  for (const tx of fullTxs) {
    if (!tx || !Array.isArray(tx.events)) continue;
    const evt = tx.events.find(e => e.type === EVENT_TYPE);
    if (!evt) continue;
    const d = evt.data || {};
    tokens.push({
      event_index: evt.sequence_number || '0',
      sequence_number: evt.sequence_number || '0',
      creator: d.creator || '',
      metadata_addr: d.metadata_addr || '',
      ticker: d.ticker || '',  // hex string from on-chain
      ticker_decoded: hexToUtf8(d.ticker || ''),
      total_supply: d.total_supply || '0',
      minted_supply: d.minted_supply || '0',
      remaining_supply: d.remaining_supply || '0',
      decimals_factor: d.decimals_factor || '1',
      premint_amount: d.premint_amount || '0',
      timestamp: d.timestamp || '0',
      transaction_version: tx.version,
    });
  }

  console.log(`[catalog] extracted ${tokens.length} TokenCreatedEvents from ${fullTxs.length} txs`);
  return tokens;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const now = Date.now();
  if (cache && now < cache.freshUntil) {
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
    return res.json({ tokens: cache.value, cached: true });
  }

  if (!inFlight) {
    inFlight = fetchCatalog().finally(() => { inFlight = null; });
  }

  try {
    const value = await inFlight;
    cache = { value, freshUntil: now + FRESH_TTL_MS, staleUntil: now + STALE_TTL_MS };
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
    return res.json({ tokens: value });
  } catch (err) {
    console.error('[/api/catalog] fetch failed:', err.message);
    if (cache && now < cache.staleUntil) {
      return res.json({ tokens: cache.value, stale: true, error: err.message });
    }
    return res.status(200).json({ tokens: [], error: err.message });
  }
};
