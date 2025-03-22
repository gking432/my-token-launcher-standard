import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import '../styles/Landing.css';
import './Profile.css'; // Import Profile.css for token card styles
import '../styles/header.css';
import '../styles/Marketplace.css'; // Import Marketplace.css for marketplace section styles
import { Link } from 'react-router-dom';

interface Token {
    name: string;
    symbol: string;
    supply: number;
    txHash: string;
    image: string | null;
    launchDate: string;
    creator: string;
}

const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const { account } = useWallet();
    const gridRef = useRef<HTMLDivElement>(null);
    const marketplaceRef = useRef<HTMLDivElement>(null);
    const [allTokens, setAllTokens] = useState<Token[]>([]);
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'highest_mc' | 'lowest_mc' | 'highest_vol' | 'lowest_vol'>('newest');
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    useEffect(() => {
        // Generate hexagon grid
        if (gridRef.current) {
            const cols = Math.ceil(window.innerWidth / 70);
            const rows = Math.ceil(window.innerHeight / 62);
            
            for (let i = 0; i < cols * rows; i++) {
                const hex = document.createElement("div");
                hex.classList.add("hex");
                gridRef.current.appendChild(hex);
            }
        }

        // Create pulse effect
        const createPulse = () => {
            const pulse = document.createElement("div");
            pulse.classList.add("pulse");
            const x = Math.random() * window.innerWidth;
            const y = Math.random() * window.innerHeight;
            pulse.style.left = `${x}px`;
            pulse.style.top = `${y}px`;
            document.body.appendChild(pulse);
            setTimeout(() => pulse.remove(), 2000);
        };

        const pulseInterval = setInterval(createPulse, 2000);

        // Hexagon hover effect
        const handleMouseMove = (e: MouseEvent) => {
            const hex = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
            if (hex?.classList.contains("hex")) {
                hex.classList.add("active");
                const hexes = document.querySelectorAll(".hex");
                const hexRect = hex.getBoundingClientRect();
                const hexCenterX = hexRect.left + hexRect.width / 2;
                const hexCenterY = hexRect.top + hexRect.height / 2;
                
                hexes.forEach(h => {
                    if (h !== hex) {
                        const hRect = h.getBoundingClientRect();
                        const hCenterX = hRect.left + hRect.width / 2;
                        const hCenterY = hRect.top + hRect.height / 2;
                        const distance = Math.sqrt(
                            Math.pow(hexCenterX - hCenterX, 2) + 
                            Math.pow(hexCenterY - hCenterY, 2)
                        );
                        if (distance < 100) {
                            setTimeout(() => {
                                (h as HTMLElement).classList.add("active");
                                setTimeout(() => (h as HTMLElement).classList.remove("active"), 600);
                            }, distance * 2);
                        }
                    }
                });
                setTimeout(() => hex.classList.remove("active"), 800);
            }
        };

        document.addEventListener("mousemove", handleMouseMove);

        // Fetch all tokens from localStorage
        const fetchAllTokens = () => {
            const users = JSON.parse(localStorage.getItem("users") || "{}");
            const tokens: Token[] = [];
            Object.keys(users).forEach(wallet => {
                const userTokens = users[wallet].launchedTokens || [];
                userTokens.forEach((token: Token) => {
                    tokens.push({ ...token, creator: wallet });
                });
            });
            // Sort tokens by launch date
            tokens.sort((a, b) => {
                const dateA = new Date(a.launchDate).getTime();
                const dateB = new Date(b.launchDate).getTime();
                return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
            });
            setAllTokens(tokens);
        };
        fetchAllTokens();

        // Cleanup
        return () => {
            clearInterval(pulseInterval);
            document.removeEventListener("mousemove", handleMouseMove);
        };
    }, [sortOrder]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.sort-dropdown')) {
                setActiveDropdown(null);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    const handleLaunch = () => {
        navigate('/launch');
    };

    const truncateAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
        if (diffInHours < 1) return `${Math.floor(diffInHours * 60)} minutes ago`;
        if (diffInHours < 24) return `${Math.floor(diffInHours)} hours ago`;
        return date.toLocaleDateString();
    };

    const handleDropdownClick = (dropdownName: string, event: React.MouseEvent) => {
        event.stopPropagation();
        setActiveDropdown(activeDropdown === dropdownName ? null : dropdownName);
    };

    return (
        <>
            <div className="hexagon-grid" ref={gridRef}></div>
            <div className="viewport">
                <h1 className="headline">Fast, Simple, Secure</h1>
                <p className="tagline">Create and launch your token in seconds with zero coding. The most intuitive platform for the next generation of crypto projects.</p>
                <div className="button-group">
                    <button className="launch-btn primary-btn" onClick={handleLaunch}>
                        Launch Now
                    </button>
                    <button className="trade-btn secondary-btn" onClick={() => marketplaceRef.current?.scrollIntoView({ behavior: 'smooth' })}>
                        Trade
                    </button>
                </div>
                <div className="stats">
                    <div className="stat">
                        <div className="stat-value">30s</div>
                        <div className="stat-label">Launch Time</div>
                    </div>
                    <div className="stat">
                        <div className="stat-value">$0.001</div>
                        <div className="stat-label">Avg Gas Fee</div>
                    </div>
                    <div className="stat">
                        <div className="stat-value">0.00</div>
                        <div className="stat-label">Outages</div>
                    </div>
                </div>
                
               
                
                <div className="features">
                    <div className="feature">
                        <div className="feature-icon">⚡</div>
                        <h3 className="feature-title">One-Click Deploy</h3>
                        <p className="feature-desc">Launch your token with a single click. No coding required. Set parameters and we handle the rest.</p>
                    </div>
                    <div className="feature">
                        <div className="feature-icon">🔒</div>
                        <h3 className="feature-title">Instant Liquidity</h3>
                        <p className="feature-desc">Auto-generate liquidity pools on major DEXs with customizable ratios and locks.</p>
                    </div>
                    <div className="feature">
                        <div className="feature-icon">📊</div>
                        <h3 className="feature-title">Real-time Analytics</h3>
                        <p className="feature-desc">Watch your token grow with live price tracking, holder analytics, and trading volume.</p>
                    </div>
                </div>

                {/* Marketplace Section */}
                <div className="marketplace" ref={marketplaceRef}>
                    <div className="marketplace-header">
                        <h2 className="marketplace-title">Token Marketplace</h2>
                    </div>
                    <p className="marketplace-subtitle">Explore all tokens launched on the platform</p>
                    <div className="sort-header">
                        <p>Sort by:</p>
                    </div>
                    <div className="marketplace-sort">
                        <div className={`sort-dropdown ${activeDropdown === 'marketCap' ? 'active' : ''}`}>
                            <div 
                                className="sort-dropdown-header"
                                onClick={(e) => handleDropdownClick('marketCap', e)}
                            >
                                <span>Market Cap</span>
                                <span className="dropdown-arrow">▼</span>
                            </div>
                            <div className="sort-dropdown-content">
                                <button 
                                    className={`sort-option ${sortOrder === 'highest_mc' ? 'active' : ''}`}
                                    onClick={() => {
                                        setSortOrder('highest_mc');
                                        setActiveDropdown(null);
                                    }}
                                >
                                    Highest First
                                </button>
                                <button 
                                    className={`sort-option ${sortOrder === 'lowest_mc' ? 'active' : ''}`}
                                    onClick={() => {
                                        setSortOrder('lowest_mc');
                                        setActiveDropdown(null);
                                    }}
                                >
                                    Lowest First
                                </button>
                            </div>
                        </div>
                        <div className={`sort-dropdown ${activeDropdown === 'volume' ? 'active' : ''}`}>
                            <div 
                                className="sort-dropdown-header"
                                onClick={(e) => handleDropdownClick('volume', e)}
                            >
                                <span>Volume</span>
                                <span className="dropdown-arrow">▼</span>
                            </div>
                            <div className="sort-dropdown-content">
                                <button 
                                    className={`sort-option ${sortOrder === 'highest_vol' ? 'active' : ''}`}
                                    onClick={() => {
                                        setSortOrder('highest_vol');
                                        setActiveDropdown(null);
                                    }}
                                >
                                    Highest First
                                </button>
                                <button 
                                    className={`sort-option ${sortOrder === 'lowest_vol' ? 'active' : ''}`}
                                    onClick={() => {
                                        setSortOrder('lowest_vol');
                                        setActiveDropdown(null);
                                    }}
                                >
                                    Lowest First
                                </button>
                            </div>
                        </div>
                        <div className={`sort-dropdown ${activeDropdown === 'age' ? 'active' : ''}`}>
                            <div 
                                className="sort-dropdown-header"
                                onClick={(e) => handleDropdownClick('age', e)}
                            >
                                <span>Age</span>
                                <span className="dropdown-arrow">▼</span>
                            </div>
                            <div className="sort-dropdown-content">
                                <button 
                                    className={`sort-option ${sortOrder === 'newest' ? 'active' : ''}`}
                                    onClick={() => {
                                        setSortOrder('newest');
                                        setActiveDropdown(null);
                                    }}
                                >
                                    Newest First
                                </button>
                                <button 
                                    className={`sort-option ${sortOrder === 'oldest' ? 'active' : ''}`}
                                    onClick={() => {
                                        setSortOrder('oldest');
                                        setActiveDropdown(null);
                                    }}
                                >
                                    Oldest First
                                </button>
                            </div>
                        </div>
                    </div>
                    {allTokens.length > 0 ? (
                        <div className="marketplace-tokens">
                            {allTokens.map((token, index) => (
                                <Link to={`/token/${token.txHash}`} key={index} className="marketplace-token-link">
                                    <div className="marketplace-token-card">
                                        <div className="marketplace-token-image">
                                            {token.image ? (
                                                <img src={token.image} alt={token.name} />
                                            ) : (
                                                <div className="marketplace-no-image">(no image)</div>
                                            )}
                                        </div>
                                        <div className="marketplace-token-content">
                                            <div className="marketplace-token-header">
                                                <div className="marketplace-token-title">
                                                    <p className="marketplace-token-symbol">{token.symbol}</p>
                                                    <p className="marketplace-token-name">{token.name}</p>
                                                </div>
                                            </div>
                                            <div className="marketplace-token-details">
                                                <p className="marketplace-token-launch-date">Launched: {formatTimeAgo(token.launchDate)}</p>
                                                <p className="marketplace-token-creator">
                                                    <strong>Creator:</strong>{" "}
                                                    <Link 
                                                        to={`/profile/${token.creator}`} 
                                                        className="marketplace-creator-link"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {truncateAddress(token.creator)}
                                                    </Link>
                                                </p>
                                            </div>
                                            <a 
                                                href={`https://explorer.aptoslabs.com/txn/${token.txHash}?network=devnet`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="marketplace-explorer-link"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                View on Explorer <span>↗</span>
                                            </a>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <p className="marketplace-empty">No tokens have been launched yet.</p>
                    )}
                </div>
            </div>
        </>
    );
};

export default LandingPage;