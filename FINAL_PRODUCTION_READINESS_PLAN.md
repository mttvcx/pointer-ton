# Pointer — Final Production Readiness Plan (Pre-Extension)

**Status:** PLAN FOR APPROVAL. No implementation has begun on the items below.
Per your directive, this document is produced first; implementation starts only
after you approve the plan and order.

**Goal:** reach a state where one final independent audit passes, after which
Pointer Extension development begins. The extension must not start until Pointer
itself is production-ready.

**Baseline:** Phase 0 (emergency controls, provider breakers, account freeze, AI
cost guards, AI pipeline security) and Phase 1 (webhook infra, CI/CD, provably-fair
packs, money-race hardening, incident alerting, realtime ADR) are shipped. See
`PHASE1_IMPLEMENTATION_REPORT.md`. This plan closes what remains and adds the 12
requested workstreams.

Effort key: **S** ≤1 day · **M** 2–4 days · **L** 1–2 weeks · **XL** 2+ weeks
(focused, solo). These are build estimates, not calendar promises.

---

## 1. Production readiness checklist (current truth)

| Area | State | Evidence / Gap |
| --- | --- | --- |
| Emergency kill switches (global/per-chain/maintenance/read-only) | ✅ | Phase 0.1, Redis-backed, admin UI |
| Provider circuit breakers (Helius/Moralis/InsightX/Dex/Jupiter) | ✅ | Phase 0.3 |
| Account freeze across money/automation paths | ✅ | Phase 0.4 |
| AI cost guards (atomic, fail-closed) + spend dashboard | ✅ / 🟡 | Phase 0.2; cost-center depth = §7 |
| AI pipeline security (sanitize/inject/IDOR) | ✅ | Phase 0.5 |
| Webhook async queue / retry / DLQ / idempotency | ✅ | Phase 1 M2 |
| CI/CD gates (typecheck/lint/test/build/env/migrations) | ✅ | Phase 1 M4 (activate workflow YAMLs) |
| Provably-fair packs (commit-reveal) | ✅ | Phase 1 M6 |
| Money-path double-credit race | ✅ | Phase 1 M3 (apply the index migration) |
| Incident **alerting** (Discord/Slack) | ✅ | Phase 1 M5 |
| Incident **lifecycle** (ack/resolve/postmortem/runbooks) | ❌ | §5 |
| Pointer Doctor (read-only diagnosis) | 🟡 | exists; upgrade = §2 |
| Self-healing | ❌ | §3 |
| Canary / progressive deploys | ❌ | §4 |
| Observability dashboards (per subsystem) | 🟡 | metrics recorded; dashboards = §6 |
| AI cost center | 🟡 | spend dashboard exists; depth = §7 |
| Money-path integration/stress tests | ❌ | §8 |
| Extension readiness tracking | ❌ | §9 |
| Subscription / AI access (5 SOL OR sub) | ❌ | §10 — **revenue-critical** |
| Release infra (notes/versioning/migration safety) | 🟡 | flags/kill-switches/maintenance ✅; rest = §11 |
| Final QA (load/outage/security/perf sims) | ❌ | §12 |

---

## 2. Remaining gaps carried from prior phases

Each is now assigned a disposition (BUILD now, or DEFER with reason):

| Gap (source) | Disposition |
| --- | --- |
| Money-path **integration harness** (injectable fake DB/Redis/RPC) | **BUILD** — §8; unblocks real exactly-once tests |
| Legacy `submit.ts` Sender+Jito race (admin emergency-sell) | **BUILD** — replace with deterministic send (low effort, money path) |
| Webhook **DLQ depth → Doctor finding** | **BUILD** — folds into §2/§6 |
| Incident **lifecycle UI** | **BUILD** — §5 |
| Realtime **discovery webhooks** + Supabase Realtime client push | **DEFER** — multi-week, provider-tier dependent; not required for "production-ready", and the durable ingestion substrate already exists. Documented in `docs/REALTIME_ARCHITECTURE.md`. Revisit post-extension. |
| Stale identity-seed test assertions (2) | **BUILD** — trivial; green the suite |
| CI workflow activation (`workflow` OAuth scope) | **OPS** — you move `ci/workflows/*` → `.github/workflows/` |
| Apply `money-idempotency-indexes.sql` | **OPS** — you apply in Supabase |

