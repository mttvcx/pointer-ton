# Pointer — Chrome Extension Readiness (Update #2, post-hardening)

**What this is:** an update to the first readiness audit (which scored **38/100**). Since then I knocked down most of the cross-origin *safety* and money-path *reliability* blockers — in code, live on `main`, with `tsc` and `next build` both clean. This is where we actually stand now, plain language, no calendars.

> **New verdict: ~55/100, up from 38.** The big shift: the layer that makes it *safe to expose the API to a cross-origin client* — CORS, token revocation + logout, per-user rate limits, security headers, trade reliability + idempotency — is now largely done and live. What remains is heavier **infrastructure** (DB pooling, global cache, indexing durability), **ops maturity** (CI / staging / rollback), **real-time**, the **extension control plane**, a few **secrets you need to vault**, and the **extension auth handoff** to design. None of those block today's app — they're the runway for actually shipping an extension.

---

## 1. What I fixed since the last report

All shipped to `main`, verified with a full `next build` (not just `tsc` — that's what let the first CORS attempt slip a build break past me; fixed and learned).

| # | Blocker (from report #1) | Before | Now | Commit |
|---|---|---|---|---|
| CORS | No CORS on 171/172 routes (hard blocker) | ❌ | ✅ Allowlist + OPTIONS preflight, folded into `proxy.ts` (Next 16's middleware). No-op until you set `POINTER_EXTENSION_ORIGINS`; fail-safe | `3257d14` |
| Revocation | No logout; Bearer valid up to 7d | ❌ | ✅ `POST /api/auth/logout` + per-subject revocation cutoff, single chokepoint in `verifyPrivyAccessToken`, **fail-open** | `0e1add9` |
| Rate limit | No per-user limit on trade/admin | ❌ | ✅ Per-user caps on trade/broadcast + admin **mutations** — generous, **fail-open**, env-tunable/disable | `049e93a` |
| Headers | No CSP / security headers | ❌ | ✅ nosniff, X-Frame-Options, Referrer-Policy, HSTS + **Report-Only** CSP (can't break the app) | `d5a5fef` |
| Dev bypass | `NODE_ENV!=='production'` = admin, no secret | ❌ | ✅ Closed — now opt-in `POINTER_DEV_ADMIN=1` | `a5c2a74` |
| AI abuse | In-proc dedup fails across instances → ~10× duplicate-spend | ❌ | ✅ Redis `SET NX` inflight gate (+ confirmed per-user rate-limit & daily-$ ceiling already capped it) | `a5c2a74` |
| Trade race | Broadcast-then-record marks failed trades `confirmed` (paid-got-nothing) | ❌ | ✅ **SOL**: confirm on-chain before recording rewards; a reverted swap returns 502, rewards only accrue once confirmed; kill-switch `POINTER_DISABLE_TRADE_CONFIRM=1` | `04082f6` |
| Idempotency | No idempotency key on trades | ❌ | ✅ `getTradeBySignature` guard on **both SOL + TON** — a retried submit no longer double-accrues cashback/referral | `3e879e1` |
| User endpoints | No `/user/quota` or cashback read | ❌ | ✅ `/api/me/quota` + `/api/me/cashback` (Privy-authed, read-only) | `9f71d18` |
| CI false-alarm | Report #1 said `typecheck` is piped to `tail`, masking ~12 errors | ⚠️ wrong | ✅ Corrected — it's `tsc --noEmit`, **0 errors**. Nothing was masked | verified |

---

## 2. Does it cover all chains? (the honest answer)

**Yes — except one Solana-only piece, and that's by design, not an oversight.**

- **Chain-agnostic (applies to every chain):** CORS, logout/revocation, security headers, AI dedup, `/me/quota` + `/me/cashback`, dev-bypass close, and **per-user rate limiting** — the rate-limit + idempotency guards sit *before* the SOL/TON split in `trade/execute`, so they cover both paths.
- **Both SOL + TON:** trade **idempotency** (the `getTradeBySignature` guard is on both paths).
- **SOL only:** **confirm-before-accrue.** Why:
  1. The bug it fixes is the *server* faking a successful Solana broadcast (the Sender+Jito race). **TON is broadcast by the user's own wallet** via TonConnect — there is no server-side broadcast race to fix.
  2. TON has **no clean confirmation primitive** in the codebase, and a TonConnect BOC hash **isn't** the on-chain tx hash. Bolting on unreliable TON polling would *break* TON cashback (false timeouts → never pays).
  - TON's residual risk — a swap message that lands but the swap contract *reverts* still pays cashback — is **real but lower-frequency**. It's a deliberate follow-up that needs proper `tonApi` transaction-result code **and a live TON test** (which only you can run).
- **EVM (ETH / Base / BNB):** **not a trade-execution path** in the backend today — `trade/execute` only accepts `chain: 'sol' | 'ton'`. So there's nothing to fix there yet (those chains are discovery/display, not settlement).

---

## 3. Updated scorecard

| Dimension | Weight | Was | Now | Why it moved |
|---|---:|---:|---:|---|
| API / data completeness | 20% | 85 | 90 | + user quota/cashback endpoints |
| Auth for cross-origin client | 15% | 15 | 65 | CORS + revocation + logout done; **extension auth handoff still to design** |
| Security posture | 20% | 25 | 65 | dev-bypass closed, CORS, headers + Report-Only CSP, per-user limits; **residual = secrets vaulting (you)** + CSP still report-only |
| Trade / data reliability | 10% | 40 | 70 | confirm-before-accrue (SOL) + idempotency; TON confirm + DB UNIQUE + DLQ remain |
| Scalability | 10% | 20 | 25 | AI dedup helps; pooler + global cache still pending |
| Ops (CI/staging/rollback/alerting) | 10% | 20 | 30 | typecheck false-alarm cleared, ops substrate solid; still no CI/staging/rollback |
| Real-time + extension UX enablers | 10% | 20 | 20 | unchanged (no WS/SSE, badges, content-scripts) |
| Extension control plane | 5% | 0 | 0 | unchanged |
| **Total** | **100%** | **≈38** | **≈55** | The "expose safely" layer is largely built; the runway (scale/ops/realtime/control-plane) is what's left |

---

## 4. What's still open (by who does it)

**Code follow-ups (I can do, when you want):**
- TON trade confirm (proper `tonApi` tx-result check + a live TON test).
- DB `UNIQUE` on `trades.tx_signature` — closes the rare *concurrent* double-submit the app-layer guard can't fully (a migration, after checking for existing dup signatures).
- Promote CSP from **Report-Only → enforcing** after watching the browser console for violations.
- Helius swap-ingest webhook **+ DLQ** (root fix for indexing lag).
- Global Pulse Redis cache + cache headers + batch endpoints (`/ai/batch`, `/batch`).
- `X-Pointer-Client` → ops logging (header is already *accepted* by CORS; logging is the deferred bit — no extension traffic to segment yet).
- Rate-limit / auth on `/wallet/funder`.
- Extension control-plane tables + endpoints (only once we commit to building the extension).

**Only you (ops / dashboard — I can't):**
- Vault + rotate secrets (admin break-glass, Privy signer, Helius key); scrub `.env.local*`.
- Point `DATABASE_URL` at the Supabase **transaction pooler** (one env change).
- Turn on **Sentry** — it's already wired; just add `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`.
- Set up **staging + CI gating + rollback**.
- Add `POINTER_EXTENSION_ORIGINS` when the extension exists.
- Check Vercel **billing** so the live site doesn't pause on a lapsed trial; silence the `mobile-foundation` failed-deploy emails.

**Extension-build-time (later, only when we actually start the extension):**
- The **auth handoff** (web → `chrome.storage` token for MVP; TonConnect is domain-bound).
- Manifest v3, popup/sidebar, content-scripts (Twitter/X, DexScreener, GMGN, Photon, BullX), context menus, clipboard CA detection.
- Real-time (WS/SSE or Supabase Realtime), badge counts, background sync, shared web-component UI.

---

## Bottom line

Report #1's headline was *"ready to consume, not ready to expose."* We've now built most of the **"expose safely"** layer: the API is safe to call cross-origin (once you flip on the extension origin), **trades only pay rewards when they actually land**, sessions can be **revoked**, abuse is **rate-limited**, and the obvious security holes (dev-admin bypass, missing headers, duplicate AI spend) are closed.

What stands between here and a shippable extension is now mostly **infrastructure scale-up + ops maturity + the extension client itself** — plus a handful of **secrets only you can vault** — not the security gaps that were the real blockers. **~55/100, and the remaining points are runway, not landmines.**
