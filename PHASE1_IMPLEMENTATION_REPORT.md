# Pointer — Phase 1 Production Operations Report

**Author:** Acting CTO / Principal Infrastructure Engineer (Claude)
**Scope:** Operational, reliability, deployment, and incident-response infrastructure.
**Not in scope:** Product redesign, new features, Pointer Extension, UI polish.

This is a living document. Each mission has an **Audit** (current state, grounded
in the codebase) and an **Implementation** section updated as milestones land.
Every milestone is its own commit; typecheck + tests stay green at each.

---

## Status at a glance

| Mission | Area | Audit | Implementation |
| --- | --- | --- | --- |
| 1 | Realtime ingestion | ✅ done | ⏳ architecture doc + targeted hardening |
| 2 | Webhook system | ✅ done | ✅ **shipped** (`af4516f`) |
| 3 | Money-path testing | ✅ done | ⏳ next |
| 4 | CI/CD | ✅ done | ✅ **shipped** (`99bdec5`) |
| 5 | Incident management | ✅ done | ⏳ planned (rich substrate exists) |
| 6 | Provably-fair packs | ✅ done | ✅ **shipped** (`adde97c`, `aaaa453`) |

Pre-work this sprint: secured the unauthenticated `predictions/orders` endpoint
(auth + freeze + rate limit, `1a35955`).

---

## Mission 1 — Realtime ingestion

### Audit

Ingestion is **hybrid webhook + cron-poll**, lean but with real latency lag.

| Data type | Provider | Mechanism | Latency |
| --- | --- | --- | --- |
| Token discovery (Sol) | Helius DAS + launchpad SDK | cron poll | ~15m |
| Token discovery (TON/EVM) | TonAPI / GeckoTerminal | cron poll | ~15m |
| Swaps / wallet activity / migrations | Helius enhanced-tx | **webhook** + 20m poll | realtime + backstop |
| Tracked-wallet alerts | Helius | webhook + 20m poll | up to 20m stale |
| KOL stats | Helius history | cron (rotating) | ~30m |
| Pulse metric enrichment | Moralis / DexScreener | cron + on-demand | ~15m |
| Price tickers | Jupiter / CoinGecko | on-demand cached | low |
| Limit-order fills | on-chain checks | 2m cron | ≤2m |
| Client delivery | — | **React Query polling (8–30s)**; Supabase Realtime initialized but unused | — |

Existing safety: Redis 60s webhook dedup (now upgraded — see Mission 2), DB
composite-key swap dedup, `mint_index_status` retry with cooldown. **Absent:**
ordering guarantees, replay/backfill, partition affinity, client push.

**Top gaps (ranked):** (1) no token-discovery webhooks → 15m discovery lag;
(2) dedup was single-window (fixed in M2); (3) no replay/backfill (fixed for
failed jobs in M2); (4) tracked-wallet/KOL cron lag; (5) no ordering guarantees;
(6) client polls instead of using the already-initialized Supabase Realtime;
(7) no provider-latency observability (partly addressed by provider breakers +
M2 metrics); (8) Pulse cold-start latency.

### Implementation (planned)

The full event-driven redesign (discovery webhooks, Supabase Realtime client
push, persistent wallet subscriptions) is a multi-week infra change with cost and
provider-tier implications, so Phase 1 delivers: (a) this architecture decision
record, (b) the durable retry/replay + idempotency layer (shipped in M2, reused
by all ingestion), and (c) targeted dedup/ordering hardening on the existing
pipeline. The realtime-push migration is sequenced as a documented follow-on with
explicit cost/latency tradeoffs.

---

## Mission 2 — Webhook system ✅ SHIPPED (`af4516f`)

### Audit

One inbound webhook (Helius). Auth was solid (constant-time bearer). **Critical
gaps:** heavy work ran INLINE before the 200 (slow-ack → retry storms); dedup was
a 60s Redis window only; no retry queue, no DLQ, no replay, no per-step metrics.

### Implementation

Provider-generic framework in `lib/webhooks/*` (full design in
[docs/WEBHOOK_INFRA.md](docs/WEBHOOK_INFRA.md)):

- **Immediate ACK + `after()` processing** — the response no longer blocks on
  token upserts / alerts / swap indexing.
