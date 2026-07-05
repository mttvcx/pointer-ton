# Sibyl — Architecture

Sibyl is the intelligence engine for crypto Twitter, Solana memecoins, small-cap
crypto, KOL wallets, narratives, and on-chain markets. **Not a general chatbot.**
It wins not by having a smarter base model, but by combining specialist agents,
proprietary Pointer data, real-time chain + social data, and historical memory.

## The one intelligence layer

Dashboard chat, the future public API (`/v1/token/analyze` …), mobile, and the
extension all call the **same** entrypoint — never a second backend:

```
query ─▶ classifyIntent ─▶ clampModeToPlan ─▶ specialist fan-out ─▶ judge ─▶ SibylAnswer
        (sibyl/intent)     (sibyl/pricing)     (sibyl/agents)      (judge)   (cards + verdict)
```

- `sibyl/orchestrator.ts` — `askSibyl(query, tier)`. The layer everything shares.
- `sibyl/intent.ts` — deterministic classify → subject (token/wallet/person/narrative/
  market-question) + `ScanMode` + which agents to run. (Cheap-model upgrade later.)
- `sibyl/modelRouter.ts` — tiered models (`cheap`/`reason`/`tool`/`judge`), env-driven
  slugs, OpenAI-compatible gateway (OpenRouter default), **mock fallback**. This is the
  margin engine: 80–95% of calls stay cheap; only DEEP_SCAN/RESEARCH escalate.
- `sibyl/pricing.ts` — plan tiers + `clampModeToPlan` (the margin rule in code) + per-mode
  cost estimates.

## Agents (`sibyl/agents/`)

Specialists pull from the provider registry, emit CT-native `take[]` + interactive
`cards[]` + clickable `entities[]` + a self-confidence. The **judge** combines them,
rejects unsupported claims, and **downgrades confidence when data is missing**.

`market · wallet · narrative · social · risk (adversarial) · dune · analog · judge`

Voice + banned phrases live in `sibyl/agents/prompts.ts` (`SIBYL_STYLE`, `scrubBanned`).

## Providers (`sibyl/data/providers/`)

Agents never import a provider directly — they use the registry, so any provider can
be swapped/mocked/key-gated without touching agents.

| Provider | Role | State |
|---|---|---|
| `pointer` | labeled wallets / KOLs / classifications — **the moat** | **real** (bundled ~2,260-wallet identity registry + Twitter handles; DB labels layered) |
| `dexscreener` | price / liq / MC / vol | **real** (public API) |
| `helius` | holders / transfers / wallet activity | **real** with `HELIUS_API_KEY` (top-holder concentration) |
| `birdeye` | OHLCV / holders | stub (`BIRDEYE_API_KEY`; `REAL_IMPL=false`) |
| `dune` | terminal fees / market share | stub (`DUNE_API_KEY`; `REAL_IMPL=false`) |
| `x` | CT mentions / velocity | stub (`TWITTER_BEARER_TOKEN`; `REAL_IMPL=false`) |
| `grok-or-search` | narrative origin / off-platform spread | stub (`XAI_API_KEY`; `REAL_IMPL=false`) |

**Model mock ≠ data mock.** `sibylMockMode()` (no LLM gateway key) gates ONLY the
model layer — the judge/agent *narrative* is synthesized deterministically until an
`OPENROUTER_API_KEY` (or Groq) lands. It must never gate data. Data providers mock
only under `sibylForceMock()` (`SIBYL_MOCK=1`) or when their own credential is
missing — so a real `HELIUS_API_KEY` yields real holders even with zero model keys.
Providers whose real fetch isn't written yet carry a `REAL_IMPL=false` flag and keep
serving clean mock data until it's flipped (avoids showing empty "real" cards).

Every provider exports a `*Status()` (configured? env vars? note) — surfaced at
`GET /api/sibyl/status` and the dashboard footer (`liveProviders` count + model state).

## Memory (`sibyl/memory/`) — the compounding moat

Entities: person · wallet · token · narrative · group · news · dune_metric ·
historical_token · social_post. Each carries id, aliases, linked wallets/socials,
description, confidence, source, first/last seen, related entities. MVP is an
in-process store with a DB-shaped interface (drop-in `sibyl_entities` table / vector
store later). Sibyl should *remember*, not just answer.

## UI (`app/sibyl` + `components/sibyl`)

Standalone liquid-glass dashboard (outside the Pointer app chrome): left = saved
scans, center = chat, right = dynamic context cards. KOL/wallet names render blue and
link to X. Cards: token/chart/holders/wallet/kol/narrative/dune/risk/social/timeline/
similar (`SibylCards.tsx`), rendered from the typed `SibylCard` union.

## Answer contract (`sibyl/types.ts` → `SibylAnswer`)

`verdict` (short) · `confidence` (0–100) · `why[]` · `action` · `cards[]` ·
`entities[]` · `sources[]` · `agentsRun[]` · `caveats[]`. Short-first, then the right
panel expands the detail.
