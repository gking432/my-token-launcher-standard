// Trade history — indexer account_transactions + fullnode per-tx events.
//
// Standard indexer paths for custom contract events are both broken:
//   - `events` table: deprecated (HTTP 400 since Sep 2024)
//   - `fungible_asset_activities`: times out (no composite index on testnet)
//
// Working path:
//   1. account_transactions(where: { account_address: { _eq: metadataAddr } })
//      The indexer tracks every account whose resources were touched.
//      TokenVault is stored AT metadataAddr, so every buy/sell appears here.
//      account_address is a primary key column — fast indexed lookup.
//   2. /v1/transactions/by_version/{v} on the fullnode for each version.
//      Transactions include their events inline. Batched in parallel.
//      Filters for TokenPurchaseEvent / TokenSaleEvent.
//
// Exact APT values come from the contract event fields: liquidity_contribution
// (buy cost) and apt_returned (sell proceeds). No bonding-curve estimation.

const MODULE_ADDRESS = '0x8c699e8fa969a555f46629c345d6c10d9512a3398a4353e7af4c2bcf95b9c96d';
const PURCHASE_EVENT_TYPE = `${MODULE_ADDRESS}::token_launcher::TokenPurchaseEvent`;
const SALE_EVENT_TYPE    = `${MODULE_ADDRESS}::token_launcher::TokenSaleEvent`;
const FULLNODE = 'https://fullnode.testnet.aptoslabs.com/v1';
const INDEXER  = 'https://api.testnet.aptoslabs.com/v1/graphql';
const BATCH    = 20; // concurrent fullnode calls per round

const CACHE_TTL_MS = 5_000;
const cache    = new Map();
const inFlight = new Map();

function normaliseAddr(a) {
  if (!a) return '';
  return String(a).toLowerCase().replace(/^(?:0x)?/, '0x');
}

function apiKey() {
  return process.env.APTOS_API_KEY
      || process.env.REACT_APP_APTOS_API_KEY
      || process.env.REACT_APP_GEOMI_API_KEY
      || '';
}

function authHeaders() {
  const k = apiKey();
  return k ? { Authorization: `Bearer ${k}` } : {};
}

// Step 1 — indexer: get all transaction versions that touched metadataAddr.
const ACCT_TX_QUERY = `query AcctTx($addr: String!, $limit: Int!) {
  account_transactions(
    where: { account_address: { _eq: $addr } }
    order_by: { transaction_version: asc }
    limit: $limit
  ) {
    transaction_version
  }
}`;

async function fetchTxVersions(addr) {
  const headers = { 'Content-Type': 'application/json', ...authHeaders() };
  const res = await fetch(INDEXER, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: ACCT_TX_QUERY, variables: { addr, limit: 1000 } }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Indexer ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  if (json.errors) throw new Error(`Indexer: ${JSON.stringify(json.errors)}`);
  return (json.data?.account_transactions || []).map(r => String(r.transaction_version));
}

// Step 2 — fullnode: fetch a single transaction by version and return its events.
async function fetchTxEvents(version) {
  const res = await fetch(`${FULLNODE}/transactions/by_version/${version}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  const tx = await res.json();
  return tx?.events || [];
}

// Run fetchTxEvents for all versions, BATCH concurrent at a time.
async function fetchAllTxEvents(versions) {
  const events = [];
  for (let i = 0; i < versions.length; i += BATCH) {
    const slice = versions.slice(i, i + BATCH);
    const results = await Promise.all(slice.map(fetchTxEvents));
    for (let j = 0; j < slice.length; j++) {
      const version = parseInt(slice[j], 10);
      for (const ev of results[j]) {
        events.push({ version, ev });
      }
    }
  }
  return events;
}

async function fetchDecimals(addr) {
  const res = await fetch(
    `${FULLNODE}/accounts/${addr}/resource/${encodeURIComponent('0x1::fungible_asset::Metadata')}`,
    { headers: authHeaders() }
  );
  if (!res.ok) return 0;
  const json = await res.json();
  return parseInt(json?.data?.decimals ?? '0', 10);
}

function microsToMs(micros) {
  if (micros == null) return Date.now();
  const n = typeof micros === 'string' ? parseInt(micros, 10) : Number(micros);
  return Number.isFinite(n) && n > 0 ? Math.floor(n / 1000) : Date.now();
}

async function buildTrades(addr) {
  const [decimals, versions] = await Promise.all([
    fetchDecimals(addr),
    fetchTxVersions(addr),
  ]);
  const decimalsFactor = Math.pow(10, decimals);

  const allEvents = await fetchAllTxEvents(versions);

  const buyTrades  = [];
  const sellTrades = [];

  for (const { version, ev } of allEvents) {
    const d = ev.data || {};
    if (ev.type === PURCHASE_EVENT_TYPE) {
      const amountAtomic   = parseInt(d.amount || '0', 10);
      const amountWhole    = decimalsFactor > 1 ? Math.round(amountAtomic / decimalsFactor) : amountAtomic;
      const tokensSoldBefore = parseInt(d.tokens_sold || '0', 10);
      buyTrades.push({
        type: 'buy',
        wallet: d.buyer || '',
        amount: amountWhole,
        aptValue: parseInt(d.liquidity_contribution || '0', 10) / 1e8,
        timestampMs: microsToMs(d.timestamp),
        txVersion: version,
        tokensSoldBefore,
        tokensSoldAfter: tokensSoldBefore + amountWhole,
      });
    } else if (ev.type === SALE_EVENT_TYPE) {
      const amountWhole    = parseInt(d.amount || '0', 10);
      const tokensSoldBefore = parseInt(d.tokens_sold || '0', 10);
      sellTrades.push({
        type: 'sell',
        wallet: d.seller || '',
        amount: amountWhole,
        aptValue: parseInt(d.apt_returned || '0', 10) / 1e8,
        timestampMs: microsToMs(d.timestamp),
        txVersion: version,
        tokensSoldBefore,
        tokensSoldAfter: Math.max(0, tokensSoldBefore - amountWhole),
      });
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

  const now = Date.now();
  const cached = cache.get(addr);
  if (cached && cached.expiresAt > now) {
    res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=15');
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
    res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=15');
    return res.json(value);
  } catch (err) {
    console.error('[/api/trades] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
