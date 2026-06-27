# Pointer — Chrome Extension Readiness Audit (Master Blueprint)

**Source:** 16 read-only subsystem auditors against the live codebase → synthesis → adversarial honesty pass. No code was modified; nothing was built.

> **Verdict up front:** the **backend is a strong, caller-agnostic API surface** and is genuinely consumable by a third client. But the **delivery, auth, security, real-time, and ops scaffolding required to *safely expose* it to a cross-origin, untrusted public client do not exist yet.** Close the hardening list below **before** writing extension code — Pointer must not ship a client that *looks* ready while CORS, auth handoff, token revocation, and trade-confirmation reliability are open.

> _Note: this doc intentionally omits time estimates — it's an ordered list of what to do, not a calendar._

---

## 1. Current Architecture

Monolithic **Next.js 16 (App Router, React 19)** on Vercel — single project/region, git-triggered auto-deploy. **172 API route handlers** under `app/api/**`; **Supabase Postgres (~56–70+ tables + materialized views)** is the single source of truth. The Expo mobile app already consumes the same API — validating the backend-as-single-source model an extension would extend as a third client.

- **Auth:** dual-path — Privy (JWKS-verified access tokens; OAuth + embedded wallets) and TonConnect (Ed25519 proof → HS256 Pointer session JWT, 7-day). All requests use `Authorization: Bearer` (no first-party session cookie). RBAC via `admin_users/roles` + break-glass `x-pointer-admin-secret`.
- **State/data:** ~38 Zustand stores + React Query (8–30s polling); session JWT in sessionStorage.
- **Background:** 9 Vercel crons drive discovery/indexing/alerts. The Helius webhook is wired but **effectively disabled** (a prior any-txn firehose burned ~300k credits); **cron polling is the default indexing path** and there is **no swap-ingest webhook route**.
- **Caching/limits:** Upstash Redis (public rate-limit, AI quota/cost, dedup); in-process Pulse cache (4s fresh / 20s stale, per-instance only); edge runtime on 2 read paths.
- **Observability:** `ops_events`/`ops_metrics`/`ops_incidents` + Pointer Doctor; Sentry optional (likely unconfigured); console logging; no tracing.
- **Trading money path:** `/api/trade/quote` → `/api/trade/execute` (Jupiter for SOL, TonConnect payload for TON); broadcast via private Helius RPC with public fallback.

The strength is the clean, caller-agnostic API. The weakness is everything that converts "an API a tab calls same-origin" into "a public client running cross-origin from arbitrary websites": CORS, CSRF/origin isolation, per-user rate limiting, token revocation, real-time push, indexing durability (DLQ/webhook), staging/CI/rollback, and multi-client observability.

---

## 2. Can Pointer Support an Extension Today?

**yes** = consumable as-is · **partial** = works with material caveats/build · **no** = blocking gap.

