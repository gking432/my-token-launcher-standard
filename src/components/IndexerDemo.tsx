import React, { useState } from 'react';
import Leaderboard from './Leaderboard';
import TokenDiscovery from './TokenDiscovery';
import { MODULE_ADDRESS } from '../config';
import '../styles/IndexerDemo.css';

const IndexerDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'discovery'>('leaderboard');
  const [network, setNetwork] = useState<'mainnet' | 'testnet' | 'devnet'>('devnet');

  return (
    <div className="indexer-demo-container">
      <div className="demo-header">
        <h1>Aptos Indexer Integration Demo</h1>
        <p>Explore token discovery and leaderboard features powered by the Aptos Indexer</p>
      </div>

      <div className="demo-controls">
        <div className="network-selector">
          <label htmlFor="network-select">Network:</label>
          <select
            id="network-select"
            value={network}
            onChange={(e) => setNetwork(e.target.value as 'mainnet' | 'testnet' | 'devnet')}
            className="network-select"
          >
            <option value="devnet">Devnet</option>
            <option value="testnet">Testnet</option>
            <option value="mainnet">Mainnet</option>
          </select>
        </div>

        <div className="tab-selector">
          <button
            className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaderboard')}
          >
            🏆 Leaderboard
          </button>
          <button
            className={`tab-btn ${activeTab === 'discovery' ? 'active' : ''}`}
            onClick={() => setActiveTab('discovery')}
          >
            🔍 Token Discovery
          </button>
        </div>
      </div>

      <div className="demo-content">
        {activeTab === 'leaderboard' ? (
          <div className="tab-content">
            <div className="feature-info">
              <h3>Token Leaderboard</h3>
              <p>
                This leaderboard shows tokens ranked by total APT spent to the treasury. 
                It fetches data from the blockchain and displays real-time rankings with 
                graduation status and market cap information.
              </p>
              <div className="feature-details">
                <div className="detail-item">
                  <strong>Data Source:</strong> Aptos Blockchain + Indexer
                </div>
                <div className="detail-item">
                  <strong>Update Frequency:</strong> Real-time
                </div>
                <div className="detail-item">
                  <strong>Ranking Criteria:</strong> APT spent to treasury
                </div>
              </div>
            </div>
            <Leaderboard 
              moduleAddress={MODULE_ADDRESS} 
              network={network} 
            />
          </div>
        ) : (
          <div className="tab-content">
            <div className="feature-info">
              <h3>Token Discovery</h3>
              <p>
                Search and discover tokens on Aptos using the Indexer API. 
                This feature allows users to find tokens by name, symbol, 
                or explore popular and recent tokens.
              </p>
              <div className="feature-details">
                <div className="detail-item">
                  <strong>Data Source:</strong> Aptos Indexer GraphQL API
                </div>
                <div className="detail-item">
                  <strong>Search Capabilities:</strong> Name, Symbol, Asset Type
                </div>
                <div className="detail-item">
                  <strong>Filters:</strong> All, Recent, Popular
                </div>
              </div>
            </div>
            <TokenDiscovery 
              network={network} 
              moduleAddress={MODULE_ADDRESS}
            />
          </div>
        )}
      </div>

      <div className="demo-footer">
        <div className="tech-stack">
          <h4>Technology Stack</h4>
          <div className="tech-items">
            <span className="tech-item">Aptos Indexer</span>
            <span className="tech-item">GraphQL API</span>
            <span className="tech-item">React</span>
            <span className="tech-item">TypeScript</span>
            <span className="tech-item">Aptos SDK</span>
          </div>
        </div>
        
        <div className="api-info">
          <h4>API Information</h4>
          <p>
            <strong>Indexer URL:</strong> https://indexer.mainnet.aptoslabs.com/v1/graphql
          </p>
          <p>
            <strong>Free Tier:</strong> $10 monthly credit
          </p>
          <p>
            <strong>Rate Limits:</strong> Based on compute units (CUs)
          </p>
        </div>
      </div>
    </div>
  );
};

export default IndexerDemo; 