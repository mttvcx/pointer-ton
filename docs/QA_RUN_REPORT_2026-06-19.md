# Pointer — QA Run Report (vs Axiom)

> **Date:** 2026-06-19 · **Engineer:** Claude Code (QA + fix pass)
> **Build:** branch `main` @ `5104d56` (working tree dirty) · **Method:** static multi-agent code audit + live API smoke tests + live browser QA (Chrome) + real on-chain trade E2E.
> **Companion docs:** `HANDOFF.md`, `AGENTS.md`, `AXIOM_READY_EXECUTION_REPORT.md`, `REALTIME_INGESTION_REPORT.md`.

---

## 1. Executive summary

- **Core trading is real and works.** A live `0.001 SOL` buy + `25%` sell of ISLANDS confirmed in ~5–6s each with click-to-buy (no wallet popup), balance + PnL strip updated live, and the **1% platform fee was correctly recorded** (`platform_fee_lamports = 10000` = exactly 1% of 0.001 SOL). Token-2022 balance reads correctly (662.91 ISLANDS, not 0). Desk PnL on a held winner showed **+398% / +196%**, not −100%.
- **One verified P0 fixed:** USDC-funded buys were recording `platform_fee_lamports = 0` and **skipping referral cashback + points** even though Jupiter charges the on-chain fee — i.e. silent loss of fee revenue and referrer payouts on every USDC buy. Root cause + fix in `app/api/trade/quote/route.ts`.
- **Eight P1s fixed** (mostly data-honesty): predictions demo data was served under a "LIVE · KALSHI" badge; portfolio "Realized PNL" chart and "Return Distribution" were fabricated; `/packs` and `/stock` showed real-looking data with no "simulated/preview" label; referral copy advertised "50%" vs the real 30%; desk PnL could show −100% on a held position with no price; a confirmed trade on a non-QA mint never hit the tape until cron.
- **Two live-only issues the static audit could not see:** `/stock/[symbol]` **hangs / never renders** (HTTP 000 after 60s), and the dev server is **saturated by Helius rate-limiting** (free/dev plan 429 storm → wallet-balance 500s, repeated `pulse_sol_cold_poll_timeout_12000ms`, ~10–14s Pulse loads). Both are infra/Phase-2 and documented, not fixed.
- **Verification:** `npm test` → **238/238 pass** (added 1 regression test, 0 regressions). `tsc --noEmit` has **12 pre-existing errors in 3 files I did not touch** — my 12 changed files add **zero** new type errors. (Separate finding: the repo is not typecheck-clean and `npm run typecheck`'s `| tee | tail` masks `tsc`'s non-zero exit.)

---

## 2. Environment

| Item | Value |
|------|-------|
| Node | v24.14.0 |
| Dev server | `npm run dev` → http://127.0.0.1:3001 (restarted by QA to pick up flags) |
| `NEXT_PUBLIC_FOUNDER_BETA` | **`1`** (set by QA — was empty; enables 0.001 SOL presets) |
| `POINTER_QA_MINT_ONLY` | **`0`** (set by QA — was `1`; ungates holder-pill enrich for non-QA mints, per `AXIOM_READY_EXECUTION_REPORT.md` recommendation) |
| `NEXT_PUBLIC_UI_DEMO_MODE` | `0` (live mode — no synthetic data path active) |
| Backup | original env saved to `.env.local.qabak` |
| Wallet funded | **Yes** — ~0.30 SOL, used for live E2E (~0.001 SOL spent total) |
| Auth | Privy logged in (multi-wallet); trade path is click-to-buy (no per-tx wallet confirm) |
| Missing optional keys | `JUPITER_API_KEY` (429s), `MORALIS_API_KEY` (holder counts `—`), `KALSHI_*` (predictions → demo), `ETHOS_API_KEY` (squad badges) |

> **.env.local was modified by QA** (FOUNDER_BETA, QA_MINT_ONLY). Restore from `.env.local.qabak` if you want the prior values; otherwise `QA_MINT_ONLY=0` is the recommended beta setting anyway.

---

## 3. Axiom comparison — top 5 surfaces

Behavioral comparison (not pixel parity). Pointer on **cold localhost dev** with a **rate-limited free Helius plan** — load times are dev/infra-bound, not architectural.

