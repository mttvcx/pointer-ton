# POINTER — Founder Beta Readiness Audit

**Date:** 2026-06-07  
**Repo:** `pointer-ton` (Next.js 16, Solana-first)  
**Auditor lens:** Founder / staff engineer / QA / Axiom power user  
**Scope:** Full codebase — frontend, backend, ingestion, APIs, DB, caches, env, routes  
**Excluded:** TradingView Advanced Charts gaps (marked *Deferred: Advanced Charts*)

---

## Executive summary

Pointer has a **credible vertical slice** for one QA mint (WIF pump): Pulse discovery, DexScreener snapshots, Moralis/RPC holders, optional QA swap indexer, Jupiter buy/sell, and a polished Pulse UI shell. **Founder beta for general Solana trading is not production-safe today** because:

1. **Misleading data** is shown on non-QA paths (synthetic TF %, hash-based search stats, invented dev stats, wallet intel demo rows).
2. **Core Axiom desk metrics** are stubbed or QA-only (chain tape, top traders, holder PnL, insiders/bundlers/LP, snipers aggregate, pro traders, dev tokens).
3. **Large product surfaces** are demo/toast-only (Perps execution, Squads, Championship, Stocks, much of Points).
4. **Operational fragility** (Jupiter 429, empty `wallet_stats`, Redis required in prod, ingest timeouts).

**Verdict:** **NO** — with conditions listed in Readiness Score.

---

## P0 — Founder Beta Blockers

### P0-1: Synthetic trade performance % on non-QA token desks

**Severity:** P0  
**Area:** Token desk / Buy panel  
**Description:** When Dex `extended_metrics` lacks price-change fields, `pickTokenTradePerfChanges` fabricates deterministic % per mint/TF via `syntheticPct()`. Default `allowSynthetic: true`. Only disabled for QA live desk mint. Users see fake green/red TF chips beside real vol/buys/sells labels.  
**Reproduction:** Open any non-QA Sol token with Dex snapshot but incomplete nested price fields → Buy panel TF hover shows non-zero % that does not match market.  
**Root cause:** `lib/tokens/tokenTradePerfTfs.ts` (`syntheticPct`, `pickTokenTradePerfChanges`); `components/tokens/BuySellPanel.tsx` passes `allowSynthetic: !isQaDeskLiveModeClient(mint)`.  
**Recommended fix:** Default `allowSynthetic: false` everywhere; show `—` when Dex fields missing; optional dev-only flag.  
**Estimated effort:** S (0.5d)  
**Confidence:** High

---

### P0-2: DevSection invents creator stats when API returns null

**Severity:** P0  
**Area:** Token desk / Dev analytics  
**Description:** `DevSection` calls `syntheticCreatorDev(creatorWallet)` whenever `dev` prop is null but a creator wallet exists. Displays plausible-looking deploy/migration stats that are **not** from DB or chain.  
**Reproduction:** Token with `creator_wallet` but no `dev_wallet_stats` row → Creator panel shows synthetic numbers without “demo” label.  
**Root cause:** `components/tokens/DevSection.tsx` lines 23–27; `lib/dev/demoTokenFixtures.ts` `syntheticCreatorDev`.  
**Recommended fix:** Show empty state or loading; never synthesize outside `demoTablesEnabled()`.  
**Estimated effort:** S (0.5d)  
**Confidence:** High

---

### P0-3: Wallet intel always opens with `rowDemo: true`

**Severity:** P0  
**Area:** Wallet analytics / Track / Portfolio  
**Description:** All wallet intel entry points pass `rowDemo: true`, merging `demoWalletPositions` into API responses. Users see fake positions mixed with real RPC balances.  
**Reproduction:** Trackers → click wallet → intel modal shows demo positions. Same from Portfolio, Pulse popover “Track”, `WalletIdentityAnchor`.  
**Root cause:** `store/walletIntelStore.ts`; `components/trackers/TrackersPanel.tsx`; `components/portfolio/PortfolioDashboard.tsx`; `components/wallet/identity/WalletIdentityAnchor.tsx`; `components/tokens/PulseRichPopovers.tsx`; `lib/dev/demoWalletIntelRows.ts`.  
**Recommended fix:** `rowDemo: false` in production; gate demo merge behind `isUiDemoMode()`.  
**Estimated effort:** S (1d)  
**Confidence:** High

---

### P0-4: Global search invents MC/vol/liq from address hash

**Severity:** P0  
**Area:** Search  
**Description:** When live token summary fields are zero/missing, `hashRowMetrics` / `enrichSummary` derive fake MC, volume, liquidity, age, safety from mint hash. Search rows look populated but are **fabricated**.  
**Reproduction:** Global search → mint with sparse DB → row shows non-zero MC/vol.  
**Root cause:** `components/layout/GlobalSearchModal.tsx`; `components/layout/SearchTokenRow.tsx`.  
**Recommended fix:** Show `—` or skeleton; never hash-synthesize in live mode.  
**Estimated effort:** S (0.5d)  
**Confidence:** High

---

### P0-5: Chain tape / top traders / holder PnL limited to QA mint only

**Severity:** P0  
**Area:** Token desk / Ingestion  
**Description:** `/api/tokens/[mint]/chain-trades`, `chain-top-traders`, live dev-tokens return **403 or empty** for non-QA mints. Non-QA desks show platform `trades` only (usually empty) and em-dash holder columns. Users expect Axiom-style chain activity for **every** Pulse token.  
**Reproduction:** Open popular non-QA pump token → Trades tab empty; Top Traders ranks only Pointer fills; Holders bought/sold/PNL all `—`.  
**Root cause:** `isPointerQaMint()` gates in API routes; `lib/indexer/qaMintIngest.ts`; `lib/hooks/useMintTrades.ts`.  
**Recommended fix:** Generalize swap indexer beyond QA mint (rate-limited, pool discovery via DexScreener); or clearly label “Platform trades only” until indexed.  
**Estimated effort:** L (2–4 weeks)  
**Confidence:** High

