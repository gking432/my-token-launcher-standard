#!/bin/bash

# Buy 10,000 tokens via CLI
# Usage: ./buy-tokens-cli.sh <PRIVATE_KEY>

if [ -z "$1" ]; then
    echo "Usage: ./buy-tokens-cli.sh <PRIVATE_KEY>"
    echo "Example: ./buy-tokens-cli.sh 0x1234..."
    exit 1
fi

PRIVATE_KEY=$1
BUYER_ADDRESS="0x0b48dab8685a30b756235e6df2284b6f572c9a60480cff0072bd7811b1ee9021"
CREATOR_ADDRESS="0x0b48dab8685a30b756235e6df2284b6f572c9a60480cff0072bd7811b1ee9021"
MODULE_ADDRESS="0x8c699e8fa969a555f46629c345d6c10d9512a3398a4353e7af4c2bcf95b9c96d"
TICKER_HEX="2474657374"  # "$test" in hex
TOKEN_AMOUNT=10000
SLIPPAGE_BPS=500

echo "Buying $TOKEN_AMOUNT tokens..."
echo "Buyer: $BUYER_ADDRESS"
echo "Creator: $CREATOR_ADDRESS"
echo "Ticker: \$test (hex: $TICKER_HEX)"
echo ""

# Create a temporary profile
aptos init --profile temp-buy --network testnet --private-key "$PRIVATE_KEY" --assume-yes > /dev/null 2>&1

# Execute the transaction
aptos move run \
  --function-id ${MODULE_ADDRESS}::token_launcher::buy_tokens \
  --args address:${CREATOR_ADDRESS} \
  --args hex:${TICKER_HEX} \
  --args u64:${TOKEN_AMOUNT} \
  --args u64:${SLIPPAGE_BPS} \
  --profile temp-buy \
  --assume-yes

# Clean up
aptos config delete-profile --profile temp-buy --assume-yes > /dev/null 2>&1

