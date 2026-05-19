import React from 'react';
import { Link } from 'react-router-dom';
import AppHeader from './AppHeader';
import SiteFooter from './SiteFooter';

const About: React.FC = () => {
  return (
    <>
      <style>{`
        .ab-page {
          min-height: 100vh;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
        }
        .ab-wrap { max-width: 1100px; margin: 0 auto; padding: 60px 24px 80px; }

        .ab-hero {
          text-align: center;
          padding: 40px 0 60px;
        }
        .ab-hero-mark {
          display: inline-flex; align-items: center; justify-content: center;
          width: 64px; height: 64px; border-radius: 20px;
          background: linear-gradient(145deg, var(--accent), var(--accent-hover));
          color: #fff; font-size: 30px; font-weight: 800;
          margin-bottom: 24px;
          box-shadow: 0 8px 24px rgba(5,150,105,0.35);
        }
        .ab-hero h1 {
          font-size: 56px; font-weight: 700; letter-spacing: -0.04em;
          margin: 0 0 14px; line-height: 1.05;
          color: var(--text-primary);
        }
        .ab-hero p {
          font-size: 19px; line-height: 1.5;
          color: var(--text-secondary); margin: 0 auto;
          max-width: 640px;
        }
        .ab-cta-row {
          display: flex; gap: 12px; justify-content: center;
          margin-top: 32px;
        }
        .ab-cta {
          padding: 12px 24px; border-radius: 12px;
          font-size: 14.5px; font-weight: 600;
          text-decoration: none;
          transition: background 0.15s, transform 0.05s, border-color 0.12s;
        }
        .ab-cta.primary {
          background: var(--accent); color: #fff;
          box-shadow: 0 2px 12px rgba(5,150,105,0.3);
        }
        .ab-cta.primary:hover { background: var(--accent-hover); }
        .ab-cta.secondary {
          background: var(--bg-primary); color: var(--text-primary);
          border: 1px solid var(--border);
        }
        .ab-cta.secondary:hover { border-color: var(--accent); background: var(--bg-hover); }

        .ab-section {
          padding: 56px 0;
          border-top: 1px solid var(--border);
        }
        .ab-section-label {
          font-size: 12px; font-weight: 700; color: var(--accent);
          text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 14px;
        }
        .ab-section h2 {
          font-size: 36px; font-weight: 700; letter-spacing: -0.025em;
          margin: 0 0 18px; max-width: 720px;
          color: var(--text-primary);
        }
        .ab-section .lede {
          font-size: 17px; line-height: 1.6;
          color: var(--text-secondary);
          max-width: 720px; margin: 0;
        }

        .ab-features {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
          margin-top: 36px;
        }
        .ab-feature {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
        }
        .ab-feature-icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 40px; height: 40px; border-radius: 12px;
          background: var(--accent-light);
          color: var(--accent); font-size: 20px;
          margin-bottom: 14px;
        }
        .ab-feature h3 {
          font-size: 16px; font-weight: 600; letter-spacing: -0.01em;
          margin: 0 0 6px; color: var(--text-primary);
        }
        .ab-feature p {
          font-size: 13.5px; color: var(--text-secondary);
          line-height: 1.55; margin: 0;
        }

        .ab-steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-top: 36px;
        }
        .ab-step {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
        }
        .ab-step-num {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--accent); color: #fff;
          font-size: 13px; font-weight: 700;
          margin-bottom: 14px;
        }
        .ab-step h3 {
          font-size: 16px; font-weight: 600; letter-spacing: -0.01em;
          margin: 0 0 6px;
        }
        .ab-step p {
          font-size: 13.5px; color: var(--text-secondary);
          line-height: 1.55; margin: 0;
        }

        .ab-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-top: 36px;
        }
        .ab-stat {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 22px 20px;
        }
        .ab-stat-label {
          font-size: 11.5px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;
        }
        .ab-stat-value {
          font-size: 24px; font-weight: 700; letter-spacing: -0.02em;
          color: var(--text-primary); font-variant-numeric: tabular-nums;
        }
        .ab-stat-unit {
          font-size: 13px; color: var(--text-muted); font-weight: 500; margin-left: 4px;
        }

        .ab-footer-cta {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 48px 32px;
          text-align: center;
          margin-top: 56px;
        }
        .ab-footer-cta h2 {
          font-size: 28px; font-weight: 700; letter-spacing: -0.025em;
          margin: 0 0 10px;
        }
        .ab-footer-cta p {
          font-size: 15px; color: var(--text-secondary);
          margin: 0 auto 24px; max-width: 480px;
        }

        @media (max-width: 800px) {
          .ab-hero h1 { font-size: 40px; }
          .ab-hero p { font-size: 16px; }
          .ab-section h2 { font-size: 28px; }
          .ab-features, .ab-steps { grid-template-columns: 1fr; }
          .ab-stats { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="ab-page">
        <AppHeader />
        <div className="ab-wrap">
          <div className="ab-hero">
            <div className="ab-hero-mark">M</div>
            <h1>The fastest way to launch a token on Aptos.</h1>
            <p>MoveMint is a bonding-curve launchpad designed for builders, communities, and degens. Spin up a token in seconds, trade with predictable pricing, and graduate to liquidity when your community shows up.</p>
            <div className="ab-cta-row">
              <Link to="/launch" className="ab-cta primary">Launch a token</Link>
              <Link to="/marketplace" className="ab-cta secondary">Browse marketplace</Link>
            </div>
          </div>

          <section className="ab-section">
            <div className="ab-section-label">How it works</div>
            <h2>Three steps from idea to traded asset.</h2>
            <p className="lede">Every token launches on a transparent bonding curve. Price is a function of supply — no liquidity pools to seed, no rugged LPs, no opaque math.</p>
            <div className="ab-steps">
              <div className="ab-step">
                <div className="ab-step-num">1</div>
                <h3>Create</h3>
                <p>Set a name, ticker, and logo. Pay the launch fee. Your fungible asset is minted on-chain in a single transaction.</p>
              </div>
              <div className="ab-step">
                <div className="ab-step-num">2</div>
                <h3>Trade</h3>
                <p>Anyone can buy or sell against the curve. Price moves deterministically as tokens are minted from the available 800M supply.</p>
              </div>
              <div className="ab-step">
                <div className="ab-step-num">3</div>
                <h3>Graduate</h3>
                <p>When market cap crosses the threshold, the token graduates and unlocks its full supply for the wider Aptos ecosystem.</p>
              </div>
            </div>
          </section>

          <section className="ab-section">
            <div className="ab-section-label">What you get</div>
            <h2>Built for fast, fair, transparent launches.</h2>
            <div className="ab-features">
              <div className="ab-feature">
                <div className="ab-feature-icon">⚡</div>
                <h3>One-click launch</h3>
                <p>No code, no LP setup. Fill out a form, sign one transaction, and your token is live.</p>
              </div>
              <div className="ab-feature">
                <div className="ab-feature-icon">📈</div>
                <h3>Deterministic pricing</h3>
                <p>A published bonding curve means no price discovery surprises. The math is open and identical for everyone.</p>
              </div>
              <div className="ab-feature">
                <div className="ab-feature-icon">🎯</div>
                <h3>Slippage protection</h3>
                <p>Every buy and sell honors your slippage tolerance. Configure per-trade or accept the default.</p>
              </div>
              <div className="ab-feature">
                <div className="ab-feature-icon">🏆</div>
                <h3>Boost leaderboard</h3>
                <p>Communities can promote their token by paying boost fees. The top spots are visible on every page.</p>
              </div>
              <div className="ab-feature">
                <div className="ab-feature-icon">📊</div>
                <h3>Live charts &amp; trades</h3>
                <p>Candlestick or line view, multiple timeframes, and a transaction feed updated every few seconds.</p>
              </div>
              <div className="ab-feature">
                <div className="ab-feature-icon">🪙</div>
                <h3>Low fees</h3>
                <p>0.9% platform fee while bonding, dropping to 0.05% post-graduation. Creators earn a cut of every trade.</p>
              </div>
            </div>
          </section>

          <section className="ab-section">
            <div className="ab-section-label">By the numbers</div>
            <h2>Designed for transparent economics.</h2>
            <div className="ab-stats">
              <div className="ab-stat">
                <div className="ab-stat-label">Total supply</div>
                <div className="ab-stat-value">1<span className="ab-stat-unit">B</span></div>
              </div>
              <div className="ab-stat">
                <div className="ab-stat-label">On bonding curve</div>
                <div className="ab-stat-value">800<span className="ab-stat-unit">M</span></div>
              </div>
              <div className="ab-stat">
                <div className="ab-stat-label">Trading fee</div>
                <div className="ab-stat-value">1.0<span className="ab-stat-unit">%</span></div>
              </div>
              <div className="ab-stat">
                <div className="ab-stat-label">Network</div>
                <div className="ab-stat-value" style={{ fontSize: 18 }}>Aptos</div>
              </div>
            </div>
          </section>

          <div className="ab-footer-cta">
            <h2>Ready to launch?</h2>
            <p>Get your token live in minutes. No code required.</p>
            <div className="ab-cta-row">
              <Link to="/launch" className="ab-cta primary">Launch a token</Link>
              <Link to="/marketplace" className="ab-cta secondary">See what's trading</Link>
            </div>
          </div>
        </div>
        <SiteFooter />
      </div>
    </>
  );
};

export default About;