---

### P0-6: Dex vol fallback shows 0 buys/sells while vol > 0

**Severity:** P0  
**Area:** Token desk tape  
**Description:** `dexTapeFromSnapshot` maps Dex volume windows but sets buys/sells/net to **0**. UI renders vol with zero activity split — misleading vs Axiom. Dex **does** expose txn buy/sell counts in `dexPairExtendedMetrics` but they are unused.  
**Reproduction:** Non-QA token with Dex snapshot → Buy panel 1h shows `$X` vol, `0` buys, `0` sells.  
**Root cause:** `lib/market/dexTapeFromSnapshot.ts`; `lib/tokens/tokenTradeTapeByTf.ts`.  
**Recommended fix:** Wire `txnsM5Buys/Sells`, `txnsH1Buys/Sells`, etc. from `lib/market/dexPairMeta.ts` into dex tape.  
**Estimated effort:** M (2–3d)  
**Confidence:** High

---

### P0-7: TOKEN INFO grid: insiders, bundlers, LP burned permanently null

**Severity:** P0  
**Area:** Token desk / Extended metrics  
**Description:** `getTokenExtendedMetrics` hardcodes `insidersPct`, `bundlersPct`, `lpBurnedPct`, `taxPct` to `null`. UI shows `—` for every token. Axiom shows these (or proxies). Pulse row metric pills read same fields → barred out.  
**Reproduction:** Any token desk → TOKEN INFO → SNIPERS H / INSIDERS / BUNDLERS / LP BURNED mostly `—`; PRO TRADERS often `0`.  
**Root cause:** `lib/onchain/tokenMetrics.ts` Phase 2 stubs; no writer for bundlers/insiders/LP.  
**Recommended fix:** Phase 1 minimum: LP burn from pool account; bundler heuristic from launch txs; label honestly if unavailable.  
**Estimated effort:** L (1–2 weeks per metric class)  
**Confidence:** High

---

### P0-8: `wallet_stats` table never populated — pro traders ≈ 0

**Severity:** P0  
**Area:** Pulse strip / Token header / Extended metrics  
**Description:** `countProTraders` queries `wallet_stats` for holder wallets with win_rate/trades thresholds. `upsertWalletStats` exists but **no app code writes** to the table. Pro trader counts are almost always 0.  
**Reproduction:** WIF or any token → trophy stat `0` or `—` despite active trading wallets in holder set.  
**Root cause:** `lib/onchain/countProTraders.ts`; `lib/db/wallets.ts` `upsertWalletStats` unused.  
**Recommended fix:** Backfill job from indexed swaps or external wallet intelligence; or rename metric until real.  
**Estimated effort:** L (1–2 weeks)  
**Confidence:** High

---

### P0-9: Portfolio Jupiter price failures surface as hard errors

**Severity:** P0  
**Area:** Portfolio  
**Description:** Portfolio USD marks use Jupiter Price v3. HTTP **429** throws `jupiter_price_http_429` — user sees red banner “Could not load portfolio” while partial data may exist.  
**Reproduction:** Rate-limit Jupiter during portfolio load → error banner, empty PnL chart.  
**Root cause:** `lib/jupiter/priceTickers.ts`; `app/api/portfolio/route.ts`; `lib/portfolio/buildSnapshot.ts`.  
**Recommended fix:** Retry/backoff; stale price cache; degrade gracefully (show SOL-only).  
**Estimated effort:** M (2d)  
**Confidence:** High

---

### P0-10: Twitter profile mock fallback without “simulated” chrome

**Severity:** P0  
**Area:** Pulse social / X hover  
**Description:** FixTweet failure falls back to `mockTwitterProvider` with hash-derived follower counts. Pulse footer and hover cards can show **wrong follower numbers** without indication.  
**Reproduction:** FixTweet outage or unknown handle → followers look real (e.g. deterministic stub).  
**Root cause:** `lib/twitter/profileProvider.ts`; recently added FixTweet path still falls back to mock.  
**Recommended fix:** Show loading/`—`; never mock in live mode; cache successful profiles.  
**Estimated effort:** S (1d)  
**Confidence:** High

---

### P0-11: Ethos reputation uses mock when API key missing

**Severity:** P0  
**Area:** Squads / Reputation  
**Description:** `lookupEthosByKey` returns `mockEthosSnapshot` without `ETHOS_API_KEY`. Squads discovery shows fake scores as if live.  
**Reproduction:** Squads → Discover → Ethos badges on traders without API key configured.  
**Root cause:** `lib/ethos/client.ts`.  
**Recommended fix:** Hide Ethos UI or show “unavailable”; require key in prod.  
**Estimated effort:** S (0.5d)  
**Confidence:** High

---

### P0-12: Non-QA top traders ranks platform fills, not chain

**Severity:** P0  
**Area:** Token desk  
**Description:** `/api/tokens/[mint]/top-traders` FIFO on Pointer `trades` table (30d). For tokens users discover on Pulse, this is **empty or misleading** vs Axiom chain PnL ranking.  
**Reproduction:** Non-QA token with on-chain volume → Top Traders tab empty or only shows users who traded via Pointer.  
**Root cause:** `app/api/tokens/[mint]/top-traders/route.ts`; `useMintTrades` routing.  
**Recommended fix:** Same as P0-5 — chain indexer or honest empty state copy.  
**Estimated effort:** L (dependency on indexer)  
**Confidence:** High

---

### P0-13: Sandbox mode can intercept live trades

