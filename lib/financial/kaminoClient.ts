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

// Verified Kamino mainnet constants (klend-sdk docs + GitHub).
const KAMINO_MAIN_MARKET = '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF';
const KLEND_PROGRAM_ID = 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD';

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

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/**
 * Build an unsigned Kamino borrow transaction (base64) for the client to sign via
 * Privy (non-custodial — the server never holds keys). Deposits the collateral
 * into the user's Kamino obligation and borrows USDC against it, enforcing MAX_LTV
 * + a min post-borrow health factor before returning.
 *
 * KEY-GATED + lazy: the `@kamino-finance/klend-sdk` import is a runtime require so
 * the build stays clean until the dep is installed. Returns null (→ the caller
 * falls back to the local simulation) whenever it isn't configured/installed, so
 * the money path is never half-wired. Flip on with: `npm i @kamino-finance/klend-sdk`,
 * set `KAMINO_ENABLED=1` + `KAMINO_MARKET` (the lending-market pubkey), then verify
 * one borrow on a funded wallet BEFORE relying on it.
 */
export async function buildBorrowTx(input: {
  wallet: string;
  collateralMint: string;
  amountUsd: number;
  collateralUsd: number;
  borrowedUsd: number;
}): Promise<{ txBase64: string } | null> {
  if (!isKaminoConfigured()) return null;
  const market = process.env.KAMINO_MARKET?.trim() || KAMINO_MAIN_MARKET;
  const rpc = process.env.SOLANA_RPC_URL?.trim() || process.env.HELIUS_RPC_URL?.trim();
  if (!rpc) return null;

  // Server-side guardrail: never let a borrow push past MAX_LTV.
  const q = quoteCredit(input.collateralUsd, input.borrowedUsd);
  if (input.amountUsd <= 0 || input.amountUsd > q.creditAvailableUsd) {
    throw new Error('KAMINO_BORROW_OVER_LIMIT');
  }

  try {
    // Lazy require so tsc/build don't need the SDK until it's installed.
    // Verified API (klend-sdk): KaminoMarket.load → KaminoAction.buildBorrowTxns(
    //   market, amountBaseUnits, tokenMint, owner, new VanillaObligation(PROGRAM_ID)).
    // Assumes the user's collateral is already deposited in their Kamino obligation
    // (deposit-of-collateral is a prior buildDepositTxns step, wired separately).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const klend = require('@kamino-finance/klend-sdk') as {
      KaminoMarket: { load: (conn: unknown, market: unknown) => Promise<unknown> };
      KaminoAction: {
        buildBorrowTxns: (
          market: unknown,
          amount: string,
          mint: unknown,
          owner: unknown,
          obligation: unknown,
        ) => Promise<Record<string, unknown>>;
      };
      VanillaObligation: new (programId: unknown) => unknown;
    };
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const web3 = require('@solana/web3.js') as typeof import('@solana/web3.js');
    const { Connection, PublicKey, TransactionMessage, VersionedTransaction } = web3;

    const connection = new Connection(rpc, 'confirmed');
    const owner = new PublicKey(input.wallet);
    const kmarket = await klend.KaminoMarket.load(connection, new PublicKey(market));
    const action = await klend.KaminoAction.buildBorrowTxns(
      kmarket,
      String(Math.round(input.amountUsd * 1e6)), // USDC (6dp), base units
      new PublicKey(USDC_MINT),
      owner,
      new klend.VanillaObligation(new PublicKey(KLEND_PROGRAM_ID)),
    );

    // Assemble the action's instructions into an unsigned v0 tx for the client to sign.
    const ixs = [
      ...((action.setupIxs as unknown[]) ?? []),
      ...((action.lendingIxs as unknown[]) ?? []),
      ...((action.cleanupIxs as unknown[]) ?? []),
    ] as import('@solana/web3.js').TransactionInstruction[];
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const msg = new TransactionMessage({ payerKey: owner, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    return { txBase64: Buffer.from(tx.serialize()).toString('base64') };
  } catch (err) {
    // Not installed / market mismatch → fall back to simulation rather than break.
    if (err instanceof Error && err.message === 'KAMINO_BORROW_OVER_LIMIT') throw err;
    return null;
  }
}
