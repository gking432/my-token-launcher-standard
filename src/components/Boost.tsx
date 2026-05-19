import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import PageShell from './PageShell';
import TokenAvatar from './TokenAvatar';
import { useTokenData } from '../hooks/useTokenData';
import { useBoostData, addBoost, BOOST_WINDOWS, BoostWindow } from '../data/useBoostStore';

const TOP_N = 100;

const formatApt = (apt: number): string => {
  if (apt >= 1000) return `${(apt / 1000).toFixed(2)}k`;
  if (apt >= 100) return apt.toFixed(0);
  if (apt >= 10) return apt.toFixed(1);
  return apt.toFixed(2);
};

const MEDAL: Record<number, string> = { 0: '◆', 1: '◇', 2: '▸' };

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
          image: t.image,
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

  const leader = ranked[0] ?? null;
  const aptToTakeFirst = leader ? leader.boostApt + 0.01 : 0;

  const selected = useMemo(
    () => ranked.find(t => t.metadataAddress === selectedAddr) || null,
    [ranked, selectedAddr]
  );

  const aptToOvertake = useMemo(() => {
    if (!selected || !leader) return null;
    if (selected.metadataAddress === leader.metadataAddress) return null;
    return Math.max(0, leader.boostApt - selected.boostApt + 0.01);
  }, [selected, leader]);

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
        .bp-wrap { padding: 40px 40px 64px; }

        /* ── PAGE HEADER ── */
        .bp-header { margin-bottom: 28px; }
        .bp-header h1 {
          font-size: 36px; font-weight: 700; letter-spacing: -0.025em; margin: 0 0 8px;
          color: var(--text-primary);
        }
        .bp-header p { font-size: 15px; color: var(--text-secondary); margin: 0; max-width: 560px; }

        /* ── BENEFITS STRIP ── */
        .bp-perks {
          display: flex; gap: 10px; margin-bottom: 24px; flex-wrap: wrap;
        }
        .bp-perk {
          display: flex; align-items: center; gap: 8px;
          background: var(--bg-primary); border: 1px solid var(--border);
          border-radius: 10px; padding: 10px 14px;
          font-size: 13px; font-weight: 600; color: var(--text-secondary);
        }
        .bp-perk-icon {
          width: 24px; height: 24px; border-radius: 6px;
          background: var(--boost-light);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 800; color: var(--boost);
        }

        /* ── CHAMPION CARD ── */
        .bp-champion {
          position: relative;
          background: var(--bg-primary);
          border: 1.5px solid var(--boost);
          border-radius: 18px;
          padding: 24px 28px 20px;
          margin-bottom: 14px;
          box-shadow: 0 8px 32px rgba(234,88,12,0.16), 0 2px 8px rgba(234,88,12,0.08);
          overflow: hidden;
        }
        .bp-champion::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(234,88,12,0.07) 0%, transparent 55%);
          pointer-events: none;
        }
        .bp-champion-badge {
          position: absolute; top: -11px; left: 22px;
          background: var(--boost); color: #fff;
          font-size: 11px; font-weight: 800; letter-spacing: 0.1em;
          padding: 4px 12px; border-radius: 7px;
          text-transform: uppercase;
          box-shadow: 0 4px 12px rgba(234,88,12,0.45);
        }
        .bp-champion-body {
          display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
          position: relative;
        }
        .bp-champion-icon {
          width: 56px; height: 56px; border-radius: 14px;
          font-size: 18px; font-weight: 700;
          flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(0,0,0,0.18);
        }
        .bp-champion-text { flex: 1; min-width: 0; }
        .bp-champion-name {
          font-size: 22px; font-weight: 700; letter-spacing: -0.02em;
          color: var(--text-primary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .bp-champion-sym {
          font-size: 14px; color: var(--text-secondary); font-weight: 500;
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
          margin-top: 2px;
        }
        .bp-champion-spend {
          display: flex; flex-direction: column; align-items: flex-end;
        }
        .bp-champion-spend-label {
          font-size: 11px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .bp-champion-spend-value {
          font-size: 28px; font-weight: 700; color: var(--boost);
          letter-spacing: -0.02em; font-variant-numeric: tabular-nums;
          margin-top: 2px;
        }
        .bp-champion-spend-value span {
          font-size: 14px; color: var(--text-muted); font-weight: 600; margin-left: 4px;
        }
        .bp-champion-cta {
          background: var(--boost); color: #fff;
          border: none; border-radius: 11px;
          padding: 12px 22px;
          font-size: 14px; font-weight: 700; font-family: inherit;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(234,88,12,0.4);
          transition: background 0.15s, transform 0.1s;
          flex-shrink: 0;
        }
        .bp-champion-cta:hover { background: var(--boost-hover); transform: translateY(-1px); }
        .bp-champion-meta {
          display: flex; justify-content: space-between; align-items: center;
          margin-top: 16px; padding-top: 14px;
          border-top: 1px solid var(--border);
          font-size: 12.5px; color: var(--text-muted); font-weight: 500;
          position: relative;
        }
        .bp-champion-window { font-family: ui-monospace, "SF Mono", Menlo, monospace; }

        /* Empty state */
        .bp-champion-empty {
          border-color: var(--border);
          box-shadow: none;
        }
        .bp-champion-empty::before { display: none; }
        .bp-champion-empty .bp-champion-badge { background: var(--text-muted); box-shadow: none; }
        .bp-champion-placeholder {
          width: 56px; height: 56px; border-radius: 14px;
          background: var(--bg-secondary);
          border: 2px dashed var(--border);
          display: flex; align-items: center; justify-content: center;
          color: var(--text-muted); font-size: 22px; flex-shrink: 0;
        }

        .bp-protomsg {
          font-size: 12px; color: var(--text-muted);
          margin-bottom: 22px; text-align: center;
          font-style: italic;
        }

        /* ── PANEL OVERTAKE ── */
        .bp-panel-overtake {
          background: var(--boost-light);
          border: 1px solid var(--boost);
          border-radius: 10px;
          padding: 10px 14px;
          margin-bottom: 16px;
        }
        .bp-panel-overtake-label {
          font-size: 11px; font-weight: 700; color: var(--boost);
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;
        }
        .bp-panel-overtake-row {
          display: flex; align-items: center; justify-content: space-between;
        }
        .bp-panel-overtake-value {
          font-size: 18px; font-weight: 700; color: var(--boost);
          font-variant-numeric: tabular-nums;
        }
        .bp-panel-overtake-btn {
          background: var(--boost); color: #fff;
          border: none; border-radius: 7px;
          padding: 5px 12px; font-size: 12px; font-weight: 700;
          cursor: pointer; font-family: inherit;
        }
        .bp-panel-overtake-btn:hover { background: var(--boost-hover); }

        /* ── STATS ── */
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

        /* ── CONTROLS ── */
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

        /* ── MAIN GRID ── */
        .bp-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
          gap: 20px;
          align-items: flex-start;
        }

        /* ── LEADERBOARD ── */
        .bp-list {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
        }
        .bp-list-header {
          display: grid;
          grid-template-columns: 44px 1fr 90px 110px;
          align-items: center;
          padding: 10px 18px;
          border-bottom: 1px solid var(--border);
          background: var(--bg-secondary);
        }
        .bp-list-col {
          font-size: 11px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .bp-list-col:nth-child(3) { text-align: right; }
        .bp-list-col:nth-child(4) { text-align: right; }

        .bp-row {
          position: relative;
          display: grid;
          grid-template-columns: 44px 1fr 90px 110px;
          align-items: center; gap: 0;
          padding: 13px 18px;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          text-decoration: none; color: inherit;
          transition: background 0.12s;
          overflow: hidden;
        }
        .bp-row:last-child { border-bottom: none; }
        .bp-row:hover { background: var(--bg-secondary); }
        .bp-row.selected { background: var(--boost-light); }
        .bp-row.selected:hover { background: var(--boost-light); }

        /* Race bar that fills behind the row */
        .bp-row-track {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          background: rgba(234,88,12,0.055);
          pointer-events: none;
          transition: width 0.5s cubic-bezier(0.4,0,0.2,1);
          border-right: 2px solid rgba(234,88,12,0.18);
        }
        .bp-row.r1 .bp-row-track {
          background: rgba(198,153,0,0.09);
          border-right-color: rgba(198,153,0,0.22);
        }
        .bp-row.r2 .bp-row-track {
          background: rgba(110,110,115,0.07);
          border-right-color: rgba(110,110,115,0.18);
        }
        .bp-row.r3 .bp-row-track {
          background: rgba(183,106,37,0.07);
          border-right-color: rgba(183,106,37,0.18);
        }

        .bp-rank {
          font-size: 15px; font-weight: 700; color: var(--text-muted);
          font-variant-numeric: tabular-nums;
          text-align: center;
          position: relative;
        }
        .bp-row.r1 .bp-rank { color: #c69900; font-size: 16px; }
        .bp-row.r2 .bp-rank { color: #6e6e73; }
        .bp-row.r3 .bp-rank { color: #b76a25; }

        .bp-token-cell { display: flex; align-items: center; gap: 12px; min-width: 0; position: relative; }
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

        /* Gap-to-leader column */
        .bp-row-gap {
          text-align: right; font-size: 12px; font-weight: 600;
          position: relative;
        }
        .bp-row-gap-leader {
          color: var(--boost); font-size: 11px; font-weight: 800;
          letter-spacing: 0.06em; text-transform: uppercase;
          background: var(--boost-light); padding: 3px 7px;
          border-radius: 5px; display: inline-block;
        }
        .bp-row-gap-behind {
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
        }
        .bp-row-gap-behind strong {
          color: var(--text-secondary); font-weight: 700;
          font-size: 12.5px;
        }

        /* APT column */
        .bp-row-apt-col {
          text-align: right;
          display: flex; align-items: center; justify-content: flex-end; gap: 8px;
          position: relative;
        }
        .bp-row-apt {
          font-size: 15px; font-weight: 700; color: var(--boost);
          font-variant-numeric: tabular-nums;
        }
        .bp-row-apt-unit { font-size: 11.5px; color: var(--text-muted); font-weight: 600; margin-left: 2px; }
        .bp-row-action {
          font-size: 12px; font-weight: 600; color: var(--text-muted);
          padding: 5px 10px; border-radius: 7px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          white-space: nowrap;
        }
        .bp-row.selected .bp-row-action {
          background: var(--boost); color: #fff; border-color: var(--boost);
        }
        .bp-row-apt-zero { color: var(--text-muted) !important; }

        .bp-empty-list {
          padding: 60px 24px; text-align: center; color: var(--text-muted);
          font-size: 14px;
        }
        .bp-empty-list strong { display: block; color: var(--text-secondary); font-size: 15px; margin-bottom: 6px; }

        /* ── PANEL ── */
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

        /* ── TOAST ── */
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
          .bp-list-header { display: none; }
          .bp-row { grid-template-columns: 44px 1fr auto; }
          .bp-row-gap { display: none; }
        }
        @media (max-width: 640px) {
          .bp-wrap { padding: 28px 18px 48px; }
          .bp-champion { padding: 22px 18px 16px; }
          .bp-champion-body { gap: 14px; }
          .bp-champion-spend { align-items: flex-start; }
          .bp-champion-cta { width: 100%; text-align: center; }
          .bp-champion-meta { flex-direction: column; gap: 4px; align-items: flex-start; }
          .bp-perks { gap: 8px; }
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

          {/* ── PAGE HEADER ── */}
          <div className="bp-header">
            <h1>Boost Competition</h1>
            <p>Pay APT to claim the top slot — pinned on the marketplace, featured above every page. Highest spend in the window wins. Dethrone the leader to take the crown.</p>
          </div>

          {/* ── WHAT #1 GETS YOU ── */}
          <div className="bp-perks">
            <div className="bp-perk">
              <span className="bp-perk-icon">1</span>
              Pinned #1 on Marketplace
            </div>
            <div className="bp-perk">
              <span className="bp-perk-icon">◆</span>
              Featured in Boost Bar
            </div>
            <div className="bp-perk">
              <span className="bp-perk-icon">↑</span>
              Top of all token lists
            </div>
          </div>

          {/* ── CHAMPION CARD ── */}
          {leader ? (
            <div className="bp-champion">
              <div className="bp-champion-badge">Champion · {windowKey}</div>
              <div className="bp-champion-body">
                <TokenAvatar image={leader.image} symbol={leader.symbol} className="bp-champion-icon" />
                <div className="bp-champion-text">
                  <div className="bp-champion-name">{leader.name}</div>
                  <div className="bp-champion-sym">{leader.symbol}</div>
                </div>
                <div className="bp-champion-spend">
                  <div className="bp-champion-spend-label">Lead boost</div>
                  <div className="bp-champion-spend-value">{formatApt(leader.boostApt)} <span>APT</span></div>
                </div>
                <button
                  className="bp-champion-cta"
                  onClick={() => {
                    selectToken(leader.metadataAddress);
                    setBoostAmount(aptToTakeFirst.toFixed(2));
                  }}
                >
                  Dethrone for {aptToTakeFirst.toFixed(2)} APT
                </button>
              </div>
              <div className="bp-champion-meta">
                <span>{formatApt(totalBoostedApt)} APT contested · {activeTokens} active token{activeTokens !== 1 ? 's' : ''}</span>
                <span className="bp-champion-window">rolling {windowKey} window</span>
              </div>
            </div>
          ) : (
            <div className="bp-champion bp-champion-empty">
              <div className="bp-champion-badge">No champion yet</div>
              <div className="bp-champion-body">
                <div className="bp-champion-placeholder">?</div>
                <div className="bp-champion-text">
                  <div className="bp-champion-name">The throne is open.</div>
                  <div className="bp-champion-sym">First boost in the {windowKey} window takes #1.</div>
                </div>
              </div>
            </div>
          )}

          <div className="bp-protomsg">
            Prototype mode — boosts cached locally. On-chain boost moves in the next release.
          </div>

          {/* ── STATS ── */}
          <div className="bp-summary">
            <div className="bp-stat">
              <div className="bp-stat-label">Total boosted</div>
              <div className="bp-stat-value">{formatApt(totalBoostedApt)}<span className="bp-stat-unit">APT</span></div>
            </div>
            <div className="bp-stat">
              <div className="bp-stat-label">Competitors</div>
              <div className="bp-stat-value">{activeTokens}</div>
            </div>
            <div className="bp-stat">
              <div className="bp-stat-label">Window</div>
              <div className="bp-stat-value">{windowKey}</div>
            </div>
          </div>

          {/* ── CONTROLS ── */}
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

          {/* ── LEADERBOARD + PANEL ── */}
          <div className="bp-grid">
            <div className="bp-list">
              <div className="bp-list-header">
                <div className="bp-list-col">#</div>
                <div className="bp-list-col">Token</div>
                <div className="bp-list-col">Gap</div>
                <div className="bp-list-col">Boost</div>
              </div>
              {ranked.length === 0 ? (
                <div className="bp-empty-list">
                  <strong>No tokens boosted yet</strong>
                  Select any token and add the first boost to claim the throne.
                </div>
              ) : (
                ranked.map((t, i) => {
                  const rankClass = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
                  const isSelected = t.metadataAddress === selectedAddr;
                  const leaderApt = leader?.boostApt ?? 0;
                  const barWidth = leaderApt > 0 ? (t.boostApt / leaderApt) * 100 : 0;
                  const gapToLeader = i === 0 ? 0 : leaderApt - t.boostApt;
                  return (
                    <div
                      key={t.metadataAddress}
                      className={`bp-row ${rankClass}${isSelected ? ' selected' : ''}`}
                      onClick={() => selectToken(t.metadataAddress)}
                    >
                      {t.boostApt > 0 && (
                        <div className="bp-row-track" style={{ width: `${barWidth}%` }} />
                      )}
                      <div className="bp-rank">
                        {MEDAL[i] ?? i + 1}
                      </div>
                      <div className="bp-token-cell">
                        <TokenAvatar image={t.image} symbol={t.symbol} className="bp-token-icon" />
                        <div style={{ minWidth: 0 }}>
                          <div className="bp-token-name">{t.name}</div>
                          <div className="bp-token-symbol">{t.symbol}</div>
                        </div>
                      </div>
                      <div className="bp-row-gap">
                        {i === 0 ? (
                          <span className="bp-row-gap-leader">Leader</span>
                        ) : t.boostApt > 0 ? (
                          <span className="bp-row-gap-behind">
                            −<strong>{formatApt(gapToLeader)}</strong> APT
                          </span>
                        ) : (
                          <span className="bp-row-gap-behind">—</span>
                        )}
                      </div>
                      <div className="bp-row-apt-col">
                        <div>
                          <span className={`bp-row-apt${t.boostApt === 0 ? ' bp-row-apt-zero' : ''}`}>
                            {t.boostApt > 0 ? formatApt(t.boostApt) : '0.00'}
                          </span>
                          <span className="bp-row-apt-unit">APT</span>
                        </div>
                        <div className="bp-row-action">
                          {isSelected ? 'Selected' : 'Boost'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ── RIGHT PANEL ── */}
            <div className="bp-panel">
              <div className="bp-panel-title">Boost a token</div>
              {!selected ? (
                <div className="bp-panel-empty">
                  Select a token from the leaderboard to add boost. New tokens can climb instantly.
                </div>
              ) : (
                <>
                  <div className="bp-panel-token">
                    <TokenAvatar image={selected.image} symbol={selected.symbol} className="bp-token-icon" />
                    <div style={{ minWidth: 0 }}>
                      <div className="bp-panel-token-name">{selected.name}</div>
                      <div className="bp-panel-token-sym">{selected.symbol}</div>
                    </div>
                  </div>

                  {aptToOvertake != null && (
                    <div className="bp-panel-overtake">
                      <div className="bp-panel-overtake-label">To overtake #1 ({leader?.symbol})</div>
                      <div className="bp-panel-overtake-row">
                        <span className="bp-panel-overtake-value">{aptToOvertake.toFixed(2)} APT</span>
                        <button
                          className="bp-panel-overtake-btn"
                          onClick={() => setBoostAmount(aptToOvertake.toFixed(2))}
                        >Fill</button>
                      </div>
                    </div>
                  )}

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
