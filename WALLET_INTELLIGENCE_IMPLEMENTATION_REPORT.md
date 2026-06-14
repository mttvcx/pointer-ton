# Wallet Intelligence Implementation Report

Generated: 2026-06-12  
Source audit: `WALLET_INTELLIGENCE_MORALIS_AUDIT.md`  
Inventory: `WALLET_DATA_INVENTORY_REPORT.md`

## Summary

Wallet intelligence is now wired for **live founder mode**: KOL filters use the real registry bridge, imports persist to Postgres, tracked-wallet buy/sell alerts flow through Helius + cron, and `wallet_stats` has a cron writer. Moralis remains **holder-count only** (unchanged scope).

---

## Phase 1 — Live KOL/Smart/Sniper filters ✅

**Fixed:** `lib/walletIdentity/traderFilters.ts`

- Uses `recognizedWalletFromRegistry` via `resolveRecognizedForTraderFilter`
- Demo mock directory gated behind `allowDemoDirectory` (off in live)
- `TokenActivityTabs` + `HoldersTable` pass `chain` + demo gate

**Tests:** `tests/traderFilters.test.ts` (4 passing)

**Acceptance:** Seeded Kolscan wallets (e.g. Doji `9WzDX…`) match KOL/Smart filters without demo mode.

---

## Phase 2 — Persist identity registry ✅

**Added:**

- `lib/db/identityRegistry.ts` — load/upsert `identity_profiles` + `identity_wallets`
- `lib/identity/importPersisted.ts` — hydrate memory from DB + persist on import
- Schema already in `scripts/identity-schema.sql`

**Behavior:**

- Committed JSON seeds still bootstrap at build time (12 wallets)
- `POST /api/identity/import` writes Postgres + memory
- `POST /api/identity/lookup` hydrates from DB before resolve

**Acceptance:** Imports survive process restart when Postgres tables exist.

---

## Phase 3 — Bulk import ✅

**Extended:** `app/api/identity/import/route.ts`

| Format | Parser |
|--------|--------|
| `kolscan` | `parseKolscanExport` |
| `gmgn` | `parseGmgnExport` (SOL + EVM) |
| `manual_json` | `parseManualJsonImport` |
| `csv` | `parseManualCsvImport` |
| `axiom` / `terminal` | `parseAxiomTerminalExport` |

No scraping. User-pasted exports only.

**Tests:** `tests/walletIdentityImport.test.ts`

---

## Phase 4 — Tracked wallet live buy/sell ✅

**Added:**

- `lib/helius/parseTrackedWalletSwaps.ts` — swap parser from enhanced txs
- `lib/helius/trackedWalletTradeAlerts.ts` — match `tracked_wallets`, insert `tracked_wallet_trade` alerts
- `lib/helius/webhooks.ts` — processes swaps on every webhook tx
- `lib/ingest/pollTrackedWalletsJob.ts` + `/api/cron/poll-tracked-wallets` (7 min cron)
- `components/providers/WalletTrackerAlertBridge.tsx` — real toasts from alerts ticker

**Acceptance:** Tracked wallet swap → alert → wallet-tracker toast (not demo).

**Tests:** `tests/trackedWalletTradeAlerts.test.ts`

---

## Phase 5 — wallet_stats writer ✅

**Added:**

- `lib/indexer/computeWalletStatsRows.ts` — pure aggregation from `mint_swaps`
- `lib/indexer/aggregateGlobalWalletStats.ts` — upserts `wallet_stats`
- `lib/ingest/aggregateWalletStatsJob.ts` + `/api/cron/aggregate-wallet-stats` (hourly :15)

Populates: 7d/30d PnL, win rate, trade count, volume, `is_kol` from registry.

**Tests:** `tests/walletStatsAggregation.test.ts`

**Feeds:** `lib/onchain/countProTraders.ts` (honest null when empty).

---

## Phase 6 — Moralis behavior ✅ (already correct)

- `MORALIS_API_KEY` set → Moralis top holders + `totalHolders` via `fetchMoralisTokenHolderSnapshot`
- Without key → Moralis path returns `null`; falls back to Helius GPA; `holderCountTotal` null when unknown
- UI uses `holderCountTotal` for tab label, not row count (`TokenActivityTabs`)

No change to KOL intelligence scope.

---

## Phase 7 — Gate demo tracker toasts ✅

- Demo tester buttons already `NODE_ENV === 'development'` only (`DockWalletTrackerFloatingPanel`)
- Live toasts from `WalletTrackerAlertBridge` + `tracked_wallet_trade` alerts only

---

## Verification

| Check | Result |
|-------|--------|
| `tests/traderFilters.test.ts` | ✅ Pass |
| `tests/walletIdentityImport.test.ts` | ✅ Pass |
| `tests/trackedWalletTradeAlerts.test.ts` | ✅ Pass |
| `tests/walletStatsAggregation.test.ts` | ✅ Pass |
| Full `npm run typecheck` | ⚠️ Pre-existing errors in unrelated files (predictions, protocolClassify tests, dexscreener) |
| Full test suite | 203+ pass; new wallet tests pass |

---

## What works after Moralis key

- Total holder count on Solana token desk header (when Moralis returns metrics)
- Moralis-preferred top-20 holder fetch
- Pulse/header holder_count enrichment

Does **not** power: KOL labels, tracked buys, PnL, pro traders.

---

## What works after Helius webhook

- Token launch detection (existing)
- **New:** Tracked wallet swap alerts when fee payer is in `tracked_wallets`
- QA mint swap ingest (when `POINTER_QA_INDEXER` enabled)

**Cron fallback:** `/api/cron/poll-tracked-wallets` polls recent txs for up to 25 distinct tracked addresses when webhook unavailable.

---

## Registry wallet count

| Source | Count |
|--------|-------|
| Committed JSON seeds | **12** |
| Postgres (runtime) | **0+** after founder import |
| In-memory after import | seeds + imports |

See `WALLET_DATA_INVENTORY_REPORT.md` for full inventory.

---

## Remaining blockers

1. **Run DDL** — `scripts/identity-schema.sql` on Supabase if `identity_*` tables not created yet; then `reload-postgrest-schema.sql`.
2. **Bulk KOL data** — Founder must paste/import hundreds via `/api/identity/import`; not in repo.
3. **Helius webhook registration** — Tracked swap alerts need enhanced tx webhook (or rely on poll cron).
4. **wallet_stats coverage** — Requires `mint_swaps` indexed data + hourly cron; empty until indexer runs.
5. **Client-side bulk labels** — Desk filters use bundled seeds on client; full import set resolves via `/api/identity/lookup` (wire `useIdentityLookup` in desk tables for 100% client parity — optional follow-up).
6. **Pre-existing typecheck failures** — Unrelated to this pass (`predictions/fetchMarkets.ts`, etc.).

---

## Key files changed

```
lib/walletIdentity/traderFilters.ts
lib/db/identityRegistry.ts
lib/identity/importPersisted.ts
app/api/identity/import/route.ts
lib/helius/parseTrackedWalletSwaps.ts
lib/helius/trackedWalletTradeAlerts.ts
lib/helius/webhooks.ts
lib/indexer/computeWalletStatsRows.ts
lib/indexer/aggregateGlobalWalletStats.ts
lib/ingest/pollTrackedWalletsJob.ts
lib/ingest/aggregateWalletStatsJob.ts
app/api/cron/poll-tracked-wallets/route.ts
app/api/cron/aggregate-wallet-stats/route.ts
components/providers/WalletTrackerAlertBridge.tsx
vercel.json (new crons)
```
