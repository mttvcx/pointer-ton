# Pointer — Architecture Audit

> **Document type:** System inventory / architecture reference (documentation only — no code was changed to produce this).
> **Repository:** `pointer-ton` (`github.com/mttvcx/pointer-ton`)
> **Branch audited:** `web-mobile-responsive` (the web app at repo root). The native app under `apps/mobile/` lives on the `mobile-foundation` branch and is described from that branch + project docs.
> **Date:** 2026-06-26
> **Method:** Read-only static analysis of the source tree, the hand-authored Supabase schema (`lib/supabase/types.ts`), SQL bootstrap/migration scripts in `scripts/`, `vercel.json`, `.env.example`, and the in-repo engineering reports under `docs/`. Claims are grounded in `file:line` references where practical. Where a detail is inferred rather than directly proven, it is marked **(inferred)**.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Directory Map / Repo Skeleton](#2-directory-map--repo-skeleton)
3. [Databases (Postgres, Redis, Storage)](#3-databases-postgres-redis-storage)
4. [Authentication & Identity](#4-authentication--identity)
5. [Trading Pipeline (Buy)](#5-trading-pipeline-buy)
6. [Sell Pipeline](#6-sell-pipeline)
7. [Sniper / Automation (Auto-buy, Limit Orders, Rules)](#7-sniper--automation)
8. [Packs (Loot-box Commerce)](#8-packs-loot-box-commerce)
9. [Pulse / Token Discovery](#9-pulse--token-discovery)
10. [Token Desk](#10-token-desk)
11. [Indexer](#11-indexer)
12. [Wallet Intelligence](#12-wallet-intelligence)
13. [External Providers](#13-external-providers)
14. [Mobile App](#14-mobile-app)
15. [Admin Panel](#15-admin-panel)
16. [Cron Jobs](#16-cron-jobs)
17. [Webhooks](#17-webhooks)
18. [Deployment](#18-deployment)
19. [Logging & Error Reporting](#19-logging--error-reporting)
20. [Security Model](#20-security-model)
21. [Feature Flags & Modes](#21-feature-flags--modes)
22. [Known Issues & Tech Debt](#22-known-issues--tech-debt)
23. [Missing Production Infrastructure](#23-missing-production-infrastructure)
24. [Scaling Breakpoints](#24-scaling-breakpoints)
25. [Observability & Monitoring Gaps](#25-observability--monitoring-gaps)
26. [Code Ownership / Module Map](#26-code-ownership--module-map)
27. [Final System Map](#27-final-system-map)

---

## 1. Project Overview

**Pointer** is a Solana-first (with TON and EVM surfaces) memecoin trading terminal built as a single Next.js 16 App-Router application. It combines:

- A real-time token-discovery feed (**Pulse**) across launchpads (pump.fun, Bonk, Moonshot, Bags, Heaven, Meteora/DBC, Raydium) and chains (Solana, TON, ETH/BSC/Base).
- A one-click **trading** engine routed through Jupiter (Solana) and STON.fi (TON), with embedded non-custodial wallets via Privy.
- A per-token **desk** (chart, trades tape, top traders, holders, dev history) backed by a self-hosted Helius swap **indexer**.
- **Wallet intelligence** — a KOL/smart-money identity registry plus per-user tracked-wallet alerts.
- Monetization & growth surfaces: a 1%-class platform fee with **50% cashback** and **30% referral** rebates, gamified **points/leaderboard**, **Packs** (loot-box commerce), a creator portal, and preview shells for **perps** (Hyperliquid) and **predictions** (Kalshi).
- A full **admin control room** with RBAC, audit logging, account freeze, and emergency protective-sell.

### Stack at a glance

| Layer | Technology |
|---|---|
| Framework | Next.js **16.2.4** (App Router), React **19.2.4** |
| Language | TypeScript 5 (strict, `noUncheckedIndexedAccess`) |
| Runtime | Node.js ≥ 20 (Vercel; default runtime now Node 24 LTS) |
| Auth / Wallets | Privy (`@privy-io/react-auth` 3.x, `@privy-io/node`), TonConnect |
| DB | Supabase (Postgres) — project ref `ajngsbnwtkmkvbgpntkd` |
| Cache / RL | Upstash Redis (REST) + `@upstash/ratelimit` |
| Solana | `@solana/web3.js`, `helius-sdk`, `@pump-fun/pump-sdk` |
| TON | `@ton/ton`, `@ton/core`, `@tonconnect/ui-react`, `@ston-fi/sdk` |
| State | Zustand (38 stores) + TanStack React Query |
| UI | Tailwind 3.4, Radix primitives, lucide-react, sonner |
| AI | Anthropic + Google Gemini + OpenAI (cascade) |
| Charts | lightweight-charts, d3-force |
| Hosting | Vercel (git-triggered), single project/region |

The mobile app (`apps/mobile/`) is a separate **Expo / React Native** client (see §14) that consumes the same backend API; it is not part of the web build and is not a workspace member.

---

## 2. Directory Map / Repo Skeleton

Not a monorepo at the root (no `turbo.json` / `pnpm-workspace.yaml`); the web app *is* the repo root. `apps/mobile/` is a sibling Expo project tracked on its own branch.

```
pointer-ton/
├── app/                      # Next.js App Router
│   ├── (app)/                # Authenticated terminal routes (pulse, token/[mint], perps, admin, …)
│   ├── api/                  # All server route handlers (trade, cron, webhooks, admin, packs, identity, …)
│   ├── auth/                 # TonConnect / Privy callback flows
│   ├── beta/                 # Pre-launch invite gate
│   ├── portal/               # Creator portal (Discord-auth)
│   ├── share/                # Public PnL-card share pages
│   ├── providers.tsx         # Privy + React Query + Supabase client providers
│   ├── layout.tsx / page.tsx # Root layout + landing
│   └── globals.css
├── components/               # ~70 domain UI dirs (pulse, perps, packs, alerts, auto-buy, mobile, admin, …)
├── lib/                      # ~90 business-logic dirs (trading, jupiter, helius, indexer, ingest, packs, ai, db, auth, …)
├── store/                    # 38 Zustand stores (client state)
├── hooks/                    # Shared React hooks
├── scripts/                  # Migrations, webhook setup, backfills, QA, local cron runners
├── data/                     # Static seeds (identity KOL packs, fixtures)
├── docs/                     # Engineering reports & runbooks (HANDOFF, readiness, data-gap, …)
├── tests/                    # Node `--test` suites (founder beta, cashback math, indexer FK, packs)
├── anchor/                   # Solana Anchor program (devnet fee program)
├── public/                   # Static assets
├── apps/mobile/              # Expo native app (mobile-foundation branch)
├── vercel.json               # Crons + build config
├── .env.example              # 285-line env reference (only tracked env file)
└── tsconfig.json
```

### Key `app/api/**` route groups

| Group | Purpose |
|---|---|
| `api/trade/*` | `quote`, `execute`, `balance` — the money path |
| `api/pulse/*`, `api/tokens/*` | Feed, per-mint desk data (chain-trades, top-traders, holders, desk-wallet-stats, dev-tokens) |
| `api/cron/*` | 9 scheduled jobs (see §16) |
| `api/webhooks/helius` | Real-time enhanced-tx ingestion (see §17) |
| `api/packs/*` | Catalog, open, fulfill-resume |
| `api/admin/*` | Control-room endpoints (users, economy, flags, packs, identity, accounts, audit, …) |
| `api/identity/*` | KOL registry import/lookup |
| `api/presets`, `api/alerts*`, `api/limit-orders` | Trade presets, alert feed, limit orders |
| `api/onramper/*`, `api/predictions/*`, `api/perps` (via lib) | Fiat ramp, Kalshi, Hyperliquid |
| `api/reports/bug` | Unauthenticated diagnostics intake |

### NPM scripts (notable)

`dev` (port 3001), `build`, `start`, `lint`, `typecheck`, `gen:types` (Supabase), `setup:webhooks` / `update:webhook-url` / `test:webhook` (Helius), `backfill:*` and `replay:qa-swaps` / `verify:qa-indexer` (indexer QA), `cron:local` / `cron:loop` (local ingest), `test:packs`, `verify:founder-beta`, `test` (tsx runner).

---

## 3. Databases (Postgres, Redis, Storage)

### 3.1 Postgres (Supabase)

Schema source of truth is the hand-authored `lib/supabase/types.ts`, bootstrapped by `scripts/bootstrap-phase1-core.sql` and ~20 incremental SQL migrations in `scripts/` (e.g. `mint-swaps-indexer.sql`, `mint-index-status.sql`, `identity-schema.sql`, `admin-rbac.sql`). Access is via PostgREST: the browser uses the anon key (RLS-enforced); server routes use the service-role key. There are **no client-exposed Postgres transactions** — atomicity is achieved via `UNIQUE` constraints + idempotency keys rather than multi-statement transactions.

The schema spans roughly **55–57 tables + one materialized view + one storage bucket**, grouped by domain below. Column lists are representative, not exhaustive.

**User & auth**
- `users` — core identity (`privy_id` UNIQUE, `wallet_address`, `email`, `username`, `tier_id`, onboarding/beta timestamps).
- `user_tiers` — fee bps, AI quota, point multiplier.
- `user_wallets` — per-user wallet registry (`is_primary`, `slot`, `is_imported`, `is_active`, cached balance).
- `wallet_signer_provisions` — Privy embedded-wallet custody status.
- `admin_users`, `admin_roles`, `admin_user_roles`, `admin_audit_log` — RBAC + immutable-by-convention audit trail.

**Tokens & market**
- `tokens` — master mint registry (symbol, decimals, `creator_wallet`, `launch_pad`, `protocol_id`, `chain_id`, `migration_state`, `bonding_progress`, mint/freeze authority, `created_at`, `last_seen_at`).
- `token_market_snapshots` — time-series (price, mcap, liquidity, volume 5m/1h/24h, txns, holder count, top-10 %, dev %).
- `token_holders` — top-holder snapshots.
- `token_embeddings` — `vector(1536)` for similarity (AI).

**Trading**
- `trades` — executed swaps (side, raw amounts, `amount_sol`, `tx_signature` UNIQUE, `platform_fee_lamports`, priority/jito fees, status).
- `trading_presets` — per-user P1/P2/P3 config (buy amounts, slippage, dynamic slippage, MEV mode, priority/jito, auto-fee, max fee).
- `column_presets` — Pulse column filters/sort/display per user × column.
- `limit_orders` — pending price-triggered orders.
- `pnl_cards` — shareable PnL cards (`share_token` UNIQUE).

**Wallet tracking & stats**
- `tracked_wallets`, `tracker_groups`, `tracker_rules`, `wallet_labels` — per-user watchlists, folders, NL automation rules, nicknames.
- `wallet_stats` — global per-wallet profiling (PnL 24h/7d/30d, win rate, `is_kol`).
- `dev_wallet_stats` — launch track record (tokens launched/mooned/rugged, reputation).

**Mint indexing** (self-hosted swap index)
- `mint_swaps` — the swap tape (mint, signature, wallet, side, amounts, price, mcap, block_time, slot, program/pool, source).
- `mint_wallet_stats` — `(mint, wallet)` FIFO PnL (buy/sell sol+usd, avg prices, realized/unrealized, remaining).
- `mint_index_status` — per-mint indexing queue/progress (`status`, counts, `primary_pool`, `last_error`).

**Identity**
- `identity_profiles` — KOL/smart/sniper profiles (display name, socials, badges, verified, source_priority).
- `identity_wallets` — chain address → profile (`UNIQUE(chain, normalized_address)`).

**Alerts & notifications**
- `alert_rules` — pulse/twitter-listen/automation rule config (trigger + action + flash/audio).
- `alerts` — fired-alert instances (co-pilot feed).
- `push_subscriptions` — Web Push keys.

**Referrals, points, economy**
- `referral_codes`, `referrals`, `referral_earnings` (per-trade payout ledger).
- `user_points`, `points_events`, materialized view `points_leaderboard` (refreshed by cron).
- `cashback_ledger` — cashback accruals + admin grants.

**Packs**
- `pack_opens`, `pack_payments` (`payment_tx` UNIQUE = idempotency), `pack_inventory`, `pack_overrides` (admin forced outcomes with 2-tier approval).

**Admin economy & compliance**
- `admin_campaigns`, `admin_grants`, `account_controls` (freeze/suspend), `emergency_actions`, `bug_reports`.

**Social, webhooks, features, competitions, beta**
- `social_mentions`, `twitter_ingest_tweets`, `webhook_events` (`signature` UNIQUE dedup).
- `feature_flags`, `announcements`, `user_announcement_dismissals`.
- `championship_events`, `championship_participants`, `championship_finalizations`.
- `beta_codes`.

**Creator portal** (8 tables, Discord-auth domain, partly outside `types.ts`)
- `creators`, `creator_social_accounts`, `creator_verification_submissions`, `creator_video_submissions`, `creator_prize_pools`, `creator_appeals`, `creator_blacklist`, `creator_admin_audit`.

**AI**
- `ai_responses` — persistent (L2) cache of LLM responses (`cache_key`, pipeline, cost, model).

> **FK design note:** indexer tables intentionally avoid hard FKs to `tokens.mint` so ingestion never blocks on an unseen mint. Idempotency is enforced by UNIQUE constraints (`trades.tx_signature`, `pack_payments.payment_tx`, `webhook_events.signature`, `mint_swaps` signature-per-mint, `mint_wallet_stats(mint,wallet)`).

### 3.2 Redis (Upstash)

`lib/redis/client.ts` wraps the Upstash REST SDK in production and falls back to an **in-memory shim with TTL** in dev (non-persistent). Used for:
- **AI response cache** — `ai:{pipeline}:{input_hash}`, per-pipeline TTL (hot L1; `ai_responses` table is the L2 fallback).
- **Rate-limit counters** — public-API sliding window keyed by IP.
- **Webhook dedup** — `webhook:sig:{signature}`, 60s TTL (prevents double-processing).
- **Helius usage tracking** — daily counters.

Failure posture: missing creds in **prod throw** (explicit); in **dev** the shim is used. Public rate limiting **fails open** if Redis is unconfigured.

### 3.3 Storage

One Supabase Storage bucket — **`creator-verifications`** — holding creator verification video uploads under `{creator_id}/{account_id}/{timestamp}.{ext}` (written by `lib/db/creators.ts`).

---

## 4. Authentication & Identity

Two parallel auth schemes, unified behind the `usePointerAuth` hook (`lib/auth/pointerAuth.tsx`).

### 4.1 Privy (primary)
- Embedded **Solana** wallet auto-created for new users (`createOnLogin: 'users-without-wallets'`, `lib/privy/publicConfig.ts`); embedded Ethereum too; external connectors Phantom/Solflare/Backpack.
- Login methods: wallet, email, Google, Twitter OAuth.
- Provider wired in `app/providers.tsx`; env `NEXT_PUBLIC_PRIVY_APP_ID` (public) + `PRIVY_APP_SECRET` (server).
- Server-side signing for protective sells uses `PRIVY_AUTHORIZATION_PRIVATE_KEY` (EC256) + `PRIVY_SIGNER_KEY_QUORUM_ID`.

### 4.2 TON proof + Pointer session JWT
- TonConnect wallet signs a nonce; `lib/ton/tonProofService.ts` verifies pubkey ↔ state_init ↔ address derivation, domain allowlist, ≤15-min timestamp freshness, payload-hash replay guard, and the Ed25519 (NaCl) signature.
- On success, `lib/auth/pointerSession.ts` issues an **HS256 JWT** (`POINTER_SESSION_SECRET`, 7-day expiry, iss `pointer-ton`, aud `pointer-api`), stored in `sessionStorage`.

### 4.3 Server token verification
`verifyPrivyAccessToken()` (`lib/privy/config.ts`) tries the Pointer HS256 JWT first, then falls back to the Privy SDK (JWKS + identity token). Routes manually extract `Authorization: Bearer …` and resolve the DB user via `getUserByPrivyId()` — there is **no global auth middleware**; each route guards itself.

### 4.4 Wallet key handling
- **Export** (`/api/wallets/export-key`) is gated by token + DB-synced user + wallet ownership + **not-imported** check; requires Google re-auth in the UI; uses Privy HPKE client-side export with a server fallback. Keys are never logged.
- **Imported** wallets are view-only — `lib/auth/importKeyDerive.ts` derives only the public address client-side; trading with them is blocked.

### 4.5 Creator portal
Separate Discord-OAuth session (`lib/creators/session.ts`): httpOnly cookie `pointer_creator_session`, 30-day, `CREATOR_PORTAL_SESSION_SECRET` (falls back to `POINTER_SESSION_SECRET`), admin gating via `CREATOR_ADMIN_DISCORD_IDS`.

### 4.6 Identity registry
Distinct from auth: `identity_profiles`/`identity_wallets` map chain addresses → KOL profiles (see §12), surfaced as wallet labels and desk filters.

---

## 5. Trading Pipeline (Buy)

Two client entry points share one quote→sign→execute stack:
- **Quick-buy** (`lib/hooks/usePulseQuickBuy.ts`) — a one-at-a-time FIFO queue (`queueRef` + `drainingRef`) with depth-1 quote prefetch (8s TTL) so the next buy's quote warms while the current signs. Powers both manual taps and silent auto-buy.
- **Spot panel** (`lib/hooks/useSpotTradeExecution.ts`) — per-mint buy/sell.

**Stage 0 — Gates (client):** sandbox mode (`lib/sandbox/trade.ts` → fake fill), founder-beta mobile block (<1024px), wallet connected & not view-only, finite amount, access token present, spend-asset resolution (SOL/USDC).

**Stage 1 — Quote (`POST /api/trade/quote`, `app/api/trade/quote/route.ts`):** auth + DB user + trading-freeze gate + wallet-authorization. For SOL it calls Jupiter (`lib/jupiter/quote.ts`): resolves fee bps via `getFeeBpsForUser()` (or pack override), derives the platform **fee account ATA** from `JUPITER_REFERRAL_ACCOUNT`, fetches the quote (ExactIn/ExactOut, dynamic slippage), then builds the swap tx (`lib/jupiter/swap.ts`) with **landing mode**: `jito` (tip) when MEV mode = reduced/`Fast`, else `rpc` with priority-fee/auto-fee. A **Blitz** allowlist (`lib/trading/blitz.ts`) force-upgrades enrolled wallets to Jito with floor tips. Returns base64 unsigned `VersionedTransaction` (SOL) or a TonConnect payload (TON).

**Stage 2 — Sign (`lib/hooks/usePointerTradeSubmit.ts`):** embedded wallets **sign-only** (server broadcasts via private Helius RPC — public RPC rejects with #8100002); external wallets **signAndSend** and pass the signature through. TON uses `tonConnectUI.sendTransaction` (wallet broadcasts; returns BOC).

**Stage 3 — Execute (`POST /api/trade/execute`):** broadcasts the signed tx (`lib/solana/broadcast.ts` → `sendRawTransaction(maxRetries:5)`, falling back from private Helius to public RPC on quota errors), inserts the `trades` row as **`confirmed` immediately** (no confirmation loop — the submitted signature is trusted), then runs best-effort side effects (each wrapped in try/catch): fee recording, **cashback** accrual, **referral** earning, points, activity/alerts, and **portfolio ingestion** (`ingestExecutedSolSwap` → Helius enhanced-tx → `mint_swaps` + recompute). `maxDuration = 30s` keeps the function alive for broadcast + fallback.

**Fees & rebates (`lib/cashback/*`, `lib/referrals/*`):** platform fee is collected on-chain by Jupiter into the Pointer fee account (the **Tangem** wallet — see memory). Off-chain ledgers credit **50%** cashback to the trader (`cashback_ledger`, `CASHBACK_SHARE_BPS=5000`) and **30%** to the referrer (`referral_earnings`, `REFERRAL_FEE_SHARE_BPS=3000`); both idempotent on `trade_id`. Pack-item sells use a 200-bps fee and are **excluded** from cashback.

---

## 6. Sell Pipeline

Same `quote → sign → execute` stack as buy, with three sell entry shapes:
1. **Sell %** — `GET /api/trade/balance` → `tokenRawForSellPct(balance, pct)` (integer bps math) → ExactIn quote (token → SOL).
2. **Sell SOL-out** — ExactOut quote for a fixed SOL output.
3. **"Sell Init"** — reads the locally-tracked cost basis (`pointer-instant-cost-ton-v1:*` localStorage) and sells exactly that SOL notional, clearing the basis on success.

Sell-specific logic: `isSellPackOrigin(user, mint)` flags pack-origin tokens → 200-bps fee, no cashback, and `consumePackInventory()` (FIFO) after execution. PnL display merges **session localStorage** stats with **DB desk stats** (`lib/trading/deskWalletDisplayStats.ts`), taking the max of each so externally-made trades aren't undercounted; unrealized PnL = remaining tokens × live price. React Query invalidation (`tokenDeskRefresh.ts`) refreshes balance, desk-wallet-stats, and the wallet list.

---

## 7. Sniper / Automation

| Feature | Status | Mechanism |
|---|---|---|
| **Auto-buy** (silent) | ✅ Live | `components/auto-buy/AutoBuyExecutor.tsx` subscribes to the aggressive alerts ticker (`keepWhenHidden: true` so background tabs keep firing) and calls `buyToken(mint, sol, { silent:true })`. Safeguards: per-rule cooldown (30s default), UTC daily SOL cap (5 default), in-flight dedup. Store: `store/autoBuy.ts` (localStorage). |
| **Twitter-triggered** | ✅ Live | Entire automation rule engine is Twitter-first. Triggers: `keyword`, `ca_detected` (incl. media OCR/CA), `image_match` (perceptual hash), `interaction`, `pfp_change`, `banner_change`. Backend ingests the X stream → `alert_rules`; client polls the ticker. |
| **Automation rules** | ✅ Live | `lib/alerts/automationRuleModel.ts` (`AutomationRule`): trigger + action (`buy`/`sell`/`notify`/`deploy`), `disableAfterSuccess`, cooldown, daily cap, flash/audio. Executors: auto-buy, auto-sell (`AutoSellExecutor.tsx`, evaluates positions ~30s, MC/gain/time conditions), auto-launch. Global **kill switch** via `store/trackAutomation.ts`. |
| **Limit orders** | ✅ Live (trigger-only) | `POST /api/limit-orders` → `limit_orders`; cron `check-limit-alerts` (every 2 min) prices via Jupiter and fires `markLimitOrderTriggered` + push notification. **Execution is manual** — the user taps to trade after the trigger. |
| **Copy trading** | ❌ Not implemented | No follow/copy-buy code exists. Tracked wallets only *alert*; they do not auto-replicate trades. |

---

## 8. Packs (Loot-box Commerce)

A non-custodial loot-box product (`lib/packs/*`, `app/api/packs/*`, `components/packs/*`).

- **Catalog** — 4 tiers (Bronze/Silver/Gold/Legendary) in `lib/packs/packTemplates.ts`; per-tier cards-per-open, rarity ladder (common→mythic), and outcome kinds (`token_reward`, `legendary_reward`, `cashback_multiplier`, `points_multiplier`, `rare_access_badge`). **Dynamic pricing** maps live SOL/USD to a target USD price (`lib/packs/pricing.ts`).
- **RNG** — `lib/packs/openPack.ts` rolls each card with `Math.random()` → cumulative-probability slot pick. Internally deterministic but **not provably fair**; the code carries `TODO(fairness): commit-reveal / VRF`.
- **House edge** — mathematically enforced ≥ **22%** (`MODELED_HOUSE_EDGE_MIN_BPS = 2200`, max full-open EV 78%) in `lib/packs/packEconomics.ts`. Probabilities must sum to 10,000 bps; an invalid config **rejects the open** (HTTP 500). Recent commits rebalanced edge into a 22–30% band and made fulfillment idempotent/resumable.
- **Settlement** — `lib/packs/fulfillRewards.ts` (server-only) buys each token reward on Jupiter from the **treasury** keypair (`PACKS_TREASURY_SECRET_KEY`, hot wallet) and transfers to the user's ATA. **Idempotent + resumable**: `listDeliveredRewardIds(openId)` skips delivered rewards, detects treasury-held tokens from a prior failed transfer, and persists to `pack_inventory` per success. Non-token rewards (multipliers/badges) are credited off-chain.
- **Payments** — `pack_payments.payment_tx` UNIQUE guards idempotency; `pack_opens` audits the roll; `after()` runs fulfillment post-response with a `/api/packs/fulfill-resume` retry path.
- **Live gate** — `liveCommerceActive() = PACKS_LIVE_COMMERCE_ENABLED && isPacksTreasuryConfigured()` (`lib/packs/mode.ts`). `PACKS_OPEN_USES_SIMULATED_LEDGER = true` currently means opens use the simulated ledger unless treasury is funded/enabled.
- **Admin** — overrides (`jackpot`/`legendary_elite`/`epic_surge`) with 2-tier approval for high-value outcomes; full audit in `pack_overrides`.
- **Compliance gaps (acknowledged TODOs):** region gate, age verification, and per-user daily spend/cooldown are **no-op stubs** today.

---

## 9. Pulse / Token Discovery

**Feed** — `app/(app)/pulse/page.tsx` → `GET /api/pulse/feed` (legacy alias `/api/tokens/feed`), served by `lib/server/pulseFeedRoute.ts` with an 18s timeout and graceful empty-on-timeout. In-process cache (`lib/server/cachedPulseFeed.ts`) keyed `column:chain`: **<4s fresh / 4–20s stale-while-revalidate / >20s blocking recompute** (no cross-instance Redis cache). Cold columns (<6 rows) sync-poll once.

**Discovery cron** (`discover-tokens`, every 15 min → `lib/ingest/livePipeline.ts`): sources are **Helius DAS** (Solana, launchpad authorities / owner-wallet fallback, ~2 credits/call), **TonAPI** jettons (TON), and **GeckoTerminal** new pools (ETH/BSC/Base). Inserts into `tokens`. `POINTER_PAUSE_INGEST=1` is the global kill switch.

**Column gates** (`lib/pulse/columnGates.ts`, thresholds in `PULSE_THRESHOLDS`):
- **NEW** — not migrated, age ≤ 240 min (widened from 30 min so founder-beta without a cron still shows tokens).
- **STRETCH** — not migrated, age ≤ 48h, `bonding_progress ≥ ~85%` OR (liquidity ≥ $2k OR holders ≥ 50). Currently **sparse** (needs a bonding-progress enrichment cron).
- **MIGRATED** — `migrated_at != null`; real DexScreener + holder data.

**Enrichment cron** (`enrich-pulse`, every 15 min): per chain, take visible tokens (≤24/column), enrich via **DexScreener** (12s timeout → `token_market_snapshots`) and, SOL-only, **metrics** (pump.fun bonding curve, Moralis/Helius holders, social) with a 20s timeout. Ranking is chronological (recency), not metric-ranked.

---

## 10. Token Desk

Per-mint surface at `app/(app)/token/[mint]/*`, all reading the self-hosted swap index:
- **Trades tape** — `GET /api/tokens/[mint]/chain-trades` from `mint_swaps`; if empty, kicks off a background index and returns `label:'indexer_pending'`. Each wallet is classified (creator, insider/bundler, fresh, LP, funding source).
- **Top traders** — `GET …/chain-top-traders` → `lib/indexer/chainTopTraders.ts` FIFO realized PnL + win-rate ranking (top 25).
- **Desk wallet stats** — `GET …/desk-wallet-stats?wallet=` from `mint_wallet_stats` (or derived live from swaps); merged with session localStorage (§6).
- **Holders** — top-20 from Moralis (or Helius GPA fallback); total count needs `MORALIS_API_KEY` (else honest `—`).
- **Dev tokens** — other launches by `creator_wallet`.

On-demand kickoff: `lib/indexer/kickoffMintIndex.ts` starts a backfill when a desk opens cold (skips if indexed <2 min ago).

---

## 11. Indexer

Self-hosted Helius swap indexer (`lib/indexer/*`, `lib/helius/*`).

- **Backfill** (`backfillMintSwaps.ts`): `resolveIndexerTargets(mint)` discovers pool/program targets (DexScreener pairs + pump.fun PDA), paginates Helius **enhanced-tx** (`fetchHeliusAddressTransactions`, page 100), parses each tx → `mint_swaps`, derives `mint_wallet_stats` (FIFO), records `mint_index_status`.
- **Swap parser** (`parseSwapFromEnhancedTx.ts`): detects buy/sell by token-flow direction, extracts SOL/token amounts, price, mcap, and `event_kind` (swap / add_liq / remove_liq, with a 0.5-SOL remove-liq floor).
- **Orchestration** (`multiMintBackfill.ts`): cron `index-active-mints` (every 20 min) backfills top visible mints (maxMints 8, maxPages 4, stale gate 20 min). `retry-failed-indexes` (every 30 min) re-runs mints whose status is `failed` (e.g. Helius 429), honestly recorded in `last_error`.
- **Cost reality** — enhanced-tx calls are ~**100 credits each** (not the ~2 originally assumed; this 50× correction drove the cron throttle that cut Helius-burning calls ~85%). See memory [[helius-credit-guardrails]].
- **Ingestion modes** — webhook (sub-second, optional/registered separately), cron (2–5 min lag, the production default), and tracked-wallet polling.

---

## 12. Wallet Intelligence

- **Identity registry** (`lib/identity/*`, schema `scripts/identity-schema.sql`): `identity_profiles` + `identity_wallets`, bootstrapped from 12 committed JSON seeds in `data/identity/` (Kolscan/GMGN KOLs across SOL/ETH/Base/BNB). Hydrated into memory from Postgres on first request; survives restarts. Bulk import via `POST /api/identity/import` (admin-gated) accepting Kolscan/GMGN/Axiom/CSV/paste formats, deduped by source priority.
- **Tracked wallets** (`tracked_wallets`): per-user watchlists, seeded with starter KOL packs (`lib/trackers/starterWalletPacks.ts`, ~20 addresses across chains) on first auth.
- **Trade alerts**: two paths feed `tracked_wallet_trade` alerts + Web Push — the Helius **webhook** (real-time) and the **`poll-tracked-wallets`** cron (every 20 min, ≤25 wallets/run, ~200 credits). UI bridge: `components/providers/WalletTrackerAlertBridge.tsx`.
- **Global wallet stats**: cron `aggregate-wallet-stats` (hourly :15) computes 7d/30d FIFO PnL, win rate, volume into `wallet_stats`; `refresh-kol-stats` (every 30 min) updates KOL leaderboards.

Limitations: total holder counts need Moralis; sub-second tape needs the webhook; only 12 seed KOLs until imports run.

---

## 13. External Providers

| Provider | Purpose | Criticality | Env | Fallback |
|---|---|---|---|---|
| **Helius** | Solana RPC, DAS discovery, enhanced-tx index, webhooks | **Critical** | `HELIUS_API_KEY` / `NEXT_PUBLIC_HELIUS_API_KEY` | `SOLANA_RPC_URL` (dev) |
| **Jupiter** | Swap quotes/routes, platform fee | **Critical** | `JUPITER_QUOTE_URL`/`SWAP_URL`, `JUPITER_REFERRAL_ACCOUNT` | none |
| **Jito** | MEV-protected landing / tips | Medium | hardcoded tip accounts | send without tip |
| **Privy** | Auth + embedded wallets | **Critical** | `…PRIVY_APP_ID`, `PRIVY_APP_SECRET` | none (blocks app) |
| **Supabase** | Postgres + storage | **Critical** | `…SUPABASE_URL`, anon + service-role | none |
| **Upstash Redis** | cache / RL / dedup | High | `UPSTASH_REDIS_REST_*` | dev in-memory shim |
| **DexScreener** | market data | Medium | none (public) | timeout-skip |
| **Moralis** | holder counts | Low | `MORALIS_API_KEY` | honest `—` |
| **pump.fun** | launch/bonding data | High | on-chain parse | webhook+DAS |
| **TonAPI / TON Center** | TON discovery + proof | Medium | `TON_API_*`, `TON_CENTER_*` | sparse TON |
| **GeckoTerminal** | EVM new pools | Medium | none | sparse EVM |
| **Hyperliquid** | perps data | Medium (preview) | `HYPERLIQUID_INFO_URL` | none |
| **Kalshi** | predictions | Low (preview) | `KALSHI_*` (RSA signing) | feature hidden |
| **Anthropic / Gemini / OpenAI** | AI cascade (Gemini→Haiku→Sonnet; OpenAI embeddings) | Medium | `*_API_KEY` | cascade fallback + cache |
| **Onramper** | fiat on-ramp | Low | `…ONRAMPER_API_KEY`, signing secret | widget hidden |
| **STON.fi** | TON swaps | Medium | `STONFI_REFERRAL_*` | none (TON only) |
| **Discord** | creator portal OAuth | Low | `DISCORD_CLIENT_*` | dev login |
| **SocialData / Coin Communities** | social (stub) | Low | keys present, **not wired** | empty |
| **Sentry** | error tracking | Optional | `…SENTRY_DSN` | silently disabled |

AI cascade (`lib/ai/cascade.ts`): Gemini Flash default → Claude Haiku on schema error → Claude Sonnet (deep mode), with per-user sliding-window + daily-cost-ceiling quotas (`lib/ai/quota.ts`) and Redis+DB caching.

---

## 14. Mobile App

`apps/mobile/` — a native **Expo / React Native** client on the `mobile-foundation` branch (not in the web build; not a workspace member). Per project memory ([[pointer-mobile-initiative]], [[mobile-design-lock]]):

- **Stack:** Expo + EAS, Privy for auth/embedded wallets, intended to consume the existing web API as a thin client (mobile = client, backend unchanged).
- **Strategy:** Solana-first, packs disabled on iOS (App Store policy), "go-big-social", FOMO screens rendered as a "Simple mode."
- **Design system:** React Native (not a rewrite), mono black/grey + a single accent, subtle physics-based motion; design system precedes screen build-out.
- **Known gotcha:** Expo Go caches bundled images by filename ([[expo-asset-cache-gotcha]]) — rename + full reload to bust.

Because the files are not on the audited branch, deeper specifics (screen inventory, navigation) are intentionally **out of scope here** and tracked on `mobile-foundation`.

---

## 15. Admin Panel

Control room at `app/(app)/admin/*` + `app/api/admin/*`.

- **Access:** `requireAdmin(req, permission)` (`lib/api/adminAuth.ts`) resolves a Privy/JWT user → RBAC context; a **break-glass** path accepts header `x-pointer-admin-secret` (`POINTER_ADMIN_SECRET`, constant-time compare) as synthetic superadmin; **bootstrap** superadmin via `ADMIN_BOOTSTRAP_EMAILS`/`ADMIN_BOOTSTRAP_WALLETS` (auto-grants `superadmin` on first `/admin` visit; 60s context cache).
- **RBAC:** ~20 granular permissions (`lib/admin/permissions.ts`) + `*` wildcard; every mutation writes `admin_audit_log` (actor, action, target, before/after, IP).
- **Pages:** Users (search, freeze/release/emergency-sell), Flags (toggle, `allow_prod`-gated), Economy (points/tier/cashback grants, referral payouts), Campaigns, Packs (opens + overrides), Identity (KOL labels), Bug Reports (triage), Championship (review/finalize), Audit (log viewer), AI Cache, Helius Usage.
- **Emergency controls (superadmin):** freeze/release (`account_controls`) and **emergency-sell** — Privy-server-signs a Jupiter exit for embedded-wallet users, broadcasts via private Helius RPC, logs to `emergency_actions` + audit.

**Missing/weak admin capabilities:** no global trading kill-switch (only per-user freeze), no role-management UI (roles via SQL seed), no manual trade reconciliation, no rate-limit tuning, no flag diff-history, no accounting export, no queue-depth visibility.

---

## 16. Cron Jobs

Defined in `vercel.json`; authorized by `CRON_SECRET` (Bearer or `x-cron-secret`, constant-time; dev allowed if unset). Internal indexer routes use `POINTER_CRON_SECRET`.

| Path | Schedule | Purpose |
|---|---|---|
| `discover-tokens` | `*/15 * * * *` | Helius DAS + TonAPI + Gecko discovery → `tokens` |
| `enrich-pulse` | `*/15 * * * *` | DexScreener + metrics → `token_market_snapshots` |
| `index-active-mints` | `*/20 * * * *` | Backfill top visible mints (`mint_swaps`/`mint_wallet_stats`) |
| `retry-failed-indexes` | `*/30 * * * *` | Re-index `failed` mints |
| `aggregate-wallet-stats` | `15 * * * *` (hourly) | Global `wallet_stats` (7d/30d FIFO) |
| `poll-tracked-wallets` | `*/20 * * * *` | Tracked-wallet swaps → alerts + push |
| `refresh-kol-stats` | `*/30 * * * *` | KOL leaderboards (`maxDuration 60`) |
| `check-limit-alerts` | `*/2 * * * *` | Price-trigger limit orders + push |
| `refresh-leaderboard` | `*/15 * * * *` | Refresh `points_leaderboard` view |

A deprecated `pulse-poll` route forwards to `discover-tokens` for legacy schedules. `POINTER_PAUSE_INGEST=1` short-circuits ingest crons. Crons run as Vercel scheduled functions — no external worker/queue.

---

## 17. Webhooks

**`POST /api/webhooks/helius`** — the only inbound webhook.
- **Auth:** `Authorization: Bearer {HELIUS_WEBHOOK_AUTH_TOKEN}` (constant-time, `lib/helius/webhooks.ts`).
- **Watched accounts:** pump.fun, pump-swap, Bonk, Moonshot, Bags, Heaven, Meteora/DBC, Raydium AMM/CLMM (+ optional QA mint) — `lib/helius/heliusWebhookConfig.ts`.
- **Dedup:** Redis signature claim, 60s TTL (`lib/helius/webhookDedup.ts`).
- **Processing** (`processHeliusWebhookBody`): records `webhook_events`, upserts token launches, parses migrations (pump.fun graduation), fires tracked-wallet trade alerts + push, and optionally ingests QA-mint swaps.
- **Failure mode:** 401/400/500; **Helius does not retry** failed deliveries — no DLQ/replay, so processing failures lose the event.
- **Registration:** manual via `scripts/setup-helius-webhooks.ts` / `update-webhook-url.ts` (stores `HELIUS_WEBHOOK_ID`). The webhook is **optional** — production currently relies on the cron path; the firehose form was disabled after it burned ~300k credits (see [[helius-credit-guardrails]]).

---

## 18. Deployment

- **Host:** Vercel, `framework: nextjs`, git-triggered (`vercel.json`). Install `npm install --legacy-peer-deps --include=dev`, build `npm run build`. Single project, single region (default US). Latest deployment domain `pointer-ton-orcin.vercel.app` (per migration notes).
- **Config:** `vercel.json` defines only crons + build (no rewrites/headers/regions). (Platform note: `vercel.ts` is the newer recommended config format, not adopted here.)
- **Env:** secrets live in gitignored local env files + Vercel project env; **only `.env.example` is tracked** (`.gitignore` excludes `.env`, `.env.local`, `.env.*.local`). ~50 server-only vars + ~30 `NEXT_PUBLIC_*`.
- **Migrations:** manual SQL scripts in `scripts/` (no automated migration runner). **No staging environment** — changes deploy straight to production. Rollback = revert + redeploy.

---

## 19. Logging & Error Reporting

- **Logging:** vanilla `console.*` throughout, with ad-hoc tag prefixes (`[helius-indexer]`, `[redis]`, `[rate-limit]`, `[bug-report]`). No structured/JSON logger.
- **Sentry:** optional (`@sentry/nextjs`, server + edge configs). Disabled silently if DSN unset. Trace sample rates low in prod (~4–6%), `sendDefaultPii:false`.
- **Bug reports:** `POST /api/reports/bug` (unauthenticated, rate-limited) → optional Discord/Slack webhook (`BUG_REPORT_WEBHOOK_URL`) **and** durable `bug_reports` row; wallet masked client-side; a client error ring buffer (`lib/reports/clientErrorRing.ts`) attaches recent errors.
- **Usage telemetry:** AI cost per call (`ai_responses`), Helius daily usage counters + an admin Helius-usage page, rate-limit counters in Redis.

---

## 20. Security Model

> **Correction to an automated finding:** an upstream scan flagged "`.env.local` committed with live keys." This is **false** — `git ls-files` shows only `.env.example` is tracked, and `.gitignore` excludes all real env files. No secret values are reproduced in this document.

**Strengths**
- Strong auth: Privy (JWKS) + TON Ed25519 proof (replay/timestamp/domain guarded) + HS256 session JWT; dual-path server verification.
- Hot keys are server-only (`server-only` import guard on `PACKS_TREASURY_SECRET_KEY`, Privy authorization key); private-key export gated by ownership + not-imported + re-auth.
- RBAC with granular permissions, constant-time secret comparisons (admin break-glass, cron, webhook), and an admin audit log.
- Public-API rate limiting (`lib/rate-limit/publicEdge.ts`, Upstash sliding window, per-IP, ~120/min) on token/price/report endpoints.

**Genuine gaps / observations**
- **No global auth middleware** — each route self-guards (consistent but easy to miss on a new route).
- **No per-user rate limiting** on authenticated routes (only public-IP limits + global account freeze); no per-user trade-volume cap or sell cooldown.
- TON session JWT lives in **plaintext `sessionStorage`** (cleared on logout, not encrypted); **no CSP** headers observed; **no explicit Origin/CSRF check** on `POST /api/auth/sync`.
- Admin context cached 60s (role revocation lags up to 60s); audit log is a normal table (immutable only by convention).
- Packs treasury is a **hot wallet** — fund conservatively + monitor.

---

## 21. Feature Flags & Modes

| Flag | Env / store | Default | Gates |
|---|---|---|---|
| Founder Beta | `NEXT_PUBLIC_FOUNDER_BETA` | off | desktop-only (≥1024px), reduced buy presets, **hard-locks** sandbox + demo off (`lib/beta/founderBeta.ts`) |
| Sandbox | `NEXT_PUBLIC_POINTER_SANDBOX_MODE` / localStorage | off | simulated ledger (no real swaps); blocked under founder beta (`lib/sandbox/mode.ts`) |
| UI Demo | `NEXT_PUBLIC_UI_DEMO_MODE` / localStorage / `?explore_demo=` | off | synthetic empty-state rows; hard-locked off in prod/founder beta (`lib/dev/uiDemoMode.ts`) |
| Championship Demo | `NEXT_PUBLIC_CHAMPIONSHIP_DEMO` | inherits UI demo | demo leaderboard fixtures |
| Packs live | `PACKS_LIVE_COMMERCE_ENABLED` + treasury | code const | live vs simulated opens (`lib/packs/mode.ts`) |
| Pulse tech labels | `NEXT_PUBLIC_POINTER_PULSE_TECH_LABELS` / localStorage | off | QA protocol/source labels on rows |
| QA mint | `POINTER_QA_MINT`/`_ONLY` | unset | restricts hydration/index to one mint |
| Pause ingest | `POINTER_PAUSE_INGEST` | off | kill switch for all ingest crons |
| Beta gate | `BETA_GATE_ENABLED` | off | invite-cookie wall (`lib/beta/middleware.ts`) |
| RQ devtools | `NEXT_PUBLIC_RQ_DEVTOOLS` | off | React Query panel (dev only) |
| Twitter autobuy | `POINTER_TWITTER_AUTOBUY` | off | server-side auto-buy on mentions |
| DB-backed flags | `feature_flags` table | — | admin-toggleable, `allow_prod`-gated |

---

## 22. Known Issues & Tech Debt

From `docs/` reports (HANDOFF, FOUNDER_BETA_READINESS, DATA_GAP_AND_API_BLOCKERS, AXIOM_READY) + code markers:

**Synthetic-data guards (founder-beta P0s, addressed by gating behind demo mode):** trade-perf chips, dev-section stats, wallet-intel rows, global-search metrics, and chain tape/top-traders were each previously synthesized or QA-mint-only; the fix is honest `—` / empty states + the generalized indexer driving real UI.

**Preview / Phase-2 surfaces (not fully live):** Perps & stock-perps (read-only shells — order signing Phase 2, margin hardcoded 0); Squads (chat UI, actions toast "Phase 2", no copy-trade); Points/$PTR token mechanics; Referral UI (ledger exists, UI Phase 2); Predictions (Kalshi data wired, order placement may be preview); Packs (simulated ledger until treasury live); Championship (scoring exists, full loop TBD).

**Honest data gaps (need paid APIs):** total holder counts > ~10k (Moralis), Jupiter 429s (paid tier), Squads reputation (Ethos), rich X profile data (X API), insider/bundler aggregates (heuristics/paid).

**Code-level TODOs:** onramper key rotation; packs region/age/spend gates; referral payout automation (Phase 3 fee program); Ethos/stocks/token-metrics stubs returning `null`.

**Indexer debt:** Stretch column sparse (no bonding-progress cron); sub-second tape needs webhook; Token-2022 buy ATA prep TODO.

---

## 23. Missing Production Infrastructure

- **No durable queue** — the trade queue is **in-memory in the browser** (`usePulseQuickBuy` `queueRef`); a refresh mid-flight loses queued jobs. No server-side job processor (Bull/Temporal/QStash).
- **No real-time layer** — tape/alerts are cron-driven (2–5 min lag); the webhook exists but isn't the default and isn't auto-registered.
- **Single region / single DB** — one Supabase instance, no read replicas, no cross-region failover, no circuit breakers on external APIs (Helius 429 is recorded, not auto-retried within a run).
- **Partial idempotency** — money paths keyed on signatures/`trade_id`/`payment_tx` are safe, but admin emergency-sell, cashback grants, and referral payout marking lack request-level idempotency keys.
- **No staging env**, no automated migration runner, no secrets-manager integration, no blue-green/canary, no post-deploy health gate.
- **Testing** — solid unit/integration coverage (fees, pack economics, RBAC, founder-beta) via Node `--test`, but **no E2E/load/SAST** in CI.

---

## 24. Scaling Breakpoints

Likely first limits as usage grows (analysis, grounded in the above):

1. **Helius credits** — enhanced-tx ~100 credits/call dominates cost. `index-active-mints` (8 mints × 4 pages) + `poll-tracked-wallets` (25 wallets) + DAS discovery are the burn centers; the throttle bought headroom but credit budget is the hard ceiling on indexer breadth. Needs per-day budget monitoring + alerting.
2. **In-memory trade queue** — fine per-tab, but offers no durability, no cross-device serialization, and no backpressure under burst auto-buy.
3. **Pulse feed cache is per-instance** — the 4s/20s SWR cache is in-process; under multi-instance Vercel scale, cache hit rate drops and DAS/DexScreener load rises (a shared Redis feed cache would fix this).
4. **`mint_swaps` growth** — 100k–1M rows/month; desk queries paginate, but unbounded retention + no archival will pressure query latency and storage. Indexes on `(mint, block_time)`, `(mint, wallet)` are the load-bearing ones.
5. **Single Supabase instance** — all reads + writes share one Postgres; analytics/indexer reads compete with user reads (no replica).
6. **Cron serialization** — Vercel crons are independent functions, but a slow enrich/index run can overlap the next tick; no orchestration/locking visible beyond stale gates.
7. **Materialized leaderboard** — `points_leaderboard` refreshed by cron; refresh cost grows with users/points volume.

---

## 25. Observability & Monitoring Gaps

What exists is listed in §19. Gaps:

- **No request tracing / APM** (no OpenTelemetry) — can't correlate latency across quote→sign→execute or cron stages.
- **No structured logs** — `console.*` only; not machine-aggregatable.
- **No alerting** on cron failures, Helius 429 spikes, webhook gaps, feed staleness, or trade p95 latency — issues surface from users first.
- **No proactive Helius credit alarm** — usage is recorded + viewable but not threshold-alerted.
- **No webhook DLQ/replay** — failed webhook processing is lost.
- **Sentry optional** — a misconfigured DSN silently drops prod errors.

---

## 26. Code Ownership / Module Map

The codebase is organized by domain rather than by team (single-owner project). The load-bearing modules:

| Domain | Primary modules |
|---|---|
| Money path | `lib/hooks/usePulseQuickBuy.ts`, `usePointerTradeSubmit.ts`, `useSpotTradeExecution.ts`, `app/api/trade/*`, `lib/jupiter/*`, `lib/trading/*`, `lib/solana/broadcast.ts` |
| Economy | `lib/cashback/*`, `lib/referrals/*`, `lib/points/*`, `lib/db/{trades,presets,referrals,points}.ts` |
| Discovery/feed | `lib/ingest/livePipeline.ts`, `lib/pulse/columnGates.ts`, `lib/market/dexscreenerPulse.ts`, `lib/server/{pulseFeedRoute,cachedPulseFeed}.ts` |
| Indexer | `lib/indexer/*`, `lib/helius/*` |
| Wallet intel | `lib/identity/*`, `lib/ingest/{pollTrackedWallets,aggregateWalletStats,refreshKolStats}Job.ts`, `lib/db/{identities,wallets}.ts` |
| Packs | `lib/packs/*`, `app/api/packs/*`, `lib/db/packs.ts` |
| Auth/security | `lib/auth/*`, `lib/privy/*`, `lib/ton/*`, `lib/api/adminAuth.ts`, `lib/admin/permissions.ts`, `lib/rate-limit/*`, `lib/cron/authorize.ts` |
| Admin | `app/(app)/admin/*`, `app/api/admin/*`, `lib/db/admin.ts` |
| AI | `lib/ai/*` |
| State | `store/*` (38 stores), `app/providers.tsx` |
| DB access | `lib/db/*` (one module per table family), `lib/supabase/*` |

---

## 27. Final System Map

```
                          ┌──────────────────────────────────────────────┐
   Browser (Next.js)      │  app/(app)/* + Zustand(38) + React Query      │
   + Expo mobile (sep.)   │  usePulseQuickBuy ▸ queue ▸ prefetch          │
                          └───────────────┬──────────────────────────────┘
                                          │ Bearer (Privy JWT / Pointer HS256)
                ┌─────────────────────────┼───────────────────────────────────┐
                ▼                         ▼                                   ▼
        /api/trade/quote          /api/trade/execute                 /api/pulse/feed
        Jupiter quote+swap        broadcast (Helius RPC→public)       in-proc SWR cache
        fee acct = Tangem         insert trade(confirmed)             column gates
                │                 ├ cashback 50%  (cashback_ledger)         │
                │                 ├ referral 30%  (referral_earnings)       │
                │                 ├ points + activity/alerts                │
                ▼                 └ ingest swap ▸ Helius enhanced-tx         ▼
        Privy embedded wallet            │                          tokens / snapshots
        (sign-only)                      ▼                                  ▲
                                  mint_swaps / mint_wallet_stats            │
                                         ▲                                  │
        ┌────────────────────────────────┼──────────────────────────────────┘
        │                    CRONS (Vercel, 9)        WEBHOOK
        │  discover(15) enrich(15) index(20) retry(30)  /api/webhooks/helius
        │  aggregate(60) poll-wallets(20) kol(30)        (dedup 60s, no DLQ)
        │  limit-alerts(2) leaderboard(15)                     │
        ▼                                                      ▼
   Helius DAS / enhanced-tx ◀── credits ($) ──▶  tracked-wallet alerts + Web Push
   DexScreener / Moralis / TonAPI / Gecko / pump.fun

   Datastores:  Supabase Postgres (≈56 tables + 1 mview + 1 bucket)
                Upstash Redis (AI cache / rate-limit / webhook dedup)
   Auth:        Privy (embedded SOL wallet) + TON proof → HS256 session
   Admin:       RBAC + break-glass + audit; freeze + emergency-sell
   Money out:   Jupiter platform fee → Tangem wallet; 50% cashback / 30% referral ledgers
   Treasury:    PACKS_TREASURY_SECRET_KEY hot wallet (packs fulfillment)
```

**One-paragraph synthesis.** Pointer is a single Next.js 16 app on Vercel fronting Supabase Postgres + Upstash Redis, with Privy embedded wallets signing Jupiter swaps that are broadcast server-side through private Helius RPC. A self-hosted Helius enhanced-tx indexer populates `mint_swaps`/`mint_wallet_stats` to power the per-token desk, while 9 crons + an optional webhook keep the Pulse feed, wallet alerts, and leaderboards fresh. Monetization rides a Jupiter platform fee (to the Tangem fee wallet) rebated 50% to traders and 30% to referrers, alongside Packs loot-box commerce with an enforced ≥22% house edge. The architecture is feature-complete on the happy path and well-guarded for a founder beta, with the principal production risks being Helius credit budget, the in-memory/cron-based (non-durable, non-real-time) execution + ingestion layers, single-region single-DB topology, and thin observability.

---

*End of audit.*
