// Trade history for a token — standard Aptos indexer + fullnode only.
//
// Strategy: two standard-indexer queries, zero JSONB filters.
//
// 1. `fungible_asset_activities` filtered by `asset_type` (proven to work,
//    standard indexed column) identifies which transactions are buys/sells.
// 2. `events` filtered by `transaction_version: { _in: [...] }` (integer
//    equality, always reliable) fetches the matching TokenPurchaseEvent /
//    TokenSaleEvent records for those exact transactions. These carry the
//    contract's exact APT values (liquidity_contribution / apt_returned) and
//    pre-trade tokens_sold — no bonding-curve estimation needed.
//
// No Geomi. No JSONB containment on events.data. One source of truth.

const RESOURCE_ADDRESS = '0x2867f67700ccd1b3575ecf551137729c06af169a266fc2340d64f667ed9ac9d5';
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
  const lower = String(a).toLowerCase();
  return lower.startsWith('0x') ? lower : `0x${lower}`;
}

const ACTIVITIES_QUERY = `query Activities($asset_type: String!, $limit: Int!) {
  fungible_asset_activities(
    where: { asset_type: { _eq: $asset_type } }
    order_by: { transaction_version: asc }
    limit: $limit
  ) {
    owner_address
    amount
    type
    transaction_version
    transaction_timestamp
  }
}`;

// Plain integer _in filter — no JSONB, no scalars, always works.
const EVENTS_BY_VERSION_QUERY = `query EventsByVersion($versions: [bigint!]!, $pType: String!, $sType: String!) {
  events(
    where: {
      transaction_version: { _in: $versions }
      indexed_type: { _in: [$pType, $sType] }
    }
    order_by: { transaction_version: asc }
    limit: 2000
  ) {
    transaction_version
    indexed_type
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

async function indexerPost(query, variables) {
  const apiKey = process.env.APTOS_API_KEY || process.env.REACT_APP_APTOS_API_KEY
              || process.env.REACT_APP_GEOMI_API_KEY || '';
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const res = await fetch(INDEXER, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Indexer ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  if (json.errors) throw new Error(`Indexer errors: ${JSON.stringify(json.errors)}`);
  return json.data || {};
}

async function buildTrades(addr) {
  const [decimals, activitiesData] = await Promise.all([
    fetchDecimals(addr),
    indexerPost(ACTIVITIES_QUERY, { asset_type: addr, limit: 1000 }),
  ]);

  const activities = activitiesData?.fungible_asset_activities || [];
  const decimalsFactor = Math.pow(10, decimals);

  // Filter to trade-relevant activities only.
  // Deposits = mints (buys). Withdraws = burns (sells).
  // Skip the resource account (graduation mints) and zero-amount rows.
  const tradeActivities = activities.filter(act => {
    const owner = (act.owner_address || '').toLowerCase();
    if (owner === RESOURCE_ADDRESS.toLowerCase()) return false;
    const amount = parseInt(act.amount || '0', 10);
    if (amount <= 0) return false;
    const t = (act.type || '').toLowerCase();
    return t.includes('deposit') || t.includes('withdraw');
  });

  if (tradeActivities.length === 0) {
    return { trades: [], decimals, finalTokensSold: 0 };
  }

  // Fetch contract events for these exact transaction versions.
  // This gives us liquidity_contribution / apt_returned / tokens_sold from
  // the contract itself — no bonding-curve estimation.
  const versions = [...new Set(tradeActivities.map(a => a.transaction_version))];
  const eventsData = await indexerPost(EVENTS_BY_VERSION_QUERY, {
    versions,
    pType: PURCHASE_EVENT_TYPE,
    sType: SALE_EVENT_TYPE,
  });
  const rawEvents = eventsData?.events || [];

  // Index events by transaction_version for O(1) lookup.
  const eventByVersion = new Map();
  for (const ev of rawEvents) {
    const v = String(ev.transaction_version);
    if (!eventByVersion.has(v)) eventByVersion.set(v, ev);
  }

  // Accumulate tokensSold for activities that have no matching contract event
  // (shouldn't happen for real trades, but defensive).
  let tokensSoldFallback = 0;

  const trades = tradeActivities.map(act => {
    const owner = act.owner_address || '';
    const amountAtomic = parseInt(act.amount || '0', 10);
    const amountWhole = decimalsFactor > 1
      ? Math.round(amountAtomic / decimalsFactor)
      : amountAtomic;
    const t = (act.type || '').toLowerCase();
    const isBuy = t.includes('deposit');
    const txVersion = parseInt(act.transaction_version || '0', 10);
    const tsMs = new Date(act.transaction_timestamp + 'Z').getTime() || Date.now();

    const ev = eventByVersion.get(String(act.transaction_version));
    const evData = ev?.data || {};

    if (ev) {
      // Use exact values from the contract event.
      const tokensSoldBefore = parseInt(evData.tokens_sold || '0', 10);
      if (isBuy) {
        // Buy event amount is atomic; sell event amount is whole tokens.
        // We already have amountWhole from the activity so use that for both.
        const aptCostOctas = parseInt(evData.liquidity_contribution || '0', 10);
        return {
          type: 'buy',
          wallet: owner,
          amount: amountWhole,
          aptValue: aptCostOctas / 1e8,
          timestampMs: tsMs,
          txVersion,
          tokensSoldBefore,
          tokensSoldAfter: tokensSoldBefore + amountWhole,
        };
      } else {
        const aptReturnedOctas = parseInt(evData.apt_returned || '0', 10);
        return {
          type: 'sell',
          wallet: owner,
          amount: amountWhole,
          aptValue: aptReturnedOctas / 1e8,
          timestampMs: tsMs,
          txVersion,
          tokensSoldBefore,
          tokensSoldAfter: Math.max(0, tokensSoldBefore - amountWhole),
        };
      }
    } else {
      // No matching contract event — fall back to bonding-curve estimate.
      // This branch should rarely fire; log so we know if it does.
      console.warn(`[trades] no contract event for txVersion=${txVersion}, using fallback`);
      const before = tokensSoldFallback;
      const after = isBuy
        ? tokensSoldFallback + amountWhole
        : Math.max(0, tokensSoldFallback - amountWhole);
      const BC_NUM = 19_029_514_756;
      const BC_CONST = 61.9053276;
      const BC_MAX = 800_000_000;
      const priceAt = ts => ts < BC_MAX ? (BC_NUM / (BC_MAX - ts) + BC_CONST) / 1e8 : 0;
      const aptValue = ((priceAt(before) + priceAt(after)) / 2) * amountWhole;
      tokensSoldFallback = after;
      return {
        type: isBuy ? 'buy' : 'sell',
        wallet: owner,
        amount: amountWhole,
        aptValue,
        timestampMs: tsMs,
        txVersion,
        tokensSoldBefore: before,
        tokensSoldAfter: after,
      };
    }
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
    console.error('[/api/trades] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
