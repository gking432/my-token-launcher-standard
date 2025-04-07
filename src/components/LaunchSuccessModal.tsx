import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { InputTransactionData } from "@aptos-labs/wallet-adapter-core";
import '../styles/LaunchSuccessModal.css';

interface LaunchSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    tokenDetails: {
        name: string;
        symbol: string;
        txHash: string;
        metadataAddress: string;
    };
}

const tokenLauncherAddresses = {
    devnet: "0x01a528fbcae190eee5b60e58c9971af4a2143fe2c706b681d4de5d005fc0ec7f",
};

const LaunchSuccessModal: React.FC<LaunchSuccessModalProps> = ({ isOpen, onClose, tokenDetails }) => {
    const [amount, setAmount] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const { account, signAndSubmitTransaction } = useWallet();
    const navigate = useNavigate();
    const config = new AptosConfig({ network: Network.DEVNET });
    const client = new Aptos(config);
    const tokenLauncherAddress = tokenLauncherAddresses['devnet'];

    const handlePurchase = async () => {
        if (!account || !amount || parseFloat(amount) <= 0) {
            alert("Please enter a valid amount");
            return;
        }

        setLoading(true);
        try {
            const aptAmount = Math.floor(parseFloat(amount) * 0.001 * 10 ** 8); // 0.001 APT per token

            // Check APT balance
            const balance = await client.getAccountCoinAmount({
                accountAddress: account.address,
                coinType: "0x1::aptos_coin::AptosCoin",
            });
            
            if (BigInt(balance) < BigInt(aptAmount)) {
                alert("Insufficient APT balance for this purchase.");
                return;
            }

            // Transfer APT
            const payTransaction: InputTransactionData = {
                data: {
                    function: "0x1::aptos_account::transfer",
                    typeArguments: [],
                    functionArguments: [tokenLauncherAddress, aptAmount],
                },
            };
            const payResponse = await signAndSubmitTransaction(payTransaction);
            await client.waitForTransaction({ transactionHash: payResponse.hash });

            // Buy tokens
            const buyTransaction: InputTransactionData = {
                data: {
                    function: `${tokenLauncherAddress}::token_launcher::buy_tokens`,
                    typeArguments: [],
                    functionArguments: [
                        tokenDetails.metadataAddress,
                        Math.floor(parseFloat(amount) * 10 ** 6),
                        aptAmount
                    ],
                },
            };
            const response = await signAndSubmitTransaction(buyTransaction);
            await client.waitForTransaction({ transactionHash: response.hash });
            
            alert(`Successfully purchased ${amount} ${tokenDetails.symbol}!`);
            onClose();
            navigate(`/token/${tokenDetails.txHash}`);
        } catch (error) {
            console.error("Purchase failed:", error);
            alert("Failed to purchase tokens. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="launch-success-modal">
                <h2>🎉 Token Successfully Launched!</h2>
                <p className="token-info">
                    <strong>{tokenDetails.name}</strong> ({tokenDetails.symbol})
                </p>
                <p className="success-message">
                    Your token has been created and is ready for trading.
                </p>
                <div className="purchase-section">
                    <h3>Want to buy some tokens?</h3>
                    <p className="price-info">Price: 0.001 APT per token</p>
                    <div className="amount-input">
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Enter amount to buy"
                            min="0"
                        />
                        <span className="token-symbol">{tokenDetails.symbol}</span>
                    </div>
                    <div className="apt-estimate">
                        ≈ {amount ? (parseFloat(amount) * 0.001).toFixed(3) : '0.000'} APT
                    </div>
                </div>
                <div className="modal-actions">
                    <button 
                        className="purchase-btn" 
                        onClick={handlePurchase}
                        disabled={loading || !amount || parseFloat(amount) <= 0}
                    >
                        {loading ? "Purchasing..." : "Purchase Tokens"}
                    </button>
                    <button className="skip-btn" onClick={onClose}>
                        Skip for now
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LaunchSuccessModal; 