**Severity:** P0  
**Area:** Trading  
**Description:** `NEXT_PUBLIC_POINTER_SANDBOX_MODE` or `localStorage pointer-sandbox-mode` routes buys through fake executor with `SANDBOX_*` tx hashes. If enabled accidentally, founders think they traded on-chain.  
**Reproduction:** Enable sandbox → buy on Pulse → no real tx.  
**Root cause:** `lib/sandbox/mode.ts`; hooks intercept in `useSpotTradeExecution.ts`, `usePulseQuickBuy.ts`.  
**Recommended fix:** Block sandbox when `NEXT_PUBLIC_FOUNDER_BETA=1`; prominent persistent banner; prod build guard.  
**Estimated effort:** S (0.5d)  
**Confidence:** High

---

### P0-14: UI demo mode can be toggled via localStorage

**Severity:** P0  
**Area:** Global  
**Description:** `pointer-ui-demo` in localStorage enables synthetic Pulse rows, tables, extended metrics without rebuild. A founder browser with stale localStorage sees **fake terminal data**.  
**Reproduction:** DevTools → set `localStorage.pointer-ui-demo = '1'` → reload Pulse.  
**Root cause:** `lib/dev/uiDemoMode.ts`; `lib/hooks/useUiDemoMode.ts`.  
**Recommended fix:** Ignore localStorage when `NODE_ENV=production` or founder beta flag set.  
**Estimated effort:** S (0.5d)  
**Confidence:** High

---

### P0-15: Holders tab count shows top-20 rows, not total holders

**Severity:** P0  
**Area:** Token desk  
**Description:** Tab label `Holders (N)` uses `holders.length` from API (max ~20), not `holderCountTotal` from Moralis/GPA. Misstates holder count vs header stat.  
**Reproduction:** Token with 5k holders → tab may read `Holders (20)`.  
**Root cause:** `components/tokens/TokenActivityTabs.tsx`.  
**Recommended fix:** Use `holderCountTotal` in label.  
**Estimated effort:** S (0.25d)  
**Confidence:** High

---

## P1 — Major Product Gaps

### P1-1: Perps order execution not wired

**Severity:** P1  
**Area:** Perps  
**Description:** `PerpsOrderPanel` primary action hits `// TODO Phase 2: HL order signing`. Margin/balance hardcoded 0. Positions/orders tabs always empty.  
**Reproduction:** `/perps` → connect → Long/Short → nothing submits.  
**Root cause:** `components/perps/PerpsOrderPanel.tsx`.  
**Recommended fix:** Wire Hyperliquid signing or hide trade CTA with “Preview” banner.  
**Estimated effort:** L  
**Confidence:** High

---

### P1-2: Squads entire surface is sample/demo data

**Severity:** P1  
**Area:** Squads  
**Description:** Discover, inbox, room chat, recruit, LFS use `SAMPLE_TRADERS`, `DEMO_SQUADS`, toast-only actions. Subnav shows fake invite count `3`.  
**Root cause:** `lib/squads/sampleData.ts`, `lib/squads/demo.ts`, squad view components.  
**Recommended fix:** Global “Preview” ribbon; disable CTAs; or scope Squads out of founder beta nav.  
**Estimated effort:** M (UX) / L (backend)  
**Confidence:** High

---

### P1-3: X Monitor shows mock feed without strong gating

**Severity:** P1  
**Area:** Alerts / Monitor  
**Description:** `MOCK_ROWS` when no live alerts; banner exists but Deploy actions still visible. Sample handles (`elonmusk`, `sol_whale_demo`).  
**Root cause:** `components/monitor/XMonitorPanel.tsx`.  
**Recommended fix:** Disable deploy on mock rows; require live feed for auto-launch.  
**Estimated effort:** S  
**Confidence:** High

---

### P1-4: Championship empty unless demo flag

**Severity:** P1  
**Area:** Championship  
**Description:** Without `NEXT_PUBLIC_CHAMPIONSHIP_DEMO` / UI demo, leaderboard is empty copy only. Nav item still prominent.  
**Root cause:** `lib/championship/mode.ts`, `ChampionshipTerminal.tsx`.  
**Recommended fix:** Hide nav or show “Season 1 starting soon” with no fake PnL.  
**Estimated effort:** S  
**Confidence:** High

---

### P1-5: Stocks terminal fully mock provider

**Severity:** P1  
**Area:** Stocks  
**Description:** `lib/stocks/providers.ts` active provider is always mock. Order panel TODO Phase 2. Reached from Pulse equities board.  
**Root cause:** `lib/stocks/mockStocks.ts`, `StockOrderPanel.tsx`.  
**Recommended fix:** Label “Simulated”; remove from Pulse until real.  
**Estimated effort:** S  
**Confidence:** High

---

### P1-6: Dev tokens live pane mislabels 24h vol as 1h; stubs ATH/liq/PnL

**Severity:** P1  
**Area:** Dev tokens tab (QA only)  
**Description:** Live mapping sets `volume1hUsd` from `volume_24h_usd`; ATH=MC, liq=0, pnl=0.  
**Root cause:** Dev tokens pane component + API mapping.  
**Recommended fix:** Correct field labels; fetch real liq from snapshot.  
**Estimated effort:** M  
**Confidence:** High

---

### P1-7: `dexPaid` / `is_paid` never hydrated

**Severity:** P1  
**Area:** TOKEN INFO  
**Description:** Extended metrics reads `token.is_paid` but production ingest never sets it → always “Unpaid”.  
**Root cause:** No writer in pump/Dex hydrate paths.  
**Recommended fix:** Ingest pump.fun paid flag or Dex metadata.  
**Estimated effort:** M  
**Confidence:** High

---

### P1-8: Pulse STRETCH column often empty

**Severity:** P1  
**Area:** Pulse  
**Description:** Stretch column depends on bonding % + age heuristics; many sessions show “No stretch tokens yet” while NEW/MIGRATED populate.  
**Root cause:** `lib/helius/feed.ts` column filters; sparse bonding_progress in DB.  
**Recommended fix:** Tune thresholds; hydrate bonding from pump.fun on read.  
**Estimated effort:** M  
**Confidence:** Medium

---

