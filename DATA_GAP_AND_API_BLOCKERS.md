# Data Gap & API Blocker Audit

**Date:** 2026-06-12
**Scope:** Every `—` (or `0` / `?` placeholder) still rendered in Token Info, Pulse
metric pills, the right-hand Token Info panel, and the social/metadata surfaces
(Islands / WIF rows). For each, we say what is wired today, what is missing, what
is genuinely behind a paid key, what we can build ourselves, and what the
intended disposition is in founder beta.

Legend — disposition:

- **Wire now** = implementable with what we have; deliver in this pass.
- **Build soon (S/M/L)** = buildable in-house; not in this pass.
- **Honest `—`** = leave as `—`; the data is not derivable without a paid source.
- **Tooltip-only** = render `—` plus an explanatory tooltip (already in place for
  several metrics, expanded here).
- **Paid gate** = requires a paid provider we don't have today (Moralis / Jupiter
  Pro / Helius paid tier / X paid tier).

---

## 1. Token Info grid (9 metric cells)

Rendered in `components/tokens/TokenInfoPanel.tsx`, populated by
`getTokenExtendedMetrics(mint)` → `lib/onchain/tokenMetrics.ts`.

| # | Metric      | UI value today           | Source today                                  | Backend missing?  | Paid-API blocked?                  | Buildable ourselves?                                                | Effort | Disposition              |
| - | ----------- | ------------------------ | --------------------------------------------- | ----------------- | ---------------------------------- | ------------------------------------------------------------------- | ------ | ------------------------ |
| 1 | Top 10 H.   | real % or `—`            | `resolveTokenHolders` (Helius DAS) → top-10   | No                | No                                 | Yes (already done)                                                  | —      | **Wire now** (done)      |
| 2 | Dev H.      | real % or `—`            | `resolveTokenHolders` + `fetchCreatorDevHoldingPct` | No              | No                                 | Yes (already done)                                                  | —      | **Wire now** (done)      |
| 3 | Snipers H.  | real % or `—`            | `is_sniper` flag from holder rows             | No                | No                                 | Yes (already done)                                                  | —      | **Wire now** (done)      |
| 4 | Insiders    | `—` always               | stub `null` in `tokenMetrics.ts`              | Yes (heuristic)   | No                                 | Partial — fresh-wallet + creator-funding cluster (Phase 2)          | L      | **Tooltip-only**         |
| 5 | Bundlers    | `—` always               | stub `null`                                   | Yes (heuristic)   | No                                 | Partial — launch-tx signature clustering (Phase 2)                  | L      | **Tooltip-only**         |
| 6 | LP Burned   | `—` always               | stub `null`                                   | Yes (heuristic)   | No                                 | Yes — derive from LP token account ownership (burn = null owner)    | M      | **Build soon** (M)       |
| 7 | Holders     | real int or `—`          | `resolveTokenHolders.holderCountTotal`        | No                | **Partial** (full count needs Moralis for >10k holder tokens) | Yes for ≤10k via Helius DAS `getTokenAccounts`; Moralis for full | S      | **Wire now (already)**; flag Moralis gap |
| 8 | Pro Traders | real int or `—`          | `countProTraders(holders)` — top-N heuristic  | No                | No                                 | Yes (top-N proxy of pro trading activity)                            | —      | **Wire now** (done)      |
| 9 | Dex Paid    | real bool or `—`         | `token.is_paid` from DB                       | Yes (no writer)   | No                                 | Yes — pump.fun `/coins/{mint}` returns paid flag                    | S      | **Wire now (this pass)** |

### Quick wins from this pass

1. **Dex Paid (`is_paid`)** — wire pump.fun paid-status during ingest so it
   becomes real instead of always `—`. See `lib/dex/pumpfunPaidStatus.ts`
   and call it in the snapshot writer.
2. **Holders total** — already wires real data when Helius DAS succeeds; will
   add a tooltipped note clarifying that counts >10k require a paid
   holder-source (Moralis) and we cap at Helius DAS coverage.
3. **LP Burned** — see "Buildable in-house" section below for the S/M recipe.
   Out of scope for this pass (medium effort, separate ticket).

---

## 2. Token-desk / activity tabs (Holders / Top Traders / Dev Tokens)

`components/tokens/TokenActivityTabs.tsx` + `app/api/tokens/[mint]/...`.

