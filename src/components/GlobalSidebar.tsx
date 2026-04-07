import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useWatchlist } from '../contexts/WatchlistContext';
import { useTheme } from '../contexts/ThemeContext';

interface GlobalSidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const GlobalSidebar = ({ activeTab, onTabChange }: GlobalSidebarProps): React.ReactElement => {
  const { watchlist } = useWatchlist();
  const { isDark, toggleTheme, theme: t } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: 'home',  label: 'Home',  path: '/homepage',    icon: '⌂' },
    { id: 'trade', label: 'Trade', path: '/marketplace', icon: '↗' },
    { id: 'learn', label: 'Learn', path: '/about',       icon: '◎' },
  ];
  const launchTab = { id: 'launch', label: 'Launch', path: '/launch', icon: '✦' };

  const currentActive = activeTab ||
    tabs.find(tab => tab.path === location.pathname)?.id ||
    (location.pathname === launchTab.path ? launchTab.id : null) ||
    'home';

  return (
    <div style={{
      width: '220px',
      minWidth: '220px',
      background: t.bgPrimary,
      borderRight: `1px solid ${t.border}`,
      height: '100%',
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      alignSelf: 'stretch',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Logo / Brand */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: `1px solid ${t.border}`,
      }}>
        <div style={{ fontSize: '18px', fontWeight: 700, color: t.accent, letterSpacing: '-0.3px' }}>
          MoveMint
        </div>
        <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px', fontWeight: 500 }}>
          Aptos Testnet
        </div>
      </div>

      {/* Nav Items */}
      <nav style={{ padding: '12px 0', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
        {tabs.map((tab) => {
          const isActive = currentActive === tab.id;
          return (
            <Link
              key={tab.id}
              to={tab.path}
              onClick={() => onTabChange?.(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 20px',
                color: isActive ? t.accent : t.textSecondary,
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
                background: isActive ? t.accentLight : 'transparent',
                borderLeft: `3px solid ${isActive ? t.accent : 'transparent'}`,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = t.bgHover; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span style={{ fontSize: '16px', width: '20px', textAlign: 'center', flexShrink: 0 }}>
                {tab.icon}
              </span>
              {tab.label}
            </Link>
          );
        })}

        {/* Launch CTA */}
        <div style={{ padding: '12px 12px 4px' }}>
          <Link
            to={launchTab.path}
            onClick={() => onTabChange?.(launchTab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: t.accent,
              color: '#fff',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '8px',
              transition: 'background 0.15s',
              letterSpacing: '0.1px',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = t.accentHover; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = t.accent; }}
          >
            <span style={{ fontSize: '14px' }}>✦</span>
            Launch Token
          </Link>
        </div>
      </nav>

      {/* Watchlist */}
      <div style={{ flex: 1, padding: '16px 0', overflowY: 'auto', minHeight: 0 }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          color: t.textMuted,
          padding: '0 20px 10px',
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
        }}>
          Watchlist
        </div>

        {watchlist.length > 0 ? (
          watchlist.map((item, i) => (
            <div
              key={item.metadataAddress || i}
              onClick={() => item.metadataAddress && navigate(`/newtoken/${item.metadataAddress}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 20px',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = t.bgHover; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div style={{
                width: '30px', height: '30px',
                borderRadius: '50%',
                background: item.iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: '13px',
                flexShrink: 0,
              }}>
                {item.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: t.textPrimary, lineHeight: 1.2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </div>
                <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '1px' }}>
                  {item.symbol}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '16px 20px', color: t.textMuted, fontSize: '13px', lineHeight: 1.5 }}>
            Star tokens to track them here.
          </div>
        )}
      </div>

      {/* Dark mode toggle */}
      <div style={{
        padding: '12px 20px',
        borderTop: `1px solid ${t.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '13px', color: t.textSecondary, fontWeight: 500 }}>
          {isDark ? 'Dark' : 'Light'} mode
        </span>
        <button
          onClick={toggleTheme}
          title="Toggle dark mode"
          style={{
            width: '40px', height: '22px',
            borderRadius: '11px',
            border: 'none',
            background: isDark ? t.accent : t.border,
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.2s',
            padding: 0,
            flexShrink: 0,
          }}
        >
          <span style={{
            position: 'absolute',
            top: '3px',
            left: isDark ? '21px' : '3px',
            width: '16px', height: '16px',
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
            display: 'block',
          }} />
        </button>
      </div>
    </div>
  );
};

export default GlobalSidebar;
