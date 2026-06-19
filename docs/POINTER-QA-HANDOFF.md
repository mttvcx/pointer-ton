# Pointer QA Handoff — G7anch Token Desk (for ChatGPT review)

> **Superseded for current state:** see [`HANDOFF.md`](../HANDOFF.md) and [`AXIOM_READY_EXECUTION_REPORT.md`](../AXIOM_READY_EXECUTION_REPORT.md).  
> This file is kept for historical G7anch QA context (2026-06-09). Chain indexer, Token-2022 balances, and wallet intelligence shipped after this doc was written.

**Date:** 2026-06-09  
**Repo:** `pointer-ton` (Next.js 16, port 3001)  
**QA mint:** `GZQFCZjfzQyFSkA4jBuEeh5eKTLNzju7PZrEWxMvpump` (G7 Anchor / G7anch, pump.fun)

---

## Executive summary

Pointer’s token desk is **partially live**. Compared to Axiom, gaps are **expected at this stage** — not random bugs. Most empty panels are because:

1. **Trades / Top Traders** only show **Pointer platform fills** (Supabase `trades`), not chain swap history.
2. **Holders table** shows **real wallets** from Moralis/Helius, but **Bought / Avg / PnL columns are synthetic placeholders** until a wallet-trade indexer ships.
3. **Dev Tokens list** was demo-only; now **live for QA mint only** when `creator_wallet` is hydrated.
4. **Snipers / Insiders / Bundlers / LP burned** are Phase 2 stubs (`null` in `tokenMetrics.ts`).
5. **Coin Communities** needs `COIN_COMMUNITIES_API_KEY` — member count is separate from holder count.

**Not paying for “max” APIs is OK** for beta if you accept: holders + price/MC work; desk trade columns and chain tape stay empty until Phase 2/3 indexers or Pointer user volume.

---

## What works today (live data)

| Surface | Source | Notes |
|---------|--------|-------|
| Token row in DB | Helius DAS `getAsset` | name, symbol, image |
| Market cap / volume | DexScreener overlay + `token_market_snapshots` | fixed SOL/USD bug (was using TON price) |
| Holders list (wallet, %, rank) | Moralis **or** Helius RPC fallback | `MORALIS_API_KEY` optional but better |
| Top 10 H / Dev H (Token Info) | Holder desk + snapshot | e.g. 99.96% top10 on G7anch is plausible for new pump |
| Holder count | Moralis metrics or RPC largest accounts | |
| Creator wallet (QA mint) | pump.fun public API on token page load | `hydrateQaTokenIfNeeded` |
| Dev Tokens tab (QA mint) | `listTokensByCreatorWallet` + snapshots | `/api/tokens/[mint]/dev-tokens` |
| Pulse metric pills (QA-scoped) | `enrichPulseBundlesWithMetrics` | when `POINTER_QA_MINT_ONLY=1` |

---

## What is stubbed / empty (by design)

| Surface | Why empty or wrong | Fix path |
|---------|-------------------|----------|
| **Trades tape** | No chain indexer; only `trades` table | Phase 3: Helius enhanced tx / Birdeye for mint |
| **Top Traders** | FIFO on Pointer `trades` only | Same + wallet labels |
| **Holders Bought/Avg/Sold/PnL** | `holderDeskSynth.ts` — deterministic fake | Wallet cost-basis indexer per mint |
| **Funding / Held columns** | `buildDeskFundingSynth` | Funding graph API |
| **Snipers H** | `is_sniper` always `null` from Moralis/Helius paths | Sniper detection pipeline |
| **Insiders / Bundlers / LP** | Hardcoded `null` in `getTokenExtendedMetrics` | Phase 2 |
| **Dev Tokens (non-QA)** | `demoTables` only unless QA API | Roll out `listTokensByCreatorWallet` when stable |
| **Pro traders / dev crown on Pulse** | Needs `extended_metrics` + deploy history indexer | Phase 2 |

---

## QA-only testing (protect Supabase)

Add to `.env.local`:

```env
# Single mint for deep desk wiring — avoids enriching every Pulse row
POINTER_QA_MINT=GZQFCZjfzQyFSkA4jBuEeh5eKTLNzju7PZrEWxMvpump
POINTER_QA_MINT_ONLY=1
NEXT_PUBLIC_POINTER_QA_MINT=GZQFCZjfzQyFSkA4jBuEeh5eKTLNzju7PZrEWxMvpump
```

**Behavior:**

- `POINTER_QA_MINT_ONLY=1` → Pulse holder/pump enrich runs **only** for QA mint (saves Moralis/Helius/DB writes).
- Token page `/token/GZQFC…pump` calls `hydrateQaTokenIfNeeded`: pump.fun creator/socials + holder snapshot persist.
- Dev Tokens tab uses live DB rows for that creator when mint matches QA.

