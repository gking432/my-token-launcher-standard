import React, { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";
import { InputTransactionData } from "@aptos-labs/wallet-adapter-core";
import { useNavigate } from "react-router-dom";
import '../styles/launchpage.css';
import PreLaunchModal from './PreLaunchModal';
import { Buffer } from "buffer";
window.Buffer = window.Buffer || Buffer;

// Define interfaces at the top
interface TokenMetadataEntry {
    original_name: number[];
    ticker: number[];
    image: number[];
    metadata_addr: string;
}
interface TokenMetadata {
    entries: TokenMetadataEntry[];
    market_cap: string;
}

const CONTRACT_ADDRESSES: Record<string, string> = {
    devnet: "0x505b8a2f4688f18db6d30659afd93384c35e769b163ef5d4d52dd0a1db43da7b",
    testnet: "",
    mainnet: "",
};

function stringToBytes(str: string): number[] {
    return Array.from(new TextEncoder().encode(str));
}

function stringToHex(str: string): string {
    return "0x" + Buffer.from(str, "utf8").toString("hex");
}

const config = new AptosConfig({
    network: Network.DEVNET,
    fullnode: "https://fullnode.devnet.aptoslabs.com/v1",
});
const client = new Aptos(config);
const tokenLauncherAddress = CONTRACT_ADDRESSES['devnet'];

const Launch: React.FC = () => {
    const { account, signAndSubmitTransaction, network } = useWallet();
    const navigate = useNavigate();
    const [loading, setLoading] = useState<boolean>(false);
    const [logo, setLogo] = useState<File | null>(null);
    const [showPreLaunchModal, setShowPreLaunchModal] = useState(false);
    const [pendingLaunchData, setPendingLaunchData] = useState<{
        name: string;
        symbol: string;
        twitterLink: string | null;
        websiteLink: string | null;
    } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setLogo(e.target.files[0]);
        }
    };

    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!account) {
            alert("You must connect your wallet before launching a token.");
            return;
        }

        const formData = new FormData(e.currentTarget);
        const name = formData.get("name") as string;
        const symbol = formData.get("symbol") as string;
        const twitterLink = formData.get("twitterLink") as string;
        const websiteLink = formData.get("websiteLink") as string;
        
        setPendingLaunchData({
            name,
            symbol: symbol.startsWith("$") ? symbol : `$${symbol}`,
            twitterLink: twitterLink || null,
            websiteLink: websiteLink || null
        });
        setShowPreLaunchModal(true);
    };

    interface TokenMetadata {
        entries: TokenMetadataEntry[];
        market_cap: number;
      }
      
      interface TokenMetadataEntry {
        image: string;
        metadata_addr: string;
        original_name: string;
        ticker: string; // Based on logs, ticker is a string like "0x24616263"
      }

      const handleLaunchToken = async (initialPurchaseAmount: string) => {
        if (!pendingLaunchData || !account) return;
      
        setLoading(true);
        const walletString = String(account.address);
        let users = JSON.parse(localStorage.getItem("users") || "{}");
        if (!users[walletString]) {
          users[walletString] = { launchedTokens: [] };
        }
        if (!Array.isArray(users[walletString].launchedTokens)) {
          users[walletString].launchedTokens = [];
        }
        localStorage.setItem("users", JSON.stringify(users));
      
        try {
          const supply = 1000000000;
          const symbolBytes = stringToBytes(pendingLaunchData.symbol);
          console.log("=== LAUNCHING TOKEN ===");
          console.log("Symbol:", pendingLaunchData.symbol);
          console.log("Symbol bytes:", JSON.stringify(symbolBytes));
          console.log("Symbol hex:", Buffer.from(symbolBytes).toString("hex"));
          console.log("Creator address:", account.address.toString());
          console.log("=====================");
      
          const createTransaction: InputTransactionData = {
            data: {
              function: `${tokenLauncherAddress}::token_launcher::create_token`,
              typeArguments: [],
              functionArguments: [
                stringToBytes(pendingLaunchData.name),
                symbolBytes,
                6,
                supply,
              ],
            },
          };
      
          const createResponse = await signAndSubmitTransaction(createTransaction);
          if (!createResponse?.hash) {
            throw new Error("Token creation failed: " + JSON.stringify(createResponse));
          }
      
          const createHash = createResponse.hash;
          console.log("Token created. Tx:", createHash);
          await client.waitForTransaction({ transactionHash: createHash });
          console.log("Creation transaction confirmed:", createHash);
      
          // Store token in localStorage
          const tokenData = {
            name: pendingLaunchData.name,
            symbol: pendingLaunchData.symbol,
            supply,
            txHash: createHash,
            image: null,
            launchDate: new Date().toISOString(),
            creator: walletString
          };
          
          let users = JSON.parse(localStorage.getItem("users") || "{}");
          if (!users[walletString]) {
            users[walletString] = { launchedTokens: [] };
          }
          if (!Array.isArray(users[walletString].launchedTokens)) {
            users[walletString].launchedTokens = [];
          }
          users[walletString].launchedTokens.push(tokenData);
          localStorage.setItem("users", JSON.stringify(users));
      
          let metadataAddress = "";
          const creatorAddress = walletString;
          const maxAttempts = 10; // Reduced to 20 seconds
          const delayMs = 2000;
      
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              const moduleState = await client.getAccountResource({
                accountAddress: tokenLauncherAddress,
                resourceType: `${tokenLauncherAddress}::token_launcher::ModuleState`,
              });
              console.log(`Attempt ${attempt} - Raw ModuleState:`, JSON.stringify(moduleState, null, 2));
      
              if (!moduleState.token_metadata?.handle) {
                throw new Error("ModuleState lacks token_metadata.handle");
              }
      
              const tokenMetadata = await client.getTableItem<TokenMetadata>({
                handle: moduleState.token_metadata.handle,
                data: {
                  key: creatorAddress,
                  key_type: "address",
                  value_type: `${tokenLauncherAddress}::token_launcher::TokenMetadata`,
                },
              });
      
              console.log(`Attempt ${attempt} - TokenMetadata entries:`, JSON.stringify(tokenMetadata.entries, null, 2));
              const tokenInfo = tokenMetadata.entries.find((t: TokenMetadataEntry) => {
                const tickerHex = t.ticker.startsWith("0x") ? t.ticker.slice(2) : t.ticker;
                const symbolHex = Buffer.from(symbolBytes).toString("hex");
                console.log(`Attempt ${attempt} - Comparing ticker: ${tickerHex} with symbol: ${symbolHex}`);
                return tickerHex === symbolHex;
              });
      
              if (tokenInfo) {
                metadataAddress = tokenInfo.metadata_addr;
                console.log(`Found metadata address for ${pendingLaunchData.symbol}:`, metadataAddress);
                break;
              }
      
              console.log(`Attempt ${attempt} - ${pendingLaunchData.symbol} not found in metadata`);
            } catch (error) {
              console.error(`Attempt ${attempt} - Metadata fetch error:`, error);
            }
      
            if (attempt < maxAttempts) {
              console.log(`Retrying in ${delayMs}ms...`);
              await new Promise((resolve) => setTimeout(resolve, delayMs));
            } else {
              console.warn("Max attempts reached. Token metadata not found.");
            }
          }
      
          if (!metadataAddress) {
            console.warn("Metadata not found, deriving from ticker...");
            const tickerHex = Buffer.from(symbolBytes).toString("hex");
            metadataAddress = `${creatorAddress}::${tickerHex}`; // Placeholder; refine later
          }
      
          if (initialPurchaseAmount && parseFloat(initialPurchaseAmount) > 0) {
            const tokenAmount = Math.floor(parseFloat(initialPurchaseAmount) * 10 ** 6);
            const tokenPrice = 1000;
            const aptAmount = Math.floor((tokenAmount / 10 ** 6) * tokenPrice);
      
            const buyTransaction: InputTransactionData = {
              data: {
                function: `${tokenLauncherAddress}::token_launcher::buy_tokens`,
                typeArguments: [],
                functionArguments: [creatorAddress, symbolBytes, aptAmount],
              },
            };
      
            const buyResponse = await signAndSubmitTransaction(buyTransaction);
            await client.waitForTransaction({ transactionHash: buyResponse.hash });
            console.log(`Bought ${tokenAmount / 10 ** 6} tokens with ${aptAmount / 10 ** 8} APT. Tx: ${buyResponse.hash}`);
          }
      
          navigate(`/token/${createHash}`, {
            state: {
              name: pendingLaunchData.name,
              symbol: pendingLaunchData.symbol,
              supply,
              txHash: createHash,
              twitterLink: pendingLaunchData.twitterLink,
              websiteLink: pendingLaunchData.websiteLink,
              metadataAddress,
              initialPurchase: initialPurchaseAmount ? parseFloat(initialPurchaseAmount) : 0,
              creator: creatorAddress,
              creationDate: new Date().getTime(),
            },
          });
      
        } catch (error) {
          console.error("Error launching token:", error);
          alert(`Failed to launch token: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
          setLoading(false);
          setLogo(null);
          setShowPreLaunchModal(false);
          setPendingLaunchData(null);
        }
      };

    if (!account) {
        return (
            <div className="launch-page-content">
                <h1 className="launch-page-title">Connect Your Wallet</h1>
                <p className="launch-page-subtitle">Please connect your wallet to launch a token.</p>
            </div>
        );
    }

    return (
        <div className="launch-page-content">
            <h1 className="launch-page-title">Launch Your Token</h1>
            <p className="launch-page-subtitle">Create your own token in seconds with zero coding required.</p>
            
            <form onSubmit={handleFormSubmit} className="launch-form-card">
                <div className="form-columns">
                    <div className="field-group">
                        <div className="launch-form-group">
                            <label className="launch-form-label">Token Name</label>
                            <input
                                type="text"
                                name="name"
                                className="launch-form-input"
                                placeholder="e.g. My Awesome Token"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="launch-form-group">
                            <label className="launch-form-label">Token Symbol</label>
                            <input
                                type="text"
                                name="symbol"
                                className="launch-form-input"
                                placeholder="e.g. MAT"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="social-links-group">
                            <div className="launch-form-group social-link">
                                <label className="launch-form-label">X (Twitter) Link</label>
                                <input
                                    type="url"
                                    name="twitterLink"
                                    className="launch-form-input"
                                    placeholder="x.com"
                                    disabled={loading}
                                />
                            </div>
                            <div className="launch-form-group social-link">
                                <label className="launch-form-label">Website</label>
                                <input
                                    type="url"
                                    name="websiteLink"
                                    className="launch-form-input"
                                    placeholder="www.your-token.com"
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="logo-upload">
                        <label className="launch-form-label">Upload Image</label>
                        <input
                            id="logo-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="launch-form-input"
                            disabled={loading}
                            style={{ display: 'none' }}
                        />
                        <label htmlFor="logo-upload" className="logo-upload-placeholder">
                            <span className="upload-icon">↑</span>
                        </label>
                    </div>
                </div>

                <button type="submit" className="launch-form-button" disabled={loading}>
                    Continue to Launch
                </button>
            </form>
            
            {showPreLaunchModal && pendingLaunchData && (
                <PreLaunchModal
                    isOpen={showPreLaunchModal}
                    onClose={() => {
                        setShowPreLaunchModal(false);
                        setPendingLaunchData(null);
                    }}
                    onLaunch={handleLaunchToken}
                    tokenDetails={pendingLaunchData}
                    loading={loading}
                />
            )}
        </div>
    );
};

export default Launch;