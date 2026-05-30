import React, { useState } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { InputTransactionData } from "@aptos-labs/wallet-adapter-core";
import { useNavigate } from "react-router-dom";
import { Buffer } from "buffer";
import { MODULE_ADDRESS } from "../config";
import PreLaunchModal from './PreLaunchModal';
import AppHeader from './AppHeader';
import SiteFooter from './SiteFooter';
import { useToast } from '../contexts/ToastContext';
import { setLocalImage, MAX_IMAGE_BYTES } from '../lib/localImages';
import { setLocalSocials } from '../lib/localSocials';
import { clearTokenCache } from '../utils/aptosIndexer';

window.Buffer = window.Buffer || Buffer;

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

const tokenLauncherAddress = MODULE_ADDRESS;

function stringToBytes(str: string): number[] {
  return Array.from(new TextEncoder().encode(str));
}

const config = new AptosConfig({
  network: Network.TESTNET,
  fullnode: "https://fullnode.testnet.aptoslabs.com/v1",
});
const client = new Aptos(config);

const DEFAULT_SLIPPAGE_BPS = 500;

const Launch: React.FC = () => {
  const { account, signAndSubmitTransaction } = useWallet();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [showPreLaunchModal, setShowPreLaunchModal] = useState(false);
  const [pendingLaunchData, setPendingLaunchData] = useState<{
    name: string;
    symbol: string;
    description: string;
    twitterLink: string | null;
    websiteLink: string | null;
    telegram: string | null;
  } | null>(null);

  const [formData, setFormData] = useState({
    tokenName: '',
    ticker: '',
    description: '',
    xLink: '',
    website: '',
    telegram: '',
  });

  const trimmedName = formData.tokenName.trim();
  const trimmedTicker = formData.ticker.trim().replace(/^\$/, '');
  const nameValid = trimmedName.length >= 2 && trimmedName.length <= 32;
  const tickerValid = /^[A-Z0-9]{2,10}$/.test(trimmedTicker);
  const formValid = nameValid && tickerValid;
  const nameHint = trimmedName.length === 0
    ? null
    : trimmedName.length < 2
      ? 'Name must be at least 2 characters.'
      : null;
  const tickerHint = trimmedTicker.length === 0
    ? null
    : trimmedTicker.length < 2
      ? 'Ticker must be at least 2 characters.'
      : !/^[A-Z0-9]+$/.test(trimmedTicker)
        ? 'Ticker must be uppercase letters and digits only.'
        : null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Unsupported file', 'Please upload a PNG, JPG, or GIF image.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Image too large', `Logos must be under ${Math.round(MAX_IMAGE_BYTES / 1024)}KB. Yours is ${Math.round(file.size / 1024)}KB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!account) {
      toast.warning('Connect a wallet first', 'You need a connected wallet to launch a token.');
      return;
    }
    const symbol = formData.ticker.startsWith('$') ? formData.ticker : `$${formData.ticker}`;
    setPendingLaunchData({
      name: formData.tokenName,
      symbol,
      description: formData.description.trim(),
      twitterLink: formData.xLink.trim() || null,
      websiteLink: formData.website.trim() || null,
      telegram: formData.telegram.trim() || null,
    });
    setShowPreLaunchModal(true);
  };

  const uploadImage = async (dataUrl: string): Promise<string> => {
    try {
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx === -1) return '';
      const header = dataUrl.slice(0, commaIdx);
      const data = dataUrl.slice(commaIdx + 1);
      const contentType = header.match(/data:([^;]+)/)?.[1] || 'image/png';
      const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: `logo.${ext}`, contentType, data }),
      });
      if (!res.ok) return '';
      const json = await res.json();
      return json.url || '';
    } catch {
      return '';
    }
  };

  const handleLaunchToken = async (initialPurchaseAmount: string) => {
    if (!pendingLaunchData || !account) return;
    setLoading(true);
    const walletString = String(account.address);

    try {
      const supply = 1_000_000_000;
      const symbolBytes = stringToBytes(pendingLaunchData.symbol);

      let iconUrl = '';
      if (logoPreview) {
        iconUrl = await uploadImage(logoPreview);
      }

      const createTransaction: InputTransactionData = {
        data: {
          function: `${tokenLauncherAddress}::token_launcher::create_token`,
          typeArguments: [],
          functionArguments: [
            stringToBytes(pendingLaunchData.name),
            symbolBytes,
            stringToBytes(iconUrl),
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
      await client.waitForTransaction({ transactionHash: createHash });
      clearTokenCache();

      const users = JSON.parse(localStorage.getItem("users") || "{}");
      if (!users[walletString]) users[walletString] = { launchedTokens: [] };
      if (!Array.isArray(users[walletString].launchedTokens)) users[walletString].launchedTokens = [];
      users[walletString].launchedTokens.push({
        name: pendingLaunchData.name,
        symbol: pendingLaunchData.symbol,
        supply,
        txHash: createHash,
        image: logoPreview,
        launchDate: new Date().toISOString(),
        creator: walletString,
        description: pendingLaunchData.description,
        twitterLink: pendingLaunchData.twitterLink,
        websiteLink: pendingLaunchData.websiteLink,
        telegram: pendingLaunchData.telegram,
      });
      localStorage.setItem("users", JSON.stringify(users));

      let metadataAddress = '';
      const creatorAddress = walletString;
      for (let attempt = 1; attempt <= 10; attempt++) {
        try {
          const moduleState = await client.getAccountResource({
            accountAddress: tokenLauncherAddress,
            resourceType: `${tokenLauncherAddress}::token_launcher::ModuleState`,
          });
          if (!moduleState.token_metadata?.handle) throw new Error("ModuleState lacks token_metadata.handle");

          const tokenMetadata = await client.getTableItem<TokenMetadata>({
            handle: moduleState.token_metadata.handle,
            data: {
              key: creatorAddress,
              key_type: "address",
              value_type: `${tokenLauncherAddress}::token_launcher::TokenMetadata`,
            },
          });
          const tokenInfo = tokenMetadata.entries.find((t: TokenMetadataEntry) => {
            const tickerHex = Array.isArray(t.ticker) ? Buffer.from(t.ticker).toString("hex") : t.ticker;
            const symbolHex = Buffer.from(symbolBytes).toString("hex");
            const clean = tickerHex.startsWith("0x") ? tickerHex.slice(2) : tickerHex;
            return clean === symbolHex;
          });
          if (tokenInfo) {
            metadataAddress = tokenInfo.metadata_addr;
            break;
          }
        } catch (err) {
          console.error(`Attempt ${attempt} - Metadata fetch error:`, err);
        }
        if (attempt < 10) await new Promise(r => setTimeout(r, 2000));
      }

      if (!metadataAddress) {
        const tickerHex = Buffer.from(symbolBytes).toString("hex");
        metadataAddress = `${creatorAddress}::${tickerHex}`;
      }

      if (logoPreview && metadataAddress) {
        setLocalImage(metadataAddress, logoPreview);
      }

      if (metadataAddress) {
        setLocalSocials(metadataAddress, {
          description: pendingLaunchData.description,
          twitterLink: pendingLaunchData.twitterLink,
          websiteLink: pendingLaunchData.websiteLink,
          telegram: pendingLaunchData.telegram,
        });
      }

      if (initialPurchaseAmount && parseFloat(initialPurchaseAmount) > 0) {
        const aptAmountInOctas = Math.floor(parseFloat(initialPurchaseAmount) * 1e8);
        const buyTransaction: InputTransactionData = {
          data: {
            function: `${tokenLauncherAddress}::token_launcher::buy_tokens`,
            functionArguments: [creatorAddress, symbolBytes, aptAmountInOctas, DEFAULT_SLIPPAGE_BPS],
          },
        };
        const buyResponse = await signAndSubmitTransaction(buyTransaction);
        await client.waitForTransaction({ transactionHash: buyResponse.hash });
      }

      toast.success(`${pendingLaunchData.symbol} is live`, 'Your token has been launched on Aptos testnet.', {
        label: 'View launch tx',
        href: `https://explorer.aptoslabs.com/txn/${createHash}?network=testnet`,
      });

      navigate(`/newtoken/${createHash}`, {
        state: {
          name: pendingLaunchData.name,
          symbol: pendingLaunchData.symbol,
          supply,
          txHash: createHash,
          description: pendingLaunchData.description,
          twitterLink: pendingLaunchData.twitterLink,
          websiteLink: pendingLaunchData.websiteLink,
          telegram: pendingLaunchData.telegram,
          metadataAddress,
          initialPurchase: initialPurchaseAmount ? parseFloat(initialPurchaseAmount) : 0,
          creatorAddress,
          creationDate: new Date().getTime(),
        },
      });
    } catch (error) {
      console.error("Error launching token:", error);
      toast.error('Launch failed', error instanceof Error ? error.message : 'Unknown error. Check the console for details.');
    } finally {
      setLoading(false);
      setShowPreLaunchModal(false);
      setPendingLaunchData(null);
    }
  };

  return (
    <>
      <style>{`
        .lp-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
        }
        .lp-wrap {
          flex: 1;
          max-width: 1280px;
          margin: 0 auto;
          padding: 40px 24px 64px;
        }
        .lp-hero {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 24px; margin-bottom: 28px;
        }
        .lp-hero-title {
          font-size: 36px; font-weight: 700; letter-spacing: -0.025em;
          color: var(--text-primary); margin: 0 0 6px;
        }
        .lp-hero-sub {
          font-size: 15px; color: var(--text-secondary); margin: 0;
        }
        .lp-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
          gap: 20px;
        }
        .lp-card {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 28px;
        }
        .lp-card + .lp-card { margin-top: 20px; }
        .lp-card-title {
          font-size: 13px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.08em;
          margin: 0 0 18px;
        }
        .lp-row { display: flex; gap: 16px; }
        .lp-row > div { flex: 1; min-width: 0; }
        .lp-field { margin-bottom: 18px; }
        .lp-field:last-child { margin-bottom: 0; }
        .lp-label {
          display: block; font-size: 13px; font-weight: 600;
          color: var(--text-primary); margin-bottom: 8px;
        }
        .lp-label-hint {
          font-size: 12px; font-weight: 500; color: var(--text-muted); margin-left: 6px;
        }
        .lp-input, .lp-textarea {
          width: 100%; padding: 12px 14px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--text-primary);
          font-size: 14.5px; font-family: inherit;
          outline: none; box-sizing: border-box;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .lp-input:focus, .lp-textarea:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-light);
          background: var(--bg-primary);
        }
        .lp-input::placeholder, .lp-textarea::placeholder { color: var(--text-muted); }
        .lp-textarea { resize: vertical; min-height: 110px; line-height: 1.5; }
        .lp-input-prefix {
          position: relative;
        }
        .lp-input-prefix .lp-input { padding-left: 28px; }
        .lp-prefix-sym {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          font-size: 14.5px; color: var(--text-muted); font-weight: 600; pointer-events: none;
        }
        .lp-counter {
          font-size: 12px; color: var(--text-muted);
          margin-top: 6px; text-align: right;
        }
        .lp-field-hint {
          font-size: 12px; color: var(--negative);
          margin-top: 6px; font-weight: 500;
        }
        .lp-input.invalid { border-color: var(--negative); }
        .lp-input.invalid:focus {
          border-color: var(--negative);
          box-shadow: 0 0 0 3px rgba(215,0,21,0.12);
        }
        .lp-logo-area {
          display: flex; gap: 16px; align-items: stretch;
        }
        .lp-logo-drop {
          flex: 1; position: relative;
          border: 1.5px dashed var(--border-secondary);
          border-radius: 12px; padding: 22px 16px;
          text-align: center; cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          background: var(--bg-secondary);
        }
        .lp-logo-drop:hover {
          border-color: var(--accent); background: var(--accent-light);
        }
        .lp-logo-drop input[type=file] {
          position: absolute; inset: 0; width: 100%; height: 100%;
          opacity: 0; cursor: pointer;
        }
        .lp-logo-drop-icon {
          font-size: 22px; color: var(--text-muted); margin-bottom: 6px;
        }
        .lp-logo-drop-main {
          font-size: 13.5px; color: var(--text-primary); font-weight: 500;
        }
        .lp-logo-drop-hint {
          font-size: 12px; color: var(--text-muted); margin-top: 2px;
        }
        .lp-logo-preview {
          width: 100px; height: 100px;
          border-radius: 14px; overflow: hidden;
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          flex-shrink: 0;
        }
        .lp-logo-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .lp-info-note {
          font-size: 12px; color: var(--text-muted);
          background: var(--bg-tertiary);
          border-radius: 10px; padding: 10px 12px;
          margin-top: 14px; line-height: 1.5;
        }
        .lp-spec-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
        }
        .lp-spec {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px 14px;
        }
        .lp-spec-label {
          font-size: 11.5px; font-weight: 600; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;
        }
        .lp-spec-value {
          font-size: 15px; font-weight: 600; color: var(--text-primary);
          font-variant-numeric: tabular-nums;
        }
        .lp-submit {
          width: 100%; padding: 14px 0;
          background: var(--accent); color: #fff;
          border: none; border-radius: 12px;
          font-size: 15.5px; font-weight: 600; font-family: inherit;
          cursor: pointer;
          box-shadow: 0 2px 12px rgba(51,151,46,0.3);
          transition: background 0.15s, transform 0.05s;
        }
        .lp-submit:hover:not(:disabled) { background: var(--accent-hover); }
        .lp-submit:active:not(:disabled) { transform: scale(0.995); }
        .lp-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .lp-disclaimer {
          font-size: 12px; color: var(--text-muted);
          text-align: center; margin-top: 14px; line-height: 1.5;
        }
        .lp-fee-note {
          text-align: center; font-size: 13px;
          color: var(--text-secondary); margin-bottom: 14px;
          padding: 9px 14px; border-radius: 10px;
          background: var(--bg-secondary); border: 1px solid var(--border);
        }
        .lp-fee-note strong { color: var(--text-primary); font-weight: 700; }
        .lp-connect-prompt {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 60px 40px;
          text-align: center;
          max-width: 480px;
          margin: 80px auto;
        }
        .lp-connect-prompt h2 {
          font-size: 26px; font-weight: 700; letter-spacing: -0.02em;
          color: var(--text-primary); margin: 0 0 8px;
        }
        .lp-connect-prompt p {
          font-size: 14.5px; color: var(--text-secondary); margin: 0;
        }
        @media (max-width: 900px) {
          .lp-grid { grid-template-columns: 1fr; }
          .lp-hero { flex-direction: column; align-items: flex-start; }
        }
        @media (max-width: 600px) {
          .lp-wrap { padding: 28px 16px 64px; }
          .lp-hero-title { font-size: 28px; }
          .lp-card { padding: 20px; border-radius: 14px; }
          .lp-row { flex-direction: column; gap: 18px; }
          .lp-spec-grid { grid-template-columns: 1fr 1fr; }
          .lp-logo-area { flex-direction: column-reverse; gap: 12px; }
          .lp-logo-preview { width: 100%; height: 120px; }
        }
      `}</style>

      <div className="lp-page">
        <AppHeader hideBoostBar />
        <div className="lp-wrap">
          <div className="lp-hero">
            <div>
              <h1 className="lp-hero-title">Launch a token</h1>
              <p className="lp-hero-sub">Create and deploy your token on Aptos in minutes.</p>
            </div>
          </div>

          {!account ? (
            <div className="lp-connect-prompt">
              <h2>Connect your wallet</h2>
              <p>You need a connected wallet to launch a token. Use the Connect Wallet button in the header.</p>
            </div>
          ) : (
            <form onSubmit={handleFormSubmit}>
              <div className="lp-grid">
                {/* ── LEFT: Basics ── */}
                <div>
                  <div className="lp-card">
                    <div className="lp-card-title">Token basics</div>

                    <div className="lp-row" style={{ marginBottom: 18 }}>
                      <div className="lp-field" style={{ marginBottom: 0 }}>
                        <label className="lp-label">
                          Name <span className="lp-label-hint">2–32 chars</span>
                        </label>
                        <input
                          className={`lp-input${nameHint ? ' invalid' : ''}`}
                          type="text"
                          name="tokenName"
                          value={formData.tokenName}
                          onChange={handleInputChange}
                          placeholder="e.g. Movement"
                          required
                          maxLength={32}
                        />
                        {nameHint && <div className="lp-field-hint">{nameHint}</div>}
                      </div>
                      <div className="lp-field" style={{ marginBottom: 0 }}>
                        <label className="lp-label">
                          Ticker <span className="lp-label-hint">A–Z, 0–9 · 2–10</span>
                        </label>
                        <div className="lp-input-prefix">
                          <span className="lp-prefix-sym">$</span>
                          <input
                            className={`lp-input${tickerHint ? ' invalid' : ''}`}
                            type="text"
                            name="ticker"
                            value={formData.ticker.replace(/^\$/, '')}
                            onChange={e => setFormData(p => ({ ...p, ticker: e.target.value.replace(/^\$/, '').toUpperCase() }))}
                            placeholder="MOVE"
                            maxLength={10}
                            required
                            style={{ textTransform: 'uppercase' }}
                          />
                        </div>
                        {tickerHint && <div className="lp-field-hint">{tickerHint}</div>}
                      </div>
                    </div>

                    <div className="lp-field">
                      <label className="lp-label">Logo</label>
                      <div className="lp-logo-area">
                        <div className="lp-logo-drop">
                          <input type="file" accept="image/*" onChange={handleLogoUpload} />
                          <div className="lp-logo-drop-icon">⬆</div>
                          <div className="lp-logo-drop-main">Click or drop to upload</div>
                          <div className="lp-logo-drop-hint">PNG, JPG, GIF · up to 10MB</div>
                        </div>
                        {logoPreview && (
                          <div className="lp-logo-preview">
                            <img src={logoPreview} alt="Logo preview" />
                          </div>
                        )}
                      </div>
                      <div className="lp-info-note">
                        Logo is stored locally for now. On-chain image storage is coming with the next contract upgrade. PNG, JPG, GIF · up to 256KB.
                      </div>
                    </div>

                    <div className="lp-field">
                      <label className="lp-label">Description</label>
                      <textarea
                        className="lp-textarea"
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        maxLength={500}
                        placeholder="What is this token? What's the vision?"
                      />
                      <div className="lp-counter">{formData.description.length} / 500</div>
                    </div>
                  </div>

                  <div className="lp-card">
                    <div className="lp-card-title">Token specs</div>
                    <div className="lp-spec-grid">
                      <div className="lp-spec">
                        <div className="lp-spec-label">Total supply</div>
                        <div className="lp-spec-value">1,000,000,000</div>
                      </div>
                      <div className="lp-spec">
                        <div className="lp-spec-label">Decimals</div>
                        <div className="lp-spec-value">6</div>
                      </div>
                      <div className="lp-spec">
                        <div className="lp-spec-label">Curve</div>
                        <div className="lp-spec-value">Bonding</div>
                      </div>
                      <div className="lp-spec">
                        <div className="lp-spec-label">Available on curve</div>
                        <div className="lp-spec-value">800,000,000</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT: Social + Submit ── */}
                <div>
                  <div className="lp-card">
                    <div className="lp-card-title">Social links</div>

                    <div className="lp-field">
                      <label className="lp-label">X (Twitter)</label>
                      <input
                        className="lp-input"
                        type="url"
                        name="xLink"
                        value={formData.xLink}
                        onChange={handleInputChange}
                        placeholder="https://x.com/yourtoken"
                      />
                    </div>
                    <div className="lp-field">
                      <label className="lp-label">Website</label>
                      <input
                        className="lp-input"
                        type="url"
                        name="website"
                        value={formData.website}
                        onChange={handleInputChange}
                        placeholder="https://yourtoken.com"
                      />
                    </div>
                    <div className="lp-field">
                      <label className="lp-label">Telegram</label>
                      <input
                        className="lp-input"
                        type="url"
                        name="telegram"
                        value={formData.telegram}
                        onChange={handleInputChange}
                        placeholder="https://t.me/yourtoken"
                      />
                    </div>
                  </div>

                  <div className="lp-card">
                    <div className="lp-card-title">Launch</div>
                    <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 18 }}>
                      A small APT launch fee is charged on creation. You'll have the option to make an initial purchase to seed price discovery on the next screen.
                    </div>
                    <div className="lp-fee-note">
                      Launch fee: <strong>0.2 APT</strong>
                    </div>
                    <button type="submit" className="lp-submit" disabled={loading || !formValid}>
                      {loading ? 'Launching…' : 'Continue to launch'}
                    </button>
                    <div className="lp-disclaimer">
                      By launching, you agree to our Terms and acknowledge the risks of cryptocurrency.
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
        <SiteFooter />
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
    </>
  );
};

export default Launch;
