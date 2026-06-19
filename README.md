# Pointer

Solana memecoin trading terminal with a built-in AI co-pilot.  
**Phase 1 — founder beta / internal alpha.**

> **New agent or Claude Code?** Read **[`HANDOFF.md`](./HANDOFF.md)** first (full project state as of 2026-06-13).  
> **Full QA vs Axiom:** copy-paste prompt in **[`docs/CLAUDE_CODE_QA_PROMPT.md`](./docs/CLAUDE_CODE_QA_PROMPT.md)**.

## What ships today

| Area | Status |
|------|--------|
| Pulse discovery (NEW / STRETCH / MIGRATED) | Live |
| Token desk + buy/sell (Jupiter / Pump) | Live |
| Chain trades / top traders / desk PnL (indexed mints) | Live |
| Token-2022 balances (pump tokens) | Live |
| Wallet tracking + KOL import + starter packs | Live |
| Portfolio | Live |
| Predictions desk (Kalshi markets) | Live data, preview trading |
| Perps / stock perps / packs commerce | Preview / simulated |
| AI co-pilot | Live (rate + cost capped) |

**Benchmark:** [axiom.trade](https://axiom.trade) — Pointer matches *behavior* and data honesty, not a pixel clone.

## Stack

- **Framework:** Next.js 16 App Router · React 19 · TypeScript strict
- **Styling:** Tailwind CSS v3 · shadcn/ui (neutral, dark default)
- **State:** Zustand (client) · TanStack Query v5 (server)
- **Auth:** Privy embedded wallets (Solana)
- **Database:** Supabase (Postgres · pgvector · Realtime · RLS)
- **Cache & queues:** Upstash Redis
- **Solana:** `@solana/web3.js@1` · `@solana/spl-token@0.4` · Helius RPC + Sender + Jito
- **Trading:** Jupiter API v6 (Referral Program for platform fees)
- **AI cascade:** Gemini Flash → Claude Haiku 4.5 → Claude Sonnet 4.6
- **Embeddings:** OpenAI `text-embedding-3-small`
- **Charts:** TradingView Lightweight Charts v4

## Getting started

```bash
npm install
cp .env.example .env.local       # fill in keys — see Helius, Privy, Supabase sections
npm run gen:types                # one-time: generate Supabase types
npm run dev
```

Open **http://127.0.0.1:3001** — dev is pinned to port **3001** in `package.json`. Set `NEXT_PUBLIC_APP_URL` in `.env.local` to match.

**Founder beta QA:** set `NEXT_PUBLIC_FOUNDER_BETA=1` for **0.001 SOL** min buy presets (smallest reliable Jupiter size).

**Required for Solana:** `HELIUS_API_KEY`, Supabase, Privy. Full list: `.env.example`.

## Scripts

| script | purpose |
| ------ | ------- |
| `npm run dev` | Start Next.js dev server on port **3001** |
| `npm run dev:3000` | Same, on port **3000** |
| `npm run build` | Production build |
| `npm run test` | Unit tests (237+) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run gen:types` | Regenerate `lib/supabase/types.ts` |
| `npm run backfill:active-mints` | Manual chain indexer backfill |
| `npm run cron:loop` | Local ingest loop (discover → enrich → index) |
| `npm run setup:webhooks` | Register Helius webhook (needs public HTTPS URL) |

## Documentation map

| File | Use when |
|------|----------|
| [`HANDOFF.md`](./HANDOFF.md) | **Start here** — routes, status, env, recent fixes |
| [`AGENTS.md`](./AGENTS.md) | Coding rules for agents |
| [`docs/CLAUDE_CODE_QA_PROMPT.md`](./docs/CLAUDE_CODE_QA_PROMPT.md) | Full QA run vs Axiom (copy-paste for Claude Code) |
| [`AXIOM_READY_EXECUTION_REPORT.md`](./AXIOM_READY_EXECUTION_REPORT.md) | Indexer verification matrix |
| [`REALTIME_INGESTION_REPORT.md`](./REALTIME_INGESTION_REPORT.md) | Cron + webhook ingest runbook |
| [`WALLET_INTELLIGENCE_IMPLEMENTATION_REPORT.md`](./WALLET_INTELLIGENCE_IMPLEMENTATION_REPORT.md) | KOL registry & tracked wallets |

## Project structure

- `app/` — App Router pages and API routes
- `components/` — UI by feature (tokens, layout, predictions, …)
- `lib/{db,helius,solana,jupiter,indexer,identity,predictions}/` — all external boundaries
- `lib/db/*.ts` — typed DB access (**no raw SQL in routes**)
- `lib/ai/cascade.ts` — single LLM chokepoint

See `PHASE-1-PROMPT.md` (parent workspace) for the original Phase 1 spec.

## Phase-1 boundaries (out of scope)

Mobile app, copy-trading, leaderboards UI, referral payouts, our token / TGE, mainnet custom fee program, advanced charting, full perps signing.

Mark with `// TODO Phase 2` — do not scope-creep.

## Helius Pulse webhook (local dev)

Solana Pulse ingests via `POST /api/webhooks/helius`. Requires **public HTTPS** (ngrok) for local registration — see `.env.example` and `npm run setup:webhooks`.

Production: set `NEXT_PUBLIC_APP_URL` + `CRON_SECRET`; Vercel crons run discover/enrich/index automatically (`REALTIME_INGESTION_REPORT.md`).

## Notes

- Tooling: **npm** (not pnpm unless you migrate the lockfile).
- Tailwind v3 matches `tailwind.config.ts` design tokens — do not invent ad-hoc colors in components.
