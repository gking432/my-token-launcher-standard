// Single source of truth for the bonding curve. Mirrors token_launcher.move's
// calculate_price exactly. All client-side price math goes through this file.

export const BONDING_CURVE = {
  PRICE_NUMERATOR: 19_029_514_756,
  PRICE_CONSTANT: 61.9053276,
  MAX_TOKENS: 800_000_000, // whole tokens available on the curve
  TOTAL_SUPPLY: 1_000_000_000,
};

// Returns price in APT per whole token at a given tokens_sold value (whole tokens)
export function priceAtAPT(tokensSold: number): number {
  const denom = BONDING_CURVE.MAX_TOKENS - tokensSold;
  if (denom <= 0) return 0;
  return (BONDING_CURVE.PRICE_NUMERATOR / denom + BONDING_CURVE.PRICE_CONSTANT) / 1e8;
}

// Approximate APT cost (or proceeds) for trading `amount` whole tokens around `tokensSoldAfter`.
// Uses trapezoidal average of the curve endpoints — matches contract's average_price formula.
export function tradeValueAPT(amount: number, tokensSoldBefore: number, tokensSoldAfter: number): number {
  const p0 = priceAtAPT(tokensSoldBefore);
  const p1 = priceAtAPT(tokensSoldAfter);
  return ((p0 + p1) / 2) * amount;
}
