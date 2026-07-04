# Deferrals — documented decisions (Final Production Readiness)

Per the plan, every "Remaining/Follow-up/Residual" item is either BUILT or
DEFERRED with explicit reasoning. This file records the DEFERRALS so nothing is
ambiguous for the final audit. Each entry: what, why deferred, and when it lands.

---

## D1 — `lib/solana/submit.ts` Sender+Jito rewrite → fold into §8 (money harness)

**Status:** deferred into Wave 1 §8.

**What:** the plan flagged the dual-path (Helius Sender + Jito bundle) submit as a
"race that can fake success."

**Review finding:** on inspection the current code does NOT fake success. The
signature is derived from the already-signed serialized tx (deterministic, same
regardless of which path lands), the parallel submit only resolves on submission
acceptance, and the result is then established by polling on-chain
`getSignatureStatuses` (`err` → failed, `confirmed/finalized` → confirmed,
timeout → failed). Success is on-chain truth, not "a path returned 200." It is
used by exactly one low-traffic path (`lib/admin/emergencySell.ts`).

**Why defer:** rewriting a money path *before* the §8 injectable-fake harness
exists means changing send/confirm semantics with no automated way to prove the
new version is at least as correct under RPC failure / timeout / duplicate
submission. That is riskier than the reviewed-correct status quo.

**Lands when:** §8 builds the harness; the rewrite (standardize on
`sendRawTransaction` + confirm, with the timeout→"unknown, do not auto-retry"
semantics) is then done test-first. Tracked in the §8 checklist.

---

## D2 — Realtime full event-driven redesign → post-extension

**Status:** deferred (documented in `docs/REALTIME_ARCHITECTURE.md`).

**What:** discovery webhooks (kill the ~15m Pulse lag) + Supabase Realtime client
push (replace 8–30s polling) + persistent tracked-wallet subscriptions.

**Why defer:** multi-week, gated on provider plan tiers (Helius webhook tier,
RPC subscription cost), and NOT required for "production-ready." The durable
retry/replay/idempotency/DLQ substrate (Phase 1 M2) and provider breakers
(Phase 0.3) — which every future event source reuses — already exist, so this is
a latency/cost optimization, not a correctness or safety gap.

**Lands when:** after the extension, with explicit cost/latency tradeoffs.

---

## D3 — Canary %-traffic split (5→15→30→100%) → conditional on Vercel tier

**Status:** partially deferred (see §4).

**What:** true progressive %-traffic rollout.

**Why defer:** %-splitting requires **Vercel Rolling Releases** (Pro/Enterprise).
If that tier isn't enabled, the pre-extension bar is the achievable equivalent:
staging → smoke tests → health-gated promote → 1-click rollback, with auto-halt on
the deploy-health signal. The %-split is enabled the moment Rolling Releases is
available — no code change, just the platform feature.

**Lands when:** Rolling Releases is on the plan; otherwise the documented
alternative is the accepted production bar.

---

## D4 — Self-healing autonomous *execution* → ships observe-only first

**Status:** scoped deferral within §3 (not a skip — a safety gate).

**What:** automatic execution of repair actions.

**Why defer (to a flag):** auto-acting on production carries real blast-radius
risk. §3 ships with `SELFHEAL_ENABLED` defaulting to **observe-only** (Doctor
recommends, a human approves) until the recommendation quality is trusted in
practice. Dangerous classes (funds, keys, schema, deploy rollback, mass writes)
are **never** auto-executed regardless of the flag — they always escalate.

**Lands when:** after a burn-in period of accurate observe-only recommendations,
low-risk action classes are enabled per-action behind the flag.

---

## Not deferred (BUILT in Wave 0)

- ✅ The 2 stale identity-seed test assertions — suite is now **350/350**.
- ⏳ Webhook DLQ depth → Doctor finding — in progress (Wave 0).
