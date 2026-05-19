import React from 'react';
import AppHeader from './AppHeader';
import SiteFooter from './SiteFooter';

const Terms: React.FC = () => (
  <>
    <style>{`
      .lg-page { min-height: 100vh; background: var(--bg-secondary); color: var(--text-primary);
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif; }
      .lg-wrap { max-width: 760px; margin: 0 auto; padding: 60px 32px 80px; }
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
        <h1>Terms of use</h1>
        <p className="lg-meta">Last updated: May 2026</p>

        <h2>Testnet only</h2>
        <p>
          MoveMint currently operates exclusively on the Aptos testnet. Tokens launched and traded on
          this platform exist on a test network. Testnet APT has no monetary value, and tokens
          launched here are for development, testing, and demonstration purposes.
        </p>

        <h2>No financial advice</h2>
        <p>
          Nothing on this site is investment, financial, legal, or tax advice. Token launches and
          trades happen entirely between users via smart contracts. We are not a broker, exchange, or
          financial institution.
        </p>

        <h2>Use at your own risk</h2>
        <p>
          Smart contracts can have bugs. Bonding curves can move quickly. Tokens can lose all their
          value. You are responsible for understanding what you sign in your wallet. Always verify the
          contract address before approving a transaction.
        </p>

        <h2>Prohibited use</h2>
        <ul>
          <li>Launching tokens that infringe trademarks, impersonate real people or projects, or promote illegal activity.</li>
          <li>Attempting to manipulate the bonding curve, boost system, or any front-end behavior in bad faith.</li>
          <li>Using the platform from a jurisdiction where doing so would violate local law.</li>
        </ul>

        <h2>Liability</h2>
        <p>
          The platform is provided "as is" without warranties of any kind. To the maximum extent
          permitted by law, the maintainers are not liable for any losses, damages, or claims arising
          from your use of the platform or any tokens launched on it.
        </p>
      </div>
      <SiteFooter />
    </div>
  </>
);

export default Terms;
