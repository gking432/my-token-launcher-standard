// Trade history for a token — standard Aptos indexer + fullnode only.
//
// Strategy: query TokenPurchaseEvent / TokenSaleEvent by indexed_type (our
// contract's events only — tiny result set), filter by metadata_addr in code.
//
// Why not fungible_asset_activities? Its (asset_type, transaction_version)
// scan times out on the testnet indexer (no composite index, 10s limit).
//
// Why not JSONB _contains on events.data? Unreliable across Hasura configs.
//
// This query: events filtered by indexed_type — a single indexed column,
// returns only this launcher's events (small volume), fast, always works.
// Filter by addr in JS. Exact APT values come from the contract fields
// (liquidity_contribution for buys, apt_returned for sells).

const MODULE_ADDRESS = '0x8c699e8fa969a555f46629c345d6c10d9512a3398a4353e7af4c2bcf95b9c96d';
const PURCHASE_EVENT_TYPE = `${MODULE_ADDRESS}::token_launcher::TokenPurchaseEvent`;
const SALE_EVENT_TYPE = `${MODULE_ADDRESS}::token_launcher::TokenSaleEvent`;
const FULLNODE = 'https://fullnode.testnet.aptoslabs.com/v1';
const INDEXER = 'https://api.testnet.aptoslabs.com/v1/graphql';

const CACHE_TTL_MS = 5_000;
const cache = new Map();
const inFlight = new Map();

function normaliseAddr(a) {
  if (!a) return '';
  return String(a).toLowerCase().replace(/^(?:0x)?/, '0x');
}

// Strip leading zeros after 0x so two representations of the same address
// always compare equal (e.g. "0x00...abc" === "0xabc" after stripping).
function canonAddr(a) {
  const hex = normaliseAddr(a).slice(2).replace(/^0+/, '') || '0';
  return '0x' + hex;
}

const EVENTS_QUERY = `query TradeEvents($pType: String!, $sType: String!, $limit: Int!) {
  purchases: events(
    where: { indexed_type: { _eq: $pType } }
    order_by: { transaction_version: asc }
    limit: $limit
  ) {
    transaction_version
    event_index
    data
  }
  sales: events(
    where: { indexed_type: { _eq: $sType } }
    order_by: { transaction_version: asc }
    limit: $limit
  ) {
    transaction_version
    event_index
    data
  }
}`;

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

async function fetchAllEvents() {
  const apiKey = process.env.APTOS_API_KEY || process.env.REACT_APP_APTOS_API_KEY
              || process.env.REACT_APP_GEOMI_API_KEY || '';
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const res = await fetch(INDEXER, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: EVENTS_QUERY,
      variables: { pType: PURCHASE_EVENT_TYPE, sType: SALE_EVENT_TYPE, limit: 1000 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Indexer ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  if (json.errors) throw new Error(`Indexer errors: ${JSON.stringify(json.errors)}`);
  return {
    purchases: json.data?.purchases || [],
    sales: json.data?.sales || [],
  };
}

function microsToMs(micros) {
  if (micros == null) return Date.now();
  const n = typeof micros === 'string' ? parseInt(micros, 10) : Number(micros);
  return Number.isFinite(n) && n > 0 ? Math.floor(n / 1000) : Date.now();
}

async function buildTrades(addr) {
  const canon = canonAddr(addr);

  const [decimals, { purchases, sales }] = await Promise.all([
    fetchDecimals(addr),
    fetchAllEvents(),
  ]);
  const decimalsFactor = Math.pow(10, decimals);

  // Filter to this token by comparing canonical addresses.
  const byAddr = evs => evs.filter(ev => {
    const ma = ev.data?.metadata_addr;
    return ma && canonAddr(ma) === canon;
  });

  // Buy event: `amount` = tokens_bought * decimals_factor (atomic units).
  // `tokens_sold` = PRE-trade whole tokens. `liquidity_contribution` = exact APT cost.
  const buyTrades = byAddr(purchases).map(ev => {
    const d = ev.data;
    const amountAtomic = parseInt(d.amount || '0', 10);
    const amountWhole = decimalsFactor > 1 ? Math.round(amountAtomic / decimalsFactor) : amountAtomic;
    const tokensSoldBefore = parseInt(d.tokens_sold || '0', 10);
    return {
      type: 'buy',
      wallet: d.buyer || '',
      amount: amountWhole,
      aptValue: parseInt(d.liquidity_contribution || '0', 10) / 1e8,
      timestampMs: microsToMs(d.timestamp),
      txVersion: parseInt(ev.transaction_version || '0', 10),
      tokensSoldBefore,
      tokensSoldAfter: tokensSoldBefore + amountWhole,
    };
  });

  // Sell event: `amount` = whole tokens (entry fn takes whole, re-emits unchanged).
  // `tokens_sold` = PRE-trade whole tokens. `apt_returned` = exact APT returned to seller.
  const sellTrades = byAddr(sales).map(ev => {
    const d = ev.data;
    const amountWhole = parseInt(d.amount || '0', 10);
    const tokensSoldBefore = parseInt(d.tokens_sold || '0', 10);
    return {
      type: 'sell',
      wallet: d.seller || '',
      amount: amountWhole,
      aptValue: parseInt(d.apt_returned || '0', 10) / 1e8,
      timestampMs: microsToMs(d.timestamp),
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
