// Trade history — standard Aptos indexer + fullnode (zero cost, no Geomi).
//
// Same pattern as /api/catalog:
//   1. account_transactions for the token's metadata address (indexed primary
//      key lookup, fast on unauthenticated public tier, no credit cap)
//   2. Fullnode by_version for each transaction → extract TokenPurchaseEvent
//      and TokenSaleEvent
//
// Cold fetch: ~1-3s for a token with <200 trades (concurrency=8 fullnode calls).
// Subsequent reads: <1ms from the 60s in-memory cache.

const MODULE_ADDRESS = '0xec714c0618845f5033b9d6f1bd9d32b6a00ab611e38738a3073a118a37d61a5c';
const PURCHASE_EVENT_TYPE = `${MODULE_ADDRESS}::token_launcher::TokenPurchaseEvent`;
const SALE_EVENT_TYPE     = `${MODULE_ADDRESS}::token_launcher::TokenSaleEvent`;

const INDEXER_HOST      = 'api.testnet.aptoslabs.com';
const INDEXER_PATH      = '/v1/graphql';
const FULLNODE          = 'https://fullnode.testnet.aptoslabs.com/v1';
const FULLNODE_CONCURRENCY = 8;

const CACHE_TTL_MS = 60_000;
const cache    = new Map();
const inFlight = new Map();

const ACCOUNT_TXS_QUERY = `query GetTokenTxs($account: String!, $limit: Int!) {
  account_transactions(
    where: { account_address: { _eq: $account } }
    order_by: { transaction_version: asc }
    limit: $limit
  ) {
    transaction_version
  }
}`;

function normaliseAddr(a) {
  if (!a) return '';
  return String(a).toLowerCase().replace(/^(?:0x)?/, '0x');
}

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

function microsToMs(micros) {
  if (micros == null) return Date.now();
  const n = typeof micros === 'string' ? parseInt(micros, 10) : Number(micros);
  return Number.isFinite(n) && n > 0 ? Math.floor(n / 1000) : Date.now();
}

async function buildTrades(addr) {
  // 1. Get all transaction versions for this token address
  const data = await postIndexer(ACCOUNT_TXS_QUERY, { account: addr, limit: 500 });
  const rows = data.account_transactions || [];

  if (rows.length === 0) return { trades: [], decimals: 0, finalTokensSold: 0 };

  // 2. Fetch each transaction from fullnode, extract purchase/sale events
  const versions = rows.map(r => r.transaction_version);
  const fullTxs  = await mapLimit(versions, FULLNODE_CONCURRENCY, fetchTxByVersion);

  // 3. Get decimals from the first transaction that has fungible asset metadata,
  //    or fall back to a direct resource read
  let decimals = 0;
  try {
    const res = await fetch(
      `${FULLNODE}/accounts/${addr}/resource/${encodeURIComponent('0x1::fungible_asset::Metadata')}`
    );
    if (res.ok) {
      const json = await res.json();
      decimals = parseInt(json?.data?.decimals ?? '0', 10);
    }
  } catch { /* leave decimals=0 */ }

  const decimalsFactor = Math.pow(10, decimals);
  const buyTrades  = [];
  const sellTrades = [];

  for (const tx of fullTxs) {
    if (!tx || !Array.isArray(tx.events)) continue;

    for (const evt of tx.events) {
      const d = evt.data || {};

      if (evt.type === PURCHASE_EVENT_TYPE) {
        const amountAtomic     = parseInt(d.amount || '0', 10);
        const amountWhole      = decimalsFactor > 1
          ? Math.round(amountAtomic / decimalsFactor)
          : amountAtomic;
        const tokensSoldBefore = parseInt(d.tokens_sold || '0', 10);
        buyTrades.push({
          type: 'buy',
          wallet: d.buyer || '',
          amount: amountWhole,
          aptValue: parseInt(d.liquidity_contribution || '0', 10) / 1e8,
          timestampMs: microsToMs(d.timestamp),
          txVersion: parseInt(tx.version || '0', 10),
          tokensSoldBefore,
          tokensSoldAfter: tokensSoldBefore + amountWhole,
        });
      } else if (evt.type === SALE_EVENT_TYPE) {
        const amountWhole      = parseInt(d.amount || '0', 10);
        const tokensSoldBefore = parseInt(d.tokens_sold || '0', 10);
        sellTrades.push({
          type: 'sell',
          wallet: d.seller || '',
          amount: amountWhole,
          aptValue: parseInt(d.apt_returned || '0', 10) / 1e8,
          timestampMs: microsToMs(d.timestamp),
          txVersion: parseInt(tx.version || '0', 10),
          tokensSoldBefore,
          tokensSoldAfter: Math.max(0, tokensSoldBefore - amountWhole),
        });
      }
    }
  }

  const trades = [...buyTrades, ...sellTrades].sort((a, b) => a.txVersion - b.txVersion);
  const finalTokensSold = trades.length > 0 ? trades[trades.length - 1].tokensSoldAfter : 0;

  return { trades, decimals, finalTokensSold };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const addr = normaliseAddr(req.query.addr);
  if (!addr) return res.status(400).json({ error: 'addr required' });

  const now    = Date.now();
  const cached = cache.get(addr);
  if (cached && cached.expiresAt > now) {
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return res.json(cached.value);
  }

  let promise = inFlight.get(addr);
  if (!promise) {
    promise = buildTrades(addr).finally(() => inFlight.delete(addr));
    inFlight.set(addr, promise);
  }

  try {
    const value = await promise;
    cache.set(addr, { value, expiresAt: now + CACHE_TTL_MS });
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return res.json(value);
  } catch (err) {
    console.error('[/api/trades] error:', err.message);
    const stale = cache.get(addr);
    if (stale) return res.json(stale.value);
    return res.status(500).json({ error: err.message });
  }
};
