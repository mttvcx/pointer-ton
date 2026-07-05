# Sibyl — next-step checklist

MVP shipped: intent → model router → 7-provider abstraction → 8 agents → judge →
CT-native answer + interactive cards, standalone liquid-glass dashboard at `/sibyl`,
mock mode (zero keys), DexScreener real, `/api/sibyl/chat` + `/status`, memory store,
docs. Build MVP first — this list is the road to "best crypto AI in the world."

## Data (turn mock → real)
- [ ] **Pointer moat provider** → read the real identity registry + `community_labels`
      + KOL directory (read-only; no coupling to trade paths). This is the #1 edge.
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
- [ ] `sibyl_entities` Supabase table + swap the in-process store; add a vector index
      for semantic recall ("tokens like this one").
- [ ] Every scan enriches the graph (upsert token/wallet/KOL/narrative + relations).

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
