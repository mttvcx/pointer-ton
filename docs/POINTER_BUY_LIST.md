# Pointer — What to Buy / Connect (definitive list)

Last updated 2026-06-21. Ordered by priority. "Env" = the variable to set in Vercel
(Project → Settings → Environment Variables) after you get the key.

## 🔴 HIGH — do first
### 1. Helius — Developer plan (~$49/mo)
- **Unlocks:** 10M credits/mo + 50 req/s (vs free 1M + 10 req/s). Kills the 429
  stalls (wallet modal "loads forever", ingestion contention) and gives headroom
  for on-demand token metadata (names/pics) + KOL backfill.
- **Why urgent:** the free 1M is effectively already maxed — the enhanced-tx API
  bills ~100 credits/call (not 2), and `discover-tokens` alone burns ~36k/day.
- **How:** dashboard.helius.dev → Billing → Developer. Same API key, just upgrade.
- **Env:** `HELIUS_API_KEY` (already set — no change, plan upgrade only).

## 🟡 MEDIUM
### 2. 3rd-party X data reseller (usage-based, cheap for beta)
- **Unlocks:** rich X-tracker cards (verified badge, follower count, display name,
  avatar, retweet/reply context) **and** live tweet-rule firing (today the @-rules
  are a local builder; this makes them fire on real tweets).
- **Pick one:** twitterapi.io · socialdata.tools · apify (all resell full tweet
  objects far cheaper than official X API for beta volume).
- **Env:** provider key (I'll wire the exact var when you pick one).

### 3. Moralis ($49 Starter / $199 Pro)
- **Unlocks:** total holder count + holder-strip metrics on token desks/Pulse
  (the `—` holder pills). Code is already built; it no-ops without the key.
- **Env:** `MORALIS_API_KEY`. — moralis.io

### 4. Jupiter API key (optional, usage-based)
- **Unlocks:** higher quote/swap rate ceiling → fewer 429s under quick-buy spam.
  Trading already works free on lite-api; this is just headroom.
- **Env:** `JUPITER_API_KEY` (auto-attaches when set).

## 🟢 FREE — just claim / apply
### 5. TradingView Advanced Charts (free)
- **Unlocks:** pro charting. **Not paid** — you apply at tradingview.com with your
  **domain** (so you need the domain first). Keep TV attribution.
- **Env:** none.

### 6. Ethos (free / early-access key)
- **Unlocks:** trader reputation badge on Squads profiles. Hides cleanly without it.
- **Env:** `ETHOS_API_KEY`.

## ⏳ LATER — post-launch
### 7. Kalshi (US-only key + real funds)
- **Unlocks:** real prediction-market order placement. Browsing needs no key.
- **Status:** Predictions is now **branched off main** (`predictions-market`) and
  hidden — re-enable once you have the US key as an established terminal.
- **Env:** `KALSHI_API_KEY_ID` + `KALSHI_PRIVATE_KEY`.

### 8. LLM key (AI copilot) — optional
- **Unlocks:** AI co-pilot / cascade features. Use the latest Claude (recommended).
- **Env:** `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY` / `GOOGLE_GEMINI_API_KEY`).

---
**TL;DR to be "ready":** Helius Developer (now) → pick an X data reseller → Moralis
→ grab the TradingView domain. Kalshi waits for post-launch.