| Surface | Pointer | Axiom | Verdict |
|---------|---------|-------|---------|
| **Pulse** | NEW + MIGRATED populate with real MC/V/L; STRETCH honest-empty; quick-buy FIFO; holder pills now visible. First rows ~10–14s (cold + Helius 429). | Dozens of rows, sub-2s, live tape. | **Parity in behavior; slower + sparser** (Helius credits / no cron). Honest empty states win on integrity. |
| **Token desk** | Chart (after panel reflow), real trades tape, Top Traders (25), 23.5% top-10, Token-2022 balance, correct PnL strip, fast buy/sell. | Same set, sub-second tape, holder/insider intel. | **Strong parity.** Gaps: insiders/bundlers/snipers `—` (paid intel), tape is poll-based, chart needs a resize to paint. |
| **Global search** | Wide modal, CA resolves to token + related results w/ MC/V/L + quick-buy. | Same. | **Parity.** (Pump/Bonk/Bags filter chips not surfaced in default view — minor.) |
| **Portfolio** | Real holdings + per-token PnL (ISLANDS +156.7%), SOL/USD, graceful 429 fallback. | Same. | **Parity** after fixes. (Pre-fix: fake Realized-PNL curve + fabricated Return Distribution — now real.) |
| **Predictions** | Markets render, category filters. | Kalshi-backed live. | **Behavior ok, honesty was broken** (demo shown as "LIVE · KALSHI") — now fixed to honest demo labeling when no Kalshi keys. |

---

## 4. Screen-by-screen checklist

Legend: ✅ PASS · ⚠️ PARTIAL · ❌ FAIL · 🔧 fixed this pass

### Pulse `/pulse`
- ✅ Columns load real MC/V/L (NEW has real rows; brand-new mints honestly show `V $0 / MC --`; STRETCH honest-empty)
- ✅ Quick-buy FIFO (code-verified race-free; no per-row spinner lock)
- ⚠️ Row click: clicking the **token name** opens a copy/search context menu, not the desk (avatar/row body is the open target) — minor UX
- ✅ Protocol filter chips logic sound (empty selection hides all = intended)
- ⚠️ Stocks column → `/stock/SYMBOL` (see Stock below — route hangs)
- ⚠️ Load time ~10–14s cold (Helius-bound), vs Axiom ~1–2s
- 🔧 NEW header read "< 30m" but window is 240m → now derives "< 4h" from the constant

### Token desk `/token/[mint]` (tested ISLANDS + WIF + non-indexed)
- ✅ Header: price, MC, liquidity, bonding, socials (HOLDERS `—` w/o Moralis — honest)
- ⚠️ Chart loads (Lightweight Charts) but is **blank until the trade panel toggle reflows layout** (needs a resize to paint on first render)
- ✅ **Balance correct** (Token-2022): 662.91 ISLANDS, not 0
- ✅ **PnL strip correct**: Bought/Sold/Holding/PnL = +398% then +196% on a held winner (not −100%)
- ✅ **Buy 0.001 SOL → confirmed ~5s → balance + PnL update**
- ✅ **Sell 25% → confirmed ~6s → balance 789→592, Sold + PnL update**
- ✅ Trades tab: real indexed swaps
- ⚠️ Holders tab: filter chips + columns render; rows were still loading in capture (API returns real rows; top-10 pill 23.5% real)
- ✅ Top Traders: 25 real traders w/ realized PnL
- ✅ Dev/Token info: top-10 real; insiders/bundlers/snipers/LP/DEX-paid `—` (honest, paid intel)
- ➖ AI panel not exercised (avoid quota)

### Explore `/explore` — not exercised live (deprioritized); code path unchanged
### Track / Trackers — code-verified: add/remove, KOL import, **starter KOLs confirmed opt-in** (not auto-seeded); webhook auth constant-time + dedup
### Portfolio `/portfolio`
- ✅ Holdings load; SOL/USD present; no full-page red on 429 (inline retry banner)
- 🔧 "Realized PNL" chart was a hardcoded fake curve → now plots real cumulative realized PnL (honest empty state otherwise)
- 🔧 "Return Distribution" buckets were `floor(n/2), floor(n/3), floor(n/6)` of trade count → now real per-trade returns from closed sells

