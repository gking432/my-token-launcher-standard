// Helper function for bonding curve calculation
function calculateBondingCurvePrice(tokensSold) {
  const PRICE_NUMERATOR = 19029514756; // 19,029,514,756
  const PRICE_CONSTANT = 61.9053276; // 61.9053276 Octas
  const MAX_TOKENS = 800000000; // 800,000,000 total supply
  
  const denominator = MAX_TOKENS - tokensSold;
  
  if (denominator <= 0) {
    throw new Error('All tokens have been sold');
  }
  
  // Calculate hyperbolic term: numerator / denominator (floating point division)
  const hyperbolicTerm = PRICE_NUMERATOR / denominator;
  
  // Add constant term (61.9053276 Octas)
  const constantTerm = PRICE_CONSTANT;
  
  // Total price in Octas (smallest APT unit)
  const priceInOctas = hyperbolicTerm + constantTerm;
  
  // Convert to APT (divide by 10^8)
  return priceInOctas / 100_000_000;
}
