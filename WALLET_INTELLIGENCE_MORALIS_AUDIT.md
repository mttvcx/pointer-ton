# Wallet Intelligence / Moralis Readiness Audit

**Repo:** `pointer-ton`  
**Date:** 2026-06-12  
**Scope:** Wallet labels, KOL identity, Moralis, Helius, trackers, desk UI — code audit only (no implementation).

---

## Executive answer

**Is Moralis enough?** **No.**

Adding `MORALIS_API_KEY` improves **one narrow slice**: Solana **total holder count** and **top-holder snapshots** (via Moralis Solana gateway). It does **not** turn on KOL labels at scale, tracked-wallet **live buy/sell toasts**, wallet-wide PnL, insider/bundler detection, smart-money tagging, or chain-wide wallet activity feeds.

**What else is needed?**

| Capability | Primary dependency |
|---|---|
| Total holder count (reliable) | **Moralis** (or expensive Helius GPA scan) |
| Top ~20 holders | Moralis **or** Helius RPC fallback (already works) |
| Chain trades tape / top traders / holder PnL | **Helius enhanced tx indexing** → `mint_swaps` / `mint_wallet_stats` + **cron** |
| Tracked wallet **launch** alerts | **Helius webhook** + `tracked_wallets` + `tracker_rules` |
| Tracked wallet **live swap** alerts | **Not built** — needs new webhook/indexer path |
| KOL / GMGN / Kolscan labels (Axiom-scale) | **Seed/import pipeline** — only **12 wallets** in repo today |
| User renamed wallets | **Supabase** `wallet_labels` (works) |
| User tracked wallets | **Supabase** `tracked_wallets` (works) |
| Funding / CEX source column | **Helius RPC** + hardcoded CEX map (works, best-effort) |
| Sniper badges (desk) | **Internal heuristics** on `mint_wallet_stats` (needs indexer data) |
| Insider / bundler % | **Not implemented** (always `null`) |
| Global pro-trader / smart money | **`wallet_stats` table never populated** |
| Wallet page balances | **Helius RPC** + Jupiter prices (works) |
| Wallet page PnL chart / positions PnL | **`wallet_stats` empty** + no per-wallet trade index |

---

## 1. Wallet label sources

### 1.1 Database tables (Supabase)

| Table | Purpose | Populated by |
|---|---|---|
| `wallet_labels` | Per-user rename (label, emoji, color) | `POST /api/wallet-labels`, `lib/db/walletLabels.ts` |
| `tracked_wallets` | User watchlist addresses + optional label + notify flag | `POST /api/trackers`, auth sync starter seed |
| `tracker_groups` | Grouping for tracked wallets | `lib/db/trackerGroups.ts` |
| `tracker_rules` | NL/rule conditions on a tracked wallet (launch filters) | `POST /api/trackers/rules` |
| `user_wallets` | Privy-linked trading wallets | `/api/wallets/sync-privy` |
| `wallet_stats` | Global wallet win rate, 30d PnL, trades, `is_kol`, `kol_handle` | **Schema exists; no runtime writer found** |
| `dev_wallet_stats` | Dev deployer aggregates | Read in dev panels; sparse |
| `mint_wallet_stats` | Per-mint FIFO stats from chain indexer | `backfillMintSwaps` / QA ingest → upsert |
| `mint_swaps` | Indexed chain swap legs | Helius enhanced REST backfill + webhook (QA-only path) |
| `token_holders` | Cached top-N holder rows | `resolveTokenHolders` → Moralis or Helius RPC |
| `trades` | **Pointer platform trades only** (not chain-wide) | Trade execution API |

**Not in DB:** KOL directory, GMGN/Kolscan imports, Axiom/Terminal wallet lists — all **in-memory** (see seeds below).

### 1.2 Seed / JSON files (committed)

