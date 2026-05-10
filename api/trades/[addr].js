// Trade history for a token, sourced from the Geomi No-Code Indexer's purpose-
// built `token_purchase_events` / `token_sale_events` tables. These mirror the
// contract's TokenPurchaseEvent / TokenSaleEvent and carry EXACT APT values
// (`liquidity_contribution` for buys, `apt_returned` for sells) plus the pre-
// trade `tokens_sold` state, so we don't need to reconstruct anything.
//
// Why not the standard indexer's `fungible_asset_activities` (the previous
// approach)? It only knows token amounts. We were estimating APT from a
// bonding curve fed by `tokens_sold` accumulated from zero — which produces
// the wrong price when indexer history is partial, off by orders of magnitude.
//
// Why not the standard indexer's `events` table? Filtering by JSONB
// (`data._contains`) is not reliably exposed on the public Aptos indexer, and
// address normalisation in JSONB is brittle. Geomi's columnar tables filter
// natively on `metadata_addr` and are already proven via /api/events.

const https = require('https');

const GEOMI_HOST = 'api.testnet.aptoslabs.com';
const GEOMI_PATH = '/nocode/v1/api/cmhtiqv8w005ps601yfd1g4ur/v1/graphql';
const FULLNODE = 'https://fullnode.testnet.aptoslabs.com/v1';

const CACHE_TTL_MS = 5_000;
const cache = new Map(); // addr -> { value, expiresAt }
const inFlight = new Map();

function normaliseAddr(a) {
  if (!a) return '';
  const lower = String(a).toLowerCase();
  return lower.startsWith('0x') ? lower : `0x${lower}`;
}

const PURCHASE_QUERY = `query GetPurchaseEvents($addr: String!, $limit: Int!) {
  token_purchase_events(
    where: { metadata_addr: { _eq: $addr } }
    order_by: { transaction_version: asc }
    limit: $limit
  ) {
    buyer
    amount
    liquidity_contribution
    timestamp
    tokens_sold
    transaction_version
  }
}`;

const SALE_QUERY = `query GetSaleEvents($addr: String!, $limit: Int!) {
  token_sale_events(
    where: { metadata_addr: { _eq: $addr } }
    order_by: { transaction_version: asc }
    limit: $limit
  ) {
    seller
    amount
    apt_returned
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
            return reject(new Error(`Geomi ${res.statusCode}: ${raw.slice(0, 200)}`));
          }
          try {
            const json = JSON.parse(raw);
            if (json.errors) return reject(new Error(`Geomi errors: ${JSON.stringify(json.errors)}`));
            resolve(json.data || {});
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function fetchDecimals(addr) {
  const apiKey = process.env.APTOS_API_KEY || process.env.REACT_APP_APTOS_API_KEY || '';
  const res = await fetch(
    `${FULLNODE}/accounts/${addr}/resource/${encodeURIComponent('0x1::fungible_asset::Metadata')}`,
    { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} }
  );
  if (!res.ok) return 0;
  const json = await res.json();
  return parseInt(json?.data?.decimals ?? '0', 10);
}

// Geomi serialises the contract's `timestamp::now_microseconds()` as a
// stringified u64 microseconds. Convert to ms.
function microsToMs(micros) {
  if (micros == null) return Date.now();
  const n = typeof micros === 'string' ? parseInt(micros, 10) : Number(micros);
  if (!Number.isFinite(n) || n <= 0) return Date.now();
  return Math.floor(n / 1000);
}

async function buildTrades(addr) {
  const [decimals, purchaseData, saleData] = await Promise.all([
    fetchDecimals(addr),
    postGeomi(PURCHASE_QUERY, { addr, limit: 1000 }),
    postGeomi(SALE_QUERY, { addr, limit: 1000 }),
  ]);
  const purchases = purchaseData?.token_purchase_events || [];
  const sales = saleData?.token_sale_events || [];
  const decimalsFactor = Math.pow(10, decimals);

  // Buy event: `amount` is `tokens_bought * decimals_factor` (atomic units).
  // `tokens_sold` is the PRE-trade state in whole tokens.
  const buyTrades = purchases.map(ev => {
    const amountAtomic = parseInt(ev.amount || '0', 10);
    const amountWhole = decimalsFactor > 1
      ? Math.round(amountAtomic / decimalsFactor)
      : amountAtomic;
    const aptCostOctas = parseInt(ev.liquidity_contribution || '0', 10);
    const tokensSoldBefore = parseInt(ev.tokens_sold || '0', 10);
    return {
      type: 'buy',
      wallet: ev.buyer || '',
      amount: amountWhole,
      aptValue: aptCostOctas / 1e8,
      timestampMs: microsToMs(ev.timestamp),
      txVersion: parseInt(ev.transaction_version || '0', 10),
      tokensSoldBefore,
      tokensSoldAfter: tokensSoldBefore + amountWhole,
    };
  });

  // Sell event: `amount` is in WHOLE tokens (the entry function's `amount`
  // parameter is whole; the event re-emits it unchanged — see
  // token_launcher.move L626 sell_tokens(..., amount: u64, ...) and L757
  // event::emit(TokenSaleEvent { ..., amount: amount }).
  const sellTrades = sales.map(ev => {
    const amountWhole = parseInt(ev.amount || '0', 10);
    const aptReturnedOctas = parseInt(ev.apt_returned || '0', 10);
    const tokensSoldBefore = parseInt(ev.tokens_sold || '0', 10);
    return {
      type: 'sell',
      wallet: ev.seller || '',
      amount: amountWhole,
      aptValue: aptReturnedOctas / 1e8,
      timestampMs: microsToMs(ev.timestamp),
      txVersion: parseInt(ev.transaction_version || '0', 10),
      tokensSoldBefore,
      tokensSoldAfter: Math.max(0, tokensSoldBefore - amountWhole),
    };
  });

  // Merge by transaction_version. Within a single tx the contract only emits
  // one buy or one sell (single entry function), so this is canonical order.
  const trades = [...buyTrades, ...sellTrades].sort((a, b) => a.txVersion - b.txVersion);

  const finalTokensSold = trades.length > 0
    ? trades[trades.length - 1].tokensSoldAfter
    : 0;

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
    console.error('[/api/trades] error', err.message);
    return res.status(500).json({ error: err.message });
  }
};
