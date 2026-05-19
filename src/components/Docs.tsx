import React from 'react';
import { Link } from 'react-router-dom';
import AppHeader from './AppHeader';
import SiteFooter from './SiteFooter';
import { BONDING_CURVE } from '../lib/bondingCurve';

const Docs: React.FC = () => (
  <>
    <style>{`
      .dx-page { min-height: 100vh; background: var(--bg-secondary); color: var(--text-primary);
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif; }
      .dx-wrap { max-width: 760px; margin: 0 auto; padding: 60px 32px 80px; }
      .dx-eyebrow { font-size: 12px; font-weight: 700; color: var(--accent);
        text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 14px; }
      .dx-wrap h1 { font-size: 40px; font-weight: 700; letter-spacing: -0.025em;
        line-height: 1.1; margin: 0 0 14px; }
      .dx-lede { font-size: 17px; color: var(--text-secondary); line-height: 1.55;
        margin-bottom: 40px; }
      .dx-wrap h2 { font-size: 22px; font-weight: 700; letter-spacing: -0.015em;
        margin: 44px 0 14px; }
      .dx-wrap h3 { font-size: 16px; font-weight: 700; margin: 26px 0 8px; }
      .dx-wrap p, .dx-wrap li { font-size: 15px; line-height: 1.65; color: var(--text-secondary); }
      .dx-wrap ul { padding-left: 22px; margin: 0 0 16px; }
      .dx-wrap li { margin-bottom: 6px; }
      .dx-wrap code {
        font-family: ui-monospace, "SF Mono", Menlo, monospace;
        background: var(--bg-primary); border: 1px solid var(--border);
        padding: 1px 6px; border-radius: 5px; font-size: 13px;
        color: var(--text-primary);
      }
      .dx-callout {
        background: var(--bg-primary); border: 1px solid var(--border);
        border-radius: 12px; padding: 18px 20px; margin: 20px 0;
      }
      .dx-callout strong { color: var(--text-primary); }
      .dx-cta { display: inline-block; margin-top: 18px;
        background: var(--accent); color: #fff; padding: 10px 18px;
        border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;
      }
      .dx-cta:hover { background: var(--accent-hover); }
      @media (max-width: 600px) {
        .dx-wrap { padding: 40px 18px 60px; }
        .dx-wrap h1 { font-size: 30px; }
      }
    `}</style>
    <div className="dx-page">
      <AppHeader narrow hideBoostBar />
      <div className="dx-wrap">
        <div className="dx-eyebrow">Documentation</div>
        <h1>How MoveMint works</h1>
        <p className="dx-lede">
          A bonding-curve token launchpad on Aptos testnet. Launch in seconds, trade on a
          deterministic price curve, and graduate to a DEX once enough APT is raised.
        </p>

        <h2>Quick start</h2>
        <ul>
          <li>Connect an Aptos wallet (Petra, Pontem, or any wallet that speaks the Aptos adapter).</li>
          <li>Click <Link to="/launch">Launch</Link>, fill in name + ticker, optionally add an image, description, and social links.</li>
          <li>Optionally pre-buy a chunk of supply in the same transaction.</li>
          <li>Approve the wallet popup. Your token is live on the bonding curve.</li>
        </ul>

        <h2>Bonding curve</h2>
        <p>
          Price is a pure function of supply: <code>price = {BONDING_CURVE.PRICE_NUMERATOR.toLocaleString()} / ({BONDING_CURVE.MAX_TOKENS.toLocaleString()} − sold) + {BONDING_CURVE.PRICE_CONSTANT}</code>,
          scaled to APT. Earlier buyers pay less; later buyers pay more. No liquidity pools to seed,
          no opaque AMM math.
        </p>
        <p>
          {BONDING_CURVE.MAX_TOKENS.toLocaleString()} tokens are sold on the curve. An additional
          200M are pre-minted for the DEX side at graduation, bringing total supply to
          {' '}{BONDING_CURVE.TOTAL_SUPPLY.toLocaleString()}.
        </p>

        <h2>Fees</h2>
        <ul>
          <li><strong>Pre-graduation:</strong> 0.9% platform + 0.1% creator on every buy and sell.</li>
          <li><strong>Graduation:</strong> a one-time 60 APT platform fee + 23 APT creator fee.</li>
          <li><strong>Post-graduation:</strong> 0.05% platform + 0.2% creator + 0.05% LP per trade.</li>
        </ul>

        <h2>Graduation</h2>
        <p>
          When cumulative APT raised hits <strong>{BONDING_CURVE.GRADUATION_APT} APT</strong>, the token graduates.
          The 200M pre-minted tokens and accumulated APT are migrated to a DEX pool. The creator
          receives 20M tokens (vested via <code>claim_creator_tokens</code>).
        </p>

        <h2>Slippage</h2>
        <p>
          Set max slippage on the trade panel (0.5% — 10%). The contract reverts if the actual
          price move on your trade exceeds the bound you set.
        </p>

        <h2>Contract</h2>
        <p>
          The on-chain module lives at <code>0x8c69…9c96d</code> on Aptos testnet. Source is open in the repo;
          inspect events on the <a href="https://explorer.aptoslabs.com/?network=testnet" target="_blank" rel="noopener noreferrer">Aptos explorer</a>.
        </p>

        <div className="dx-callout">
          <strong>Testnet only.</strong> Tokens launched on MoveMint live on Aptos testnet. APT used
          here has no monetary value. Mainnet support is in progress.
        </div>

        <Link to="/launch" className="dx-cta">Launch a token →</Link>
      </div>
      <SiteFooter />
    </div>
  </>
);

export default Docs;
