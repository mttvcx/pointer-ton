# Pointer

Solana memecoin trading terminal with a built-in AI co-pilot.
**Phase 1 — internal alpha.** Token discovery (Pulse), token detail with buy/sell,
wallet tracking, AI co-pilot panel.

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
cp .env.example .env.local       # fill in keys (Privy + Supabase for auth/data)
npm run gen:types                # one-time: generate Supabase types
npm run dev
```

Open **http://127.0.0.1:3001** — dev is pinned to port **3001** in `package.json` (not :3000). Set `NEXT_PUBLIC_APP_URL` in `.env.local` to the same origin. Use `npm run dev:3000` if you prefer port 3000 and update `.env.local` accordingly.

## Scripts

| script               | purpose                                  |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Start Next.js dev server on port **3001** |
| `npm run dev:3000`   | Same, on port **3000**                   |
| `npm run build`      | Production build                         |
| `npm run start`      | Run production build                     |
| `npm run lint`       | ESLint                                   |
| `npm run typecheck`  | `tsc --noEmit`                           |
| `npm run format`     | Prettier write                           |
| `npm run gen:types`  | Regenerate `lib/supabase/types.ts`       |

## Project structure

See `PHASE-1-PROMPT.md` for the canonical structure. Highlights:

- `app/` — App Router pages and API routes.
- `components/{layout,tokens,wallets,ai,shared}/` — feature components.
- `lib/{privy,supabase,db,helius,solana,jupiter,ai,onchain,social,utils}/` —
  every external boundary lives here. **API routes never call SDKs directly.**
- `lib/db/*.ts` — typed wrappers for every table. **No raw SQL in routes.**
- `lib/ai/cascade.ts` — single chokepoint for every LLM call. Cache, quota,
  rate limit, model selection, cost recording.
- `lib/db/tiers.ts` — `getFeeBpsForUser`, `getAIQuotaForUser`. Phase 1 returns
  the single `default` tier; Phase 5 swaps the function body to read token
  holdings without touching feature code.

## Phase-1 boundaries

Things explicitly **out of scope** (leave `// TODO Phase 2` markers):

- Mobile app, multi-chain (no Base/BNB), perps, copy-trading, leaderboards UI,
  referral system, our own token / TGE, custom on-chain fee program.

## Notes

- Tooling: this repo uses **npm**. The Phase 1 prompt mentions `pnpm`; switch
  by running `corepack enable pnpm` and committing a lockfile.
- Tailwind is v3 to match the `tailwind.config.ts` design-token shape in the
  prompt. Migrate to v4 only after shadcn primitives are stable in v4.
