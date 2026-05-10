// Diagnostic script — tests the trades API logic directly against the live indexer.
// Run: REACT_APP_GEOMI_API_KEY=aptoslabs_... node test-trades-api.js 0xTOKEN_ADDR

const MODULE_ADDRESS = '0x8c699e8fa969a555f46629c345d6c10d9512a3398a4353e7af4c2bcf95b9c96d';
const PURCHASE_EVENT_TYPE = `${MODULE_ADDRESS}::token_launcher::TokenPurchaseEvent`;
const SALE_EVENT_TYPE = `${MODULE_ADDRESS}::token_launcher::TokenSaleEvent`;
const INDEXER = 'https://api.testnet.aptoslabs.com/v1/graphql';
const FULLNODE = 'https://fullnode.testnet.aptoslabs.com/v1';

const addr = process.argv[2];
if (!addr) { console.error('Usage: node test-trades-api.js 0xTOKEN_ADDR'); process.exit(1); }

const apiKey = process.env.REACT_APP_GEOMI_API_KEY || process.env.APTOS_API_KEY || '';
console.log('Token address:', addr);
console.log('API key:', apiKey ? apiKey.slice(0, 20) + '...' : '(none)');

function canonAddr(a) {
  const hex = String(a).toLowerCase().replace(/^0x/, '').replace(/^0+/, '') || '0';
  return '0x' + hex;
}

async function post(query, variables) {
  const h = { 'Content-Type': 'application/json' };
  if (apiKey) h['Authorization'] = `Bearer ${apiKey}`;
  const r = await fetch(INDEXER, { method: 'POST', headers: h, body: JSON.stringify({ query, variables }) });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 300)}`);
  const j = JSON.parse(t);
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

async function main() {
  console.log('\n=== 1. Decimals (fullnode) ===');
  const h = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  const mr = await fetch(`${FULLNODE}/accounts/${addr}/resource/0x1::fungible_asset::Metadata`, { headers: h });
  console.log('Status:', mr.status);
  if (mr.ok) {
    const m = await mr.json();
    console.log('Symbol:', m?.data?.symbol, '  Decimals:', m?.data?.decimals);
  }

  console.log('\n=== 2. All TokenPurchaseEvent / TokenSaleEvent (no per-token filter) ===');
  const data = await post(`query($pType: String!, $sType: String!, $limit: Int!) {
    purchases: events(where: { indexed_type: { _eq: $pType } } order_by: { transaction_version: asc } limit: $limit) {
      transaction_version event_index data
    }
    sales: events(where: { indexed_type: { _eq: $sType } } order_by: { transaction_version: asc } limit: $limit) {
      transaction_version event_index data
    }
  }`, { pType: PURCHASE_EVENT_TYPE, sType: SALE_EVENT_TYPE, limit: 100 });

  const purchases = data?.purchases || [];
  const sales = data?.sales || [];
  console.log('Total purchase events across all tokens:', purchases.length);
  console.log('Total sale events across all tokens:', sales.length);

  const canon = canonAddr(addr);
  const myBuys = purchases.filter(ev => ev.data?.metadata_addr && canonAddr(ev.data.metadata_addr) === canon);
  const mySells = sales.filter(ev => ev.data?.metadata_addr && canonAddr(ev.data.metadata_addr) === canon);

  console.log(`\nFor this token (${canon}):`);
  console.log('  Buys:', myBuys.length, '  Sells:', mySells.length);

  if (myBuys[0]) {
    const d = myBuys[0].data;
    console.log('\nFirst buy event:');
    console.log('  buyer:', d.buyer);
    console.log('  amount (atomic):', d.amount);
    console.log('  liquidity_contribution:', d.liquidity_contribution, '=', parseInt(d.liquidity_contribution) / 1e8, 'APT');
    console.log('  tokens_sold (pre-trade, whole):', d.tokens_sold);
  }
  if (mySells[0]) {
    const d = mySells[0].data;
    console.log('\nFirst sell event:');
    console.log('  seller:', d.seller);
    console.log('  amount (whole tokens):', d.amount);
    console.log('  apt_returned:', d.apt_returned, '=', parseInt(d.apt_returned) / 1e8, 'APT');
    console.log('  tokens_sold (pre-trade, whole):', d.tokens_sold);
  }

  if (!myBuys.length && !mySells.length && (purchases.length || sales.length)) {
    console.log('\nEvents exist for OTHER tokens but not this address. Address mismatch?');
    console.log('metadata_addr values seen:');
    [...purchases, ...sales].slice(0, 5).forEach(ev =>
      console.log(' raw:', ev.data?.metadata_addr, '-> canon:', canonAddr(ev.data?.metadata_addr || ''))
    );
    console.log('Our canon addr:', canon);
  }

  if (!purchases.length && !sales.length) {
    console.log('\nNO events found for this contract at all. Check:');
    console.log('  - MODULE_ADDRESS correct?', MODULE_ADDRESS);
    console.log('  - Testnet indexer may be lagging');
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
