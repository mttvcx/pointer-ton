# Pointer TON — Project State & Agent Handoff

> **Last updated:** 2026-06-13  
> **GitHub:** https://github.com/mttvcx/pointer-ton  
> **Latest commit on `main`:** `5104d56` — Token-2022 balances, wallet intelligence, predictions, ingest crons  
> **Read this file first.** Then `AGENTS.md` (hard rules). For full QA vs Axiom, use `docs/CLAUDE_CODE_QA_PROMPT.md`.

---

## What is Pointer?

**Pointer** is an Axiom/Photon-*inspired* Solana-first trading terminal with Pointer’s own dark design system, **AI co-pilot**, wallet tracking, Pulse discovery, and founder-beta live trading. Tagline: *"Where the sharpest traders are."*

**Local dev:** `C:\Users\moust\Downloads\pointer-ton` (or clone from GitHub) · **Port:** `3001` · **`npm run dev`**

**Benchmark competitor:** [axiom.trade](https://axiom.trade) — compare layout, load times, desk data, buy/sell UX. Pointer is **not** a pixel clone; match *behavior* and *data honesty*, use Pointer theme tokens.

---

## Surfaces (every route)

| Surface | Route | Status | Notes |
|---------|-------|--------|-------|
| **Pulse** | `/pulse` | ✅ Live | NEW / STRETCH / MIGRATED columns, quick-buy queue, stocks board, X Monitor, Squads rail. **Primary QA surface.** |
| **Token desk** | `/token/[mint]` | ✅ Live | Chart, buy/sell, activity tabs (Trades, Holders, Top Traders, Dev), PnL strip, AI panel. Chain indexer when `mint_swaps` populated. |
| **Explore** | `/explore` | ✅ Live | Table + Mindshare bubbles. |
| **Track / Trackers** | `/track`, `/trackers` | ✅ Live | Wallet tracking, KOL tab, **Mint starter KOLs** (opt-in SOL/EVM packs), paste import (Kolscan/Axiom/GMGN). |
| **Portfolio** | `/portfolio` | ✅ Live | Holdings, FIFO PnL; Jupiter 429 → SOL-only fallback. |
| **Points / $PTR** | `/points` | ⚠️ UI | Campaign UI; token mechanics Phase 5. |
| **Predictions** | `/predictions`, `/predictions/[marketId]` | ⚠️ Live data | Kalshi-backed markets API + desk UI. Orders/trades may be preview. |
| **Packs** | `/packs` | ⚠️ Simulated | Demo/simulated open ledger — not live commerce. |
| **Perps** | `/perps` | 🔒 Preview | Terminal shell; order signing Phase 2. |
| **Stock perps** | `/stock/[symbol]` | 🔒 Preview | Same shell as perps (OPENAI, TSLA, etc.). |
| **Squads** | `/squads/*` | ⚠️ Partial | Chat-first UI; some actions toast “Phase 2”. |
| **Championship** | `/championship` | ⚠️ Partial | PTCS scoring logic exists; full live loop TBD. |
| **Wallet profile** | `/wallet/[address]` | ✅ Live | On-chain analytics when indexed. |
| **Wallets** | `/wallets` | ✅ Live | Multi-wallet management (Privy). |
| **Referral** | `/referral` | ⚠️ UI | Phase 2 referral system. |
| **Leaderboard** | `/leaderboard` | ⚠️ UI | Phase 2. |
| **Sandbox** | `/sandbox` | Dev only | Isolated simulated trading (`POINTER_SANDBOX=1`). |
| **Admin** | `/admin/*` | Founder | RBAC control room. |

**Hidden / legacy nav:** Perps may appear in user-customized topbar order (`store/topbarNav.ts`). Default nav in `components/layout/navConfig.ts`.

---

## What works today (June 2026)

### Trading & balances
- **Live buy/sell** via Jupiter v6 (+ Pump direct route when applicable) on Solana mainnet through Helius RPC + Sender + Jito.
- **Platform fee:** 1% (100 bps) default tier; Jupiter referral account wired.
- **Founder beta presets:** `0.001, 0.01, 0.1, 0.5` SOL when `NEXT_PUBLIC_FOUNDER_BETA=1`. **Use 0.001 SOL for E2E tests** (~$0.15–0.25); Jupiter rejects sub-0.001.
- **Token-2022 balances:** Pump/migrated tokens (e.g. ISLANDS `yoA2…pump`) — `getSplBalanceRaw` scans Token + Token-2022 programs. Fixes zero balance / −100% PnL on desk.
- **Desk PnL:** Axiom-style `sold + holding mark − bought` when live price + balance available (`lib/trading/deskWalletDisplayStats.ts`).

### Token desk & indexer
- **Chain trades tape** from `mint_swaps` (Helius enhanced tx backfill) — any indexed mint, not QA-only.
- **On-demand index kickoff:** Empty trades/stats → background `backfillMintSwaps` via `lib/indexer/kickoffMintIndex.ts`.
- **Scheduled crons** (Vercel + `CRON_SECRET`): discover, enrich-pulse, index-active-mints, retry-failed-indexes, poll-tracked-wallets, aggregate-wallet-stats. See `REALTIME_INGESTION_REPORT.md`.
- **Indexed mints (example):** Islands 160 swaps, WIF 53, JPYCRB 38 — see `AXIOM_READY_EXECUTION_REPORT.md`.
- **Honest empty states:** `indexer_pending` label, not fake numbers (unless `NEXT_PUBLIC_UI_DEMO_MODE=1`).

### Pulse & discovery
- Helius DAS + DexScreener + pump.fun enrich; NEW column 240m window; cold-start sync poll.
- Quick-buy **FIFO queue** (`usePulseQuickBuy`) — spam-click without row lock.
- Protocol filters, launchpad avatars, Twitter hover cards (SocialData or syndication fallback).

### Wallet intelligence
- **KOL registry:** Postgres-backed `identity_profiles` + JSON seeds; Kolscan/Axiom/GMGN paste import (`POST /api/identity/import`).
- **Starter KOL packs:** Opt-in **Mint starter KOLs** button (SOL ~46 wallets, EVM 20 shared on eth/bnb/base) — no auto-seed on signup.
- **Tracked wallet alerts:** Helius webhook + cron poll → real toasts (`WalletTrackerAlertBridge`).
- **wallet_stats** aggregation cron from `mint_swaps`.

### Predictions
- `GET /api/predictions/markets` — Kalshi live markets (crypto category). Desk UI at `/predictions`.

### Auth & infra
- Privy embedded wallets + Google/X OAuth popup.
- Supabase Postgres, Upstash Redis, Zod at API boundaries, `lib/db/*` only for DB writes.

---

## Known gaps vs Axiom (honest)

| Axiom has | Pointer today | Gap |
|-----------|---------------|-----|
| Instant chain tape for every mint | Indexed mints only; others show “indexer pending” until cron/backfill | Indexer coverage + Helius credits |
| Holder bought/avg/PnL per wallet | Real when `mint_wallet_stats` indexed; synth/`—` otherwise | Indexer + wallet stats |
| Snipers / insiders / bundlers | Mostly `null` / Phase 2 | Paid indexer or custom heuristics |
| Sub-second tape updates | Cron 2–5 min lag unless Helius webhook registered | Webhook + deploy URL |
| Total holder count | Moralis when keyed; else `—` | Optional `MORALIS_API_KEY` |
| Perps / copy-trade | Preview shells only | Phase 2+ |

---

## Recent fixes (do not regress)

1. **Token-2022 SPL balance** — `lib/solana/wallet-token-balances.ts`, `app/api/trade/balance/route.ts`.
2. **Desk PnL −100% on held positions** — live mark in `deskWalletDisplayStats.ts`.
3. **TokenRow Pulse dock** — `ultraChrome` vs `pulseRow` vs `useActionDock`; V/MC click zone + button sizes.
4. **Indexer generalized** — no `isPointerQaMint` gates on chain-trades/holders/dev-tokens.
5. **KOL import + starter packs** — opt-in, not auto on auth sync.

---

## Environment (minimum for full QA)

Copy `.env.example` → `.env.local`. Critical keys:

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_APP_URL` | yes | `http://127.0.0.1:3001` |
| `HELIUS_API_KEY` | yes (Sol) | RPC, DAS, indexer, webhooks |
| `NEXT_PUBLIC_SUPABASE_*` + `SUPABASE_SERVICE_ROLE_KEY` | yes | DB |
| `NEXT_PUBLIC_PRIVY_APP_ID` + `PRIVY_APP_SECRET` | yes | Auth + wallets |
| `UPSTASH_*` | yes | Cache / rate limits |
| `NEXT_PUBLIC_FOUNDER_BETA=1` | QA | 0.001 SOL presets, desktop gate |
| `CRON_SECRET` | prod | Cron route auth |
| `MORALIS_API_KEY` | optional | Total holder count |
| `JUPITER_API_KEY` | optional | Reduces 429 on quotes |
| Kalshi keys | predictions | See `.env.example` Kalshi section |

**Do not commit `.env.local`.**

---

## Scripts & verification

```bash
npm install
npm run dev              # http://127.0.0.1:3001
npm run typecheck
npm test                 # 237+ tests
npm run backfill:active-mints -- --source=pulse_migrated --max=8
npm run cron:loop        # local ingest loop (optional)
```

**Quick smoke:** `/pulse` → open ISLANDS or WIF → Trades tab has rows if indexed → buy panel shows real balance → PnL strip not −100% when holding.

---

## Architecture rules (summary)

Full rules: **`AGENTS.md`**

1. No raw SQL in API routes → `lib/db/*.ts`
2. No direct LLM in features → `lib/ai/cascade.ts`
3. Zod at every API boundary
4. Theme tokens in `tailwind.config.ts` / `globals.css` — no ad-hoc hex
5. Phase 5 abstractions: `getFeeBpsForUser`, `getAIQuotaForUser` in `lib/db/tiers.ts`
6. **dex-trader** is a different repo — do not edit unless user names it
7. Commits/push only when user asks

---

## Documentation index

| Doc | Purpose |
|-----|---------|
| **`HANDOFF.md`** (this file) | Current project state |
| **`AGENTS.md`** | Agent hard rules |
| **`README.md`** | Setup & stack |
| **`docs/CLAUDE_CODE_QA_PROMPT.md`** | Copy-paste full QA vs Axiom prompt |
| **`AXIOM_READY_EXECUTION_REPORT.md`** | Indexer generalization + verification matrix |
| **`WALLET_INTELLIGENCE_IMPLEMENTATION_REPORT.md`** | KOL registry, imports, tracked alerts |
| **`REALTIME_INGESTION_REPORT.md`** | Cron schedule, webhooks, ingest runbook |
| **`WALLET_DATA_INVENTORY_REPORT.md`** | DB table counts & data inventory |
| **`WALLET_INTELLIGENCE_MORALIS_AUDIT.md`** | Moralis scope audit |
| **`docs/POINTER-QA-HANDOFF.md`** | Legacy G7anch QA notes (partially superseded) |
| **`DATA_GAP_AND_API_BLOCKERS.md`** | Paid API gaps |
| **`FOUNDER_BETA_READINESS_REPORT.md`** | Founder beta checklist |

---

## Copy-paste prompt (short — new agent)

```
You are working on Pointer (pointer-ton). Read HANDOFF.md and AGENTS.md first.

Repo: https://github.com/mttvcx/pointer-ton · Dev: npm run dev → http://127.0.0.1:3001

Current focus: Axiom-parity QA, token desk accuracy (Token-2022 balances, indexer, PnL), wallet intelligence, predictions desk.

Rules: minimal diff, theme tokens, no scope creep, no commit unless asked. Trading tests: 0.001 SOL max. Compare behavior to axiom.trade when validating UX.

For full screen-by-screen QA, follow docs/CLAUDE_CODE_QA_PROMPT.md.
```

---

## Suggested next work

- Full Claude Code QA pass (`docs/CLAUDE_CODE_QA_PROMPT.md`) → prioritized fix list
- Register Helius webhook on deployed URL for sub-minute tape
- Wire `prependSwapInstructions` / ATA for Token-2022 on new buys
- Predictions order flow (if Kalshi keys present)
- Stretch column: populate `bonding_progress` in enrich cron
