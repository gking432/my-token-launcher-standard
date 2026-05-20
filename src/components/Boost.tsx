import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import PageShell from './PageShell';
import TokenAvatar from './TokenAvatar';
import { useTokenData } from '../hooks/useTokenData';
import { useBoostData, addBoost, BOOST_WINDOWS, BoostWindow } from '../data/useBoostStore';
import { useDominantColor } from '../lib/useDominantColor';

const TOP_N = 100;

// Length of a "spotlight round". When it ends, whoever sits at #1 is crowned
// for that round and the timer rolls over — this drives the urgency countdown.
const EPOCH_MS = 2 * 60 * 1000;

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
  const [now, setNow] = useState(() => Date.now());

  const boostMap = useBoostData(BOOST_WINDOWS[windowKey]);

  const selectedAddr = (searchParams.get('token') || '').toLowerCase();

  // Drive the countdown. Tick fast so the final 10s reads smoothly.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

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

  // The champion is the top token *with* an active boost — never a 0-boost row.
  const leader = ranked.length > 0 && ranked[0].boostApt > 0 ? ranked[0] : null;
  const aptToTakeFirst = leader ? leader.boostApt + 0.01 : 0;

  const palette = useDominantColor(leader?.image, leader?.symbol ?? '');

  const challengers = useMemo(
    () => ranked.slice(leader ? 1 : 0),
    [ranked, leader]
  );

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

  // ── Countdown ──
  const epochEnd = Math.ceil(now / EPOCH_MS) * EPOCH_MS;
  const remainingSec = Math.max(0, Math.ceil((epochEnd - now) / 1000));
  const mm = Math.floor(remainingSec / 60);
  const ss = remainingSec % 60;
  const countdownLabel = `${mm}:${String(ss).padStart(2, '0')}`;
  const urgent = remainingSec <= 10;

  return (
    <>
      <style>{`
        .bp-page {
          min-height: 100vh;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
        }
        .bp-wrap { padding: 40px 40px 64px; max-width: 1180px; margin: 0 auto; }

        /* ── HEADER ── */
        .bp-header { margin-bottom: 22px; }
        .bp-header h1 {
          font-size: 34px; font-weight: 700; letter-spacing: -0.03em; margin: 0 0 6px;
          color: var(--text-primary);
        }
        .bp-header p { font-size: 15px; color: var(--text-secondary); margin: 0; max-width: 600px; line-height: 1.5; }

        /* ── CHAMPION HERO (Twitter-profile style) ── */
        .bp-hero {
          position: relative;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 22px;
          overflow: hidden;
          margin-bottom: 14px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.10);
          transition: box-shadow 0.4s;
        }
        .bp-hero.urgent {
          box-shadow: 0 0 0 2px rgba(255,59,48,0.55), 0 14px 48px rgba(255,59,48,0.22);
        }

        .bp-hero-banner {
          position: relative;
          height: 172px;
        }
        .bp-hero-banner-glow {
          position: absolute; inset: 0; pointer-events: none;
        }
        .bp-hero-banner-grid {
          position: absolute; inset: 0; pointer-events: none;
          background-image: radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px);
          background-size: 22px 22px;
          -webkit-mask-image: linear-gradient(120deg, #000 0%, transparent 70%);
          mask-image: linear-gradient(120deg, #000 0%, transparent 70%);
        }
        .bp-hero-badge {
          position: absolute; top: 18px; left: 22px; z-index: 2;
          display: inline-flex; align-items: center; gap: 7px;
          background: rgba(0,0,0,0.28);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          color: #fff;
          font-size: 11px; font-weight: 800; letter-spacing: 0.12em;
          padding: 6px 13px; border-radius: 999px;
          text-transform: uppercase;
          border: 1px solid rgba(255,255,255,0.25);
        }
        .bp-hero-badge-dot {
          width: 6px; height: 6px; border-radius: 50%; background: #fff;
          box-shadow: 0 0 0 0 rgba(255,255,255,0.7);
          animation: bp-dot 1.8s infinite;
        }
        @keyframes bp-dot {
          0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.6); }
          70% { box-shadow: 0 0 0 7px rgba(255,255,255,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
        }

        /* Countdown — lives over the banner, scales up dramatically under 10s */
        .bp-hero-countdown {
          position: absolute; right: 26px; top: 50%; transform: translateY(-50%);
          z-index: 2; text-align: right; color: #fff;
        }
        .bp-hero-countdown-label {
          font-size: 11px; font-weight: 800; letter-spacing: 0.14em;
          text-transform: uppercase; opacity: 0.9; margin-bottom: 4px;
          text-shadow: 0 1px 6px rgba(0,0,0,0.3);
        }
        .bp-hero-countdown-time {
          font-size: 42px; font-weight: 800; line-height: 1;
          font-variant-numeric: tabular-nums; letter-spacing: -0.03em;
          text-shadow: 0 2px 14px rgba(0,0,0,0.28);
          transition: font-size 0.3s cubic-bezier(0.34,1.56,0.64,1), color 0.3s;
        }
        .bp-hero-countdown.is-urgent .bp-hero-countdown-time {
          font-size: 96px;
          animation: bp-cd-pulse 1s ease-in-out infinite;
          text-shadow: 0 0 34px rgba(255,255,255,0.6), 0 2px 14px rgba(0,0,0,0.35);
        }
        .bp-hero-countdown.is-urgent .bp-hero-countdown-label { opacity: 1; }
        @keyframes bp-cd-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }

        /* Body */
        .bp-hero-body { position: relative; padding: 16px 28px 24px; }
        .bp-hero-avatar {
          position: absolute; left: 28px; top: -58px;
          width: 116px; height: 116px; border-radius: 28px;
          border: 5px solid var(--bg-primary);
          box-shadow: 0 10px 30px rgba(0,0,0,0.28);
          font-size: 34px; font-weight: 800; color: #fff;
          z-index: 3;
        }
        .bp-hero-identity { padding-top: 66px; }
        .bp-hero-name {
          font-size: 26px; font-weight: 800; letter-spacing: -0.025em;
          color: var(--text-primary); line-height: 1.1;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .bp-hero-sym {
          font-size: 14px; color: var(--text-muted); font-weight: 600;
          font-family: ui-monospace, "SF Mono", Menlo, monospace; margin-top: 3px;
        }

        .bp-hero-row {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 20px; flex-wrap: wrap; margin-top: 18px;
        }
        .bp-hero-stat-label {
          font-size: 11px; font-weight: 800; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;
        }
        .bp-hero-stat-value {
          font-size: 34px; font-weight: 800; color: var(--boost);
          letter-spacing: -0.025em; font-variant-numeric: tabular-nums; line-height: 1;
        }
        .bp-hero-stat-value span { font-size: 15px; color: var(--text-muted); font-weight: 700; margin-left: 5px; }
        .bp-hero-actions { display: flex; gap: 10px; align-items: center; }
        .bp-hero-cta {
          background: var(--boost); color: #fff;
          border: none; border-radius: 13px;
          padding: 14px 24px;
          font-size: 14.5px; font-weight: 800; font-family: inherit;
          cursor: pointer;
          box-shadow: 0 6px 20px rgba(234,88,12,0.4);
          transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
        }
        .bp-hero-cta:hover { background: var(--boost-hover); transform: translateY(-1px); box-shadow: 0 8px 26px rgba(234,88,12,0.5); }
        .bp-hero-trade {
          padding: 14px 18px; border-radius: 13px;
          background: var(--bg-secondary); border: 1px solid var(--border);
          color: var(--text-primary); font-size: 14px; font-weight: 700;
          text-decoration: none; transition: background 0.12s, border-color 0.12s;
        }
        .bp-hero-trade:hover { background: var(--bg-hover); border-color: var(--accent); }
        .bp-hero-meta {
          margin-top: 18px; padding-top: 14px;
          border-top: 1px solid var(--border);
          font-size: 12.5px; color: var(--text-muted); font-weight: 600;
          font-variant-numeric: tabular-nums;
        }

        /* Empty throne */
        .bp-hero-empty .bp-hero-banner { background: linear-gradient(135deg, var(--bg-tertiary), var(--bg-hover)); }
        .bp-hero-empty .bp-hero-avatar {
          background: var(--bg-secondary);
          border-style: dashed; border-color: var(--border);
          display: flex; align-items: center; justify-content: center;
          color: var(--text-muted); font-size: 40px; box-shadow: none;
        }
        .bp-hero-empty-cta {
          margin-top: 18px;
          display: inline-block;
          background: var(--boost); color: #fff;
          border-radius: 12px; padding: 12px 20px;
          font-size: 14px; font-weight: 700; text-decoration: none; border: none;
          cursor: pointer; font-family: inherit;
        }

        /* ── PERKS ── */
        .bp-perks { display: flex; gap: 10px; margin: 16px 0 8px; flex-wrap: wrap; }
        .bp-perk {
          display: flex; align-items: center; gap: 8px;
          background: var(--bg-primary); border: 1px solid var(--border);
          border-radius: 10px; padding: 9px 13px;
          font-size: 12.5px; font-weight: 600; color: var(--text-secondary);
        }
        .bp-perk-icon {
          width: 22px; height: 22px; border-radius: 6px;
          background: var(--boost-light);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 800; color: var(--boost);
        }

        .bp-protomsg {
          font-size: 12px; color: var(--text-muted);
          margin: 14px 0 22px; text-align: center; font-style: italic;
        }

        /* ── PANEL OVERTAKE ── */
        .bp-panel-overtake {
          background: var(--boost-light); border: 1px solid var(--boost);
          border-radius: 10px; padding: 10px 14px; margin-bottom: 16px;
        }
        .bp-panel-overtake-label {
          font-size: 11px; font-weight: 700; color: var(--boost);
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;
        }
        .bp-panel-overtake-row { display: flex; align-items: center; justify-content: space-between; }
        .bp-panel-overtake-value { font-size: 18px; font-weight: 700; color: var(--boost); font-variant-numeric: tabular-nums; }
        .bp-panel-overtake-btn {
          background: var(--boost); color: #fff; border: none; border-radius: 7px;
          padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit;
        }
        .bp-panel-overtake-btn:hover { background: var(--boost-hover); }

        /* ── CONTROLS ── */
        .bp-controls { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
        .bp-search {
          flex: 1; min-width: 220px; height: 38px; padding: 0 14px 0 36px;
          background: var(--bg-primary); border: 1px solid var(--border); border-radius: 10px;
          color: var(--text-primary); font-size: 14px; font-family: inherit; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .bp-search:focus { border-color: var(--boost); box-shadow: 0 0 0 3px var(--boost-light); }
        .bp-search-wrap { position: relative; flex: 1; min-width: 220px; }
        .bp-search-icon {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          font-size: 14px; color: var(--text-muted); pointer-events: none;
        }
        .bp-window {
          display: flex; gap: 0; background: var(--bg-primary);
          border: 1px solid var(--border); border-radius: 10px; padding: 3px;
        }
        .bp-window button {
          padding: 6px 14px; background: transparent; border: none; cursor: pointer;
          color: var(--text-secondary); font-size: 13px; font-weight: 600; font-family: inherit;
          border-radius: 7px; transition: background 0.12s, color 0.12s;
        }
        .bp-window button.active { background: var(--bg-tertiary); color: var(--text-primary); }
        .bp-window button:hover:not(.active) { color: var(--text-primary); }

        /* ── GRID ── */
        .bp-grid {
          display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
          gap: 20px; align-items: flex-start;
        }
        .bp-list { background: var(--bg-primary); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
        .bp-list-head {
          display: grid; grid-template-columns: 44px 1fr 96px 116px;
          align-items: center; padding: 11px 18px;
          border-bottom: 1px solid var(--border); background: var(--bg-secondary);
        }
        .bp-list-head > div {
          font-size: 11px; font-weight: 800; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .bp-list-head > div:nth-child(3), .bp-list-head > div:nth-child(4) { text-align: right; }

        .bp-row {
          position: relative;
          display: grid; grid-template-columns: 44px 1fr 96px 116px;
          align-items: center; padding: 13px 18px;
          border-bottom: 1px solid var(--border);
          cursor: pointer; text-decoration: none; color: inherit;
          transition: background 0.12s; overflow: hidden;
        }
        .bp-row:last-child { border-bottom: none; }
        .bp-row:hover { background: var(--bg-secondary); }
        .bp-row.selected, .bp-row.selected:hover { background: var(--boost-light); }
        .bp-row-track {
          position: absolute; left: 0; top: 0; bottom: 0;
          background: rgba(234,88,12,0.06); pointer-events: none;
          border-right: 2px solid rgba(234,88,12,0.18);
          transition: width 0.5s cubic-bezier(0.4,0,0.2,1);
        }
        .bp-row.r2 .bp-row-track { background: rgba(110,110,115,0.07); border-right-color: rgba(110,110,115,0.18); }
        .bp-row.r3 .bp-row-track { background: rgba(183,106,37,0.07); border-right-color: rgba(183,106,37,0.18); }
        .bp-rank {
          font-size: 15px; font-weight: 700; color: var(--text-muted);
          font-variant-numeric: tabular-nums; text-align: center; position: relative;
        }
        .bp-row.r2 .bp-rank { color: #6e6e73; }
        .bp-row.r3 .bp-rank { color: #b76a25; }
        .bp-token-cell { display: flex; align-items: center; gap: 12px; min-width: 0; position: relative; }
        .bp-token-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg, var(--bg-tertiary), var(--bg-hover));
          display: flex; align-items: center; justify-content: center;
          color: var(--text-primary); font-size: 12.5px; font-weight: 700; flex-shrink: 0;
        }
        .bp-token-name { font-size: 14px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bp-token-symbol { font-size: 12px; color: var(--text-muted); font-weight: 500; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
        .bp-row-gap { text-align: right; font-size: 12px; position: relative; }
        .bp-row-gap-behind { color: var(--text-muted); font-variant-numeric: tabular-nums; }
        .bp-row-gap-behind strong { color: var(--text-secondary); font-weight: 700; font-size: 12.5px; }
        .bp-row-apt-col {
          text-align: right; display: flex; align-items: center; justify-content: flex-end;
          gap: 8px; position: relative;
        }
        .bp-row-apt { font-size: 15px; font-weight: 700; color: var(--boost); font-variant-numeric: tabular-nums; }
        .bp-row-apt.zero { color: var(--text-muted); }
        .bp-row-apt-unit { font-size: 11.5px; color: var(--text-muted); font-weight: 600; margin-left: 2px; }
        .bp-row-action {
          font-size: 12px; font-weight: 600; color: var(--text-muted);
          padding: 5px 10px; border-radius: 7px; white-space: nowrap;
          background: var(--bg-secondary); border: 1px solid var(--border);
        }
        .bp-row.selected .bp-row-action { background: var(--boost); color: #fff; border-color: var(--boost); }
        .bp-empty-list { padding: 56px 24px; text-align: center; color: var(--text-muted); font-size: 14px; }
        .bp-empty-list strong { display: block; color: var(--text-secondary); font-size: 15px; margin-bottom: 6px; }

        /* ── PANEL ── */
        .bp-panel { background: var(--bg-primary); border: 1px solid var(--border); border-radius: 16px; padding: 24px; position: sticky; top: 116px; }
        .bp-panel-title { font-size: 13px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 14px; }
        .bp-panel-empty { font-size: 14px; color: var(--text-secondary); line-height: 1.55; padding: 24px 0; text-align: center; }
        .bp-panel-token { display: flex; align-items: center; gap: 12px; padding-bottom: 16px; margin-bottom: 16px; border-bottom: 1px solid var(--border); }
        .bp-panel-token-name { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }
        .bp-panel-token-sym { font-size: 12.5px; color: var(--text-muted); font-family: ui-monospace, "SF Mono", Menlo, monospace; }
        .bp-panel-current { background: var(--bg-secondary); border-radius: 10px; padding: 12px 14px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: baseline; }
        .bp-panel-current-label { font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .bp-panel-current-value { font-size: 18px; font-weight: 700; color: var(--boost); font-variant-numeric: tabular-nums; }
        .bp-panel-input-label { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; display: block; }
        .bp-panel-input-wrap { position: relative; margin-bottom: 12px; }
        .bp-panel-input {
          width: 100%; padding: 14px 60px 14px 14px; background: var(--bg-secondary);
          border: 1px solid var(--border); border-radius: 12px; color: var(--text-primary);
          font-size: 18px; font-weight: 600; font-family: inherit; outline: none; box-sizing: border-box;
          font-variant-numeric: tabular-nums; transition: border-color 0.15s, box-shadow 0.15s;
        }
        .bp-panel-input:focus { border-color: var(--boost); box-shadow: 0 0 0 3px var(--boost-light); }
        .bp-panel-input-suffix { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); font-size: 14px; color: var(--text-muted); font-weight: 600; }
        .bp-quick { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 16px; }
        .bp-quick button {
          padding: 8px 0; background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: 8px; font-size: 12.5px; font-weight: 600; color: var(--text-primary);
          font-family: inherit; cursor: pointer; transition: background 0.1s, border-color 0.1s;
        }
        .bp-quick button:hover { background: var(--bg-hover); border-color: var(--boost); }
        .bp-panel-submit {
          width: 100%; padding: 13px 0; background: var(--boost); color: #fff; border: none;
          border-radius: 12px; font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer;
          box-shadow: 0 2px 12px rgba(234,88,12,0.35); transition: background 0.15s;
        }
        .bp-panel-submit:hover { background: var(--boost-hover); }
        .bp-panel-trade {
          margin-top: 10px; display: block; text-align: center; padding: 11px 0;
          background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 12px;
          font-size: 14px; font-weight: 600; color: var(--text-primary); text-decoration: none;
          transition: background 0.12s, border-color 0.12s;
        }
        .bp-panel-trade:hover { background: var(--bg-hover); border-color: var(--accent); }
        .bp-panel-close { display: block; width: 100%; margin-top: 10px; background: transparent; border: none; color: var(--text-muted); font-size: 13px; font-family: inherit; cursor: pointer; }
        .bp-panel-close:hover { color: var(--text-primary); }

        /* ── TOAST ── */
        .bp-toast {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          background: var(--text-primary); color: var(--bg-primary);
          padding: 10px 18px; border-radius: 10px; font-size: 13.5px; font-weight: 500;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2); z-index: 500;
        }

        @media (max-width: 900px) {
          .bp-grid { grid-template-columns: 1fr; }
          .bp-panel { position: static; }
          .bp-list-head { display: none; }
          .bp-row { grid-template-columns: 44px 1fr auto; }
          .bp-row-gap { display: none; }
        }
        @media (max-width: 680px) {
          .bp-wrap { padding: 28px 16px 48px; }
          .bp-hero-countdown-time { font-size: 32px; }
          .bp-hero-countdown.is-urgent .bp-hero-countdown-time { font-size: 64px; }
          .bp-hero-row { flex-direction: column; align-items: stretch; }
          .bp-hero-actions { width: 100%; }
          .bp-hero-cta { flex: 1; text-align: center; }
        }
        @media (max-width: 540px) {
          .bp-row { grid-template-columns: 32px 1fr auto; }
          .bp-row-action { display: none; }
        }
      `}</style>

      <div className="bp-page">
        <PageShell>
        <div className="bp-wrap">

          <div className="bp-header">
            <h1>Boost Competition</h1>
            <p>Pay APT to seize the #1 spot — a featured hero here, top billing in the Boost Bar above every page, and the spotlight across the app. Highest spend wins. Dethrone the champion before the round ends.</p>
          </div>

          {/* ── CHAMPION HERO ── */}
          {leader ? (
            <div className={`bp-hero${urgent ? ' urgent' : ''}`}>
              <div className="bp-hero-banner">
                <div
                  className="bp-hero-banner-glow"
                  style={{
                    background: `linear-gradient(120deg, ${palette.dark} 0%, ${palette.base} 55%, ${palette.light} 120%)`,
                  }}
                />
                <div className="bp-hero-banner-grid" />
                <div className="bp-hero-badge">
                  <span className="bp-hero-badge-dot" />
                  Champion · {windowKey}
                </div>
                <div className={`bp-hero-countdown${urgent ? ' is-urgent' : ''}`}>
                  <div className="bp-hero-countdown-label">{urgent ? 'Crowning in' : 'Round ends in'}</div>
                  <div className="bp-hero-countdown-time">{urgent ? remainingSec : countdownLabel}</div>
                </div>
              </div>

              <div className="bp-hero-body">
                <TokenAvatar image={leader.image} symbol={leader.symbol} className="bp-hero-avatar" background={palette.base} />
                <div className="bp-hero-identity">
                  <div className="bp-hero-name">{leader.name}</div>
                  <div className="bp-hero-sym">{leader.symbol}</div>
                </div>

                <div className="bp-hero-row">
                  <div>
                    <div className="bp-hero-stat-label">Lead boost</div>
                    <div className="bp-hero-stat-value">{formatApt(leader.boostApt)}<span>APT</span></div>
                  </div>
                  <div className="bp-hero-actions">
                    <button
                      className="bp-hero-cta"
                      onClick={() => {
                        selectToken(leader.metadataAddress);
                        setBoostAmount(aptToTakeFirst.toFixed(2));
                      }}
                    >
                      Dethrone for {aptToTakeFirst.toFixed(2)} APT
                    </button>
                    <Link to={`/newtoken/${leader.metadataAddress}`} className="bp-hero-trade">Trade →</Link>
                  </div>
                </div>

                <div className="bp-hero-meta">
                  {formatApt(totalBoostedApt)} APT contested · {activeTokens} active token{activeTokens !== 1 ? 's' : ''} · rolling {windowKey} window
                </div>
              </div>
            </div>
          ) : (
            <div className="bp-hero bp-hero-empty">
              <div className="bp-hero-banner" />
              <div className="bp-hero-body">
                <div className="bp-hero-avatar">?</div>
                <div className="bp-hero-identity">
                  <div className="bp-hero-name">The throne is open</div>
                  <div className="bp-hero-sym">First boost in the {windowKey} window takes the crown.</div>
                </div>
                <Link to="/marketplace" className="bp-hero-empty-cta">Find a token to boost →</Link>
              </div>
            </div>
          )}

          {/* ── PERKS ── */}
          <div className="bp-perks">
            <div className="bp-perk"><span className="bp-perk-icon">1</span>Featured hero on this page</div>
            <div className="bp-perk"><span className="bp-perk-icon">◆</span>Top billing in the Boost Bar</div>
            <div className="bp-perk"><span className="bp-perk-icon">↑</span>Spotlight across the app</div>
          </div>

          <div className="bp-protomsg">
            Prototype mode — boosts cached locally. On-chain boost moves in the next release.
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
                <button key={w} className={windowKey === w ? 'active' : ''} onClick={() => setWindowKey(w)}>
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* ── CHALLENGERS + PANEL ── */}
          <div className="bp-grid">
            <div className="bp-list">
              <div className="bp-list-head">
                <div>#</div>
                <div>Challenger</div>
                <div>Gap</div>
                <div>Boost</div>
              </div>
              {challengers.length === 0 ? (
                <div className="bp-empty-list">
                  {leader ? (
                    <>
                      <strong>No challengers yet</strong>
                      {leader.symbol} runs uncontested. Boost any token to enter the race.
                    </>
                  ) : (
                    <>
                      <strong>No tokens boosted yet</strong>
                      Select any token and add the first boost to claim the throne.
                    </>
                  )}
                </div>
              ) : (
                challengers.map((t, i) => {
                  const rank = (leader ? i + 2 : i + 1);
                  const rankClass = rank === 2 ? 'r2' : rank === 3 ? 'r3' : '';
                  const isSelected = t.metadataAddress === selectedAddr;
                  const leaderApt = leader?.boostApt ?? 0;
                  const barWidth = leaderApt > 0 ? (t.boostApt / leaderApt) * 100 : 0;
                  const gap = leaderApt - t.boostApt;
                  return (
                    <div
                      key={t.metadataAddress}
                      className={`bp-row ${rankClass}${isSelected ? ' selected' : ''}`}
                      onClick={() => selectToken(t.metadataAddress)}
                    >
                      {t.boostApt > 0 && (
                        <div className="bp-row-track" style={{ width: `${barWidth}%` }} />
                      )}
                      <div className="bp-rank">{rank}</div>
                      <div className="bp-token-cell">
                        <TokenAvatar image={t.image} symbol={t.symbol} className="bp-token-icon" />
                        <div style={{ minWidth: 0 }}>
                          <div className="bp-token-name">{t.name}</div>
                          <div className="bp-token-symbol">{t.symbol}</div>
                        </div>
                      </div>
                      <div className="bp-row-gap">
                        {leader && t.boostApt < leaderApt ? (
                          <span className="bp-row-gap-behind">−<strong>{formatApt(gap)}</strong> APT</span>
                        ) : (
                          <span className="bp-row-gap-behind">—</span>
                        )}
                      </div>
                      <div className="bp-row-apt-col">
                        <div>
                          <span className={`bp-row-apt${t.boostApt === 0 ? ' zero' : ''}`}>
                            {t.boostApt > 0 ? formatApt(t.boostApt) : '0.00'}
                          </span>
                          <span className="bp-row-apt-unit">APT</span>
                        </div>
                        <div className="bp-row-action">{isSelected ? 'Selected' : 'Boost'}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ── PANEL ── */}
            <div className="bp-panel">
              <div className="bp-panel-title">Boost a token</div>
              {!selected ? (
                <div className="bp-panel-empty">
                  Select a token from the list to add boost. New tokens can climb instantly.
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
                        <button className="bp-panel-overtake-btn" onClick={() => setBoostAmount(aptToOvertake.toFixed(2))}>Fill</button>
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
                      <button key={v} type="button" onClick={() => setBoostAmount(String(v))}>{v} APT</button>
                    ))}
                  </div>

                  <button className="bp-panel-submit" onClick={handleBoost}>Boost {selected.symbol}</button>

                  <Link to={`/newtoken/${selected.metadataAddress}`} className="bp-panel-trade">Trade this token →</Link>
                  <button className="bp-panel-close" onClick={clearSelection}>Cancel</button>
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
