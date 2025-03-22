import React, { useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Link, useParams } from "react-router-dom";
import { Types } from "aptos";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import './Profile.css';
import '../styles/header.css';

interface Token {
    name: string;
    symbol: string;
    supply: number;
    txHash: string;
    image: string | null;
    launchDate: string;
    creator: string;
}

const config = new AptosConfig({ network: Network.DEVNET });
const client = new Aptos(config);

const Profile: React.FC = () => {
    const { account } = useWallet();
    const { address } = useParams();
    const [tokens, setTokens] = useState<Token[]>([]);
    const [viewingAddress, setViewingAddress] = useState<string | null>(null);

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
        
        if (diffInHours < 1) {
            const minutes = Math.floor(diffInHours * 60);
            return `${minutes} minutes ago`;
        } else if (diffInHours < 24) {
            const hours = Math.floor(diffInHours);
            return `${hours} hours ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    const getTransactionTimestamp = async (txHash: string): Promise<string> => {
        try {
            const txn = await client.getTransactionByHash({ transactionHash: txHash });
            if ('timestamp_usecs' in txn) {
                return new Date(Number(txn.timestamp_usecs) / 1000).toISOString();
            }
        } catch (error) {
            console.error("Error fetching transaction:", error);
        }
        return new Date().toISOString();
    };

    useEffect(() => {
        const updateTokens = async () => {
            const targetAddress = address || (account ? String(account.address) : null);
            if (targetAddress) {
                setViewingAddress(targetAddress);
                let users = JSON.parse(localStorage.getItem("users") || "{}");

                if (!users[targetAddress]) {
                    users[targetAddress] = { launchedTokens: [] };
                }

                if (!users[targetAddress].launchedTokens || !Array.isArray(users[targetAddress].launchedTokens)) {
                    users[targetAddress].launchedTokens = [];
                }

                // Update existing tokens to include creator field and correct launch date if missing
                let needsUpdate = false;
                const updatedTokens = await Promise.all(users[targetAddress].launchedTokens.map(async (token: Token) => {
                    if (!token.creator || !token.launchDate) {
                        needsUpdate = true;
                        const launchDate = await getTransactionTimestamp(token.txHash);
                        return {
                            ...token,
                            creator: targetAddress,
                            launchDate
                        };
                    }
                    return token;
                }));

                if (needsUpdate) {
                    users[targetAddress].launchedTokens = updatedTokens;
                    localStorage.setItem("users", JSON.stringify(users));
                }

                setTokens(updatedTokens);
            }
        };

        updateTokens();
    }, [account, address]);

    const truncateAddress = (address: any) => {
        if (!address) return "Unknown";
        const addressString = String(address);
        return `${addressString.slice(0, 6)}...${addressString.slice(-4)}`;
    };

    const copyAddress = () => {
        if (account?.address) {
            navigator.clipboard.writeText(String(account.address));
            alert("Address copied!");
        }
    };

    return (
        <div className="profile-page">
            <div className="profile-container">
                <h1 className="profile-title">Profile</h1>
                {viewingAddress ? (
                    <>
                        <div className="profile-wallet">
                            <strong>Wallet:</strong> {truncateAddress(viewingAddress)}
                            <button className="copy-button" onClick={() => {
                                navigator.clipboard.writeText(viewingAddress);
                                alert("Address copied!");
                            }}>Copy</button>
                        </div>
                        <h2 className="profile-subtitle">Launched Tokens ({tokens.length})</h2>

                        {tokens.length > 0 ? (
                            <div className="profile-tokens">
                                {tokens.map((token, index) => (
                                    <Link to={`/token/${token.txHash}`} key={index} className="token-link" style={{ textDecoration: 'none' }}>
                                        <div className="token-icon">
                                            <div className="token-image">
                                                {token.image ? (
                                                    <img src={token.image} alt={token.name} />
                                                ) : (
                                                    <div className="no-image">(no image)</div>
                                                )}
                                            </div>
                                            <div className="token-content">
                                                <div className="token-header">
                                                    <div className="token-title">
                                                        <p className="token-symbol">{token.symbol}</p>
                                                        <p className="token-name">{token.name}</p>
                                                    </div>
                                                    <p className="token-contract">
                                                        <strong>CA:</strong>{" "}
                                                        <span className="contract-address">
                                                            {truncateAddress(token.txHash)}
                                                        </span>
                                                        <button 
                                                            className="copy-button small"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                navigator.clipboard.writeText(token.txHash);
                                                                alert("Contract address copied!");
                                                            }}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                                            </svg>
                                                        </button>
                                                    </p>
                                                </div>
                                                <div className="token-details">
                                                    <p className="token-supply">Supply: {token.supply.toLocaleString()}</p>
                                                    <p className="token-launch-date">
                                                        <strong>Launched:</strong> {formatTimeAgo(token.launchDate)}
                                                    </p>
                                                    <p className="token-creator">
                                                        <strong>Creator:</strong>{" "}
                                                        <Link 
                                                            to={`/profile/${token.creator}`} 
                                                            className="creator-link"
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
                                                    className="explorer-link"
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
                            <div className="profile-empty">
                                <p>No tokens launched yet.</p>
                                {!address && <Link to="/launch" className="create-link">Create a Token</Link>}
                            </div>
                        )}
                    </>
                ) : (
                    <p className="profile-empty">Connect wallet to view profile.</p>
                )}
            </div>
        </div>
    );
};

export default Profile;