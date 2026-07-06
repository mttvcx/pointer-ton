# Sibyl — next-step checklist

MVP shipped: intent → model router → 7-provider abstraction → 8 agents → judge →
CT-native answer + interactive cards, standalone liquid-glass dashboard at `/sibyl`,
mock mode (zero keys), DexScreener real, `/api/sibyl/chat` + `/status`, memory store,
docs. Build MVP first — this list is the road to "best crypto AI in the world."

## Data (turn mock → real)
- [x] **Pointer moat provider** → reads the real identity registry (~2,260 bundled KOL /
      smart-money wallets w/ Twitter handles) via `resolveWalletIdentity`; labels actual
      holders, resolves "is @person in this" (name→handle, e.g. ansem→blknoiz06), enriches
      handle links. `prepareIdentityRegistry()` layers DB community-labels best-effort.
      Read-only, works with zero keys (bundled seeds). Group/Discord mentions still mock
      (separate capture-tap source — next).
- [ ] Helius: resolve token-account → owner for holders; enhanced-tx wallet history;
      "which wallets are accumulating" (net-flow over N hours).
- [ ] Birdeye: real OHLCV → wire `ChartCard` to live candles (or reuse Pointer's
      lightweight-charts perps datafeed).
- [ ] Dune: create named queries (Axiom/Photon/Trojan/GMGN/FOMO fees + share) →
      `DUNE_QUERY_*` env ids; execute + cache.
- [ ] X: reuse pointer-ton `lib/twitter` for mentions/velocity once the bearer token
      is live; off-platform (TikTok/Reels/news) via Grok/search.
- [ ] Grok narrative: reuse `lib/ai/xaiGrok` for live X-grounded narrative origin.

## Intelligence
- [ ] Ticker → mint resolution (bare "$COBRA" → address) via DexScreener search + Pointer.
- [ ] Inline entity linkification in `why`/`body` (KOL/wallet names → blue links).
- [ ] Adversarial verify pass on DEEP_SCAN (N skeptics per risk claim, majority kills).
- [ ] Analog agent → real historical-token memory (populate `historical_token` entities).
- [ ] Streaming responses (SSE) for STANDARD/DEEP so the UI fills progressively.

## Memory
- [x] **Flywheel persisted** — `sibyl_scans` / `sibyl_entities` / `sibyl_outcomes` tables
      (scripts/sibyl-flywheel.sql, applied). Every scan writes through: scan captured,
      entities upserted with array-merge + seen_count (atomic `sibyl_record_entities`
      RPC), prediction snapshot opened, and prior predictions graded (multiple / rugged)
      — lazily on re-scan + via `/api/sibyl/outcomes/resolve`. Recall surfaces "analyzed
      N× before". Fail-open (memory never breaks a scan). Shared: rides `askSibyl()` so
      web / extension / mobile all enrich the same graph.
- [ ] Vector index on `sibyl_entities` for semantic recall ("tokens like this one").
- [ ] Feed recall back into the agents (prior verdict / accumulated wallet history in-prompt).

## Product / business
- [ ] Auth + plan resolution on `/api/sibyl/chat` (Privy tier → `clampModeToPlan`) +
      per-tier rate limits + daily counters.
- [ ] Public API `/v1/{token/analyze, wallet/intelligence, narrative/detect, risk/score,
      social/momentum, report/generate}` — thin wrappers over `askSibyl()`.
- [ ] Usage metering + margin dashboard (cost per mode from `MODE_COST_USD`).
- [ ] HOVER_FAST cache layer (deterministic cached facts, <0.8s).
- [ ] Stripe billing for FREE/PRO/PRO+/MAX + Enterprise contact-sales.

## Benchmark
- [ ] Internal crypto benchmark suite (narrative detection, wallet/holder analysis,
      scam/rug prediction, KOL influence, analog matching, attention forecasting).
- [ ] Eval harness comparing Sibyl vs GPT/Claude/Gemini/Kimi/GLM/DeepSeek/Qwen on it.
      Goal: highest score on crypto — general reasoning is irrelevant.

## Domain
- [ ] Point `ai.pointer.trade` at `/sibyl` once `pointer.trade` is acquired.
