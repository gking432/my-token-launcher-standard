// Trade history — Geomi No-Code Indexer (Aptos Labs' managed indexer for
// custom contract events). One query → all buy/sell events for a token with
// exact contract APT values.
//
// Why Geomi and not the standard Aptos indexer:
// The standard indexer (api.testnet.aptoslabs.com) indexes generic Aptos
// primitives (coin transfers, fungible asset balances, NFTs). It does NOT
// have purpose-built tables for custom contract events. The generic `events`
// table was deprecated in September 2024. `fungible_asset_activities` doesn't
// expose APT values per trade and times out on testnet for `asset_type` lookups.
//
// Geomi is Aptos Labs' managed processor product — you define tables once
// (token_purchase_events, token_sale_events) and they index them for you.
// This is the ecosystem-standard path for custom contract event indexing
// when you don't want to self-host an Aptos Indexer SDK processor.
//
// Together with /api/token (fullnode vault reads) this is the final two-source
// architecture: fullnode for current state, Geomi for historical events. Both
// are Aptos Labs products; both read directly from the chain.

const https = require('https');

const GEOMI_HOST = 'api.testnet.aptoslabs.com';
const GEOMI_PATH = '/nocode/v1/api/cmhtiqv8w005ps601yfd1g4ur/v1/graphql';
const FULLNODE   = 'https://fullnode.testnet.aptoslabs.com/v1';

const CACHE_TTL_MS = 5_000;
const cache    = new Map();
const inFlight = new Map();

function normaliseAddr(a) {
  if (!a) return '';
  return String(a).toLowerCase().replace(/^(?:0x)?/, '0x');
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
            if (json.errors) return reject(new Error(`Geomi: ${JSON.stringify(json.errors)}`));
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

async function fetchDecimals(addr) {
  const apiKey = process.env.APTOS_API_KEY || process.env.REACT_APP_APTOS_API_KEY
              || process.env.REACT_APP_GEOMI_API_KEY || '';
  const res = await fetch(
    `${FULLNODE}/accounts/${addr}/resource/${encodeURIComponent('0x1::fungible_asset::Metadata')}`,
    { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} }
  );
  if (!res.ok) return 0;
  const json = await res.json();
  return parseInt(json?.data?.decimals ?? '0', 10);
}

// Contract emits timestamp::now_microseconds() (u64 microseconds) as a string.
function microsToMs(micros) {
  if (micros == null) return Date.now();
  const n = typeof micros === 'string' ? parseInt(micros, 10) : Number(micros);
  return Number.isFinite(n) && n > 0 ? Math.floor(n / 1000) : Date.now();
}

async function buildTrades(addr) {
  const [decimals, purchaseData, saleData] = await Promise.all([
    fetchDecimals(addr),
    postGeomi(PURCHASE_QUERY, { addr, limit: 1000 }),
    postGeomi(SALE_QUERY, { addr, limit: 1000 }),
  ]);

  const purchases = purchaseData?.token_purchase_events || [];
  const sales     = saleData?.token_sale_events || [];
  const decimalsFactor = Math.pow(10, decimals);

  // Buy event: contract emits `amount = tokens_bought * decimals_factor`
  // (atomic units). `tokens_sold` is the PRE-trade state in whole tokens.
  // `liquidity_contribution` is the EXACT APT cost in octas (no fees included).
  const buyTrades = purchases.map(ev => {
    const amountAtomic     = parseInt(ev.amount || '0', 10);
    const amountWhole      = decimalsFactor > 1 ? Math.round(amountAtomic / decimalsFactor) : amountAtomic;
    const tokensSoldBefore = parseInt(ev.tokens_sold || '0', 10);
    return {
      type: 'buy',
      wallet: ev.buyer || '',
      amount: amountWhole,
      aptValue: parseInt(ev.liquidity_contribution || '0', 10) / 1e8,
      timestampMs: microsToMs(ev.timestamp),
      txVersion: parseInt(ev.transaction_version || '0', 10),
      tokensSoldBefore,
      tokensSoldAfter: tokensSoldBefore + amountWhole,
    };
  });

  // Sell event: contract takes `amount` in whole tokens and re-emits unchanged
  // (token_launcher.move L626 sell_tokens(amount: u64), L757 emits `amount: amount`).
  // `apt_returned` is the EXACT APT proceeds in octas (after fees).
  const sellTrades = sales.map(ev => {
    const amountWhole      = parseInt(ev.amount || '0', 10);
    const tokensSoldBefore = parseInt(ev.tokens_sold || '0', 10);
    return {
      type: 'sell',
      wallet: ev.seller || '',
      amount: amountWhole,
      aptValue: parseInt(ev.apt_returned || '0', 10) / 1e8,
      timestampMs: microsToMs(ev.timestamp),
      txVersion: parseInt(ev.transaction_version || '0', 10),
      tokensSoldBefore,
      tokensSoldAfter: Math.max(0, tokensSoldBefore - amountWhole),
    };
  });

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
