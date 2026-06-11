# POINTER — Axiom-Ready Execution Report

**Date:** 2026-06-11
**Baseline:** `FOUNDER_BETA_READINESS_REPORT.md` (audit)
**Verification:** `npx tsc --noEmit` clean · `npm test` 172/172 pass · live smoke on `http://127.0.0.1:3001`

---

## Commits

| Commit | Scope |
|--------|-------|
| `caddc79` | Phase 0–1: demo/sandbox hard lock + all fake live data removed |
| `5930ad8` | Phase 2: token desk honesty (tape splits, holder count, null semantics) |
| `ada50c9` | Phase 3–4: search truth + Pulse social ingestion |
| `fcd445d` | Phase 5–7: Jupiter degrade + dead UI cleanup |

---

## Completed phases

### Phase 0 — Safety + mode lock ✅
- `NEXT_PUBLIC_FOUNDER_BETA=1` now **force-disables** UI demo mode, table demo, and the `pointer-ui-demo` localStorage override (`lib/dev/uiDemoMode.ts`).
- Production builds ignore localStorage demo unless `NEXT_PUBLIC_UI_DEMO_MODE=1` is explicitly set.
- Sandbox execution is **hard-blocked** under founder beta (`lib/sandbox/mode.ts`) — env flag and localStorage both ignored.
- `.env` / `.env.local` confirmed gitignored.
- Tests: `tests/founderBetaLiveSafety.test.ts`.

### Phase 1 — Fake live data killed ✅
| Item | Fix |
|------|-----|
| `syntheticPct` TF % | Default `allowSynthetic: false`; BuySellPanel never opts in; missing Dex windows render `—` |
| `syntheticCreatorDev` | Only under explicit demo-tables mode; live shows "indexer pending" copy |
| `rowDemo: true` wallet intel | Removed from all 4 call sites; merge additionally gated on `uiDemo` |
| Hash search metrics | Removed entirely; `EnrichedSummary` is nullable live-only; fake badge dot removed |
| Twitter mock fallback | FixTweet live-only; failure → 502 → UI renders `—` (verified live: Ansem 940K real followers) |
| Ethos mock fallback | Live API only; no key / no profile → null → badge hidden |
| Wallet analytics noise chart | `buildChartSeries` returns `[]`; UI shows "No PnL history indexed" |
| Win/loss fabricated buckets | Real wins/losses totals only when stats exist; else honest empty |
| `realizedPnlUsd * 0.42` | Removed — null until per-trade history |
| `STUB_SOL_USD = 85.3` | Live SOL spot via `useSolUsdSpot` → `/api/prices/mint` |
| Twitter alerts rail mocks | Demo-mode only; live shows honest empty state |
| X Monitor mock rows | Demo-mode only; **Deploy disabled on sample rows** (`Sample` label) |

### Phase 2 — Token desk Axiom readiness ✅
- **Dex tape buy/sell counts wired** (`lib/market/dexTapeFromSnapshot.ts`): real txn splits from DexScreener `txns{M5,H1,H6,H24}{Buys,Sells}` + **6h window** from `volumeH6`. Verified live on WIF: 24h = $820 vol / 22 buys / 34 sells.
- New `dexAggregate` flag: desk strip shows real counts, `—` for unknown USD side-split and net vol — never `$0` fakes. Ratio bar uses count ratio.
- **Holders tab label** uses `holderCountTotal`, never top-20 row count.
- **Pro traders** returns `null` (renders `—`) when `wallet_stats` has zero coverage — no more green `0`.
- **Dex Paid** renders `—` when not ingested — never asserts "Unpaid".
- **Dev tokens pane**: 24h Volume labeled correctly (was 24h data under "1h" header); ATH/liquidity/balance/PnL are null→`—` on live rows (were MC-recycled / zeros); fabricated `.tech` suffix removed.
- **Trades / Top Traders honesty**: non-indexed mints get explicit copy ("Pointer indexes the chain tape per token…", "Pointer platform trades only…") in both empty and populated states.
- WIF QA slice untouched: chain-trades / chain-top-traders / mint_swaps paths unchanged.

