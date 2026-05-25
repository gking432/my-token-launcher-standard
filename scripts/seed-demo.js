#!/usr/bin/env node
'use strict';

/**
 * MoveMint demo seeder — creates 20 tokens with varied trade history on testnet.
 *
 * Prerequisites:
 *   Fund your wallet with ~30 APT from https://aptos.dev/network/faucet
 *   (the script will attempt auto-funding but the faucet may rate-limit)
 *
 * Usage:
 *   APTOS_PRIVATE_KEY=0x<deployer_key> node scripts/seed-demo.js
 *
 * What it does:
 *   - Generates a fresh creator wallet for each token
 *   - Funds each creator (0.3 APT) from your wallet to cover the 0.2 APT launch fee
 *   - Each creator calls create_token
 *   - Your wallet buys varied amounts on each token to simulate trading history
 *
 * APT breakdown (approximate):
 *   Launch fees  20 tokens × 0.2 APT  =  4 APT
 *   Creator gas  20 × 0.1 APT         =  2 APT
 *   Creator fund 20 × 0.3 APT         =  6 APT
 *   Buy volume                        = 15 APT
 *   Gas (buyer)                       =  3 APT
 *   Total                            ~= 30 APT
 */

const { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } = require('@aptos-labs/ts-sdk');
const https = require('https');

const MODULE = '0xec714c0618845f5033b9d6f1bd9d32b6a00ab611e38738a3073a118a37d61a5c';
const DECIMALS = 6;
const TOTAL_SUPPLY = 1_000_000_000;
const SLIPPAGE_BPS = 500;
const CREATOR_FUND_OCTAS = 30_000_000; // 0.3 APT per creator
const TX_DELAY_MS = 1200;

const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  fullnode: 'https://fullnode.testnet.aptoslabs.com/v1',
}));

