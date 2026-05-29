import React from 'react';
import { Link } from 'react-router-dom';
import { BOOST_ENABLED } from '../featureFlags';
import Logo from './Logo';

const SiteFooter: React.FC = () => (
  <>
    <style>{`
      .mm-footer {
        background: #ffffff;
      }
      [data-theme="dark"] .mm-footer {
        background: var(--bg-secondary);
        border-top: 1px solid var(--border);
        padding: 54px 0 26px;
      }
      .mm-footer-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; }
      .mm-footer-top {
        padding-bottom: 34px; border-bottom: 1px solid var(--border);
        display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 44px;
      }
      .mm-footer-brand {
        font-size: 17px; font-weight: 700; letter-spacing: -0.022em;
        color: var(--text-primary); margin-bottom: 10px;
        display: flex; align-items: center;
      }
      .mm-footer-desc {
        font-size: 13px; color: var(--text-secondary);
        line-height: 1.55; max-width: 300px;
      }
      .mm-footer-section h4 {
        font-size: 12px; font-weight: 700; color: var(--text-primary);
        margin: 0 0 14px;
      }
      .mm-footer-section ul { list-style: none; margin: 0; padding: 0; }
      .mm-footer-section li { margin-bottom: 10px; }
      .mm-footer-section a {
        font-size: 13px; color: var(--text-secondary);
        text-decoration: none; transition: color 0.15s;
      }
      .mm-footer-section a:hover { color: var(--text-primary); }
      .mm-footer-bottom {
        padding-top: 22px;
        display: flex; justify-content: space-between; align-items: center;
        font-size: 12px; color: var(--text-muted);
        flex-wrap: wrap; gap: 16px;
      }
      .mm-footer-bottom a { color: var(--text-muted); text-decoration: none; margin-left: 22px; }
      .mm-footer-bottom a:hover { color: var(--text-secondary); }
      .mm-logo-wrap { line-height: 0; }
      @media (max-width: 900px) {
        .mm-footer-top { grid-template-columns: 1fr 1fr; gap: 32px; }
      }
      @media (max-width: 600px) {
        .mm-footer-top { grid-template-columns: 1fr; gap: 28px; }
        .mm-footer-bottom { flex-direction: column; align-items: flex-start; gap: 10px; }
        .mm-footer-bottom a { margin-left: 0; margin-right: 18px; }
      }
    `}</style>
    <footer className="mm-footer">
      <div className="mm-footer-inner">
        <div className="mm-footer-top">
          <div>
            <div className="mm-footer-brand mm-logo-wrap">
              <Logo height={26} />
            </div>
            <p className="mm-footer-desc">
              A token launchpad built for the Aptos network. Launch in seconds, trade instantly.
            </p>
          </div>
          <div className="mm-footer-section">
            <h4>Products</h4>
            <ul>
              <li><Link to="/marketplace">Marketplace</Link></li>
              <li><Link to="/launch">Launch a token</Link></li>
              {BOOST_ENABLED && <li><Link to="/boost">Boost</Link></li>}
            </ul>
          </div>
          <div className="mm-footer-section">
            <h4>Resources</h4>
            <ul>
              <li><Link to="/docs">Documentation</Link></li>
              <li><a href="https://explorer.aptoslabs.com/?network=testnet" target="_blank" rel="noopener noreferrer">Aptos explorer</a></li>
            </ul>
          </div>
          <div className="mm-footer-section">
            <h4>Company</h4>
            <ul>
              <li><Link to="/about">About</Link></li>
              <li><Link to="/privacy">Privacy</Link></li>
              <li><Link to="/terms">Terms</Link></li>
            </ul>
          </div>
        </div>
        <div className="mm-footer-bottom">
          <span>Copyright © 2026 MoveMint. All rights reserved.</span>
          <span>
            <Link to="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'none', marginLeft: 22 }}>Privacy</Link>
            <Link to="/terms" style={{ color: 'var(--text-muted)', textDecoration: 'none', marginLeft: 22 }}>Terms</Link>
            <Link to="/about" style={{ color: 'var(--text-muted)', textDecoration: 'none', marginLeft: 22 }}>About</Link>
          </span>
        </div>
      </div>
    </footer>
  </>
);

export default SiteFooter;