| Metric / surface | UI today                       | Source                                            | Missing?  | Paid? | Buildable?                                  | Effort | Disposition          |
| ---------------- | ------------------------------ | ------------------------------------------------- | --------- | ----- | ------------------------------------------- | ------ | -------------------- |
| Holders list     | table or "no data"             | `/api/tokens/[mint]/holders` (Helius DAS)         | No        | No    | Yes                                         | —      | **Wire now** (done)  |
| Top 10 H.        | top-10 rows                    | `/api/tokens/[mint]/holders`                      | No        | No    | Yes                                         | —      | **Wire now** (done)  |
| Top traders      | ranked list or "indexer pending" | `/api/tokens/[mint]/chain-top-traders`            | No        | No    | Yes (built from `mint_wallet_stats`)        | —      | **Wire now** (done)  |
| Dev tokens       | table or empty list            | `/api/tokens/[mint]/dev-tokens`                   | No        | No    | Yes                                         | —      | **Wire now** (done)  |
| Chain trades     | table or "indexer pending"     | `/api/tokens/[mint]/chain-trades`                 | No        | No    | Yes (mint_swaps via Helius enhanced txs)    | —      | **Wire now** (done)  |
| Indexer coverage | new `indexer_pending` label    | `mint_index_status` table                         | No        | No    | Yes                                         | —      | **Wire now** (done)  |

No regression. Acceptance: these surfaces still render honestly (real numbers
or honest "indexer pending" / empty) after the correction pass.

---

## 3. Pulse row metric pills (right column, "New / Migrating / Stretch")

`components/tokens/PulseColumn.tsx` + `components/tokens/cells/*`.

| Pill / icon            | UI today                        | Source today                                        | Missing?  | Paid?                          | Buildable?                                                | Effort | Disposition              |
| ---------------------- | ------------------------------- | --------------------------------------------------- | --------- | ------------------------------ | --------------------------------------------------------- | ------ | ------------------------ |
| Liquidity $            | real                            | `dexscreener.pairs[0].liquidityUsd`                | No        | No                             | Yes                                                       | —      | **Wire now** (done)      |
| FDV / Mcap             | real                            | DexScreener                                         | No        | No                             | Yes                                                       | —      | **Wire now** (done)      |
| 6h Vol                 | real                            | DexScreener aggregate                               | No        | No                             | Yes                                                       | —      | **Wire now** (done)      |
| Txns 6h                | real                            | DexScreener                                         | No        | No                             | Yes                                                       | —      | **Wire now** (done)      |
| Age                    | real                            | token `created_at` (DB ingest time, not chain time!) | Partial (chain launch vs DB row created) | No    | Yes — fetch from `getBlockHeight` + Helius RPC            | S      | **Build soon (S)**       |
| LP Locked icon         | `✓` / `—`                       | `token.is_lp_locked`                                | No writer | No                             | Yes — derive from LP account owner (LP burn = null owner) | M      | **Build soon (M)**       |
| Dex Paid icon          | `✓` / `—`                       | `token.is_paid`                                     | No writer | No                             | Yes — pump.fun `/coins/{mint}`                            | S      | **Wire now (this pass)** |
| Renounced icon         | `✓` / `—`                       | `token.mint_authority`                              | No        | No                             | Yes                                                       | —      | **Wire now** (done)      |
| Cashback icon          | `✓` / `—`                       | pump.fun metadata flags                             | No        | No                             | Yes                                                       | —      | **Wire now** (done)      |
| LP Locked %            | `—` always                      | stub `null` in `tokenMetrics.ts`                    | Yes       | No                             | Yes (account owner check)                                 | M      | **Build soon (M)**       |
| Top 10 H.              | real or `—`                     | same as #1 in section 1                             | No        | No                             | Yes                                                       | —      | **Wire now** (done)      |
| Dev H.                 | real or `—`                     | same as #2 in section 1                             | No        | No                             | Yes                                                       | —      | **Wire now** (done)      |
| Snipers                | real or `—`                     | same as #3 in section 1                             | No        | No                             | Yes                                                       | —      | **Wire now** (done)      |

---

## 4. Social / profile metadata (Token header + Pulse row social strip)

`components/tokens/PulseRichPopovers.tsx` + `lib/tokens/pulseSocialLinks.ts`.

| Field                 | UI today                                | Source today                                | Missing?  | Paid?                                        | Buildable?                                | Effort | Disposition            |
| --------------------- | --------------------------------------- | ------------------------------------------- | --------- | -------------------------------------------- | ----------------------------------------- | ------ | ---------------------- |
| Website hostname      | real or `—`                             | pump.fun `website` / Dex metadata           | No        | No                                           | Yes                                       | —      | **Wire now** (done)    |
| Twitter / X URL       | real or `—`                             | pump.fun `twitter` / Dex metadata           | No        | No                                           | Yes                                       | —      | **Wire now** (done)    |
| Telegram              | real or `—`                             | pump.fun `telegram`                         | No        | No                                           | Yes                                       | —      | **Wire now** (done)    |
| X handle display      | real or `—`                             | derived from URL                            | No        | No                                           | Yes                                       | —      | **Wire now** (done)    |
| X profile hover card  | banner + avatar + name + bio + followers | `useTwitterProfile` → `fxtwitter` / `x.com` | Yes (rich) | X API is paid, fxtwitter is public-scraped | Partial — fxtwitter works until X rate-limits | S      | **Wire now** (mostly; tooltip on degrade) |
| Follower count        | real or `—`                             | fxtwitter JSON                              | No        | No (best-effort)                             | Yes (best-effort)                         | —      | **Wire now** (done)    |
| Bio / description     | real or `—`                             | token.description / fxtwitter bio           | No        | No                                           | Yes                                       | —      | **Wire now** (done)    |
| Joined date           | `—` always (skeleton)                   | fxtwitter JSON contains it                  | No        | No                                           | Yes (display "Joined …")                  | XS     | **Wire now (this pass)** |
| Following count       | `—` always (skeleton)                   | fxtwitter JSON contains it                  | No        | No                                           | Yes                                       | XS     | **Wire now (this pass)** |
| Location              | `—` always                              | fxtwitter JSON contains it                  | No        | No                                           | Yes (render when present)                 | XS     | **Wire now (this pass)** |
| Verified badge        | `✓` / hidden                            | fxtwitter JSON                              | No        | No                                           | Yes                                       | XS     | **Wire now (this pass)** |

