import React, { useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Link } from "react-router-dom"; // Add this import
import './Profile.css'; // Add this import

interface Token {
    name: string;
    symbol: string;
    supply: number;
    txHash: string;
}

const Profile: React.FC = () => {
    const { account } = useWallet();
    const [tokens, setTokens] = useState<Token[]>([]);

    useEffect(() => {
      if (account) {
          const walletString = String(account.address);
          let users = JSON.parse(localStorage.getItem("users") || "{}");
  
          console.log("🔍 Profile: Full Users Object from localStorage:", users);
          console.log("🔍 Profile: Wallet String:", walletString);
          console.log("🔍 Profile: Users[walletString]:", users[walletString]);
  
          if (!users[walletString]) {
              console.warn(`⚠️ Profile: Wallet address ${walletString} not found in localStorage. Initializing.`);
              users[walletString] = { launchedTokens: [] };
          }
  
          if (!users[walletString].launchedTokens || !Array.isArray(users[walletString].launchedTokens)) {
              console.error("🛑 Profile: launchedTokens is NOT an array or missing! Resetting...");
              users[walletString].launchedTokens = [];
          }
  
          localStorage.setItem("users", JSON.stringify(users));
  
          console.log("✅ Profile: Users AFTER Fix:", users);
          console.log("✅ Profile: launchedTokens:", users[walletString].launchedTokens);
  
          setTokens([...users[walletString].launchedTokens]);
      }
  }, [account]);

    return (
        <div className="container">
            <h1 className="text-2xl mb-4">Profile</h1>

            {account ? (
                <>
                    <p><strong>Wallet Address:</strong> {String(account.address)}</p>
                    <h2 className="text-xl mt-4">Tokens Launched:</h2>

                    {tokens.length > 0 ? (
                        <div>
                            {tokens.map((token, index) => (
                                <div key={index} className="profile-token-container border p-2 mt-2">
                                    <Link to={`/token/${token.txHash}`}>
                                        <p><strong>Name:</strong> {token.name}</p>
                                        <p><strong>Symbol:</strong> {token.symbol}</p>
                                        <p><strong>Supply:</strong> {token.supply}</p>
                                    </Link>
                                    <p>
                                        <a href={`https://explorer.aptoslabs.com/txn/${token.txHash}?network=testnet`} target="_blank">
                                            View on Explorer
                                        </a>
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p>No tokens launched yet.</p>
                    )}
                </>
            ) : (
                <p>Connect wallet to view profile.</p>
            )}
        </div>
    );
};

export default Profile;