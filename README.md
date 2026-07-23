# Pointer

Pointer is a high-performance Solana trading terminal with live market intelligence, wallet tracking, execution tooling, and an integrated AI copilot.

Live product: [pointer-ton.vercel.app](https://pointer-ton.vercel.app)

## Product

| Area | Status |
| --- | --- |
| Token discovery and migration tracking | Live |
| Token desk and Jupiter/Pump execution | Live |
| Chain trades, top traders, and desk PnL | Live for indexed markets |
| Wallet tracking and identity resolution | Live |
| Portfolio | Live |
| Prediction markets | Live data, preview execution |
| Perpetuals and stock perpetuals | Preview |
| AI copilot | Live with server-side rate and cost controls |

Pointer distinguishes live, preview, and simulated capabilities in the interface. Market data and transaction paths are never silently synthesized.

## Architecture

- **Application:** Next.js 16 App Router, React 19, strict TypeScript
- **Interface:** Tailwind CSS, shadcn/ui
- **State:** Zustand, TanStack Query
- **Identity and wallets:** Privy
- **Data:** Supabase Postgres, pgvector, Realtime, row-level security
- **Caching and queues:** Upstash Redis
- **Solana:** Helius RPC and Sender, Jito, Jupiter
- **AI routing:** Gemini and Anthropic with schema validation and centralized cost controls
- **Charts:** TradingView Lightweight Charts

External boundaries are isolated behind typed modules. API inputs are validated with Zod, database writes flow through the data layer, and model calls pass through a single controlled cascade.

## Local development

```bash
npm install
cp .env.example .env.local
npm run gen:types
npm run dev
```

The development server runs on [127.0.0.1:3001](http://127.0.0.1:3001).

Required integrations and environment variables are documented in `.env.example`.

## Verification

```bash
npm run typecheck
npm run test
npm run build
```

The repository includes unit, integration, security, and data-boundary tests covering execution, wallet intelligence, identity resolution, and ingestion workflows.

## Repository map

| Path | Purpose |
| --- | --- |
| `app/` | Routes, layouts, and API handlers |
| `components/` | Product interface by feature |
| `lib/db/` | Typed database access |
| `lib/solana/` | Solana transaction and account boundaries |
| `lib/jupiter/` | Quotes and execution |
| `lib/indexer/` | Discovery and enrichment |
| `lib/identity/` | Wallet and trader identity |
| `lib/ai/` | Model routing, validation, and cost controls |
| `tests/` | Automated verification |

## Current stage

Pointer is a founder-beta product. Live capabilities require configured providers and credentials; preview surfaces are labeled in-product.