**Optional demo (full Axiom-style desks without lying on live):**

```env
NEXT_PUBLIC_POINTER_TABLE_DEMO=1
```

Shows synthetic trades/traders/holders — clearly labeled in code as demo, not production numbers.

---

## API keys (what you need vs nice-to-have)

| Key | Required? | Used for |
|-----|-----------|----------|
| `HELIUS_API_KEY` | **Yes** (Solana) | DAS hydrate, RPC holders, charts, webhooks |
| `SUPABASE_*` | **Yes** | tokens, snapshots, trades, holders tables |
| `UPSTASH_*` | **Yes** | holder/metrics Redis cache |
| `MORALIS_API_KEY` | Optional | Faster top-holders + holder count metrics |
| `COIN_COMMUNITIES_API_KEY` | Optional | Community hover (members/posts); shows `0` without key |
| pump.fun | **Free** | No key — `frontend-api-v3.pump.fun/coins/{mint}` |

---

## Recent fixes (this session)

1. **SOL USD total** — `buildPortfolioSnapshot` used TON price; fixed to Jupiter SOL.
2. **OAuth** — Google/X in popup, not full-page redirect.
3. **Pulse metrics enrich** — holder top10/dev/sniper% for rows (QA-scoped).
4. **Community icon** — shows **community member count**, not holder count.
5. **QA mint hydrate** — creator + snapshot on token page load.
6. **Dev tokens live** — QA mint only via `/api/tokens/[mint]/dev-tokens`.

---

## Key files (for code review)

```
app/(app)/token/[mint]/page.tsx          # SSR token page + QA hydrate
lib/qa/pointerQaMint.ts                  # QA mint constants (server)
lib/qa/hydrateQaToken.ts                 # pump.fun + holder snapshot for QA
lib/market/pulseMetricsEnrich.ts         # Pulse row metric pills
lib/onchain/resolveTokenHolders.ts       # Moralis → Helius holder desk
lib/onchain/tokenMetrics.ts              # Token Info grid (partial stubs)
lib/tokens/holderDeskSynth.ts            # FAKE bought/avg/pnl columns
components/tokens/TokenActivityTabs.tsx    # Trades, holders, traders, dev tabs
components/tokens/PulseRowSocialStrip.tsx  # Top row icons (community fix)
```

---

## Comparison: Pointer vs Axiom (G7anch)

| Axiom shows | Pointer shows | Match? |
|-------------|---------------|--------|
| 13 holders with wallet balances | 13 holders, real addresses | ✅ |
| Bought/Avg per wallet | $0.0000 (synth) | ❌ stub |
| Live trades tape (chain) | No transactions | ❌ no indexer |
| Top traders (chain) | No ranked traders | ❌ Pointer fills only |
| Dev tokens (1) | Live for QA if creator hydrated | ⚠️ partial |
| Token info top10/dev | top10 ~100%, dev 0% | ⚠️ close (method differs) |
| MC ~$33K | ~$55K | ⚠️ different price sources / timing |

MC/liquidity differences are normal between DexScreener vs pump AMM snapshots and refresh timing.

---

## Recommended next steps (priority)

1. **P0** — Chain trade feed for **one mint** (Helius parsed txs or pump.fun trades) → Trades tab + side panel.
2. **P0** — Replace `holderDeskSynth` with wallet-level buy/sell from that feed.
3. **P1** — Roll `hydrateQaTokenIfNeeded` pattern to all pump mints (rate-limited), not just QA.
4. **P1** — Pulse display toggles for top-row icons + bottom metric pills (user request).
5. **P2** — Sniper/insider/bundler detection (paid indexer or custom heuristics).
6. **P2** — `listTokensByCreatorWallet` for all tokens (not QA-gated).

---

## How to verify QA mint locally

```bash
cd pointer-ton
npm run dev
# open http://127.0.0.1:3001/token/GZQFCZjfzQyFSkA4jBuEeh5eKTLNzju7PZrEWxMvpump
```

Check:

- Token Info: Top 10 H > 0, Holders ~13
- Holders tab: wallet list populated (Bought may still show $0 — known)
- Dev Tokens: not “No creator wallet” after hydrate
- Pulse row: community icon shows **0** members if no community posts (not 14)

---

## Questions for ChatGPT to double-check

1. Is **Pointer-only trades** the right Phase 1 trade source, or should we prioritize **chain tape** before more UI polish?
2. Is **Moralis vs Helius-only** sufficient for holder desk until volume justifies Birdeye/Tensor?
3. Should **holderDeskSynth** be hidden entirely in live mode (show `—`) instead of fake $0.0000?
4. Rate limits: is `POINTER_QA_MINT_ONLY=1` + Redis 120s cache enough to protect Supabase at beta scale?
