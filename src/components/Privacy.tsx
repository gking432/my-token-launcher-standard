import React from 'react';
import AppHeader from './AppHeader';
import SiteFooter from './SiteFooter';

const Privacy: React.FC = () => (
  <>
    <style>{`
      .lg-page { min-height: 100vh; display: flex; flex-direction: column; background: var(--bg-secondary); color: var(--text-primary);
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif; }
      .lg-wrap { flex: 1; max-width: 760px; margin: 0 auto; padding: 60px 32px 80px; }
      .lg-eyebrow { font-size: 12px; font-weight: 700; color: var(--accent);
        text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 14px; }
      .lg-wrap h1 { font-size: 40px; font-weight: 700; letter-spacing: -0.025em;
        line-height: 1.1; margin: 0 0 14px; }
      .lg-wrap h2 { font-size: 22px; font-weight: 700; letter-spacing: -0.015em;
        margin: 36px 0 12px; }
      .lg-wrap p, .lg-wrap li { font-size: 15px; line-height: 1.65; color: var(--text-secondary); }
      .lg-wrap ul { padding-left: 22px; margin: 0 0 16px; }
      .lg-meta { font-size: 13px; color: var(--text-muted); margin-bottom: 32px; }
      @media (max-width: 600px) {
        .lg-wrap { padding: 40px 18px 60px; }
        .lg-wrap h1 { font-size: 30px; }
      }
    `}</style>
    <div className="lg-page">
      <AppHeader narrow hideBoostBar />
      <div className="lg-wrap">
        <div className="lg-eyebrow">Legal</div>
        <h1>Privacy policy</h1>
        <p className="lg-meta">Last updated: May 2026</p>

        <h2>What we store</h2>
        <p>
          MoveMint is a front-end for an Aptos smart contract. We do not run user accounts. Everything
          you do on-chain — launching a token, buying, selling, boosting — is publicly recorded on
          the Aptos blockchain and visible to anyone.
        </p>
        <ul>
          <li><strong>On-chain:</strong> your wallet address, the tokens you launch or trade, and the timestamps and amounts of those transactions.</li>
          <li><strong>In your browser:</strong> token images, social links, watchlist, and boost contributions are cached in <code>localStorage</code> so they survive page reloads. This data lives only on your device.</li>
          <li><strong>On our servers:</strong> aggregated read-only caching of public on-chain data for performance. No personal data, no cookies, no tracking pixels.</li>
        </ul>

        <h2>Wallets</h2>
        <p>
          Wallet connections are handled by your wallet extension. We never see your private keys or
          seed phrase. Signing a transaction always requires your explicit approval inside your wallet.
        </p>

        <h2>Third parties</h2>
        <p>
          We use the public Aptos fullnode and GraphQL indexer to read on-chain data. Wallet adapters
          connect you to your chosen wallet provider. We do not share any data with advertisers.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about how your data is handled? Reach out through the project's GitHub repo.
        </p>
      </div>
      <SiteFooter />
    </div>
  </>
);

export default Privacy;