- **Durable 24h idempotency** claim (was 60s) + idempotent downstream writes.
- **Capped exponential backoff with deterministic jitter** (pure, 11 unit tests),
  **dead-letter after 6 attempts**, durable Redis **delay queue + DLQ** with
  **peek/replay**, drained by `/api/cron/drain-webhooks` (2m) which also emits
  `webhook.retry.depth` / `webhook.dlq.depth` gauges.
- **Metrics**: received / deduped / process.ms / retry.depth / dlq.depth →
  `ops_metrics`; ops events (auto-incident) on retry/dead-letter.

**Decision — Redis vs DB queue:** chose Redis (already in the stack) over a new
Supabase table to avoid an unprompted production schema migration and keep the
queue self-contained/testable. A DB-backed queue with per-attempt delivery
history is the natural upgrade if durability requirements tighten.

**Tradeoff — happy-path not pre-persisted:** only failures persist to Redis (one
fewer write per webhook — matters for the Helius firehose that previously burned
~300k credits). Residual loss window (crash between ACK and first attempt) is
covered by provider re-delivery + downstream idempotency. Documented; upgrade
path noted.

**Remaining:** admin webhook-health dashboard (DLQ depth/contents + one-click
replay) — folded into the unified ops dashboard in Mission 5.

---

## Mission 3 — Money-path testing

### Audit

Idempotency is genuinely good on the critical paths: trades dedup on
`tx_signature` (unique + pre-insert check, returns `idempotent:true`); pack
payments dedup on a unique `payment_tx`; fulfillment tracks delivered rewards per
reward id; AI quota uses atomic reserve→settle. Newer broadcast paths use
deterministic confirm polling (not the legacy Sender+Jito race).

**Real risks found:**
1. **Cashback + referral accrual are check-then-insert, not atomic, and
   best-effort** (swallowed in the route). A concurrent double could double-credit
   if the unique index isn't present; a transient error silently skips accrual.
2. **Points award dedup** has the same check-then-act race.
3. **Legacy `submit.ts` Sender+Jito race** still used by admin emergency-sell —
   can report a signature that didn't land.
4. **No end-to-end / integration / concurrency / emergency-control tests** for any
   money flow — all current tests are pure math (fee/cashback/economics).

Test runner: `node --import tsx --test`; no DB/Redis/RPC mocking harness.

### Implementation (next)

Deterministic money-path tests targeting the exact guarantees above —
idempotency (double-submit → one effect), the accrual races, emergency-control
gating — plus hardening the check-then-insert races where a duplicate could
double-credit. Pure-logic extraction where the current code mixes I/O with
decisioning, so the guarantees are unit-testable.

---

## Mission 4 — CI/CD ✅ SHIPPED (`99bdec5`)

### Audit

**No CI existed** (no `.github/workflows`, no pre-commit hooks). But all the gate
*scripts* are present: `typecheck` (tsc strict), `lint` (eslint flat),
`test` (107 files), `build`, `format:check`. Deploy is git-triggered Vercel
(`vercel.json`, 9 crons → now 10). Migrations are manual SQL in `scripts/*.sql`.
No env-validation at boot. `/api/health` (liveness) + `/api/admin/ops/health`
(full snapshot) exist but aren't wired to deploys.

### Implementation

Full detail in [docs/CICD.md](docs/CICD.md).

- **`ci.yml`** (PR + push to main): install (`--legacy-peer-deps`, mirrors
  Vercel) → validate env schema → migration sanity → typecheck → lint → test →
  build (placeholder env, no secrets). `concurrency` cancels superseded runs.
  Enable branch protection requiring `verify` to block merges on red.
- **Env contract** as a pure, unit-tested source of truth (`lib/env/required.ts`,
  required vs recommended with `anyOf` alternates). `validate:env` is a deploy
  preflight (fails on missing required); `validate:env:schema` is the CI shape
  check. `check:migrations` guards the 43 SQL files.
- **`deploy-health.yml`**: probes `/api/health` + `/api/emergency/status` ~90s
  after a push, every 15m, and on demand (`scripts/health-check.ts`). No-ops
  until `POINTER_PRODUCTION_URL` repo var is set.