### P1-9: Pulse row metric pills empty for most mints

**Severity:** P1  
**Area:** Pulse  
**Description:** Chef hat / target / bundlers / LP sprites read `extended_metrics` fields not populated except partial holder enrich. User screenshots show all `—`.  
**Root cause:** `components/tokens/PulseRowAxiomSpriteStrip.tsx`; `lib/tokens/pulseAxiomSpriteMetrics.ts`; incomplete `pulseMetricsEnrich.ts`.  
**Recommended fix:** Extend enrich batch; wire Dex txn splits; honest “indexing” state.  
**Estimated effort:** M  
**Confidence:** High

---

### P1-10: Wallet analytics charts partially synthetic

**Severity:** P1  
**Area:** Wallet intel  
**Description:** `buildSolAnalytics` uses illustrative chart series; `realizedPnlUsd` uses 42% placeholder split when stats missing.  
**Root cause:** `lib/wallet/buildSolAnalytics.ts`.  
**Recommended fix:** Hide charts until real series; show RPC balances only.  
**Estimated effort:** M  
**Confidence:** High

---

### P1-11: Launch / Deploy modal disabled but entry points abound

**Severity:** P1  
**Area:** Launch  
**Description:** `LaunchModal` Deploy button disabled “coming soon” but X Monitor / alerts reference deploy flows.  
**Root cause:** `components/launch/LaunchModal.tsx`.  
**Recommended fix:** Single consistent “Deploy not available” messaging.  
**Estimated effort:** S  
**Confidence:** High

---

### P1-12: Points Campaign Radar uses hardcoded opportunities

**Severity:** P1  
**Area:** Points  
**Description:** `DEMO_ECOSYSTEM_OPPORTUNITIES` always rendered; CTAs toast “coming soon”.  
**Root cause:** `components/points/CampaignRadar.tsx`.  
**Recommended fix:** Hide section or label “Preview”.  
**Estimated effort:** S  
**Confidence:** High

---

### P1-13: Feature updates menu item broken

**Severity:** P1  
**Area:** Shell / Topbar  
**Description:** Avatar → Feature updates sets menu close but never opens modal (`featureUpdatesOpen` unused).  
**Root cause:** `components/layout/Topbar.tsx`.  
**Recommended fix:** Wire `setFeatureUpdatesOpen(true)`.  
**Estimated effort:** S  
**Confidence:** High

---

### P1-14: Bottom bar Docs link points to `/pulse`

**Severity:** P1  
**Area:** Navigation  
**Description:** Docs icon navigates to Pulse, not documentation.  
**Root cause:** `components/layout/bottomBar/BottomBarStatusRail.tsx`.  
**Recommended fix:** Real docs URL or rename label.  
**Estimated effort:** S  
**Confidence:** High

---

### P1-15: Mobile blocked but tablet UX untested

**Severity:** P1  
**Area:** Responsive  
**Description:** `FounderBetaDesktopGate` blocks `<1024px` when founder flag on. No dedicated mobile layout for Pulse rows (horizontal scroll strips).  
**Root cause:** `components/beta/FounderBetaDesktopGate.tsx`.  
**Recommended fix:** Acceptable for founder beta if intentional; document clearly.  
**Estimated effort:** N/A (product decision)  
**Confidence:** High

---

### P1-16: Realtime is poll-heavy, not true live tape

**Severity:** P1  
**Area:** Realtime  
**Description:** Pulse uses TanStack Query refetch (~15s) + optional Supabase realtime on token updates; no websocket tape for trades. Axiom feels instant.  
**Root cause:** `components/tokens/PulseColumn.tsx`; `lib/hooks/usePulseMetricsHydration.ts`.  
**Recommended fix:** SSE or Supabase channel for swap inserts post-indexer.  
**Estimated effort:** L  
**Confidence:** Medium

---

### P1-17: Twitter alerts rail mock when ticker empty

**Severity:** P1  
**Area:** Alerts  
**Description:** `MOCK_TWITTER_ALERTS` fills rail; preview labeled but still visible on Pulse.  
**Root cause:** `components/tokens/TwitterAlertsRail.tsx`.  
**Recommended fix:** Collapse rail when no rules.  
**Estimated effort:** S  
**Confidence:** High

---

### P1-18: Explore only in bottom dock, not top nav

**Severity:** P1  
**Area:** Navigation  
**Description:** Discoverability gap vs Axiom’s prominent explore/discovery.  
**Root cause:** `lib/nav/navConfig.ts` vs `BottomBar`.  
**Recommended fix:** Add to top nav or rename dock label.  
**Estimated effort:** S  
**Confidence:** Medium

---

## P2 — Polish Issues

### P2-1: Inconsistent empty vs zero vs em-dash

**Severity:** P2  
**Area:** UI-wide  
**Description:** PRO TRADERS shows `0` while SNIPERS shows `—` for same missing-data semantics.  
**Recommended fix:** Standardize null display rules in `NumberDisplay` / desk formatters.  
**Estimated effort:** S  
**Confidence:** High

---

### P2-2: Native browser `title` tooltips still on some surfaces

**Severity:** P2  
**Area:** Pulse / Token desk  
**Description:** Partial fix shipped for USDC pair; `PulseRowMetaPills`, `LaunchpadBadge`, `TokenRow` tracked-dev, `RiskFlags` still use `title=`.  
**Recommended fix:** Replace with Radix/`PulseCompactHoverAbove` pattern.  
**Estimated effort:** M  
**Confidence:** High

---

### P2-3: Pulse row icon sizing drift vs Axiom

**Severity:** P2  
**Area:** Pulse  
**Description:** Multiple tuning passes; still slight mismatch on USDC chip vs feather/search icons.  
**Recommended fix:** Single `PulseStripIconScale` token.  
**Estimated effort:** S  
**Confidence:** Medium

---

### P2-4: Hover token info panel empty until row hover

