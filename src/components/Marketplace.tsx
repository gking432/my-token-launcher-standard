import React, { useState, useMemo } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Link, useNavigate } from 'react-router-dom';
import { useTokenData } from '../hooks/useTokenData';
import { useTokenList } from '../data/useTokenList';
import { useAptPrice } from '../contexts/AptPriceContext';
import { useWatchlist } from '../contexts/WatchlistContext';
import { useTheme } from '../contexts/ThemeContext';

type SortKey = 'newest' | 'price' | 'change' | 'mc';
type SortDir = 'desc' | 'asc';

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

const Marketplace: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const { account } = useWallet();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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

  const tokens = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? rawTokens.filter(t =>
          t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q)
        )
      : rawTokens;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'newest': cmp = new Date(b.launchDate).getTime() - new Date(a.launchDate).getTime(); break;
        case 'price':  cmp = (b.priceUSD ?? b.price ?? 0) - (a.priceUSD ?? a.price ?? 0); break;
        case 'change': cmp = (b.change24h ?? 0) - (a.change24h ?? 0); break;
        case 'mc':     cmp = (b.marketCapUSD ?? 0) - (a.marketCapUSD ?? 0); break;
      }
      return sortDir === 'asc' ? -cmp : cmp;
    });
  }, [rawTokens, searchQuery, sortKey, sortDir]);

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

        /* ── HEADER ── */
        .mp-header {
          position: sticky; top: 0; z-index: 100; height: 56px;
          background: ${isDark ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.78)'};
          backdrop-filter: saturate(180%) blur(20px);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
          border-bottom: 1px solid var(--border);
        }
        .mp-nav {
          max-width: 1280px; margin: 0 auto; height: 100%;
          padding: 0 24px; display: flex; align-items: center; justify-content: space-between;
        }
        .mp-logo {
          display: flex; align-items: center; gap: 9px;
          font-size: 19px; font-weight: 700; letter-spacing: -0.025em;
          color: var(--text-primary); text-decoration: none;
        }
        .mp-logo-mark {
          width: 26px; height: 26px; border-radius: 8px;
          background: linear-gradient(145deg, var(--accent), var(--accent-hover));
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 14px; font-weight: 800;
          box-shadow: 0 2px 8px rgba(5,150,105,0.35);
        }
        .mp-nav-links {
          display: flex; gap: 30px; list-style: none; margin: 0; padding: 0;
        }
        .mp-nav-links a {
          font-size: 14px; font-weight: 500; color: var(--text-secondary);
          text-decoration: none; transition: color 0.15s;
        }
        .mp-nav-links a:hover, .mp-nav-links a.active { color: var(--text-primary); }
        .mp-nav-actions { display: flex; align-items: center; gap: 10px; }
        .mp-theme-btn {
          background: var(--bg-secondary); border: 1px solid var(--border); cursor: pointer;
          width: 34px; height: 34px; font-size: 14px; line-height: 1;
          color: var(--text-secondary); border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .mp-theme-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .mp-cta-pill {
          background: var(--accent); color: #fff; padding: 9px 18px; border-radius: 10px;
          font-size: 14px; font-weight: 600; text-decoration: none;
          transition: background 0.15s; box-shadow: 0 2px 10px rgba(5,150,105,0.3);
        }
        .mp-cta-pill:hover { background: var(--accent-hover); }

        /* ── MAIN ── */
        .mp-main { max-width: 1280px; margin: 0 auto; padding: 52px 24px 80px; }

        .mp-page-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          flex-wrap: wrap; gap: 18px; margin-bottom: 32px;
        }
        .mp-title {
          font-size: clamp(28px, 3vw, 36px); font-weight: 700;
          letter-spacing: -0.03em; color: var(--text-primary); margin: 0 0 6px;
        }
        .mp-sub { font-size: 15px; color: var(--text-secondary); margin: 0; }

        .mp-search-wrap { position: relative; }
        .mp-search {
          background: var(--bg-secondary); border: 1.5px solid var(--border);
          border-radius: 11px; padding: 10px 16px 10px 38px;
          font-size: 14px; color: var(--text-primary); outline: none;
          width: 260px; transition: border-color 0.15s, box-shadow 0.15s;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2.5'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: 13px center;
          font-family: inherit;
        }
        .mp-search:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
        .mp-search::placeholder { color: var(--text-muted); }

        /* ── TABLE CARD ── */
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

        .mp-td { padding: 14px 18px; vertical-align: middle; }
        .mp-td-rank {
          font-size: 13px; font-weight: 600; color: var(--text-muted);
          width: 48px; text-align: center;
        }
        .mp-token-cell { display: flex; align-items: center; gap: 13px; min-width: 0; }
        .mp-token-icon {
          width: 38px; height: 38px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; color: #fff; flex-shrink: 0;
          object-fit: cover;
        }
        .mp-token-name {
          font-size: 14px; font-weight: 700; color: var(--text-primary);
          letter-spacing: -0.01em; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
        }
        .mp-token-sym { font-size: 12px; color: var(--text-muted); font-weight: 500; margin-top: 1px; }

        .mp-td-price {
          text-align: right; font-size: 14px; font-weight: 700;
          color: var(--text-primary); font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .mp-td-change {
          text-align: right; font-size: 13.5px; font-weight: 700;
          font-variant-numeric: tabular-nums; white-space: nowrap;
        }
        .mp-td-mc {
          text-align: right; font-size: 14px; font-weight: 600;
          color: var(--text-secondary); font-variant-numeric: tabular-nums;
        }
        .mp-td-actions {
          text-align: right; white-space: nowrap;
          display: flex; align-items: center; justify-content: flex-end; gap: 8px;
        }
        .mp-trade-btn {
          background: var(--accent); color: #fff; border: none;
          padding: 8px 18px; border-radius: 9px;
          font-size: 13px; font-weight: 600; cursor: pointer;
          transition: background 0.15s; font-family: inherit;
        }
        .mp-trade-btn:hover { background: var(--accent-hover); }
        .mp-star-btn {
          background: transparent; border: 1.5px solid var(--border);
          border-radius: 8px; width: 34px; height: 34px;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; color: var(--text-muted); cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
        }
        .mp-star-btn:hover { border-color: var(--text-muted); }
        .mp-star-btn.starred { color: #f5c518; border-color: #f5c518; }

        .mp-empty {
          text-align: center; padding: 72px 20px;
          color: var(--text-muted); font-size: 15px;
        }
        .mp-retry-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--accent); color: #fff; border: none;
          padding: 10px 22px; border-radius: 10px; font-size: 14px; font-weight: 600;
          cursor: pointer; font-family: inherit; margin-top: 18px;
          transition: background 0.15s;
        }
        .mp-retry-btn:hover { background: var(--accent-hover); }

        /* ── FOOTER ── */
        .mp-footer {
          border-top: 1px solid var(--border);
          padding: 24px; text-align: center;
          font-size: 12px; color: var(--text-muted);
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) { .mp-nav-links { display: none; } }
        @media (max-width: 680px) {
          .mp-main { padding: 32px 16px 60px; }
          .mp-td-mc, .mp-th:nth-child(5) { display: none; }
          .mp-search { width: 100%; }
        }
      `}</style>

      <div className="mp-page">
        {/* ── HEADER ── */}
        <header className="mp-header">
          <div className="mp-nav">
            <Link to="/" className="mp-logo">
              <div className="mp-logo-mark">M</div>
              MoveMint
            </Link>
            <ul className="mp-nav-links">
              <li><Link to="/marketplace" className="active">Marketplace</Link></li>
              <li><Link to="/launch">Launch</Link></li>
              {account && <li><Link to={`/profile/${account.address}`}>Profile</Link></li>}
            </ul>
            <div className="mp-nav-actions">
              <button className="mp-theme-btn" onClick={toggleTheme} title={isDark ? 'Light mode' : 'Dark mode'}>
                {isDark ? '☀' : '☾'}
              </button>
              <Link to="/launch" className="mp-cta-pill">Launch token</Link>
            </div>
          </div>
        </header>

        {/* ── MAIN CONTENT ── */}
        <main className="mp-main">
          <div className="mp-page-head">
            <div>
              <h1 className="mp-title">Markets</h1>
              <p className="mp-sub">
                {rawTokens.length > 0 ? `${rawTokens.length} token${rawTokens.length !== 1 ? 's' : ''} live on Aptos testnet` : 'All tokens on MoveMint'}
              </p>
            </div>
            <div className="mp-search-wrap">
              <input
                type="text"
                className="mp-search"
                placeholder="Search tokens"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

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
                {loading ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="mp-empty">Loading markets…</div>
                    </td>
                  </tr>
                ) : tokens.length === 0 && error ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="mp-empty">
                        <div style={{ marginBottom: 8 }}>Unable to load tokens. The Aptos network may be under load.</div>
                        <button className="mp-retry-btn" onClick={() => refetch()}>Retry</button>
                      </div>
                    </td>
                  </tr>
                ) : tokens.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="mp-empty">
                        {searchQuery ? `No tokens match "${searchQuery}"` : 'No tokens have launched yet.'}
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
                            {token.image ? (
                              <img
                                src={token.image}
                                alt={token.symbol}
                                className="mp-token-icon"
                                style={{ objectFit: 'cover' }}
                                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="mp-token-icon" style={{ background: getIconBg(token.symbol) }}>
                                {token.symbol.replace('$', '').charAt(0).toUpperCase()}
                              </div>
                            )}
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
        </main>

        <footer className="mp-footer">
          © 2025 MoveMint · <Link to="/launch" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Launch a token</Link>
        </footer>
      </div>
    </>
  );
};

export default Marketplace;