| File | Entries | Source tag | Notes |
|---|---:|---|---|
| `data/identity/solana-kolscan-seed.json` | **5** | `kolscan` | Doji, Sheep, CENTED, Trey, Limfork.eth |
| `data/identity/eth-gmgn-seed.json` | **3** | `gmgn` | Sample EVM KOLs |
| `data/identity/base-gmgn-seed.json` | **2** | `gmgn` | |
| `data/identity/bnb-gmgn-seed.json` | **2** | `gmgn` | |
| **Total registry wallets** | **12** | | Loaded at boot into memory |

Import path: `POST /api/identity/import` (`app/api/identity/import/route.ts`) with formats `seed`, `kolscan`, `gmgn`, `manual_json` → `lib/identity/registry.ts` `importSeedRows()` (runtime only, **not persisted to Postgres**).

**No Axiom / Terminal / GMGN live API** — providers explicitly return guidance to paste JSON (`lib/identity/providers/kolscan.ts`, `lib/identity/providers/gmgn.ts`).

### 1.3 Hardcoded constants

| File | Content |
|---|---|
| `lib/solana/cexFundingWallets.ts` | **7** Solana CEX hot wallets → venue label (Coinbase, Binance, Bybit, …) |
| `lib/trackers/starterWalletPacks.ts` | **5 SOL + 5 BNB + 5 Base + 5 TON** starter addresses (overlaps kolscan seed on SOL) |
| `lib/walletIdentity/mockRecognizedWallets.ts` | **5** demo-only wallets (`getRecognizedWallet` returns `null` unless `{ demo: true }`) |

### 1.4 API routes

| Route | Role |
|---|---|
| `GET/POST /api/wallet-labels` | User rename CRUD |
| `GET/PATCH/POST/DELETE /api/trackers` | Tracked wallet list |
| `GET/POST /api/trackers/rules` | Tracker automation rules |
| `POST /api/identity/lookup` | Batch resolve registry + user labels |
| `POST /api/identity/import` | Import seed rows into memory registry |
| `GET /api/identity/search` | Search in-memory registry |
| `GET /api/tokens/[mint]/holders` | Top holders + classifications |
| `GET /api/tokens/[mint]/chain-trades` | Indexed chain tape |
| `GET /api/tokens/[mint]/chain-top-traders` | Ranked from `mint_swaps` |
| `GET /api/tokens/[mint]/desk-wallet-stats` | Per-wallet mint stats |
| `GET /api/wallet/[address]/analytics` | Wallet intel modal payload |
| `GET /api/wallet/[address]/activity` | Helius RPC tx summary (wallet page lazy load) |

### 1.5 UI consumers (identity / labels)

| Component / hook | Data source |
|---|---|
| `WalletIdentityAnchor` | `resolveWalletIdentityCore` → registry + user label + tracked + dev |
| `WalletIdentityLabel` | `resolveWalletIdentity` (registry) |
| `useWalletLabels` | `/api/wallet-labels` + local store |
| `useTrackedWalletsLookup` | `/api/trackers` |
| `useWalletIdentity` | Registry + labels + tracked; demo adds `mockWalletWideStats` |
| `useIdentityLookup` | `/api/identity/lookup` — **defined but not referenced elsewhere in app code** |
| `lib/walletIdentity/traderFilters.ts` | KOL/Smart/Sniper filters use **`getRecognizedWallet` without registry** → **broken in live mode** |

---

## 2. Moralis integration (complete inventory)

**Only implementation:** `lib/onchain/moralisTokenHolders.ts`  
**Env:** `MORALIS_API_KEY` (optional, `.env.example` line 101)  
**No other Moralis calls** in the repo (no wallet net worth, transfers, or activity endpoints).

### Endpoints used

| Moralis endpoint | Purpose |
|---|---|
| `GET solana-gateway.moralis.io/token/mainnet/{mint}/top-holders?limit=N` | Top holder balances + % of supply |
| `GET solana-gateway.moralis.io/token/mainnet/holders/{mint}` | `totalHolders`, optional `holderSupply.top10.supplyPercent` |