**Severity:** P2  
**Area:** Pulse  
**Description:** Center panel “Hover a token row…” persists on Packs/Portfolio — irrelevant copy.  
**Recommended fix:** Route-aware empty state.  
**Estimated effort:** S  
**Confidence:** High

---

### P2-5: Wallet tracker float “TESTER” demo toasts in production UI

**Severity:** P2  
**Area:** Dock panel  
**Description:** `DockWalletTrackerFloatingPanel` exposes Demo buy/sell toast buttons to all users.  
**Recommended fix:** Gate behind debug flag.  
**Estimated effort:** S  
**Confidence:** High

---

### P2-6: Region/latency menu uses static demo values

**Severity:** P2  
**Area:** Bottom bar  
**Description:** `bottomBarRegions.ts` static `latencyMs`.  
**Recommended fix:** Hide or label “Preview”.  
**Estimated effort:** S  
**Confidence:** High

---

### P2-7: Squads top-3 cards vs compact rows layout inconsistency

**Severity:** P2  
**Area:** Squads discover  
**Description:** Visual hierarchy breaks at rank 4.  
**Recommended fix:** Unified row component.  
**Estimated effort:** M  
**Confidence:** Medium

---

### P2-8: Points Benefits “Trade” links to `/` not `/pulse`

**Severity:** P2  
**Area:** Points  
**Description:** Misleading navigation from benefits card.  
**Root cause:** `components/points/PointsDashboard.tsx`.  
**Recommended fix:** href `/pulse`.  
**Estimated effort:** S  
**Confidence:** High

---

### P2-9: Copy truncation on Pulse rows loses context

**Severity:** P2  
**Area:** Pulse  
**Description:** Long names + icon strip overflow scroll without scroll hint.  
**Recommended fix:** Fade edge + tooltip on truncated handle.  
**Estimated effort:** S  
**Confidence:** Medium

---

### P2-10: Leaf color vs token age confusion

**Severity:** P2  
**Area:** Pulse social  
**Description:** Feather colors tweet age; adjacent `9m`/`13m` is **token** age — users conflate the two.  
**Recommended fix:** Tooltip on feather explaining tweet age.  
**Estimated effort:** S  
**Confidence:** Medium

---

## P3 — Technical Debt

### P3-1: Duplicate extended-metrics fetch paths

**Severity:** P3  
**Area:** Token desk  
**Description:** `TokenInfoPanel` and `BuySellPanel` both query extended metrics (shared cache key mitigates).  
**Recommended fix:** Single provider at desk layout level.  
**Estimated effort:** S  
**Confidence:** High

---

### P3-2: `upsertWalletStats` dead code path

**Severity:** P3  
**Area:** DB  
**Description:** Writer never called; pro-trader feature non-functional.  
**Recommended fix:** Implement cron or remove metric.  
**Estimated effort:** M  
**Confidence:** High

---

### P3-3: Redis required in production — dev in-memory shim

**Severity:** P3  
**Area:** Infra  
**Description:** `lib/redis/client.ts` throws without Upstash in prod; extended metrics + holders cache fail silently in misconfig.  
**Recommended fix:** Health check on `/api/health` for Redis.  
**Estimated effort:** S  
**Confidence:** High

---

### P3-4: QA mint logic scattered across 20+ files

**Severity:** P3  
**Area:** Architecture  
**Description:** `isPointerQaMint` / `pointerQaMintOnly` duplicated at API, hooks, enrich, metrics layers.  
**Recommended fix:** Central `lib/qa/qaCapabilities.ts` matrix.  
**Estimated effort:** M  
**Confidence:** High

---

### P3-5: Moralis → RPC fallback lacks unified observability

**Severity:** P3  
**Area:** Holders  
**Description:** Silent fallback; no metric on which provider served row.  
**Recommended fix:** Log + expose in diagnostics drawer.  
**Estimated effort:** S  
**Confidence:** Medium

---

### P3-6: Orphan Squads tab components

**Severity:** P3  
**Area:** Squads  
**Description:** `MySquadsTab.tsx`, `DiscoverSquadsTab.tsx` unused.  
**Recommended fix:** Delete or wire.  
**Estimated effort:** S  
**Confidence:** High

---

### P3-7: Test coverage gaps on data correctness

**Severity:** P3  
**Area:** Testing  
**Description:** `liveDemoSafety.test.ts` guards demo flags; no tests asserting non-synthetic desk paths.  
**Recommended fix:** Add tests: `allowSynthetic: false` default; no `syntheticCreatorDev` in live components.  
**Estimated effort:** M  
**Confidence:** High

---

### P3-8: PostgREST schema cache manual reload

**Severity:** P3  
**Area:** Supabase  
**Description:** DDL changes require `scripts/reload-postgrest-schema.sql` — easy to miss in deploy.  
**Recommended fix:** CI migration checklist.  
**Estimated effort:** S  
**Confidence:** High

---

### P3-9: Edge runtime on Twitter profile route

**Severity:** P3  
**Area:** API  
**Description:** `app/api/twitter/profile/[handle]/route.ts` edge + FixTweet fetch — cold start / timeout risk at scale.  
**Recommended fix:** Node runtime + cache layer.  
**Estimated effort:** S  
**Confidence:** Medium

---

### P3-10: `docs/founder-beta-readiness-report.md` stale vs reality

**Severity:** P3  
**Area:** Docs  
**Description:** June 8 sprint doc says “Not Founder Beta Ready” for manual Phantom only — understates data honesty issues found in this audit.  
**Recommended fix:** Replace with this report as source of truth.  
**Estimated effort:** S  
**Confidence:** High

---

## Product Parity Matrix (vs Axiom)