### Phase 3 — Search ✅
- `/api/tokens/summary` now returns latest snapshot **MC / 24h vol / liq / created_at** — recents rows show real values (verified live on WIF: $4.2K MC, $820 vol, $6.6K liq).
- Direct CA cold load verified: `/token/<WIF>` 200; resolve API validates wrong-chain/invalid with clear errors and falls back gracefully on RPC rate limits.
- No fabricated values anywhere in search.

### Phase 4 — Pulse ingestion correctness ✅ (the icon problem)
Root cause found: **socials were never persisted at Solana ingest** — `extractSocialUrlsFromAsset` existed but no caller, and pump.fun launches keep twitter/telegram/website **only in off-chain `json_uri` JSON** which nothing fetched (except pump.fun API, gated to QA mint).

Fixes:
- New `extractSocialUrlsFromRaw()` — trusted social extraction wired into `discoveryIngest` (insert **and** update backfill), so `website_url` / `telegram_url` / `twitter_handle` columns are real from row one.
- New `lib/market/offchainTokenMetadata.ts` — fetches `json_uri` (4s timeout, 64KB cap) for visible Pulse rows missing socials; merges + persists. Runs in `enrichPulseBundlesWithMetrics` (pool 6, max 16/cycle).
- **Website trust filter hardened**: helius / shdw-drive / irys / pinata / dweb hosts and direct image/json asset URLs can never render as the globe icon. The globe now means a real project website.
- Result: rows show the **correct icon set** — X profile/tweet icons when real links exist, globe only for trusted sites, search icon as a search action.

### Phase 5 — Portfolio resilience ✅
- `fetchUsdPricesForMints` **never throws**: one retry with backoff on 429/5xx, 10-min last-good stale cache per mint, then null prices.
- The `Could not load portfolio jupiter_price_http_429` full-page failure is gone — portfolio degrades to SOL-only / `—` marks.

### Phase 6 — Dead UI cleanup ✅
| Surface | Fix |
|---------|-----|
| Topbar → Feature updates | Now opens the modal (was a silent no-op) |
| Bottom bar Docs → `/pulse` | Removed until real docs exist |
| Wallet tracker TESTER toasts | `NODE_ENV === 'development'` only |
| Watchlist Charts/Linked icons | Removed (were toast-only) |
| Points Benefits "Trade" → `/` | → `/pulse` |
| Campaign Radar | "Preview" badge; toast-stub CTAs removed |
| Perps Long/Short | Disabled + "Perps execution coming soon" (markets/quotes stay live) |
| Stocks trade CTA | Disabled + preview copy |
| Squads | Hub-wide Preview banner; hardcoded "Invites (3)" removed |
| Wallets manage Delete | Removed (archive is the supported path) |
| X Monitor sample Deploy | Disabled, labeled `Sample` |

### Phase 7 — Wallet intel honesty ✅
Covered in Phase 1: no demo positions in live, no synthetic charts, no placeholder PnL, funding/labels real or `—`.

### Phase 8 — Indexer expansion ⏸ NOT STARTED (by design)
Deliberately deferred per prompt ("only after 0–7 are stable"). See *Remaining work*.

---

## Live verification (dev server, real data)

| Check | Result |
|-------|--------|
| WIF token page cold load | 200 |
| WIF extended metrics | top10 17.01% (adjusted) / 93.42% raw, dev 0%, **6h/24h dex tape with real buy/sell counts**, honest nulls everywhere else |
| WIF holders API | 200, 20 rows + classifications |
| Token summary (search) | Real MC/vol/liq |
| Pulse feed | 200 |
| Search resolve (WIF CA) | 200 → `/token/...` |
| Twitter profile (blknoiz06) | **Live**: Ansem, 940,249 followers, real avatar — no mock |
| SOL spot price | 200 via Jupiter |
| Typecheck | clean |
| Tests | 172/172 |

---

## ENV / external services you need (action items for you)