// 20 tokens with varied names, tickers, and buy patterns.
// Buys are in octas (1 APT = 100_000_000 octas).
// Pattern: popular tokens have more/larger buys; obscure ones have 1 small buy.
const TOKENS = [
  { name: 'PepeAptos',      ticker: '$PEPE',   buys: [20_000_000, 30_000_000, 50_000_000] },
  { name: 'DogeChain',      ticker: '$DOGE',   buys: [10_000_000, 20_000_000] },
  { name: 'MoonshotAI',     ticker: '$MOON',   buys: [50_000_000, 80_000_000, 40_000_000, 30_000_000] },
  { name: 'ChadFinance',    ticker: '$CHAD',   buys: [15_000_000, 25_000_000] },
  { name: 'WAGMI Protocol', ticker: '$WAGMI',  buys: [5_000_000] },
  { name: 'ApeToken',       ticker: '$APE',    buys: [80_000_000, 60_000_000, 100_000_000] },
  { name: 'DegenDAO',       ticker: '$DEGEN',  buys: [12_000_000, 18_000_000] },
  { name: 'PumpCoin',       ticker: '$PUMP',   buys: [100_000_000, 80_000_000, 120_000_000, 50_000_000] },
  { name: 'BasedToken',     ticker: '$BASED',  buys: [20_000_000, 15_000_000] },
  { name: 'FrogFinance',    ticker: '$FROG',   buys: [35_000_000, 25_000_000] },
  { name: 'AlphaDAO',       ticker: '$ALPHA',  buys: [22_000_000, 18_000_000, 10_000_000] },
  { name: 'SatoshiVision',  ticker: '$SATO',   buys: [60_000_000, 40_000_000] },
  { name: 'MonadKiller',    ticker: '$MONAD',  buys: [30_000_000, 20_000_000, 15_000_000] },
  { name: 'ZeroKnowledge',  ticker: '$ZK',     buys: [8_000_000, 12_000_000] },
  { name: 'LaserEyes',      ticker: '$LASER',  buys: [28_000_000, 22_000_000] },
  { name: 'BullRun',        ticker: '$BULL',   buys: [45_000_000, 35_000_000, 20_000_000] },
  { name: 'RektCoin',       ticker: '$REKT',   buys: [2_000_000] },
  { name: 'HiddenGem',      ticker: '$GEM',    buys: [16_000_000, 14_000_000] },
  { name: 'MemeToken',      ticker: '$MEME',   buys: [7_000_000, 8_000_000] },
  { name: 'BearMarket',     ticker: '$BEAR',   buys: [4_000_000] },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function toBytes(str) { return Array.from(Buffer.from(str, 'utf8')); }

async function tryFaucet(address) {
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'faucet.testnet.aptoslabs.com',
      path: `/mint?amount=100000000&address=${address}`,
      method: 'POST',
    }, res => { res.resume(); resolve(res.statusCode < 300); });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function getBalance(address) {
  try {
    const resources = await aptos.getAccountResources({ accountAddress: address });
    const store = resources.find(r => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>');
    return Number(store?.data?.coin?.value ?? 0);
  } catch { return 0; }
}

async function sendTx(signer, functionId, args) {
  const transaction = await aptos.transaction.build.simple({
    sender: signer.accountAddress,
    data: { function: functionId, typeArguments: [], functionArguments: args },
  });
  const pending = await aptos.signAndSubmitTransaction({ signer, transaction });
  return aptos.waitForTransaction({ transactionHash: pending.hash });
}

async function main() {
  const keyHex = process.env.APTOS_PRIVATE_KEY;
  if (!keyHex) {
    console.error('Error: set APTOS_PRIVATE_KEY=0x<hex> before running');
    process.exit(1);
  }

  const normalizedKey = keyHex.startsWith('0x') ? keyHex : '0x' + keyHex;
  const buyer = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(normalizedKey) });
  console.log(`Buyer wallet : ${buyer.accountAddress}`);

  const totalBuys = TOKENS.reduce((s, t) => s + t.buys.reduce((a, b) => a + b, 0), 0);
  const totalCreatorFund = TOKENS.length * CREATOR_FUND_OCTAS;
  const needed = totalBuys + totalCreatorFund + 800_000_000; // +8 APT for gas + fees

  let bal = await getBalance(buyer.accountAddress.toString());
  console.log(`Balance      : ${bal / 1e8} APT`);
  console.log(`Needed       : ~${needed / 1e8} APT\n`);

  if (bal < needed) {
    const requests = Math.ceil((needed - bal) / 100_000_000) + 3;
    process.stdout.write(`Requesting faucet ${requests}× ... `);
    for (let i = 0; i < requests; i++) {
      const ok = await tryFaucet(buyer.accountAddress.toString());
      process.stdout.write(ok ? '.' : 'x');
      await sleep(1500);
    }
    console.log();
    bal = await getBalance(buyer.accountAddress.toString());
    console.log(`Balance after faucet: ${bal / 1e8} APT`);

    if (bal < needed) {
      console.log(`\nStill short ~${(needed - bal) / 1e8} APT.`);
      console.log('Fund manually at https://aptos.dev/network/faucet');
      console.log(`Address: ${buyer.accountAddress}`);
      console.log('Then re-run this script.\n');
      process.exit(1);
    }
  }

  for (let i = 0; i < TOKENS.length; i++) {
    const { name, ticker, buys } = TOKENS[i];
    console.log(`\n[${i + 1}/${TOKENS.length}] ${name} (${ticker})`);

    const creator = Account.generate();
    console.log(`  Creator: ${creator.accountAddress}`);

    process.stdout.write('  Fund creator ... ');
    try {
      await sendTx(buyer, '0x1::aptos_account::transfer',
        [creator.accountAddress.toString(), CREATOR_FUND_OCTAS]);
      console.log('✓');
    } catch (e) {
      console.log(`FAILED — ${e.message?.split('\n')[0]}`);
      continue;
    }
    await sleep(TX_DELAY_MS);

    process.stdout.write(`  Create token  ... `);
    try {
      const result = await sendTx(creator, `${MODULE}::token_launcher::create_token`,
        [toBytes(name), toBytes(ticker), toBytes(''), DECIMALS, TOTAL_SUPPLY]);
      const evt = result.events?.find(e => e.type?.includes('TokenCreatedEvent'));
      console.log(`✓  ${evt?.data?.metadata_addr ?? ''}`);
    } catch (e) {
      console.log(`FAILED — ${e.message?.split('\n')[0]}`);
      continue;
    }
    await sleep(TX_DELAY_MS);

    for (const amount of buys) {
      process.stdout.write(`  Buy ${(amount / 1e8).toFixed(2)} APT    ... `);
      try {
        await sendTx(buyer, `${MODULE}::token_launcher::buy_tokens`,
          [creator.accountAddress.toString(), toBytes(ticker), amount, SLIPPAGE_BPS]);
        console.log('✓');
      } catch (e) {
        console.log(`skipped — ${e.message?.split('\n')[0]}`);
      }
      await sleep(TX_DELAY_MS);
    }
  }

  console.log('\n✅ All done — refresh the marketplace in ~30 seconds.');
}

main().catch(console.error);
