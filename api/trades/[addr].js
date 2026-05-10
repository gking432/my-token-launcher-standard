// Trade history for a token, sourced from the standard Aptos indexer's `events`
// table — specifically TokenPurchaseEvent / TokenSaleEvent emitted by the
// launcher contract. Returns NORMALIZED trades with EXACT APT values from the
// contract (liquidity_contribution for buys, apt_returned for sells).
//
// Why not fungible_asset_activities? It accumulates `tokens_sold` from zero,
// which gives wrong bonding-curve prices when the indexer history is partial,
// and it can't tell us the real APT amount per trade — only the token amount.
// Contract events carry both the exact APT and pre-trade tokens_sold state.

const MODULE_ADDRESS = '0x8c699e8fa969a555f46629c345d6c10d9512a3398a4353e7af4c2bcf95b9c96d';
const PURCHASE_EVENT_TYPE = `${MODULE_ADDRESS}::token_launcher::TokenPurchaseEvent`;
const SALE_EVENT_TYPE = `${MODULE_ADDRESS}::token_launcher::TokenSaleEvent`;
const FULLNODE = 'https://fullnode.testnet.aptoslabs.com/v1';
const INDEXER = 'https://api.testnet.aptoslabs.com/v1/graphql';

const CACHE_TTL_MS = 5_000;
const cache = new Map(); // addr -> { value, expiresAt }
const inFlight = new Map();

function normaliseAddr(a) {
  if (!a) return '';
  const lower = String(a).toLowerCase();
  return lower.startsWith('0x') ? lower : `0x${lower}`;
}

const EVENTS_QUERY = `query TradeEvents($pType: String!, $sType: String!, $addr: String!, $limit: Int!) {
  purchases: events(
    where: {
      indexed_type: { _eq: $pType }
      data: { _contains: { metadata_addr: $addr } }
    }
    order_by: { transaction_version: asc }
    limit: $limit
  ) {
    transaction_version
    event_index
    data
  }
  sales: events(
    where: {
      indexed_type: { _eq: $sType }
      data: { _contains: { metadata_addr: $addr } }
    }
    order_by: { transaction_version: asc }
    limit: $limit
  ) {
    transaction_version
    event_index
    data
  }
}`;

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

async function fetchEvents(addr) {
  const apiKey = process.env.APTOS_API_KEY || process.env.REACT_APP_APTOS_API_KEY || '';
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const res = await fetch(INDEXER, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: EVENTS_QUERY,
      variables: {
        pType: PURCHASE_EVENT_TYPE,
        sType: SALE_EVENT_TYPE,
        addr,
        limit: 1000,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Indexer ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  if (json.errors) throw new Error(`Indexer errors: ${JSON.stringify(json.errors)}`);
  return {
    purchases: json.data?.purchases || [],
    sales: json.data?.sales || [],
  };
}

// Aptos serializes timestamps as microseconds (u64). Convert to ms.
function microsToMs(micros) {
  const n = typeof micros === 'string' ? parseInt(micros, 10) : Number(micros);
  return Math.floor(n / 1000);
}

async function buildTrades(addr) {
  const [decimals, { purchases, sales }] = await Promise.all([
    fetchDecimals(addr),
    fetchEvents(addr),
  ]);
  const decimalsFactor = Math.pow(10, decimals);

  // Buy events: amount is in atomic units (tokens_bought * decimals_factor).
  // tokens_sold is the PRE-trade state in whole tokens.
  const buyTrades = purchases.map(ev => {
    const d = ev.data || {};
    const amountAtomic = parseInt(d.amount || '0', 10);
    const amountWhole = decimalsFactor > 1
      ? Math.round(amountAtomic / decimalsFactor)
      : amountAtomic;
    const aptCostOctas = parseInt(d.liquidity_contribution || '0', 10);
    const tokensSoldBefore = parseInt(d.tokens_sold || '0', 10);
    return {
      type: 'buy',
      wallet: d.buyer || '',
      amount: amountWhole,
      aptValue: aptCostOctas / 1e8,
      timestampMs: microsToMs(d.timestamp),
      txVersion: parseInt(ev.transaction_version || '0', 10),
      eventIndex: parseInt(ev.event_index || '0', 10),
      tokensSoldBefore,
      tokensSoldAfter: tokensSoldBefore + amountWhole,
    };
  });

  // Sell events: amount is in WHOLE tokens (contract inconsistency — buy emits
  // atomic, sell emits whole; see token_launcher.move L579 vs L757).
  // tokens_sold is the PRE-trade state in whole tokens.
  const sellTrades = sales.map(ev => {
    const d = ev.data || {};
    const amountWhole = parseInt(d.amount || '0', 10);
    const aptReturnedOctas = parseInt(d.apt_returned || '0', 10);
    const tokensSoldBefore = parseInt(d.tokens_sold || '0', 10);
    return {
      type: 'sell',
      wallet: d.seller || '',
      amount: amountWhole,
      aptValue: aptReturnedOctas / 1e8,
      timestampMs: microsToMs(d.timestamp),
      txVersion: parseInt(ev.transaction_version || '0', 10),
      eventIndex: parseInt(ev.event_index || '0', 10),
      tokensSoldBefore,
      tokensSoldAfter: Math.max(0, tokensSoldBefore - amountWhole),
    };
  });

  // Merge by transaction_version, then event_index. Canonical chain-order —
  // matches what every chain-aware tool sees.
  const trades = [...buyTrades, ...sellTrades].sort((a, b) => {
    if (a.txVersion !== b.txVersion) return a.txVersion - b.txVersion;
    return a.eventIndex - b.eventIndex;
  });

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
    return res.status(500).json({ error: err.message });
  }
};