| Feature | Pointer Status | Axiom Equivalent | Gap | Severity |
|---------|----------------|------------------|-----|----------|
| Pulse discovery (new/migrated) | Live Helius/Dex/DB feed | Pulse columns | Stretch column sparse; enrich partial | P1 |
| Token search | Live + **hash fake metrics** | Search | Fabricated stats when sparse | P0 |
| Token desk header MC/Liq/Price | DexScreener snapshot | Desk header | FDV vs MC; stale 5m+ | P1 |
| Buy / Sell (Sol) | Jupiter + Privy live | Quick buy / panel | Works; founder presets OK | — |
| Quick buy on Pulse | Live | Pulse quick buy | Works | — |
| Holders list | Moralis/RPC top 20 | Holders | Total count; PnL cols QA-only | P0 |
| Top traders | Platform trades OR QA chain | Top traders | Non-QA empty/wrong | P0 |
| Dev tokens | QA-only live list | Dev migrations | Non-QA demo/empty | P0 |
| Trades tape | QA chain OR platform | Live trades | Non-QA empty | P0 |
| Vol / Buys / Sells / Net | QA indexed OR Dex vol-only | Tape strip | 0 buys/sells with vol | P0 |
| TOKEN INFO security grid | Partial (top10, dev %) | Security panel | Insiders/bundlers/LP null | P0 |
| Pro traders | Broken (`wallet_stats`) | Pro traders | Always ~0 | P0 |
| Snipers aggregate | Null in metrics path | Snipers | QA per-wallet only | P1 |
| Dev holding % | Live holders path | Dev % | OK when creator known | — |
| Social strip (X/TG/web) | Live metadata + FixTweet | Social icons | Twitter mock fallback | P0 |
| Tweet hover card | Syndication + FixTweet | Tweet embed | Strong | — |
| Wallet tracking | Live API | Trackers | Works | — |
| Wallet intel modal | **Demo positions merged** | Wallet analytics | Misleading | P0 |
| Portfolio | Live RPC + Jupiter (429 risk) | Portfolio | Price API fragility | P0 |
| Alerts / X monitor | Rules live; feed often mock | Twitter monitor | Sample rows | P1 |
| Presets / display | Live Zustand + share | Presets | Works | — |
| Perps | UI only, no execution | Hyperliquid | Not tradable | P1 |
| Packs | Live open flow + dev test btns | — | Different product | P2 |
| Squads | Demo data | — | Not comparable | P1 |
| Championship | Empty/demo | — | Not comparable | P1 |
| Stocks | Mock | — | Simulated | P1 |
| Notifications / push | Web push API exists | Alerts | Partial | P2 |
| Realtime pulse updates | Poll + partial realtime | Instant | Slower | P1 |
| Mobile | Desktop gate | Mobile web | Blocked | P1 |
| Error handling | Mixed (portfolio hard fail) | Graceful degrade | Jupiter 429 | P0 |
| Empty states | Column-specific Pulse | Contextual | Irrelevant hover panel copy | P2 |
| Chart | Custom + Dex OHLC stub | Advanced Charts | *Deferred: Advanced Charts* | — |
| Funding / wallet funding column | QA desk / empty | Funding | Sparse | P1 |
| LP analytics | Null | LP burned | Not implemented | P0 |
| Connection resilience | RPC fallback holders | — | Jupiter no retry | P1 |
| Export wallet key | Live API | Export | Works (dangerous — gated) | — |
| Auth (Privy) | Live | Wallet connect | Works | — |
| Beta gate | Cookie + invite | — | OK for closed beta | — |

---

## Fake Data Audit

| File | Symbol / Component | Why exists | Acceptable for beta? | Action |
|------|-------------------|------------|------------------------|--------|
| `lib/tokens/tokenTradePerfTfs.ts` | `syntheticPct` | Fill missing Dex TF % | **NO** | Disable default |
| `lib/dev/demoTokenFixtures.ts` | `synthetic*` family | UI demo mode | Only if demo flag | Gate all |
| `components/tokens/DevSection.tsx` | `syntheticCreatorDev` | Always when dev null | **NO** | Remove live path |
| `lib/dev/demoWalletIntelRows.ts` | `demoWalletPositions` | Wallet intel demo | **NO** | Gate on demo |
| `store/walletIntelStore.ts` + callers | `rowDemo: true` | Demo merge | **NO** | Default false |
| `components/layout/GlobalSearchModal.tsx` | `hashRowMetrics` | Pretty search rows | **NO** | Remove |
| `lib/twitter/profileProvider.ts` | `mockTwitterProvider` | API fallback | **NO** | Fail empty |
| `lib/ethos/client.ts` | `mockEthosSnapshot` | Missing API key | **NO** | Hide UI |
| `lib/squads/sampleData.ts` | `SAMPLE_*` | Squads MVP | **NO** if nav visible | Preview banner |
| `lib/squads/demo.ts` | `DEMO_*` | Room MVP | **NO** | Preview banner |
| `components/monitor/XMonitorPanel.tsx` | `MOCK_ROWS` | Empty feed UX | **Conditional** | Strong mock label |
| `components/tokens/TwitterAlertsRail.tsx` | `MOCK_TWITTER_ALERTS` | Empty ticker | **Conditional** | Collapse when empty |
| `lib/championship/mockData.ts` | Demo bundle | Championship | OK if flag off | Hide nav |
| `lib/stocks/mockStocks.ts` | Full mock markets | Stocks product | **NO** if linked from Pulse | Label simulated |
| `lib/perps/predictionMarketsDemo.ts` | Demo predictions | Perps sidebar | **Conditional** | Already labeled |
| `components/points/CampaignRadar.tsx` | `DEMO_ECOSYSTEM_OPPORTUNITIES` | Placeholder campaigns | **NO** | Hide |
| `lib/dev/demoPulseBundles.ts` | Synthetic pulse rows | Demo mode | OK when demo off | Enforced by test |
| `lib/sandbox/*` | Fake execution | QA sandbox | OK when off | Prod guard |
| `app/page.tsx` | Marketing mocks | Landing only | **YES** | — |
| `components/packs/PacksTerminal.tsx` | Test celebration btns | Dev only | **YES** in dev | Hidden prod |
| `lib/walletIdentity/mockRecognizedWallets.ts` | KOL directory | Labels | OK when `uiDemo` | — |
| `components/tokens/PulseRichPopovers.tsx` | `STUB_SOL_USD = 85.3` | Popover USD | **NO** | Use live price |
| `lib/creators/viewCounts.ts` | Mock views | Creator portal | Env-gated | OK off prod |
| `lib/reports/submitBugReport.ts` | `mockReceipt` | Offline report | OK | — |
| `lib/onchain/tokenMetrics.ts` | null stubs | Phase 2 | **Honest** but empty | Implement or hide |
| `lib/helius/feed.ts` | `PULSE_X_HOVER_QA_MINT` | Twitter hover QA | OK in demo | — |
| `components/explore/ExploreTokensPanel.tsx` | Synthetic bubbles | Empty explore | Demo only | OK |

