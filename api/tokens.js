// Batched live state for many tokens at once. Used by the homepage list.
// Server-side cache (5s) means the cost is constant in user count.

const MODULE_ADDRESS = '0x8c699e8fa969a555f46629c345d6c10d9512a3398a4353e7af4c2bcf95b9c96d';
const FULLNODE = 'https://fullnode.testnet.aptoslabs.com/v1';
const VAULT_TYPE = `${MODULE_ADDRESS}::token_launcher::TokenVault`;

const CACHE_TTL_MS = 5_000;
const CONCURRENCY = 8;
const cache = new Map(); // addr -> { value, expiresAt }
const inFlight = new Map();

function normaliseAddr(a) {
  if (!a) return '';
  const lower = String(a).toLowerCase();
  return lower.startsWith('0x') ? lower : `0x${lower}`;
}

async function fetchVault(addr) {
  const apiKey = process.env.APTOS_API_KEY || process.env.REACT_APP_APTOS_API_KEY || '';
  const res = await fetch(
    `${FULLNODE}/accounts/${addr}/resource/${encodeURIComponent(VAULT_TYPE)}`,
    { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} }
  );
  if (!res.ok) return null;
  const json = await res.json();
  const v = json?.data ?? {};
  const decimalsFactor = parseInt(v.decimals_factor || '1', 10);
  const remainingWhole = Math.floor(parseInt(v.remaining_supply || '0', 10) / decimalsFactor);
  const totalSupplyWhole = Math.floor(parseInt(v.total_supply || '0', 10) / decimalsFactor);
  const tokensSold = Math.max(0, 800_000_000 - remainingWhole);
  const denom = 800_000_000 - tokensSold;
  const spotPriceAPT = denom > 0
    ? (19_029_514_756 / denom + 61.9053276) / 100_000_000
    : 0;
  const aptRaisedOctas = parseInt(v.total_apt_spent || '0', 10);
  return {
    address: addr,
    decimalsFactor,
    totalSupply: totalSupplyWhole,
    tokensSold,
    spotPriceAPT,
    aptRaisedOctas,
    aptRaised: aptRaisedOctas / 1e8,
    marketCapAPT: spotPriceAPT * totalSupplyWhole,
    isGraduated: !!v.is_graduated,
  };
}

async function getCachedVault(addr) {
  const now = Date.now();
  const c = cache.get(addr);
  if (c && c.expiresAt > now) return c.value;
  let p = inFlight.get(addr);
  if (!p) {
    p = fetchVault(addr).finally(() => inFlight.delete(addr));
    inFlight.set(addr, p);
  }
  const value = await p;
  if (value) cache.set(addr, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

// Run promises with bounded concurrency so a long token list doesn't fan out
// hundreds of parallel fullnode requests.
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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const raw = (req.query.addrs || '').toString();
  const addrs = raw.split(',').map(normaliseAddr).filter(Boolean);
  if (addrs.length === 0) return res.json({ tokens: [] });
  if (addrs.length > 200) return res.status(400).json({ error: 'too many addrs (max 200)' });

  try {
    const tokens = (await mapLimit(addrs, CONCURRENCY, getCachedVault)).filter(Boolean);
    res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=15');
    return res.json({ tokens });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