### Predictions `/predictions`
- ⚠️→🔧 Markets load, but **demo markets were served as `live:true` / `source:"kalshi"` under a green "LIVE · KALSHI" badge** with no Kalshi keys → fixed to fall back honestly to `source:'demo', live:false`
- ✅ Trade CTA already honestly gated ("Kalshi keys required to trade"; orders route 503)

### Packs `/packs`
- ⚠️→🔧 Opened with real SOL prices (0.15–5 SOL) + token-value rewards + "Open" CTAs and **no "simulated" disclosure** → fixed with a persistent simulated-mode banner

### Perps `/perps` + Stock `/stock/[symbol]`
- ✅ `/perps` renders with explicit Preview banner; order signing disabled
- ❌ **`/stock/NVDA` hangs** — HTTP 000 after 60s, never renders (dev-server compile starved under Helius-429 load). Synthetic data path also lacks a Preview label, but the hang supersedes it.

### Squads / Championship / Admin — not exercised live (deprioritized); honesty gating code-verified
### Global chrome
- ✅ Global search modal (wide, CA resolve, quick-buy)
- ✅ Topbar nav, bottom region/cluster bar, watchlist ticker render
- ➖ Deposit modal asset icons code-verified (refs resolve, onError fallbacks)

### Settings / Display
- ✅ Founder-beta presets active (0.001 visible); user custom presets (P1/P2/P3) honored

---

## 5. Bugs filed

> Severity: **P0** money/correctness/crash · **P1** empty-when-should-have-data / honesty / broken click · **P2** polish/architecture. All P0/P1 code findings were adversarially re-verified before fixing.

### P0

**BUG-01 — USDC-funded buys record `platform_fee_lamports = 0` and skip referral cashback + points** 🔧 FIXED
- **Surface:** Buy panel (SOL desk) with spend asset = USDC → `POST /api/trade/execute`
- **Repro:** Toggle spend → USDC, buy a mint, inspect the `trades` row → `platform_fee_lamports = 0`; no `referral_earnings` row for a referred buyer; `trade_volume` points = 0.
- **Root cause:** `app/api/trade/quote/route.ts` returned `amountSolEstimate: spendUsdc ? 0 : …`; the client forwards that as `amountSolNotional`, and `execute/route.ts` computes `platformFeeLamports = solToLamports(0) * feeBps / 10000 = 0`, so `recordReferralEarningFromTrade` bails (`earnings.ts:79`) and `awardPoints` gets 0 volume. Jupiter still charges the 1% on-chain fee (the swap is built with `platformFeeBps` + `feeAccount`), so the platform under-records its own revenue and silently denies referrers.
- **Files:** `app/api/trade/quote/route.ts:214`, `lib/hooks/usePointerTradeSubmit.ts:65`, `app/api/trade/execute/route.ts:100-130`, `lib/referrals/earnings.ts:79`

### P1

**BUG-02 — Referral "50% cashback" copy vs real 30%** 🔧 FIXED
- Dashboard "Share on X" hardcoded `50% cashback. Forever.` while `referralFeeShareBps()` = 3000 (30%) and the dashboard's own label shows 30%. Landing hero (`app/page.tsx:357`) also claimed "50% cashback, the highest in the market." Confirmed real share = 30% via dashboard + DB.
- **Files:** `components/referral/ReferralDashboard.tsx:135`, `app/page.tsx:357`

**BUG-03 — Predictions demo data served as live Kalshi** 🔧 FIXED
- With no Kalshi keys, `/api/predictions/markets` returned `source:"kalshi", live:true` with `demo-btc/eth/sol-2026-price` + `world-cup-winner` markets; UI showed a green "LIVE · KALSHI" badge. `loadKalshiMarkets()` merged `KALSHI_PREDICTION_MARKETS` (demo) into an empty live set so `rows.length>0` became true from demo data, making the honest `live:false`/`'demo'` branch dead.
- **Files:** `lib/predictions/fetchMarkets.ts:127-152,162-177`

