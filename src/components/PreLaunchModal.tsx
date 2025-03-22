import React, { useState } from 'react';
import '../styles/PreLaunchModal.css';

interface PreLaunchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLaunch: (initialPurchaseAmount: string) => void;
    tokenDetails: {
        name: string;
        symbol: string;
        twitterLink: string | null;
        websiteLink: string | null;
    };
    loading: boolean;
}

const PreLaunchModal: React.FC<PreLaunchModalProps> = ({
    isOpen,
    onClose,
    onLaunch,
    tokenDetails,
    loading
}) => {
    const [initialPurchaseAmount, setInitialPurchaseAmount] = useState<string>("");

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLaunch(initialPurchaseAmount);
    };

    return (
        <div className="modal-overlay">
            <div className="pre-launch-modal">
                <div className="modal-header">
                    <h2>Ready to Launch {tokenDetails.symbol}?</h2>
                    <button className="close-button" onClick={onClose} disabled={loading}>×</button>
                </div>

                <div className="modal-content">
                    <div className="token-info">
                        <div className="info-row">
                            <span className="label">Name:</span>
                            <span className="value">{tokenDetails.name}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Symbol:</span>
                            <span className="value">{tokenDetails.symbol}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Supply:</span>
                            <span className="value">1,000,000,000</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="purchase-form">
                        <div className="purchase-section">
                            <label className="purchase-label">
                                Initial Purchase Amount
                                <div className="purchase-description">
                                    Buy tokens at launch to prevent sniping
                                </div>
                            </label>
                            <div className="amount-input-container">
                                <input
                                    type="number"
                                    value={initialPurchaseAmount}
                                    onChange={(e) => setInitialPurchaseAmount(e.target.value)}
                                    className="purchase-input"
                                    placeholder="Amount of tokens to buy"
                                    min="0"
                                    step="1"
                                    disabled={loading}
                                />
                                <div className="apt-estimate">
                                    ≈ {initialPurchaseAmount ? (parseFloat(initialPurchaseAmount) * 0.001).toFixed(3) : '0.000'} APT
                                </div>
                            </div>
                        </div>

                        <div className="button-group">
                            <button 
                                type="button" 
                                className="cancel-button" 
                                onClick={onClose}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="launch-button"
                                disabled={loading}
                            >
                                {loading ? "Launching..." : "Launch Token"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default PreLaunchModal; 