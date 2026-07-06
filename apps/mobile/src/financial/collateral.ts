/**
 * Eligible collateral for Credit mode — the allowlist that makes "borrow against
 * your crypto" safe.
 *
 * You can ONLY borrow against blue-chips the lending protocol lists as reserves:
 * deep liquidity + a real price oracle (Pyth). This is what structurally blocks
 * the "mint a token, pump it, borrow against fake value" attack — a random
 * memecoin has no reserve, no oracle, and gets ZERO borrowing power. Each asset
 * has its own conservative LTV (how much you can borrow against it), lower for
 * more volatile assets.
 */

export type CollateralAsset = {
  symbol: string;
  name: string;
  ltv: number; // max borrow fraction of this asset's value
  color: string;
};

/** The only assets that back a credit line. Everything else = 0 borrowing power. */
export const ELIGIBLE_COLLATERAL: CollateralAsset[] = [
  { symbol: 'BTC', name: 'Bitcoin', ltv: 0.55, color: '#F7931A' },
  { symbol: 'ETH', name: 'Ethereum', ltv: 0.55, color: '#627EEA' },
  { symbol: 'SOL', name: 'Solana', ltv: 0.5, color: '#9945FF' },
  { symbol: 'JitoSOL', name: 'Jito Staked SOL', ltv: 0.45, color: '#3DE07A' },
  { symbol: 'mSOL', name: 'Marinade SOL', ltv: 0.45, color: '#3D8BFF' },
  { symbol: 'USDC', name: 'USD Coin', ltv: 0.9, color: '#2775CA' },
];

const BY_SYMBOL = new Map(ELIGIBLE_COLLATERAL.map((a) => [a.symbol.toLowerCase(), a]));
export function collateralFor(symbol: string): CollateralAsset | undefined {
  return BY_SYMBOL.get(symbol.toLowerCase());
}
export function isEligibleCollateral(symbol: string): boolean {
  return BY_SYMBOL.has(symbol.toLowerCase());
}

export type Holding = { symbol: string; valueUsd: number };
export type CollateralLine = {
  assets: { asset: CollateralAsset; valueUsd: number; borrowPower: number }[];
  eligibleValue: number; // sum of eligible collateral value
  ineligibleValue: number; // held value that does NOT count (memecoins etc.)
  borrowPower: number; // total borrowable (Σ value × per-asset LTV)
};

/** Split a holdings list into eligible collateral + its borrowing power. */
export function collateralLine(holdings: Holding[]): CollateralLine {
  const assets: CollateralLine['assets'] = [];
  let eligibleValue = 0;
  let ineligibleValue = 0;
  for (const h of holdings) {
    const asset = collateralFor(h.symbol);
    if (!asset) {
      ineligibleValue += h.valueUsd;
      continue;
    }
    eligibleValue += h.valueUsd;
    assets.push({ asset, valueUsd: h.valueUsd, borrowPower: h.valueUsd * asset.ltv });
  }
  assets.sort((a, b) => b.valueUsd - a.valueUsd);
  return {
    assets,
    eligibleValue,
    ineligibleValue,
    borrowPower: assets.reduce((s, a) => s + a.borrowPower, 0),
  };
}

/** Demo split of a total collateral value across blue-chips (deterministic-ish),
 *  so the breakdown reads real until we filter the live portfolio to the allowlist. */
export function demoCollateralHoldings(totalUsd: number): Holding[] {
  return [
    { symbol: 'SOL', valueUsd: Math.round(totalUsd * 0.55) },
    { symbol: 'ETH', valueUsd: Math.round(totalUsd * 0.28) },
    { symbol: 'BTC', valueUsd: Math.round(totalUsd * 0.17) },
  ];
}
