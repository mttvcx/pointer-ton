# Sibyl by Pointer

The intelligence engine for crypto — Solana memecoins, CT, KOL wallets, narratives,
on-chain markets. Read `ARCHITECTURE.md` first.

Lives (for now) inside the Pointer Next.js app; future home: **ai.pointer-ton-orcin.vercel.app** (until pointer.trade is acquired).

## Run it locally

```bash
npm install --legacy-peer-deps
npm run dev          # pointer-ton dev server (default :3001)
# open  /sibyl
```

**Zero keys required.** With no model/provider keys, Sibyl runs in **mock mode** —
the whole pipeline (agents → judge → cards) works offline so you can build the UX.
DexScreener is real even in default mode (public API).

## Mock mode

- Auto: on when no model gateway key is set.
- Force on:  `SIBYL_MOCK=1`
- Force off: `SIBYL_MOCK=0` (then real keys are used)
- Check state: `GET /api/sibyl/status` → `{ mock, providers[], plans[] }`

## Required to go "smart" (models)

Set ONE gateway key (OpenAI-compatible). OpenRouter is the default base URL.

```bash
OPENROUTER_API_KEY=...            # or SIBYL_MODEL_API_KEY / GROQ_API_KEY
# optional base + model overrides (defaults below, all verified live on OpenRouter):
SIBYL_MODEL_BASE_URL=https://openrouter.ai/api/v1/chat/completions
SIBYL_MODEL_CHEAP=google/gemini-2.5-flash
SIBYL_MODEL_REASON=deepseek/deepseek-chat
SIBYL_MODEL_TOOL=google/gemini-2.5-flash
SIBYL_MODEL_JUDGE=google/gemini-2.5-pro
```

## Optional data providers (unlock real intelligence)

```bash
HELIUS_API_KEY=...          # holders / chain (shared with pointer-ton)
BIRDEYE_API_KEY=...         # OHLCV / holders
DUNE_API_KEY=...            # terminal fees / market share
TWITTER_BEARER_TOKEN=...    # CT mentions / velocity (shared with X monitor)
XAI_API_KEY=...             # Grok live-search narrative  (or SEARCH_API_KEY)
```

Missing a key → that provider mocks cleanly; the judge downgrades confidence and says
so in `caveats`. Never fabricates.

## Add a new model

`sibyl/modelRouter.ts` → add/point a tier via env (`SIBYL_MODEL_*`), or add a `ModelTier`
+ `modelForTier` case. Agents ask for a *tier*, never a model id.

## Add a new data provider

1. `sibyl/data/providers/<name>.ts` — export a `*Status()` + typed getters, each with a
   `sibylMockMode()` fallback.
2. Register in `sibyl/data/providers/index.ts`.
3. Consume it inside the relevant agent in `sibyl/agents/runners.ts`. Agents never import
   providers ad-hoc outside the registry.

## API (same layer as the UI)

```
POST /api/sibyl/chat   { query, tier? }  → { answer: SibylAnswer }
GET  /api/sibyl/status                    → { mock, providers, plans }
```

The public `/v1/*` product endpoints (token/analyze, wallet/intelligence, …) are thin
wrappers over `askSibyl()` — see CHECKLIST.

## Safety

Self-contained under `sibyl/`, `app/sibyl/`, `app/api/sibyl/`, `components/sibyl/`.
Does not touch Pointer web/mobile/extension trading paths. All new env vars are optional.