### Call chain

```
resolveTokenHolders (lib/onchain/resolveTokenHolders.ts)
  → fetchMoralisTokenHolderSnapshot (if MORALIS_API_KEY set)
  → else fetchSolanaTokenHolderSnapshot (Helius RPC)
  → cache Redis + persist token_holders
```

Also invoked from:

- `GET /api/tokens/[mint]/holders`
- `lib/market/pulseMetricsEnrich.ts` (cron `enrich-pulse` every 3 min)
- `lib/onchain/tokenMetrics.ts` (Token Info panel extended metrics)

### Without `MORALIS_API_KEY`

| Feature | Behavior |
|---|---|
| Moralis fetch | Returns `null` immediately (`moralisTokenHolders.ts:53-54`) |
| Top holders | **Still works** via Helius `getTokenLargestAccounts` + owner aggregation (`solanaTokenHolders.ts`) |
| `holderCountTotal` | Usually **`null`** (shown as `—` in UI). Optional full scan only if `POINTER_HOLDER_GPA=1` (expensive `getProgramAccounts`) |
| Top 10 % | Computed from top rows locally; Moralis metrics endpoint not used |
| Holders API | Returns 503 only if **both** Moralis and RPC fail |

### With `MORALIS_API_KEY`

| Feature | Expected improvement |
|---|---|
| `holderCountTotal` | Real total on-chain holder count from Moralis metrics |
| Top 10 % | May use Moralis `holderSupply.top10.supplyPercent` when present |
| Top-20 list | Moralis top-holders (up to 100) instead of RPC largest accounts |
| Pulse holder strip / Token header “Holders” | Count fills in after enrich cron |
| Token Info “Holders” metric | Same |

### Moralis does **not** provide (not wired, not in codebase)

- Wallet token balances (portfolio uses Helius + Jupiter)
- Wallet token transfers / activity feed
- Wallet net worth
- KOL labels
- Tracked wallet alerts
- Sniper / insider / bundler detection
- Wallet PnL history

---

## 3. Wallet activity pipeline

### 3.1 Tracked wallet → ingest → DB → UI

```
User adds wallet
  POST /api/trackers → tracked_wallets (Supabase)

Helius webhook POST /api/webhooks/helius
  → processHeliusWebhookBody (lib/helius/webhooks.ts)
  → parseEnhancedTransaction → token launch events
  → IF ev.creator_wallet IN tracked set:
       → insertAlert (tracked_wallet_launch | tracker_rule)
       → notifyUserWebPush
  → IF qaIndexerEnabled(): ingestQaSwapsFromEnhancedTxs → mint_swaps (QA mint only)

Cron */5 index-active-mints
  → runMultiMintBackfill → backfillMintSwaps (Helius enhanced REST)
  → mint_swaps + mint_wallet_stats (any Pulse-active Sol mint)

UI reads
  useMintTrades → /api/tokens/[mint]/chain-trades → mint_swaps
  Holders → /api/tokens/[mint]/holders → resolveTokenHolders
  Top traders → /api/tokens/[mint]/chain-top-traders
  Chart markers → listWalletMarkersForTrackedTradesOnMint → trades table (Pointer users only)
```

### 3.2 Gaps (explicit)

| Expected flow | Status |
|---|---|
| Track wallet → see their **chain buys** live in dock toast | **Not built.** `showWalletTrackerTradeToast` only used by **demo buttons** (`DockWalletTrackerFloatingPanel`, `walletTrackerToast.tsx`) |
| Track wallet → alert on **swap/buy** on any token | **Not built.** Webhook only handles **token launches** where tracked wallet is **creator** |
| Track wallet → appear in trades tape when they trade | **Works only after** mint is indexed in `mint_swaps` (cron) — no realtime per-tracked-wallet subscription |
| Track wallet → chart overlay | **Pointer trades only** (`lib/db/trackedWalletMarkers.ts`) — not chain-wide |
| Wallet page activity feed | **Helius RPC** on demand (`/api/wallet/[address]/activity`) — not tied to tracker |

