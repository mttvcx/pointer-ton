# Wallet Data Inventory Report

Generated: 2026-06-12  
Scope: Full repo search for KOL / smart / tracked wallet lists (read-only inventory).

## Executive answer

| Question | Answer |
|----------|--------|
| Do we have hundreds of KOL wallets committed? | **No — 12 identity seed rows** across 4 JSON files |
| Are hundreds hidden elsewhere? | **No** — largest address lists are **demo/layout** (53) and **starter trackers** (20), not KOL registry |
| Are they demo-only? | **Partially** — mock KOL directory (5), kolHandlesLocal (21), demoPulseBundles (53) are demo/local |
| Starter trackers vs KOL registry? | **Separate** — `starterWalletPacks.ts` seeds `tracked_wallets` per user, not identity registry |
| Step to make hundreds live? | **Bulk import** via `POST /api/identity/import` (now persists to Postgres) + optional commit to `data/identity/*.json` |

---

## 1. Committed identity registry (KOL / GMGN / Kolscan)

| File | Rows | SOL | EVM | TON | Type | In registry? | Persisted DB? |
|------|------|-----|-----|-----|------|--------------|---------------|
| `data/identity/solana-kolscan-seed.json` | **5** | 5 | 0 | 0 | KOL (kolscan) | Yes (boot) | Only after import/migration |
| `data/identity/eth-gmgn-seed.json` | **3** | 0 | 3 | 0 | KOL/smart (gmgn) | Yes | Only after import |
| `data/identity/base-gmgn-seed.json` | **2** | 0 | 2 | 0 | KOL (gmgn) | Yes | Only after import |
| `data/identity/bnb-gmgn-seed.json` | **2** | 0 | 2 | 0 | KOL (gmgn) | Yes | Only after import |
| **Total** | **12** | 5 | 7 | 0 | KOL/smart seeds | Yes | `identity_profiles` + `identity_wallets` when imported |

Git: all 4 files **tracked** (`git ls-files data/identity` → 4).

Loaded by: `lib/identity/registry.ts` at bootstrap (bundled JSON).

---

## 2. Demo / mock wallet intelligence (not live KOL registry)

| File | Unique addresses | Chain mix | Purpose | Live UI? |
|------|------------------|-----------|---------|----------|
| `lib/walletIdentity/mockRecognizedWallets.ts` | **5** SOL | SOL | Demo directory; `getRecognizedWallet(..., { demo: true })` only | **No** in founder/live (gated) |
| `lib/dev/demoTokenFixtures.ts` | **10** SOL (+ generator) | SOL | Synthetic traders/holders/trades for layout | Demo tables only |
| `lib/dev/demoPulseBundles.ts` | **53** (24 SOL + 29 EVM) | SOL/EVM | Pulse bundle demo wallets | Demo only |
| `lib/dev/demoWalletIntelRows.ts` | **4** SOL mints | SOL | Share PnL / dossier demo positions | Demo only |
| `lib/track/kolHandlesLocal.ts` | **21** (12 TON + 6 SOL + 3 EVM) | TON/SOL/EVM | Track automation KOL tab; **localStorage** | Demo/local; not identity registry |
| `lib/solana/cexFundingWallets.ts` | **7** SOL | SOL | CEX funding labels for desk | Funding labels, not KOL |
| `lib/trackers/starterWalletPacks.ts` | **20** (5×4 chains) | SOL/BNB/Base/TON | Starter **tracked** wallets on first auth | → `tracked_wallets` table, **not** KOL registry |

**Overlap:** 5 SOL addresses appear in both Kolscan seeds and mockRecognizedWallets/starter packs (same demo cohort: Doji, Sheep, etc.).

---

## 3. Starter tracked wallets (watchlist, not KOL labels)

| Source | Wallets | Chains | Persisted? | Shown in live UI? |
|--------|---------|--------|------------|-------------------|
| `lib/trackers/starterWalletPacks.ts` | **20** | sol×5, bnb×5, base×5, ton×5 | Yes → `tracked_wallets` on auth sync | Tracker dock / “Tracking” filter |
| User-added trackers | N/A | all | Supabase `tracked_wallets` | Yes |

Not wired to identity registry unless address also in seeds/imports.

---

## 4. Supabase tables (wallet-related)

