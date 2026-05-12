// All recent purchase events across all tokens — used by homepage for 24h
// volume and price change calculations.
//
// Same pattern as /api/catalog and /api/trades:
//   account_transactions for the module address (indexed, free, no Geomi)
//   + fullnode by_version to extract TokenPurchaseEvent data.

const MODULE_ADDRESS      = '0x8c699e8fa969a555f46629c345d6c10d9512a3398a4353e7af4c2bcf95b9c96d';
const PURCHASE_EVENT_TYPE = `${MODULE_ADDRESS}::token_launcher::TokenPurchaseEvent`;

const INDEXER_HOST         = 'api.testnet.aptoslabs.com';
const INDEXER_PATH         = '/v1/graphql';
const FULLNODE             = 'https://fullnode.testnet.aptoslabs.com/v1';
const FULLNODE_CONCURRENCY = 8;

const FRESH_TTL_MS = 30_000;
const STALE_TTL_MS = 60 * 60_000;

let cache    = null;
let inFlight = null;

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
  const payload = JSON.stringify({ query, variables });
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  };
  return new Promise((resolve, reject) => {
    const req = require('https').request(
      { hostname: INDEXER_HOST, path: INDEXER_PATH, method: 'POST', headers },
      (res) => {
        let raw = '';
        res.on('data', c => { raw += c; });
        res.on('end', () => {
          if (res.statusCode >= 400)
            return reject(new Error(`Indexer ${res.statusCode}: ${raw.slice(0, 200)}`));
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

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      try { out[idx] = await fn(items[idx]); }
      catch { out[idx] = null; }
    }
  });
  await Promise.all(workers);
  return out;
}

async function fetchAllPurchases() {
  const data = await postIndexer(ACCOUNT_TXS_QUERY, { account: MODULE_ADDRESS, limit: 500 });
  const rows = data.account_transactions || [];
  if (rows.length === 0) return [];

  const versions = rows.map(r => r.transaction_version);
  const fullTxs  = await mapLimit(versions, FULLNODE_CONCURRENCY, fetchTxByVersion);

  const purchases = [];
  for (const tx of fullTxs) {
    if (!tx || !Array.isArray(tx.events)) continue;
    for (const evt of tx.events) {
      if (evt.type !== PURCHASE_EVENT_TYPE) continue;
      const d = evt.data || {};
      purchases.push({
        buyer:                  d.buyer || '',
        metadata_addr:          d.metadata_addr || '',
        amount:                 d.amount || '0',
        price:                  d.price || '0',
        liquidity_contribution: d.liquidity_contribution || '0',
        timestamp:              d.timestamp || '0',
        tokens_sold:            d.tokens_sold || '0',
        transaction_version:    tx.version,
      });
    }
  }

  console.log(`[/api/purchases] ${purchases.length} purchase events from ${rows.length} module txs`);
  return purchases;
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
    if (cache && now < cache.staleUntil)
      return res.json({ purchases: cache.value, stale: true, error: err.message });
    return res.status(200).json({ purchases: [], error: err.message });
  }
};