---

## 3. The twelve workstreams (scoped)

### §1 Close all remaining gaps — **M**
Resolve the table above: every "Remaining/Follow-up/Residual" item becomes BUILD or
a documented DEFER. Deliverable: a short `DEFERRALS.md` recording each deferral's
reasoning so nothing is ambiguous. **Risk:** low. **Deps:** none.

### §2 Pointer Doctor V2 — **L**
Upgrade `lib/ops/doctor.ts` from a rules diagnoser into the central operational
brain. Keep the deterministic core (zero AI cost, always-on); add an *optional*
LLM narration layer gated by the Phase 0.2 cost controls.
- **Subsystem collectors** (extend `collectOpsHealth`): trading, portfolio, AI,
  realtime/ingest, indexers, wallet tracking, providers, Redis, Supabase, RPCs,
  workers, queues (retry+DLQ depth), crons, webhooks, notifications, extension
  (placeholder).
- **Per-finding scoring:** root-cause, plain-English explanation, **confidence
  (0–1)**, **user-impact**, **revenue-impact** (tie to fee/cashback/sub flows),
  **urgency**. Pure scoring functions → unit-tested.
- Surfaced in `/admin/ops`; feeds §3 (self-heal) and §5 (incidents).
**Risk:** medium (scope). **Deps:** §6 metrics for richer signals.

### §3 Self-healing — **L**
A registry of **safe, reversible** repair actions, each with: a trigger
(Doctor finding + confidence threshold), a dry-run, a guard, an audit-logged
execution, and a cooldown. Examples that are safe today: rotate/disable an
unhealthy provider (have the breaker), retry safe jobs / drain webhook DLQ,
invalidate+rebuild a bad cache, restart polling, recover stale indexers.
- **Hard rule:** dangerous actions (funds, treasury, keys, schema, deploy
  rollback, mass writes) are **never** automatic — they escalate for explicit
  approval (reuse the four-eyes/break-glass pattern).
