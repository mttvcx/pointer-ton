# Pre-Beta Protocol / Token-Type Audit

**Project:** pointer-ton  
**Date:** 2026-06-08  
**Status:** Audit + implementation plan only — **no refactor coded yet**

---

## Executive summary

Pointer today has **three parallel, misaligned protocol systems**:

1. **Ingest `launch_pad`** — free-text string on `tokens`, written by Helius/Gecko/TonAPI pipelines (narrow, chain-bucketed on non-Solana).
2. **Pulse UI registry** — ~50 canonical `protocol_id` values in `protocolBrand.ts` / `pulseProtocolRegistry.ts`, resolved at **read time** via string heuristics.
3. **Alert taxonomy** — legacy TON buckets (`ton | dedust | stonfi | megaton`) via `padToProtocols()`, unrelated to Pulse filter IDs.

**There is no unified backend classification model.** No `protocol_id`, `token_kind`, `launch_type`, or `migration_state` columns. Pulse protocol filters run **100% client-side** after fetching unfiltered feed bundles. Most filter pills imply detection that **does not exist** on live ingested data.

**Verdict:** Not acceptable for beta if users expect protocol filters and badges to reflect ground truth. Solana launchpad detection for ~7 programs is real; everything else is partial or cosmetic.

---

## Answers to your 12 questions

| # | Question | Answer |
|---|----------|--------|
| 1 | Which protocols are actually detected at ingest? | **Solana (high trust):** pump.fun, bonk, bags, printr, moonshot, heaven, dynamic-bc via program ID (webhook) or DAS authority poll. **Solana (medium):** same pads via URI substring on DAS `json_uri`; pump.fun via DexScreener `dexId=pumpfun`. **Migration (high):** pumpswap, raydium, meteora via migration program IDs. **EVM (low):** generic `eth` / `bsc` / `base` only. **TON (low):** generic `ton` only. |
| 2 | Which protocols only exist in frontend registry? | All TON filter ids (uranus, groypad, blum, tonfun); most Sol extras (surge, soar, bonkers, liquid, believe, boop, jupiter-studio, launchlab, orca, meteora, raydium as *launch* pad); all EVM venue ids (four.meme, flap, pancakeswap, clanker, zora-*, bankr, etc.) except chain buckets. |
| 3 | Which are detected by string heuristics? | DAS URI inference (`parsers.ts`), `launchPadToProtocolId()` substring rules, `inferProtocolFromMetadata()` JSON keyword scan, `isPulseMayhemToken()` metadata walk, `protocolsFromIngestHints()` / `protocolsFromExtended()`, GlobalSearch mock hash assignment. |
| 4 | Which filters are fake/cosmetic on live data? | **BNB/Base/ETH:** four.meme, pancakeswap, clanker, zora, uniswap-v*, flap, bankr, etc. — live rows are `bsc`/`base`/`eth`. **TON:** uranus, groypad, blum, tonfun — live rows are `ton`. **Sol:** surge, soar, bonkers, liquid, believe, boop, jupiter-studio, launchlab, orca, meteora, raydium (as launch, not migration). **Mayhem** filter works only when metadata happens to contain mayhem flags. |
| 5 | Which protocol IDs can be trusted today? | **Trust:** `pump.fun`, `bonk`, `bags`, `printr`, `moonshot`, `heaven`, `dynamic-bc` when set by webhook program ID or DAS authority. **Partial trust:** same via URI heuristic; `pump.fun` via DexScreener. **Migration dest:** `pumpswap`, `raydium`, `meteora` on `migrated_to`. **Chain buckets:** `eth`, `bsc`, `base`, `ton`. **Do not trust** for filtering: everything else on live data. |
| 6 | Which token types are missing entirely? | **`token_kind`** (bonding_curve, graduated, amm_pool, offchain, native_jetton, erc20, spl), **`launch_type`**, normalized **`protocol_id`**, **`dex_id`**, **`source_confidence`**, **`classification_source`**. **`pump_fun_offchain`** — not modeled anywhere. |
| 7 | Pulse API filter by protocol server-side? | **No.** `GET /api/pulse/feed` → `listPulseFeedTokens(column, chain)` filters by **chain + column only**. Protocol filtering is `pulseBundleMatchesFilters()` in `PulseColumn.tsx` (client). |
| 8 | Token detail page — real protocol ID or UI label? | **Derived UI label.** Page loads `token.launch_pad` from DB; display uses `launchPadToProtocolId` + `resolveLaunchpadProtocolFromBundle` heuristics. No persisted `protocol_id`. |
| 9 | Alerts same taxonomy as Pulse? | **No.** Alerts use `padToProtocols()` → TON buckets. Sol `pump.fun` maps to alert bucket `ton`. Pulse uses per-chain canonical ids (`pump.fun`, `bonk`, …). |
| 10 | Swap routing uses protocol detection? | **No.** `app/api/trade/*` uses chain-level routing (Jupiter / STON.fi). `lib/pump/directSwap.ts` probes on-chain bonding curve vs AMM but is **not wired** to trade API. |
| 11 | pump normal / mayhem / off-chain / migrated separate? | **No.** Normal pump = `launch_pad: pump.fun`. Mayhem = display heuristic overlay (`mayhemMode.ts`), not separate ingest type. Off-chain = **not implemented**. Migrated = `migrated_at` + `migrated_to` columns (real) but not distinct `protocol_id` (still shows pump.fun pad). |
| 12 | PancakeSwap, Four.meme, Dedust, STON.fi, Clanker, Zora detected from source? | **No at ingest.** Only appear if metadata keyword heuristics match later. Gecko stores full pool in `raw_metadata.geckoPool` but **does not parse DEX** into `launch_pad`. TonAPI stores jetton blob; **no DEX assignment**. |

---

## Current state summary

### DB schema (today)

**Table `tokens`** (`lib/supabase/types.ts`):

| Column | Role | Typed? |
|--------|------|--------|
| `launch_pad` | Free-text protocol hint | No enum |
| `bonding_progress` | 0–100 fill | Real numeric |
| `migrated_at` / `migrated_to` | Graduation | Real (Solana webhook) |
| `raw_metadata` | Full ingest blob | JSON |
| *(missing)* | `protocol_id`, `token_kind`, `launch_type`, `migration_state`, `dex_id`, `classification_*` | — |

**Scripts:** `pulse-token-columns.sql`, `pulse-migration-run-now.sql`, `pulse-feed-indexes.sql` add bonding/migration indexes only.

### Ingest trust ladder

```
HIGH   On-chain program ID (Helius webhook, migration parse)
HIGH   DAS authority address match (solDasPoll getAssetsByAuthority)
MEDIUM URI substring on json_uri (parsers inferLaunchpadFromUri)
MEDIUM DexScreener dexId === 'pumpfun'
LOW    Generic chain bucket (eth/bsc/base/ton)
LOW    Client metadata keyword scan (never written back to DB)
```

### Critical ingest behaviors

1. **`discoveryIngest` never backfills `launch_pad`** on existing rows — only webhook fill-once.
2. **First-write wins** for `launch_pad` — later better classification is dropped.
3. **EVM Gecko** stores `geckoPool` in raw_metadata but ignores DEX relationship for classification.
4. **No re-classification job** exists.

---

## File-by-file findings

Legend: **W** = writes classification, **R** = reads/classifies, **D** = display only, **F** = filter, **H** = heuristic

### DB & schema

| File | W/R/D/F/H | Finding |
|------|-----------|---------|
| `lib/supabase/types.ts` | — | `tokens` has `launch_pad` only; no protocol enum columns |
| `lib/db/tokens.ts` | W/R | `upsertToken`, `markTokenMigrated`; `listPulseFeedTokens` scopes **chain + column**, not protocol |
| `scripts/pulse-token-columns.sql` | — | `bonding_progress`, `migrated_to` |
| `scripts/pulse-feed-indexes.sql` | — | Index on `launch_pad` (legacy string) |

### Solana ingest

| File | W/R/D/F/H | Finding |
|------|-----------|---------|
| `lib/utils/constants.ts` | — | `LAUNCHPAD_PROGRAM_IDS` (7), `MIGRATION_PROGRAM_IDS`, `LAUNCHPAD_AUTHORITIES` |
| `lib/helius/parsers.ts` | W/R | **HIGH:** `PROGRAM_TO_PAD` webhook mapping. **MEDIUM:** `inferLaunchpadFromUri`. Produces `LaunchpadEvent` |
| `lib/helius/webhookIngest.ts` | W | Writes `launch_pad`, `bonding_progress`, `raw_metadata`; fill-once `launch_pad` on update |
| `lib/helius/discoveryIngest.ts` | W | Shared upsert; **does not update `launch_pad` on existing mints** |
| `lib/helius/webhooks.ts` | W | Orchestrates webhook → ingest + `markTokenMigrated` |
| `lib/helius/migrationParse.ts` | R | **HIGH:** migration program → `pumpswap`/`raydium`/`meteora` |
| `lib/helius/solDasPoll.ts` | W | Authority poll **HIGH**; searchAssets **MEDIUM** |
| `lib/helius/feed.ts` | W | Sol DAS hydrate, cron poll, TonAPI jettons |
| `lib/helius/heliusWebhookConfig.ts` | — | Subscribed programs list |

### EVM ingest

| File | W/R/D/F/H | Finding |
|------|-----------|---------|
| `lib/evm/geckoTerminalPulse.ts` | W | **`launch_pad` = eth/bsc/base only**; stores pool/token in raw_metadata |
| `lib/ethereum/EthereumProvider.ts` | W | Wrapper → Gecko eth poll |
| `lib/chains/evmTokenChain.ts` | R/H | Chain disambiguation from `geckoNetwork` + pad hints |

### TON ingest

| File | W/R/D/F/H | Finding |
|------|-----------|---------|
| `lib/helius/feed.ts` (`jettonToTokenRow`) | W | **`launch_pad: 'ton'` hardcoded**; full TonAPI blob in raw_metadata |

### Market hydrate

| File | W/R/D/F/H | Finding |
|------|-----------|---------|
| `lib/market/dexscreenerTokenHydrate.ts` | W | **MEDIUM:** `dexId=pumpfun` → `pump.fun`; EVM → null pad |

### Classification primitives (read-time)

| File | W/R/D/F/H | Finding |
|------|-----------|---------|
| `lib/tokens/protocolBrand.ts` | R/H | Master `ProtocolBrandId` union; `launchPadToProtocolId(pad, chain)` with substring rules |
| `lib/tokens/pulseProtocolRegistry.ts` | — | Per-chain filter id lists (static catalog) |
| `lib/tokens/columnPresetModel.ts` | R/F/H | **`tokenProtocolIdsForChain`** — core client classifier; **`padToProtocols`** — alert TON buckets |
| `lib/tokens/launchpadAvatarChrome.ts` | R/D/H | Layered resolution: mayhem → mint suffix → pad → metadata JSON scan → SOL fallback `pump.fun` |
| `lib/tokens/mayhemMode.ts` | R/D/H | Mayhem detection; not ingest enum |
| `lib/tokens/pumpTokenSignals.ts` | R/D/H | Pump bonding pad list + trait glyphs |
| `lib/tokens/bondingProgress.ts` | R/F | Bonding % (protocol-agnostic) |
| `lib/tokens/pulseTechLabel.ts` | R/D | Dev QA tags from pad |
| `lib/tokens/pulseSocialLinks.ts` | R/D/H | pump.fun URL from pad or mint suffix |
| `lib/tokens/pulseRichMetadata.ts` | R/D | Strict `launch_pad === 'pump.fun'` gate |

### Pulse API & UI

| File | W/R/D/F/H | Finding |
|------|-----------|---------|
| `app/api/pulse/feed/route.ts` | — | Thin route |
| `lib/server/pulseFeedRoute.ts` | — | No protocol params |
| `app/api/pulse/column-presets/route.ts` | — | Stores filter preset ids only |
| `components/tokens/PulseColumn.tsx` | F | **Client-side** `pulseBundleMatchesFilters` |
| `components/tokens/ColumnFilterModal.tsx` | D | Protocol pill UI |
| `components/tokens/TokenRow.tsx` | D | Avatar chrome, badges, row tint |
| `components/tokens/TokenHeader.tsx` | D | Same stack on detail |
| `app/(app)/token/[mint]/page.tsx` | R/D | DB `launch_pad` → display heuristics |
| `components/tokens/LaunchpadBadge.tsx` | D | Fallback badge |
| `components/pulse/pulseDisplayProtocols.ts` | D | Row color prefs |
| `lib/pulse/pulseRecommendedSettings.ts` | F | Seeds recommended protocol filters (client) |

### Alerts

| File | W/R/D/F/H | Finding |
|------|-----------|---------|
| `lib/alerts/alertRuleModel.ts` | R/F | TON bucket schema |
| `lib/alerts/emitAlertRuleMatches.ts` | F | Server filter via `padToProtocols` |
| `lib/alerts/pulseNewTokenTypes.ts` | — | `launchpad?: LaunchpadId` (narrow ingest type) |
| `components/alerts/AlertRulesSection.tsx` | D | UI shows TON buckets only |

### Trading / routing

| File | W/R/D/F/H | Finding |
|------|-----------|---------|
| `app/api/trade/quote/route.ts` | — | Jupiter / STON.fi; no protocol |
| `app/api/trade/execute/route.ts` | — | Same |
| `lib/pump/directSwap.ts` | R | On-chain bonding vs AMM; **unused by API** |

### Demo / misleading surfaces

| File | W/R/D/F/H | Finding |
|------|-----------|---------|
| `lib/dev/demoPulseBundles.ts` | W/D | Rich synthetic `launch_pad` + `extended_metrics.protocol` — **misleading vs live** |
| `components/layout/GlobalSearchModal.tsx` | F/H | **Fake protocol** from mint hash |
| `lib/explore/exploreItemBuilder.ts` | R/H | Demo-only venue scoring |

### AI

| File | Finding |
|------|---------|
| `lib/ai/pipelines/explainToken.ts` | Passes raw `launch_pad` string to model |

---

## Current protocol trust matrix

### Solana

| protocol_id (target) | Ingest today | Read-time heuristic | Filter reliable on live? | Notes |
|---------------------|--------------|---------------------|--------------------------|-------|
| pump_fun | ✅ program ID / authority / dexscreener | ✅ | ✅ when pad set | Not split from mayhem/offchain |
| pump_fun_mayhem | ❌ | ⚠️ metadata walk | ❌ | No ingest enum |
| pump_fun_offchain | ❌ | ❌ | ❌ | **Not modeled** |
| pump migrated / pumpswap | ⚠️ `migrated_to` only | ⚠️ | ⚠️ migrated column | Pad stays `pump.fun` |
| bonk | ✅ program ID | ✅ | ✅ | |
| bags | ✅ program ID | ✅ | ✅ | |
| moonshot | ✅ program ID | ✅ | ✅ | |
| heaven | ✅ program ID | ✅ | ✅ | |
| dynamic_bc | ✅ believe DBC program | ✅ | ✅ | |
| printr | ✅ program ID | ✅ | ⚠️ authority null → URI only | |
| raydium (migration) | ✅ `migrated_to` | ✅ | ✅ migrated tab | Not launch pad |
| meteora (migration) | ✅ `migrated_to` | ✅ | ✅ migrated tab | |
| surge, soar, bonkers, liquid, believe, boop | ❌ | ⚠️ keywords | ❌ | Filter pill = cosmetic |
| jupiter-studio, launchlab, orca, meteora (launch) | ❌ | ⚠️ keywords | ❌ | |
| raydium (as launch) | ❌ | ⚠️ keywords | ❌ | |

### BNB

| protocol_id | Ingest | Live filter? |
|-------------|--------|--------------|
| bsc (generic) | ✅ Gecko | ✅ only this |
| pancakeswap | ❌ | ❌ cosmetic |
| four_meme | ❌ | ❌ cosmetic |
| flap, uniswap | ❌ | ❌ cosmetic |

### Base

| protocol_id | Ingest | Live filter? |
|-------------|--------|--------------|
| base (generic) | ✅ Gecko | ✅ only this |
| clanker, zora, bankr, … | ❌ | ❌ cosmetic |

### ETH

| protocol_id | Ingest | Live filter? |
|-------------|--------|--------------|
| eth (generic) | ✅ Gecko | ✅ only this |
| uniswap-v*, clanker, virtuals | ❌ | ❌ cosmetic |

### TON

| protocol_id | Ingest | Live filter? |
|-------------|--------|--------------|
| ton (generic) | ✅ TonAPI | ✅ only this |
| stonfi, dedust, megaton | ❌ ingest | ⚠️ if extended_metrics.dex hints |
| uranus, groypad, blum, tonfun | ❌ | ❌ cosmetic |

---

## Broken / misleading UI list

1. **Protocol filter pills (BNB/Base/ETH/TON)** — imply venue-level detection; live data is chain bucket only.
2. **Default presets** — `defaultProtocolsForChain()` selects **all** filter ids including unsupported ones.
3. **Recommended settings modal** — seeds filters for protocols not detected at ingest.
4. **Launchpad avatar chrome + corner badges** — metadata keyword scan can show Pancake/Clanker logos without ingest proof.
5. **SOL detail fallback** — `resolveLaunchpadProtocolFromBundleWithFallback` forces `pump.fun` on Sol token pages.
6. **Global search protocol filter** — entirely fake (hash-based).
7. **Demo Pulse bundles** — richer protocol data than production feed.
8. **Alert rule protocol picker** — TON buckets; useless/wrong for Sol/BNB/Base filtering.
9. **Mayhem timer badge** — can show on metadata false positives; no confidence label.
10. **Mint suffix `…pump`** — treated as pump.fun without on-chain verification.

---

## Proposed DB / schema changes

```sql
-- scripts/protocol-classification.sql (proposed)

ALTER TABLE tokens ADD COLUMN IF NOT EXISTS protocol_id TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS protocol_family TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS chain_id TEXT;  -- sol | ton | eth | bnb | base
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS token_kind TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS launch_type TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS migration_state TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS dex_id TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS classification_source TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS source_confidence NUMERIC(3,2);
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS classification_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS tokens_protocol_id_idx ON tokens (protocol_id);
CREATE INDEX IF NOT EXISTS tokens_chain_protocol_idx ON tokens (chain_id, protocol_id);
CREATE INDEX IF NOT EXISTS tokens_token_kind_idx ON tokens (token_kind);
CREATE INDEX IF NOT EXISTS tokens_migration_state_idx ON tokens (migration_state);

-- CHECK constraints (apply after backfill):
-- protocol_id, token_kind, launch_type, migration_state from allowed enums
```

**Migration strategy:**

1. Add nullable columns + indexes.
2. Run backfill job mapping `launch_pad` + raw_metadata + migration cols → new fields.
3. Update all ingest paths to call unified classifier.
4. Keep `launch_pad` read-only legacy for 1–2 releases; dual-write then deprecate.
5. Run `scripts/reload-postgrest-schema.sql` after DDL.

---

## Proposed unified classifier design

### Canonical registry (`lib/protocol/registry.ts`)

```typescript
type ProtocolDefinition = {
  protocol_id: string;           // snake_case: pump_fun, pump_fun_mayhem, four_meme
  display_name: string;
  chain_ids: AppChainId[];
  family: string;                // pump, raydium, uniswap, ton_dex, ...
  detection_methods: DetectionMethod[];
  program_ids?: string[];        // Solana
  factory_addresses?: Record<AppChainId, string[]>;  // EVM
  router_addresses?: Record<AppChainId, string[]>;
  metadata_keywords?: string[];  // fallback only, max confidence 0.4
};

type ClassificationResult = {
  protocol_id: string | null;
  protocol_family: string | null;
  chain_id: AppChainId;
  token_kind: TokenKind;
  launch_type: LaunchType;
  migration_state: MigrationState;
  dex_id: string | null;
  classification_source: string;  // helius_webhook | das_authority | gecko_pool | ...
  source_confidence: number;      // 0.0–1.0
};
```

### Single entry point

```typescript
// lib/protocol/classifyTokenProtocol.ts (server-only)
export function classifyTokenProtocol(input: ClassifierInput): ClassificationResult;
```

**Input sources (priority order):**

1. On-chain program ID / factory / pool creator (confidence 0.95–1.0)
2. Indexer-native fields (Gecko `dex` relationship, DexScreener `dexId`, Helius enriched tx)
3. DAS authority attribution
4. Structured metadata fields (not full JSON grep)
5. URI hostname rules (bounded list)
6. Keyword scan — **fallback only**, cap confidence ≤ 0.4, never overwrite higher

**Rules:**

- Classifier runs on **every ingest write** and **backfill job**.
- UI reads **`protocol_id` from DB** — heuristics only when `protocol_id IS NULL` and show "Unknown" + low-confidence badge.
- Re-classification allowed when new evidence has higher confidence.

### Enum values (proposed)

**token_kind:** `bonding_curve | graduated | amm_pool | offchain | native_jetton | erc20 | spl | unknown`

**launch_type:** `fair_launch | bonding_curve | dex_pool | creator_token | offchain_launch | migrated | unknown`

**migration_state:** `pre_migration | migrated | post_migration | unknown`

**Solana pump split logic:**

| Condition | protocol_id | token_kind | migration_state |
|-----------|-------------|------------|-----------------|
| pump program + bonding curve account | pump_fun | bonding_curve | pre_migration |
| pump program + mayhem flag (structured) | pump_fun_mayhem | bonding_curve | pre_migration |
| pump program + no on-chain mint / sentinel | pump_fun_offchain | offchain | unknown |
| migrated_to pumpswap | pump_fun | amm_pool | migrated |
| raydium/meteora migrated_to | raydium / meteora | amm_pool | migrated |

*pump_fun_offchain* requires explicit detection rule — **needs product definition + data source** (not in codebase today).

---

## External data requirements (honest gaps)

| Need | Current source | Gap | Required addition |
|------|----------------|-----|-------------------|
| Solana launch pad | Helius webhook + DAS | 7 programs only | Subscribe remaining programs; or Birdeye/Helius enriched labels |
| Pump mayhem | None at ingest | Metadata walk only | Pump.fun API field or on-chain account layout parse |
| Pump off-chain | None | Not defined | Clarify product meaning; likely off-chain metadata / non-mint asset |
| EVM DEX/protocol | Gecko new_pools | Ignores `relationships.dex` | Parse Gecko pool → dex id; map factory addresses |
| Four.meme | None | No factory ingest | Four.meme API or BSC factory event indexer |
| PancakeSwap | None | No factory | Pool `dex` from Gecko + Pancake factory allowlist |
| Clanker / Zora | None | No factory | Base factory addresses + Gecko/Basescan logs |
| TON STON.fi / DeDust | TonAPI jetton | No pool routing | TON DEX API (STON.fi / DeDust pool lookup by jetton master) |
| TON launchpads (uranus, etc.) | None | Cosmetic | Partner APIs or on-chain launch contracts |
| Confidence tracking | None | — | Column + classifier versioning |

**Gecko Terminal:** `new_pools` response includes pool → dex relationship — **already fetched, not parsed**. This alone unlocks PancakeSwap/Uniswap on BNB/ETH/Base with ~0.85 confidence.

---

## P0 / P1 / P2 checklist

### P0 — Must fix before personal beta

- [ ] **Add DB classification columns** (nullable + indexes)
- [ ] **Implement `classifyTokenProtocol()`** with registry; wire Solana webhook + DAS ingest
- [ ] **Parse Gecko pool DEX** → `protocol_id` + `dex_id` for EVM
- [ ] **Stop showing unsupported protocol filter pills** per chain (or mark "Coming soon" / hide)
- [ ] **Fix default/recommended presets** to only include detected protocols
- [ ] **Remove or gate GlobalSearch fake protocol filter**
- [ ] **Remove SOL token-page `pump.fun` fallback** when confidence low — show Unknown
- [ ] **Split pump_fun / pump_fun_mayhem** at classifier level (mayhem from structured metadata only)
- [ ] **Align migrated tokens:** set `token_kind=amm_pool`, `migration_state=migrated`, keep origin protocol
- [ ] **Document "safe to beta test"** surfaces vs not (see below)
- [ ] **Fix alert taxonomy** minimum: stop mapping Sol pads → `ton` bucket (or disable pad filter on non-TON until unified)

### P1 — Should fix before public beta

- [ ] **Server-side Pulse filtering** by `protocol_id` in `listPulseFeedTokens` / feed API
- [ ] **Backfill classification job** for existing tokens
- [ ] **Re-classify on higher-confidence evidence** (discoveryIngest updates classification)
- [ ] **Token detail protocol breakdown** panel (protocol, kind, migration, confidence, source)
- [ ] **TON:** STON.fi + DeDust pool lookup on jetton ingest
- [ ] **Wire pump direct swap** to trade API when `protocol_id=pump_fun` + bonding_curve
- [ ] **Unify alert rules** on canonical `protocol_id`
- [ ] **Demo mode banner** when `uiDemo` bundles mixed with live feed
- [ ] **Classification metrics** dashboard (unknown %, low confidence %, per chain)

### P2 — Later

- [ ] Four.meme / flap / Zora / Clanker factory-level ingest
- [ ] pump_fun_offchain (after product definition)
- [ ] Advanced routing by protocol (Pump SDK, Raydium direct, etc.)
- [ ] Pool lifecycle analytics
- [ ] Rich launchpad visuals tied to confidence tiers
- [ ] Exotic Sol launchpads (believe, boop, surge, …) via program ID expansion

---

## Estimated implementation order

| Phase | Work | Est. effort |
|-------|------|-------------|
| **1** | DDL + types + registry + classifier skeleton | 2–3 days |
| **2** | Solana ingest wiring + mayhem split + migration mapping | 2–3 days |
| **3** | Gecko DEX parse for EVM + chain_id persistence | 1–2 days |
| **4** | Pulse UI: hide cosmetic filters, read DB `protocol_id` | 1–2 days |
| **5** | Server-side feed filter + API params | 1–2 days |
| **6** | Backfill job + confidence upgrades | 2–3 days |
| **7** | TON DEX lookup (STON.fi/DeDust) | 2–4 days |
| **8** | Alerts + trade routing alignment | 2–3 days |

**Total rough:** 2–3 weeks focused for P0+P1 core.

---

## Risks

1. **False positives from keyword fallback** — must cap confidence and never display high-trust badges.
2. **Backfill load** — 1200+ pulse scan depth × classifier; batch off-peak.
3. **Gecko rate limits** — pool detail parsing adds calls; cache dex mappings.
4. **Taxonomy churn** — new launchpads weekly; registry must be data-driven config, not scattered strings.
5. **Dual-write period** — `launch_pad` vs `protocol_id` drift until backfill complete.
6. **PostgREST cache** — DDL requires schema reload script.
7. **Beta tester confusion** — demo fixtures look more capable than live feed.

---

## What can be safely beta tested today vs cannot

### ✅ Safe today

- Solana Pulse **column + chain** filtering (new / stretch / migrated)
- Solana tokens from **webhook-discovered** pads: pump.fun, bonk, bags, moonshot, heaven, dynamic-bc, printr (when pad set)
- **Migrated tab** for Solana (real `migrated_at`)
- **Bonding progress** display when column populated
- Trading via Jupiter (Sol) / STON.fi (TON) — chain-level, not protocol-aware
- PnL share, wallet intel, sandbox mode (orthogonal)

### ⚠️ Beta with caveats

- Sol **mayhem** badge/timer — heuristic, verify manually
- Sol protocol filters for pads beyond the 7 ingest programs — expect false negatives
- TON Pulse feed — tokens appear but protocol filters mostly meaningless
- EVM tokens appear — only chain-level identity

### ❌ Do not beta test as ground truth

- BNB/Base/ETH **protocol filter pills** (Pancake, Four.meme, Clanker, Zora, …)
- TON protocol pills (uranus, groypad, blum, tonfun)
- Global search protocol filter
- Alert rules by launchpad on Sol/BNB/Base
- Protocol badges on EVM/TON rows (likely keyword false positives)
- Any assumption of **pump off-chain** detection
- Protocol-aware swap routing

---

## Next step (awaiting approval)

1. Review this audit.
2. Confirm taxonomy enums + pump_offchain product definition.
3. Approve P0 scope.
4. Then implement Phase 1 (schema + registry + classifier) — no UI pretend fixes without backend columns first.

---

*Generated from codebase audit 2026-06-08. No refactor code included in this commit.*
