# Cashback / Referral rates · Fee proof · Real Packs — 2026-06-19

> Branch: `qa/2026-06-19-fixes`. Continuation of the QA pass. Covers the three
> tasks: (1) cashback 50% + referral 30%, (2) on-chain fee proof, (3) making
> packs real. `npm test` = **254/254 pass**. `tsc` = 12 pre-existing baseline
> errors only (BUG-11), **0 new**.

---

## 1) Cashback 50% + Referral 30% — DONE (code) ✅

**The model (now explicit and separate):**
- **Cashback = 50%** — the *trader's own* rebate on the platform fee they pay. New seam `cashbackShareBps()` (default `5000`), env `CASHBACK_SHARE_BPS` / `NEXT_PUBLIC_CASHBACK_SHARE_BPS`.
- **Referral = 30%** — the *referrer's* cut of a referee's fee. Unchanged (`referralFeeShareBps()` = `3000`). The user confirmed this is correct.
- They **stack**: of each 1% fee → 50% back to trader, 30% to referrer, **20% retained** by the house. (Test asserts this split.)

**Wired for real (per the user's choice):** every confirmed trade now accrues 50% of its platform fee to the trader's `cashback_ledger` (kind `accrual`, deduped by `trade_id`), in both the SOL and TON execute paths — analogous to referral earnings, settled later via the rewards claim roadmap (a ledger credit, **not** an immediate on-chain payout).

**Self-referral logic — already correct, no change needed:**
- Same account referring itself → blocked (`apply/route.ts` → `self_referral`, and `recordReferralEarningFromTrade` guards `referrer_id === referred_id`).
- A user self-referring from a **different** account → allowed; that referred account trades, earns its own 50% cashback, and the referrer (the other account) earns 30%. Matches the user's spec verbatim.

**Copy fixes:** landing hero `30% → 50%`; referral X-share hook now advertises the **50% cashback** (the recruit's benefit), while the dashboard fee-share stats stay **30%** (the referrer's cut). Rewards claim hub now reads the **real** cashback balance (`getCashbackBalanceSol`) instead of the demo env.

**Files:** `lib/cashback/constants.ts`, `lib/cashback/accrual.ts`, `app/api/trade/execute/route.ts`, `app/page.tsx`, `components/referral/ReferralDashboard.tsx`, `lib/rewards/claimSummary.ts`, `tests/cashbackMath.test.ts`, `.env.example`.

---

## 2) Fee proof + WALLET CORRECTION ⚠️→✅

> **CRITICAL FIX (2026-06-19, later):** the configured fee wallet was a **typo**.
> `.env.local` had `JUPITER_REFERRAL_ACCOUNT` = `…qcczq`**`R`**`Gee8wy` (an **off-curve**
> pubkey — not a real signable wallet; a one-char slip from the owner's Tangem).
> All ~35,661 lamports collected there are **unrecoverable** (off-curve = no private
> key can exist). The owner's real Tangem fee wallet is `…qcczq`**`Z`**`Gee8wy`
> (on-curve, controlled). **Fixed `.env.local` lines 53 + 54 → the `Z` address.**
> **Still TODO (owner):** update `JUPITER_REFERRAL_ACCOUNT` in the **Vercel dashboard**
> env vars (prod doesn't read it from a repo file). The `…RGee8wy` string remains in
> `tests/jupiterReferralFee.test.ts:49` only as an off-curve *test vector* — leave it.

The (now-stuck) R fee account `5Kb16KW8…mWVs` received the historical fees below.

**Why you couldn't see it:** the fee lands as **wrapped SOL (wSOL)** in the owner's **token account**, not the owner's native SOL balance (which is `0`). The fee wSOL account is:

> **`5Kb16KW8DnNY7TMTbZzjRfSyxVvUExRGnZ8fds18mWVs`** — current balance **35,661 lamports wSOL** (≈0.0000357 SOL) accrued from 4 trades. It has never been unwrapped/withdrawn, so it just sits there.

Verified fee credits (net wSOL delta into the fee account):

| UTC | Signature | Fee in |
|-----|-----------|--------|
| 2026-06-12 02:57 | `4Tqpp…r7MPS` | +1,000 |
| 2026-06-13 07:58 | `2Cwz…1o6Y` | +10,000 |
| 2026-06-19 08:00 | `3Rbf1PQr…6e9Gp` (QA buy) | **+10,000 = exactly 1% of 0.001 SOL** |
| 2026-06-19 08:02 | `2eue…TFSmx` (QA sell) | +14,661 |

Solscan (phone):
- Fee account: https://solscan.io/account/5Kb16KW8DnNY7TMTbZzjRfSyxVvUExRGnZ8fds18mWVs
- Owner: https://solscan.io/account/AYq7mi2a3jkzD5MKgCZZCwqhnuKBnuR4qcczqRGee8wy
- Buy tx: https://solscan.io/tx/3Rbf1PQrzYjBwvvxJuJYw8ToLkeDzXMXTa88ZUrakyNjnNkj8XuhxXCSCzE3RqWmfaSe6S7nD7QtaJRKbdB6e9Gp

**To actually spend/move the collected fees:** they're wSOL under `AYq7mi…`. Unwrap (close the wSOL account / `SyncNative`+close) to convert to native SOL, signed by the fee owner's key (`JUPITER_REFERRAL_ADMIN_WALLET`). Nothing is wrong — the revenue is accruing correctly; it just hasn't been swept.

---

## 3) Real packs — code-complete, gated OFF, needs LIVE verification ⚠️

Packs were a simulated ledger. They are now wired for **real on-chain commerce**, but **default OFF** so nothing changes for users until you enable it on your PC.

### How it works (real flow)
1. **Buy:** client asks `POST /api/packs/pay` to build an unsigned SOL transfer of the pack price → **treasury**; the user's Privy wallet signs + sends it.
2. **Open:** client calls `POST /api/packs/open` with the payment signature. The server **verifies the payment on-chain** (treasury balance delta, payer is signer, ≥ price within 2% tolerance), **claims it once** (UNIQUE `pack_payments.payment_tx` = replay guard), then rolls the outcome with the **existing house edge** (≥22% modeled, EV ≤78% of price — unchanged).
3. **Deliver:** the **treasury buys each won token on-chain** (Jupiter, no platform fee on delivery buys — the edge is already in the price) and **transfers it to the user's wallet**. Delivered tokens are recorded in `pack_inventory`.
4. **Sell pack items:** selling a pack-acquired mint is charged **2% (200 bps), not 1%**, and earns **NO cashback** — enforced server-side in both the quote (on-chain fee bps) and execute (recorded fee + cashback gate) paths, drawing down `pack_inventory` FIFO. Once pack units are exhausted, the mint reverts to the normal 1% + cashback.

### Files
- Flag/status: `lib/packs/mode.ts` (`PACKS_LIVE_COMMERCE_ENABLED`), `lib/packs/commerce.ts`, `lib/packs/treasury.ts`
- Payment: `app/api/packs/pay/route.ts`, `lib/packs/verifyPackPayment.ts` (+ pure `lib/packs/paymentMath.ts`), `lib/db/packs.ts` (`claimPackPayment`/`markPackPaymentStatus`)
- Roll → deliver: `app/api/packs/open/route.ts`, `lib/packs/rewardFulfillmentPlan.ts` (pure), `lib/packs/fulfillRewards.ts` (**live signing seam**)
- Inventory + fee: `lib/db/packInventory.ts`, `lib/packs/constants.ts` (`PACK_ITEM_SELL_FEE_BPS`), `lib/jupiter/quote.ts` (`feeBpsOverride`), `app/api/trade/quote/route.ts`, `app/api/trade/execute/route.ts`
- Client: `lib/packs/usePackPurchase.ts`, `components/packs/PackOpenFlow.tsx`, `components/packs/PacksTerminal.tsx` (honest live/simulated banner)
- DB migration: `scripts/pack-inventory.sql` (`pack_inventory` + `pack_payments`)
- Tests: `tests/packCommerce.test.ts`, `tests/cashbackMath.test.ts`

### Fee wallet vs hot treasury — two different wallets
- **Fee / house-profit wallet = the owner's Tangem** (`…qcczqZGee8wy`, receive-only).
  Trade platform fees land here directly via Jupiter (`JUPITER_REFERRAL_ACCOUNT`).
- **Pack treasury = a separate HOT wallet** (`PACKS_TREASURY_SECRET_KEY`). A hardware
  wallet can't auto-sign server-side, so the wallet that *buys + delivers* won tokens
  must be a hot key. Flow: pack price → hot treasury (funds the buys, keeps the
  house edge) → **owner periodically sweeps treasury profit to the Tangem**.

### TO GO LIVE (do at your PC — needs secrets + signing + mainnet)
1. **Run the migration:** `scripts/pack-inventory.sql` in Supabase SQL editor, then `scripts/reload-postgrest-schema.sql`.
2. **Fund + set the treasury:** create a hot wallet, fund it (cover pack payouts + a buffer), set `PACKS_TREASURY_SECRET_KEY` (base58 or JSON array) in `.env.local`. Optionally set `NEXT_PUBLIC_PACKS_TREASURY_ADDRESS`.
3. **Flip the flag:** set `PACKS_LIVE_COMMERCE_ENABLED = true` in `lib/packs/mode.ts`. (`/api/packs` then returns `live: true` and the UI banner flips to "Live mode".)
4. **Test one cheap pack** (e.g. bronze) end-to-end: confirm the SOL transfer to treasury, the won token(s) arriving in your wallet, and a **2% fee + no cashback** when you sell one of them.

### ⚠️ Not verifiable from here (flag what to watch)
- `lib/packs/fulfillRewards.ts` performs **real treasury signing** (Jupiter buy + SPL transfer per reward). It is written but **untested on mainnet** — verify the buy→transfer→ATA-creation path and confirmation handling on a cheap pack first. Per-reward failures are isolated and returned in the open response `fulfillment[]` for reconciliation/refund.
- Compliance (region/age) + responsible-spend limits are still TODO stubs in `open/route.ts` — gate before any broad launch.
- The delivery buys use Jupiter; thin-liquidity won tokens may slip. The `maxPayoutSol` cap in the fulfillment plan is a defensive anti-drain guard.

### Still TODO / nice-to-have
- Show pack-acquired holdings ("pack inventory") in the portfolio/packs UI with a "pack item · 2% sell" tag.
- Multiplier/badge rewards (`cashback_multiplier`, etc.) are currently `skipped` by fulfillment (non-custodial perks) — wire them to real ledger perks when ready.