- Low confidence → escalate, don't act.
**Risk:** HIGH (over-automation) → ship behind a global `SELFHEAL_ENABLED` flag,
default observe-only (recommend, don't execute) until trust is earned.
**Deps:** §2 (confidence scoring), emergency controls, provider breakers.

### §4 Canary / progressive deploys — **M (with a documented constraint)**
Target flow: staging → smoke tests → 5% → 15% → 30% → 100%, auto-rollback on
error/latency/RPC/money-path spikes or a critical incident.
- **Reality check:** true %-traffic splitting needs **Vercel Rolling Releases**
  (now GA on Pro/Enterprise). Recommend: enable Rolling Releases + wire the
  existing `deploy-health` probe + a smoke-test suite as the promotion gate, with
  auto-halt on the health signal. If Rolling Releases is out of plan scope now,
  **DEFER the %-split** and ship staging+smoke+health-gated-promote+1-click
  rollback as the pre-extension bar (documented).
**Risk:** medium (platform dependency). **Deps:** §6 (spike signals), §12 smoke tests.

### §5 Incident lifecycle — **M**
Extend `ops_incidents`: `status` (open→acknowledged→assigned→investigating→
mitigated→resolved), `owner`, `notes[]`, `timeline[]`, `postmortem`, `runbook_url`,
`resolution`. Admin UI on `/admin/ops` to drive the lifecycle. Runbooks as
markdown in `docs/runbooks/`. Migration file (additive). **Risk:** low.
**Deps:** alerting (✅), migration apply (ops).

### §6 Observability dashboards — **L**
Per-subsystem dashboards from the already-recorded `ops_metrics` (trade success
rate, failures, avg execution time, API latency, RPC, indexers, crons, queues,
Redis, Supabase, provider latency, webhook health, DLQ/retry depth, user
activity). Add any missing metric emits. **Risk:** low. **Deps:** none (metrics
exist); §2 consumes these.

### §7 AI cost center — **M**
Extend the `/admin/ai-spend` dashboard: daily/hourly, per-model, per-feature,
per-endpoint, **cache hit/miss %**, avg prompt/completion cost, est. monthly,
top-expensive prompts, **cost per user / per subscriber**, $ saved by cache.
Most inputs already flow through `lib/ai/quota.ts` + the cache; add the missing
labels. **Risk:** low. **Deps:** §6 patterns.

### §8 Money paths — integration + stress — **L**
The big testing gap. Build an **injectable-fake harness** (fake Supabase/Redis/RPC)
so flows are deterministically testable, then cover: trading, pack open→pay→fulfill,
cashback, referrals, subscriptions, credits, AI usage, wallet linking — under
duplicate submissions, RPC failures, Redis failures, provider failures, timeouts,
concurrency. Assert **idempotency / exactly-once** everywhere. Replace the legacy
`submit.ts` race. **Risk:** medium (harness design). **Deps:** §10 (subscriptions exist first).

### §9 Extension readiness page — **S**
An `/admin/extension` tracking dashboard (status board, not extension code):
Twitter injection, DexScreener/GMGN/Photon/BullX/Axiom surfaces, Chrome
permissions, manifest, build, store readiness, OAuth, session sync, wallet sync,
version, release notes. Pure informational/checklist. **Risk:** none. **Deps:**
none. *(This is the bridge to the extension; everything else gates it.)*

### §10 Subscription / AI access — **L — REVENUE-CRITICAL**
Gate AI behind: **(A)** linked wallets holding ≥ 5 SOL combined, **OR** **(B)** an
active Pointer subscription. Requirements: continuous holdings verification across
multiple linked wallets, intelligent caching (don't hammer RPC), graceful handling
of transient RPC failures (**never wrongly revoke access**), a clean upgrade flow,
and a "why you have access" explanation. Build on provider breakers (RPC) + the AI
quota gate. **Risk:** HIGH (false-revoke = angry paying users) → fail-OPEN on
verification uncertainty within a cached grace window; only revoke on a confirmed
negative. **Deps:** RPC (breakers ✅), AI quota (✅), a subscription store.

### §11 Release infrastructure — **M**
Release notes + semantic **versioning** (surface in `/admin` + the extension page),
rollback runbook (Vercel promote-previous, documented), feature flags (audit the
existing flags system), emergency kill switches (✅) + maintenance (✅), **migration
safety** (a forward-only, reviewed, idempotent migration convention +
`check:migrations` already in CI; add an apply log). **Risk:** low. **Deps:** §4.

### §12 Final QA — **L**
Before "complete": full test suite + load testing + concurrency + deployment
simulation + provider/Redis/Supabase/RPC **outage simulations** + webhook replay +
duplicate-event + money-path + AI + **security review** + performance profiling.
Most outage sims become cheap once §8's fake harness exists (inject failures).
**Risk:** medium (time). **Deps:** §8 harness, §6 metrics.

---

## 4. Recommended implementation order (waves)

Sequenced by dependency + leverage. Each wave ends green (tests + build) and is
committed/pushed.

**Wave 0 — Hygiene (S, ~1–2 days)**
Close §1 quick wins: fix the 2 stale tests, replace `submit.ts` race, wire DLQ
depth into Doctor, write `DEFERRALS.md`. You: activate CI workflows + apply the
money-idempotency + (coming) lifecycle migrations.

**Wave 1 — Revenue + correctness foundation (L, ~2 wks)**
§10 Subscription/AI access (revenue-critical, gates monetization) → §8 money-path
harness + integration/stress tests (depends on subscriptions existing) → §7 AI
cost center.

**Wave 2 — Operational intelligence (L, ~2 wks)**
§6 Observability dashboards → §2 Doctor V2 (consumes §6) → §5 Incident lifecycle.

**Wave 3 — Safe automation + deploy safety (L, ~1.5 wks)**
§3 Self-healing (observe-only first; depends on §2 confidence) → §4 Canary/rolling
+ §11 Release infra (depend on §6 spike signals + smoke tests).

**Wave 4 — Extension bridge + final gate (M, ~1 wk)**
§9 Extension readiness page → §12 Final QA (load/outage/security/perf) → **hand to
the independent audit.**

**Rough total:** ~6–7 focused weeks solo. Parallelizable where you have help
(dashboards §6/§7 are independent of §10/§8).

---

## 5. Cross-cutting dependencies

```
§6 Observability ──▶ §2 Doctor V2 ──▶ §3 Self-healing
       │                  │
       └────▶ §7 Cost     └────▶ §5 Incident lifecycle
§10 Subscriptions ──▶ §8 Money harness ──▶ §12 Final QA
§6 + smoke tests ──▶ §4 Canary ──▶ §11 Release infra
everything ──────────────────────────▶ §9 Extension page ▶ AUDIT
```

## 6. Top risks

1. **Self-heal over-automation** → ship observe-only behind a flag; never auto-act
   on funds/keys/schema/deploys; escalate on low confidence.
2. **Subscription false-revoke** → fail-open within a cached grace window; revoke
   only on confirmed negatives; this protects paying users.
3. **Vercel Rolling Releases plan tier** → if unavailable, the %-split canary is a
   documented deferral; staging+smoke+health-gate+rollback still ships.
4. **Free-tier infra during load tests** (Upstash 500k, Helius credits) → run load
   tests against a scaled tier or with breakers tightened; otherwise tests trip the
   very guards they're validating.
5. **Solo bandwidth** → the wave order front-loads revenue + correctness so value
   lands even if later waves slip.

## 7. What a top-tier shop (Axiom / GMGN / Hyperliquid) finishes BEFORE an extension — and our stance

| Practice | Our plan |
| --- | --- |
| Status page (public) + SLOs/error budgets | **Add** — small public status page off `/api/health` + emergency status (Wave 2). Worth it. |
| Audit logging on every admin/money mutation | Mostly ✅ (admin audit log); extend coverage in Wave 1. |
| Secrets management + rotation policy | **Add** — doc + rotation runbook (the Upstash token incident showed why). Wave 0. |
| Rate limiting at the edge (DDoS/abuse) | Partial (per-user limits). **Add** edge/BotID-style protection (Wave 3). |
| Backups + restore drills (Supabase PITR) | **Add** — verify PITR + a documented restore drill (Wave 4). Non-negotiable for money. |
| On-call / paging escalation | Alerting ✅; add an escalation policy doc (Wave 2). |
| Dependency / supply-chain scanning | **Add** — `npm audit` + Dependabot in CI (Wave 0, cheap). |
| Load/soak testing at expected peak | §12. |
| Legal/compliance for packs (loot-box) + predictions | **Flag** — provably-fair ✅ helps; jurisdiction review is a business task, noted as a non-engineering dependency. |

**Items I'd insist on before the extension:** subscription gate (§10), money-path
integration tests (§8), incident lifecycle (§5), backups/restore drill, and the
final QA outage sims (§12). The extension expands attack surface and session/auth
complexity — shipping it on an untested money core would be the wrong order.

---

## 8. Definition of done (the audit gate)

Pointer is "production-ready, pre-extension" when:
- All BUILD items above are shipped, tested, documented; DEFERs are recorded with
  reasons in `DEFERRALS.md`.
- Full suite + load + concurrency + every outage simulation pass.
- Money paths proven exactly-once under failure injection.
- Subscription/AI access correct (no false-revoke) under RPC failure.
- Observability + Doctor V2 + incident lifecycle + alerting operational.
- Release safety (canary-or-documented-alternative + rollback + migration safety)
  in place.
- Then: **the one independent audit runs.** Pass → begin Pointer Extension.

---

## Approval

Reply with: approve as-is, or adjust the order / scope (e.g., pull §10
subscriptions even earlier, or accept the canary %-split deferral). On approval I
start at **Wave 0** and commit each milestone.
