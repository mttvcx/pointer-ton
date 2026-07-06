import 'server-only';

/**
 * Pointer Financial → Credit mode (borrow-against-collateral) via Kamino.
 *
 * The "spend without selling" engine: borrow USDC against a user's SOL/ETH/BTC
 * collateral at the moment they spend, so their crypto stays invested + earning
 * and they never realize a taxable sale. Kamino Lend is permissionless DeFi
 * ($2B+ TVL) — no partnership needed for the borrow itself; the card program is
 * the only partner-gated piece (JIT settlement).
 *
 * KEY-GATED: with `KAMINO_ENABLED` unset, `isConfigured()` is false and the
 * `/api/financial/credit` route reports `configured:false` → the app uses its
 * local borrow simulation. Nothing here signs or moves funds; a real borrow tx is
 * built with `@kamino-finance/klend-sdk` and signed client-side via Privy (the
 * server never holds keys — non-custodial), exactly like the trade path.
 *
 * NOTE: rates/params below are conservative illustrative defaults; re-verify
 * against live Kamino market state (reserve LTV, borrow APR, liq threshold)
 * before enabling with a real market.
 */

// Risk params — mirror the mobile client (apps/mobile/src/financial/credit.ts).
const MAX_LTV = 0.5;
const LIQ_LTV = 0.75;
const USER_BORROW_APR = 0.11; // what we charge on the line
const KAMINO_APR = 0.06; // our cost of funds → ~5% spread

export function isKaminoConfigured(): boolean {
  return process.env.KAMINO_ENABLED === '1';
}

export type CreditQuote = {
  /** Max additional USDC borrowable against the collateral, after current debt. */
  creditAvailableUsd: number;
  healthFactor: number; // >1 safe
  liquidationDropPct: number; // how far collateral can fall before liquidation
  borrowAprUser: number;
  spreadApr: number; // our margin
};

/** Pure quote math (no chain calls) — safe to run whether or not a market is wired. */
export function quoteCredit(collateralUsd: number, borrowedUsd: number): CreditQuote {
  const creditAvailableUsd = Math.max(0, collateralUsd * MAX_LTV - borrowedUsd);
  const healthFactor = borrowedUsd <= 0 ? Infinity : (collateralUsd * LIQ_LTV) / borrowedUsd;
  const liquidationDropPct =
    borrowedUsd <= 0 || collateralUsd <= 0 ? 100 : Math.max(0, (1 - borrowedUsd / LIQ_LTV / collateralUsd) * 100);
  return {
    creditAvailableUsd,
    healthFactor,
    liquidationDropPct,
    borrowAprUser: USER_BORROW_APR,
    spreadApr: USER_BORROW_APR - KAMINO_APR,
  };
}

/**
 * Build an unsigned Kamino borrow transaction (base64) for the client to sign via
 * Privy. Stubbed + key-gated: throws until a real Kamino market + the
 * `@kamino-finance/klend-sdk` integration is wired and reviewed. Documents the
 * exact inputs the real implementation needs.
 */
export async function buildBorrowTx(_input: {
  wallet: string;
  collateralMint: string;
  amountUsd: number;
}): Promise<{ txBase64: string }> {
  if (!isKaminoConfigured()) throw new Error('KAMINO_NOT_CONFIGURED');
  // TODO(kamino): use @kamino-finance/klend-sdk → KaminoAction.buildBorrowTxns(
  //   market, amount(USDC), obligation(wallet), collateralReserve) → serialize.
  //   Enforce MAX_LTV + a min post-borrow health factor server-side before returning.
  throw new Error('KAMINO_BORROW_NOT_IMPLEMENTED');
}
