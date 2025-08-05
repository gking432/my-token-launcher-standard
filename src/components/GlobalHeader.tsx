import React, { useState } from 'react';

interface TokenLeaderboardItem {
  rank: number;
  name: string;
  apt: number;
  icon: string;
  iconBg: string;
}

interface GlobalHeaderProps {
  leaderboardData: TokenLeaderboardItem[];
  countdownTime?: string;
  onTokenSelect?: (token: TokenLeaderboardItem) => void;
}

const GlobalHeader: React.FC<GlobalHeaderProps> = ({ 
  leaderboardData, 
  countdownTime = "1:00",
  onTokenSelect 
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  const toggleHeader = () => {
    setIsMinimized(!isMinimized);
  };

  return (
    <>
      <style>
        {`
          .header {
            background: #ffffff;
            border-bottom: 1px solid #e7ebee;
            padding: 0px 0;
            position: left;
            width: 100%;
            padding: 0;
            margin: 0;
            position: relative;
            transition: all 0.3s ease;
          }

          .header.minimized {
            height: 30px;
            overflow: hidden;
          }

          .header-toggle-btn {
            position: absolute;
            bottom: 5px;
            right: 10px;
            background: #ffffff;
            border: 0px solid #d3d3d3;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 12px;
            cursor: pointer;
            color: #878788;
            transition: all 0.2s ease;
            z-index: 10;
            margin-top: 10px;
          }

          .header-toggle-btn:hover {
            background: #ffffff;
            color: #050f19;
          }

          .header-toggle-btn.show {
            background: #ffffff;
            color: #a8a8a8;
            border-color: #00d4aa;
            margin-top: 10px;
          }

          .header-toggle-btn.show:hover {
            color: #00b894;
          }

          .leaderboard-header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 24px;
            border-bottom: 1px solid #e7ebee;
          }

          .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #0a0b0d;
          }

          .countdown-timer {
            background: #00d4aa;
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
          }

          .token-list {
            display: flex;
            gap: 12px;
            padding: 16px 24px;
            overflow-x: auto;
            scrollbar-width: thin;
            scrollbar-color: #e6e8ea transparent;
          }

          .token-list::-webkit-scrollbar {
            height: 6px;
          }

          .token-list::-webkit-scrollbar-track {
            background: transparent;
          }

          .token-list::-webkit-scrollbar-thumb {
            background: #e6e8ea;
            border-radius: 3px;
          }

          .token-item {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #f8f9fa;
            border: 1px solid #e6e8ea;
            border-radius: 8px;
            padding: 8px 12px;
            min-width: 140px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .token-item:hover {
            background: #e9ecef;
            border-color: #00d4aa;
          }

          .token-rank {
            font-size: 14px;
            font-weight: 600;
            color: #6c757d;
            min-width: 16px;
          }

          .token-icon {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 12px;
          }

          .token-info {
            display: flex;
            flex-direction: column;
            flex: 1;
          }

          .token-name {
            font-size: 12px;
            font-weight: 600;
            color: #0a0b0d;
            line-height: 1.2;
          }

          .token-apt {
            font-size: 11px;
            color: #00d4aa;
            font-weight: 600;
          }

          @media (max-width: 768px) {
            .token-list {
              padding: 12px 16px;
            }
            
            .token-item {
              min-width: 120px;
              padding: 6px 8px;
            }
            
            .token-name {
              font-size: 11px;
            }
            
            .token-apt {
              font-size: 10px;
            }
          }
        `}
      </style>

      <header className={`header ${isMinimized ? 'minimized' : ''}`}>
        <div className="top-communities">
          <div className="leaderboard-main-col">
            <div className="leaderboard-header-row">
              <div className="section-title">TOKEN LEADERBOARD</div>
              <div className="countdown-timer">{countdownTime}</div>
            </div>
            <div className="token-list">
              {leaderboardData.map((token) => (
                <div 
                  key={token.rank}
                  className="token-item" 
                  data-apt={token.apt}
                  onClick={() => onTokenSelect?.(token)}
                >
                  <span className="token-rank">{token.rank}</span>
                  <div 
                    className="token-icon" 
                    style={{ background: token.iconBg }}
                  >
                    {token.icon}
                  </div>
                  <div className="token-info">
                    <span className="token-name">{token.name}</span>
                    <span className="token-apt">{token.apt} APT</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <button 
          className={`header-toggle-btn ${isMinimized ? 'show' : ''}`} 
          onClick={toggleHeader}
        >
          {isMinimized ? 'View Token Leaderboard' : '__'}
        </button>
      </header>
    </>
  );
};

export default GlobalHeader; 