These are things **you** can go do — each one directly unlocks data:

1. **`POINTER_QA_MINT_ONLY` — unset it (or set `0`) for founder beta.**
   While it's `1`, holder/pump/socials enrichment only runs for WIF. This is the #1 reason other Pulse rows show `—` everywhere. Cost impact: more Helius/Moralis/pump.fun calls for visible rows (bounded: max 28 holder + 20 pump + 16 json per feed cycle).

2. **`MORALIS_API_KEY` — required for total holder counts.**
   WIF currently returns `holders: null` (renders `—`) because Moralis total isn't available. Free tier works for testing; paid tier for beta volume. Alternative: `POINTER_HOLDER_GPA=1` (heavy RPC, only with a good Helius plan).

3. **Helius plan** — the swap indexer expansion (Phase 8) and webhook ingest scale with your Helius credits. Current single-mint QA indexer is fine on a dev plan; indexing top-N Pulse mints will need the **Developer/Business tier** (webhooks + enhanced tx API rate).

4. **`JUPITER_API_KEY`** — recommended. You hit `429`s without it; retry + stale cache now masks failures, but a key removes them at the source ([portal.jup.ag](https://portal.jup.ag)).

5. **`ETHOS_API_KEY`** — optional. Without it, Ethos badges are now simply hidden (no more fake scores). Set it if you want squads reputation live.

6. **Founder beta env block** (`.env.local`):
   ```env
   NEXT_PUBLIC_FOUNDER_BETA=1
   POINTER_QA_MINT_ONLY=0          # let enrichment run for all visible rows
   MORALIS_API_KEY=...             # holder totals
   JUPITER_API_KEY=...             # no more 429s
   # Must NOT be set: NEXT_PUBLIC_UI_DEMO_MODE, NEXT_PUBLIC_POINTER_SANDBOX_MODE
   ```

7. **Supabase**: after any future DDL, run `scripts/reload-postgrest-schema.sql` (existing rule, no schema changes were made in this pass).

---

## Remaining P0s

1. **Chain tape beyond WIF (Phase 8).** Trades/Top-Traders/holder-PnL for non-QA mints are now *honestly labeled* but still empty. The MVP indexer (top-N active Pulse mints via Dex pair discovery → `mint_swaps`) is the single biggest remaining gap vs Axiom. ~2–4 weeks of work, needs the Helius plan above.
2. **`wallet_stats` backfill.** Pro traders / win-rate intel now show `—` honestly, but populating the table (cron from indexed swaps) is needed to light them up.
3. **Manual Phantom E2E** — login → 0.001 SOL buy → sell → portfolio. The code path is unblocked and quote/execute APIs are live, but only you can sign with Phantom. Use the checklist in `docs/founder-beta-readiness-report.md`.

## Remaining P1s

- `is_paid` (Dex Paid) has no ingest writer — currently honest `—`.
- Insiders / bundlers / LP-burned need on-chain analysis to ever show values (honest `—` today).
- Token `created_at` is DB-ingest time, not chain launch time (WIF row says "13m" because the row was re-created today). Needs chain-launch timestamp ingest.
- Realtime is poll-based (~15s); SSE/websocket tape post-indexer.
- Squads/Championship/Stocks remain preview surfaces (clearly labeled now).

---

## Founder beta status

**READY FOR SUPERVISED FOUNDER BETA** — with the env items above and the manual Phantom E2E.

What is true now that wasn't before:
- Zero fabricated numbers in live mode (enforced by tests).
- Every button either works, is disabled with honest copy, or is gone.
- WIF desk is the canonical proof; every other desk degrades honestly instead of lying.
- Pulse ingestion persists real socials → correct icons per token.
- Portfolio survives Jupiter rate limits.
- Demo/sandbox cannot leak into founder beta even via localStorage.

What still separates Pointer from Axiom in *capability* (not honesty): general chain tape indexing (Phase 8) and wallet-stats intelligence. Those are data-pipeline projects, not UI fixes — everything visible is now truthful while they're built.
