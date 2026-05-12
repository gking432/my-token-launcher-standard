// Token catalog — finds all tokens ever created via the launcher contract.
//
// Strategy:
//   1. Indexer (unauthenticated, public tier): account_transactions for the
//      module address. This query is O(1) on an indexed primary key, so it
//      never times out — unlike user_transactions filtered by entry_function_id_str
//      which scans the whole table and hits the 10s timeout on the public tier.
//   2. Fullnode: fetch each transaction by version (concurrency-limited) and
//      filter locally for TokenCreatedEvent.
//
// Cached 5 minutes, stale-while-revalidate 1 hour.

const https = require('https');

const MODULE_ADDRESS = '0x8c699e8fa969a555f46629c345d6c10d9512a3398a4353e7af4c2bcf95b9c96d';
const EVENT_TYPE = `${MODULE_ADDRESS}::token_launcher::TokenCreatedEvent`;

const INDEXER_HOST = 'api.testnet.aptoslabs.com';
const INDEXER_PATH = '/v1/graphql';
const FULLNODE = 'https://fullnode.testnet.aptoslabs.com/v1';

const FRESH_TTL_MS = 5 * 60_000;
const STALE_TTL_MS = 60 * 60_000;
const FULLNODE_CONCURRENCY = 8;

let cache = null;
let inFlight = null;

// account_transactions is indexed by account_address (primary key).
// This query is fast on the public unauthenticated tier — no table scan.
const ACCOUNT_TXS_QUERY = `query GetModuleTxs($account: String!, $limit: Int!) {
  account_transactions(
    where: { account_address: { _eq: $account } }
    order_by: { transaction_version: desc }
    limit: $limit
  ) {
    transaction_version
  }
}`;

function postIndexer(query, variables) {
  // No API key — monthly credit cap only blocks authenticated requests.
  // Unauthenticated public-tier requests are subject to a separate, non-capped pool.
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

// Bounded-concurrency map so we don't fan out hundreds of parallel fullnode calls
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

function hexToUtf8(hex) {
  if (!hex || typeof hex !== 'string') return '';
  const clean = hex.replace(/^0x/, '');
  let out = '';
  for (let i = 0; i < clean.length; i += 2) {
    out += String.fromCharCode(parseInt(clean.substr(i, 2), 16));
  }
  return out;
}

async function fetchFungibleMetadata(addr) {
  try {
    const res = await fetch(
      `${FULLNODE}/accounts/${addr}/resource/${encodeURIComponent('0x1::fungible_asset::Metadata')}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    const d = json?.data ?? {};
    return {
      name:     d.name     || '',
      symbol:   d.symbol   || '',
      icon_uri: d.icon_uri || '',
    };
  } catch { return null; }
}

async function fetchCatalog() {
  // 1. Get all transaction versions that touched the module (fast indexed lookup)
  const data = await postIndexer(ACCOUNT_TXS_QUERY, {
    account: MODULE_ADDRESS,
    limit: 500,
  });
  const rows = data.account_transactions || [];
  console.log(`[catalog] indexer returned ${rows.length} module account_transactions`);

  if (rows.length === 0) return [];

  // 2. Fetch each transaction from fullnode and filter for TokenCreatedEvent
  const versions = rows.map(r => r.transaction_version);
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
      ticker: d.ticker || '',
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

  console.log(`[catalog] found ${tokens.length} TokenCreatedEvents among ${fullTxs.length} txs`);

  // Enrich with fungible asset metadata (name, symbol, icon_uri) — parallel, bounded.
  const metaList = await mapLimit(
    tokens.map(t => t.metadata_addr),
    FULLNODE_CONCURRENCY,
    fetchFungibleMetadata
  );
  for (let i = 0; i < tokens.length; i++) {
    const m = metaList[i];
    if (!m) continue;
    tokens[i].name     = m.name     || tokens[i].ticker_decoded;
    tokens[i].symbol   = m.symbol   || tokens[i].ticker_decoded;
    tokens[i].icon_uri = m.icon_uri || '';
  }

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
