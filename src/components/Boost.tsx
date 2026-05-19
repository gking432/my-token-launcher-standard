import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import PageShell from './PageShell';
import { useTokenData } from '../hooks/useTokenData';
import { useBoostData, addBoost, BOOST_WINDOWS, BoostWindow } from '../data/useBoostStore';

const TOP_N = 100;

const formatApt = (apt: number): string => {
  if (apt >= 1000) return `${(apt / 1000).toFixed(2)}k`;
  if (apt >= 100) return apt.toFixed(0);
  if (apt >= 10) return apt.toFixed(1);
  return apt.toFixed(2);
};

const Boost: React.FC = () => {
  const { account } = useWallet();
  const { tokens: catalogTokens } = useTokenData();
  const [searchParams, setSearchParams] = useSearchParams();

  const [windowKey, setWindowKey] = useState<BoostWindow>('24h');
  const [query, setQuery] = useState('');
  const [boostAmount, setBoostAmount] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const boostMap = useBoostData(BOOST_WINDOWS[windowKey]);

  const selectedAddr = (searchParams.get('token') || '').toLowerCase();

  const ranked = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogTokens
      .map(t => {
        const addr = (t.metadataAddress || t.txHash || '').toLowerCase();
        return {
          name: t.name,
          symbol: t.symbol,
          creator: (t.creator || t.creatorAddress || '').toLowerCase(),
          metadataAddress: addr,
          boostApt: boostMap[addr] ?? 0,
        };
      })
      .filter(t => t.metadataAddress)
      .filter(t => !q || t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q))
      .sort((a, b) => b.boostApt - a.boostApt)
      .slice(0, TOP_N);
  }, [catalogTokens, boostMap, query]);

  const selected = useMemo(
    () => ranked.find(t => t.metadataAddress === selectedAddr) || null,
    [ranked, selectedAddr]
  );

  const selectToken = (addr: string) => {
    setSearchParams({ token: addr });
  };

  const clearSelection = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('token');
    setSearchParams(next);
    setBoostAmount('');
  };

  const handleBoost = () => {
    if (!selected) return;
    if (!account) {
      setToast('Connect your wallet to boost a token.');
      return;
    }
    const amount = parseFloat(boostAmount);
    if (!amount || amount <= 0) {
      setToast('Enter a valid APT amount.');
      return;
    }
    addBoost(selected.metadataAddress, amount, String(account.address));
    setToast(`Boosted ${selected.symbol} with ${amount} APT.`);
    setBoostAmount('');
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const topThree = ranked.slice(0, 3);
  const totalBoostedApt = Object.values(boostMap).reduce((s, v) => s + v, 0);
  const activeTokens = Object.keys(boostMap).length;

  return (
    <>
      <style>{`
        .bp-page {
          min-height: 100vh;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
        }
        .bp-wrap { max-width: 1280px; margin: 0 auto; padding: 40px 24px 64px; }
        .bp-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
        .bp-hero h1 {
          font-size: 36px; font-weight: 700; letter-spacing: -0.025em; margin: 0 0 6px;
          display: flex; align-items: center; gap: 12px;
        }
        .bp-hero-flame {
          display: inline-flex; align-items: center; justify-content: center;
          width: 44px; height: 44px; border-radius: 12px;
          background: linear-gradient(145deg, var(--boost), var(--boost-hover));
          color: #fff; font-size: 22px;
          box-shadow: 0 4px 14px rgba(234,88,12,0.4);
        }
        .bp-hero p { font-size: 15px; color: var(--text-secondary); margin: 0; max-width: 560px; }
        .bp-banner {
          background: var(--boost-light);
          border: 1px solid var(--boost);
          border-radius: 12px;
          padding: 12px 16px;
          margin-bottom: 24px;
          font-size: 13.5px;
          color: var(--boost);
          font-weight: 500;
          line-height: 1.5;
        }
        .bp-banner strong { font-weight: 700; }

        .bp-summary {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
          margin-bottom: 24px;
        }
        .bp-stat {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 18px 20px;
        }
        .bp-stat-label {
          font-size: 11.5px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;
        }
        .bp-stat-value {
          font-size: 22px; font-weight: 700; color: var(--text-primary);
          font-variant-numeric: tabular-nums; letter-spacing: -0.01em;
        }
        .bp-stat:first-child .bp-stat-value { color: var(--boost); }
        .bp-stat-unit { font-size: 13px; color: var(--text-muted); font-weight: 500; margin-left: 4px; }

        .bp-controls {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 16px; flex-wrap: wrap;
        }
        .bp-search {
          flex: 1; min-width: 220px;
          height: 38px; padding: 0 14px 0 36px;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--text-primary); font-size: 14px; font-family: inherit;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .bp-search:focus {
          border-color: var(--boost);
          box-shadow: 0 0 0 3px var(--boost-light);
        }
        .bp-search-wrap { position: relative; flex: 1; min-width: 220px; }
        .bp-search-icon {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          font-size: 14px; color: var(--text-muted); pointer-events: none;
        }
        .bp-window {
          display: flex; gap: 0;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 10px; padding: 3px;
        }
        .bp-window button {
          padding: 6px 14px;
          background: transparent; border: none; cursor: pointer;
          color: var(--text-secondary);
          font-size: 13px; font-weight: 600; font-family: inherit;
          border-radius: 7px;
          transition: background 0.12s, color 0.12s;
        }
        .bp-window button.active {
          background: var(--bg-tertiary); color: var(--text-primary);
        }
        .bp-window button:hover:not(.active) { color: var(--text-primary); }

        .bp-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
          gap: 20px;
          align-items: flex-start;
        }
        .bp-list {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
        }
        .bp-row {
          display: grid;
          grid-template-columns: 44px 1fr auto auto;
          align-items: center; gap: 14px;
          padding: 12px 18px;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          text-decoration: none; color: inherit;
          transition: background 0.12s;
        }
        .bp-row:last-child { border-bottom: none; }
        .bp-row:hover { background: var(--bg-secondary); }
        .bp-row.selected { background: var(--boost-light); }
        .bp-rank {
          font-size: 15px; font-weight: 700; color: var(--text-muted);
          font-variant-numeric: tabular-nums;
          text-align: center;
        }
        .bp-row.r1 .bp-rank { color: #c69900; }
        .bp-row.r2 .bp-rank { color: #6e6e73; }
        .bp-row.r3 .bp-rank { color: #b76a25; }
        .bp-token-cell { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .bp-token-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg, var(--bg-tertiary), var(--bg-hover));
          display: flex; align-items: center; justify-content: center;
          color: var(--text-primary); font-size: 12.5px; font-weight: 700;
          flex-shrink: 0;
        }
        .bp-token-name {
          font-size: 14px; font-weight: 600; color: var(--text-primary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .bp-token-symbol {
          font-size: 12px; color: var(--text-muted); font-weight: 500;
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
        }
        .bp-row-apt {
          font-size: 15px; font-weight: 700; color: var(--boost);
          font-variant-numeric: tabular-nums;
        }
        .bp-row-apt-unit { font-size: 11.5px; color: var(--text-muted); font-weight: 600; margin-left: 3px; }
        .bp-row-action {
          font-size: 12px; font-weight: 600; color: var(--text-muted);
          padding: 5px 10px; border-radius: 7px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
        }
        .bp-row.selected .bp-row-action {
          background: var(--boost); color: #fff; border-color: var(--boost);
        }
        .bp-empty-list {
          padding: 60px 24px; text-align: center; color: var(--text-muted);
        }

        .bp-panel {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          position: sticky; top: 116px;
        }
        .bp-panel-title {
          font-size: 13px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 14px;
        }
        .bp-panel-empty {
          font-size: 14px; color: var(--text-secondary);
          line-height: 1.55; padding: 24px 0;
          text-align: center;
        }
        .bp-panel-token {
          display: flex; align-items: center; gap: 12px;
          padding-bottom: 16px; margin-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }
        .bp-panel-token-name { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }
        .bp-panel-token-sym { font-size: 12.5px; color: var(--text-muted); font-family: ui-monospace, "SF Mono", Menlo, monospace; }
        .bp-panel-current {
          background: var(--bg-secondary);
          border-radius: 10px; padding: 12px 14px;
          margin-bottom: 18px;
          display: flex; justify-content: space-between; align-items: baseline;
        }
        .bp-panel-current-label { font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .bp-panel-current-value { font-size: 18px; font-weight: 700; color: var(--boost); font-variant-numeric: tabular-nums; }
        .bp-panel-input-label {
          font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; display: block;
        }
        .bp-panel-input-wrap { position: relative; margin-bottom: 12px; }
        .bp-panel-input {
          width: 100%; padding: 14px 60px 14px 14px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 12px;
          color: var(--text-primary);
          font-size: 18px; font-weight: 600; font-family: inherit;
          outline: none; box-sizing: border-box;
          font-variant-numeric: tabular-nums;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .bp-panel-input:focus {
          border-color: var(--boost);
          box-shadow: 0 0 0 3px var(--boost-light);
        }
        .bp-panel-input-suffix {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          font-size: 14px; color: var(--text-muted); font-weight: 600;
        }
        .bp-quick {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
          margin-bottom: 16px;
        }
        .bp-quick button {
          padding: 8px 0;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 12.5px; font-weight: 600; color: var(--text-primary);
          font-family: inherit; cursor: pointer;
          transition: background 0.1s, border-color 0.1s;
        }
        .bp-quick button:hover { background: var(--bg-hover); border-color: var(--boost); }
        .bp-panel-submit {
          width: 100%; padding: 13px 0;
          background: var(--boost); color: #fff;
          border: none; border-radius: 12px;
          font-size: 15px; font-weight: 600; font-family: inherit;
          cursor: pointer;
          box-shadow: 0 2px 12px rgba(234,88,12,0.35);
          transition: background 0.15s;
        }
        .bp-panel-submit:hover { background: var(--boost-hover); }
        .bp-panel-trade {
          margin-top: 10px;
          display: block; text-align: center;
          padding: 11px 0;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 12px;
          font-size: 14px; font-weight: 600; color: var(--text-primary);
          text-decoration: none;
          transition: background 0.12s, border-color 0.12s;
        }
        .bp-panel-trade:hover { background: var(--bg-hover); border-color: var(--accent); }
        .bp-panel-close {
          display: block; width: 100%;
          margin-top: 10px;
          background: transparent; border: none;
          color: var(--text-muted); font-size: 13px;
          font-family: inherit; cursor: pointer;
        }
        .bp-panel-close:hover { color: var(--text-primary); }

        .bp-toast {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          background: var(--text-primary); color: var(--bg-primary);
          padding: 10px 18px; border-radius: 10px;
          font-size: 13.5px; font-weight: 500;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
          z-index: 500;
        }

        @media (max-width: 900px) {
          .bp-grid { grid-template-columns: 1fr; }
          .bp-panel { position: static; }
          .bp-summary { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 540px) {
          .bp-row { grid-template-columns: 32px 1fr auto; }
          .bp-row-action { display: none; }
          .bp-summary { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="bp-page">
        <PageShell>
        <div className="bp-wrap">
          <div className="bp-hero">
            <div>
              <h1><span className="bp-hero-flame">🔥</span> Boost</h1>
              <p>Pay APT to promote a token to the top of every page. Boost fees are pure advertising — no tokens are issued. Highest spend wins the slot.</p>
            </div>
          </div>

          <div className="bp-banner">
            <strong>Prototype mode.</strong> Boost contributions are stored locally on this device for testing. Real boosts will be on-chain in the next contract release.
          </div>

          <div className="bp-summary">
            <div className="bp-stat">
              <div className="bp-stat-label">Total boosted ({windowKey})</div>
              <div className="bp-stat-value">{formatApt(totalBoostedApt)}<span className="bp-stat-unit">APT</span></div>
            </div>
            <div className="bp-stat">
              <div className="bp-stat-label">Active tokens</div>
              <div className="bp-stat-value">{activeTokens}</div>
            </div>
            <div className="bp-stat">
              <div className="bp-stat-label">Leader</div>
              <div className="bp-stat-value" style={{ fontSize: 18 }}>
                {topThree[0] ? topThree[0].symbol : '—'}
              </div>
            </div>
          </div>

          <div className="bp-controls">
            <div className="bp-search-wrap">
              <span className="bp-search-icon">&#9906;</span>
              <input
                type="text"
                className="bp-search"
                placeholder="Search tokens by name or ticker…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <div className="bp-window">
              {(Object.keys(BOOST_WINDOWS) as BoostWindow[]).map(w => (
                <button
                  key={w}
                  className={windowKey === w ? 'active' : ''}
                  onClick={() => setWindowKey(w)}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div className="bp-grid">
            <div className="bp-list">
              {ranked.length === 0 ? (
                <div className="bp-empty-list">
                  No tokens boosted yet in this window. Be the first.
                </div>
              ) : (
                ranked.map((t, i) => {
                  const rankClass = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
                  const isSelected = t.metadataAddress === selectedAddr;
                  return (
                    <div
                      key={t.metadataAddress}
                      className={`bp-row ${rankClass}${isSelected ? ' selected' : ''}`}
                      onClick={() => selectToken(t.metadataAddress)}
                    >
                      <div className="bp-rank">{i + 1}</div>
                      <div className="bp-token-cell">
                        <div className="bp-token-icon">{(t.symbol || '?').replace(/^\$/, '').slice(0, 2).toUpperCase()}</div>
                        <div style={{ minWidth: 0 }}>
                          <div className="bp-token-name">{t.name}</div>
                          <div className="bp-token-symbol">{t.symbol}</div>
                        </div>
                      </div>
                      <div className="bp-row-apt">
                        {formatApt(t.boostApt)}<span className="bp-row-apt-unit">APT</span>
                      </div>
                      <div className="bp-row-action">
                        {isSelected ? 'Selected' : 'Boost'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="bp-panel">
              <div className="bp-panel-title">Boost a token</div>
              {!selected ? (
                <div className="bp-panel-empty">
                  Select a token from the leaderboard to add boost. New tokens can climb instantly.
                </div>
              ) : (
                <>
                  <div className="bp-panel-token">
                    <div className="bp-token-icon">{(selected.symbol || '?').replace(/^\$/, '').slice(0, 2).toUpperCase()}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="bp-panel-token-name">{selected.name}</div>
                      <div className="bp-panel-token-sym">{selected.symbol}</div>
                    </div>
                  </div>

                  <div className="bp-panel-current">
                    <span className="bp-panel-current-label">Current boost</span>
                    <span className="bp-panel-current-value">{formatApt(selected.boostApt)} APT</span>
                  </div>

                  <label className="bp-panel-input-label">Amount to add</label>
                  <div className="bp-panel-input-wrap">
                    <input
                      type="number"
                      className="bp-panel-input"
                      placeholder="0.00"
                      value={boostAmount}
                      onChange={e => setBoostAmount(e.target.value)}
                      min="0"
                      step="0.01"
                    />
                    <span className="bp-panel-input-suffix">APT</span>
                  </div>

                  <div className="bp-quick">
                    {[1, 5, 10, 50].map(v => (
                      <button key={v} type="button" onClick={() => setBoostAmount(String(v))}>
                        {v} APT
                      </button>
                    ))}
                  </div>

                  <button className="bp-panel-submit" onClick={handleBoost}>
                    Boost {selected.symbol}
                  </button>

                  <Link
                    to={`/newtoken/${selected.metadataAddress}`}
                    className="bp-panel-trade"
                  >
                    Trade this token →
                  </Link>
                  <button className="bp-panel-close" onClick={clearSelection}>
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {toast && <div className="bp-toast">{toast}</div>}
        </PageShell>
      </div>
    </>
  );
};

export default Boost;
