import React, { useState, useEffect } from 'react';
import { getFungibleAssetInfo, getTokenMetadataURI } from '../utils/aptosIndexer';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import '../styles/TokenDiscovery.css';

interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  asset_type: string;
  metadata_uri?: string;
}

interface TokenDiscoveryProps {
  network: 'mainnet' | 'testnet' | 'devnet';
  moduleAddress?: string; // Optional: filter by our token launcher module
}

const TokenDiscovery: React.FC<TokenDiscoveryProps> = ({ network, moduleAddress }) => {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'recent' | 'popular'>('all');

  const config = new AptosConfig({ 
    network: network === 'mainnet' ? Network.MAINNET : network === 'testnet' ? Network.TESTNET : Network.DEVNET
  });
  const client = new Aptos(config);

  // Mock data for demonstration - in real implementation, this would come from the indexer
  const mockTokens: TokenInfo[] = [
    {
      symbol: 'APT',
      name: 'Aptos Coin',
      decimals: 8,
      asset_type: '0x1::aptos_coin::AptosCoin',
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      asset_type: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC',
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      asset_type: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT',
    },
  ];

  const searchTokens = async () => {
    if (!searchTerm.trim()) {
      setTokens(mockTokens);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // In a real implementation, you would:
      // 1. Search the indexer for tokens matching the search term
      // 2. Filter by module address if provided
      // 3. Fetch additional metadata from token URIs

      // For now, we'll filter the mock data
      const filteredTokens = mockTokens.filter(token => 
        token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        token.symbol.toLowerCase().includes(searchTerm.toLowerCase())
      );

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      setTokens(filteredTokens);
    } catch (err) {
      console.error('Error searching tokens:', err);
      setError(err instanceof Error ? err.message : 'Failed to search tokens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTokens(mockTokens);
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchTerm) {
        searchTokens();
      } else {
        setTokens(mockTokens);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleTokenClick = (token: TokenInfo) => {
    // Navigate to token page or open token details
    console.log('Token clicked:', token);
    // You could navigate to a token detail page here
    // navigate(`/token/${token.asset_type}`);
  };

  return (
    <div className="token-discovery-container">
      <div className="discovery-header">
        <h2>Token Discovery</h2>
        <p>Discover and explore tokens on Aptos</p>
      </div>

      <div className="search-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search tokens by name or symbol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button 
            onClick={searchTokens}
            disabled={loading}
            className="search-button"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Tokens
          </button>
          <button
            className={`filter-btn ${filter === 'recent' ? 'active' : ''}`}
            onClick={() => setFilter('recent')}
          >
            Recent
          </button>
          <button
            className={`filter-btn ${filter === 'popular' ? 'active' : ''}`}
            onClick={() => setFilter('popular')}
          >
            Popular
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)} className="close-error">
            ×
          </button>
        </div>
      )}

      <div className="tokens-grid">
        {loading ? (
          <div className="loading-message">Searching tokens...</div>
        ) : tokens.length === 0 ? (
          <div className="no-results">
            <p>No tokens found matching "{searchTerm}"</p>
            <p>Try searching for a different term</p>
          </div>
        ) : (
          tokens.map((token, index) => (
            <div 
              key={token.asset_type} 
              className="token-card"
              onClick={() => handleTokenClick(token)}
            >
              <div className="token-header">
                <div className="token-symbol">{token.symbol}</div>
                <div className="token-name">{token.name}</div>
              </div>
              
              <div className="token-details">
                <div className="detail-item">
                  <span className="label">Decimals:</span>
                  <span className="value">{token.decimals}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Address:</span>
                  <span className="value address">
                    {formatAddress(token.asset_type)}
                  </span>
                </div>
              </div>

              <div className="token-actions">
                <button className="action-btn view-btn">View Details</button>
                <button className="action-btn trade-btn">Trade</button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="discovery-footer">
        <p>
          Powered by Aptos Indexer • 
          <a 
            href="https://explorer.aptoslabs.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="explorer-link"
          >
            View on Explorer
          </a>
        </p>
      </div>
    </div>
  );
};

export default TokenDiscovery; 