---

## Dead UI Audit

| File | Element | Expected | Actual | Action |
|------|---------|----------|--------|--------|
| `components/layout/Topbar.tsx` | Feature updates menu item | Open changelog modal | Closes menu only | Wire modal |
| `components/perps/PerpsOrderPanel.tsx` | Long/Short | HL order | No-op TODO | Disable + label |
| `components/stocks/StockOrderPanel.tsx` | Trade | HIP-3 order | No-op TODO | Disable + label |
| `components/launch/LaunchModal.tsx` | Deploy | Token deploy | Disabled | OK if labeled |
| `components/squads/views/RecruitSquadsView.tsx` | Apply | Persist app | Toast only | Backend or hide |
| `components/squads/views/InboxView.tsx` | Accept invite | Join squad | Toast only | Backend or hide |
| `components/points/PointsDashboard.tsx` | Referrers/Creators tabs | Leaderboards | “Coming soon” | Disable tabs |
| `components/points/CampaignRadar.tsx` | View details / Verify | Campaign actions | Toast stubs | Hide CTAs |
| `components/wallets/WalletsManage.tsx` | Delete wallet | Remove | Toast not available | Remove menu item |
| `components/layout/bottomBar/BottomBarStatusRail.tsx` | Docs | Documentation | Links `/pulse` | Fix URL |
| `components/layout/WatchlistTickerBar.tsx` | Charts / Linked | Tools | Toast coming soon | Hide icons |
| `components/trackers/TrackersPanel.tsx` | Popular handles tab | Curated list | Empty copy | Hide tab |
| `components/layout/DockWalletTrackerFloatingPanel.tsx` | Manager/KOL tabs | Tracker UI | Placeholder | Hide tabs |
| `components/layout/DockWalletTrackerFloatingPanel.tsx` | Tester toasts | Dev only | Visible | Gate debug |
| `app/(app)/admin/helius-usage/page.tsx` | Admin page | In sidebar | Orphan route | Add nav |
| `app/(app)/admin/ai-cache/page.tsx` | Admin page | In sidebar | Orphan route | Add nav |
| `components/trading/InstantTradeSettingsModal.tsx` | Several toggles | Behavior change | Persist only | Disable or implement |
| `components/tokens/TokenChart.tsx` | OHLC / TV controls | Chart tools | Partial / deferred | *Deferred: Advanced Charts* |
| `app/(app)/leaderboard/page.tsx` | Route | Leaderboard | Redirect `/points` | OK |
| `app/(app)/trackers/page.tsx` | Route | Trackers hub | Redirect | OK |
| `components/squads/MySquadsTab.tsx` | Component | Used in UI | **Orphan** | Delete |
| `components/squads/DiscoverSquadsTab.tsx` | Component | Used in UI | **Orphan** | Delete |

---

## Data Correctness Audit

| Metric | Source | Transformation | Risk | Confidence |
|--------|--------|----------------|------|------------|
| **MC (header/desk)** | DexScreener `marketCap \|\| fdv` | `ensureTokenDexSnapshot` → `token_market_snapshots` | Wrong pair; FDV inflation | Medium |
| **Price** | Dex `priceUsd` | Same | Stale | Medium |
| **Liquidity** | Dex `liquidity.usd` | Same | Wrong pool | Medium |
| **Supply UI** | DAS metadata + heuristics | `resolveTokenSupplyUi` (>1e12 ÷ decimals) | Wrong for edge mints | Medium |
| **Volume 5m/1h/24h** | Dex windows | Snapshot columns + dex tape | OK for vol magnitude | Medium |
| **Buys / Sells / Net** | QA: `mint_swaps`; else Dex **unused** | `tapeMetricsForTf` | **0 buys with vol** | High |
| **TF price change %** | Dex nested OR **synthetic** | `pickTokenTradePerfChanges` | **Fake %** | High |
| **Holder count (header)** | Moralis total / GPA / snapshot | `resolveTokenHolders` | Null if no key | Medium |
| **Holder count (tab label)** | Row array length | UI | **Wrong (top 20)** | High |
| **Top 10 %** | Adjusted holder math | LP exclusion | Top-20 sample bias | Medium |
| **Dev holding %** | Holder row or RPC | Creator match | Missing if not in top N | Medium |
| **Sniper % (grid)** | Sum holder flags | Extended metrics | **Always null** (flags null) | High |
| **Insiders / Bundlers / LP** | — | Hardcoded null | Always — | High |
| **Pro traders** | `wallet_stats` join | Top holder wallets | **Always ~0** | High |
| **Dex paid** | `token.is_paid` | Never set | Always unpaid | High |
| **PnL (portfolio)** | Platform trades FIFO | Jupiter USD | 429 breaks all | Medium |
| **Remaining % / bonding** | Token row fields | `bondingProgress` | Pump-only | Medium |
| **Funding (holder col)** | RPC batch | QA + demo | Empty non-QA | High |
| **Pulse row sprites** | `extended_metrics` | Partial enrich | Mostly — | High |
| **Twitter followers** | FixTweet / mock | Profile API | Mock fallback | Medium |
| **Dev migrate crown** | Creator token list | `listTokensByCreatorWallet` | QA enrich partial | Medium |
| **Trade MC column** | Fill price × supply | `tradeFormatting` | Static page supply | Medium |
| **Wallet intel PnL** | Mixed + **demo rows** | `rowDemo` merge | **Misleading** | High |

