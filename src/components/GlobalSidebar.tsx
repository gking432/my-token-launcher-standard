import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useWatchlist } from '../contexts/WatchlistContext';

interface GlobalSidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const GlobalSidebar = ({ 
  activeTab,
  onTabChange
}: GlobalSidebarProps): React.ReactElement => {
  const { watchlist } = useWatchlist();
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: 'home', label: 'Home', path: '/homepage' },
    { id: 'trade', label: 'Trade', path: '/marketplace' },
    { id: 'learn', label: 'Learn', path: '/about' }
  ];
  
  const launchTab = { id: 'launch', label: 'Launch', path: '/launch' };

  // Determine active tab based on current location or prop
  const currentActiveTab = activeTab || 
    tabs.find(tab => tab.path === location.pathname)?.id || 
    (location.pathname === launchTab.path ? launchTab.id : null) || 
    'marketplace';

  const handleTabClick = (tabId: string) => {
    onTabChange?.(tabId);
  };

  return (
    <>
      <style>
        {`
          .sidebar {
            width: 200px;
            min-width: 200px;
            background: #ffffff;
            border-right: 1px solid #d3d3d3;
            padding: 0;
            height: 100%;
            min-height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            align-self: stretch;
            position: relative;
          }
          
          .sidebar::after {
            content: '';
            position: absolute;
            right: 0;
            top: 0;
            bottom: -9999px;
            width: 1px;
            background: #d3d3d3;
            pointer-events: none;
          }
          
          .nav-tabs {
            padding: 20px 0;
            border-bottom: 1px solid #d3d3d3;
            flex-shrink: 0;
          }
          
          .nav-tab {
            display: flex;
            align-items: center;
            padding: 12px 20px;
            color: #5b616e;
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
            transition: background 0.2s;
          }
          
          .nav-tab:hover {
            background: #f5f5f5;
            color: #0a0b0d;
          }
          
          .nav-tab.active {
            background: #f0f8ff;
            color: #00d4aa;
          }
          
          .launch-tab-container {
            margin-top: 0px;
            padding-top: 20px;
            border-top: 0px solid #e6e8ea;
          }
          
          .launch-tab {
            display: flex;
            align-items: left;
            padding: 8px 0px;
            color: #ffffff;
            text-decoration: none;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.2s;
            background: #00d4aa;
            border-radius: 6px;
            margin: 0 12px;
            justify-content: center;
          }
          
          .launch-tab:hover {
            background: #00b894;
            color: #ffffff;
          }
          
          .launch-tab.active {
            background: #00b894;
            color: #ffffff;
          }
          
          .watchlist-section {
            flex: 1;
            padding: 20px 0;
            overflow-y: auto;
            min-height: 0;
          }
          
          .section-title2 {
            font-size: 12px;
            font-weight: 600;
            color: #5b616e;
            margin-bottom: 16px;
            padding: 0 20px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .meme-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 20px;
            cursor: pointer;
            transition: all 0.2s;
          }
          
          .meme-item:hover {
            background: #f5f5f5;
          }
          
          .meme-item.active {
            background: #f0f8ff;
          }
          
          .meme-icon {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
          }
          
          .meme-info {
            flex: 1;
          }
          
          .meme-name {
            font-size: 14px;
            font-weight: 600;
            color: #0a0b0d;
            line-height: 1.2;
          }
          
          .meme-symbol {
            font-size: 12px;
            color: #5b616e;
            margin-top: 2px;
          }
          
          @media (max-width: 768px) {
            .sidebar {
              width: 100%;
              min-width: 100%;
              height: auto;
              border-right: none;
              border-bottom: 1px solid #d3d3d3;
            }
            
            .nav-tabs {
              display: flex;
              overflow-x: auto;
              padding: 12px 0;
            }
            
            .nav-tab {
              white-space: nowrap;
              padding: 8px 16px;
            }
          }
        `}
      </style>

      <div className="sidebar">
        <div className="nav-tabs">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              to={tab.path}
              className={`nav-tab ${currentActiveTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabClick(tab.id)}
            >
              {tab.label}
            </Link>
          ))}
          
          <div className="launch-tab-container">
            <Link
              to={launchTab.path}
              className={`launch-tab ${currentActiveTab === launchTab.id ? 'active' : ''}`}
              onClick={() => handleTabClick(launchTab.id)}
            >
              {launchTab.label}
            </Link>
          </div>
        </div>
        
        <div className="watchlist-section">
          <div className="section-title2">Watchlist</div>
          {watchlist.length > 0 ? (
            watchlist.map((item, index) => (
              <div 
                key={item.metadataAddress || index}
                className="meme-item"
                onClick={() => {
                  if (item.metadataAddress) {
                    navigate(`/newtoken/${item.metadataAddress}`);
                  }
                }}
              >
                <div 
                  className="meme-icon" 
                  style={{ background: item.iconBg }}
                >
                  {item.icon}
                </div>
                <div className="meme-info">
                  <div className="meme-name">{item.name}</div>
                  <div className="meme-symbol">{item.symbol}</div>
                </div>
              </div>
            ))
          ) : (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: '#8a9ba8',
              fontSize: '13px',
              lineHeight: '1.5'
            }}>
              Your watchlist is empty.<br />
              Add tokens to track them here.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default GlobalSidebar; 