// Cached vault resource read for a single token. The serverless instance keeps
// a 2-second in-memory cache, so 100 users polling the same token = ~1 fullnode
// call every 2s in each region. Add a CDN cache header on top for further dedup.

const MODULE_ADDRESS = '0x8c699e8fa969a555f46629c345d6c10d9512a3398a4353e7af4c2bcf95b9c96d';
const FULLNODE = 'https://fullnode.testnet.aptoslabs.com/v1';
const VAULT_TYPE = `${MODULE_ADDRESS}::token_launcher::TokenVault`;
const FA_METADATA_TYPE = '0x1::fungible_asset::Metadata';

const CACHE_TTL_MS = 2_000;
const cache = new Map(); // addr -> { value, expiresAt }
const inFlight = new Map(); // addr -> Promise (request coalescing)

function normaliseAddr(a) {
  if (!a) return '';
  const lower = String(a).toLowerCase();
  return lower.startsWith('0x') ? lower : `0x${lower}`;
}

async function fetchJson(url) {
  const apiKey = process.env.APTOS_API_KEY || process.env.REACT_APP_APTOS_API_KEY || '';
  const res = await fetch(url, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Fullnode ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function readVault(addr) {
  const [vault, fa] = await Promise.all([
    fetchJson(`${FULLNODE}/accounts/${addr}/resource/${encodeURIComponent(VAULT_TYPE)}`),
    fetchJson(`${FULLNODE}/accounts/${addr}/resource/${encodeURIComponent(FA_METADATA_TYPE)}`).catch(() => null),
  ]);

  const v = vault?.data ?? {};
  const totalSupplyAtomic = parseInt(v.total_supply || '0', 10);
  const remainingSupplyAtomic = parseInt(v.remaining_supply || '0', 10);
  const decimalsFactor = parseInt(v.decimals_factor || '1', 10);
  const decimals = Math.round(Math.log10(Math.max(1, decimalsFactor)));

  // Bonding curve uses 800M whole-token capacity. tokens_sold = 800M - remaining (whole).
  const remainingWhole = Math.floor(remainingSupplyAtomic / decimalsFactor);
  const tokensSold = Math.max(0, 800_000_000 - remainingWhole);
  const totalSupplyWhole = Math.floor(totalSupplyAtomic / decimalsFactor);

  // price_per_token is octas per whole token (running average updated on each trade)
  const pricePerTokenOctas = parseInt(v.price_per_token || '0', 10);
  const totalAptSpentOctas = parseInt(v.total_apt_spent || '0', 10);

  // Live spot price from the bonding curve at current tokens_sold (in APT per whole token)
  const denom = 800_000_000 - tokensSold;
  const spotPriceAPT = denom > 0
    ? (19_029_514_756 / denom + 61.9053276) / 100_000_000
    : 0;

  return {
    address: addr,
    decimals,
    decimalsFactor,
    totalSupply: totalSupplyWhole,
    remainingSupply: remainingWhole,
    tokensSold,
    spotPriceAPT,
    avgPriceOctas: pricePerTokenOctas,
    aptRaisedOctas: totalAptSpentOctas,
    aptRaised: totalAptSpentOctas / 1e8,
    marketCapAPT: spotPriceAPT * totalSupplyWhole,
    isGraduated: !!v.is_graduated,
    symbol: fa?.data?.symbol ?? null,
    name: fa?.data?.name ?? null,
    iconUri: fa?.data?.icon_uri ?? null,
    fetchedAt: Date.now(),
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const addr = normaliseAddr(req.query.addr);
  if (!addr) return res.status(400).json({ error: 'addr required' });

  const now = Date.now();
  const cached = cache.get(addr);
  if (cached && cached.expiresAt > now) {
    res.setHeader('Cache-Control', 'public, s-maxage=2, stale-while-revalidate=10');
    return res.json(cached.value);
  }

  // Coalesce concurrent requests for the same addr into a single upstream call
  let promise = inFlight.get(addr);
  if (!promise) {
    promise = readVault(addr).finally(() => inFlight.delete(addr));
    inFlight.set(addr, promise);
  }

  try {
    const value = await promise;
    cache.set(addr, { value, expiresAt: now + CACHE_TTL_MS });
    res.setHeader('Cache-Control', 'public, s-maxage=2, stale-while-revalidate=10');
    return res.json(value);
  } catch (err) {
    const status = err.status === 404 ? 404 : 500;
    return res.status(status).json({ error: err.message });
  }
};
