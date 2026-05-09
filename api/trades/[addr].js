// Trade history for a token, sourced from the standard Aptos indexer's
// fungible_asset_activities table. Returns NORMALIZED trades — every consumer
// (transactions tab, OHLC chart, top holders) sees the same shape.
//
// Deposits = buys (mint_to user), Withdraws = sells (burn_from user).
// Filters out the resource account so graduation mints don't pollute the feed.

const RESOURCE_ADDRESS = '0x2867f67700ccd1b3575ecf551137729c06af169a266fc2340d64f667ed9ac9d5';
const FULLNODE = 'https://fullnode.testnet.aptoslabs.com/v1';
const INDEXER = 'https://api.testnet.aptoslabs.com/v1/graphql';

const BC = {
  PRICE_NUMERATOR: 19_029_514_756,
  PRICE_CONSTANT: 61.9053276,
  MAX_TOKENS: 800_000_000,
};

const CACHE_TTL_MS = 5_000;
const cache = new Map(); // addr -> { value, expiresAt }
const inFlight = new Map();

function normaliseAddr(a) {
  if (!a) return '';
  const lower = String(a).toLowerCase();
  return lower.startsWith('0x') ? lower : `0x${lower}`;
}

function priceAtAPT(tokensSold) {
  const denom = BC.MAX_TOKENS - tokensSold;
  if (denom <= 0) return 0;
  return (BC.PRICE_NUMERATOR / denom + BC.PRICE_CONSTANT) / 1e8;
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

async function fetchActivities(addr, limit) {
  const apiKey = process.env.APTOS_API_KEY || process.env.REACT_APP_APTOS_API_KEY || '';
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const res = await fetch(INDEXER, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: ACTIVITIES_QUERY,
      variables: { asset_type: addr, limit },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Indexer ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  if (json.errors) throw new Error(`Indexer errors: ${JSON.stringify(json.errors)}`);
  return json.data?.fungible_asset_activities || [];
}

async function buildTrades(addr) {
  const [decimals, activities] = await Promise.all([
    fetchDecimals(addr),
    fetchActivities(addr, 1000),
  ]);
  const decimalsFactor = Math.pow(10, decimals);

  // Walk activities in tx-version order, accumulating tokens_sold so each trade
  // gets a deterministic pre/post state for bonding-curve math.
  let tokensSold = 0;
  const trades = [];
  for (const act of activities) {
    const owner = (act.owner_address || '').toLowerCase();
    if (owner === RESOURCE_ADDRESS.toLowerCase()) continue;
    const amountAtomic = parseInt(act.amount || '0', 10);
    if (amountAtomic <= 0) continue;
    const amountWhole = Math.round(amountAtomic / decimalsFactor);
    const type = (act.type || '').toLowerCase();
    const tsMs = new Date(act.transaction_timestamp + 'Z').getTime() || Date.now();
    const txVersion = parseInt(act.transaction_version || '0', 10);
    if (type.includes('deposit')) {
      const before = tokensSold;
      const after = tokensSold + amountWhole;
      const aptValue = ((priceAtAPT(before) + priceAtAPT(after)) / 2) * amountWhole;
      trades.push({
        type: 'buy',
        wallet: act.owner_address,
        amount: amountWhole,
        aptValue,
        timestampMs: tsMs,
        txVersion,
        tokensSoldBefore: before,
        tokensSoldAfter: after,
      });
      tokensSold = after;
    } else if (type.includes('withdraw')) {
      const before = tokensSold;
      const after = Math.max(0, tokensSold - amountWhole);
      const aptValue = ((priceAtAPT(after) + priceAtAPT(before)) / 2) * amountWhole;
      trades.push({
        type: 'sell',
        wallet: act.owner_address,
        amount: amountWhole,
        aptValue,
        timestampMs: tsMs,
        txVersion,
        tokensSoldBefore: before,
        tokensSoldAfter: after,
      });
      tokensSold = after;
    }
  }
  return { trades, decimals, finalTokensSold: tokensSold };
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
