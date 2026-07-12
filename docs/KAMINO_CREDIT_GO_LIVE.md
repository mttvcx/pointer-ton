# Credit mode (Kamino borrow) — go-live runbook

"Spend without selling": borrow USDC against SOL/ETH/BTC collateral so the user's
crypto stays invested and there's no taxable sale. **Kamino Lend is permissionless
DeFi — no partnership needed for the borrow itself.** The card program (JIT
settlement) is the only partner-gated piece.

## What's already wired (this branch)

- **`lib/financial/kaminoClient.ts`** — `quoteCredit()` (pure LTV/health math) +
  `buildBorrowTx()` which builds an **unsigned** Kamino borrow tx (v0, base64) using
  `@kamino-finance/klend-sdk` (`KaminoAction.buildBorrowTxns`). Key-gated + lazy
  require, so the build stays clean until the SDK is installed. Server-side LTV
  guardrail (`KAMINO_BORROW_OVER_LIMIT`). **Non-custodial — the server never signs.**
- **`app/api/financial/credit/borrow/route.ts`** — POST → `{ simulated:false, txBase64 }`
  when live, `{ simulated:true }` when not. Auth-gated (`requirePointerUser`).
- **Mobile `CreditModeSheet` / `doBorrow`** — calls the route; if `simulated` it
  reflects locally and labels it; if real it **signs via Privy (`signAndSend`) and
  only reflects after the tx is actually sent — never fakes a money movement.**

So client + server are complete. The remaining work is **activation** (below).

## Steps to turn it on

1. **Install the SDK** (web root — NOT mobile):
   ```
   npm i @kamino-finance/klend-sdk
   ```
   Then run `npm run build` locally to confirm it bundles cleanly on Next.js before
   deploying (heavy Solana dep tree — catch conflicts in a preview deploy first).

2. **Set env on Vercel (prod):**
   - `KAMINO_ENABLED=1`
   - `KAMINO_MARKET=<lending-market pubkey>` (optional; defaults to the verified main
     market `7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF`)
   - `SOLANA_RPC_URL` (or `HELIUS_RPC_URL`) — server RPC used to load the market +
     fetch the blockhash while BUILDING the tx.

3. **Deposit collateral first (the one real gap).** `buildBorrowTx` **assumes the
   user's collateral is already deposited in their Kamino obligation.** A brand-new
   user has an empty obligation, so a borrow would revert. Before/at first borrow you
   need a **deposit step** (`KaminoAction.buildDepositTxns`, same sign-via-Privy
   pattern) — either wire a "deposit collateral" action, or for the first test
   deposit SOL into the Kamino market manually. **Do not enable for real users until
   the deposit path exists.**

4. **Deploy** the credit routes to prod (cherry-pick to main — separate from mobile).

5. **One funded test** (required before trusting it):
   - Fund a wallet with SOL.
   - Deposit SOL as collateral (step 3).
   - Borrow a small amount from the app in Credit mode.
   - Confirm: the tx lands, USDC arrives, `borrowed`/health/liquidation update, and
     the **over-limit guardrail rejects** a borrow beyond MAX_LTV.

## Risk params (mirror mobile `src/financial/credit.ts`)

- `MAX_LTV = 0.5` — borrow up to 50% of eligible collateral value.
- `LIQ_LTV = 0.75` — liquidation threshold.
- `USER_BORROW_APR = 0.11`, cost of funds ~`0.06` → ~5% spread (Pointer's margin).
- **Collateral allowlist** (`src/financial/collateral.ts`): only blue-chips with deep
  liquidity + a live oracle back a line. Memecoins = $0 borrowing power (blocks the
  "pump your own coin to borrow against it" attack).

## Still open after this

- **Deposit-collateral flow** (step 3) — the real prerequisite for a working borrow.
- **Repay via Kamino** — mobile `repay()` is local-only today; a `buildRepayTx`
  (same pattern) is needed for a real repayment.
- **JIT-at-swipe borrow** — borrowing *at the moment of card authorization* needs the
  card issuer's (Rain) auth-webhook. Current model borrows into spendable, then spend.
- **Confirmation** — mobile reflects after broadcast; add signature confirmation for
  extra safety on the money path.