| Category | Status | Why |
|---|---|---|
| API backend robustness (172 routes) | **yes** | Full coverage; consistent `{error,message}`; per-route guards; `nodejs` runtime on money paths |
| Database as source of truth | **yes** | Idempotent money paths (UNIQUE + idempotency keys); mobile proves multi-client reads |
| Core user data APIs (`/me`, `/wallets/my`, `/portfolio`) | **yes** | Complete schemas, FIFO PnL, holdings, balances |
| Token discovery & info | **yes** | `/tokens/[mint]/*`, `/search/resolve` (SOL/TON/EVM/ENS), `/prices/*`, `/pulse/feed` |
| Trading (quote + execute) | **partial** | **broadcast-then-record race** marks trades `confirmed` before on-chain confirmation; no idempotency key; no signer-vs-token-wallet check; no confirmation polling in the response path |
| AI features (explain-token/wallet/tooltip) | **partial** | Cascade + dual-layer cache + per-user quotas solid; no CORS; in-process dedup fails across serverless instances (10× duplicate-spend risk) |
| Alerts & notifications (config/CRUD) | **yes** | Full CRUD `/alert-rules`, `/trackers`; cron-driven firing |
| Web push infra (server-side) | **partial** | `web-push` + VAPID + `/push/*` + `push_subscriptions` + `public/sw.js` exist and fire on alerts; **extension service-worker delivery differs from web and is unverified**; no badge; no delivery telemetry/DLQ |
| Authentication mechanism (Bearer, not cookies) | **yes** | Token-in-header design is inherently extension-friendly |
| Extension-specific auth flow / OAuth in popup | **no** | Privy OAuth needs redirect context; TonConnect proof is domain-bound; embedded wallets need Privy SDK context; no handoff path designed |
| Token revocation / logout | **no** | Web logout clears client storage only; token valid up to 7 days; no blacklist, no `/auth/logout` |
| CORS / cross-origin access | **no** | Only `/tonconnect-manifest` sets CORS; the other 171 routes block `chrome-extension://` and fail POST preflight. **Hard blocker.** |
| CSRF / origin validation / security headers | **no** | No CSP, X-Frame-Options, X-Content-Type-Options, HSTS; SameSite=lax on some cookies |
| Rate limiting (authenticated/per-user) | **partial** | Public IP limiter (~120/min) on ~6 routes only; **no per-user limit on trade/AI/admin**; public limiter **fails open** if Redis down/disabled |
| Real-time updates (WS/SSE) | **no** | Zero WebSocket/SSE; no Supabase Realtime on user data; alerts/prices are 8–30s polling |
| Indexing durability (webhook + DLQ) | **no** | Helius webhook disabled; no swap-ingest route; **no DLQ** — dropped events are lost; expect 2–5 min indexing lag |
| Badge counts | **no** | No `setAppBadge`/`setBadgeText` |
| Background sync / offline | **no** | No Background/Periodic Sync |
| Hover cards / UI reuse | **partial** | Rich React+Radix components exist but app-coupled; no web-component/shared lib |
| Site detection (Twitter/X, DexScreener, GMGN, Photon, BullX) | **partial** | Domain strings exist as data-source integrations only; no content-script matchers |
| Open-in-Pointer deep links | **partial** | Routes exist; no protocol handler or close-after-action bridge |
| Context menus / clipboard CA detection / address injection | **no** | No `chrome.contextMenus`, clipboard polling, or content-script DOM scan |
| Storage sync (localStorage ↔ chrome.storage) | **no** | No bridge; theme/prefs/auth won't carry over |
| Subscriptions/tiers/quota enforcement (server) | **yes** | Tier system + Redis AI quota/cost ceilings enforced server-side |
| User-visible quota/usage endpoint | **no** | No public `/user/quota` or cashback-balance endpoint |
| Admin/ops substrate (RBAC, audit, flags, Doctor) | **yes** | Mature; reusable for extension management |
| Extension client registry / kill switch / versioning | **no** | No `extension_clients`, per-client disable, version/forced-update, or canary |
| Deployment automation | **yes** | Vercel auto-deploy works |
| CI/CD, staging, rollback | **no** | No CI gating (`typecheck` piped to `tail`, masking ~12 errors); single prod project; manual rollback only |
| Secrets management / rotation | **partial** | Timing-safe compares, but plaintext env secrets (Privy signer key, admin secret, single shared Helius key); no rotation; **dev-mode (`NODE_ENV!=='production'`) grants admin with no secret** |
| Scalability (DB pooling, realtime caps, Helius key) | **no** | No configured pooler (default ~30 conns); single shared Helius key; concurrency ceilings unaddressed |

---

## 3. Missing / Needed Backend Endpoints

