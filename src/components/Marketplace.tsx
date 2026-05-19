import React, { useState, useMemo, useEffect } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTokenData } from '../hooks/useTokenData';
import { useTokenList } from '../data/useTokenList';
import { useAptPrice } from '../contexts/AptPriceContext';
import { useWatchlist } from '../contexts/WatchlistContext';
import { useTheme } from '../contexts/ThemeContext';
import { useBoostData, BOOST_WINDOWS } from '../data/useBoostStore';
import PageShell from './PageShell';
import TokenAvatar from './TokenAvatar';

type SortKey = 'newest' | 'price' | 'change' | 'mc';
type SortDir = 'desc' | 'asc';
type ViewMode = 'list' | 'grid';

interface Token {
  name: string; symbol: string; supply: number; txHash: string;
  image: string | null; launchDate: string; creator: string;
  metadataAddress?: string; price?: number; priceUSD?: number;
  marketCap?: number; marketCapUSD?: number; volume?: number;
  change24h?: number; creatorAddress?: string;
}

const Marketplace: React.FC = () => {
  const { isDark } = useTheme();
  const { account } = useWallet();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  // Keep the URL ?q= in sync so deep-links from the header dropdown work
  // and the URL is shareable.
  useEffect(() => {
    const q = searchQuery.trim();
    const current = searchParams.get('q') || '';
    if (q === current) return;
    const next = new URLSearchParams(searchParams);
    if (q) next.set('q', q); else next.delete('q');
    setSearchParams(next, { replace: true });
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const { tokens: catalogTokens, loading, error, refetch } = useTokenData();
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

  const boostMap = useBoostData(BOOST_WINDOWS['24h']);
  const boostedLeader = useMemo(() => {
    let topAddr: string | null = null;
    let topApt = 0;
    for (const [addr, apt] of Object.entries(boostMap)) {
      if (apt > topApt) { topApt = apt; topAddr = addr; }
    }
    if (!topAddr) return null;
    const t = rawTokens.find(rt => (rt.metadataAddress || rt.txHash || '').toLowerCase() === topAddr);
    return t ? { token: t, apt: topApt } : null;
  }, [boostMap, rawTokens]);
  const boostedLeaderAddr = boostedLeader
    ? (boostedLeader.token.metadataAddress || boostedLeader.token.txHash || '').toLowerCase()
    : null;

  const tokens = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? rawTokens.filter(t =>
          t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q)
        )
      : rawTokens;
    const withoutBoosted = boostedLeaderAddr
      ? filtered.filter(t => (t.metadataAddress || t.txHash || '').toLowerCase() !== boostedLeaderAddr)
      : filtered;
    return [...withoutBoosted].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'newest': cmp = new Date(b.launchDate).getTime() - new Date(a.launchDate).getTime(); break;
        case 'price':  cmp = (b.priceUSD ?? b.price ?? 0) - (a.priceUSD ?? a.price ?? 0); break;
        case 'change': cmp = (b.change24h ?? 0) - (a.change24h ?? 0); break;
        case 'mc':     cmp = (b.marketCapUSD ?? 0) - (a.marketCapUSD ?? 0); break;
      }
      return sortDir === 'asc' ? -cmp : cmp;
    });
  }, [rawTokens, searchQuery, sortKey, sortDir, boostedLeaderAddr]);

  const formatPrice = (n: number) => {
    if (n < 0.0001) return `$${n.toFixed(8)}`;
    if (n < 0.01)   return `$${n.toFixed(6)}`;
    if (n < 1)      return `$${n.toFixed(4)}`;
    return `$${n.toFixed(2)}`;
  };
  const formatBig = (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };
  const priceLabel = (t: Token) =>
    t.priceUSD != null ? formatPrice(t.priceUSD) : t.price != null ? `${t.price.toFixed(8)} APT` : '—';
  const symbolWithDollar = (s: string) => (s.startsWith('$') ? s : `$${s}`);

  const iconPalette = ['#5E5CE6', '#059669', '#FF9F0A', '#BF5AF2', '#0A84FF', '#FF6482', '#A2845E', '#30B0C7'];
  const getIconBg = (sym: string) => iconPalette[(sym.replace('$', '').charCodeAt(0) || 0) % iconPalette.length];

  const handleTradeClick = (t: Token) => {
    navigate(`/newtoken/${t.metadataAddress || t.txHash}`, {
      state: {
        name: t.name, symbol: t.symbol, supply: t.supply, txHash: t.txHash,
        metadataAddress: t.metadataAddress || t.txHash,
        creatorAddress: t.creator,
        creationDate: new Date(t.launchDate).getTime() / 1000,
      },
    });
  };

  const handleStarClick = (token: Token, e: React.MouseEvent) => {
    e.stopPropagation();
    const id = token.metadataAddress || token.txHash;
    toggleWatchlist({
      name: token.name.replace('$', ''),
      symbol: token.symbol,
      icon: token.symbol.charAt(0).toUpperCase(),
      iconBg: getIconBg(token.symbol),
      metadataAddress: id,
      creatorAddress: token.creatorAddress,
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .mp-page { width: 100%; min-height: 100vh; background: var(--bg-primary); }
        .mp-main { padding: 52px 40px 80px; }

        /* ── PAGE HEAD ── */
        .mp-page-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          flex-wrap: wrap; gap: 18px; margin-bottom: 32px;
        }
        .mp-title {
          font-size: clamp(28px, 3vw, 36px); font-weight: 700;
          letter-spacing: -0.03em; color: var(--text-primary); margin: 0 0 6px;
        }
        .mp-sub { font-size: 15px; color: var(--text-secondary); margin: 0; }
        .mp-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

        /* Search */
        .mp-search-wrap { position: relative; flex: 1; min-width: 220px; max-width: 380px; }
        .mp-search-clear {
          position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
          width: 22px; height: 22px; border-radius: 6px;
          background: var(--bg-tertiary); border: none; cursor: pointer;
          color: var(--text-muted); font-size: 11px; font-family: inherit;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.12s, color 0.12s;
        }
        .mp-search-clear:hover { background: var(--bg-hover); color: var(--text-primary); }
        .mp-search {
          background: var(--bg-secondary); border: 1.5px solid var(--border);
          border-radius: 11px; padding: 10px 38px 10px 38px;
          font-size: 14px; color: var(--text-primary); outline: none;
          width: 100%; transition: border-color 0.15s, box-shadow 0.15s;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2.5'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: 13px center;
          font-family: inherit; box-sizing: border-box;
        }
        .mp-search:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
        .mp-search::placeholder { color: var(--text-muted); }

        /* View toggle */
        .mp-view-toggle { display: flex; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; padding: 3px; gap: 2px; }
        .mp-vt-btn {
          padding: 6px 14px; border-radius: 8px; border: none; cursor: pointer;
          font-size: 13px; font-weight: 600; font-family: inherit;
          color: var(--text-muted); background: none; transition: all 0.12s;
        }
        .mp-vt-btn:hover { color: var(--text-primary); }
        .mp-vt-btn.active { background: var(--bg-primary); color: var(--text-primary); box-shadow: 0 1px 4px rgba(0,0,0,${isDark ? '0.3' : '0.1'}); }

        /* ── LIST VIEW (TABLE) ── */
        .mp-table-card {
          background: var(--bg-primary); border: 1px solid var(--border);
          border-radius: 18px; overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,${isDark ? '0.3' : '0.05'});
        }
        .mp-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .mp-table thead tr { border-bottom: 1px solid var(--border); }
        .mp-th {
          padding: 14px 18px; font-size: 11.5px; font-weight: 700;
          color: var(--text-muted); text-transform: uppercase;
          letter-spacing: 0.06em; white-space: nowrap; background: var(--bg-secondary);
        }
        .mp-th.sortable { cursor: pointer; user-select: none; transition: color 0.15s; }
        .mp-th.sortable:hover { color: var(--text-primary); }
        .mp-th.sorted { color: var(--text-primary); }
        .mp-table tbody tr {
          border-bottom: 1px solid var(--border);
          cursor: pointer; transition: background 0.12s;
        }
        .mp-table tbody tr:last-child { border-bottom: none; }
        .mp-table tbody tr:hover { background: var(--bg-hover); }
        .mp-boosted-row {
          background: linear-gradient(90deg, var(--boost-light) 0%, transparent 60%);
          border-left: 3px solid var(--boost);
        }
        .mp-boosted-row:hover { background: linear-gradient(90deg, var(--boost-light) 0%, var(--bg-hover) 70%) !important; }
        .mp-boosted-tag {
          display: inline-block; margin-left: 8px;
          background: var(--boost); color: #fff;
          font-size: 9.5px; font-weight: 800; letter-spacing: 0.1em;
          padding: 2px 6px; border-radius: 4px; vertical-align: middle;
          text-transform: uppercase;
        }
        .mp-card-boosted {
          position: relative;
          border-color: var(--boost) !important;
          box-shadow: 0 0 0 1px var(--boost), 0 6px 20px rgba(234,88,12,0.18);
        }
        .mp-card-boosted-tag {
          position: absolute; top: -10px; left: 16px;
          background: var(--boost); color: #fff;
          font-size: 10.5px; font-weight: 800; letter-spacing: 0.08em;
          padding: 3px 10px; border-radius: 6px;
          text-transform: uppercase;
          box-shadow: 0 2px 8px rgba(234,88,12,0.4);
        }
        .mp-td { padding: 14px 18px; vertical-align: middle; }
        .mp-td-rank { font-size: 13px; font-weight: 600; color: var(--text-muted); width: 48px; text-align: center; }
        .mp-token-cell { display: flex; align-items: center; gap: 13px; min-width: 0; }
        .mp-token-icon {
          width: 38px; height: 38px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; color: #fff; flex-shrink: 0; object-fit: cover;
        }
        .mp-token-name { font-size: 14px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mp-token-sym { font-size: 12px; color: var(--text-muted); font-weight: 500; margin-top: 1px; }
        .mp-td-price { text-align: right; font-size: 14px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; white-space: nowrap; }
        .mp-td-change { text-align: right; font-size: 13.5px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .mp-td-mc { text-align: right; font-size: 14px; font-weight: 600; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
        .mp-td-actions { text-align: right; white-space: nowrap; display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
        .mp-trade-btn {
          background: var(--accent); color: #fff; border: none;
          padding: 8px 18px; border-radius: 9px;
          font-size: 13px; font-weight: 600; cursor: pointer;
          transition: background 0.15s; font-family: inherit;
        }
        .mp-trade-btn:hover { background: var(--accent-hover); }
        .mp-boost-btn {
          display: inline-flex; align-items: center;
          background: var(--boost-light); border: 1.5px solid var(--boost);
          color: var(--boost); padding: 8px 14px; border-radius: 9px;
          font-size: 13px; font-weight: 600; text-decoration: none; line-height: 1;
          transition: background 0.12s, color 0.12s;
        }
        .mp-boost-btn:hover { background: var(--boost); color: #fff; }
        .mp-star-btn {
          background: transparent; border: 1.5px solid var(--border);
          border-radius: 8px; width: 34px; height: 34px;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; color: var(--text-muted); cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
        }
        .mp-star-btn:hover { border-color: var(--text-muted); }
        .mp-star-btn.starred { color: #f5c518; border-color: #f5c518; }

        /* ── GRID VIEW (CARDS) ── */
        .mp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
        .mp-card {
          background: var(--bg-primary); border: 1px solid var(--border);
          border-radius: 16px; padding: 20px; cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
        }
        .mp-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,${isDark ? '0.4' : '0.10'});
          border-color: var(--accent);
        }
        .mp-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 10px; }
        .mp-card-identity { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .mp-card-icon {
          width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 700; color: #fff; object-fit: cover;
        }
        .mp-card-name { font-size: 15px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mp-card-sym { font-size: 12px; color: var(--text-muted); font-weight: 500; margin-top: 2px; }
        .mp-card-badge {
          font-size: 12.5px; font-weight: 700; padding: 4px 9px; border-radius: 8px;
          white-space: nowrap; flex-shrink: 0;
        }
        .mp-card-price {
          font-size: 20px; font-weight: 800; color: var(--text-primary);
          letter-spacing: -0.025em; font-variant-numeric: tabular-nums;
          margin-bottom: 4px;
        }
        .mp-card-mc { font-size: 12.5px; color: var(--text-muted); font-weight: 500; margin-bottom: 16px; }
        .mp-card-footer { display: flex; align-items: center; gap: 8px; }
        .mp-card-trade {
          flex: 1; background: var(--accent); color: #fff; border: none;
          padding: 9px 0; border-radius: 10px; font-size: 13.5px; font-weight: 600;
          cursor: pointer; font-family: inherit; transition: background 0.15s;
        }
        .mp-card-trade:hover { background: var(--accent-hover); }
        .mp-card-star {
          background: transparent; border: 1.5px solid var(--border);
          border-radius: 9px; width: 36px; height: 36px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; color: var(--text-muted); cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
        }
        .mp-card-star:hover { border-color: var(--text-muted); }
        .mp-card-star.starred { color: #f5c518; border-color: #f5c518; }

        /* ── EMPTY / ERROR ── */
        .mp-empty { text-align: center; padding: 72px 20px; color: var(--text-muted); font-size: 15px; }
        .mp-empty-strong { font-size: 17px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
        .mp-retry-btn, .mp-empty-cta {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--accent); color: #fff; border: none;
          padding: 10px 22px; border-radius: 10px; font-size: 14px; font-weight: 600;
          cursor: pointer; font-family: inherit; margin-top: 18px;
          transition: background 0.15s;
          text-decoration: none;
        }
        .mp-retry-btn:hover, .mp-empty-cta:hover { background: var(--accent-hover); }

        /* ── SKELETON ── */
        @keyframes mp-skel {
          0% { background-position: -200px 0; }
          100% { background-position: calc(200px + 100%) 0; }
        }
        .mp-skel {
          display: inline-block; height: 14px; border-radius: 6px;
          background: linear-gradient(90deg, var(--bg-secondary) 0px, var(--bg-hover) 80px, var(--bg-secondary) 160px);
          background-size: 200px 100%;
          animation: mp-skel 1.2s linear infinite;
        }
        .mp-skel-row td { padding: 16px 18px; }
        .mp-skel-avatar {
          width: 32px; height: 32px; border-radius: 10px; vertical-align: middle;
        }

        /* ── FOOTER ── */
        .mp-footer { border-top: 1px solid var(--border); padding: 24px; text-align: center; font-size: 12px; color: var(--text-muted); }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .mp-page-head { flex-direction: column; align-items: stretch; }
          .mp-controls { width: 100%; }
          .mp-search-wrap { max-width: none; }
        }
        @media (max-width: 680px) {
          .mp-main { padding: 28px 16px 60px; }
          .mp-td-mc, .mp-th:nth-child(5) { display: none; }
          .mp-td-change, .mp-th:nth-child(4) { display: none; }
          .mp-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
          .mp-controls { flex-wrap: wrap; gap: 8px; }
          .mp-view-toggle { order: 2; }
          .mp-search-wrap { order: 1; flex: 1 1 100%; min-width: 0; }
        }
        @media (max-width: 440px) {
          .mp-grid { grid-template-columns: 1fr; }
          .mp-td-price, .mp-th:nth-child(3) { font-size: 12.5px; }
        }
      `}</style>

      <div className="mp-page">
        <PageShell>
        <main className="mp-main">
          <div className="mp-page-head">
            <div>
              <h1 className="mp-title">Markets</h1>
              <p className="mp-sub">
                {searchQuery.trim()
                  ? `${tokens.length} of ${rawTokens.length} token${rawTokens.length !== 1 ? 's' : ''} match "${searchQuery.trim()}"`
                  : rawTokens.length > 0
                    ? `${rawTokens.length} token${rawTokens.length !== 1 ? 's' : ''} live on Aptos testnet`
                    : 'All tokens on MoveMint'}
              </p>
            </div>
            <div className="mp-controls">
              <div className="mp-view-toggle">
                <button
                  className={`mp-vt-btn${viewMode === 'list' ? ' active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="List view"
                >
                  List
                </button>
                <button
                  className={`mp-vt-btn${viewMode === 'grid' ? ' active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid view"
                >
                  Grid
                </button>
              </div>
              <div className="mp-search-wrap">
                <input
                  type="text"
                  className="mp-search"
                  placeholder="Search by name or ticker…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    className="mp-search-clear"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── LIST VIEW ── */}
          {viewMode === 'list' && (
            <div className="mp-table-card">
              <table className="mp-table">
                <thead>
                  <tr>
                    <th className="mp-th" style={{ textAlign: 'center' }}>#</th>
                    <th className="mp-th" style={{ textAlign: 'left' }}>Token</th>
                    <th
                      className={`mp-th sortable${sortKey === 'price' ? ' sorted' : ''}`}
                      style={{ textAlign: 'right' }}
                      onClick={() => handleSort('price')}
                    >
                      Price{sortIcon('price')}
                    </th>
                    <th
                      className={`mp-th sortable${sortKey === 'change' ? ' sorted' : ''}`}
                      style={{ textAlign: 'right' }}
                      onClick={() => handleSort('change')}
                    >
                      24h{sortIcon('change')}
                    </th>
                    <th
                      className={`mp-th sortable${sortKey === 'mc' ? ' sorted' : ''}`}
                      style={{ textAlign: 'right' }}
                      onClick={() => handleSort('mc')}
                    >
                      Market cap{sortIcon('mc')}
                    </th>
                    <th className="mp-th" style={{ textAlign: 'right' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {boostedLeader && !loading && (() => {
                    const token = boostedLeader.token;
                    const change = token.change24h;
                    const changeColor = change == null
                      ? 'var(--text-muted)'
                      : change >= 0 ? 'var(--positive)' : 'var(--negative)';
                    const starred = !!(token.metadataAddress || token.txHash) &&
                      isInWatchlist(token.metadataAddress || token.txHash);
                    return (
                      <tr className="mp-boosted-row" onClick={() => handleTradeClick(token)}>
                        <td className="mp-td mp-td-rank" title={`${boostedLeader.apt.toFixed(2)} APT boosted (24h)`}>
                          <span style={{ color: 'var(--boost)', fontWeight: 800, fontSize: 13 }}>↑1</span>
                        </td>
                        <td className="mp-td">
                          <div className="mp-token-cell">
                            <TokenAvatar
                              image={token.image}
                              symbol={token.symbol}
                              className="mp-token-icon"
                              background={getIconBg(token.symbol)}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div className="mp-token-name">
                                {token.name}
                                <span className="mp-boosted-tag">BOOSTED</span>
                              </div>
                              <div className="mp-token-sym">{symbolWithDollar(token.symbol)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="mp-td mp-td-price">{priceLabel(token)}</td>
                        <td className="mp-td mp-td-change" style={{ color: changeColor }}>
                          {change == null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`}
                        </td>
                        <td className="mp-td mp-td-mc">
                          {token.marketCapUSD != null ? formatBig(token.marketCapUSD) : '—'}
                        </td>
                        <td className="mp-td">
                          <div className="mp-td-actions">
                            <Link
                              to={`/boost?token=${token.metadataAddress || token.txHash}`}
                              className="mp-boost-btn"
                              onClick={e => e.stopPropagation()}
                              title="Overtake this boost"
                            >
                              Overtake
                            </Link>
                            <button
                              className="mp-trade-btn"
                              onClick={e => { e.stopPropagation(); handleTradeClick(token); }}
                            >
                              Trade
                            </button>
                            <button
                              className={`mp-star-btn${starred ? ' starred' : ''}`}
                              onClick={e => handleStarClick(token, e)}
                              title={starred ? 'Remove from watchlist' : 'Add to watchlist'}
                            >
                              {starred ? '★' : '☆'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })()}
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={`skel-${i}`} className="mp-skel-row">
                        <td className="mp-td mp-td-rank"><span className="mp-skel" style={{ width: 16 }}></span></td>
                        <td className="mp-td">
                          <div className="mp-token-cell">
                            <span className="mp-skel mp-skel-avatar"></span>
                            <div style={{ minWidth: 0 }}>
                              <span className="mp-skel" style={{ width: 110, marginBottom: 6 }}></span><br/>
                              <span className="mp-skel" style={{ width: 50, height: 11 }}></span>
                            </div>
                          </div>
                        </td>
                        <td className="mp-td mp-td-price"><span className="mp-skel" style={{ width: 70 }}></span></td>
                        <td className="mp-td mp-td-change"><span className="mp-skel" style={{ width: 50 }}></span></td>
                        <td className="mp-td mp-td-mc"><span className="mp-skel" style={{ width: 80 }}></span></td>
                        <td className="mp-td"><span className="mp-skel" style={{ width: 110 }}></span></td>
                      </tr>
                    ))
                  ) : tokens.length === 0 && error ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="mp-empty">
                          <div className="mp-empty-strong">Couldn't load tokens</div>
                          <div>The Aptos network may be under load. Give it another try.</div>
                          <button className="mp-retry-btn" onClick={() => refetch()}>Retry</button>
                        </div>
                      </td>
                    </tr>
                  ) : tokens.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="mp-empty">
                          {searchQuery ? (
                            <>
                              <div className="mp-empty-strong">No tokens match "{searchQuery}"</div>
                              <div>Try a different search or clear the filter.</div>
                            </>
                          ) : (
                            <>
                              <div className="mp-empty-strong">No tokens launched yet</div>
                              <div>Be the first to spin one up.</div>
                              <Link to="/launch" className="mp-empty-cta">Launch a token</Link>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    tokens.map((token, i) => {
                      const change = token.change24h;
                      const changeColor = change == null
                        ? 'var(--text-muted)'
                        : change >= 0 ? 'var(--positive)' : 'var(--negative)';
                      const starred = !!(token.metadataAddress || token.txHash) &&
                        isInWatchlist(token.metadataAddress || token.txHash);
                      return (
                        <tr key={i} onClick={() => handleTradeClick(token)}>
                          <td className="mp-td mp-td-rank">{i + 1}</td>
                          <td className="mp-td">
                            <div className="mp-token-cell">
                              <TokenAvatar
                                image={token.image}
                                symbol={token.symbol}
                                className="mp-token-icon"
                                background={getIconBg(token.symbol)}
                              />
                              <div style={{ minWidth: 0 }}>
                                <div className="mp-token-name">{token.name}</div>
                                <div className="mp-token-sym">{symbolWithDollar(token.symbol)}</div>
                              </div>
                            </div>
                          </td>
                          <td className="mp-td mp-td-price">{priceLabel(token)}</td>
                          <td className="mp-td mp-td-change" style={{ color: changeColor }}>
                            {change == null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`}
                          </td>
                          <td className="mp-td mp-td-mc">
                            {token.marketCapUSD != null ? formatBig(token.marketCapUSD) : '—'}
                          </td>
                          <td className="mp-td">
                            <div className="mp-td-actions">
                              <Link
                                to={`/boost?token=${token.metadataAddress || token.txHash}`}
                                className="mp-boost-btn"
                                onClick={e => e.stopPropagation()}
                                title="Boost this token"
                              >
                                Boost
                              </Link>
                              <button
                                className="mp-trade-btn"
                                onClick={e => { e.stopPropagation(); handleTradeClick(token); }}
                              >
                                Trade
                              </button>
                              <button
                                className={`mp-star-btn${starred ? ' starred' : ''}`}
                                onClick={e => handleStarClick(token, e)}
                                title={starred ? 'Remove from watchlist' : 'Add to watchlist'}
                              >
                                {starred ? '★' : '☆'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── GRID VIEW ── */}
          {viewMode === 'grid' && (
            loading ? (
              <div className="mp-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={`gskel-${i}`} className="mp-card" style={{ cursor: 'default' }}>
                    <div className="mp-card-head">
                      <div className="mp-card-identity">
                        <span className="mp-skel mp-skel-avatar"></span>
                        <div>
                          <span className="mp-skel" style={{ width: 80, marginBottom: 6 }}></span><br/>
                          <span className="mp-skel" style={{ width: 40, height: 11 }}></span>
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <span className="mp-skel" style={{ width: '70%' }}></span><br/>
                      <span className="mp-skel" style={{ width: '50%', marginTop: 6 }}></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : tokens.length === 0 && error ? (
              <div className="mp-empty">
                <div className="mp-empty-strong">Couldn't load tokens</div>
                <div>The Aptos network may be under load. Give it another try.</div>
                <button className="mp-retry-btn" onClick={() => refetch()}>Retry</button>
              </div>
            ) : tokens.length === 0 ? (
              <div className="mp-empty">
                {searchQuery ? (
                  <>
                    <div className="mp-empty-strong">No tokens match "{searchQuery}"</div>
                    <div>Try a different search or clear the filter.</div>
                  </>
                ) : (
                  <>
                    <div className="mp-empty-strong">No tokens launched yet</div>
                    <div>Be the first to spin one up.</div>
                    <Link to="/launch" className="mp-empty-cta">Launch a token</Link>
                  </>
                )}
              </div>
            ) : (
              <div className="mp-grid">
                {boostedLeader && (() => {
                  const token = boostedLeader.token;
                  const change = token.change24h;
                  const isPos = change == null || change >= 0;
                  const changeColor = change == null ? 'var(--text-muted)' : isPos ? 'var(--positive)' : 'var(--negative)';
                  const changeBg = change == null
                    ? 'var(--bg-secondary)'
                    : isPos
                      ? (isDark ? 'rgba(16,185,129,0.15)' : 'rgba(5,150,105,0.10)')
                      : (isDark ? 'rgba(215,0,21,0.15)' : 'rgba(215,0,21,0.08)');
                  const starred = !!(token.metadataAddress || token.txHash) &&
                    isInWatchlist(token.metadataAddress || token.txHash);
                  return (
                    <div className="mp-card mp-card-boosted" onClick={() => handleTradeClick(token)}>
                      <div className="mp-card-boosted-tag">BOOSTED · {boostedLeader.apt.toFixed(2)} APT</div>
                      <div className="mp-card-head">
                        <div className="mp-card-identity">
                          <TokenAvatar image={token.image} symbol={token.symbol} className="mp-card-icon" background={getIconBg(token.symbol)} />
                          <div style={{ minWidth: 0 }}>
                            <div className="mp-card-name">{token.name}</div>
                            <div className="mp-card-sym">{symbolWithDollar(token.symbol)}</div>
                          </div>
                        </div>
                        <span className="mp-card-badge" style={{ color: changeColor, background: changeBg }}>
                          {change == null ? 'New' : `${isPos ? '+' : ''}${change.toFixed(2)}%`}
                        </span>
                      </div>
                      <div className="mp-card-price">{priceLabel(token)}</div>
                      <div className="mp-card-mc">
                        MCap: {token.marketCapUSD != null ? formatBig(token.marketCapUSD) : '—'}
                      </div>
                      <div className="mp-card-footer">
                        <Link
                          to={`/boost?token=${token.metadataAddress || token.txHash}`}
                          className="mp-boost-btn"
                          onClick={e => e.stopPropagation()}
                          title="Overtake this boost"
                        >
                          Overtake
                        </Link>
                        <button className="mp-card-trade" onClick={e => { e.stopPropagation(); handleTradeClick(token); }}>Trade</button>
                        <button
                          className={`mp-card-star${starred ? ' starred' : ''}`}
                          onClick={e => handleStarClick(token, e)}
                          title={starred ? 'Remove from watchlist' : 'Add to watchlist'}
                        >
                          {starred ? '★' : '☆'}
                        </button>
                      </div>
                    </div>
                  );
                })()}
                {tokens.map((token, i) => {
                  const change = token.change24h;
                  const isPos = change == null || change >= 0;
                  const changeColor = change == null ? 'var(--text-muted)' : isPos ? 'var(--positive)' : 'var(--negative)';
                  const changeBg = change == null
                    ? 'var(--bg-secondary)'
                    : isPos
                      ? (isDark ? 'rgba(16,185,129,0.15)' : 'rgba(5,150,105,0.10)')
                      : (isDark ? 'rgba(215,0,21,0.15)' : 'rgba(215,0,21,0.08)');
                  const starred = !!(token.metadataAddress || token.txHash) &&
                    isInWatchlist(token.metadataAddress || token.txHash);
                  return (
                    <div key={i} className="mp-card" onClick={() => handleTradeClick(token)}>
                      <div className="mp-card-head">
                        <div className="mp-card-identity">
                          <TokenAvatar
                            image={token.image}
                            symbol={token.symbol}
                            className="mp-card-icon"
                            background={getIconBg(token.symbol)}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div className="mp-card-name">{token.name}</div>
                            <div className="mp-card-sym">{symbolWithDollar(token.symbol)}</div>
                          </div>
                        </div>
                        <span className="mp-card-badge" style={{ color: changeColor, background: changeBg }}>
                          {change == null ? 'New' : `${isPos ? '+' : ''}${change.toFixed(2)}%`}
                        </span>
                      </div>
                      <div className="mp-card-price">{priceLabel(token)}</div>
                      <div className="mp-card-mc">
                        MCap: {token.marketCapUSD != null ? formatBig(token.marketCapUSD) : '—'}
                      </div>
                      <div className="mp-card-footer">
                        <Link
                          to={`/boost?token=${token.metadataAddress || token.txHash}`}
                          className="mp-boost-btn"
                          onClick={e => e.stopPropagation()}
                          title="Boost this token"
                        >
                          Boost
                        </Link>
                        <button
                          className="mp-card-trade"
                          onClick={e => { e.stopPropagation(); handleTradeClick(token); }}
                        >
                          Trade
                        </button>
                        <button
                          className={`mp-card-star${starred ? ' starred' : ''}`}
                          onClick={e => handleStarClick(token, e)}
                          title={starred ? 'Remove from watchlist' : 'Add to watchlist'}
                        >
                          {starred ? '★' : '☆'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </main>
        </PageShell>
      </div>
    </>
  );
};

export default Marketplace;