**Decisions / tradeoffs:** Node 20 in CI (matches `engines`; bump to match
Vercel's 24 once verified). Build uses placeholder env so CI needs no secrets.
Vercel owns deploys (git integration), so the gate is branch protection + the
post-deploy probe rather than a workflow-driven promotion; hard pre-promotion
gating would require switching to CLI deploys (noted). Rollback = Vercel
promote-previous, plus Redis-backed emergency controls for redeploy-free
mitigation.

---

## Mission 5 — Incident management

### Audit — strong substrate already exists

`ops_events` / `ops_metrics` / `ops_incidents` tables + `ops_open_incident` RPC
(auto-incident on error/critical), `collectOpsHealth()` across 13 providers +
trading/indexer/pulse/cron sections, the deterministic **Pointer Doctor**
(`diagnose()`), and an admin ops dashboard. Emergency controls (Phase 0.1) are
the manual circuit breaker.

**Gaps:** no outbound alerting (Discord/Slack/email); incident lifecycle is
auto-open only (no ack / resolve / runbook links); no health checks for the new
queue/webhook/DLQ subsystems; no severity-routed notification.

### Implementation (planned)

Extend, don't rebuild: subsystem health checks (Redis, queue depth, webhook DLQ,
cron freshness) feeding `diagnose()`; outbound alerting (Discord/Slack webhooks +
email) routed by severity with dedup/cooldown; incident ack/resolve + runbook
links surfaced in admin; the webhook-health view from Mission 2.

---

## Mission 6 — Provably-fair packs ✅ SHIPPED (`adde97c`, `aaaa453`)

### Audit — not provably fair today

Outcome was computed server-side from `Math.random()` (unseeded, server-chosen,
no commitment). No client seed, server seed, commit, reveal, nonce, or
verification was stored — a player could not prove they weren't cheated. Economics
(house edge ≥22%, EV) are correctly modeled and logged; overrides are an
explicit, four-eyes-approved admin promo path (not a fairness hole).

### Implementation

Commit-reveal (HMAC-SHA256), full design in
[docs/PROVABLY_FAIR_PACKS.md](docs/PROVABLY_FAIR_PACKS.md):

- **`lib/packs/provablyFair.ts`** (pure, `node:crypto`, 9 tests) — server commits
  `sha256(serverSeed)`; draws come from a deterministic
  `HMAC(serverSeed, clientSeed:nonce:counter)` keystream; rotation reveals the
  seed so anyone can verify the hash + replay every roll.
- **`lib/packs/fairnessSeeds.ts`** (Redis) — per-user seed lifecycle, atomic
  nonce, set-client-seed + rotate.
- **`openPackServer`** now injected with the fair keystream (it already took an
  `rng`); the open route reserves a roll lazily (forced override/dev outcomes
  burn no nonce, are flagged `forced`), attaches the proof to the existing
  `pack_opens.result` JSON (**no schema change**), and reveals anon-open seeds
  inline.
- **API:** `GET/POST /api/packs/fairness` (commitment, set-seed, rotate-and-reveal)
  + public `POST /api/packs/fairness/verify` (recompute from a revealed seed).

**Decision:** commit-reveal over VRF/drand — the audited, pragmatic baseline that
needs no third party and is fully self-verifiable; VRF noted as a future upgrade.
Proof persisted in the existing JSON column to avoid a production migration.

---

## Cross-cutting decisions

- **Build on the existing ops substrate** (`ops_events`/`ops_metrics`/incidents/
  Doctor/emergency controls) rather than introducing parallel systems.
- **No unprompted production schema migrations** — Redis-backed where possible;
  any required DB change ships as a reviewed migration file, not an applied one.
- **Pure-logic / I/O split** so every decision (retry, fairness RNG, money
  guards) is deterministically unit-testable under `node --test`.
- **Fail-closed for money/AI, fail-open for data-path cost guards** — consistent
  with Phase 0.

## Remaining risks (live)

- Discovery latency (~15m) until discovery webhooks / Realtime push land (M1).
- Legacy `submit.ts` race on the admin emergency-sell path (M3 follow-up).
- No outbound alerting yet — incidents are visible in admin but not pushed (M5).
- Packs not yet provably fair (M6).
- CI not yet enforced on PRs (M4).

## Changelog

- `1a35955` — secure predictions/orders (auth + freeze + rate limit).
- `af4516f` — Mission 2: webhook async queue / retry / DLQ / durable idempotency.
- `f871c5d` — Phase 1 implementation report (this doc).
- `99bdec5` — Mission 4: CI/CD gates, env validation, post-deploy health probe.
- `adde97c` — Mission 6: provably-fair cryptographic core (commit-reveal).
- `aaaa453` — Mission 6: wire fair rolls into packs + player verification API.