**BUG-04 — Desk PnL shows −100% on a held position with no desk row and no live price** 🔧 FIXED (+test)
- When `desk===null` (unindexed/fresh) AND `priceUsd` is null AND still holding, `holdingUsd` stayed 0 → `netPnlUsd = -buyUsd` → −100%. Branch was untested.
- **Files:** `lib/trading/deskWalletDisplayStats.ts:54-59` (+ `tests/deskWalletDisplayStats.test.ts`)

**BUG-05 — Post-trade ingest gated to QA mint; own confirmed trade invisible on tape** 🔧 FIXED
- `ingestExecutedSolSwap` early-returned for any non-QA mint, so a confirmed buy/sell on ISLANDS (or any non-QA indexed mint) never upserted `mint_swaps` until cron caught up — contradicting the "desk sync without waiting on webhook" intent. Observed live: my ISLANDS buy did not appear on the chain-trades tape immediately.
- **Files:** `lib/trade/ingestExecutedSwap.ts:22`

**BUG-06 — Portfolio "Realized PNL" chart is a hardcoded fake curve** 🔧 FIXED
- `TinyLineChart` drew a fixed point array branching only on PnL sign; any user with activity saw an invented curve under a "Realized PNL" + time-filter header.
- **Files:** `components/portfolio/PortfolioDashboard.tsx:1019,1955-1981`

**BUG-07 — Portfolio "Return Distribution" buckets fabricated from trade count** 🔧 FIXED
- Buckets were `floor(trades.length/2 | /3 | /6)` — pure functions of trade count, not real returns. Confirmed live: 4 txns → buckets 2/1/0.
- **Files:** `components/portfolio/PortfolioDashboard.tsx:657-666`

**BUG-08 — Packs flow shows real SOL prices + rewards with no "simulated" label** 🔧 FIXED
- Server uses a simulated ledger (`PACKS_OPEN_USES_SIMULATED_LEDGER=true`, no wallet charge) but the UI showed real SOL prices + reward values + "Open pack" with zero disclosure. Added a persistent simulated-mode banner driven by the existing constant.
- **Files:** `components/packs/PacksTerminal.tsx`

**BUG-09 — Dev creator-auth route does an inline DB write (+ silently ignores errors)** 🔧 FIXED
- `app/api/creators/auth/dev/route.ts` ran `createAdminSupabase() as any … .update(...)` inline (AGENTS rule 1) and ignored the update error. Routed through a new typed `markCreatorAccountVerified()` helper.
- **Files:** `app/api/creators/auth/dev/route.ts:34-46`, `lib/db/creators.ts`

**BUG-10 — `/stock/[symbol]` hangs / never renders; synthetic data lacks Preview label** ❌ NOT FIXED (Phase-2 / infra)
- `/stock/NVDA` returns HTTP 000 after 60s while `/perps` is instant. Dev log shows `○ Compiling /stock/[symbol] …` with no completion amid a Helius-429 + `pulse_sol_cold_poll_timeout_12000ms` storm → first-compile starvation. The stock terminal also renders 100% synthetic market data (`lib/stocks/mockStocks.ts` `Math.random`) with no Preview banner (unlike `/perps`). Stock perps are explicitly Phase-2 preview; left for the user.
- **Files:** `app/(app)/stock/[symbol]/page.tsx`, `components/stocks/StockTerminal.tsx`, `lib/stocks/mockStocks.ts`

**BUG-11 — Repo is not typecheck-clean; CI typecheck masked by pipe** ⚠️ PARTIALLY FIXED
- `tsc --noEmit` exits 1 with 12 errors (was 13). Fixed the `evLooksCrypto`→`eventLooksCrypto` typo in `fetchMarkets.ts:96` (a real latent bug: Kalshi event crypto-tagging silently never ran). Remaining 12 are **pre-existing in files untouched by this pass**: `tests/protocolClassify.test.ts` (×7), `tests/pulseColumnGates.test.ts` (×4 — test fixtures missing widened `tokens` columns), `lib/market/dexscreenerTokenHydrate.ts` (×1 — `'ton'` not in `ProtocolBrandId`). Also: `package.json` `typecheck` is run as `… | tee … | tail`, so the pipeline exit code is `tail`'s (0) and a failing `tsc` looks green.
- **Files:** `lib/predictions/fetchMarkets.ts:96` (fixed); `tests/protocolClassify.test.ts`, `tests/pulseColumnGates.test.ts`, `lib/market/dexscreenerTokenHydrate.ts:105` (open)

