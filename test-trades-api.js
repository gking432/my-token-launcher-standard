// Run with: REACT_APP_GEOMI_API_KEY=your_key node test-trades-api.js 0xYOUR_TOKEN_ADDR
// Tests the trades API logic directly against the live indexer.

const RESOURCE_ADDRESS = '0x2867f67700ccd1b3575ecf551137729c06af169a266fc2340d64f667ed9ac9d5';
const MODULE_ADDRESS = '0x8c699e8fa969a555f46629c345d6c10d9512a3398a4353e7af4c2bcf95b9c96d';
const PURCHASE_EVENT_TYPE = `${MODULE_ADDRESS}::token_launcher::TokenPurchaseEvent`;
const SALE_EVENT_TYPE = `${MODULE_ADDRESS}::token_launcher::TokenSaleEvent`;
const FULLNODE = 'https://fullnode.testnet.aptoslabs.com/v1';
const INDEXER = 'https://api.testnet.aptoslabs.com/v1/graphql';

const addr = process.argv[2];
if (!addr) { console.error('Usage: node test-trades-api.js 0xTOKEN_ADDR'); process.exit(1); }

const apiKey = process.env.REACT_APP_GEOMI_API_KEY || process.env.APTOS_API_KEY || '';
console.log('Address:', addr);
console.log('API key:', apiKey ? apiKey.slice(0,20) + '...' : '(none)');
console.log('Indexer:', INDEXER);
console.log('');

async function post(query, variables) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const r = await fetch(INDEXER, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data;
}

async function main() {
  // Step 1: decimals
  console.log('--- Step 1: fetching decimals ---');
  const metaRes = await fetch(`${FULLNODE}/accounts/${addr}/resource/0x1::fungible_asset::Metadata`,
    { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} });
  console.log('Metadata status:', metaRes.status);
  if (metaRes.ok) {
    const meta = await metaRes.json();
    console.log('Decimals:', meta?.data?.decimals);
    console.log('Symbol:', meta?.data?.symbol);
  } else {
    console.log('Response:', await metaRes.text().then(t => t.slice(0,200)));
  }
  console.log('');

  // Step 2: fungible_asset_activities
  console.log('--- Step 2: fungible_asset_activities ---');
  const ACTIVITIES_QUERY = `query($asset_type: String!, $limit: Int!) {
    fungible_asset_activities(
      where: { asset_type: { _eq: $asset_type } }
      order_by: { transaction_version: asc }
      limit: $limit
    ) { owner_address amount type transaction_version transaction_timestamp }
  }`;
  const actData = await post(ACTIVITIES_QUERY, { asset_type: addr, limit: 10 });
  const activities = actData?.fungible_asset_activities || [];
  console.log('Activities count (first 10):', activities.length);
  if (activities.length) {
    console.log('First activity:', JSON.stringify(activities[0], null, 2));
    console.log('Last activity:', JSON.stringify(activities[activities.length-1], null, 2));
  }
  console.log('');

  if (!activities.length) { console.log('No activities — check token address'); return; }

  // Step 3: events by tx version
  console.log('--- Step 3: events by transaction_version ---');
  const versions = activities.map(a => a.transaction_version);
  console.log('Looking up versions:', versions);
  const EVENTS_QUERY = `query($versions: [bigint!]!, $pType: String!, $sType: String!) {
    events(
      where: {
        transaction_version: { _in: $versions }
        indexed_type: { _in: [$pType, $sType] }
      }
      limit: 50
    ) { transaction_version indexed_type data }
  }`;
  const evData = await post(EVENTS_QUERY, { versions, pType: PURCHASE_EVENT_TYPE, sType: SALE_EVENT_TYPE });
  const events = evData?.events || [];
  console.log('Events found:', events.length);
  if (events.length) {
    console.log('First event:', JSON.stringify(events[0], null, 2));
  } else {
    console.log('No events matched — indexed_type filter may be wrong or events not indexed yet');
    
    // Try without the indexed_type filter to see what events exist for these versions
    console.log('\nTrying without indexed_type filter (any event for these versions):');
    const ANY_EVENTS_QUERY = `query($versions: [bigint!]!) {
      events(
        where: { transaction_version: { _in: $versions } }
        limit: 20
      ) { transaction_version indexed_type data }
    }`;
    const anyEvData = await post(ANY_EVENTS_QUERY, { versions });
    const anyEvents = anyEvData?.events || [];
    console.log('Any events for these versions:', anyEvents.length);
    anyEvents.forEach(e => console.log(' -', e.transaction_version, e.indexed_type));
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
