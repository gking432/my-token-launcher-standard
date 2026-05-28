import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWatchlist } from '../contexts/WatchlistContext';
import TokenAvatar from './TokenAvatar';
import { BOOST_ENABLED } from '../featureFlags';

export const SIDEBAR_WIDTH_PX = 232;

const ALL_NAV_ITEMS: { to: string; label: string; emoji: string; key: string; boost?: boolean }[] = [
  { to: '/',            label: 'Home',        emoji: '◎', key: 'home' },
  { to: '/marketplace', label: 'Marketplace', emoji: '⌗', key: 'marketplace' },
  { to: '/boost',       label: 'Boost',       emoji: '◆', key: 'boost', boost: true },
  { to: '/launch',      label: 'Launch',      emoji: '↑', key: 'launch' },
  { to: '/about',       label: 'About',       emoji: '?', key: 'about' },
];

const NAV_ITEMS = ALL_NAV_ITEMS.filter(item => item.key !== 'boost' || BOOST_ENABLED);

const LeftSidebar: React.FC = () => {
  const { pathname } = useLocation();
  const { watchlist } = useWatchlist();

  const isActive = (to: string) => {
    if (to === '/') return pathname === '/';
    return pathname === to || pathname.startsWith(to + '/');
  };

  return (
    <>
      <style>{`
        .ls-aside {
          width: ${SIDEBAR_WIDTH_PX}px;
          flex-shrink: 0;
          border-right: 1px solid var(--border);
          background: var(--bg-primary);
        }
        .ls-sticky {
          position: sticky;
          top: var(--mm-header-offset, 60px);
          max-height: calc(100vh - var(--mm-header-offset, 60px));
          overflow-y: auto;
          padding: 20px 14px 28px;
        }
        .ls-sticky::-webkit-scrollbar { width: 6px; }
        .ls-sticky::-webkit-scrollbar-thumb {
          background: var(--border); border-radius: 3px;
        }
        .ls-section-label {
          font-size: 11px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.08em;
          padding: 0 10px 8px;
        }
        .ls-nav { display: flex; flex-direction: column; gap: 2px; margin-bottom: 24px; }
        .ls-link {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 10px; border-radius: 9px;
          font-size: 14px; font-weight: 500;
          color: var(--text-secondary); text-decoration: none;
          transition: background 0.12s, color 0.12s;
        }
        .ls-link:hover { background: var(--bg-secondary); color: var(--text-primary); }
        .ls-link.active {
          background: var(--bg-secondary); color: var(--text-primary);
          font-weight: 600;
        }
        .ls-link.boost { color: var(--boost); font-weight: 700; }
        .ls-link.boost:hover, .ls-link.boost.active { background: var(--boost-light); }
        .ls-link-emoji { width: 18px; text-align: center; font-size: 14px; }

        .ls-wl-empty {
          padding: 12px 10px; font-size: 12.5px; color: var(--text-muted);
          line-height: 1.5;
        }
        .ls-wl-list { display: flex; flex-direction: column; gap: 2px; }
        .ls-wl-item {
          display: flex; align-items: center; gap: 9px;
          padding: 7px 8px; border-radius: 9px;
          color: var(--text-primary); text-decoration: none;
          transition: background 0.12s;
        }
        .ls-wl-item:hover { background: var(--bg-secondary); }
        .ls-wl-icon {
          width: 28px; height: 28px; border-radius: 8px;
          flex-shrink: 0; font-size: 12px; color: var(--text-secondary);
          font-weight: 700;
        }
        .ls-wl-meta { min-width: 0; flex: 1; }
        .ls-wl-name {
          font-size: 13px; font-weight: 600;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ls-wl-sym { font-size: 11px; color: var(--text-muted); font-weight: 600; }

        @media (max-width: 900px) {
          .ls-aside { display: none; }
        }
      `}</style>
      <aside className="ls-aside">
        <div className="ls-sticky">
        <div className="ls-section-label">Navigate</div>
        <nav className="ls-nav">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.key}
              to={item.to}
              className={`ls-link${item.boost ? ' boost' : ''}${isActive(item.to) ? ' active' : ''}`}
            >
              <span className="ls-link-emoji">{item.emoji}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ls-section-label">Watchlist</div>
        {watchlist.length === 0 ? (
          <div className="ls-wl-empty">
            No tokens watched yet. Tap the ☆ on any token to add it here.
          </div>
        ) : (
          <div className="ls-wl-list">
            {watchlist.map(t => (
              <Link
                key={t.metadataAddress}
                to={`/newtoken/${t.metadataAddress}`}
                className="ls-wl-item"
              >
                <TokenAvatar
                  image={t.icon && t.icon.startsWith('http') ? t.icon : null}
                  symbol={t.symbol}
                  className="ls-wl-icon"
                  background={t.iconBg || 'var(--bg-tertiary)'}
                />
                <div className="ls-wl-meta">
                  <div className="ls-wl-name">{t.name}</div>
                  <div className="ls-wl-sym">{t.symbol.startsWith('$') ? t.symbol : `$${t.symbol}`}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
        </div>
      </aside>
    </>
  );
};

export default LeftSidebar;