### P2

**BUG-12 — Pulse NEW header "< 30m" vs 240m window** 🔧 FIXED → derives "< 4h" from `PULSE_THRESHOLDS` (`components/tokens/PulseColumn.tsx`)

**BUG-13 — `/api/pulse/metrics` holder pills gated for non-QA mints under `QA_MINT_ONLY=1`** 🔧 FIXED operationally (set `QA_MINT_ONLY=0`; ISLANDS holder pills now show). Code recommendation: split cheap DB reads from expensive Moralis/Helius enrich in `fetchPulseMetricsForMints` (`lib/market/pulseMetricsEnrich.ts:430`) so DB-backed pills survive the gate.

**BUG-14 — `kickoffMintIndexIfEmpty` re-backfills perpetually-empty mints every poll** ❌ NOT FIXED — debounce only covers `status==='indexing'`; a mint that finished with 0 swaps re-fires a 4-page Helius backfill on each empty-desk poll. Broaden debounce to terminal states + longer gap (`lib/indexer/kickoffMintIndex.ts:15-32`).

**BUG-15 — Raw SQL in API routes (AGENTS rule 1)** ❌ NOT FIXED — `tokens/[mint]/top-traders`, `tokens/[mint]/trader-stats`, `points/me` run `supabase.from(...)` inline. Move to `lib/db/*` helpers. (Read-only, low risk.)

