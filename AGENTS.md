# AGENTS — Pointer

> Source of truth for agents working on this repo. Read this before editing.
> The full Phase 1 spec lives in `PHASE-1-PROMPT.md` at the workspace root
> (one level above this project).

## Stack snapshot

- Next.js **16** App Router (note: prompt says 15; latest stable is 16 and
  the App Router APIs are unchanged for our usage), React 19, TS strict
- Tailwind v3 + shadcn/ui (neutral, dark default), Zustand, TanStack Query v5
- Privy + Supabase + Upstash Redis + Helius + Jupiter v6
- Anthropic + Gemini + OpenAI (embeddings only)
- `@solana/web3.js@1` (NOT v2), `@solana/spl-token@0.4`

## Hard rules

1. **No raw SQL in API routes.** Every DB write goes through `lib/db/*.ts`.
2. **No direct LLM SDK calls in feature code.** Use `lib/ai/cascade.ts`.
3. **Every API boundary uses Zod.** No untyped request/response bodies.
4. **Phase-5 token mechanics live behind these abstractions** — modify
   the function body when the time comes, not the call sites:
   - `getFeeBpsForUser(userId)` in `lib/db/tiers.ts`
   - `getAIQuotaForUser(userId)` in `lib/db/tiers.ts`
   - `user_tiers` table (Phase 1 has one row: `default`)
   - `user_points` table — insert rows from day one, no UI yet
5. **Design tokens** live in `tailwind.config.ts` and `app/globals.css`.
   Do not invent ad-hoc colors. Tabular numbers on every financial readout
   (use `font-mono` or apply `font-variant-numeric: tabular-nums`).
6. **Trader density**: default `text-sm`, headers `text-base`/`text-lg`.
   Compact, never cramped. `rounded-md` for cards, `rounded-sm` for buttons.
7. **Don't scope-creep.** Anything outside Phase 1 → `// TODO Phase 2`.
8. **Supabase DDL:** After adding/renaming columns, run
   `scripts/reload-postgrest-schema.sql` in the SQL editor so PostgREST picks up
   the change. Otherwise you get `Could not find the <col> column ... in the
   schema cache.`

## Solana specifics

- Connection: `lib/solana/connection.ts` (Helius RPC).
- **Devnet fee program (Step 8):** Anchor sources in `anchor/` (`pointer_fee`).
  TS helpers: `lib/solana/pointerFee.ts`. Env: `POINTER_FEE_PROGRAM_ID`.
- Submission: `submitTransaction` posts to **Helius Sender + Jito bundle in
  parallel**, returns whichever signature lands first, polls
  `getSignatureStatus` to confirm.
- Always set CU limit (600K–1.4M) and dynamic priority fee.
- Always include Jito tip ix.
- ATA prepended for buys when user doesn't already hold the output mint.
- Jupiter quote always passes `platformFeeBps` (from `getFeeBpsForUser`)
  and `feeAccount` (referral token account, derived per output mint).

## AI specifics

- Cascade: Gemini Flash (default) → Claude Haiku 4.5 retry → Claude Sonnet
  4.6 only for `mode: 'deep'`.
- Validate every model output with the matching Zod schema in
  `lib/ai/schemas.ts`.
- Cache to Upstash with key `ai:{pipeline}:{input_hash}`. TTLs in
  `lib/utils/constants.ts` (`AI_CACHE_TTL`).
- Persist every call to `ai_responses` (cost, model, cache hit).
- Award `user_points` for AI calls (use `lib/db/points.ts`, multiplier
  from `user_tiers`).
- Per-user **rate limit** 50 calls / 5min and **cost ceiling** $0.30/day
  enforced server-side.

## File-system conventions

- Path alias `@/*` resolves to project root.
- Co-locate component files; one component per file in `components/`.
- API routes are thin: parse with Zod → call `lib/db/*` or `lib/<domain>/*`
  → return JSON. No business logic in route handlers.

## Out of scope (Phase 1)

Mobile-specific layout, Base/BNB, leaderboards UI, copy-trading, referral
system, our own token / TGE, **mainnet** custom on-chain fee program
integration (devnet Anchor scaffold lives in `anchor/`), advanced charting,
notifications beyond in-app ticker, marketing site beyond placeholder.
