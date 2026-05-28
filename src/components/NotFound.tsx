import React from 'react';
import { Link } from 'react-router-dom';
import AppHeader from './AppHeader';
import SiteFooter from './SiteFooter';

const NotFound: React.FC = () => {
  return (
    <>
      <style>{`
        .nf-page {
          min-height: 100vh;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
        }
        .nf-wrap {
          max-width: 640px; margin: 0 auto;
          padding: 96px 24px 64px; text-align: center;
        }
        .nf-code {
          font-size: 96px; font-weight: 800; letter-spacing: -0.04em;
          color: var(--text-primary); margin: 0 0 8px; line-height: 1;
        }
        .nf-title {
          font-size: 22px; font-weight: 700; letter-spacing: -0.02em;
          color: var(--text-primary); margin: 0 0 10px;
        }
        .nf-sub {
          font-size: 15px; color: var(--text-secondary);
          margin: 0 0 32px; line-height: 1.55;
        }
        .nf-actions {
          display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;
        }
        .nf-btn {
          padding: 11px 20px; border-radius: 10px;
          font-size: 14px; font-weight: 600;
          text-decoration: none; transition: background 0.15s, transform 0.05s;
        }
        .nf-btn-primary {
          background: var(--accent); color: #fff;
          box-shadow: 0 2px 10px rgba(51,151,46,0.3);
        }
        .nf-btn-primary:hover { background: var(--accent-hover); }
        .nf-btn-secondary {
          background: var(--bg-primary); color: var(--text-primary);
          border: 1px solid var(--border);
        }
        .nf-btn-secondary:hover { background: var(--bg-hover); }
      `}</style>
      <div className="nf-page">
        <AppHeader narrow hideBoostBar />
        <div className="nf-wrap">
          <h1 className="nf-code">404</h1>
          <div className="nf-title">Page not found</div>
          <p className="nf-sub">
            The page you're looking for doesn't exist or has moved.
          </p>
          <div className="nf-actions">
            <Link to="/" className="nf-btn nf-btn-primary">Back to home</Link>
            <Link to="/marketplace" className="nf-btn nf-btn-secondary">Browse tokens</Link>
          </div>
        </div>
        <SiteFooter />
      </div>
    </>
  );
};

export default NotFound;
