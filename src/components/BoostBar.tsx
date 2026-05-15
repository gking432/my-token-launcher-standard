import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTokenData } from '../hooks/useTokenData';
import { useTokenList } from '../data/useTokenList';

// Top-10 leaderboard strip that sits below AppHeader on every page.
// Ranks by total APT raised (cumulative) as a prototype proxy for "APT raised
// in the last N hours". When we have a server-side windowed endpoint, swap the
// sort source here without touching the UI.

const REFRESH_INTERVAL_MS = 60_000;
const TOP_N = 10;

const formatApt = (apt: number): string => {
  if (apt >= 1000) return `${(apt / 1000).toFixed(2)}k APT`;
  if (apt >= 100) return `${apt.toFixed(0)} APT`;
  if (apt >= 10) return `${apt.toFixed(1)} APT`;
  return `${apt.toFixed(2)} APT`;
};

const BoostBar: React.FC = () => {
  const { tokens: catalogTokens } = useTokenData();
  const addrs = useMemo(
    () => catalogTokens.map(t => t.metadataAddress || t.txHash).filter(Boolean) as string[],
    [catalogTokens]
  );
  const { data: liveByAddr, refetch } = useTokenList(addrs);

  const [secondsToRefresh, setSecondsToRefresh] = useState(REFRESH_INTERVAL_MS / 1000);

  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsToRefresh(s => {
        if (s <= 1) {
          refetch();
          return REFRESH_INTERVAL_MS / 1000;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [refetch]);

  const top = useMemo(() => {
    if (!liveByAddr) return [];
    return catalogTokens
      .map(t => {
        const live = liveByAddr[(t.metadataAddress || '').toLowerCase()];
        return {
          name: t.name,
          symbol: t.symbol,
          metadataAddress: t.metadataAddress || t.txHash,
          aptRaised: live?.aptRaised ?? 0,
        };
      })
      .filter(t => t.aptRaised > 0 && t.metadataAddress)
      .sort((a, b) => b.aptRaised - a.aptRaised)
      .slice(0, TOP_N);
  }, [catalogTokens, liveByAddr]);

  if (top.length === 0) return null;

  return (
    <>
      <style>{`
        .bb-bar {
          position: sticky; top: 60px; z-index: 199;
          background: var(--bg-primary);
          border-bottom: 1px solid var(--border);
          height: 44px;
          display: flex; align-items: center;
          overflow: hidden;
        }
        .bb-inner {
          max-width: 1280px; width: 100%; margin: 0 auto;
          padding: 0 24px;
          display: flex; align-items: center; gap: 12px;
          height: 100%;
        }
        .bb-label {
          display: flex; align-items: center; gap: 7px;
          font-size: 11.5px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.08em;
          flex-shrink: 0;
        }
        .bb-pulse {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--positive);
          box-shadow: 0 0 0 0 var(--positive);
          animation: bb-pulse 1.6s ease-out infinite;
        }
        @keyframes bb-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(5,150,105,0.55); }
          70%  { box-shadow: 0 0 0 6px rgba(5,150,105,0); }
          100% { box-shadow: 0 0 0 0 rgba(5,150,105,0); }
        }
        .bb-track {
          flex: 1; min-width: 0;
          display: flex; gap: 6px;
          overflow-x: auto; overflow-y: hidden;
          scrollbar-width: none;
          mask-image: linear-gradient(90deg, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%);
          -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%);
        }
        .bb-track::-webkit-scrollbar { display: none; }
        .bb-chip {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 12px 6px 8px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 999px;
          color: var(--text-primary); text-decoration: none;
          font-size: 12.5px; font-weight: 600;
          white-space: nowrap; flex-shrink: 0;
          transition: background 0.12s, border-color 0.12s, transform 0.08s;
          font-variant-numeric: tabular-nums;
        }
        .bb-chip:hover {
          background: var(--bg-hover);
          border-color: var(--accent);
          transform: translateY(-1px);
        }
        .bb-rank {
          display: inline-flex; align-items: center; justify-content: center;
          width: 20px; height: 20px; border-radius: 50%;
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          font-size: 10.5px; font-weight: 800;
        }
        .bb-chip.gold .bb-rank { background: #ffd700; color: #5a4500; }
        .bb-chip.silver .bb-rank { background: #c0c0c8; color: #36363c; }
        .bb-chip.bronze .bb-rank { background: #cd7f32; color: #fff; }
        .bb-sym {
          font-weight: 700; color: var(--text-primary);
        }
        .bb-apt {
          color: var(--accent); font-weight: 700;
        }
        .bb-countdown {
          flex-shrink: 0; font-size: 11px; color: var(--text-muted);
          font-variant-numeric: tabular-nums;
          padding-left: 8px; border-left: 1px solid var(--border);
          font-weight: 600;
        }
        @media (max-width: 680px) {
          .bb-label { display: none; }
          .bb-countdown { display: none; }
        }
      `}</style>
      <div className="bb-bar">
        <div className="bb-inner">
          <div className="bb-label">
            <span className="bb-pulse" />
            Boost · Top {top.length}
          </div>
          <div className="bb-track">
            {top.map((t, i) => {
              const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
              return (
                <Link
                  key={t.metadataAddress}
                  to={`/newtoken/${t.metadataAddress}`}
                  className={`bb-chip ${rankClass}`}
                  title={`${t.name} · ${t.aptRaised.toFixed(2)} APT raised`}
                >
                  <span className="bb-rank">{i + 1}</span>
                  <span className="bb-sym">{t.symbol}</span>
                  <span className="bb-apt">{formatApt(t.aptRaised)}</span>
                </Link>
              );
            })}
          </div>
          <div className="bb-countdown">{secondsToRefresh}s</div>
        </div>
      </div>
    </>
  );
};

export default BoostBar;
