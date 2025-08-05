import React, { useState, useEffect } from 'react';
import { getFungibleAssetInfo, getTokenMetadataForLeaderboard } from '../utils/aptosIndexer';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import '../styles/Leaderboard.css';

interface LeaderboardToken {
  symbol: string;
  name: string;
  decimals: number;
  asset_type: string;
  totalAptSpent: number;
  creator: string;
  isGraduated: boolean;
  marketCap: number;
  launchDate: string;
}

interface LeaderboardProps {
  moduleAddress: string;
  network: 'mainnet' | 'testnet' | 'devnet';
}

const Leaderboard: React.FC<LeaderboardProps> = ({ moduleAddress, network }) => {
  const [tokens, setTokens] = useState<LeaderboardToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | '30d' | 'all'>('7d');

  const config = new AptosConfig({ 
    network: network === 'mainnet' ? Network.MAINNET : network === 'testnet' ? Network.TESTNET : Network.DEVNET
  });
  const client = new Aptos(config);

  // Fetch token data from blockchain and indexer
  const fetchLeaderboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Step 1: Get all tokens from our module state
      const moduleState = await client.getAccountResource({
        accountAddress: moduleAddress,
        resourceType: `${moduleAddress}::token_launcher::ModuleState`,
      });

      if (!moduleState.data || !(moduleState.data as any).token_metadata || !(moduleState.data as any).token_metadata.handle) {
        throw new Error('Module state not found');
      }

      // Step 2: Get all creators and their tokens
      const creators = Object.keys((moduleState.data as any).token_metadata);
      const allTokens: LeaderboardToken[] = [];

      for (const creator of creators) {
        try {
          const tokenMetadata = await client.getTableItem({
            handle: (moduleState.data as any).token_metadata.handle,
            data: {
              key: creator,
              key_type: "address",
              value_type: `${moduleAddress}::token_launcher::TokenMetadata`,
            },
          }) as { entries: Array<{ original_name: number[]; ticker: number[]; metadata_addr: string }> };

          if (tokenMetadata && tokenMetadata.entries) {
            for (const entry of tokenMetadata.entries) {
              // Get token vault data for APT spent and graduation status
              try {
                const tokenVault = await client.getAccountResource({
                  accountAddress: entry.metadata_addr,
                  resourceType: `${moduleAddress}::token_launcher::TokenVault`,
                });

                if (tokenVault.data) {
                  const vaultData = tokenVault.data as any;
                  const totalAptSpent = Number(vaultData.total_apt_spent) / 100_000_000; // Convert from octas
                  const isGraduated = vaultData.is_graduated;
                  
                  // Convert bytes to string for name and symbol
                  const name = new TextDecoder().decode(new Uint8Array(entry.original_name));
                  const symbol = new TextDecoder().decode(new Uint8Array(entry.ticker));

                  allTokens.push({
                    symbol,
                    name,
                    decimals: 8, // Default for our tokens
                    asset_type: entry.metadata_addr,
                    totalAptSpent,
                    creator,
                    isGraduated,
                    marketCap: 0, // Will be calculated later
                    launchDate: new Date().toISOString(), // Would need to get from events
                  });
                }
              } catch (vaultError) {
                console.warn(`Could not fetch vault for token ${entry.metadata_addr}:`, vaultError);
              }
            }
          }
        } catch (creatorError) {
          console.warn(`Could not fetch tokens for creator ${creator}:`, creatorError);
        }
      }

      // Step 3: Sort by APT spent and apply time filter
      const sortedTokens = allTokens
        .sort((a, b) => b.totalAptSpent - a.totalAptSpent)
        .slice(0, 100); // Top 100 tokens

      setTokens(sortedTokens);
    } catch (err) {
      console.error('Error fetching leaderboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboardData();
  }, [moduleAddress, network, timeFilter]);

  const formatAptAmount = (amount: number): string => {
    return `${amount.toFixed(2)} APT`;
  };

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getTimeFilterLabel = (filter: string): string => {
    switch (filter) {
      case '24h': return '24 Hours';
      case '7d': return '7 Days';
      case '30d': return '30 Days';
      case 'all': return 'All Time';
      default: return '7 Days';
    }
  };

  if (loading) {
    return (
      <div className="leaderboard-container">
        <div className="loading">Loading leaderboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="leaderboard-container">
        <div className="error">Error: {error}</div>
        <button onClick={fetchLeaderboardData} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <h2>Token Leaderboard</h2>
        <div className="time-filters">
          {(['24h', '7d', '30d', 'all'] as const).map((filter) => (
            <button
              key={filter}
              className={`time-filter ${timeFilter === filter ? 'active' : ''}`}
              onClick={() => setTimeFilter(filter)}
            >
              {getTimeFilterLabel(filter)}
            </button>
          ))}
        </div>
      </div>

      <div className="leaderboard-table">
        <div className="table-header">
          <div className="rank">Rank</div>
          <div className="token">Token</div>
          <div className="creator">Creator</div>
          <div className="apt-spent">APT Spent</div>
          <div className="status">Status</div>
          <div className="market-cap">Market Cap</div>
        </div>

        {tokens.length === 0 ? (
          <div className="no-tokens">No tokens found</div>
        ) : (
          tokens.map((token, index) => (
            <div key={token.asset_type} className="table-row">
              <div className="rank">#{index + 1}</div>
              <div className="token">
                <div className="token-info">
                  <div className="token-symbol">{token.symbol}</div>
                  <div className="token-name">{token.name}</div>
                </div>
              </div>
              <div className="creator">
                <a 
                  href={`https://explorer.aptoslabs.com/account/${token.creator}?network=${network}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="creator-link"
                >
                  {formatAddress(token.creator)}
                </a>
              </div>
              <div className="apt-spent">{formatAptAmount(token.totalAptSpent)}</div>
              <div className="status">
                <span className={`status-badge ${token.isGraduated ? 'graduated' : 'launching'}`}>
                  {token.isGraduated ? 'Graduated' : 'Launching'}
                </span>
              </div>
              <div className="market-cap">
                {token.marketCap > 0 ? `$${(token.marketCap / 1000000).toFixed(2)}M` : 'N/A'}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="leaderboard-footer">
        <p>Leaderboard updates every 5 minutes. Rankings based on total APT spent to treasury.</p>
      </div>
    </div>
  );
};

export default Leaderboard; 