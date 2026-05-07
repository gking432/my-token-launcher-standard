const https = require('https');

const MODULE  = '0x8c699e8fa969a555f46629c345d6c10d9512a3398a4353e7af4c2bcf95b9c96d';
const QUERY   = `query GetModuleEvents($type: String!, $limit: Int!) {
  events(
    where: { indexed_type: { _eq: $type } }
    order_by: { transaction_version: desc }
    limit: $limit
  ) { data transaction_version event_index }
}`;

function post(body, apiKey) {
  const payload = JSON.stringify(body);
  const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: 'api.testnet.aptoslabs.com', path: '/v1/graphql', method: 'POST', headers },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => resolve({ status: res.statusCode, body: raw }));
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, addr, limit = '1000' } = req.query;
  if (type !== 'purchase' && type !== 'sale') {
    return res.status(400).json({ error: 'type must be purchase or sale' });
  }

  const eventType = `${MODULE}::token_launcher::Token${type === 'purchase' ? 'Purchase' : 'Sale'}Event`;
  const limitNum  = Math.min(parseInt(limit, 10) || 1000, 1000);
  const apiKey    = process.env.APTOS_API_KEY || process.env.REACT_APP_GEOMI_API_KEY || '';

  try {
    const { status, body } = await post({ query: QUERY, variables: { type: eventType, limit: limitNum } }, apiKey);

    if (status >= 400) {
      console.error('[/api/events] upstream error', status, body.slice(0, 300));
      return res.status(status).json({ error: `Upstream ${status}: ${body.slice(0, 200)}` });
    }

    const result = JSON.parse(body);
    if (result.errors) {
      console.error('[/api/events] GraphQL errors', result.errors);
      return res.status(500).json({ error: result.errors });
    }

    let events = (result.data?.events || []).map((e) => ({
      ...e.data,
      event_index: e.event_index,
      transaction_version: e.transaction_version,
    }));

    if (addr) {
      const addrLower = addr.toLowerCase();
      events = events.filter((e) => (e.metadata_addr || '').toLowerCase() === addrLower);
    }

    console.log(`[/api/events] type=${type} addr=${addr || 'all'} => ${events.length} events`);
    return res.json({ events });
  } catch (err) {
    console.error('[/api/events] exception', err.message);
    return res.status(500).json({ error: err.message });
  }
};
