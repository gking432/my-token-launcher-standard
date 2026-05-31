import React, { useMemo, useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Link, useParams } from 'react-router-dom';
import PageShell from './PageShell';
import { useTokenData } from '../hooks/useTokenData';
import { useTokenList } from '../data/useTokenList';
import { useAptPrice } from '../contexts/AptPriceContext';
import { truncateAddress } from '../utils/format';

const formatPriceUSD = (price: number | undefined | null): string => {
  if (price == null || isNaN(price)) return '—';
  if (price < 0.0001) return `$${price.toFixed(8)}`;
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(2)}`;
};

const formatNumber = (n: number | undefined | null): string => {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(0);
};

const Profile: React.FC = () => {
  const { account } = useWallet();
  const { address: routeAddress } = useParams();
  const { tokens: catalogTokens, loading } = useTokenData();
  const { aptPrice } = useAptPrice();
  const [copied, setCopied] = useState(false);

  const viewingAddress = (routeAddress || (account ? String(account.address) : '')).toLowerCase();

  const launchedAddrs = useMemo(
    () => catalogTokens.map(t => t.metadataAddress || t.txHash).filter(Boolean) as string[],
    [catalogTokens]
  );
  const { data: liveByAddr } = useTokenList(launchedAddrs);

  const launched = useMemo(() => {
    if (!viewingAddress) return [];
    return catalogTokens
      .filter(t => (t.creator || t.creatorAddress || '').toLowerCase() === viewingAddress)
      .map(t => {
        const live = liveByAddr?.[(t.metadataAddress || '').toLowerCase()];
        const priceAPT = live?.spotPriceAPT ?? 0;
        const priceUSD = aptPrice ? priceAPT * aptPrice : t.priceUSD;
        const marketCapUSD = live?.marketCapAPT && aptPrice ? live.marketCapAPT * aptPrice : undefined;
        return {
          ...t,
          priceUSD,
          marketCapUSD,
          aptRaised: live?.aptRaised,
          isGraduated: live?.isGraduated ?? false,
        };
      });
  }, [catalogTokens, liveByAddr, viewingAddress, aptPrice]);

  const isOwn = !!(account && String(account.address).toLowerCase() === viewingAddress);

  const handleCopy = () => {
    if (!viewingAddress) return;
    navigator.clipboard.writeText(viewingAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <style>{`
        .pf-page {
          min-height: 100vh;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
        }
        .pf-wrap {
          padding: 40px 40px 64px;
        }
        .pf-hero {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 28px 32px;
          display: flex; align-items: center; gap: 22px;
          margin-bottom: 28px;
        }
        .pf-avatar {
          width: 72px; height: 72px; border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), var(--accent-hover));
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 28px; font-weight: 700;
          flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(51,151,46,0.25);
        }
        .pf-hero-text { flex: 1; min-width: 0; }
        .pf-hero-label {
          font-size: 12px; font-weight: 600; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;
        }
        .pf-hero-addr {
          font-size: 26px; font-weight: 700; letter-spacing: -0.02em;
          color: var(--text-primary); font-family: ui-monospace, "SF Mono", Menlo, monospace;
          word-break: break-all;
        }
        .pf-hero-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .pf-btn {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          color: var(--text-primary);
          padding: 8px 14px; border-radius: 10px;
          font-size: 13px; font-weight: 600; font-family: inherit;
          cursor: pointer;
          transition: background 0.12s, border-color 0.12s;
        }
        .pf-btn:hover { background: var(--bg-hover); border-color: var(--accent); }
        .pf-btn.primary {
          background: var(--accent); color: #fff; border-color: var(--accent);
          box-shadow: 0 2px 10px rgba(51,151,46,0.3);
        }
        .pf-btn.primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
        .pf-section-title {
          display: flex; align-items: baseline; gap: 10px;
          margin-bottom: 16px;
        }
        .pf-section-title h2 {
          font-size: 20px; font-weight: 700; letter-spacing: -0.015em;
          color: var(--text-primary); margin: 0;
        }
        .pf-section-title .count {
          font-size: 13px; color: var(--text-muted); font-weight: 500;
        }
        .pf-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        .pf-card {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 20px;
          cursor: pointer;
          text-decoration: none; color: inherit;
          display: flex; flex-direction: column; gap: 14px;
          transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
        }
        .pf-card:hover {
          transform: translateY(-2px);
          border-color: var(--accent);
          box-shadow: 0 8px 24px rgba(0,0,0,0.06);
        }
        .pf-card-top { display: flex; align-items: center; gap: 12px; }
        .pf-token-icon {
          width: 44px; height: 44px; border-radius: 12px;
          background: linear-gradient(135deg, var(--bg-tertiary), var(--bg-hover));
          display: flex; align-items: center; justify-content: center;
          color: var(--text-primary); font-size: 16px; font-weight: 700;
          flex-shrink: 0;
        }
        .pf-card-name {
          font-size: 15px; font-weight: 600; color: var(--text-primary);
          letter-spacing: -0.01em;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pf-card-symbol {
          font-size: 12.5px; color: var(--text-muted); font-weight: 500;
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
        }
        .pf-card-badge {
          margin-left: auto; padding: 3px 8px; border-radius: 6px;
          font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .pf-card-badge.graduated {
          background: var(--accent-light); color: var(--accent);
        }
        .pf-card-stats {
          display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
          padding-top: 14px; border-top: 1px solid var(--border);
        }
        .pf-stat-label {
          font-size: 11px; font-weight: 600; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;
        }
        .pf-stat-value {
          font-size: 14px; font-weight: 600; color: var(--text-primary);
          font-variant-numeric: tabular-nums;
        }
        .pf-empty {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 60px 24px;
          text-align: center;
        }
        @keyframes pf-skel {
          0% { background-position: -200px 0; }
          100% { background-position: calc(200px + 100%) 0; }
        }
        .pf-skel {
          display: inline-block; height: 14px; border-radius: 6px;
          background: linear-gradient(90deg, var(--bg-secondary) 0px, var(--bg-hover) 80px, var(--bg-secondary) 160px);
          background-size: 200px 100%;
          animation: pf-skel 1.2s linear infinite;
        }
        .pf-skel-card {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 18px;
        }
        .pf-empty-title {
          font-size: 17px; font-weight: 600; color: var(--text-primary);
          margin-bottom: 6px;
        }
        .pf-empty-sub {
          font-size: 14px; color: var(--text-secondary); margin-bottom: 18px;
        }
        @media (max-width: 700px) {
          .pf-wrap { padding: 24px 16px 60px; }
          .pf-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
        }
        @media (max-width: 600px) {
          .pf-hero { flex-direction: column; align-items: flex-start; gap: 14px; }
          .pf-hero-addr { font-size: 18px; }
          .pf-hero-actions { width: 100%; }
        }
        @media (max-width: 460px) {
          .pf-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="pf-page">
        <PageShell>
        <div className="pf-wrap">
          {!viewingAddress ? (
            <div className="pf-empty">
              <div className="pf-empty-title">Connect your wallet</div>
              <div className="pf-empty-sub">Connect a wallet to see your launched tokens.</div>
            </div>
          ) : (
            <>
              <div className="pf-hero">
                <div className="pf-avatar">{viewingAddress.slice(2, 3).toUpperCase()}</div>
                <div className="pf-hero-text">
                  <div className="pf-hero-label">{isOwn ? 'Your wallet' : 'Profile'}</div>
                  <div className="pf-hero-addr">{truncateAddress(viewingAddress)}</div>
                </div>
                <div className="pf-hero-actions">
                  <button className="pf-btn" onClick={handleCopy}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <a
                    className="pf-btn"
                    href={`https://explorer.aptoslabs.com/account/${viewingAddress}?network=testnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Explorer ↗
                  </a>
                  {isOwn && (
                    <Link to="/launch" className="pf-btn primary">Launch new token</Link>
                  )}
                </div>
              </div>

              <div className="pf-section-title">
                <h2>Launched tokens</h2>
                <span className="count">{launched.length}</span>
              </div>

              {loading && launched.length === 0 ? (
                <div className="pf-grid">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={`pf-skel-${i}`} className="pf-skel-card">
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                        <span className="pf-skel" style={{ width: 36, height: 36, borderRadius: 10 }}></span>
                        <div style={{ flex: 1 }}>
                          <span className="pf-skel" style={{ width: '60%' }}></span><br/>
                          <span className="pf-skel" style={{ width: 40, height: 11, marginTop: 6 }}></span>
                        </div>
                      </div>
                      <span className="pf-skel" style={{ width: '90%' }}></span><br/>
                      <span className="pf-skel" style={{ width: '70%', marginTop: 6 }}></span>
                    </div>
                  ))}
                </div>
              ) : launched.length === 0 ? (
                <div className="pf-empty">
                  <div className="pf-empty-title">No tokens yet</div>
                  <div className="pf-empty-sub">
                    {isOwn
                      ? "You haven't launched any tokens. Create one in minutes."
                      : "This wallet hasn't launched any tokens."}
                  </div>
                  {isOwn && (
                    <Link to="/launch" className="pf-btn primary" style={{ textDecoration: 'none' }}>
                      Launch a token
                    </Link>
                  )}
                </div>
              ) : (
                <div className="pf-grid">
                  {launched.map(t => (
                    <Link
                      key={t.metadataAddress || t.txHash}
                      to={`/newtoken/${t.metadataAddress || t.txHash}`}
                      className="pf-card"
                    >
                      <div className="pf-card-top">
                        <div className="pf-token-icon">{(t.symbol || '?').replace(/^\$/, '').slice(0, 2).toUpperCase()}</div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="pf-card-name">{t.name}</div>
                          <div className="pf-card-symbol">{t.symbol}</div>
                        </div>
                        {t.isGraduated && <span className="pf-card-badge graduated">Graduated</span>}
                      </div>
                      <div className="pf-card-stats">
                        <div>
                          <div className="pf-stat-label">Price</div>
                          <div className="pf-stat-value">{formatPriceUSD(t.priceUSD)}</div>
                        </div>
                        <div>
                          <div className="pf-stat-label">Market cap</div>
                          <div className="pf-stat-value">{t.marketCapUSD ? `$${formatNumber(t.marketCapUSD)}` : '—'}</div>
                        </div>
                        <div>
                          <div className="pf-stat-label">APT raised</div>
                          <div className="pf-stat-value">{t.aptRaised != null ? `${t.aptRaised.toFixed(2)} APT` : '—'}</div>
                        </div>
                        <div>
                          <div className="pf-stat-label">Supply</div>
                          <div className="pf-stat-value">{t.supply ? formatNumber(Number(t.supply)) : '—'}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

            </>
          )}
        </div>
        </PageShell>
      </div>
    </>
  );
};

export default Profile;
