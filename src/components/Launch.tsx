import React, { useState } from "react";
import "../MoveMint.css";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { InputTransactionData } from "@aptos-labs/wallet-adapter-core";
import { useNavigate } from "react-router-dom"; // Add useNavigate for redirect

// Explicitly set the fullnode URL for Devnet
const config = new AptosConfig({
    network: Network.DEVNET,
    fullnode: "https://fullnode.devnet.aptoslabs.com/v1",
});
const client = new Aptos(config);

const Launch: React.FC = () => {
    console.log("🚀 Launch page is loading...");
    const { account, signAndSubmitTransaction, network } = useWallet();
    const [name, setName] = useState<string>("");
    const [symbol, setSymbol] = useState<string>("");
    const [logo, setLogo] = useState<File | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const navigate = useNavigate(); // Add navigate for redirect

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setLogo(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("✅ handleSubmit function is running!");
        if (!account) {
            alert("You must connect your wallet before launching a token.");
            return;
        }
        console.log("🌐 Wallet network:", network?.name || "unknown", network);

        const walletString = String(account.address);
        let users = JSON.parse(localStorage.getItem("users") || "{}");
        if (!users[walletString]) {
            users[walletString] = { launchedTokens: [] };
        }
        if (!Array.isArray(users[walletString].launchedTokens)) {
            users[walletString].launchedTokens = [];
        }
        localStorage.setItem("users", JSON.stringify(users));
        setLoading(true);

        try {
            const fixedSupply = 1_000_000_000;
            const formattedSymbol = symbol.startsWith("$") ? symbol : `$${symbol}`;

            // Call the create_token function from your token_launcher module
            const coinTransaction: InputTransactionData = {
                data: {
                    function: "0xc156a41155e21f972e4158caf1cac90311543b062f49b45536d6fd17708a4198::token_launcher::create_token",
                    typeArguments: [],
                    functionArguments: [
                        name,              // Name as string
                        formattedSymbol,   // Symbol as string
                        6,                 // Decimals (e.g., 6 for micro-units)
                        fixedSupply,       // Total supply
                    ],
                },
            };

            console.log("🚀 Coin Transaction Data:", JSON.stringify(coinTransaction, null, 2));
            const coinResponse = await signAndSubmitTransaction(coinTransaction);
            console.log("ℼ️ Coin Response (Full):", JSON.stringify(coinResponse, null, 2));
            if (!coinResponse || !coinResponse.hash) {
                throw new Error("Coin creation failed or response is invalid: " + JSON.stringify(coinResponse));
            }

            const coinHash = coinResponse.hash;
            console.log("ℼ️ Coin Hash to Confirm (before wait):", coinHash);

            let transactionConfirmed = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    console.log(`⏳ Attempt ${attempt} to wait for coin transaction (hash: ${coinHash})...`);
                    await Promise.race([
                        client.waitForTransaction({ transactionHash: coinHash }),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout after 60 seconds")), 60000))
                    ]);
                    transactionConfirmed = true;
                    break;
                } catch (waitError) {
                    console.error(`❌ Attempt ${attempt} failed to confirm transaction:`, waitError);
                    if (attempt === 3) throw waitError;
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            if (!transactionConfirmed) {
                throw new Error("Coin transaction confirmation timed out after retries.");
            }

            console.log("✅ Coin created. Hash:", coinHash);

            users[walletString].launchedTokens.push({
                name,
                symbol: formattedSymbol,
                supply: fixedSupply,
                txHash: coinHash,
            });

            localStorage.setItem("users", JSON.stringify(users));
            alert(`✅ Coin created! Tx: https://explorer.aptoslabs.com/txn/${coinHash}?network=devnet`);
            navigate(`/token/${coinHash}`); // Redirect to the token page
        } catch (error) {
            console.error("❌ Error launching coin:", error);
            alert(`🚨 Failed to launch coin: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setLoading(false);
            setName("");
            setSymbol("");
            setLogo(null);
        }
    };

    return (
        <div className="launch-page">
            <div className="launch-container">
                <h1>Launch Your Token</h1>
                <form onSubmit={handleSubmit} className="launch-form">
                    <label className="input-label" htmlFor="token-name">Token Name</label>
                    <input
                        id="token-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={loading}
                    />
                    <label className="input-label" htmlFor="token-symbol">Ticker</label>
                    <input
                        id="token-symbol"
                        type="text"
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value)}
                        required
                        disabled={loading}
                    />
                    <label className="input-label" htmlFor="supply">Total Supply</label>
                    <input
                        id="supply"
                        type="number"
                        value="1000000000"
                        disabled
                        className="disabled-input"
                    />
                    <label className="input-label">Upload Token Image</label>
                    <div className="custom-upload-container">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="upload-input"
                            id="file-upload"
                            disabled={loading}
                        />
                        <label htmlFor="file-upload" className="upload-button">
                            <img src="/assets/uploadicon.svg" alt="Upload Icon" className="upload-icon" />
                        </label>
                    </div>
                    {logo && <p className="file-name">Selected File: {logo.name}</p>}
                    <button type="submit" className="launch-btn1" disabled={loading}>
                        {loading ? "Launching..." : "Launch"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Launch;