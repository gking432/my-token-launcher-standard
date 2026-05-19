import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTokenData } from '../hooks/useTokenData';
import { useBoostData, BOOST_WINDOWS } from '../data/useBoostStore';

// Top-10 leaderboard strip that sits below AppHeader on every page.
// Ranks by APT spent on boost (advertising fees, no tokens received) within
// the configured window. Currently localStorage-backed; will move to on-chain
// data once the boost entry function exists in the contract.

const TOP_N = 10;
const WINDOW_MS = BOOST_WINDOWS['24h'];
const BAR_HEIGHT_PX = 44;
const HEADER_HEIGHT_PX = 60;

const formatApt = (apt: number): string => {
  if (apt >= 1000) return `${(apt / 1000).toFixed(2)}k`;
  if (apt >= 100) return `${apt.toFixed(0)}`;
  if (apt >= 10) return `${apt.toFixed(1)}`;
  return apt.toFixed(2);
};

const BoostBar: React.FC = () => {
  const { tokens: catalogTokens } = useTokenData();
  const boostMap = useBoostData(WINDOW_MS);

  const top = useMemo(() => {
    return catalogTokens
      .map(t => {
        const addr = (t.metadataAddress || t.txHash || '').toLowerCase();
        return {
          name: t.name,
          symbol: t.symbol,
          metadataAddress: t.metadataAddress || t.txHash,
          boostApt: boostMap[addr] ?? 0,
        };
      })
      .filter(t => t.boostApt > 0 && t.metadataAddress)
      .sort((a, b) => b.boostApt - a.boostApt)
      .slice(0, TOP_N);
  }, [catalogTokens, boostMap]);

  // Expose stack height so sticky elements below can position correctly
  // regardless of whether the bar is rendered.
  useEffect(() => {
    const offset = top.length === 0
      ? `${HEADER_HEIGHT_PX}px`
      : `${HEADER_HEIGHT_PX + BAR_HEIGHT_PX}px`;
    document.documentElement.style.setProperty('--mm-header-offset', offset);
    return () => {
      document.documentElement.style.setProperty('--mm-header-offset', `${HEADER_HEIGHT_PX}px`);
    };
  }, [top.length]);

  if (top.length === 0) return null;

  return (
    <>
      <style>{`
        .bb-bar {
          position: sticky; top: 60px; z-index: 199;
          background: var(--bg-primary);
          border-bottom: 1px solid var(--border);
          height: ${BAR_HEIGHT_PX}px;
          display: flex; align-items: center;
          overflow: hidden;
        }
        .bb-inner {
          width: 100%;
          padding: 0 24px;
          display: flex; align-items: center; gap: 12px;
          height: 100%;
        }
        .bb-label {
          display: flex; align-items: center; gap: 7px;
          font-size: 11.5px; font-weight: 800; color: var(--boost);
          text-transform: uppercase; letter-spacing: 0.08em;
          flex-shrink: 0;
        }
        .bb-pulse {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--boost);
          box-shadow: 0 0 0 0 var(--boost);
          animation: bb-pulse 1.6s ease-out infinite;
        }
        @keyframes bb-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(234,88,12,0.55); }
          70%  { box-shadow: 0 0 0 6px rgba(234,88,12,0); }
          100% { box-shadow: 0 0 0 0 rgba(234,88,12,0); }
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
          border-color: var(--boost);
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
        .bb-sym { font-weight: 700; color: var(--text-primary); }
        .bb-apt { color: var(--boost); font-weight: 700; }
        .bb-apt-unit {
          font-size: 10.5px; color: var(--text-muted); font-weight: 600; margin-left: 2px;
        }
        @media (max-width: 680px) {
          .bb-label { display: none; }
        }
      `}</style>
      <div className="bb-bar">
        <div className="bb-inner">
          <div className="bb-label">
            <span className="bb-pulse" />
            🔥 Boost · Top {top.length}
          </div>
          <div className="bb-track">
            {top.map((t, i) => {
              const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
              return (
                <Link
                  key={t.metadataAddress}
                  to={`/newtoken/${t.metadataAddress}`}
                  className={`bb-chip ${rankClass}`}
                  title={`${t.name} · ${t.boostApt.toFixed(2)} APT boosted`}
                >
                  <span className="bb-rank">{i + 1}</span>
                  <span className="bb-sym">{t.symbol}</span>
                  <span className="bb-apt">{formatApt(t.boostApt)}<span className="bb-apt-unit">APT</span></span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default BoostBar;
