import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import GlobalSidebar from './GlobalSidebar';

const TokenPage: React.FC = () => {
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('0.001');
  const [total, setTotal] = useState('108.18');
  const [slippageExpanded, setSlippageExpanded] = useState(false);
  const [selectedSlippage, setSelectedSlippage] = useState('1.0');
  const [headerMinimized, setHeaderMinimized] = useState(false);
  const location = useLocation();

  // Watchlist data for the sidebar
  const watchlistData = [
    { name: 'Bitcoin', symbol: 'BTC', icon: '₿', iconBg: '#f7931a' },
    { name: 'Ethereum', symbol: 'ETH', icon: 'Ξ', iconBg: '#627eea' },
    { name: 'Tether', symbol: 'USDT', icon: '₮', iconBg: '#50af95' },
    { name: 'BNB', symbol: 'BNB', icon: '◉', iconBg: '#f0b90b' }
  ];

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
          activeTab="trade"
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
            justifyContent: 'space-between'
          }}>
            <div style={{
              fontSize: '32px',
              fontWeight: '600',
              color: '#050f19',
              flexShrink: 0
            }}>
              Token Page
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
              {/* Token Header */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                marginBottom: '8px',
                background: '#ffffff',
                width: '100%',
                padding: '0px'
              }}>
                <div style={{
                  fontSize: '28px',
                  fontWeight: '600',
                  color: '#050f19',
                  marginBottom: '8px',
                  lineHeight: '1',
                  padding: '0 0px'
                }}>
                  $108,175.28
                </div>
                <div style={{
                  fontSize: '16px',
                  color: '#f00',
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '20px',
                  padding: '0 0px'
                }}>
                  ↓ $183.98 (-0.17%)
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0 0px',
                  marginBottom: '20px',
                  width: '100%'
                }}>
                  <div style={{
                    display: 'flex',
                    gap: '0'
                  }}>
                    {['1m', '15m', '1H', '4H', '1D', 'ALL'].map((time, index) => (
                      <button
                        key={time}
                        style={{
                          padding: '8px 16px',
                          border: '0px solid #d3d3d3',
                          borderRadius: '6px',
                          background: index === 1 ? '#d6f0ea' : '#ffffff',
                          color: index === 1 ? '#00d4aa' : '#292929',
                          fontSize: '16px',
                          fontWeight: '100',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '0 20px'
                  }}>
                    <button style={{
                      background: '#fff',
                      border: '1px solid #e6e8ea',
                      color: '#666',
                      cursor: 'pointer',
                      fontSize: '24px',
                      padding: '5px 12px',
                      borderRadius: '6px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      ☆
                    </button>
                    <button style={{
                      padding: '8px 16px',
                      background: '#00BFFF',
                      color: '#ffffff',
                      border: '1px solid #00BFFF',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}>
                      Verify Community
                    </button>
                    <button style={{
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #FF6B35, #FF8C42)',
                      color: '#ffffff',
                      border: '1px solid #FF6B35',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 8px rgba(255, 107, 53, 0.3)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      Boost Token
                    </button>
                  </div>
                </div>
              </div>

              {/* Chart Container */}
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '30px',
                height: '400px',
                position: 'relative'
              }}>
                <div style={{
                  width: '100%',
                  height: '320px',
                  background: '#fbfbfb',
                  borderRadius: '8px',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <svg style={{ width: '100%', height: '100%' }}>
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#ff4757', stopOpacity: 0.3 }} />
                        <stop offset="100%" style={{ stopColor: '#ff4757', stopOpacity: 0 }} />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    <g style={{ stroke: '#b3b3b4', strokeWidth: 0.5, opacity: 0.5 }}>
                      <line x1="0" y1="50" x2="100%" y2="50" />
                      <line x1="0" y1="100" x2="100%" y2="100" />
                      <line x1="0" y1="150" x2="100%" y2="150" />
                      <line x1="0" y1="200" x2="100%" y2="200" />
                      <line x1="0" y1="250" x2="100%" y2="250" />
                    </g>

                    {/* Chart line */}
                    <path
                      style={{ fill: 'none', stroke: '#ff4757', strokeWidth: 2 }}
                      d="M 0 180 L 50 120 L 100 140 L 150 110 L 200 100 L 250 130 L 300 120 L 350 140 L 400 160 L 450 180 L 500 200 L 550 190 L 600 210 L 650 220 L 700 240 L 750 260 L 800 280 L 850 270 L 900 290 L 950 280 L 1000 300"
                    />

                    {/* Area fill */}
                    <path
                      style={{ fill: 'url(#gradient)' }}
                      d="M 0 180 L 50 120 L 100 140 L 150 110 L 200 100 L 250 130 L 300 120 L 350 140 L 400 160 L 450 180 L 500 200 L 550 190 L 600 210 L 650 220 L 700 240 L 750 260 L 800 280 L 850 270 L 900 290 L 950 280 L 1000 300 L 1000 320 L 0 320 Z"
                    />
                  </svg>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '10px',
                  fontSize: '12px',
                  color: '#666'
                }}>
                  <span>3:35 PM</span>
                  <span>6:45 PM</span>
                  <span>9:55 PM</span>
                  <span>1:05 AM</span>
                  <span>4:15 AM</span>
                  <span>7:25 AM</span>
                  <span>10:35 AM</span>
                  <span>1:45 PM</span>
                </div>
              </div>

              {/* Balance Section with Tabs */}
              <div style={{ marginTop: '20px' }}>
                <div style={{
                  display: 'flex',
                  borderBottom: '1px solid #d3d3d3',
                  justifyContent: 'flex-start',
                  textAlign: 'left'
                }}>
                  {['Insights', 'Transactions', 'Top Holders'].map((tab, index) => (
                    <div
                      key={tab}
                      style={{
                        padding: '12px 0',
                        marginRight: '24px',
                        color: index === 0 ? '#00d4aa' : '#8a9ba8',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        borderBottom: `2px solid ${index === 0 ? '#00d4aa' : 'transparent'}`,
                        transition: 'all 0.2s'
                      }}
                    >
                      {tab}
                    </div>
                  ))}
                </div>

                {/* Insights Tab Content */}
                <div style={{
                  display: 'block',
                  border: '1px solid #f2f1f1',
                  borderBottomLeftRadius: '12px',
                  borderBottomRightRadius: '12px',
                  borderTop: '0px'
                }}>
                  {/* Token Info Section */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '20px',
                    marginBottom: '30px',
                    padding: '20px',
                    background: '#f8f9fa',
                    borderBottomLeftRadius: '12px',
                    borderBottomRightRadius: '12px'
                  }}>
                    <div style={{
                      width: '100px',
                      height: '100px',
                      background: '#e0e0e0',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      color: '#666',
                      flexShrink: 0
                    }}>
                      🪙
                    </div>
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      marginTop: '20px'
                    }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        color: '#050f19',
                        marginBottom: '4px'
                      }}>
                        Bitcoin
                      </div>
                      <div style={{
                        fontSize: '16px',
                        color: '#8a9ba8',
                        fontWeight: '500'
                      }}>
                        BTC
                      </div>
                      <div style={{
                        display: 'flex',
                        gap: '30px',
                        marginLeft: 'auto'
                      }}>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: '4px',
                          fontSize: '14px'
                        }}>
                          <span style={{
                            color: '#8a9ba8',
                            fontWeight: '500',
                            fontSize: '12px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Launched:
                          </span>
                          <span style={{
                            color: '#050f19',
                            fontWeight: '600',
                            fontSize: '14px'
                          }}>
                            2 hours ago
                          </span>
                        </div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: '4px',
                          fontSize: '14px'
                        }}>
                          <span style={{
                            color: '#8a9ba8',
                            fontWeight: '500',
                            fontSize: '12px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Holders:
                          </span>
                          <span style={{
                            color: '#050f19',
                            fontWeight: '600',
                            fontSize: '14px'
                          }}>
                            1,247 wallets
                          </span>
                        </div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: '4px',
                          fontSize: '14px'
                        }}>
                          <span style={{
                            color: '#8a9ba8',
                            fontWeight: '500',
                            fontSize: '12px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Created by:
                          </span>
                          <span style={{
                            color: '#050f19',
                            fontWeight: '600',
                            fontSize: '14px'
                          }}>
                            0x1234...5678
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: '100px',
                    width: '100%',
                    margin: '40px 0px'
                  }}>
                    <div style={{
                      flex: 1,
                      maxWidth: '50%',
                      marginLeft: '20px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '20px',
                        width: '100%'
                      }}>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          <div style={{
                            fontSize: '22px',
                            fontWeight: '700',
                            color: '#050f19',
                            lineHeight: '1'
                          }}>
                            $67,856
                          </div>
                          <div style={{
                            fontSize: '16px',
                            color: '#8a9ba8',
                            marginBottom: '20px'
                          }}>
                            Market Cap
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          <div style={{
                            fontSize: '22px',
                            fontWeight: '700',
                            color: '#050f19',
                            lineHeight: '1'
                          }}>
                            $24,656
                          </div>
                          <div style={{
                            fontSize: '16px',
                            color: '#8a9ba8',
                            marginBottom: '20px'
                          }}>
                            Volume (24h)
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start'
                        }}>
                          <div style={{
                            fontSize: '22px',
                            fontWeight: '700',
                            color: '#00d4aa',
                            lineHeight: '1',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span style={{ fontSize: '16px' }}>↑</span>
                            <span>+12.5%</span>
                          </div>
                          <div style={{
                            fontSize: '16px',
                            color: '#8a9ba8',
                            marginBottom: '20px'
                          }}>
                            Change % (24h)
                          </div>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        marginTop: '20px',
                        width: '100%'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px'
                        }}>
                          <div style={{
                            fontSize: '22px',
                            fontWeight: '700',
                            color: '#050f19',
                            lineHeight: '1'
                          }}>
                            962 / 1283 APT
                          </div>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#8a9ba8',
                            letterSpacing: '0.5px'
                          }}>
                            75% Complete
                          </div>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '8px',
                          background: '#f0f0f0',
                          borderRadius: '4px',
                          overflow: 'hidden',
                          marginBottom: '8px'
                        }}>
                          <div style={{
                            height: '100%',
                            background: 'linear-gradient(90deg, #00d4aa, #00b894)',
                            borderRadius: '4px',
                            width: '75%'
                          }}></div>
                        </div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#8a9ba8',
                          marginTop: '8px',
                          letterSpacing: '0.5px'
                        }}>
                          Graduation Progress
                        </div>
                      </div>
                    </div>

                    <div style={{
                      flex: 1,
                      maxWidth: '50%'
                    }}>
                      <div style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '20px'
                      }}>
                        <p style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#8a9ba8',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          paddingBottom: '20px'
                        }}>
                          Links
                        </p>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}>
                          <div style={{
                            display: 'flex',
                            gap: '12px'
                          }}>
                            <button style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '12px 16px',
                              border: '1px solid #e6e8ea',
                              borderRadius: '8px',
                              background: 'white',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              fontSize: '13px',
                              fontWeight: '500',
                              color: '#050f19',
                              textAlign: 'left',
                              flex: 1,
                              minWidth: 0
                            }}>
                              <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>🔗</span>
                              <span style={{ flex: 1 }}>Copy CA</span>
                            </button>
                            <button style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '12px 16px',
                              border: '1px solid #e6e8ea',
                              borderRadius: '8px',
                              background: 'white',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              fontSize: '13px',
                              fontWeight: '500',
                              color: '#050f19',
                              textAlign: 'left',
                              flex: 1,
                              minWidth: 0
                            }}>
                              <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>🌐</span>
                              <span style={{ flex: 1 }}>Website</span>
                            </button>
                          </div>
                          <div style={{
                            display: 'flex',
                            gap: '12px'
                          }}>
                            <button style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '12px 16px',
                              border: '1px solid #e6e8ea',
                              borderRadius: '8px',
                              background: 'white',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              fontSize: '13px',
                              fontWeight: '500',
                              color: '#050f19',
                              textAlign: 'left',
                              flex: 1,
                              minWidth: 0
                            }}>
                              <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>🐦</span>
                              <span style={{ flex: 1 }}>Twitter</span>
                            </button>
                            <button style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '12px 16px',
                              border: '1px solid #e6e8ea',
                              borderRadius: '8px',
                              background: 'white',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              fontSize: '13px',
                              fontWeight: '500',
                              color: '#050f19',
                              textAlign: 'left',
                              flex: 1,
                              minWidth: 0
                            }}>
                              <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>📱</span>
                              <span style={{ flex: 1 }}>Telegram</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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

          {/* Footer */}
          <div style={{
            background: '#ffffff',
            borderTop: '1px solid #e7ebee',
            padding: '20px 24px',
            width: '100%',
            flexShrink: 0
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{
                display: 'flex',
                gap: '20px'
              }}>
                <a href="#" style={{
                  color: '#5b616e',
                  textDecoration: 'none',
                  fontSize: '14px'
                }}>
                  Careers
                </a>
                <a href="#" style={{
                  color: '#5b616e',
                  textDecoration: 'none',
                  fontSize: '14px'
                }}>
                  Privacy & Legal
                </a>
                <a href="#" style={{
                  color: '#5b616e',
                  textDecoration: 'none',
                  fontSize: '14px'
                }}>
                  Docs
                </a>
                <a href="#" style={{
                  color: '#5b616e',
                  textDecoration: 'none',
                  fontSize: '14px'
                }}>
                  Accessibility
                </a>
              </div>
              <p style={{
                fontSize: '14px',
                color: '#5b616e'
              }}>
                &copy; 2025 MoveMint
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenPage;