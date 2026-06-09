# Token Desk Indexing Audit

**Date:** 2026-06-09  
**Repo:** pointer-ton (Next.js 16, port 3001)  
**QA mint:** `GZQFCZjfzQyFSkA4jBuEeh5eKTLNzju7PZrEWxMvpump` (G7 Anchor / G7anch)  
**Audience:** Founder beta gate + ChatGPT architecture review  
**Implementation status:** QA vertical slice **shipped** (2026-06-09 backfill verified)

---

## Implementation status (QA mint vertical slice)

| Component | Status | Notes |
|-----------|--------|-------|
| `mint_swaps` + `mint_wallet_stats` tables | **Live** | `scripts/mint-swaps-indexer.sql` applied |
| Helius backfill | **Live** | `npm run backfill:qa-swaps` |
| Swap parser | **Live** | `lib/indexer/parseSwapFromEnhancedTx.ts` (PumpSwap + mint fallback) |
| Wallet stats / FIFO PnL | **Live** | `lib/indexer/deriveWalletStats.ts` |
| APIs | **Live** | `/chain-trades`, `/chain-top-traders` (QA-gated) |
| UI wiring | **Live** | QA mint uses chain APIs; holder desk from `mint_wallet_stats` |
| Synthetic live data | **Removed** | Demo only via `NEXT_PUBLIC_POINTER_TABLE_DEMO=1` |

### G7anch backfill results (2026-06-09)

| Metric | Value |
|--------|-------|
| Primary ingest target | DexScreener PumpSwap pair `8YAyrz42UK6dtDUHga58esyBzSpjqLYovj9RkLusnMA1` |
| Signatures fetched | 830 |
| Swaps parsed / inserted | **327** |
| Wallets derived | **264** |
| Top traders (ranked) | **25** |
| Helius REST calls | 11 (~22 credits est.) |
| Bonding curve PDA | 0 txs (migrated — expected) |

**Founder beta:** QA desk slice is **functional** for trades / top traders / holder PnL on G7anch only. **Not** founder-beta-ready for all Pulse mints until indexer is generalized + realtime webhook ingest.

---

## Final verdict

### Current truth

Pointer now has a **QA-scoped chain swap indexer** (Helius enhanced REST → `mint_swaps` → `mint_wallet_stats`). TradingView is **not** the intelligence layer — charting only.

**QA mint (G7anch)** desk panels fed by **real chain data:** trades tape, top traders, holder bought/sold/PnL (when wallet traded). **All other mints** still lack chain indexing.

Synthetic holder PnL and Pointer-only trade tape are **removed in live mode** (demo flag only).

### Data source matrix (summary)

| Source | Role today | Desk panels fed |
|--------|------------|-----------------|
| **TradingView** | Perps chart widget only | **None** on token desk |
| **Lightweight Charts** | Token OHLC renderer | Chart display only |
| **DexScreener** | Live price/MC/liq/vol | Header, Pulse, chart last candle |
| **Helius DAS** | Token discovery + metadata | Token row, creator hints |
| **Helius RPC** | Holder fallback, wallet funding util | Holders list (fallback) |
| **Helius webhooks** | Launch/migration parse → `tokens` upsert | Discovery only — **no swap ingest** |
| **Moralis** | Top holders + holder count | Holders, top10%, holder count |
| **pump.fun API** | Creator + socials | Dev wallet, Pulse icons |
| **Jupiter** | Spot price + swap quotes | Chart fallback, buy panel |
| **Supabase snapshots** | Persisted market + holder fields | Chart OHLC, header, Token Info |
| **Supabase `trades`** | Platform fills only | Pointer execution only — **not desk tape** |
| **`mint_swaps`** | Helius enhanced REST backfill | **QA mint trades tape** |
| **`mint_wallet_stats`** | Derived FIFO from `mint_swaps` | **QA holder PnL + top traders** |
| **holderDeskSynth** | Demo only | **Removed in live** |
| **Birdeye / Shyft / Bitquery** | **Not integrated** | — |

### Gap vs Axiom

| Axiom panel | Pointer today | Gap |
|-------------|---------------|-----|
| Live trades tape (DEV/TRACKED/YOU) | **QA: 327 chain swaps** | Generalize indexer + webhooks for all mints |
| Holder Bought/Avg/Sold/PnL | **QA: from `mint_wallet_stats`** | Wallets without swaps still show — |
| Top Traders (chain FIFO) | **QA: 25 ranked** | Same — roll out beyond QA |
| Funding / Held | Was synthetic | **No funding graph API** |
| Snipers / Insiders / Bundlers | Always null | **No detection pipeline** |
| Net volume / buy-sell split | Dex txn counts (weak) or Pointer trades | **No parsed swap aggregation** |
| Chart candles | Sparse DB snapshots | **No tick/OHLC indexer** |
| Holders + top10% | Moralis/Helius | **Mostly OK** |
| Dev tokens | QA mint live; else demo | Creator hydration OK for pump |

**How competitors do it (Axiom, Terminal/Padre, GMGN, Photon, BullX):**  
They run the same architecture:

1. **Ingest** — Geyser/Yellowstone stream, Helius enhanced webhooks, or paid indexer webhooks for every swap touching a mint.
2. **Parse** — Normalize pump.fun bonding curve buys/sells, PumpSwap/Raydium/Meteora pool swaps into `{wallet, side, token_amount, sol_amount, usd, ts, program}`.
3. **Store** — Postgres (or ClickHouse) `mint_swaps` + materialized wallet positions per mint.
4. **Derive** — FIFO cost basis, realized/unrealized PnL, top traders, net vol, sniper heuristics (first N blocks), bundler (same-slot multi-wallet), funding (SOL transfer graph).
5. **Serve** — API routes read derived tables; UI never invents numbers.

TradingView is step 6 (chart paint). The desk is steps 1–5.

### Recommended architecture

**Hybrid — Helius-first vertical slice, Birdeye-shaped API later**

```
┌─────────────────────────────────────────────────────────────────┐
│  INGEST (pick one for P0, add second for redundancy)            │
│  • Helius Enhanced Webhooks (SWAP / TOKEN_TRANSFER per mint)    │
│  • OR Helius getSignaturesForAddress on bonding curve / pool    │
│  • OR Birdeye / Shyft token tx API (paid, faster backfill)      │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  PARSE  lib/indexer/parsePumpSwap.ts                            │
│  pump.fun program + PumpSwap AMM + Raydium v4 (later)           │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  STORE  Supabase                                                  │
│  mint_swaps (mint, sig, wallet, side, token_raw, sol, usd, ts)  │
│  mint_wallet_positions (materialized per wallet per mint)         │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  SERVE  /api/tokens/[mint]/chain-trades                         │
│         /api/tokens/[mint]/chain-top-traders                    │
│         /api/tokens/[mint]/holders (enriched from positions)    │
└─────────────────────────────────────────────────────────────────┘
```

**Do not** route desk intelligence through Jupiter (quotes) or DexScreener (aggregate pair stats). DexScreener is fine for **header MC/liq/vol**; desk tape must be **per-swap**.

### P0 vertical slice plan (QA mint only)

**Goal:** Real trades tape + wallet aggregates for `GZQFCZjfzQyFSkA4jBuEeh5eKTLNzju7PZrEWxMvpump` within ~3–5 dev days.

| Step | Work | Output |
|------|------|--------|
| 1 | DB migration: `mint_swaps`, `mint_wallet_stats` | Schema |
| 2 | `lib/indexer/backfillQaMint.ts` — Helius `getSignaturesForAddress` on mint's pool/curve OR enhanced tx history API | Historical swaps |
| 3 | `lib/indexer/parseSwapFromEnhancedTx.ts` — extract side, amounts from `tokenTransfers` + `nativeTransfers` | Normalized rows |
| 4 | `lib/indexer/deriveWalletStats.ts` — FIFO avg buy, sold, remaining, realized PnL | Holder desk columns |
| 5 | API routes `chain-trades`, `chain-top-traders` | UI wiring |
| 6 | Cron or webhook listener scoped to QA mint | Real-time updates |
| 7 | Replace holder synth with derived stats or `—` | Honest UI |

**Acceptance (G7anch):**  
≥10 real swaps in tape with correct buy/sell color, wallet, SOL amount, age ≠ static "3h" for all rows; top traders ranked by realized PnL; holder Bought/Avg populated for wallets that traded.

### Cost / risk notes

| Option | Est. cost | Risk | Backfill | Real-time |
|--------|-----------|------|----------|-----------|
| Helius enhanced webhooks | Included in Developer plan; credit per tx | Must filter by mint; parse complexity | Re-fetch tx history via RPC | Good |
| Helius `getSignaturesForAddress` backfill | RPC credits scale with tx count | Rate limits on hot mints | Good for one mint | Poll-based |
| Yellowstone/Geyser | Dedicated node $500+/mo or provider | Ops heavy | Stream from slot N | Best latency |
| Birdeye token tx API | ~$200–500/mo starter | Vendor lock | Excellent | Good |
| Shyft GraphQL | Usage-based | Smaller ecosystem | Good for pump | Good |
| Moralis swap API | Limited Solana swap coverage | Not enough alone for pump desk | Partial | Partial |
| pump.fun public API | Free | **Metadata only today** — no trade history in our integration | N/A | N/A |
| Custom RPC log parser | Helius credits only | Highest eng cost | Full control | With Geyser |

**Supabase protection:** QA-only gate (`POINTER_QA_MINT_ONLY=1`) + batch inserts + 120s Redis cache on reads. Do not enrich all Pulse mints until indexer is proven.

### Exact next implementation task

1. **Done:** `mint_swaps` migration, Helius backfill, parser, wallet stats, APIs, QA UI wiring.
2. **Next:** Realtime ingest — Helius enhanced webhook → `parseSwapFromEnhancedTx` → upsert (QA mint filter).
3. **Then:** Generalize backfill beyond QA (`POINTER_QA_MINT_ONLY` off) with rate limits.
4. **Do not:** UI polish, Pulse display toggles, Birdeye until QA realtime is stable.

---

## Task 1 — Architecture audit by source

### 1. TradingView

| Item | Detail |
|------|--------|
| **Token desk** | **Not used.** `components/tokens/TokenChart.tsx` uses `lightweight-charts` v4. |
| **Perps only** | `components/perps/PerpsChartPanel.tsx` embeds `tv.js` widget. |
| **Data** | Token chart OHLC from `lib/helius/chart.ts` → Supabase `token_market_snapshots`, not TV. |
| **Status** | Charting library only. **Zero desk intelligence.** |

### 2. DexScreener

| Function | File | Fetches |
|----------|------|---------|
| `fetchDexMetricsForMints` | `lib/market/dexscreenerPulse.ts` | `api.dexscreener.com/tokens/v1/{chain}/{mints}` |
| `fetchDexScreenerSpotUsd` | same | Best-pair spot USD |
| `ensureTokenRowFromDexScreener` | `lib/market/dexscreenerTokenHydrate.ts` | `latest/dex/tokens/{mint}` metadata + metrics |

**Unlocks:** Price, MC, liquidity, volume windows, txn counts (pair-level, not per-wallet).  
**Does not unlock:** Trades tape, wallet PnL, funding, snipers.

### 3. Helius DAS / RPC / webhooks / enhanced tx

| Capability | File | What it does |
|------------|------|--------------|
| DAS `getAsset` | `lib/helius/feed.ts`, `solDasPoll.ts` | Token metadata, creator, image |
| DAS poll | `pollSolanaPulseFromDas` | New mint discovery by launchpad authority |
| RPC holders | `lib/onchain/solanaTokenHolders.ts` | Supply, largest accounts |
| RPC funding | `lib/solana/walletFunding.ts` | Incoming SOL for **wallet analytics** (not wired to desk) |
| Webhook route | `app/api/webhooks/helius/route.ts` | Receives enhanced txs |
| Parse | `lib/helius/parsers.ts` → `parseEnhancedTransaction` | **Launch/migration events only** — picks mint, creator, bonding % |
| Ingest | `lib/helius/webhookIngest.ts` | Upserts `tokens` — **no `mint_swaps`** |
| Chart | `lib/helius/chart.ts` | DB snapshot OHLC + DexScreener live spot |

**Gap:** `parseEnhancedTransaction` does not extract swap side/amounts. Webhooks are discovery-only today.

### 4. Moralis

| Function | File | API |
|----------|------|-----|
| `fetchMoralisTokenHolderSnapshot` | `lib/onchain/moralisTokenHolders.ts` | `solana-gateway.moralis.io/.../top-holders`, `/holders/{mint}` |

**Unlocks:** Holder wallets, balances, %, total holder count, top10 %.  
**Does not unlock:** Per-wallet trade history on pump (not used for swaps). Sets `is_sniper: null`.

### 5. Supabase `trades`

| Access | File | Role |
|--------|------|------|
| `listTradesForMint` | `lib/db/trades.ts` | Platform swap fills when user trades via Pointer + Jupiter |
| API | `app/api/tokens/[mint]/trades/route.ts` | Desk trades tab |
| Top traders | `lib/trading/mintTopTraders.ts` | FIFO on Pointer `trades` + `users.wallet_address` |

**Status:** **Pointer-only.** Empty on G7anch unless Pointer users traded there. **Not acceptable as desk tape source.**

### 6. pump.fun public API

| Function | File | Endpoint |
|----------|------|----------|
| `fetchPumpFunCoin` | `lib/market/pumpFunCoin.ts` | `frontend-api-v3.pump.fun/coins/{mint}` |

**Unlocks:** Creator, socials, name, symbol, image.  
**Does not unlock (in our code):** Trade history — pump may have other endpoints but we do not call them.

### 7. Jupiter

| Use | File | Role |
|-----|------|------|
| Price API | `lib/jupiter/priceTickers.ts` | Spot USD for chart fallback, ticker bar |
| Quote API | `lib/jupiter/quote.ts` | Buy/sell execution — **not desk analytics** |

### 8. Other sources

| Source | Files | Desk role |
|--------|-------|-----------|
| **Upstash Redis** | `lib/redis/client.ts` | Cache extended metrics (60s), holders (120s) |
| **CoinGecko** | `lib/jupiter/priceTickers.ts` | TON/BNB tickers only |
| **GeckoTerminal** | `lib/evm/geckoTerminalPulse.ts` | EVM Pulse only |
| **TonAPI / TON Center** | `lib/ton/*` | TON chain only |
| **Coin Communities** | hooks in Pulse social strip | Community members — not holders |
| **Birdeye** | — | **Not integrated** |
| **Synthetic/demo** | `lib/dev/demoTokenFixtures.ts`, `lib/tokens/holderDeskSynth.ts` | Demo mode only |

---

## Task 1b — Token desk panel → source → status

| Field / panel | Real source | Status |
|---------------|-------------|--------|
| **Chart candles** | `token_market_snapshots` aggregated OHLC | **live weak** — sparse, not exchange-grade |
| **Chart last price** | DexScreener spot merge | **live real** |
| **Current price** | DexScreener → snapshot | **live real** / stale weak |
| **Market cap** | DexScreener → snapshot | **live real** / weak |
| **Liquidity** | DexScreener → snapshot | **live real** / weak |
| **Volume 5m/1h/24h** | DexScreener txn aggregates | **live weak** (pair-level) |
| **Holders count** | Moralis or Helius RPC | **live weak** |
| **Top 10 holder %** | Moralis/RPC holder math | **live real** when resolved |
| **Dev holder %** | Creator wallet ∈ holder set | **live real** when creator known |
| **Trades tape** | Supabase `trades` | **Pointer-only** → **missing** for chain |
| **Top traders** | `mintTopTraders` on Pointer trades | **Pointer-only** → **missing** |
| **Holder bought/avg/sold/PnL** | `holderDeskSynth.ts` | **synthetic** → **— in live** (Task 4) |
| **Funding source** | `buildDeskFundingSynth` | **synthetic** → **— in live** |
| **Held duration** | `holderDeskSynth` | **synthetic** → **— in live** |
| **Snipers %** | `is_sniper` on holders | **missing** (always null) |
| **Insiders %** | `tokenMetrics.ts` stub | **missing** |
| **Bundlers %** | `tokenMetrics.ts` stub | **missing** |
| **LP burned %** | `tokenMetrics.ts` stub | **missing** |
| **Dev tokens list** | `listTokensByCreatorWallet` (QA) | **live real** (QA) / **demo** (else) |
| **Net volume (desk strip)** | Was Pointer `trades` 6h agg | **Pointer-only** → **missing** |
| **Buys/sells split (desk strip)** | Same + `tapeMetricsForTf` jitter | **Pointer-only** / **synthetic scale** |
| **Wallet on trade row** | Demo fixtures only | **missing** for real Pointer rows |
| **Pro traders count** | `wallet_stats` ∩ holders | **Pointer-only** heuristic |

---

## Task 2 — Indexing options evaluation

### Helius enhanced transactions / parsed webhooks

| Dimension | Assessment |
|-----------|------------|
| **Unlocks** | Per-tx `tokenTransfers`, `nativeTransfers`, `feePayer`, program IDs — enough to parse pump swaps if filter includes pool/curve |
| **Cost** | Developer plan credits per enhanced tx; webhook delivery included |
| **Rate limits** | Webhook throughput OK for one mint; backfill via `getSignaturesForAddress` burns RPC credits |
| **Latency** | ~1–3s webhook | 
| **Backfill** | `getSignaturesForAddress` on pool + `getTransaction` with `jsonParsed` or enhanced format |
| **Real-time** | Yes via webhook subscription |
| **pump.fun / PumpSwap / Raydium** | Enhanced txs include program id — parser must handle each; pump bonding + PumpSwap are P0 for G7anch |
| **Difficulty** | Medium — parser + DB + idempotent sig dedup |

### Helius webhooks (current)

| Dimension | Assessment |
|-----------|------------|
| **Unlocks today** | Token discovery only |
| **To unlock desk** | Change webhook type to include swaps; extend `parseEnhancedTransaction` → `parseSwapTransaction` |
| **Difficulty** | Low incremental if enhanced swap payload already received |

### Yellowstone / Geyser gRPC stream

| Dimension | Assessment |
|-----------|------------|
| **Unlocks** | Lowest-latency firehose of all account/program updates |
| **Cost** | $500+/mo dedicated or Triton/Helius LaserStream add-on |
| **Backfill** | Must combine with historical RPC |
| **Real-time** | Best |
| **Programs** | All — custom filters |
| **Difficulty** | High ops — overkill for founder beta vertical slice |

### Shyft

| Dimension | Assessment |
|-----------|------------|
| **Unlocks** | GraphQL parsed DeFi txs, wallet portfolios |
| **Cost** | Usage tiers |
| **Backfill** | Good API |
| **pump** | Supported in ecosystem |
| **Difficulty** | Low-Medium integration |

### Birdeye

| Dimension | Assessment |
|-----------|------------|
| **Unlocks** | Token trades API, OHLCV, holder analytics — closest to Axiom out-of-box |
| **Cost** | Paid tiers ~$200+/mo |
| **Backfill** | Excellent historical trades endpoint |
| **Real-time** | WebSocket on higher tiers |
| **Difficulty** | Low — but vendor dependency + we don't have key yet |

### Bitquery

| Dimension | Assessment |
|-----------|------------|
| **Unlocks** | GraphQL DEX trades across Solana |
| **Cost** | Query-priced |
| **pump** | Coverage varies |
| **Difficulty** | Medium |

### Moralis (extended)

| Dimension | Assessment |
|-----------|------------|
| **Unlocks** | Holders (we use this); swap history limited vs Birdeye |
| **Cost** | Tiered |
| **Desk tape** | **Insufficient alone** for Axiom parity |

### DexScreener paid

| Dimension | Assessment |
|-----------|------------|
| **Unlocks** | Better rate limits, pair data |
| **Desk tape** | **No per-wallet trades** |

### pump.fun trade/history endpoints

| Dimension | Assessment |
|-----------|------------|
| **Unlocks** | May expose recent trades for bonding curve (undocumented / versioned) |
| **Cost** | Free but unstable |
| **Risk** | ToS / breaking changes |
| **Difficulty** | Low to spike; not sole production dependency |

### Custom RPC log parser

| Dimension | Assessment |
|-----------|------------|
| **Unlocks** | Full control |
| **Cost** | Helius credits |
| **Difficulty** | High — maintain program layouts |

### Recommended hybrid

| Phase | Approach |
|-------|----------|
| **P0 (founder beta)** | Helius enhanced tx backfill + webhook for **QA mint only** + custom `parsePumpSwap` |
| **P1** | Add Birdeye trades API as backfill accelerator + OHLCV for chart |
| **P2** | Geyser or LaserStream if sub-second tape matters at scale |
| **P3** | Sniper/bundler/insider heuristics on stored swaps + funding graph from SOL transfers |

---

## Task 3 — Minimum real token desk MVP (QA mint)

### Schema (proposed)

```sql
-- mint_swaps: one row per wallet swap leg (dedupe by signature+wallet+side)
create table mint_swaps (
  id bigserial primary key,
  mint text not null,
  signature text not null,
  wallet text not null,
  side text not null check (side in ('buy','sell')),
  token_amount_raw numeric not null,
  sol_amount numeric not null,
  price_usd numeric,
  market_cap_usd numeric,
  block_time timestamptz not null,
  program_id text,
  unique (signature, wallet, side)
);

-- mint_wallet_stats: materialized from mint_swaps + current holder balance
create table mint_wallet_stats (
  mint text not null,
  wallet text not null,
  bought_token_raw numeric default 0,
  sold_token_raw numeric default 0,
  buy_sol numeric default 0,
  sell_sol numeric default 0,
  avg_buy_usd numeric,
  avg_sell_usd numeric,
  realized_pnl_usd numeric,
  remaining_token_raw numeric,
  first_trade_at timestamptz,
  last_trade_at timestamptz,
  primary key (mint, wallet)
);
```

### Derivation logic

1. **Ingest** enhanced tx → `{wallet=feePayer or transfer owner, side=token delta sign, amounts}`.
2. **USD** = `sol_amount * sol_usd_at_block` (Jupiter historical or DexScreener spot proxy).
3. **FIFO PnL** — same as `mintTopTraders.ts` but on `mint_swaps`.
4. **Top traders** — sort by `realized_pnl_usd` desc.
5. **Net volume** — `sum(buy_sol*usd) - sum(sell_sol*usd)` in window.
6. **Tape** — `mint_swaps` ordered by `block_time desc`.

### G7anch-specific bootstrap

1. Resolve pool/bonding curve address from DexScreener pair or pump.fun coin row.
2. `getSignaturesForAddress(pool, limit=1000)` → parse each.
3. Insert into `mint_swaps`.
4. Run `deriveWalletStats(mint)`.
5. Wire `/api/tokens/[mint]/chain-trades` (QA-gated).

---

## Task 5 — Recommendations (direct answers)

### 1. Is chain trade indexing P0 before founder beta?

**Yes.** Without it the desk is an empty shell compared to Axiom. Holder list alone is not "token desk product."

### 2. Fastest reliable source for G7anch trade tape?

**Helius enhanced transaction history** backfill on the token's **PumpSwap / pump pool address**, plus webhook for new swaps. Spike pump.fun trade API in parallel as optional accelerator.

### 3. Can Helius alone do this well enough?

**Yes for MVP** on one pump mint: enhanced txs include `tokenTransfers` and `nativeTransfers` sufficient to classify buy/sell. **No** for full Axiom parity (funding graph, bundler detection, sub-second firehose) without significant custom logic or add-on stream.

### 4. Do we need a paid indexer before real beta?

**Not strictly for QA vertical slice** — Helius + custom parser is enough to prove the pipeline. **Yes for production scale** across all Pulse mints — Birdeye or Shyft saves months of parser maintenance and backfill ops.

### 5. What to build first?

| Priority | Choice |
|----------|--------|
| **First** | Helius parsed tx vertical slice (QA mint backfill + webhook) |
| **Second** | Wire desk UI to `mint_swaps` / `mint_wallet_stats` |
| **Third** | Birdeye integration for backfill + OHLCV chart |
| **Not first** | pump.fun API alone (metadata only in our integration) |

### 6. Minimum data system for Axiom-lite?

| Layer | Minimum |
|-------|---------|
| Ingest | Helius enhanced webhook + one-shot backfill per mint |
| Store | `mint_swaps` + `mint_wallet_stats` in Supabase |
| Derive | FIFO PnL, top traders, net vol windows |
| Market header | DexScreener (keep) |
| Holders | Moralis/Helius (keep) |
| Chart | Birdeye OHLCV or snapshot indexer (P1) |
| Labels | Sniper = first 5 slots heuristic; funding = optional P2 |

---

## File index (implementation touchpoints)

```
lib/helius/parsers.ts              # extend for swap parse
lib/helius/webhookIngest.ts        # route swaps → mint_swaps
lib/onchain/resolveTokenHolders.ts # keep; enrich with wallet stats
lib/tokens/holderDeskSynth.ts      # demo only after Task 4
lib/trading/mintTopTraders.ts      # reimplement on mint_swaps
lib/onchain/tokenMetrics.ts        # net vol from chain swaps
app/api/tokens/[mint]/trades/      # point to chain-trades
components/tokens/TokenActivityTabs.tsx
components/tokens/HoldersTable.tsx
lib/db/trades.ts                   # platform fills — separate from chain
```

---

## Founder beta gate checklist

- [ ] `mint_swaps` populated for QA mint (≥ real swap count from Axiom screenshot)
- [ ] Trades tab shows indexed chain trades
- [ ] Top traders ranked from chain FIFO
- [ ] Holder Bought/Avg from `mint_wallet_stats` or `—`
- [ ] No synthetic numbers in live mode
- [ ] Empty states explain indexer status
- [ ] `POINTER_QA_MINT_ONLY=1` until cost model validated
- [ ] Document Helius credit burn per mint backfill
