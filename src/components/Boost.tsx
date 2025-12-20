import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import GlobalSidebar from './GlobalSidebar';

const Boost: React.FC = () => {
  const [countdown, setCountdown] = useState(60);
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [boostAmount, setBoostAmount] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('1h');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [aptFilter, setAptFilter] = useState('1');
  const location = useLocation();

  // Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 60; // Reset to 60
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleTokenSelect = (token: any) => {
    setSelectedToken(token);
  };

  const handleBoost = () => {
    if (boostAmount && parseFloat(boostAmount) > 0 && selectedToken) {
      alert(`Boosting ${selectedToken.name} with ${boostAmount} APT!`);
      // Here you would add the actual boost functionality
    } else {
      alert('Please select a token and enter a valid amount to boost');
    }
  };

  const handleTrade = () => {
    if (selectedToken) {
      alert(`Trading ${selectedToken.name}!`);
      // Here you would add the actual trade functionality
    } else {
      alert('Please select a token to trade');
    }
  };

  // Sample token data
  const tokens = [
    {
      id: 1,
      name: 'MoonDoge',
      symbol: 'MOON',
      icon: '🚀',
      iconBg: '#ff6b35',
      position: 1,
      aptRaised: '1,247',
      aptExpiring: '89',
      boosters: 89,
      holders: 1247,
      age: '2h 34m',
      isTopSpot: true
    },
    {
      id: 2,
      name: 'ShibaInu',
      symbol: 'SHIB',
      icon: '🐕',
      iconBg: '#00d4aa',
      position: 2,
      positionChange: -1,
      aptRaised: '1,156',
      aptExpiring: '156',
      boosters: 89,
      holders: 1247,
      age: '1h 47m'
    },
    {
      id: 3,
      name: 'PizzaCoin',
      symbol: 'PIZZA',
      icon: '🍕',
      iconBg: '#ff4757',
      position: 3,
      positionChange: 3,
      aptRaised: '987',
      aptExpiring: '0',
      boosters: 67,
      holders: 892,
      age: '3h 12m'
    },
    {
      id: 4,
      name: 'PepeCoin',
      symbol: 'PEPE',
      icon: '🐸',
      iconBg: '#ffa502',
      position: 4,
      positionChange: -2,
      aptRaised: '856',
      aptExpiring: '234',
      boosters: 45,
      holders: 654,
      age: '45m'
    },
    {
      id: 5,
      name: 'SafeMoon',
      symbol: 'SAFEMOON',
      icon: '🌙',
      iconBg: '#2ed573',
      position: 5,
      positionChange: 1,
      aptRaised: '743',
      aptExpiring: '67',
      boosters: 34,
      holders: 521,
      age: '2h 8m'
    }
  ];

  const topSpotToken = tokens[0]; // MoonDoge is the top spot


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
      {/* Main Layout */}
      <div style={{
        display: 'flex',
        flex: 1,
        width: '100%',
        overflow: 'hidden'
      }}>
        {/* Sidebar */}
        <GlobalSidebar 
          activeTab="boost"
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
              Boost
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
            {/* Content Left - Boost Leaderboard */}
            <div style={{
              flex: 1,
              padding: '20px',
              background: '#f7f7f7',
              overflowY: 'auto',
              minWidth: 0
            }}>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                minWidth: 0,
                overflowX: 'auto',
                width: '100%',
                border: '3px solid #ff6f00'
              }}>
                {/* Boost Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '24px',
                  padding: '20px 0',
                  borderBottom: '1px solid #e2e8f0'
                }}>
                  <div style={{
                    flex: 1,
                    marginTop: '-50px'
                  }}>
                    <h1 style={{
                      fontSize: '128px',
                      fontWeight: '900',
                      color: '#ff6b35',
                      margin: '0 0 8px 0',
                      fontStyle: 'italic'
                    }}>
                      BOOST
                    </h1>
                    <p style={{
                      fontSize: '16px',
                      color: '#6b7280',
                      margin: 0,
                      lineHeight: '1.5'
                    }}>
                      Real-time competition for the top spot. Positions update every 60 seconds.
                    </p>
                  </div>
                </div>

                {/* Filter Controls */}
                <div style={{
                  display: 'flex',
                  gap: '10px',
                  marginBottom: '20px',
                  flexWrap: 'wrap',
                  maxWidth: '100%'
                }}>
                  <input
                    type="text"
                    placeholder="Filter by name"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: '150px',
                      padding: '10px 16px',
                      border: '1px solid #e6e8ea',
                      borderRadius: '8px',
                      background: '#f7f8fa',
                      fontSize: '14px'
                    }}
                  />
                  <select
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value)}
                    style={{
                      padding: '10px 16px',
                      border: '1px solid #e6e8ea',
                      borderRadius: '8px',
                      background: 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                      minWidth: '120px'
                    }}
                  >
                    <option value="1h">1h</option>
                    <option value="4h">4h</option>
                    <option value="12h">12h</option>
                    <option value="1D">1D</option>
                    <option value="All">All</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      padding: '10px 16px',
                      border: '1px solid #e6e8ea',
                      borderRadius: '8px',
                      background: 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                      minWidth: '120px'
                    }}
                  >
                    <option value="All Status">All Status</option>
                    <option value="Verified">Verified</option>
                    <option value="Unverified">Unverified</option>
                  </select>
                  <select
                    value={aptFilter}
                    onChange={(e) => setAptFilter(e.target.value)}
                    style={{
                      padding: '10px 16px',
                      border: '1px solid #e6e8ea',
                      borderRadius: '8px',
                      background: 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                      minWidth: '120px'
                    }}
                  >
                    <option value="All">All</option>
                    <option value="1">&gt; 1 APT</option>
                    <option value="10">&gt; 10 APT</option>
                    <option value="20">&gt; 20 APT</option>
                  </select>
                </div>

                {/* TOP SPOT Section */}
                <div style={{
                  background: '#ffffffcb',
                  borderRadius: '0 0 20px 20px',
                  padding: '60px 24px',
                  boxShadow: '0 30px 30px #ff6f0072',
                  margin: '24px 24px 20px -24px',
                  border: '2px solid #ff6f00',
                  borderTop: '1px solid #e9ecef',
                  borderLeft: 'none',
                  borderRight: 'none',
                  marginBottom: '60px',
                  width: 'calc(100% + 48px)',
                  maxWidth: 'calc(100% + 48px)',
                  boxSizing: 'border-box',
                  display: 'block',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onClick={() => handleTokenSelect(topSpotToken)}
                >
                  {/* Header Section */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '60px'
                  }}>
                    <div style={{
                      fontSize: '26px',
                      fontWeight: '600',
                      fontStyle: 'italic',
                      color: '#ffffff',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginTop: '-20px',
                      background: '#ff6f00',
                      padding: '12px 24px',
                      marginLeft: '-24px',
                      position: 'relative',
                      boxShadow: '0 2px 8px rgba(255, 111, 0, 0.3)'
                    }}>
                      TOP SPOT
                    </div>
                  </div>

                  {/* Content Section */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '24px'
                  }}>
                    {/* Left Section: Token Info and Key Metrics */}
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '20px',
                      borderRight: '1px solid #969696',
                      maxWidth: '50%',
                      paddingLeft: '24px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '16px'
                      }}>
                        <div style={{
                          width: '80px',
                          height: '80px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '36px',
                          flexShrink: 0,
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                          background: topSpotToken.iconBg
                        }}>
                          {topSpotToken.icon}
                        </div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}>
                          <div style={{
                            fontSize: '36px',
                            fontWeight: '700',
                            color: '#1a202c',
                            margin: 0,
                            lineHeight: '1.2'
                          }}>
                            {topSpotToken.name}
                          </div>
                          <div style={{
                            fontSize: '20px',
                            color: '#6b7280',
                            margin: 0,
                            fontWeight: '500'
                          }}>
                            {topSpotToken.symbol}
                          </div>
                        </div>
                      </div>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '24px',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '4px'
                          }}>
                            APT Raised
                          </div>
                          <div style={{
                            fontSize: '20px',
                            fontWeight: '700',
                            margin: 0,
                            lineHeight: '1.2',
                            color: '#00d4aa'
                          }}>
                            {topSpotToken.aptRaised} APT
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '4px'
                          }}>
                            APT Expiring
                          </div>
                          <div style={{
                            fontSize: '20px',
                            fontWeight: '700',
                            margin: 0,
                            lineHeight: '1.2',
                            color: '#ff4757'
                          }}>
                            {topSpotToken.aptExpiring} APT
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '4px'
                          }}>
                            Next Closest
                          </div>
                          <div style={{
                            fontSize: '20px',
                            fontWeight: '700',
                            margin: 0,
                            lineHeight: '1.2'
                          }}>
                            +91 APT
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '4px'
                          }}>
                            Time at #1
                          </div>
                          <div style={{
                            fontSize: '20px',
                            fontWeight: '700',
                            margin: 0,
                            lineHeight: '1.2'
                          }}>
                            {topSpotToken.age}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Section: Detailed Stats, Progress Bar, and Trade Button */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '56px',
                      minWidth: '160px'
                    }}>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '16px',
                        alignItems: 'flex-end',
                        flexWrap: 'wrap',
                        width: '100%'
                      }}>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Boosters
                          </div>
                          <div style={{
                            fontSize: '14px',
                            color: '#1a202c',
                            fontWeight: '500'
                          }}>
                            {topSpotToken.boosters}
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Holders
                          </div>
                          <div style={{
                            fontSize: '14px',
                            color: '#1a202c',
                            fontWeight: '500'
                          }}>
                            {topSpotToken.holders}
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            % Change
                          </div>
                          <div style={{
                            fontSize: '14px',
                            color: '#00d4aa',
                            fontWeight: '500'
                          }}>
                            +89.3%
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Market Cap
                          </div>
                          <div style={{
                            fontSize: '14px',
                            color: '#1a202c',
                            fontWeight: '500'
                          }}>
                            $523K
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Volume (24h)
                          </div>
                          <div style={{
                            fontSize: '14px',
                            color: '#1a202c',
                            fontWeight: '500'
                          }}>
                            $89K
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Created by
                          </div>
                          <div style={{
                            fontSize: '14px',
                            color: '#1a202c',
                            fontWeight: '500'
                          }}>
                            @moondev
                          </div>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        alignItems: 'flex-end',
                        width: '100%'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          width: '100%'
                        }}>
                          <span style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#1a202c'
                          }}>
                            962 / 1283 APT
                          </span>
                          <span style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#00d4aa'
                          }}>
                            75% Complete
                          </span>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '8px',
                          background: '#e2e8f0',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            background: 'linear-gradient(90deg, #00d4aa, #00b894)',
                            borderRadius: '4px',
                            width: '75%'
                          }}></div>
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          fontWeight: '500',
                          textAlign: 'center'
                        }}>
                          Graduation Progress
                        </div>
                      </div>

                      <button style={{
                        background: '#00d4aa',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '12px 24px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        width: '50%',
                        whiteSpace: 'nowrap'
                      }}>
                        Trade
                      </button>
                    </div>
                  </div>
                </div>

                {/* Leaderboard Table */}
                <table style={{
                  width: '100%',
                  minWidth: '600px',
                  overflowX: 'auto'
                }}>
                  <thead>
                    <tr>
                      <th style={{
                        textAlign: 'left',
                        fontWeight: '500',
                        color: '#666',
                        padding: '10px 0',
                        borderBottom: '1px solid #e6e8ea',
                        whiteSpace: 'nowrap'
                      }}></th>
                      <th style={{
                        textAlign: 'left',
                        fontWeight: '500',
                        color: '#666',
                        padding: '10px 0',
                        borderBottom: '1px solid #e6e8ea',
                        whiteSpace: 'nowrap'
                      }}></th>
                      <th style={{
                        textAlign: 'left',
                        fontWeight: '500',
                        color: '#666',
                        padding: '10px 0',
                        borderBottom: '1px solid #e6e8ea',
                        whiteSpace: 'nowrap'
                      }}>Name</th>
                      <th style={{
                        textAlign: 'left',
                        fontWeight: '500',
                        color: '#666',
                        padding: '10px 0',
                        borderBottom: '1px solid #e6e8ea',
                        whiteSpace: 'nowrap'
                      }}>APT Raised (4h)</th>
                      <th style={{
                        textAlign: 'left',
                        fontWeight: '500',
                        color: '#666',
                        padding: '10px 0',
                        borderBottom: '1px solid #e6e8ea',
                        whiteSpace: 'nowrap'
                      }}>APT Expiring (1m)</th>
                      <th style={{
                        textAlign: 'left',
                        fontWeight: '500',
                        color: '#666',
                        padding: '10px 0',
                        borderBottom: '1px solid #e6e8ea',
                        whiteSpace: 'nowrap'
                      }}>Boosters</th>
                      <th style={{
                        textAlign: 'left',
                        fontWeight: '500',
                        color: '#666',
                        padding: '10px 0',
                        borderBottom: '1px solid #e6e8ea',
                        whiteSpace: 'nowrap'
                      }}>Holders</th>
                      <th style={{
                        textAlign: 'left',
                        fontWeight: '500',
                        color: '#666',
                        padding: '10px 0',
                        borderBottom: '1px solid #e6e8ea',
                        whiteSpace: 'nowrap'
                      }}>Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.slice(1).map((token) => (
                      <tr
                        key={token.id}
                        style={{
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onClick={() => handleTokenSelect(token)}
                      >
                        <td style={{
                          padding: '16px 0',
                          borderBottom: '1px solid #f7f8fa',
                          whiteSpace: 'nowrap'
                        }}>{token.position}</td>
                        <td style={{
                          padding: '16px 0',
                          borderBottom: '1px solid #f7f8fa',
                          whiteSpace: 'nowrap',
                          fontWeight: '600',
                          fontSize: '14px',
                          color: (token.positionChange || 0) > 0 ? '#2ed573' : '#ff4757'
                        }}>
                          {(token.positionChange || 0) > 0 ? `(+${token.positionChange})` : `(${token.positionChange})`}
                        </td>
                        <td style={{
                          padding: '16px 0',
                          borderBottom: '1px solid #f7f8fa',
                          whiteSpace: 'nowrap'
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
                              fontSize: '12px',
                              background: token.iconBg
                            }}>
                              {token.icon}
                            </div>
                            <div>
                              <div style={{
                                fontWeight: '500'
                              }}>
                                {token.name}
                              </div>
                              <div style={{
                                color: '#666',
                                fontSize: '12px'
                              }}>
                                {token.symbol}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{
                          padding: '16px 0',
                          borderBottom: '1px solid #f7f8fa',
                          whiteSpace: 'nowrap',
                          fontWeight: '700',
                          color: '#00d4aa'
                        }}>{token.aptRaised} APT</td>
                        <td style={{
                          padding: '16px 0',
                          borderBottom: '1px solid #f7f8fa',
                          whiteSpace: 'nowrap',
                          fontWeight: '300',
                          color: '#ff4757'
                        }}>{token.aptExpiring} APT</td>
                        <td style={{
                          padding: '16px 0',
                          borderBottom: '1px solid #f7f8fa',
                          whiteSpace: 'nowrap'
                        }}>{token.boosters}</td>
                        <td style={{
                          padding: '16px 0',
                          borderBottom: '1px solid #f7f8fa',
                          whiteSpace: 'nowrap'
                        }}>{token.holders}</td>
                        <td style={{
                          padding: '16px 0',
                          borderBottom: '1px solid #f7f8fa',
                          whiteSpace: 'nowrap'
                        }}>{token.age}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Content Right - Boost Interface */}
            <div style={{
              width: '400px',
              background: '#ffffff',
              borderLeft: '1px solid #d3d3d3',
              padding: '20px',
              flexShrink: 0
            }}>
              <div style={{
                marginBottom: '30px'
              }}>
                {/* Countdown Section */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: '#ffffff',
                  padding: '16px 24px',
                  borderRadius: '12px',
                  color: 'white',
                  minWidth: '120px'
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    opacity: 0.9,
                    color: '#6b7280'
                  }}>
                    Next Update
                  </div>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: '700',
                    margin: '4px 0',
                    color: '#000'
                  }}>
                    {countdown}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    opacity: 0.9,
                    color: '#6b7280'
                  }}>
                    seconds
                  </div>
                </div>

                {/* Token Details */}
                {selectedToken ? (
                  <div style={{
                    marginTop: '20px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '20px',
                      padding: '16px',
                      background: '#f8f9fa',
                      borderRadius: '8px'
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        background: selectedToken.iconBg
                      }}>
                        {selectedToken.icon}
                      </div>
                      <div style={{
                        flex: 1
                      }}>
                        <h3 style={{
                          fontSize: '18px',
                          fontWeight: '600',
                          margin: '0 0 4px 0',
                          color: '#1a202c'
                        }}>
                          {selectedToken.name}
                        </h3>
                        <p style={{
                          fontSize: '14px',
                          color: '#6b7280',
                          margin: 0
                        }}>
                          {selectedToken.symbol}
                        </p>
                      </div>
                    </div>

                    <div style={{
                      marginBottom: '20px'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 0',
                        borderBottom: '1px solid #e2e8f0'
                      }}>
                        <span style={{
                          fontSize: '14px',
                          color: '#6b7280',
                          fontWeight: '500'
                        }}>
                          Current Position:
                        </span>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#1a202c'
                        }}>
                          {selectedToken.position}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 0',
                        borderBottom: '1px solid #e2e8f0'
                      }}>
                        <span style={{
                          fontSize: '14px',
                          color: '#6b7280',
                          fontWeight: '500'
                        }}>
                          APT Raised:
                        </span>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#1a202c'
                        }}>
                          {selectedToken.aptRaised} APT
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 0',
                        borderBottom: '1px solid #e2e8f0'
                      }}>
                        <span style={{
                          fontSize: '14px',
                          color: '#6b7280',
                          fontWeight: '500'
                        }}>
                          APT Expiring:
                        </span>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#1a202c'
                        }}>
                          {selectedToken.aptExpiring} APT
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 0',
                        borderBottom: '1px solid #e2e8f0'
                      }}>
                        <span style={{
                          fontSize: '14px',
                          color: '#6b7280',
                          fontWeight: '500'
                        }}>
                          APT to Next Spot:
                        </span>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#1a202c'
                        }}>
                          {selectedToken.position === 1 ? 'N/A' : '91 APT'}
                        </span>
                      </div>
                    </div>

                    <div style={{
                      marginTop: '20px'
                    }}>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#6b7280',
                        marginBottom: '8px'
                      }}>
                        APT to Spend:
                      </label>
                      <input
                        type="number"
                        value={boostAmount}
                        onChange={(e) => setBoostAmount(e.target.value)}
                        placeholder="0.0"
                        min="0"
                        step="0.1"
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '16px',
                          marginBottom: '12px',
                          background: 'white'
                        }}
                      />
                      <button
                        onClick={handleBoost}
                        style={{
                          width: '100%',
                          padding: '12px 24px',
                          background: '#ff6b35',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                          marginBottom: '8px'
                        }}
                      >
                        Boost
                      </button>
                      <button
                        onClick={handleTrade}
                        style={{
                          width: '100%',
                          padding: '12px 24px',
                          background: 'white',
                          color: '#00d4aa',
                          border: '2px solid #00d4aa',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        Trade
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#6b7280',
                    fontSize: '14px'
                  }}>
                    <p>Click on any token in the leaderboard to boost it</p>
                  </div>
                )}
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

export default Boost; 