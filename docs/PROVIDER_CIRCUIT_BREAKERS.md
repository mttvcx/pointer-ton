# Provider Circuit Breakers (Phase 0.3)

Cost / runaway protection for paid upstream providers. A misbehaving loop, a
webhook firehose (see the Helius incident that burned ~300k credits), or a
scraping spike can otherwise drain a provider's monthly quota — or its bill — in
hours. The breaker meters every call and **hard-cuts** a provider when it runs
over budget, plus a manual admin **emergency cutoff** per provider.

## Protected providers

| Provider | Default daily | Default monthly | Wired chokepoint | On trip |
| --- | --- | --- | --- | --- |
| `helius` | 1,000,000 cr | 15,000,000 cr | `heliusCall()` (`lib/helius/creditLogger.ts`) | throws → caller errors |
| `moralis` | 10,000 req | 100,000 req | `fetchMoralisTokenHolderSnapshot()` | returns `null` (degrades) |
| `insightx` | 0 (no daily cap) | 950 req | `ixFetch()` via `reserveCredit()` | `IxError('rate_limited', 429)` |
| `dexscreener` | 200,000 req | 0 (no monthly cap) | `ensureTokenRowFromDexScreener()` | degrades to existing token data |
| `jupiter` | 200,000 req | 0 (no monthly cap) | `getQuote()` + `getSwapTx()` | **record-only** (see below) |

Budgets are **env-configurable** — defaults are generous so normal ops never
trip. Tune to your plan:

```
HELIUS_DAILY_CREDITS / HELIUS_MONTHLY_CREDITS
MORALIS_DAILY_REQUESTS / MORALIS_MONTHLY_REQUESTS
INSIGHTX_DAILY_BUDGET / INSIGHTX_MONTHLY_BUDGET   # free tier = 1000/mo, default 950
DEXSCREENER_DAILY_REQUESTS / DEXSCREENER_MONTHLY_REQUESTS
JUPITER_DAILY_REQUESTS / JUPITER_MONTHLY_REQUESTS
```

A budget of `0` means **unlimited for that window** (the other window still
applies).

## States

`decideBreakerState(usedDaily, usedMonthly, budget)` → one of:

- **`ok`** — under `warnPct` of both windows. Call proceeds.
- **`warn`** — at/over `warnPct` (soft warning; default 80%, DexScreener/Jupiter
  90%). Call still proceeds; the dashboard turns amber.
- **`tripped`** — over the daily **or** monthly budget. **Hard cutoff** — the
  call is blocked.
- **`disabled`** — an admin flipped the manual emergency cutoff. Hard cutoff.

`ok`/`warn` allow the call; `tripped`/`disabled` block it. (`stateAllows`.)

## Fail-open vs the AI guard

This is a **cost guard for the data path**, so it **FAILS OPEN** on a Redis
error: a transient Redis blip must not take Helius/Jupiter down platform-wide.
Budgets are still enforced whenever Redis is reachable — which is the case during
a real runaway. This is deliberately the **opposite** of the Phase 0.2 AI spend
guard, which fails **closed** (no spend without a working ceiling check).

### The trade path is special (Jupiter)

`getQuote` / `getSwapTx` sit on the live trade hot path. They **record** usage
atomically (so the dashboard and budgets see real volume) but a budget overage
only `warn`s — it does **not** auto-block trading. The only thing that blocks the
trade path here is a **manual admin cutoff** (`disabled`). Auto-halting trading
on a cost counter is the job of the Emergency **trading** kill switch
(Phase 0.1), not a per-provider budget.

## Internals

- `lib/providers/breakerDecisions.ts` — pure, unit-tested decision logic (no I/O).
- `lib/providers/circuitBreaker.ts` — atomic I/O:
  - `chargeProvider(provider, units)` — `INCRBYFLOAT` per-provider daily + monthly
    counters, returns `{ allowed, state, usedDaily, usedMonthly }`. Fails open.
  - `guardProvider(provider, units)` — charges and **throws** `ProviderBreakerError`
    when not allowed (the hard-cutoff form).
  - `setProviderCutoff(provider, disabled)` — manual admin toggle (throws if Redis
    is unreachable so the admin knows the change did NOT apply).
  - `getProviderStates()` — read-only dashboard view (no charge).

Counters are keyed `prov:u:<provider>:<YYYY-MM-DD>` (daily, 36h TTL) and
`prov:u:<provider>:<YYYY-MM>` (monthly, 35d TTL); the cutoff flag is
`prov:cutoff:<provider>`.

## Admin

- **Dashboard:** `/admin/providers` — per-provider usage vs daily/monthly budget,
  computed state, and a per-provider **Emergency cutoff / Restore** button. Any
  admin may view; flipping a cutoff requires the **`providers.control`**
  permission (superadmin by default).
- **API:** `GET /api/admin/providers` (states), `POST /api/admin/providers`
  `{ provider, disabled, reason? }` (toggle cutoff). Every toggle is
  audit-logged (`providers.cutoff` / `providers.restore`) and reversible.

## Tests

`lib/providers/breakerDecisions.test.ts` — 9 cases: ok/warn/tripped boundaries
across both windows, strict `>` at the cap, 0-budget = unlimited, `stateAllows`,
and registry coverage of exactly the five providers.

## Relationship to other controls

- **Emergency Control System** (Phase 0.1) — global/per-chain kill switches,
  maintenance + read-only. Halts *features*, not individual providers.
- **AI cost protection** (Phase 0.2) — fail-CLOSED spend ceilings for the AI
  cascade. Same idea, opposite failure mode, different subsystem.
- **Provider breakers** (this doc) — fail-OPEN budget cutoffs per upstream.