---

## Readiness Score

| Dimension | Score (0–100) |
|-----------|---------------|
| Product readiness | **42** |
| Engineering readiness | **58** |
| Data correctness | **35** |
| UX polish | **55** |
| Founder beta readiness | **40** |

### Would you personally let real users touch this?

**YES WITH CONDITIONS**

**Why not YES:** Synthetic desk %, dev stats, wallet intel demo rows, and search hash metrics will erode trust immediately. Non-QA tokens look broken (empty tape, dashed security grid) compared to Axiom.

**Why not NO:** Core Solana buy/sell via Jupiter, Pulse feed, Dex-backed MC/liq, holder list, Twitter embeds, trackers, and QA-mint vertical slice are real. With demo flags locked down and honest empty states, a **closed** founder cohort on desktop can test trading + Pulse UX.

**Conditions before YES:**

1. Disable all live-path synthetic data (P0-1 through P0-4, P0-10, P0-14).
2. Set `rowDemo: false` everywhere (P0-3).
3. Env lock: demo/sandbox off; Redis + Jupiter keys production-grade.
4. Scope nav: hide or banner Perps, Squads, Championship, Stocks until real.
5. Document QA mint vs general mint capability gap OR expand indexer.
6. Manual Phantom trade E2E pass (existing sprint checklist).

---

## Top 25 Founder Beta Tasks

Sorted by impact. Effort: **S** ≤1d, **M** 2–5d, **L** >1wk.

| # | Title | Severity | Effort | Dependencies |
|---|-------|----------|--------|--------------|
| 1 | Kill `syntheticPct` default on token desk | P0 | S | — |
| 2 | Remove `syntheticCreatorDev` from live DevSection | P0 | S | — |
| 3 | Set `rowDemo: false`; gate demo wallet intel | P0 | S | — |
| 4 | Remove hash-based search fake metrics | P0 | S | — |
| 5 | Wire Dex txn buy/sell into dex tape | P0 | M | dexPairMeta fields |
| 6 | Jupiter portfolio retry + graceful degrade | P0 | M | — |
| 7 | Twitter/Ethos: no mock fallback in production | P0 | S | API keys |
| 8 | Block sandbox + localStorage demo in prod builds | P0 | S | — |
| 9 | Fix holders tab count → total holders | P0 | S | — |
| 10 | Generalize swap indexer beyond QA mint (MVP: top Pulse mints) | P0 | L | Helius, DB |
| 11 | Populate or hide insiders/bundlers/LP metrics | P0 | L | On-chain analysis |
| 12 | Implement `wallet_stats` backfill OR remove pro traders UI | P0 | L | Indexer |
| 13 | Extend pulseMetricsEnrich for all visible mints (not QA-only) | P1 | M | POINTER_QA_MINT_ONLY off |
| 14 | Hide/disable Perps trade CTA until HL signing | P1 | S | — |
| 15 | Squads: preview banner + remove from top nav OR ship backend | P1 | M | Product decision |
| 16 | X Monitor: no deploy on mock rows | P1 | S | — |
| 17 | Fix Topbar feature updates modal | P1 | S | — |
| 18 | Fix Docs link + Points Trade href | P1 | S | — |
| 19 | Gate wallet tracker TESTER panel | P2 | S | — |
| 20 | Standardize null vs zero display (— vs 0) | P2 | S | — |
| 21 | Replace remaining native `title` tooltips on Pulse/desk | P2 | M | — |
| 22 | Hydrate `is_paid` from pump.fun | P1 | M | Ingest |
| 23 | Dev tokens pane: fix vol label + ATH/liq | P1 | M | — |
| 24 | Add live-mode tests (no synthesis) to CI | P3 | M | Tasks 1–4 |
| 25 | Manual founder E2E: auth → buy → portfolio → track | P0 | S | Phantom, env |

---

## Deferred: Advanced Charts

The following are **not** founder beta blockers per audit scope:

- Custom chart timeframe / indicator / fullscreen controls
- `TokenChart.tsx` Dex OHLC “coming soon” messaging
- TradingView broker integration
- Stock chart tool toasts

Replace with Advanced Charts in a follow-on milestone.

---

## Appendix: Route & API inventory (audited)

**App routes (49 pages):** Pulse, token desk, portfolio, track, packs, perps, points, squads/*, championship, explore, sandbox, admin/*, beta gate, portal, marketing `/`, wallet public, stock symbol, dev tools.

**API routes (149 handlers):** Pulse feed/metrics, token CRUD + desk endpoints, trade quote/execute, portfolio, wallet analytics, webhooks/helius, cron pulse-poll, Jupiter-adjacent pricing, Twitter profile/preview, market lighthouse, alerts, trackers, packs, admin, beta redeem, AI cascade, identity, creators, push, perps L2/markets.

**Realtime:** TanStack Query polling; Supabase realtime subscription in `PulseColumn`; no dedicated trade websocket.

**Integrations audited:** Helius (DAS, webhook, RPC fallback), DexScreener (pulse overlay, desk snapshot), Moralis (holders), pump.fun (metadata), Jupiter (quotes, prices, swaps), FixTweet/syndication (Twitter), Upstash Redis, Supabase Postgres, Privy auth, Hyperliquid (read-only markets), Ethos (optional/mock).

---

*End of report. This document supersedes `docs/founder-beta-readiness-report.md` for breadth; keep sprint checklist there until merged.*
