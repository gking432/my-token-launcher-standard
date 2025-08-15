import React, { useState } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";
import { InputTransactionData } from "@aptos-labs/wallet-adapter-core";
import { useNavigate } from "react-router-dom";
import { Buffer } from "buffer";
import { MODULE_ADDRESS } from "../config";
import PreLaunchModal from './PreLaunchModal';
import GlobalSidebar from './GlobalSidebar';

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
    devnet: MODULE_ADDRESS,
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
  
  const [formData, setFormData] = useState({
    tokenName: '',
    ticker: '',
    description: '',
    xLink: '',
    website: '',
    telegram: '',
    verify: null as 'yes' | 'no' | null
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [verifyDropdownOpen, setVerifyDropdownOpen] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVerifySelection = (selection: 'yes' | 'no') => {
    setFormData(prev => ({
      ...prev,
      verify: selection
    }));
  };

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

    const name = formData.tokenName;
    const symbol = formData.ticker.startsWith("$") ? formData.ticker : `$${formData.ticker}`;
    const twitterLink = formData.xLink || null;
    const websiteLink = formData.website || null;
    
    setPendingLaunchData({
      name,
      symbol,
      twitterLink,
      websiteLink
    });
    setShowPreLaunchModal(true);
  };

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
      const maxAttempts = 10;
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
        const tickerHex = Array.isArray(t.ticker) ? Buffer.from(t.ticker).toString("hex") : t.ticker;
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
        metadataAddress = `${creatorAddress}::${tickerHex}`;
      }
  
      if (initialPurchaseAmount && parseFloat(initialPurchaseAmount) > 0) {
        console.log("Initial purchase amount (APT):", initialPurchaseAmount);
        const aptAmountInOctas = Math.floor(parseFloat(initialPurchaseAmount) * 10 ** 8);
        console.log("APT in Octas:", aptAmountInOctas);
        const buyTransaction: InputTransactionData = {
          data: {
            function: `${tokenLauncherAddress}::token_launcher::buy_tokens`,
            functionArguments: [creatorAddress, symbolBytes, aptAmountInOctas],
          },
        };
        const buyResponse = await signAndSubmitTransaction(buyTransaction);
        console.log("Buy response:", buyResponse);
        await client.waitForTransaction({ transactionHash: buyResponse.hash });
        console.log(`Bought with ${initialPurchaseAmount} APT. Tx: ${buyResponse.hash}`);
      }
  
      navigate(`/newtoken/${createHash}`, {
        state: {
          name: pendingLaunchData.name,
          symbol: pendingLaunchData.symbol,
          supply,
          txHash: createHash,
          twitterLink: pendingLaunchData.twitterLink,
          websiteLink: pendingLaunchData.websiteLink,
          metadataAddress,
          initialPurchase: initialPurchaseAmount ? parseFloat(initialPurchaseAmount) : 0,
          creatorAddress: creatorAddress,
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

  // Watchlist data for the sidebar
  const watchlistData = [
    { name: 'Bitcoin', symbol: 'BTC', icon: '₿', iconBg: '#f7931a' },
    { name: 'Ethereum', symbol: 'ETH', icon: 'Ξ', iconBg: '#627eea' },
    { name: 'Tether', symbol: 'USDT', icon: '₮', iconBg: '#50af95' },
    { name: 'BNB', symbol: 'BNB', icon: '◉', iconBg: '#f0b90b' }
  ];

  if (!account) {
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
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#f8fafc'
        }}>
          <div style={{
            textAlign: 'center',
            padding: '40px',
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#1e293b',
              marginBottom: '16px'
            }}>
              Connect Your Wallet
            </h1>
            <p style={{
              color: '#64748b',
              fontSize: '1.1rem'
            }}>
              Please connect your wallet to launch a token.
            </p>
          </div>
        </div>
      </div>
    );
  }

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
          watchlistData={watchlistData}
          activeTab="launch"
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
              Launch
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
              {account ? (
                <div style={{
                  background: '#00d4aa',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '14px'
                }}>
                  {account.address.toString().slice(0, 6)}...{account.address.toString().slice(-4)}
                </div>
              ) : (
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
              )}
            </div>
          </div>

          {/* Launch Form Content */}
          <div style={{
            flex: 1,
            background: '#ffffff',
            padding: '40px 0',
            overflowY: 'auto'
          }}>
            <div style={{
              maxWidth: '900px',
              margin: '0 auto',
              background: '#fff',
              borderRadius: '18px',
              padding: '40px 32px'
            }}>
              <div style={{
                textAlign: 'left',
                marginBottom: '32px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'left',
                  marginBottom: '12px'
                }}>
                  <svg width="32" height="32" fill="none" stroke="#00d4aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                  <h1 style={{
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    color: '#1e293b',
                    margin: '0 0 0 8px',
                    textAlign: 'left'
                  }}>
                    Launch Your Token
                  </h1>
                </div>
                <p style={{ color: '#64748b' }}>Create and deploy your token in minutes</p>
              </div>

              <form onSubmit={handleFormSubmit}>
                <div style={{ display: 'flex', gap: '40px' }}>
                  {/* Left Column */}
                  <div style={{ flex: 1 }}>
                    {/* Token Name and Ticker */}
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{
                          display: 'block',
                          fontSize: '1rem',
                          fontWeight: '600',
                          color: '#374151',
                          marginBottom: '0.5rem'
                        }}>
                          Token Name *
                        </label>
                        <input
                          type="text"
                          name="tokenName"
                          value={formData.tokenName}
                          onChange={handleInputChange}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '15px',
                            color: '#1e293b',
                            background: '#f8fafc',
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                            outline: 'none'
                          }}
                          placeholder="e.g., Ethereum"
                          required
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{
                          display: 'block',
                          fontSize: '1rem',
                          fontWeight: '600',
                          color: '#374151',
                          marginBottom: '0.5rem'
                        }}>
                          Ticker Symbol *
                        </label>
                        <input
                          type="text"
                          name="ticker"
                          value={formData.ticker}
                          onChange={handleInputChange}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '15px',
                            color: '#1e293b',
                            background: '#f8fafc',
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                            outline: 'none',
                            textTransform: 'uppercase'
                          }}
                          placeholder="e.g., ETH"
                          maxLength={10}
                          required
                        />
                      </div>
                    </div>

                    {/* Logo Upload */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '1rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.5rem'
                      }}>
                        Token Logo
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            position: 'relative',
                            border: '2px dashed #cbd5e1',
                            borderRadius: '10px',
                            padding: '24px',
                            textAlign: 'center',
                            cursor: 'pointer'
                          }}>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              style={{
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                opacity: 0,
                                cursor: 'pointer'
                              }}
                            />
                            <div>
                              <svg width="32" height="32" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="17 8 12 3 7 8"/>
                                <line x1="12" y1="3" x2="12" y2="15"/>
                              </svg>
                              <p style={{ color: '#64748b', fontSize: '14px', margin: '8px 0 0 0' }}>
                                Click to upload or drag and drop
                              </p>
                              <p style={{ color: '#94a3b8', fontSize: '12px', margin: '4px 0 0 0' }}>
                                PNG, JPG up to 10MB
                              </p>
                            </div>
                          </div>
                        </div>
                        {logoPreview && (
                          <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '10px',
                            border: '2px solid #e5e7eb',
                            overflow: 'hidden',
                            background: '#f1f5f9'
                          }}>
                            <img
                              src={logoPreview}
                              alt="Logo preview"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '1rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.5rem'
                      }}>
                        Description
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={4}
                        maxLength={500}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          border: '1.5px solid #cbd5e1',
                          borderRadius: '8px',
                          fontSize: '15px',
                          color: '#1e293b',
                          background: '#f8fafc',
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                          outline: 'none',
                          resize: 'vertical'
                        }}
                        placeholder="Describe your token's purpose, utility, and vision..."
                      />
                      <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>
                        {formData.description.length}/500 characters
                      </p>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div style={{ flex: 1 }}>
                    {/* Social Links */}
                    <div style={{
                      border: '0px solid #ffffff',
                      borderRadius: '12px',
                      padding: '24px',
                      background: '#ffffff'
                    }}>
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          fontSize: '1rem',
                          fontWeight: '600',
                          color: '#374151',
                          marginBottom: '0.5rem'
                        }}>
                          <svg width="16" height="16" fill="none" stroke="#1da1f2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53A4.48 4.48 0 0 0 22.4 1.64a9.09 9.09 0 0 1-2.88 1.1A4.48 4.48 0 0 0 16.11 0c-2.5 0-4.5 2.24-4.5 5 0 .39.04.76.12 1.12C7.69 5.95 4.07 4.13 1.64 1.16c-.43.74-.68 1.6-.68 2.52 0 1.74.87 3.28 2.19 4.18A4.48 4.48 0 0 1 .96 7.1v.06c0 2.43 1.72 4.45 4.01 4.91-.42.12-.86.18-1.32.18-.32 0-.63-.03-.93-.09.63 2.01 2.45 3.47 4.6 3.51A9.05 9.05 0 0 1 0 19.54a12.8 12.8 0 0 0 6.95 2.03c8.34 0 12.9-7.25 12.9-13.54 0-.21 0-.42-.02-.63A9.22 9.22 0 0 0 24 4.59a9.1 9.1 0 0 1-2.6.71z"/>
                          </svg>
                          <span style={{ marginLeft: '6px' }}>X (Twitter)</span>
                        </label>
                        <input
                          type="url"
                          name="xLink"
                          value={formData.xLink}
                          onChange={handleInputChange}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '15px',
                            color: '#1e293b',
                            background: '#f8fafc',
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                            outline: 'none'
                          }}
                          placeholder="https://x.com/yourtoken"
                        />
                      </div>
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          fontSize: '1rem',
                          fontWeight: '600',
                          color: '#374151',
                          marginBottom: '0.5rem'
                        }}>
                          <svg width="16" height="16" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="2" y1="12" x2="22" y2="12"/>
                            <path d="M12 2a15.3 15.3 0 0 1 0 20"/>
                            <path d="M12 2a15.3 15.3 0 0 0 0 20"/>
                          </svg>
                          <span style={{ marginLeft: '6px' }}>Website</span>
                        </label>
                        <input
                          type="url"
                          name="website"
                          value={formData.website}
                          onChange={handleInputChange}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '15px',
                            color: '#1e293b',
                            background: '#f8fafc',
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                            outline: 'none'
                          }}
                          placeholder="https://yourtoken.com"
                        />
                      </div>
                      <div>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          fontSize: '1rem',
                          fontWeight: '600',
                          color: '#374151',
                          marginBottom: '0.5rem'
                        }}>
                          <svg width="16" height="16" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <path d="M21 11.5a8.38 8.38 0 0 1-1.9 5.4A8.5 8.5 0 0 1 3.4 17.5L2 22l4.5-1.4A8.38 8.38 0 0 0 12 20.5a8.5 8.5 0 1 0-8.5-8.5"/>
                          </svg>
                          <span style={{ marginLeft: '6px' }}>Telegram</span>
                        </label>
                        <input
                          type="url"
                          name="telegram"
                          value={formData.telegram}
                          onChange={handleInputChange}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '15px',
                            color: '#1e293b',
                            background: '#f8fafc',
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                            outline: 'none'
                          }}
                          placeholder="https://t.me/yourtoken"
                        />
                      </div>
                    </div>

                    {/* Verify Token Checkbox */}
                    <div style={{ margin: '24px', borderTop: '1px solid #e5e7eb', paddingTop: '24px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '1rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.5rem'
                      }}>
                        Verify token?
                      </label>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'nowrap'
                      }}>
                        <button
                          type="button"
                          onClick={() => handleVerifySelection('yes')}
                          style={{
                            border: `1.5px solid ${formData.verify === 'yes' ? '#00d4aa' : '#d1d5db'}`,
                            background: formData.verify === 'yes' ? '#00d4aa' : '#fff',
                            color: formData.verify === 'yes' ? '#fff' : '#111827',
                            borderRadius: '6px',
                            padding: '6px 18px',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.18s',
                            outline: 'none'
                          }}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVerifySelection('no')}
                          style={{
                            border: `1.5px solid ${formData.verify === 'no' ? '#d1d5db' : '#d1d5db'}`,
                            background: formData.verify === 'no' ? '#e5e7eb' : '#fff',
                            color: formData.verify === 'no' ? '#374151' : '#111827',
                            borderRadius: '6px',
                            padding: '6px 18px',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.18s',
                            outline: 'none'
                          }}
                        >
                          No
                        </button>
                        <span
                          onClick={() => setVerifyDropdownOpen(!verifyDropdownOpen)}
                          style={{
                            transition: 'transform 0.2s',
                            color: '#00d4aa',
                            cursor: 'pointer'
                          }}
                        >
                          <svg
                            width="18"
                            height="18"
                            fill="none"
                            stroke="#00d4aa"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            viewBox="0 0 24 24"
                            style={{
                              transform: verifyDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s'
                            }}
                          >
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </span>
                      </div>
                      {verifyDropdownOpen && (
                        <div style={{
                          background: '#fff',
                          border: '1.5px solid #00d4aa',
                          borderRadius: '8px',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                          padding: '16px 18px',
                          marginTop: '10px',
                          fontSize: '0.97rem',
                          color: '#222',
                          position: 'relative',
                          zIndex: 10
                        }}>
                          <div style={{
                            fontWeight: '700',
                            color: '#00d4aa',
                            marginBottom: '8px',
                            fontSize: '1.08em'
                          }}>
                            20 APT to Verify
                          </div>
                          <ul style={{
                            margin: 0,
                            paddingLeft: '18px',
                            color: '#333',
                            fontSize: '0.98em'
                          }}>
                            <li style={{ marginBottom: '4px' }}>Demonstrate your commitment to buyers</li>
                            <li style={{ marginBottom: '4px' }}>Receive a verified badge on your token</li>
                            <li style={{ marginBottom: '4px' }}>Eligible for homepage & marketplace promotion</li>
                            <li style={{ marginBottom: '4px' }}>Get 25 APT refunded upon graduation</li>
                            <li style={{ marginBottom: '4px' }}>Unlock additional trust & visibility features</li>
                          </ul>
                          <div style={{ marginTop: '12px', textAlign: 'center' }}>
                            <a href="#" style={{ color: '#6b7280', textDecoration: 'underline', fontSize: '12px' }}>
                              Learn more
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div style={{ paddingTop: '24px' }}>
                  <button
                    type="submit"
                    style={{
                      width: '100%',
                      background: '#00d4aa',
                      color: '#fff',
                      fontWeight: '600',
                      fontSize: '17px',
                      padding: '14px 0',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                  >
                    Launch Token
                  </button>
                </div>

                {/* Disclaimer */}
                <div style={{ textAlign: 'center', paddingTop: '16px' }}>
                  <p style={{ color: '#94a3b8', fontSize: '12px' }}>
                    By launching a token, you agree to our Terms of Service and acknowledge that you understand the risks associated with cryptocurrency.
                  </p>
                </div>
              </form>

              {/* Info Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '20px',
                marginTop: '32px'
              }}>
                <div style={{
                  background: '#fff',
                  borderRadius: '12px',
                  padding: '24px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}>
                  <h3 style={{
                    fontWeight: '600',
                    color: '#1e293b',
                    marginBottom: '8px'
                  }}>
                    Instant Deployment
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '14px' }}>
                    Your token will be deployed to the blockchain within minutes of submission.
                  </p>
                </div>
                <div style={{
                  background: '#fff',
                  borderRadius: '12px',
                  padding: '24px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}>
                  <h3 style={{
                    fontWeight: '600',
                    color: '#1e293b',
                    marginBottom: '8px'
                  }}>
                    Low Fees
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '14px' }}>
                    Competitive launch fees with transparent pricing and no hidden costs.
                  </p>
                </div>
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