| Table | Purpose | Typical row count (expected) | KOL data? |
|-------|---------|------------------------------|-----------|
| `identity_profiles` | KOL display profiles | 0 until import/migration | Yes (after import) |
| `identity_wallets` | Chain+address → profile | 0 until import | Yes (after import) |
| `tracked_wallets` | Per-user watchlist | Per user (starter + manual) | Tracked, not KOL |
| `wallet_labels` | User-renamed wallets | Per user | Renamed, not KOL |
| `wallet_stats` | Global pro-trader stats | 0 until cron backfill | Smart/pro flags |
| `mint_wallet_stats` | Per-mint PnL | Indexer-populated | Desk stats |
| `mint_swaps` | Chain tape | Indexer-populated | Trade tape |

Schema DDL: `scripts/identity-schema.sql`, `scripts/bootstrap-phase1-core.sql`.

---

## 5. Import / provider paths

| Path | Formats | Persists? |
|------|---------|-----------|
| `POST /api/identity/import` | seed, kolscan, gmgn, manual_json, **csv**, **axiom**, **terminal** | **Yes** (Postgres + memory) |
| `lib/identity/providers/kolscan.ts` | Kolscan JSON paste | Via import API |
| `lib/identity/providers/gmgn.ts` | GMGN JSON (SOL+EVM) | Via import API |
| `lib/identity/providers/manualImport.ts` | JSON + CSV | Via import API |
| `lib/identity/providers/axiomTerminal.ts` | Axiom/Terminal manual lists | Via import API |

No runtime scraping. User-provided exports only.

---

## 6. Repo-wide address scan (unique counts)

Automated scan of `*.json,*.ts,*.tsx,*.sql,*.md` (excluding node_modules/.next):

| Chain | Unique addresses in repo |
|-------|--------------------------|
| Solana | **139** |
| EVM | **45** |
| TON | **16** |

Top files by address count: `demoPulseBundles.ts` (53), `starterWalletPacks.ts` (26), `kolHandlesLocal.ts` (23) — all demo/starter, not bulk KOL registry.

---

## 7. Live UI wiring (pre-fix audit vs now)

| Surface | Before | After implementation pass |
|---------|--------|----------------------------|
| Wallet hover / `WalletIdentityAnchor` | 12 seeds via registry | Same + DB imports via `/api/identity/lookup` |
| KOL/Smart desk filters | **Broken** (mock only, demo flag off) | **Fixed** — `recognizedWalletFromRegistry` |
| Top Traders / Holders labels | Seeds only on client | Seeds + server lookup for imports |
| Tape TRACKED/KOL | Tracked = user list; KOL = registry | Same, filters fixed |
| Tracker buy/sell toasts | Demo only | **Real** via webhook + cron + alert bridge |

---

## 8. Why “hundreds expected” doesn’t match repo

1. **No bulk Axiom/Terminal/GMGN/Kolscan exports** were committed — only 12 curated seeds.
2. **kolHandlesLocal** (21) and **starterWalletPacks** (20) look like KOL lists but serve Track demo / tracked watchlists.
3. **demoPulseBundles** (53) inflates address counts but is Pulse layout demo.
4. Historical work likely targeted **import paths** and **UI**, not checking in large wallet JSON packs.

---

## 9. Exact step to get hundreds live

1. Export wallet list from Kolscan / GMGN / Axiom / Terminal (JSON or CSV).
2. `POST /api/identity/import` with founder auth + format (`kolscan` | `gmgn` | `csv` | `axiom` | `terminal`).
3. Rows persist to `identity_profiles` + `identity_wallets` and hydrate in-memory registry on server.
4. Optional: commit normalized JSON under `data/identity/` for build-time bootstrap.
5. Run `scripts/identity-schema.sql` + `scripts/reload-postgrest-schema.sql` if tables missing.

---

## 10. Files searched (no hidden bulk KOL pack found)

- `data/identity/*.json` — 12 rows only
- `data/` — no other wallet lists
- `scripts/*.sql` — schema only, no seed inserts for KOL
- `lib/trackers/`, `lib/track/`, `lib/dev/`, `lib/walletIdentity/`
- `tests/`, `docs/`, `public/`, `.cursor/` — no bulk lists
- No untracked wallet JSON packs in workspace (except `.dev-server.log`)

**Conclusion:** The audit figure of **12 committed identity seeds is correct.** Hundreds are **not** hidden; they must be **imported** by the founder.