### 3.3 Helius webhook requirements

| Env var | Purpose |
|---|---|
| `HELIUS_API_KEY` | RPC + enhanced REST indexing |
| `HELIUS_WEBHOOK_AUTH_TOKEN` | Authorize `POST /api/webhooks/helius` |
| `HELIUS_WEBHOOK_ID` | Registration helper (ops) |

Without webhook: launch alerts for tracked wallets **do not fire**; Pulse discovery still works via **cron** (`discover-tokens`, DAS poll).

### 3.4 Moralis polling

**Not used for wallet activity.** Moralis is only consulted during holder resolution (on-demand + enrich cron).

---

## 4. KOL / wallet identity matching

### 4.1 Resolution order (`resolveWalletIdentityCore`)

1. **User label** (`wallet_labels` or tracker label) — wins display name  
2. **`recognizedWalletFromRegistry`** → `lib/identity/registry.ts` in-memory seeds (12 wallets)  
3. **`getRecognizedWallet(..., { demo: true })`** — 5 mock wallets **UI demo only**  
4. Fallback: shortened address  

**Matching key:** `walletRegistryKey(chain, normalizedAddress)` — chain-scoped normalized address (`lib/identity/normalize.ts`).

**Chain support:** `sol`, `eth`, `bnb`, `base`, `ton` in registry lookup; desk is Sol-first for on-chain intel.

**Confidence:** Per-seed `confidence` field (0–1); shown in dossier when registry hit.

**Duplicate handling:** `detectDuplicates()` in registry (same address multi-chain, duplicate display names, duplicate Twitter) — dev/admin tooling, not user-facing.

### 4.2 Axiom-style KOL labels — readiness

| Aspect | Status |
|---|---|
| Infrastructure (registry, badges, dossier UI, import API) | **Built** |
| Production-scale seed data | **Not ready** — **12 wallets** total |
| Live Kolscan/GMGN sync | **Not built** — manual JSON import only |
| Persisted identity DB | **Not built** — restart loses runtime imports |
| KOL filter on Top Traders / Holders | **Broken in live** — filters call `getRecognizedWallet` without registry bridge (`traderFilters.ts:42,91`) |
| Display on trades/holders rows | **Works for the 12 seed addresses** via `WalletIdentityAnchor` |

---

## 5. UI readiness matrix

Legend: ✅ works live · 🟡 partial / data-dependent · 🔴 blocked · 🎭 demo/fake only

| Surface | Status | Blocker |
|---|---|---|
| **Pulse row wallet icons** | 🟡 | Registry only for 12 addresses; no Moralis |
| **Token desk tape DEV/TRACKED/YOU filters** | ✅ / 🟡 | DEV/YOU work; TRACKED = user list; tape needs `mint_swaps` cron |
| **Holders table + badges** | 🟡 | Holders from Moralis/Helius; sniper from indexer stats; funding from Helius RPC |
| **Top traders labels** | 🟡 | PnL from indexer; KOL name only if in 12-wallet registry |
| **Wallet hover cards / dossier** | 🟡 | Registry + funding scan (Helius); wide stats 🎭 in demo |
| **Track page / `/wallets`** | ✅ | CRUD tracked wallets + groups |
| **Wallet page `/wallet/[address]`** | 🟡 | Balances via Helius; PnL chart empty; activity lazy Helius |
| **X Monitor / tracker dock** | 🟡 / 🎭 | Monitor tab real; **Trades tab toasts demo**; KOL tab placeholder |
| **Funding column** | 🟡 | Helius SOL ingress scan + 7-wallet CEX map |
| **KOL / Smart / Snipers / Dev filters** | 🔴 / 🟡 | KOL/Smart/Sniper filters ignore registry; Snipers/Dev use on-chain flags when indexer ran |
| **Token Info: Holders count** | 🟡 → ✅ with Moralis | Without key: often `—` |
| **Token Info: Insiders / Bundlers** | 🔴 | Hard-coded `null` (`tokenMetrics.ts:139-140`) |
| **Token Info: Pro traders** | 🔴 | `wallet_stats` empty → `countProTraders` returns `null` |
| **Known wallet activity strip** | 🟡 | Same cache as trades desk; needs indexed swaps |
| **Wallet intel modal / Share PnL** | 🟡 | Positions from SPL balances; ranked PnL needs indexer or `wallet_stats` |

