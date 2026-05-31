import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTokenData } from '../hooks/useTokenData';
import { useTokenList } from '../data/useTokenList';
import { useAptPrice } from '../contexts/AptPriceContext';
import { useTheme } from '../contexts/ThemeContext';
import AppHeader from './AppHeader';
import TokenAvatar from './TokenAvatar';
import SiteFooter from './SiteFooter';
import { truncateAddress } from '../utils/format';
import { BOOST_ENABLED } from '../featureFlags';

type SortOrder = 'newest' | 'oldest' | 'highest_mc' | 'lowest_mc' | 'highest_vol' | 'lowest_vol';

interface Token {
  name: string;
  symbol: string;
  supply: number;
  txHash: string;
  image: string | null;
  launchDate: string;
  creator: string;
  metadataAddress?: string;
  price?: number;
  priceUSD?: number;
  marketCap?: number;
  marketCapUSD?: number;
  volume?: number;
  change24h?: number;
  creatorAddress?: string;
}

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');


  const { tokens: catalogTokens, loading } = useTokenData();
  const { aptPrice } = useAptPrice();

  const catalogAddrs = useMemo(
    () => catalogTokens.map(t => t.metadataAddress || t.txHash).filter(Boolean) as string[],
    [catalogTokens]
  );
  const { data: liveByAddr } = useTokenList(catalogAddrs);

  const rawTokens = useMemo(() => {
    if (!liveByAddr) return catalogTokens;
    const aptUsd = aptPrice ?? 0;
    return catalogTokens.map(t => {
      const key = (t.metadataAddress || t.txHash || '').toLowerCase();
      const live = liveByAddr[key];
      if (!live) return t;
      return {
        ...t,
        price: live.spotPriceAPT,
        priceUSD: aptUsd > 0 ? live.spotPriceAPT * aptUsd : t.priceUSD,
        marketCap: live.marketCapAPT,
        marketCapUSD: aptUsd > 0 ? live.marketCapAPT * aptUsd : t.marketCapUSD,
        tokensSold: live.tokensSold,
        aptRaised: live.aptRaisedOctas,
      };
    });
  }, [catalogTokens, liveByAddr, aptPrice]);

  const tokens = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? rawTokens.filter(t =>
          t.name.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q) ||
          (t.creatorAddress || '').toLowerCase().includes(q)
        )
      : rawTokens;

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortOrder) {
        case 'newest':     return new Date(b.launchDate).getTime() - new Date(a.launchDate).getTime();
        case 'oldest':     return new Date(a.launchDate).getTime() - new Date(b.launchDate).getTime();
        case 'highest_mc': return (b.marketCap || 0) - (a.marketCap || 0);
        case 'lowest_mc':  return (a.marketCap || 0) - (b.marketCap || 0);
        case 'highest_vol':return (b.volume || 0) - (a.volume || 0);
        case 'lowest_vol': return (a.volume || 0) - (b.volume || 0);
      }
    });
    return sorted;
  }, [rawTokens, sortOrder, searchQuery]);

  const totalVolume24h = useMemo(
    () => rawTokens.reduce((sum, t) => sum + (t.volume || 0), 0),
    [rawTokens]
  );
  const totalMarketCap = useMemo(
    () => rawTokens.reduce((sum, t) => sum + (t.marketCapUSD || 0), 0),
    [rawTokens]
  );

  const formatPrice = (n: number) => {
    if (n < 0.0001) return `$${n.toFixed(8)}`;
    if (n < 0.01) return `$${n.toFixed(6)}`;
    if (n < 1) return `$${n.toFixed(4)}`;
    return `$${n.toFixed(2)}`;
  };
  const formatBig = (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };
  const symbolWithDollar = (s: string) => (s.startsWith('$') ? s : `$${s}`);
  const priceLabel = (t: Token) =>
    t.priceUSD != null ? formatPrice(t.priceUSD)
    : t.price != null ? `${t.price.toFixed(6)} APT`
    : '—';

  // Restrained icon palette — muted, premium. No bright/saturated colors.
  const iconPalette = ['#5E5CE6', '#33972e', '#FF9F0A', '#BF5AF2', '#0A84FF', '#FF6482', '#A2845E', '#30B0C7'];
  const getIconBg = (sym: string) => iconPalette[(sym.replace('$', '').charCodeAt(0) || 0) % iconPalette.length];

  const handleTradeClick = (t: Token) => {
    const url = t.metadataAddress || t.txHash;
    navigate(`/newtoken/${url}`, {
      state: {
        name: t.name, symbol: t.symbol, supply: t.supply, txHash: t.txHash,
        metadataAddress: t.metadataAddress || t.txHash,
        creatorAddress: t.creator,
        creationDate: new Date(t.launchDate).getTime() / 1000,
      },
    });
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
          background: var(--bg-primary);
          color: var(--text-primary);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .mm-page { width: 100%; min-height: 100vh; display: flex; flex-direction: column; background: var(--bg-primary); overflow-x: hidden; }

        /* ── HERO ── */
        .mm-hero {
          position: relative; overflow: hidden;
          padding: 124px 0 180px;
          isolation: isolate;
        }
        /* ── ATMOSPHERE ── the entire hero is a slow-moving color field */
        .mm-atmos {
          position: absolute; inset: -10% -5% -15% -5%;
          pointer-events: none; z-index: 0;
        }
        /* Each cloud is an organic, heavily-blurred color form.
           Asymmetric border-radius + blur reads as a soft painted shape,
           not a circle. They sit at scene-scale and drift very slowly. */
        .mm-cloud {
          position: absolute;
          border-radius: 62% 38% 54% 46% / 48% 56% 44% 52%;
          filter: blur(${isDark ? '110px' : '120px'});
          will-change: transform, border-radius;
        }
        .mm-cloud-1 {
          top: -22%; right: -8%;
          width: 72%; aspect-ratio: 1.15;
          background: radial-gradient(circle at 42% 38%,
            ${isDark ? 'rgba(72,210,90,0.65)' : 'rgba(72,196,98,0.42)'} 0%,
            ${isDark ? 'rgba(28,130,76,0.40)' : 'rgba(46,158,80,0.20)'} 38%,
            transparent 72%);
          animation: mm-cloud-a 32s ease-in-out infinite alternate;
        }
        .mm-cloud-2 {
          top: 18%; right: 6%;
          width: 58%; aspect-ratio: 1.35;
          border-radius: 48% 52% 38% 62% / 56% 42% 58% 44%;
          background: radial-gradient(circle at 48% 50%,
            ${isDark ? 'rgba(56,178,196,0.55)' : 'rgba(40,170,200,0.30)'} 0%,
            ${isDark ? 'rgba(50,130,200,0.30)' : 'rgba(60,140,210,0.14)'} 42%,
            transparent 74%);
          animation: mm-cloud-b 38s ease-in-out infinite alternate;
        }
        .mm-cloud-3 {
          bottom: -18%; left: -10%;
          width: 64%; aspect-ratio: 1.4;
          border-radius: 54% 46% 62% 38% / 42% 58% 46% 54%;
          background: radial-gradient(circle at 56% 44%,
            ${isDark ? 'rgba(110,92,230,0.42)' : 'rgba(120,108,230,0.22)'} 0%,
            ${isDark ? 'rgba(70,52,180,0.26)' : 'rgba(94,84,200,0.12)'} 44%,
            transparent 76%);
          animation: mm-cloud-c 44s ease-in-out infinite alternate;
        }
        .mm-cloud-4 {
          top: -10%; left: -8%;
          width: 46%; aspect-ratio: 1.1;
          border-radius: 58% 42% 48% 52% / 50% 60% 40% 50%;
          background: radial-gradient(circle at 50% 50%,
            ${isDark ? 'rgba(240,180,90,0.18)' : 'rgba(255,190,110,0.16)'} 0%,
            transparent 70%);
          opacity: 0.85;
          animation: mm-cloud-d 50s ease-in-out infinite alternate;
        }
        @keyframes mm-cloud-a {
          0%   { transform: translate(0,0) scale(1) rotate(0deg);
                 border-radius: 62% 38% 54% 46% / 48% 56% 44% 52%; }
          100% { transform: translate(-3%, 4%) scale(1.08) rotate(10deg);
                 border-radius: 52% 48% 60% 40% / 56% 44% 52% 48%; }
        }
        @keyframes mm-cloud-b {
          0%   { transform: translate(0,0) scale(1) rotate(0deg);
                 border-radius: 48% 52% 38% 62% / 56% 42% 58% 44%; }
          100% { transform: translate(4%, -3%) scale(1.06) rotate(-12deg);
                 border-radius: 58% 42% 50% 50% / 44% 58% 42% 56%; }
        }
        @keyframes mm-cloud-c {
          0%   { transform: translate(0,0) scale(1) rotate(0deg);
                 border-radius: 54% 46% 62% 38% / 42% 58% 46% 54%; }
          100% { transform: translate(3%, -4%) scale(1.05) rotate(8deg);
                 border-radius: 46% 54% 52% 48% / 56% 44% 58% 42%; }
        }
        @keyframes mm-cloud-d {
          0%   { transform: translate(0,0) scale(1); opacity: 0.7; }
          100% { transform: translate(2%, 3%) scale(1.08); opacity: 0.95; }
        }
        /* Subtle film grain — pulls everything into "photograph" territory
           rather than "CSS gradient" territory. */
        .mm-atmos-grain {
          position: absolute; inset: 0;
          opacity: ${isDark ? '0.06' : '0.04'};
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
          pointer-events: none;
        }
        /* A whisper-soft vignette at the bottom so the hero bleeds into
           whatever sits below it — no hard edge. */
        .mm-atmos::after {
          content: ''; position: absolute; left: 0; right: 0; bottom: 0;
          height: 30%;
          background: linear-gradient(to bottom, transparent 0%, var(--bg-primary) 100%);
          pointer-events: none;
        }
        .mm-hero-inner {
          position: relative; z-index: 1;
          max-width: 1280px; margin: 0 auto; padding: 0 24px;
        }
        .mm-hero-copy {
          max-width: 640px;
        }
        .mm-badge {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 13px; font-weight: 600;
          color: var(--accent);
          background: ${isDark ? 'rgba(20,28,22,0.55)' : 'rgba(255,255,255,0.55)'};
          backdrop-filter: blur(14px) saturate(180%);
          -webkit-backdrop-filter: blur(14px) saturate(180%);
          border: 1px solid ${isDark ? 'rgba(64,187,56,0.30)' : 'rgba(51,151,46,0.22)'};
          padding: 6px 13px; border-radius: 980px;
          margin-bottom: 26px;
        }
        .mm-badge-dot {
          width: 7px; height: 7px; border-radius: 50%; background: var(--accent);
          box-shadow: 0 0 0 0 var(--accent);
          animation: mm-pulse 2s infinite;
        }
        @keyframes mm-pulse {
          0%   { box-shadow: 0 0 0 0 ${isDark ? 'rgba(64,187,56,0.5)' : 'rgba(51,151,46,0.45)'}; }
          70%  { box-shadow: 0 0 0 8px rgba(51,151,46,0); }
          100% { box-shadow: 0 0 0 0 rgba(51,151,46,0); }
        }
        .mm-hero-title {
          font-size: clamp(44px, 6vw, 78px);
          font-weight: 700;
          letter-spacing: -0.045em;
          line-height: 1.02;
          color: var(--text-primary);
          margin: 0 0 22px;
        }
        .mm-hero-title .accent {
          background: linear-gradient(135deg, var(--accent), ${isDark ? '#5eead4' : '#0ea5e9'});
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .mm-hero-sub {
          font-size: clamp(17px, 1.55vw, 20px);
          font-weight: 400; line-height: 1.5;
          color: var(--text-secondary);
          max-width: 520px;
          margin: 0 0 34px;
        }
        .mm-hero-actions {
          display: flex; gap: 12px; flex-wrap: wrap;
          margin-bottom: 28px;
        }
        .mm-btn-primary {
          background: var(--accent); color: #fff;
          padding: 14px 28px; border-radius: 12px;
          font-size: 15px; font-weight: 600;
          text-decoration: none;
          transition: background 0.15s, transform 0.1s;
          display: inline-flex; align-items: center; gap: 7px;
          border: none; cursor: pointer;
          box-shadow: 0 4px 16px rgba(51,151,46,0.32);
        }
        .mm-btn-primary:hover { background: var(--accent-hover); }
        .mm-btn-primary:active { transform: scale(0.98); }
        .mm-btn-secondary {
          background: ${isDark ? 'rgba(20,20,22,0.55)' : 'rgba(255,255,255,0.65)'};
          backdrop-filter: blur(14px) saturate(180%);
          -webkit-backdrop-filter: blur(14px) saturate(180%);
          color: var(--text-primary);
          padding: 14px 26px; border-radius: 12px;
          font-size: 15px; font-weight: 600;
          text-decoration: none;
          border: 1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'};
          display: inline-flex; align-items: center; gap: 7px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .mm-btn-secondary:hover {
          background: ${isDark ? 'rgba(30,30,32,0.75)' : 'rgba(255,255,255,0.85)'};
          border-color: ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)'};
        }
        .mm-btn-secondary::after {
          content: '→'; font-size: 15px;
          transition: transform 0.18s;
        }
        .mm-btn-secondary:hover::after { transform: translateX(3px); }
        .mm-hero-trust {
          display: flex; gap: 22px; flex-wrap: wrap;
          font-size: 13px; color: var(--text-muted);
        }
        .mm-hero-trust span { display: inline-flex; align-items: center; gap: 6px; }
        .mm-hero-trust .check { color: var(--accent); font-weight: 700; }

        /* ── STATS PANEL ── */
        .mm-stats {
          position: relative; z-index: 5;
          margin-top: -58px;
        }
        .mm-stats-inner {
          max-width: 1280px; margin: 0 auto; padding: 0 24px;
        }
        .mm-stats-panel {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 18px;
          display: grid; grid-template-columns: repeat(4, 1fr);
          box-shadow: 0 18px 44px rgba(0,0,0,${isDark ? '0.5' : '0.09'});
          overflow: hidden;
        }
        .mm-stat {
          padding: 24px 26px;
          border-right: 1px solid var(--border);
        }
        .mm-stat:last-child { border-right: none; }
        .mm-stat-label {
          font-size: 11px; text-transform: uppercase;
          letter-spacing: 0.07em; color: var(--text-muted);
          font-weight: 700; margin-bottom: 9px;
        }
        .mm-stat-value {
          font-size: 28px; font-weight: 700;
          letter-spacing: -0.025em; color: var(--text-primary);
          line-height: 1.05; font-variant-numeric: tabular-nums;
        }
        .mm-stat-suffix {
          font-size: 14px; font-weight: 500;
          color: var(--text-secondary); margin-left: 5px;
        }

        /* ── TOKENS SECTION ── */
        .mm-tokens {
          flex: 1;
          padding: 88px 0 100px;
          background: var(--bg-primary);
        }
        .mm-tokens-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; }
        .mm-section-head {
          display: flex; justify-content: space-between; align-items: flex-end;
          gap: 24px; flex-wrap: wrap;
          margin-bottom: 36px;
        }
        .mm-section-title {
          font-size: clamp(28px, 3vw, 38px);
          font-weight: 700; letter-spacing: -0.03em;
          line-height: 1.1; color: var(--text-primary);
          margin: 0 0 8px;
        }
        .mm-section-sub {
          font-size: 16px; color: var(--text-secondary); margin: 0;
        }
        .mm-controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .mm-search {
          background: var(--bg-secondary);
          border: 1.5px solid var(--border);
          border-radius: 11px;
          padding: 10px 16px 10px 38px;
          font-size: 14px; color: var(--text-primary);
          outline: none; width: 240px;
          transition: border-color 0.15s, box-shadow 0.15s;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2.5'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: 13px center;
          font-family: inherit;
        }
        .mm-search:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
        .mm-search::placeholder { color: var(--text-muted); }
        .mm-sort {
          background: var(--bg-secondary);
          border: 1.5px solid var(--border);
          border-radius: 11px;
          padding: 10px 36px 10px 16px;
          font-size: 14px; color: var(--text-primary);
          cursor: pointer; outline: none;
          appearance: none; -webkit-appearance: none;
          font-family: inherit;
          transition: border-color 0.15s, box-shadow 0.15s;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 14px center;
        }
        .mm-sort:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }

        /* ── TOKEN CARDS ── */
        .mm-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }
        .mm-card {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 20px;
          display: flex; flex-direction: column; gap: 16px;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04);
          transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
        }
        .mm-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 14px 32px rgba(0,0,0,${isDark ? '0.4' : '0.11'}), 0 4px 10px rgba(0,0,0,${isDark ? '0.3' : '0.06'});
          border-color: var(--accent);
        }
        .mm-card-head { display: flex; align-items: center; gap: 13px; }
        .mm-card-icon {
          width: 44px; height: 44px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 700; color: #fff;
          flex-shrink: 0; letter-spacing: -0.01em;
        }
        .mm-card-name-wrap { flex: 1; min-width: 0; }
        .mm-card-name {
          font-size: 16px; font-weight: 700; letter-spacing: -0.012em;
          color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          line-height: 1.2;
        }
        .mm-card-symbol { font-size: 12.5px; color: var(--text-muted); font-weight: 500; margin-top: 2px; }
        .mm-card-badge {
          font-size: 12px; font-weight: 700;
          padding: 4px 9px; border-radius: 7px; flex-shrink: 0;
        }
        .mm-card-stats {
          display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
          padding: 15px; margin: 0 -2px;
          background: var(--bg-secondary);
          border-radius: 12px;
        }
        .mm-card-stat-label {
          font-size: 10px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;
        }
        .mm-card-stat-value {
          font-size: 16px; font-weight: 700; color: var(--text-primary);
          letter-spacing: -0.014em; line-height: 1.1;
          font-variant-numeric: tabular-nums;
        }
        .mm-card-foot {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .mm-card-creator {
          font-size: 11.5px; color: var(--text-muted);
          font-family: 'SF Mono', ui-monospace, monospace;
          cursor: pointer; transition: color 0.15s;
        }
        .mm-card-creator:hover { color: var(--text-secondary); }
        .mm-card-trade {
          background: var(--accent); color: #fff; border: none;
          padding: 8px 18px; border-radius: 9px;
          font-size: 13px; font-weight: 600;
          cursor: pointer; transition: background 0.15s;
          font-family: inherit;
        }
        .mm-card-trade:hover { background: var(--accent-hover); }
        .mm-card-boost {
          display: inline-flex; align-items: center;
          background: var(--boost-light); border: 1.5px solid var(--boost);
          color: var(--boost); padding: 8px 14px; border-radius: 9px;
          font-size: 13px; font-weight: 600; text-decoration: none;
          transition: background 0.12s, color 0.12s;
          margin-right: 6px; line-height: 1;
        }
        .mm-card-boost:hover { background: var(--boost); color: #fff; }

        .mm-lt-boost {
          display: inline-flex; align-items: center;
          background: var(--boost-light); border: 1.5px solid var(--boost);
          color: var(--boost); padding: 7px 14px; border-radius: 9px;
          font-size: 13px; font-weight: 600; text-decoration: none;
          margin-right: 8px; line-height: 1;
          transition: background 0.12s, color 0.12s;
        }
        .mm-lt-boost:hover { background: var(--boost); color: #fff; }

        .mm-empty {
          text-align: center; padding: 72px 20px;
          color: var(--text-muted); font-size: 15px;
          border: 1px dashed var(--border); border-radius: 16px;
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .mm-stats-panel { grid-template-columns: repeat(2, 1fr); }
          .mm-stat:nth-child(2) { border-right: none; }
          .mm-stat:nth-child(1), .mm-stat:nth-child(2) { border-bottom: 1px solid var(--border); }
          .mm-nav-links { display: none; }
        }
        @media (max-width: 600px) {
          .mm-hero { padding: 68px 0 88px; }
          .mm-hero-inner { padding: 0 18px; }
          .mm-cloud { filter: blur(70px); }
          .mm-tokens { padding: 52px 0 72px; }
          .mm-tokens-inner { padding: 0 18px; }
          .mm-stats { margin-top: -1px; }
          .mm-stats-inner { padding: 0 16px; }
          .mm-stats-panel { border-radius: 14px; grid-template-columns: repeat(2, 1fr); }
          .mm-stat { padding: 14px 18px; }
          .mm-stat:nth-child(even) { border-right: none; }
          .mm-stat:nth-child(1), .mm-stat:nth-child(2) { border-bottom: 1px solid var(--border); }
          .mm-stat:nth-child(3), .mm-stat:nth-child(4) { border-bottom: none; }
          .mm-stat-value { font-size: 20px; }
          .mm-controls { width: 100%; }
          .mm-search { flex: 1; width: auto; }
        }

        /* ── VIEW TOGGLE ── */
        .mm-view-toggle { display: flex; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; padding: 3px; gap: 2px; }
        .mm-vt-btn { padding: 6px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; font-family: inherit; color: var(--text-muted); background: none; transition: all 0.12s; }
        .mm-vt-btn:hover { color: var(--text-primary); }
        .mm-vt-btn.active { background: var(--bg-primary); color: var(--text-primary); box-shadow: 0 1px 4px rgba(0,0,0,${isDark ? '0.3' : '0.1'}); }

        /* ── LIST VIEW ── */
        .mm-list-card { background: var(--bg-primary); border: 1px solid var(--border); border-radius: 18px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,${isDark ? '0.3' : '0.05'}); }
        .mm-list-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .mm-list-table thead tr { border-bottom: 1px solid var(--border); }
        .mm-lt-th { padding: 14px 18px; font-size: 11.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; background: var(--bg-secondary); }
        .mm-lt-row { border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.12s; }
        .mm-lt-row:last-child { border-bottom: none; }
        .mm-lt-row:hover { background: var(--bg-hover); }
        .mm-lt-td { padding: 14px 18px; vertical-align: middle; }
        .mm-lt-token { display: flex; align-items: center; gap: 12px; }
        .mm-lt-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #fff; flex-shrink: 0; object-fit: cover; }
        .mm-lt-name { font-size: 14px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.01em; }
        .mm-lt-sym { font-size: 12px; color: var(--text-muted); font-weight: 500; margin-top: 1px; }
        .mm-lt-trade { background: var(--accent); color: #fff; border: none; padding: 7px 16px; border-radius: 9px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s; }
        .mm-lt-trade:hover { background: var(--accent-hover); }
      `}</style>

      <div className="mm-page">
        <AppHeader launchCta hideBoostBar />

        {/* ── HERO ── atmosphere is the art, content sits on top */}
        <section className="mm-hero">
          <div className="mm-atmos" aria-hidden="true">
            <div className="mm-cloud mm-cloud-1" />
            <div className="mm-cloud mm-cloud-2" />
            <div className="mm-cloud mm-cloud-3" />
            <div className="mm-cloud mm-cloud-4" />
            <div className="mm-atmos-grain" />
          </div>
          <div className="mm-hero-inner">
            <div className="mm-hero-copy">
              <div className="mm-badge">
                <span className="mm-badge-dot" />
                Live on Aptos testnet
              </div>
              <h1 className="mm-hero-title">
                The token engine built for <span className="accent">serious markets.</span>
              </h1>
              <p className="mm-hero-sub">
                Launch, price, and trade tokens on Aptos with a bonding curve that
                works the moment you deploy. No code. No setup. Just markets.
              </p>
              <div className="mm-hero-actions">
                <Link to="/launch" className="mm-btn-primary">Launch a token</Link>
                <a href="#tokens" className="mm-btn-secondary">Explore markets</a>
              </div>
              <div className="mm-hero-trust">
                <span><span className="check">✓</span> Instant liquidity</span>
                <span><span className="check">✓</span> 0% launch fee</span>
                <span><span className="check">✓</span> Non-custodial</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS PANEL ── */}
        <section className="mm-stats">
          <div className="mm-stats-inner">
          <div className="mm-stats-panel">
            <div className="mm-stat">
              <div className="mm-stat-label">Tokens launched</div>
              <div className="mm-stat-value">{rawTokens.length}</div>
            </div>
            <div className="mm-stat">
              <div className="mm-stat-label">24h volume</div>
              <div className="mm-stat-value">{totalVolume24h > 0 ? formatBig(totalVolume24h) : '$0'}</div>
            </div>
            <div className="mm-stat">
              <div className="mm-stat-label">Total market cap</div>
              <div className="mm-stat-value">{totalMarketCap > 0 ? formatBig(totalMarketCap) : '$0'}</div>
            </div>
            <div className="mm-stat">
              <div className="mm-stat-label">Network</div>
              <div className="mm-stat-value">Aptos<span className="mm-stat-suffix">testnet</span></div>
            </div>
          </div>
          </div>
        </section>

        {/* ── TOKENS ── */}
        <section className="mm-tokens" id="tokens">
          <div className="mm-tokens-inner">
            <div className="mm-section-head">
              <div>
                <h2 className="mm-section-title">Live markets</h2>
                <p className="mm-section-sub">Every token below is trading right now on a live bonding curve.</p>
              </div>
              <div className="mm-controls">
                <div className="mm-view-toggle">
                  <button
                    className={`mm-vt-btn${viewMode === 'grid' ? ' active' : ''}`}
                    onClick={() => setViewMode('grid')}
                  >Grid</button>
                  <button
                    className={`mm-vt-btn${viewMode === 'list' ? ' active' : ''}`}
                    onClick={() => setViewMode('list')}
                  >List</button>
                </div>
                <input
                  type="text"
                  className="mm-search"
                  placeholder="Search tokens"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <select
                  className="mm-sort"
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value as SortOrder)}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="highest_mc">Highest market cap</option>
                  <option value="lowest_mc">Lowest market cap</option>
                  <option value="highest_vol">Highest volume</option>
                  <option value="lowest_vol">Lowest volume</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="mm-empty">Loading markets…</div>
            ) : tokens.length === 0 ? (
              <div className="mm-empty">
                {searchQuery ? `No tokens match "${searchQuery}"` : 'No tokens have launched yet. Be the first.'}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="mm-grid">
                {tokens.map((token, i) => {
                  const change = token.change24h;
                  const isPos = change != null && change >= 0;
                  const badgeColor = change == null ? 'var(--text-muted)' : isPos ? 'var(--positive)' : 'var(--negative)';
                  const badgeBg = change == null
                    ? 'var(--bg-secondary)'
                    : isPos
                      ? (isDark ? 'rgba(64,187,56,0.16)' : 'rgba(51,151,46,0.10)')
                      : (isDark ? 'rgba(255,69,58,0.16)' : 'rgba(215,0,21,0.10)');
                  const displaySymbol = symbolWithDollar(token.symbol);

                  return (
                    <div key={i} className="mm-card" onClick={() => handleTradeClick(token)}>
                      <div className="mm-card-head">
                        <TokenAvatar
                          image={token.image}
                          symbol={token.symbol}
                          className="mm-card-icon"
                          background={getIconBg(token.symbol)}
                        />
                        <div className="mm-card-name-wrap">
                          <div className="mm-card-name">{token.name}</div>
                          <div className="mm-card-symbol">{displaySymbol}</div>
                        </div>
                        <div className="mm-card-badge" style={{ color: badgeColor, background: badgeBg }}>
                          {change == null ? 'New' : `${isPos ? '↑' : '↓'} ${Math.abs(change).toFixed(2)}%`}
                        </div>
                      </div>

                      <div className="mm-card-stats">
                        <div>
                          <div className="mm-card-stat-label">Price</div>
                          <div className="mm-card-stat-value">{priceLabel(token)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="mm-card-stat-label">Market cap</div>
                          <div className="mm-card-stat-value">
                            {token.marketCapUSD != null ? formatBig(token.marketCapUSD) : '—'}
                          </div>
                        </div>
                      </div>

                      <div className="mm-card-foot">
                        {token.creatorAddress && token.creatorAddress !== 'Unknown' ? (
                          <div
                            className="mm-card-creator"
                            onClick={e => { e.stopPropagation(); navigate(`/profile/${token.creatorAddress}`); }}
                            title={token.creatorAddress}
                          >
                            {truncateAddress(token.creatorAddress)}
                          </div>
                        ) : <div />}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {BOOST_ENABLED && <Link
                            to={`/boost?token=${token.metadataAddress || token.txHash}`}
                            className="mm-card-boost"
                            onClick={e => e.stopPropagation()}
                            title="Boost this token"
                          >
                            Boost
                          </Link>}
                          <button
                            className="mm-card-trade"
                            onClick={e => { e.stopPropagation(); handleTradeClick(token); }}
                          >
                            Trade
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mm-list-card">
                <table className="mm-list-table">
                  <thead>
                    <tr>
                      <th className="mm-lt-th" style={{ textAlign: 'left' }}>Token</th>
                      <th className="mm-lt-th" style={{ textAlign: 'right' }}>Price</th>
                      <th className="mm-lt-th" style={{ textAlign: 'right' }}>24h</th>
                      <th className="mm-lt-th" style={{ textAlign: 'right' }}>Market cap</th>
                      <th className="mm-lt-th"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map((token, i) => {
                      const change = token.change24h;
                      const changeColor = change == null ? 'var(--text-muted)' : change >= 0 ? 'var(--positive)' : 'var(--negative)';
                      return (
                        <tr key={i} className="mm-lt-row" onClick={() => handleTradeClick(token)}>
                          <td className="mm-lt-td">
                            <div className="mm-lt-token">
                              <TokenAvatar
                                image={token.image}
                                symbol={token.symbol}
                                className="mm-lt-icon"
                                background={getIconBg(token.symbol)}
                              />
                              <div>
                                <div className="mm-lt-name">{token.name}</div>
                                <div className="mm-lt-sym">{symbolWithDollar(token.symbol)}</div>
                              </div>
                            </div>
                          </td>
                          <td className="mm-lt-td" style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                            {priceLabel(token)}
                          </td>
                          <td className="mm-lt-td" style={{ textAlign: 'right', color: changeColor, fontWeight: 700 }}>
                            {change == null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`}
                          </td>
                          <td className="mm-lt-td" style={{ textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {token.marketCapUSD != null ? formatBig(token.marketCapUSD) : '—'}
                          </td>
                          <td className="mm-lt-td" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {BOOST_ENABLED && <Link
                              to={`/boost?token=${token.metadataAddress || token.txHash}`}
                              className="mm-lt-boost"
                              onClick={e => e.stopPropagation()}
                              title="Boost this token"
                            >
                              Boost
                            </Link>}
                            <button
                              className="mm-lt-trade"
                              onClick={e => { e.stopPropagation(); handleTradeClick(token); }}
                            >
                              Trade
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ── FOOTER ── */}
        <SiteFooter />
      </div>
    </>
  );
};

export default HomePage;
