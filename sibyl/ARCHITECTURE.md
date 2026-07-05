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
| `helius` | holders / transfers / wallet activity | light-real (holders) w/ `HELIUS_API_KEY` |
| `birdeye` | OHLCV / holders | stub (`BIRDEYE_API_KEY`) |
| `dune` | terminal fees / market share | stub (`DUNE_API_KEY`) |
| `x` | CT mentions / velocity | stub (`TWITTER_BEARER_TOKEN`) |
| `grok-or-search` | narrative origin / off-platform spread | stub (`XAI_API_KEY`) |

Every provider exports a `*Status()` (configured? env vars? note) — surfaced at
`GET /api/sibyl/status` and the dashboard footer.

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
