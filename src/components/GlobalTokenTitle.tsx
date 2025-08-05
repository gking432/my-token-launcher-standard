import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface GlobalTokenTitleProps {
  tokenName?: string;
  pageTitle?: string;
  showSearch?: boolean;
  showAuth?: boolean;
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
}

const GlobalTokenTitle: React.FC<GlobalTokenTitleProps> = ({ 
  tokenName,
  pageTitle = 'Marketplace',
  showSearch = true,
  showAuth = true,
  onSearch,
  searchPlaceholder = 'Search'
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  return (
    <>
      <style>
        {`
          .token-title {
            font-size: 32px;
            font-weight: 600;
            color: #050f19;
            background: white;
            border-bottom: 1px solid #e7ebee;
            padding: 18px 12px;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 0px;
            position: relative;
            transition: all 0.3s ease;
          }

          .token-name-group {
            display: flex;
            align-items: center;
            margin-left: 0px;
          }

          .token-name-group span {
            font-size: 32px;
            font-weight: 600;
            color: #050f19;
          }

          .searchbar {
            display: flex;
            align-items: center;
          }

          .sidebar-search {
            width: 400px;
            padding: 8px 12px;
            border: 1px solid #d3d3d3;
            border-radius: 6px;
            font-size: 14px;
            background: #f8f9fa;
            color: #050f19;
            margin-right: 20px;
          }

          .sidebar-search::placeholder {
            color: #8a9ba8;
          }

          .sidebar-search:focus {
            outline: none;
            border-color: #00d4aa;
            background: white;
          }

          .auth-section {
            display: flex;
            align-items: center;
            gap: 16px;
            font-size: 14px;
          }
          
          .settings-icon {
            width: 20px;
            height: 20px;
            cursor: pointer;
            font-size: 16px;
          }
          
          .sign-in {
            color: #0a0b0d;
            text-decoration: none;
            font-weight: 500;
            font-size: 14px;
          }
          
          .sign-up {
            background: #00d4aa;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            transition: background 0.2s;
          }

          .sign-up:hover {
            background: #00b894;
          }

          @media (max-width: 768px) {
            .token-title {
              flex-direction: column;
              align-items: stretch;
              gap: 12px;
              padding: 12px 16px;
            }
            
            .token-name-group {
              justify-content: center;
            }
            
            .token-name-group span {
              font-size: 24px;
            }
            
            .searchbar {
              justify-content: center;
            }
            
            .sidebar-search {
              width: 100%;
              max-width: 300px;
              margin-right: 0;
            }
            
            .auth-section {
              justify-content: center;
            }
          }
        `}
      </style>

      <div className="token-title">
        <div className="token-name-group">
          <span>{tokenName || pageTitle}</span>
        </div>
        
        {showSearch && (
          <div className="searchbar">
            <input 
              type="text" 
              className="sidebar-search" 
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
        )}
        
        {showAuth && (
          <div className="auth-section">
            <div className="settings-icon">⚙️</div>
            <Link to="/launch" className="sign-in">Launch</Link>
            <Link to="/connect" className="sign-up">Connect Wallet</Link>
          </div>
        )}
      </div>
    </>
  );
};

export default GlobalTokenTitle; 