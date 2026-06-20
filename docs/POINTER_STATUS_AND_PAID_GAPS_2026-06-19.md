# Pointer — Status & Paid-Gap Report (2026-06-19)

> For GPT review. Written by the takeover engineering session. Goal: state exactly where Pointer is, what's **shipped**, what's **infra/paid-blocked** (so you know what to buy), what **config** is still needed, and what **code** remains. Distinguishes "slow because we're on free tiers" from "actually broken."

---

## 0. Executive summary
Pointer is a multi-chain (Solana primary, TON, EVM browse) Axiom-style trading terminal on Next.js + Supabase + Privy + Jupiter + Helius, deployed on Vercel (`pointer-ton.vercel.app`). Core trading, packs, cashback/referral, and the desk all work. The remaining gaps are **mostly paid-tier infra (Helius/Moralis/Jupiter/Kalshi)**, not code bugs. The single biggest lever vs Axiom is **a paid Helius plan** (real-time token streaming + reliable balances).

---

## 1. ✅ Shipped this session (code, deployed to prod + preview)
- **Cashback = 50%** real per-trade accrual to a ledger (was display-only/30%); **referral = 30%** to the referrer (separate, stacks). Same-account self-referral blocked; cross-account allowed.
- **Packs made real** — on-chain commerce gated behind `PACKS_LIVE_COMMERCE_ENABLED` + a treasury signer: pay → verify on-chain → roll (house edge) → treasury buys + delivers the token → recorded in `pack_inventory`. Pack-item sells charge **2%** (vs 1%), no cashback. Migration `scripts/pack-inventory.sql` is run on the live DB.
- **Fee wallet corrected** to the owner's Tangem (`…qcczqZGee8wy`). The old configured `…qcczqRGee8wy` was an **off-curve typo** (unrecoverable; ~35k lamports lost). Updated `.env.local` + Vercel `JUPITER_REFERRAL_ACCOUNT`.
- **Quick-buy: depth-1 quote prefetch** (warm spam-buys skip the ~300–800ms quote) + **execution telemetry** (`[pointer-speed]` console + "Filled in Xms" toast).
- **Vercel build fixed** (was failing every deploy): `dexscreenerTokenHydrate.ts` brand coercion + excluded tests from the production typecheck. Builds are green now.
- **Supabase repointed** from the nuked old project to the live one (`ajngsbnwtkmkvbgpntkd`) — URL + project_id + anon + service_role in `.env.local` and Vercel.
- **Wallet chain-scoping bug fixed** — the Display wallet dropdown showed wallets of all chains; now filtered by active chain (`mintMatchesAppChain`).
- **Chain-aware key import** — was hardcoded TON; now Solana (base58/hex/JSON) + TON; EVM browse-only. (See §4 — imported wallets are still view-only.)
- **$16 primary SOL wallet** was hidden because `is_archived=true`; unarchived in the DB.
- **Helius key fixed in Vercel** — prod had the OLD maxed key (balances showed 0); replaced with the working key + redeployed.
- **Privy allowed-origin** added for the preview URL (login was hanging on it).
- 254 unit tests pass; `tsc` clean.

---

## 2. 💰 WHAT TO PAY FOR (the real gaps — not bugs)
| Service | What it unlocks | Why it matters | Status |
|---|---|---|---|
| **Helius — paid plan** | Real-time token streaming (Pulse NEW/STRETCH/MIGRATED), reliable balances, no 429 throttling, LaserStream/Sender | **The #1 Axiom-parity gap.** DB already has 105k tokens indexed; the *live feed* is rate-limited on free. Axiom's "live tape + 0.4s" is paid infra. | **Free plan** (285k/1M used) — works but throttled |
| **Moralis API key** | Total holder counts on token desks | Holder pills show `—` without it | Missing |
| **Jupiter API key** | Higher quote rate limits (fewer 429s under load) | Free `lite-api` 429s during bursts | Missing |
| **Kalshi keys** | Real prediction markets | Predictions fall back to honest demo without it | Missing |
| **Ethos API key** | Squad / trader reputation badges | Cosmetic | Missing |
| **Privy → Production** | >150 users (Privy app is in **Development** mode, 150-user cap) | Needed before real launch | Dev mode |

---

## 3. ⚙️ CONFIG TO DO (you, in dashboards — not code)
1. **Register the Helius webhook on the NEW account** → real-time mint ingestion. The old webhook was on the maxed account (`.env.local` line 43). Run `scripts/setup-helius-webhooks.ts` pointed at `https://pointer-ton.vercel.app/api/webhooks/helius` with the new Helius key + `HELIUS_WEBHOOK_AUTH_TOKEN`. **This is the "RPC thing pointed to the Vercel domain."** Until then, Pulse relies on polling only (slow on free Helius).
2. **Verify Vercel throttle flags are off** for prod: `POINTER_QA_MINT_ONLY=0`, `POINTER_PAUSE_INGEST=0`, `NEXT_PUBLIC_POINTER_PAUSE_POLLING=0` (they're 0 locally; confirm in Vercel env).
3. **TradingView Advanced Charts** — free, but apply at tradingview.com with your **domain** (need the domain first). Keep TV attribution; public integration; don't commit the library to a public repo.
4. **Pause/monitor Vercel auto-deploy** if the failed-deploy email spam returns (it shouldn't now that builds are green).
5. **Privy**: add your real domain to allowed origins when you have it; upgrade to Production.

---

## 4. 🔧 REMAINING CODE WORK
1. **Usable imported wallets** — imported keys are currently **view-only** (we derive the address client-side; the key never reaches a signer). To *trade* from an imported key, wire Privy's actual wallet import (so Privy holds the key and can sign) or a server-signing path. Security-sensitive; scoped, not done.
2. **Login popup UX** — OAuth is a full-page redirect (the dev's comment notes a popup looped Privy's Google account-chooser). Convert to a clean popup-that-closes, carefully.
3. **Instant-fill speed** — prefetch is in; next levers if needed: optimistic queue advance, dynamic Jito tip, and (only if cold-quote latency stays bad) direct pump.fun/Raydium program calls bypassing Jupiter. Pending real telemetry numbers.
4. **Pack fulfillment treasury** signing path (`lib/packs/fulfillRewards.ts`) is written but **untested on mainnet** — verify with one bronze pack before relying on it.

---

## 5. Speed vs Axiom (the 0.4s bar)
- Axiom's "under 0.4s" ≈ **click → broadcast** (pre-built tx + staked RPC), **not** confirmed on-chain. Confirmation is Solana-bound (~1.4–3s P90 for everyone).
- Pointer is now **instrumented**: every buy logs `[pointer-speed] total/quote/sign+exec ms` and shows "Filled in Xms." Awaiting live 0.001-SOL datapoints to fill `docs/EXECUTION_SPEED_REPORT.md` and pinpoint the remaining gap (expected: sign+exec, since prefetch removed the quote tax).

---

## 6. Confirmed "infra, not a bug"
- **Pulse columns empty / slow** = free-Helius throttle + webhook not yet on the new account. DB has the tokens; the pipeline is intact.
- **Balances were 0** = prod had the old maxed Helius key (fixed this session).
- **Merge did not break anything** — clean fast-forward, zero divergence.