### Demo / fake paths (must not show in founder-beta / prod)

Controlled by `NEXT_PUBLIC_FOUNDER_BETA=1` or prod without `NEXT_PUBLIC_UI_DEMO_MODE=1` (`lib/dev/uiDemoMode.ts`):

| Path | What it fakes |
|---|---|
| `syntheticTradesForMint`, `syntheticTopTradersForMint`, `syntheticHoldersResponse` | Token desk tables |
| `NEXT_PUBLIC_POINTER_TABLE_DEMO=1` | Table layout demo rows |
| `mockRecognizedWallets` + `allowDemoDirectory: uiDemo` | Extra KOL identities |
| `mockWalletWideStats` | Hover dossier stats |
| `toastWalletTrackedTradeDemo` | Tracker dock buy/sell toasts |
| `XMonitorPanel` demo tweets | Monitor feed samples |
| `buildDemoWalletAnalyticsPayload` / `WalletIntelDemoPanels` | Wallet analytics modal |
| `buildDeskFundingSynth` | Holder funding column when `demoTables` |
| `holderDeskSynth` demo paths in `HoldersTable` | |

---

## 6. Cron vs webhook architecture

### Cron (Vercel `vercel.json`)

| Job | Schedule | Wallet/holder relevance |
|---|---|---|
| `/api/cron/discover-tokens` | */2 min | New tokens → Pulse (not wallet-specific) |
| `/api/cron/enrich-pulse` | */3 min | **`resolveTokenHolders`** for visible Pulse SOL tokens (Moralis if keyed) |
| `/api/cron/index-active-mints` | */5 min | **Helius enhanced tx backfill** → `mint_swaps` / `mint_wallet_stats` |
| `/api/cron/retry-failed-indexes` | */10 min | Retry failed mint index status |

Auth: `POINTER_CRON_SECRET` / `CRON_SECRET` (see `lib/ingest/cronRoute.ts`).

**Recommended cron (already partially there):** holder refresh, swap backfill, metrics enrich, index retries.  
**Missing cron:** global `wallet_stats` backfill, identity seed refresh, tracked-wallet balance snapshots (only TON enrich exists in `enrichAddresses.ts`).

### Webhook / realtime

| Path | Realtime use |
|---|---|
| `POST /api/webhooks/helius` | Token **launch** detection, migrations, tracked-wallet **launch alerts**, optional QA swap ingest |
| Client polling | Trades desk refetch 4.5s (`useMintTrades`) — not wallet-specific push |

**Should be realtime but isn't:** tracked wallet swap alerts, live tracker toasts, push on tracked wallet buy/sell.

### Retry / indexing status

| Mechanism | Status |
|---|---|
| `mint_index_status` table | ✅ Used by multi-mint backfill |
| `retry-failed-indexes` cron | ✅ |
| Webhook dedup | ✅ `claimHeliusWebhookSignature` |
| Alert delivery | ✅ `insertAlert` + `notifyUserWebPush` for **launch** events only |

---

## 7. Paid API blocker matrix

