import React, { useState } from 'react';
import GlobalSidebar from './GlobalSidebar';

const Marketplace: React.FC = () => {
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('0.001');
  const [total, setTotal] = useState('108.18');
  const [slippageExpanded, setSlippageExpanded] = useState(false);
  const [selectedSlippage, setSelectedSlippage] = useState('1.0');
  const [headerMinimized, setHeaderMinimized] = useState(false);

  const handleTokenSelect = (token: any) => {
    setSelectedToken(token);
    console.log('Selected token:', token);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    console.log('Search query:', query);
  };

  const handleTrade = () => {
    console.log(`${activeTab} ${amount} of ${selectedToken?.name || 'token'}`);
  };

  const handleSlippageToggle = () => {
    setSlippageExpanded(!slippageExpanded);
  };

  const handleSlippageSelect = (slippage: string) => {
    setSelectedSlippage(slippage);
  };

  const handleHeaderToggle = () => {
    setHeaderMinimized(!headerMinimized);
  };

  // Watchlist data for the sidebar
  const watchlistData = [
    { name: 'Bitcoin', symbol: 'BTC', icon: '₿', iconBg: '#f7931a' },
    { name: 'Ethereum', symbol: 'ETH', icon: 'Ξ', iconBg: '#627eea' },
    { name: 'Tether', symbol: 'USDT', icon: '₮', iconBg: '#50af95' },
    { name: 'BNB', symbol: 'BNB', icon: '◉', iconBg: '#f0b90b' }
  ];

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      width: '100vw',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      margin: 0,
      padding: 0,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #e7ebee',
        padding: headerMinimized ? '4px 24px' : '8px 24px',
        width: '100%',
        flexShrink: 0,
        position: 'relative',
        transition: 'all 0.3s ease',
        height: headerMinimized ? '30px' : 'auto',
        overflow: headerMinimized ? 'hidden' : 'visible'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: headerMinimized ? '0' : '8px'
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#5b616e',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            TOKEN LEADERBOARD
          </div>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#00d4aa'
          }}>
            1:00
          </div>
        </div>
        <div style={{
          display: 'flex',
          gap: '0px',
          overflowX: 'auto',
          paddingBottom: '4px',
          width: '100%',
          justifyContent: 'space-between',
          opacity: headerMinimized ? '0' : '1',
          transition: 'opacity 0.3s ease'
        }}>
          {[
            { rank: 1, name: 'DogeMax', apt: 420, icon: '₿', iconBg: '#f7931a' },
            { rank: 2, name: 'PepeCoin', apt: 234, icon: 'Ξ', iconBg: '#627eea' },
            { rank: 3, name: 'ShibaMax', apt: 189, icon: '₮', iconBg: '#50af95' },
            { rank: 4, name: 'FlokiInu', apt: 156, icon: '◉', iconBg: '#f0b90b' },
            { rank: 5, name: 'SafeMoon', apt: 123, icon: '◆', iconBg: '#1e88e5' },
            { rank: 6, name: 'MoonToken', apt: 98, icon: '🌸', iconBg: '#e91e63' },
            { rank: 7, name: 'LunaCoin', apt: 87, icon: '🌙', iconBg: '#9c27b0' },
            { rank: 8, name: 'FireToken', apt: 76, icon: '🔥', iconBg: '#ff5722' },
            { rank: 9, name: 'EcoCoin', apt: 65, icon: '🌿', iconBg: '#4caf50' },
            { rank: 10, name: 'Diamond', apt: 54, icon: '💎', iconBg: '#2196f3' }
          ].map((token) => (
            <div 
              key={token.rank}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                flex: 1,
                minWidth: 0
              }}
              onClick={() => handleTokenSelect(token)}
            >
              <span style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#5b616e',
                minWidth: '16px'
              }}>
                {token.rank}
              </span>
              <div 
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  background: token.iconBg
                }}
              >
                {token.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#0a0b0d',
                  lineHeight: '1.2',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {token.name}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: '#5b616e',
                  marginTop: '1px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {token.apt} APT
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Toggle Button */}
        <button
          onClick={handleHeaderToggle}
          style={{
            position: 'absolute',
            bottom: '2px',
            right: '10px',
            background: '#ffffff',
            border: '0px solid #d3d3d3',
            borderRadius: '4px',
            padding: '6px 12px',
            fontSize: '12px',
            cursor: 'pointer',
            color: headerMinimized ? '#00d4aa' : '#878788',
            transition: 'all 0.2s ease',
            zIndex: 10
          }}
        >
          {headerMinimized ? 'View Token Leaderboard' : '__'}
        </button>
      </div>

      {/* Main Layout */}
      <div style={{
        display: 'flex',
        flex: 1,
        width: '100%',
        overflow: 'hidden'
      }}>
        {/* Sidebar */}
        <GlobalSidebar 
          watchlistData={watchlistData}
          activeTab="marketplace"
        />

        {/* Main Content */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          width: '100%'
        }}>
          {/* Token Title Bar */}
          <div style={{
            background: 'white',
            borderBottom: '1px solid #e7ebee',
            padding: '18px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            flexShrink: 0
          }}>
            <div style={{
              fontSize: '32px',
              fontWeight: '600',
              color: '#050f19',
              flexShrink: 0
            }}>
              Marketplace
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              margin: '0 20px'
            }}>
              <input 
                type="text" 
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                style={{
                  width: '400px',
                  padding: '8px 12px',
                  border: '1px solid #d3d3d3',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: '#f8f9fa',
                  color: '#050f19'
                }}
              />
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              fontSize: '14px',
              flexShrink: 0
            }}>
              <span>⚙️</span>
              <a href="#" style={{
                color: '#5b616e',
                textDecoration: 'none'
              }}>
                Launch
              </a>
              <a href="#" style={{
                background: '#00d4aa',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: '600'
              }}>
                Connect Wallet
              </a>
            </div>
          </div>

          {/* Content Area */}
          <div style={{
            display: 'flex',
            flex: 1,
            minHeight: 0,
            width: '100%'
          }}>
            {/* Content Left */}
            <div style={{
              flex: 1,
              padding: '20px',
              background: '#ffffff',
              overflowY: 'auto',
              minWidth: 0
            }}>
              {/* Token Badges */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '30px',
                width: '100%',
                paddingTop: '24px'
              }}>
                {[
                  { ticker: 'TKN1', name: 'TokenName1', growth: '306%', positive: true },
                  { ticker: 'TKN2', name: 'TokenName2', growth: '220%', positive: true },
                  { ticker: 'TKN3', name: 'TokenName3', growth: '180%', positive: true },
                  { ticker: 'TKN4', name: 'TokenName4', growth: '150%', positive: true },
                  { ticker: 'TKN5', name: 'TokenName5', growth: '120%', positive: true },
                  { ticker: 'TKN6', name: 'TokenName6', growth: '100%', positive: true }
                ].map((token, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: '#fff',
                    borderRadius: '10px',
                    overflow: 'visible',
                    width: '200px',
                    minWidth: '200px',
                    position: 'relative',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
                    border: '1.5px solid #e6e8ea'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '-15px',
                      right: '-15px',
                      zIndex: 2,
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="11" cy="11" r="11" fill="#40c4ff"/>
                        <path d="M16 8L10 14L7 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div style={{
                      width: '100%',
                      padding: '10px 15px 8px 15px',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      background: '#eaeaea',
                      borderBottom: '1px solid #ccc',
                      position: 'relative',
                      borderTopLeftRadius: '10px',
                      borderTopRightRadius: '10px'
                    }}>
                      <div style={{
                        background: '#ff9800',
                        borderRadius: '50%',
                        width: '30px',
                        height: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '18px',
                        marginRight: '10px'
                      }}>
                        ★
                      </div>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        gap: '2px'
                      }}>
                        <div style={{
                          fontSize: '12px',
                          color: '#000',
                          fontWeight: '600',
                          marginBottom: '0px'
                        }}>
                          {token.ticker}
                        </div>
                        <div style={{
                          fontSize: '16px',
                          color: '#000',
                          fontWeight: '700',
                          lineHeight: '1.1'
                        }}>
                          {token.name}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      padding: '10px 0 14px 0',
                      textAlign: 'center',
                      fontSize: '28px',
                      fontWeight: 'bold',
                      width: '100%',
                      letterSpacing: '-1px',
                      color: token.positive ? '#26a69a' : '#ff4757'
                    }}>
                      {token.growth}
                    </div>
                  </div>
                ))}
              </div>

              {/* Trading Section */}
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                border: '1px solid #e6e8ea'
              }}>
                <div style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#050f19',
                  marginBottom: '20px'
                }}>
                  Tokens
                </div>
                
                {/* Controls */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  marginBottom: '20px',
                  flexWrap: 'wrap'
                }}>
                  <input 
                    type="text" 
                    placeholder="Filter by name"
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d3d3d3',
                      borderRadius: '4px',
                      fontSize: '14px',
                      minWidth: '200px'
                    }}
                  />
                  <select style={{
                    padding: '8px 12px',
                    border: '1px solid #d3d3d3',
                    borderRadius: '4px',
                    fontSize: '14px',
                    background: 'white'
                  }}>
                    <option>1h</option>
                    <option>4h</option>
                    <option>12h</option>
                    <option>1D</option>
                    <option>All</option>
                  </select>
                  <select style={{
                    padding: '8px 12px',
                    border: '1px solid #d3d3d3',
                    borderRadius: '4px',
                    fontSize: '14px',
                    background: 'white'
                  }}>
                    <option>All Status</option>
                    <option>Verified</option>
                    <option>Unverified</option>
                  </select>
                </div>

                {/* Trading Table */}
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '14px'
                }}>
                  <thead>
                    <tr style={{
                      borderBottom: '1px solid #e6e8ea'
                    }}>
                      <th style={{
                        textAlign: 'left',
                        padding: '12px 8px',
                        fontWeight: '600',
                        color: '#8a9ba8'
                      }}>
                        Name
                      </th>
                      <th style={{
                        textAlign: 'right',
                        padding: '12px 8px',
                        fontWeight: '600',
                        color: '#8a9ba8'
                      }}>
                        Price
                      </th>
                      <th style={{
                        textAlign: 'right',
                        padding: '12px 8px',
                        fontWeight: '600',
                        color: '#8a9ba8'
                      }}>
                        Change
                      </th>
                      <th style={{
                        textAlign: 'right',
                        padding: '12px 8px',
                        fontWeight: '600',
                        color: '#8a9ba8'
                      }}>
                        Market cap
                      </th>
                      <th style={{
                        textAlign: 'right',
                        padding: '12px 8px',
                        fontWeight: '600',
                        color: '#8a9ba8',
                        width: '440px'
                      }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'Bitcoin', symbol: 'BTC', icon: '₿', iconBg: '#f7931a', price: '$108,148.39', change: '-0.62%', positive: false, marketCap: '$2.1T' },
                      { name: 'Ethereum', symbol: 'ETH', icon: '⧫', iconBg: '#627eea', price: '$2,544.02', change: '-0.28%', positive: false, marketCap: '$306.3B' },
                      { name: 'Tether', symbol: 'USDT', icon: '₮', iconBg: '#50af95', price: '$1.00', change: '-0.02%', positive: false, marketCap: '$158.6B' },
                      { name: 'XRP', symbol: 'XRP', icon: 'X', iconBg: '#f0b90b', price: '$2.28', change: '+0.11%', positive: true, marketCap: '$134.2B' }
                    ].map((crypto, index) => (
                      <tr key={index} style={{
                        borderBottom: '1px solid #f0f0f0'
                      }}>
                        <td style={{
                          padding: '12px 8px'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontWeight: 'bold',
                              fontSize: '16px',
                              background: crypto.iconBg
                            }}>
                              {crypto.icon}
                            </div>
                            <div>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#050f19'
                              }}>
                                {crypto.name}
                              </div>
                              <div style={{
                                fontSize: '12px',
                                color: '#8a9ba8'
                              }}>
                                {crypto.symbol}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{
                          textAlign: 'right',
                          padding: '12px 8px',
                          fontWeight: '600',
                          color: '#050f19'
                        }}>
                          {crypto.price}
                        </td>
                        <td style={{
                          textAlign: 'right',
                          padding: '12px 8px',
                          color: crypto.positive ? '#00d4aa' : '#ff4757',
                          fontWeight: '600'
                        }}>
                          {crypto.change}
                        </td>
                        <td style={{
                          textAlign: 'right',
                          padding: '12px 8px',
                          color: '#8a9ba8'
                        }}>
                          {crypto.marketCap}
                        </td>
                        <td style={{
                          textAlign: 'right',
                          padding: '12px 8px',
                          width: '440px'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '12px',
                            alignItems: 'center'
                          }}>
                            <button style={{
                              padding: '8px 16px',
                              background: '#00d4aa',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '500',
                              cursor: 'pointer'
                            }}>
                              Trade
                            </button>
                            <button style={{
                              padding: '8px 16px',
                              background: 'white',
                              color: '#FF6B35',
                              border: '1px solid #FF6B35',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '500',
                              cursor: 'pointer'
                            }}>
                              Boost
                            </button>
                            <button style={{
                              padding: '8px 16px',
                              background: 'white',
                              color: '#00BFFF',
                              border: '1px solid #00BFFF',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '500',
                              cursor: 'pointer'
                            }}>
                              Verify
                            </button>
                            <button style={{
                              background: '#fff',
                              border: '1px solid #e6e8ea',
                              color: '#666',
                              cursor: 'pointer',
                              fontSize: '16px',
                              padding: '8px 16px',
                              borderRadius: '6px',
                              height: '36px',
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              ⭐
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Trading Panel */}
            <div style={{
              width: '400px',
              background: '#ffffff',
              borderLeft: '1px solid #d3d3d3',
              padding: '20px',
              flexShrink: 0
            }}>
              <div style={{
                background: '#f8f9fa',
                borderRadius: '12px',
                padding: '20px',
                border: '1px solid #e6e8ea',
                height: '100%'
              }}>
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#0a0b0d',
                    marginBottom: '8px'
                  }}>
                    Your Balance
                  </h3>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#00d4aa'
                  }}>
                    0.005
                  </div>
                </div>
                
                <ul style={{
                  display: 'flex',
                  background: '#e9ecef',
                  borderRadius: '8px',
                  padding: '4px',
                  marginBottom: '20px',
                  listStyle: 'none'
                }}>
                  <li 
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      background: activeTab === 'buy' ? '#00d4aa' : 'transparent',
                      color: activeTab === 'buy' ? 'white' : '#6c757d'
                    }}
                    onClick={() => setActiveTab('buy')}
                  >
                    Buy
                  </li>
                  <li 
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      background: activeTab === 'sell' ? '#00d4aa' : 'transparent',
                      color: activeTab === 'sell' ? 'white' : '#6c757d'
                    }}
                    onClick={() => setActiveTab('sell')}
                  >
                    Sell
                  </li>
                </ul>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#0a0b0d',
                    marginBottom: '8px'
                  }}>
                    Amount
                  </label>
                  <input 
                    type="text" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #e6e8ea',
                      borderRadius: '8px',
                      fontSize: '16px',
                      background: 'white'
                    }}
                  />
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#0a0b0d',
                    marginBottom: '8px'
                  }}>
                    Total (APT)
                  </label>
                  <input 
                    type="text" 
                    value={total} 
                    onChange={(e) => setTotal(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #e6e8ea',
                      borderRadius: '8px',
                      fontSize: '16px',
                      background: 'white'
                    }}
                  />
                </div>

                {/* Slippage Protection Section */}
                <div style={{
                  margin: '20px 0',
                  padding: '15px',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e6e8ea',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}>
                  <div 
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: slippageExpanded ? '12px' : '0',
                      transition: 'margin-bottom 0.3s ease'
                    }}
                    onClick={handleSlippageToggle}
                  >
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#050f19'
                    }}>
                      Slippage Protection
                    </span>
                    <span style={{
                      fontSize: '12px',
                      color: '#8a9ba8',
                      cursor: 'pointer',
                      transition: 'transform 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '20px',
                      height: '20px',
                      transform: slippageExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                    }}>
                      ▼
                    </span>
                  </div>
                  <div style={{
                    maxHeight: slippageExpanded ? '200px' : '0',
                    overflow: 'hidden',
                    transition: 'max-height 0.3s ease'
                  }}>
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      marginBottom: '12px',
                      marginTop: '12px'
                    }}>
                      {['0.5', '1.0', '2.0', '5.0'].map((slippage) => (
                        <button 
                          key={slippage}
                          onClick={() => handleSlippageSelect(slippage)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: `1px solid ${selectedSlippage === slippage ? '#00d4aa' : '#d3d3d3'}`,
                            background: selectedSlippage === slippage ? '#00d4aa' : '#ffffff',
                            color: selectedSlippage === slippage ? '#ffffff' : '#5b616e',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {slippage}%
                        </button>
                      ))}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <input 
                        type="number" 
                        placeholder="Custom" 
                        min="0.1" 
                        max="50" 
                        step="0.1"
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid #d3d3d3',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: '#ffffff',
                          color: '#050f19'
                        }}
                      />
                      <span style={{
                        fontSize: '12px',
                        color: '#8a9ba8',
                        fontWeight: '500'
                      }}>
                        %
                      </span>
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#ff4757',
                      marginTop: '8px',
                      display: parseFloat(selectedSlippage) > 5.0 ? 'block' : 'none'
                    }}>
                      ⚠️ High slippage may result in unfavorable trade execution
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={handleTrade}
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    background: '#00d4aa',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {activeTab === 'buy' ? 'Buy' : 'Sell'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Marketplace; 