### What we're NOT doing for the X hover

- Avatar / banner fetched at high res (rate-limited by X CDN; keep fxtwitter).
- Real-time X following feed or pinned tweet.
- Paid X API tier (not in this budget).

---

## 5. Perps Funding Rate (perp market header)

| Metric           | UI today                 | Source today                   | Missing? | Paid? | Buildable? | Effort | Disposition        |
| ---------------- | ------------------------ | ------------------------------ | -------- | ----- | ---------- | ------ | ------------------ |
| Funding rate %   | real or `—`              | Hyperliquid `infoClient`      | No       | No    | Yes (HL API) | —      | **Wire now** (done) |

This lives in the Perps page (which is in Preview); not in Token Info.

---

## 6. Buildable-in-house quick wins (in this pass)

1. **Pump.fun paid-status ingest** — S effort, ~30 LOC writer that calls
   `lib/dex/pumpfunPaidStatus.ts` and persists `is_paid` to the `tokens` table
   during snapshot ingest. Removes a permanent `—`.
2. **Twitter profile hover card enrichments** — XS, ~20 LOC inside the
   existing `TwitterProfileHoverBody`: render `Joined`, `Following`,
   `Location`, `Verified` from fxtwitter response. Already partly wired
   (verified/joined/following were stubbed to "—"). Re-enable.
3. **LP Locked boolean ingest** — M effort, derive from
   `getAccountInfo` on the LP token account. If owner == null, treat as
   burned. Defer to a separate ticket.

---

## 7. Buildable-in-house later (not in this pass)

- **LP Burned %** — compute burn ratio from `lpLockedAmount` vs `totalSupply`
  for the LP mint. (M)
- **Bundlers** — cluster launch-block txs by signer + same-block
  buy-allocation pattern. (L)
- **Insiders** — fresh-wallet + creator-funding graph from indexer. (L)
- **Chain-launch `created_at`** — fetch the mint signature and read block
  time instead of `now()` at ingest. (S)
- **Pro Traders exact count** — needs full wallet history classification
  across all indexed mints; top-N proxy used today is fine. (L)

---

## 8. Paid-API blocked (won't ship without a key)

| Field                            | Why blocked                                                | Required key                   |
| -------------------------------- | ---------------------------------------------------------- | ------------------------------ |
| Holders total (when >10k)        | Helius DAS caps at page-level; need full holder inventory  | `MORALIS_API_KEY` (or similar) |
| Bulk portfolio / price 429s      | Jupiter free tier is rate-limited                          | `JUPITER_API_KEY` (paid plan)  |
| Multi-mint indexer at scale      | Free Helius credits cap monthly RPC + enhanced txs         | Helius paid plan               |
| Squads reputation                | Ethos score requires auth                                  | `ETHOS_API_KEY`                |
| Rich X profile (pinned, posts)   | X official API is paid; fxtwitter is best-effort scrape    | X API paid plan                |

---

## 9. Net change for this pass

- `lib/dex/pumpfunPaidStatus.ts` — new small module.
- `lib/ingest/snapshots.ts` (or equivalent) — call it during snapshot write.
- `components/tokens/PulseRichPopovers.tsx` — re-enable Joined / Following /
  Location / Verified in `TwitterProfileHoverBody`.
- `components/ui/hover-card.tsx` — `z-[400]` so hover always wins over topbar.
- `components/tokens/PulseRichPopovers.tsx` — `PulsePortaledHoverLayer`
  z-index `z-[400]` for parity.
- `components/layout/navConfig.ts` — restore Perps + Predictions with
  `badge: 'Preview'`.
- `app/(app)/perps/page.tsx` + `app/(app)/predictions/page.tsx` — Preview
  banner above the terminal / desk.

No regression: every previously wired real signal stays real; every previously
honest `—` that we cannot replace stays honest `—`; no synthetic data.