| Feature | Moralis | Helius paid / webhooks | Jupiter | DexScreener | Internal DB | Custom indexer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Total holder count | **Primary** | Optional GPA | — | — | cache | — |
| Top holders (top 20) | Preferred | **Fallback** | — | — | `token_holders` | — |
| Top 10 holder % | Helps | Computes locally | — | — | ✅ | — |
| Wallet SPL/SOL balances | — | **Yes** | prices | — | — | — |
| Wallet labels (rename) | — | — | — | — | **Yes** | — |
| KOL / public figure names | — | — | — | — | **12 seeds only** | Import pipeline |
| Funding source / CEX | — | **Yes** | — | — | CEX map | — |
| Tracked wallet live buys | — | **Need new webhook logic** | — | — | — | **Not built** |
| Smart money tags | — | — | — | — | Broken filters | Need `wallet_stats` or registry |
| Sniper detection | — | — | — | — | — | **Heuristics + mint_wallet_stats** |
| Bundler detection | — | — | — | — | — | **Not built** (Phase 2) |
| Insider detection | — | — | — | — | — | **Not built** (Phase 2) |
| Dev wallet history | — | Partial | — | — | `dev_wallet_stats` | Creator wallet match |
| Wallet PnL (global) | — | — | — | — | **`wallet_stats` empty** | Could derive from indexer |
| Wallet activity feed | — | **Yes** (RPC) | — | — | — | — |
| Token holder PnL (desk) | — | — | — | — | **`mint_wallet_stats`** | Needs cron index |
| Chain trades tape | — | **Enhanced REST + cron** | — | — | `mint_swaps` | ✅ |
| Top traders ranking | — | Same | — | — | `mint_wallet_stats` | ✅ |
| Pulse price/MC | — | DAS | — | **Yes** | snapshots | — |

---

## 8. Final deliverable answers

### 8.1 What will immediately work after adding `MORALIS_API_KEY`

1. **`holderCountTotal`** on token holders API, Token Info panel, Pulse metrics, token header — stops showing `—` for most Solana tokens.  
2. **Top-holder snapshot** may prefer Moralis over RPC largest-accounts ( richer on large tokens ).  
3. **Top 10 holder %** may use Moralis aggregate when metrics endpoint succeeds.  
4. **No change** to KOL names, tracker toasts, trades tape, sniper/insider/bundler, wallet PnL, or smart-money filters.

### 8.2 What still requires Helius paid / webhooks

1. **All Solana RPC** (balances, funding scans, wallet activity, swap backfill).  
2. **Helius enhanced transaction API** for `mint_swaps` indexing (cron every 5 min).  
3. **Helius webhook** for realtime **tracked-wallet launch** alerts and Pulse launch ingest.  
4. Optional **`POINTER_HOLDER_GPA=1`** if you want holder totals **without** Moralis (credit-heavy).  

### 8.3 What is already coded but dormant / underfed

| System | State |
|---|---|
| In-memory KOL registry + import API | Coded; **12 wallets**; not in DB |
| `POST /api/identity/lookup` | Coded; **hook unused** in UI |
| Chain trades + top traders APIs | Coded; needs **`mint_swaps` rows** from cron |
| `mint_wallet_stats` / desk PnL | Coded; needs indexer cron on that mint |
| Tracker rules + launch alerts | Coded; needs **webhook + tracked_wallets** |
| Wallet rename + tracked list | **Live** |
| Funding column + CEX map | **Live** (Helius RPC per holder row, rate-limited) |
| Sniper heuristics | Coded; needs **`first_trade_at`** in stats |
| `wallet_stats` + pro traders | Schema + readers; **no writer** |
| Insider / bundler metrics | Stub always `null` |
| Live tracker trade toasts | UI coded; **demo-only wiring** |

### 8.4 What is fake/demo and must not show in live mode

See §5. Founder-beta lock (`NEXT_PUBLIC_FOUNDER_BETA=1`) disables UI demo and table demo. **`NEXT_PUBLIC_POINTER_TABLE_DEMO=1`** still fills desk tables in dev — do not enable in production.

### 8.5 Wallet identity seed data that exists today

