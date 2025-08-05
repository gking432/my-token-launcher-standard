import React, { useState } from 'react';

interface TokenData {
  name: string;
  symbol: string;
  price: string;
  balance?: string;
}

interface GlobalContentRightProps {
  tokenData?: TokenData;
  tradingMode?: 'buy' | 'sell' | 'swap';
  balance?: string;
  onTrade?: (amount: string, mode: 'buy' | 'sell') => void;
  showSlippage?: boolean;
}

const GlobalContentRight: React.FC<GlobalContentRightProps> = ({ 
  tokenData,
  tradingMode = 'buy',
  balance = '0.005',
  onTrade,
  showSlippage = true
}) => {
  const [amount, setAmount] = useState('0.001');
  const [total, setTotal] = useState('108.18');
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [slippage, setSlippage] = useState('1.0');
  const [isSlippageExpanded, setIsSlippageExpanded] = useState(false);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value);
    // Calculate total based on amount (simplified calculation)
    const calculatedTotal = (parseFloat(value) * 108180).toFixed(2);
    setTotal(calculatedTotal);
  };

  const handleTotalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTotal(value);
    // Calculate amount based on total (simplified calculation)
    const calculatedAmount = (parseFloat(value) / 108180).toFixed(6);
    setAmount(calculatedAmount);
  };

  const handleTrade = () => {
    onTrade?.(amount, activeTab);
  };

  const handleSlippageChange = (value: string) => {
    setSlippage(value);
  };

  return (
    <>
      <style>
        {`
          .content-right {
            width: 350px;
            min-width: 350px;
            background: #ffffff;
            border-left: 1px solid #d3d3d3;
            padding: 20px;
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .trade-panel {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            border: 1px solid #e6e8ea;
            flex: 1;
            overflow-y: auto;
            min-height: 0;
          }

          .token-balance-header {
            margin-bottom: 20px;
          }

          .token-balance-header h3 {
            font-size: 16px;
            font-weight: 600;
            color: #0a0b0d;
            margin-bottom: 8px;
          }

          .balance-amount {
            font-size: 24px;
            font-weight: 700;
            color: #00d4aa;
          }

          .tabs {
            display: flex;
            background: #e9ecef;
            border-radius: 8px;
            padding: 4px;
            margin-bottom: 20px;
            list-style: none;
          }

          .tabs li {
            flex: 1;
            text-align: center;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
            transition: all 0.2s;
          }

          .tabs li.active {
            background: #00d4aa;
            color: white;
          }

          .tabs li:not(.active) {
            color: #6c757d;
          }

          .tabs li:not(.active):hover {
            color: #0a0b0d;
          }

          .form-group {
            margin-bottom: 16px;
          }

          .form-group label {
            display: block;
            font-size: 14px;
            font-weight: 600;
            color: #0a0b0d;
            margin-bottom: 8px;
          }

          .trade-input {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid #e6e8ea;
            border-radius: 8px;
            font-size: 16px;
            background: white;
            transition: border-color 0.2s;
          }

          .trade-input:focus {
            outline: none;
            border-color: #00d4aa;
            box-shadow: 0 0 0 2px rgba(0, 212, 170, 0.1);
          }

          .slippage-section {
            margin-bottom: 20px;
          }

          .slippage-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            cursor: pointer;
            border-bottom: 1px solid #e6e8ea;
          }

          .slippage-title {
            font-size: 14px;
            font-weight: 600;
            color: #0a0b0d;
          }

          .slippage-toggle {
            font-size: 12px;
            color: #6c757d;
            transition: transform 0.2s;
          }

          .slippage-header.expanded .slippage-toggle {
            transform: rotate(180deg);
          }

          .slippage-content {
            padding-top: 16px;
            display: none;
          }

          .slippage-header.expanded + .slippage-content {
            display: block;
          }

          .slippage-options {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
          }

          .slippage-btn {
            flex: 1;
            padding: 6px 12px;
            border: 1px solid #e6e8ea;
            border-radius: 6px;
            background: white;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .slippage-btn:hover {
            border-color: #00d4aa;
          }

          .slippage-btn.active {
            background: #00d4aa;
            color: white;
            border-color: #00d4aa;
          }

          .slippage-custom {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
          }

          .slippage-custom input {
            flex: 1;
            padding: 6px 12px;
            border: 1px solid #e6e8ea;
            border-radius: 6px;
            font-size: 12px;
          }

          .slippage-custom span {
            font-size: 12px;
            color: #6c757d;
          }

          .slippage-warning {
            font-size: 11px;
            color: #ff4757;
            background: #fff5f5;
            padding: 8px 12px;
            border-radius: 6px;
            border: 1px solid #ffebee;
          }

          .btn-buy {
            width: 100%;
            padding: 14px 24px;
            background: #00d4aa;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
          }

          .btn-buy:hover {
            background: #00b894;
          }

          @media (max-width: 768px) {
            .content-right {
              width: 100%;
              min-width: 100%;
              border-left: none;
              border-top: 1px solid #d3d3d3;
            }
          }
        `}
      </style>

      <div className="content-right">
        <div className="trade-panel">
          <div className="token-balance-header">
            <h3>Your Balance</h3>
            <div className="balance-amount">{balance}</div>
          </div>
          
          <ul className="tabs">
            <li 
              className={activeTab === 'buy' ? 'active' : ''}
              onClick={() => setActiveTab('buy')}
            >
              Buy
            </li>
            <li 
              className={activeTab === 'sell' ? 'active' : ''}
              onClick={() => setActiveTab('sell')}
            >
              Sell
            </li>
          </ul>
          
          <div className="form-group">
            <label>Amount</label>
            <input 
              type="text" 
              value={amount} 
              className="trade-input"
              onChange={handleAmountChange}
            />
          </div>
          
          <div className="form-group">
            <label>Total (APT)</label>
            <input 
              type="text" 
              value={total} 
              className="trade-input"
              onChange={handleTotalChange}
            />
          </div>
          
          {showSlippage && (
            <div className="slippage-section">
              <div 
                className={`slippage-header ${isSlippageExpanded ? 'expanded' : ''}`}
                onClick={() => setIsSlippageExpanded(!isSlippageExpanded)}
              >
                <span className="slippage-title">Slippage Protection</span>
                <span className="slippage-toggle">▼</span>
              </div>
              <div className="slippage-content">
                <div className="slippage-options">
                  <button 
                    className={`slippage-btn ${slippage === '0.5' ? 'active' : ''}`}
                    onClick={() => handleSlippageChange('0.5')}
                  >
                    0.5%
                  </button>
                  <button 
                    className={`slippage-btn ${slippage === '1.0' ? 'active' : ''}`}
                    onClick={() => handleSlippageChange('1.0')}
                  >
                    1.0%
                  </button>
                  <button 
                    className={`slippage-btn ${slippage === '2.0' ? 'active' : ''}`}
                    onClick={() => handleSlippageChange('2.0')}
                  >
                    2.0%
                  </button>
                  <button 
                    className={`slippage-btn ${slippage === '5.0' ? 'active' : ''}`}
                    onClick={() => handleSlippageChange('5.0')}
                  >
                    5.0%
                  </button>
                </div>
                <div className="slippage-custom">
                  <input 
                    type="number" 
                    placeholder="Custom" 
                    min="0.1" 
                    max="50" 
                    step="0.1"
                    value={slippage}
                    onChange={(e) => handleSlippageChange(e.target.value)}
                  />
                  <span>%</span>
                </div>
                <div className="slippage-warning">
                  ⚠️ High slippage may result in unfavorable trade execution
                </div>
              </div>
            </div>
          )}
          
          <button 
            className="btn-buy"
            onClick={handleTrade}
          >
            {activeTab === 'buy' ? 'Buy' : 'Sell'}
          </button>
        </div>
      </div>
    </>
  );
};

export default GlobalContentRight; 