| Path | Status | What it needs |
|---|---|---|
| `/api/me`, `/api/wallets/my`, `/api/portfolio` | exists | CORS + OPTIONS preflight |
| `/api/trade/quote`, `/api/trade/execute` | partial | Per-user rate limit; idempotency key; signer==token-wallet check; confirm-before-`confirmed` (or `pending`+reconcile) |
| `/api/solana/broadcast` | exists | Persist submission row (idempotency); reconcile job for dropped txs |
| `/api/auth/logout` | **missing** | Server-side revocation + Redis/DB blacklist checked in token verification |
| `/api/user/quota` | **missing** | AI quota used/remaining, rate-limit window, tier — user-auth |
| `/api/user/cashback` | **missing** | User's own cashback balance + history (today admin-only) |
| `/api/extension/register` | **missing** | First-run registration → `extension_clients` |
| `/api/extension/config` | **missing** | `enabled`, `min_required_version`, deprecated versions, maintenance, overrides — **kill switch + version gate** |
| `/api/extension/update-check` | **missing** | `{current_version}` → available/force_upgrade/changelog |
| `/api/extension/heartbeat` | **missing** | Liveness + adoption → `ops_events` |
| `/api/ai/batch` | **missing** | Array of pipeline requests (10 hover tokens = 1 call) |
| `/api/batch` or `/api/dashboard` | **missing** | Coalesce portfolio + trending + prices (12+ calls today) |
| `/api/tokens/summary` (POST) | partial | Documented bulk `{mints:[]}` with batch-size cap |
| `/api/tx-status/:signature` | **missing** | Long-poll confirmation after popup/browser closes (dispute resolution) |
| `/api/internal/health` | **missing** | CRON_SECRET-gated deep health (DB select, provider health, cron errors) |
| `/api/ai/health` | **missing** | Provider/Redis status + remaining daily cost for graceful degradation |
| `/api/webhooks/helius/swap` | **missing** | Real-time swap ingest **with DLQ/retry** to kill polling lag |
| `/api/wallet/funder` | exists/**risky** | Add rate limit + auth/captcha; shorten 7-day cache (account enumeration) |
| Realtime `/api/alerts/subscribe` (WS/SSE) | **missing** | Sub-second alert/price push for a live monitor |

---

## 4. Database Readiness

**Strengths:** ~56–70+ tables cover every surface; money paths idempotent (`trades.tx_signature`, `pack_payments.payment_tx`, `webhook_events.signature` UNIQUE); Pulse/indexer/RBAC/audit/ops tables exist with reasonable indexes. All access via the service-role admin client behind API routes (`import 'server-only'`).

**By-design constraints:** **No RLS** on user-facing tables → the extension **cannot query Supabase directly**; it must route everything through `/api`. **No Supabase Realtime subscriptions** configured → live data = HTTP polling.

**Missing/weak hot-path indexes:** `mint_swaps (wallet, created_at DESC)` and `(wallet, side, created_at DESC)`; `tracked_wallets (wallet_address)`; `trades (user_id, created_at DESC)`; `token_holders (wallet_address)`; `ai_responses (user_id, created_at DESC)`; `admin_audit_log (admin_user_id, created_at DESC)` and `(action, created_at DESC)`.

**Scalability gaps:** `tokens`/`token_market_snapshots` grow unbounded (no partitioning/archival/retention); Pulse list queries scan up to 4000 rows then `LIMIT 60` (no cursor pagination); audit/ops logs append-only with no pruning.

**Extension tables to add:** `extension_clients`, `extension_versions`, `extension_deployments/rollouts`, `extension_quotas`, `extension_user_overrides`, `transaction_submissions/confirmations`; add `client_type/client_version/platform` columns to `bug_reports` and `ai_responses`; `push_delivery_log`.

**Critical action:** point `DATABASE_URL` at the Supabase **transaction pooler** (pgbouncer:6543) — default ~30 connections starves under concurrent Pulse fan-out at ~100 concurrent users.

---

## 5. Performance Audit

**Latency tiers:** Fast (<200ms): `/health`, `/prices/tickers`. Medium (1–3s): `/tokens/[mint]/chart` (4000 snapshots → OHLC), `/tokens/[mint]/top-traders` (**8000-row** scan + chunked lookups), `/wallet/[address]/analytics`. Heavy (5–18s): `/pulse/feed` (18s timeout), AI `explain-token` (5–8s), `/trade/execute` (30s).

**Where Redis/cache/CDN/batching is needed:** CDN/edge cache headers on `chart`/`top-traders`/`prices`/`tokens`/`pulse/feed` (most are `force-dynamic` today); **global Pulse cache in Redis** + cron pre-warm (in-proc cache doesn't cross instances); **Redis-backed AI request coalescing** (`SET NX` inflight gate); persistent token-hydration cache; batch endpoints (`/ai/batch`, `/batch`, POST `tokens/summary`); connection pooling + statement timeouts; circuit breakers on Helius/Jupiter/DexScreener/TonAPI; cursor pagination + gzip on token lists.

---

## 6. Extension Support Checklist (exists vs build)

| Capability | State | Notes |
|---|---|---|
| Hover cards (token/wallet/user/CA) | **partial — build** | Components exist; need shadow-DOM web-components or rebuild for injection |
| Popup / sidebar UI | **build** | No manifest, popup, or background worker exist |
| Twitter/X, DexScreener, GMGN, Photon, BullX detection | **partial — build** | Only data-source references; need content-script `matches` + DOM/address scanning |
| Open-in-Pointer deep links | **partial** | Routes exist; build URL constructor + optional `pointer://` handler + close-after-action |
| Context menus | **build** | No `chrome.contextMenus` |
| Badge counts | **build** | No badge API usage |
| Background sync | **build** | No Background/Periodic Sync; add `chrome.alarms` + retry queue |
| Clipboard CA detection | **build** | App parses manual pastes only; need `clipboardRead` + listener |
| Wallet-address injection on pages | **build** | No content-script DOM scan/inject |
| Web push (alerts) | **partial** | Server infra reusable; **extension service-worker delivery unverified — must test before relying on it** |
| Realtime alerts (sub-second) | **build** | Requires WS/SSE or Supabase Realtime; today 8–30s polling |
| Search-in-popup (resolve CA/wallet) | **exists** | `/search/resolve` ready (after CORS) |
| Quick trade (quote→execute) | **exists (reliability caveats)** | Build minimal popup form; fix race/idempotency first |
| Quick alert-create | **exists** | `POST /alert-rules`; build preset UI |
| Quick wallet-save | **partial** | Endpoint family exists; no quick-save shortcut |
| Storage sync | **build** | Design `chrome.storage.sync` for JWT + prefs |

---

## 7. Security Audit (with severities)

**CRITICAL**
- **No CORS on 171/172 routes** — preflight fails; blocks the extension and (if opened) invites cross-origin abuse. *Fix: middleware allowlisting extension ID + app origin; `Allow-Credentials:false` (Bearer only).*
- **`POINTER_ADMIN_SECRET` single shared plaintext break-glass**, and **dev-mode grants admin with no secret**. Leak = full admin. *Vault + rotation + MFA; remove dev bypass; log break-glass with secret-hash + IP.*
- **`PRIVY_AUTHORIZATION_PRIVATE_KEY` (server signer) plaintext in env** — env compromise = sign arbitrary embedded-wallet txs. *HSM/Privy-hosted keys; per-wallet tx limits.*
- **Single shared Helius API key** across all users — leak drains quota/cost and breaks Pulse. *Rotate, per-env keys, spend caps, audit git history.*

**HIGH**
- No token revocation/logout (stolen token valid up to 7 days).
- No per-user rate limiting on trade/AI/admin.
- `/api/wallet/funder` unauthenticated + cached 7 days, no rate limit (account enumeration).
- No CSP (content-script + competitor-site injection vectors unmanaged).
- Bearer token in sessionStorage (not HttpOnly) — XSS exfiltration.
- Broadcast-then-record race can mark a failed-on-chain trade "confirmed" (paid-got-nothing class).
- No security headers (X-Frame-Options, X-Content-Type-Options, HSTS).
- No multi-client identification — extension traffic indistinguishable.
- Extension multiplies load 3–5× with zero capacity planning (DoS-by-success).

**MEDIUM**
- OAuth popup uses `window.location.origin` (navigation-attack prone).
- No wallet-ownership proof on `/trade/execute`.
- Compliance stubs (region/age/limits) are no-ops; packs RNG is `Math.random()` (not provably fair).
- SameSite=lax on admin/creator cookies; no CSRF tokens.
- No secrets rotation policy or leak detection.
- Public rate limiter **fails open** (Redis down or disabled).

**LOW**
- Test keys committed in `.env.local*` backups (rotate, scrub history, gitignore).
- AI error messages leak cascade internals.

---

## 8. Scalability — Where It Breaks (100 → 1M users)

- **~100 concurrent:** **Supabase connection exhaustion** (no pooler; default ~30) — the first hard wall. *Fix: pgbouncer pooler.*
- **~1k concurrent:** Pulse fan-out (3 cols × 15s) saturates DB + Helius DAS; in-proc cache doesn't cross instances.
- **~10k concurrent:** Supabase Realtime ceiling (~1k Pro) if WS introduced; Vercel concurrency (~1k–2k) → 503 on slow routes; Helius DAS limits; AI cascade cost **$15k–$450k/mo** for one pipeline if 10% escalate to Sonnet.
- **100k–1M:** unbounded `tokens`/`snapshots`, full-scan list queries, no partitioning; ~2.4 GB/s Pulse bandwidth without pagination/gzip; single-region, single DB, no read replicas; no webhook DLQ.

**Extension specifically:** a 50k-install extension ≈ 3.3k req/s Pulse + 50k realtime subs + ~150k QPS — none of which the current single-region/single-key/single-pool topology survives. Budget ~$5k/mo infra uplift and load-test before launch.

---

## 9. Operational Readiness

| Area | State |
|---|---|
| Deploy | Vercel git auto-deploy — **yes**, but **no CI gating** (`typecheck` piped to `tail`, masking ~12 errors) |
| Staging | **none** — all changes hit prod; the beta gate is a prod flag, not an environment |
| Rollback | **manual only**; no blue-green/canary/health gate |
| Feature flags | env-var + DB `feature_flags` (not extension-aware); no %-cohort rollout |
| Versioning | **none** — unversioned `/api/*`; no Sunset headers |
| Kill switch | **partial** — ingest pause + automation kill exist; **no per-client/extension kill switch** |
| Maintenance mode | **none** for user traffic |
| Migrations | **manual SQL scripts**, no runner, no version table, no rollback |
| Indexing durability | **none** — webhook disabled, no swap-ingest, **no DLQ** |
| Alerting | **none** — Doctor/ops_events surface issues but nothing pages anyone |
| Tracing | **none** — `correlationId` field exists but never populated |
| Health checks | trivial `/health` only; deep health behind admin auth |

---

## 10. Admin Requirements for the Extension

Reuse the mature RBAC + audit + flags + Doctor substrate, then add:
1. Extension client **registry** page (list/search by version/status, active users, geo, last heartbeat).
2. **Per-client kill switch** via `/extension/config` (global + version-range disable); audit-logged.
3. **Version management + staged rollout** (publish, force-update, %-based canary).
4. **Per-client/per-user quota overrides + trial grants** (`extension_quotas`/`extension_user_overrides`).
5. **Extension-segmented error dashboard** (`client_type/version/platform` on bug reports).
6. **Extension metrics in ops** (heartbeats, latency/error by client, AI/Helius spend by origin).
7. New RBAC perms — `extension.read/enable/disable/version.publish/quota.override`; seed `extension-manager` role.
8. **Maintenance mode flag** for extension-only downtime.
9. **Deploy markers** — `category:deploy` ops_events for extension versions + rollback button.

---

## 11. Missing Infrastructure to Add First (dependency order)

1. **Secrets to vault + rotation** (admin secret, Privy signer, per-env Helius); scrub `.env.local*`; remove dev admin bypass. *(Must precede staging — staging needs its own keys.)*
2. **CI/CD pipeline** (typecheck/lint/test gating; fix the masked `tail` + ~12 tsc errors) + **staging environment** + **documented rollback**.
3. **CORS middleware** (allowlist extension ID + app origin; OPTIONS handlers). *Unblocks all client work.*
4. **Supabase transaction pooler** wired to `DATABASE_URL`.
5. **Per-user rate limiting** (Upstash, keyed by user_id) on trade/AI/admin; fix the public-limiter fail-open.
6. **Token revocation + `/auth/logout`** with blacklist check.
7. **Security headers** (CSP, X-Frame-Options, X-Content-Type-Options, HSTS); session JWT to HttpOnly or `chrome.storage`.
8. **Transaction reliability**: confirm-before-`confirmed` (or `pending`+reconcile), idempotency keys, `transaction_submissions`, `/tx-status`.
9. **Helius swap-ingest webhook + DLQ** (`/webhooks/helius/swap`) — root fix for indexing lag.
10. **Multi-client identity** (`X-Pointer-Client` header) logged into ops + Sentry.
11. **Extension control plane**: `extension_clients/versions/config` tables + `/extension/{register,config,update-check,heartbeat}`.
12. **Sentry enabled** + alerting (Doctor cron → Slack/PagerDuty) + correlation IDs.
13. **Global Pulse Redis cache + cache headers + batch endpoints**.

---

## 12. Technical Debt

**Critical:** no staging env; compliance/fairness stubs (`complianceGate`/`responsibleLimitsGate` no-ops; `Math.random()` packs RNG); no DB connection pooling; single shared Helius key + plaintext server-signer key.

**High:** no CI/CD; CORS absent everywhere; broadcast-then-record race + no idempotency; webhook disabled + no swap-ingest + no DLQ; raw SQL inline in routes (`top-traders`, `trader-stats`, `points/me`) violating the lib/db pattern; untracked `apps/` monorepo bleed (no workspaces/Turborepo); Sentry likely unconfigured; no centralized flags; no tracing; no per-user rate limiting; no token revocation.

**Medium:** no API versioning; manual migrations, no rollback; compliance/age/region gates unenforced; admin secrets unrotated; thin tests (no E2E for pack/trade/payout); public limiter fails open; no tx confirmation log.

**Low:** Onramper key rotation TODO; `as any` Supabase casts; demo mints/fixtures not isolated; AI error verbosity; committed test keys.

---

## Final Deliverable

### (a) Extension Readiness Score: **38 / 100**

Weighted by the dimensions that gate exposing an API to an untrusted public client (not raw feature count):

| Dimension | Weight | Raw | Weighted | Rationale |
|---|---:|---:|---:|---|
| API/data completeness | 20% | 85 | 17.0 | Feature-complete, idempotent money paths, multi-client proven |
| Auth for cross-origin client | 15% | 15 | 2.25 | No CORS, no extension auth path, no revocation |
| Security posture | 20% | 25 | 5.0 | 4 criticals (CORS, admin secret + dev bypass, plaintext signer, shared Helius key) |
| Trade/data reliability | 10% | 40 | 4.0 | Broadcast race, no idempotency, no DLQ/webhook |
| Scalability | 10% | 20 | 2.0 | No pooler, single key, ceilings |
| Ops (CI/staging/rollback/alerting/tracing) | 10% | 20 | 2.0 | Auto-deploy only; rest manual/absent |
| Real-time + extension UX enablers | 10% | 20 | 2.0 | No WS/SSE, badges, background sync, content-scripts |
| Extension control plane | 5% | 0 | 0.0 | Nonexistent |
| **Total** | **100%** | — | **≈ 38** | A strong API stranded behind a weak exposure/ops surface |

### (b) Top Blockers (close before any extension ships)
1. CORS + preflight on all consumed routes.
2. Extension auth strategy (recommend web→`chrome.storage` token handoff for MVP; TonConnect is domain-bound).
3. Token revocation + `/auth/logout` with blacklist.
4. Per-user rate limiting on trade/AI/admin (+ fix public-limiter fail-open).
5. Trade reliability (confirm-before-`confirmed` + idempotency + signer verification).
6. Secrets to vault + rotation (admin secret, Privy signer, per-env Helius); remove dev admin bypass.
7. CI/CD + staging + rollback.
8. Supabase pooler + Pulse Redis cache + capacity load-test.
9. Helius swap-ingest webhook + DLQ.
10. Extension control plane (`/extension/config` kill switch + version gate + registry).
11. Security headers (CSP et al.).

### (c) Ordered Roadmap to "Extension Ready" (before any extension code)

- **Phase 0 — Decide & de-risk.** Pick the auth model (web→`chrome.storage` handoff for MVP). Rotate + vault all secrets first; scrub `.env.local*`; remove the dev admin bypass. Stand up staging + CI gating (fix masked typecheck + errors). Formalize the monorepo (`apps/extension` + shared `packages/`).
- **Phase 1 — Safe to call cross-origin.** CORS middleware + OPTIONS; security headers/CSP; token revocation + `/auth/logout`; per-user rate limiting + fix fail-open; `X-Pointer-Client` logging; enable Sentry + Doctor→alert; add `/user/quota` & `/user/cashback`.
- **Phase 2 — Money-path & indexing reliability.** Confirm-before-`confirmed` (or `pending`+reconcile); idempotency keys; `transaction_submissions` + `/tx-status`; signer==token check; Helius `/webhooks/helius/swap` ingest with DLQ/retry; rate-limit/secure `/wallet/funder`.
- **Phase 3 — Scale the substrate.** Supabase pooler; missing composite indexes; global Pulse Redis cache + cache headers + `/ai/batch` + `/batch`; circuit breakers + per-env Helius keys + spend caps; load-test to target install count.
- **Phase 4 — Extension control plane & admin.** `extension_clients/versions/config` tables; `/extension/{register,config,update-check,heartbeat}`; kill switch + version gate + canary; admin registry/error/quota pages; `extension.*` RBAC.
- **Phase 5 — Real-time & UX enablers.** WS/SSE or Supabase Realtime for sub-second alerts; verify extension service-worker web-push delivery; badge counts; background sync; shared web-component UI library; deep links; API versioning (`/api/v1`).
- **Phase 6 — Build the extension (only now).** Manifest v3, popup/sidebar, content-scripts (Twitter/X, DexScreener, GMGN, Photon, BullX), context menus, clipboard CA detection, quick-trade/alert flows — against the hardened API.

**Gate to GA:** real compliance gates (region/age/limits) + provably-fair packs RNG before any extension commerce; staged rollout behind `/extension/config`.

---

**Bottom line:** the API is ready to *consume*; the platform is not yet ready to *expose*. Honest readiness is **38/100**. Close the hardening list (CORS, auth handoff, revocation, per-user limits, trade reliability, secrets, CI/staging, scale, indexing durability) **before** writing extension code — don't let an impressive API surface masquerade as launch readiness.