- **12** curated identities in `data/identity/*.json` (5 SOL Kolscan-style, 7 EVM GMGN-style).  
- **5** overlapping SOL addresses in `STARTER_WALLET_PACKS` (same addresses as seeds/mock).  
- **5** demo-only mocks in `mockRecognizedWallets.ts`.  
- **7** CEX funding addresses in `cexFundingWallets.ts`.  
- **No** Axiom/Terminal/GMGN/Kolscan live API integration.

### 8.6 Axiom-style KOL wallet labels — ready?

**Partially.** UI (badges, dossier, display names) is ready. **Data layer is not Axiom-ready:** ~12 hand-seeded wallets, in-memory only, KOL desk filters not wired to registry, no continuous import.

### 8.7 Exact next implementation steps (recommended order)

1. **Add `MORALIS_API_KEY`** in prod — unlocks holder totals (quick win).  
2. **Ensure cron + `HELIUS_API_KEY` + `POINTER_CRON_SECRET`** run in prod — unlocks trades tape, top traders, holder PnL for Pulse-active mints.  
3. **Register Helius webhook** with `HELIUS_WEBHOOK_AUTH_TOKEN` — unlocks tracked-wallet **launch** alerts.  
4. **Fix `traderFilters.ts`** to use `recognizedWalletFromRegistry` / `resolveWalletIdentity` instead of demo-only `getRecognizedWallet`.  
5. **Bulk-import KOL JSON** (Kolscan/GMGN exports) via `/api/identity/import` or expand seed files; plan Postgres persistence for identity.  
6. **Implement tracked-wallet swap webhook path** → `showWalletTrackerTradeToast` (new ingest + match against `tracked_wallets`, not creator-only).  
7. **Backfill `wallet_stats`** from indexed swaps OR repoint `countProTraders` to `mint_wallet_stats` aggregates.  
8. **Phase 2:** insider/bundler graph; remove or gate demo toasts in `DockWalletTrackerFloatingPanel`.  

---

## 9. Plain-English checklist

| Question | Answer |
|---|---|
| **Is Moralis enough?** | **No.** It mainly fixes **holder counts** and improves top-holder fetches. |
| **What else is needed?** | **Helius** (RPC, enhanced tx, webhooks), **cron indexing**, **KOL seed/import at scale**, **new work** for live tracked-wallet swap alerts. |
| **Are KOL wallets already in Pointer?** | **Only 12** seeded addresses in repo (+ 5 demo mocks). Not Axiom-scale. |
| **Can tracked wallet buys show live?** | **Not today.** Toasts are demo; webhook only alerts on **launches**, not buys. |
| **What is cron vs webhook?** | **Cron** = discover, enrich holders, backfill swaps. **Webhook** = realtime launches/migrations (+ QA swap side path). |
| **What must be paid before it works?** | **Helius** (core). **Moralis** (holder totals). Webhook URL + secrets for alerts. Jupiter/DexScreener already used elsewhere. |

---

## Key file index

```
lib/onchain/moralisTokenHolders.ts      — only Moralis client
lib/onchain/resolveTokenHolders.ts      — Moralis → Helius fallback
lib/identity/registry.ts                — in-memory KOL/GMGN seeds
lib/walletIdentity/resolveWalletIdentity.ts
lib/walletIdentity/traderFilters.ts     — KOL filter bug (demo-only lookup)
lib/helius/webhooks.ts                  — tracked launch alerts only
lib/indexer/backfillMintSwaps.ts        — Helius → mint_swaps
lib/indexer/multiMintBackfill.ts        — cron index active mints
lib/solana/deskWalletFunding.ts         — funding column (Helius)
lib/solana/cexFundingWallets.ts         — CEX labels
lib/db/wallets.ts                       — tracked_wallets, wallet_stats (unused write)
lib/walletTracker/walletTrackerToast.tsx — demo toasts only
data/identity/*.json                    — 12 wallet seeds
vercel.json                             — cron schedules
.env.example                            — MORALIS_API_KEY, HELIUS_*, CRON_SECRET
```