**BUG-16 — Ad-hoc hex vs theme tokens (AGENTS rule 5)** ❌ NOT FIXED (cosmetic) — `components/tokens/TokenChart.tsx` candle/marker colors; `PortfolioDashboard.tsx` `TinyLineChart` (`#3DDC97`/`#FF5E78`) + `DepositAssetIcon.tsx` (`bg-[#2d3343]`). Map to `--signal-bull`/`--signal-bear`/surface tokens (resolve via the file's existing `cssRgbFromVar`).

**BUG-17 — Helius free/dev-plan rate-limiting saturates the dev server** ❌ NOT FIXED (infra/paid-API) — 429 storm → `/api/wallets/*/balance` 500s after 8s retries, repeated `pulse_sol_cold_poll_timeout_12000ms` / `pulse_feed_timeout_18000ms`, ~10–14s Pulse loads, stock-route compile starvation. Code sub-finding: the Pulse cold-start DAS poll has no backoff after repeated failures and re-fires on every sparse feed fetch.

### INFO / verified-correct (no action)
- `lib/pump/directSwap.ts` builds feeless swaps but is **dead code** (not wired to the trade API) — no fee bypass today; delete or add a fee ix before ever wiring it in.
- `referrals/earnings` GET and `webhooks/helius` POST lack Zod but are safe (manual clamp / auth-gated + defensive parsing).
- Demo lockdown (`NEXT_PUBLIC_UI_DEMO_MODE=0` → `demoHardLocked`) is consistent; no synthetic data leaks in live mode.
- Quick-buy FIFO queue is race-free; `traits.cashback` (token metadata) is correctly distinct from referral earnings.
- Jupiter 429 → SOL-only portfolio fallback works; starter KOL packs are opt-in.

---

## 6. Fixes applied (working tree — not committed)

| # | File | Change |
|---|------|--------|
| BUG-01 | `app/api/trade/quote/route.ts` | Compute SOL-equivalent `amountSolEstimate` for USDC buys via cached `getSolUsdPrice()` so fee + referral + points are recorded. |
| BUG-02 | `components/referral/ReferralDashboard.tsx`, `app/page.tsx` | X-share copy uses dynamic `sharePct`; landing hero 50%→30%. |
| BUG-03, BUG-11 | `lib/predictions/fetchMarkets.ts` | Return `[]` when zero real Kalshi rows (honest `source:'demo', live:false`); fix `evLooksCrypto`→`eventLooksCrypto` typo. |
| BUG-04 | `lib/trading/deskWalletDisplayStats.ts`, `tests/deskWalletDisplayStats.test.ts` | Cost-basis fallback for held position w/ no desk + no price; regression test. |
| BUG-05 | `lib/trade/ingestExecutedSwap.ts` | Non-QA mints route through `backfillMintSwaps` (QA fast-path kept). |
| BUG-06, BUG-07 | `components/portfolio/PortfolioDashboard.tsx` | Real cumulative-PnL series for the chart; real per-trade return buckets. |
| BUG-08 | `components/packs/PacksTerminal.tsx` | Persistent "Simulated mode" banner. |
| BUG-09 | `app/api/creators/auth/dev/route.ts`, `lib/db/creators.ts` | New typed `markCreatorAccountVerified()` helper; drop inline write. |
| BUG-12 | `components/tokens/PulseColumn.tsx` | NEW header label derives from `PULSE_THRESHOLDS` ("< 4h"). |

**Verification of fixes:** `npm test` → **238/238 pass** (+1 new test, 0 regressions). `tsc --noEmit` → my 12 changed files produce **0 new errors** (12 remaining are pre-existing baseline in untouched files). Live E2E re-confirmed the SOL fee path records `platform_fee_lamports=10000`.

> **Runtime note:** the BUG-03 predictions fix is confirmed on disk + by tests/typecheck, but the **already-running dev server is still serving the pre-edit module** (Next's file watcher missed the `lib/` change under the Helius-429 load — 0 recompiles logged; there's also a 45s in-memory `cachedLive`). It will serve `source:'demo', live:false` after the next dev restart/deploy. All other fixes are in routes/components Next recompiles on navigation.

> **Not committed** (per instructions). The working tree also contains: pre-existing doc edits (`AGENTS.md`, `HANDOFF.md`, `README.md`, `docs/POINTER-QA-HANDOFF.md`) and **your in-progress Cursor login fixes** (`app/auth/oauth/page.tsx`, `components/auth/LandingSignInModal.tsx`, `components/auth/PrivyOAuthReturnCleanup.tsx`, `lib/auth/oauthPopup.ts`) — keep those separate when committing.

---

## 7. Remaining blockers (need user action)

1. **Helius plan (P0 for parity):** the free/dev plan 429-storms the whole dev server (balance 500s, slow Pulse, stock-route hang). A paid Helius plan + a registered webhook on a deployed URL is required for Axiom-class tape + reliable balances. This is the single biggest gap vs Axiom.
2. **`MORALIS_API_KEY`** → total holder counts (currently `—`).
3. **`JUPITER_API_KEY`** → removes quote 429s under load.
4. **`KALSHI_*` keys** → real predictions (otherwise honest demo after BUG-03 fix).
5. **Pre-existing typecheck failures (BUG-11):** fix `protocolClassify.test.ts`, `pulseColumnGates.test.ts` fixtures + `dexscreenerTokenHydrate.ts` `'ton'` brand, and change `package.json` `typecheck` to not pipe through `tail` (so CI fails on type errors).
6. **`.env.local`** was changed for QA (FOUNDER_BETA=1, QA_MINT_ONLY=0); backup at `.env.local.qabak`.

---

## 8. Recommended next sprint (ordered)

**P0**
1. Ship BUG-01 fix to prod and reconcile any historical USDC trades with `platform_fee_lamports=0` (back-credit referrers if needed).
2. Move to paid Helius + register the swap webhook (fixes BUG-10 hang, BUG-17 saturation, slow Pulse, balance 500s).

**P1**
3. Land the honesty fixes (BUG-03/06/07/08) and verify the referral/landing copy (BUG-02) in prod.
4. Restore CI typecheck integrity (BUG-11): fix the 12 errors + unpipe `typecheck`.
5. Fix the token-desk chart blank-until-resize (dispatch a resize / `ResizeObserver` on mount).

**P2**
6. BUG-13 (split DB reads from enrich), BUG-14 (kickoff debounce), BUG-15 (raw SQL → `lib/db`), BUG-16 (theme tokens), BUG-17 cold-start poll backoff.
7. Stock-perp Preview banner + delete dead `lib/pump/directSwap.ts` (or add a fee ix before wiring).

---

*Generated during a live QA pass with one real on-chain buy (`3Rbf1PQr…`, fee 10000 lamports) + one 25% sell (`2eueYj8v…`) on ISLANDS, ~0.001 SOL spent total.*
