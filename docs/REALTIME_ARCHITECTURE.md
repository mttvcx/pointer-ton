# Realtime Ingestion — Architecture Decision Record (Phase 1 · Mission 1)

## Status

Audit complete; **durable retry/replay/idempotency layer shipped** (Mission 2,
reused by all ingestion). The full event-driven migration (discovery webhooks,
client push) is a multi-week change with provider-tier + cost implications and is
sequenced here as a decision record, not implemented wholesale in Phase 1.

## Current state (audited)

Ingestion is a **hybrid of webhooks + cron polling**, lean but latency-heavy.

| Data type | Provider | Mechanism | Latency |
| --- | --- | --- | --- |
| Token discovery (Sol) | Helius DAS + launchpad SDK | 15m cron | ~15m |
| Token discovery (TON / EVM) | TonAPI / GeckoTerminal | 15m cron | ~15m |
| Swaps · wallet activity · migrations | Helius enhanced-tx | **webhook** + 20m cron backstop | realtime + backstop |
| Tracked-wallet alerts | Helius | webhook + 20m cron | ≤20m stale |
| KOL stats | Helius history | 30m rotating cron | ~30m |
| Pulse metric enrichment | Moralis / DexScreener | 15m cron + on-demand | ~15m |
| Price tickers | Jupiter / CoinGecko | on-demand, cached | low |
| Limit-order fills | on-chain checks | 2m cron | ≤2m |
| Client delivery | — | React Query polling (8–30s); Supabase Realtime initialized but **unused** | — |

**Safety already present:** durable webhook idempotency + retry + DLQ (Mission 2),
DB composite-key swap dedup, `mint_index_status` retry-with-cooldown.
**Absent:** event-driven discovery, ordering guarantees, client push.

## Target architecture (decision)

Per source, the right transport:

| Source | Today | Target | Rationale |
| --- | --- | --- | --- |
| **Helius** (swaps, migrations, tracked wallets) | webhook ✅ | webhook + **discovery webhook** for new mints | already event-driven; add the asset-created stream to kill the 15m discovery lag |
| **Pump.fun / launchpads** | poll | webhook/stream where available, else keep poll | discovery latency is the top product gap |
| **Moralis** | poll/on-demand | on-demand only (breaker-guarded) | metered; pull lazily, never on a hot cron |
| **DexScreener / GeckoTerminal** | poll | poll (no webhook offered) + cache | provider has no push; minimize via cache + breaker |
| **Jupiter** | on-demand | on-demand (unchanged) | price/quote is request-time |
| **TON / Base / Eth / BNB** | poll | poll, longer intervals + on-demand | lower volume; cost-sensitive |
| **Client delivery** | polling | **Supabase Realtime** (already initialized) for alerts/portfolio/Pulse, polling fallback | push beats 8–30s polling; cuts bandwidth + battery |

### Cross-cutting guarantees (the Mission 2 layer, reused)

Everything event-driven flows through the **same durable substrate** built in
Mission 2 (`lib/webhooks/*`): immediate ACK, durable idempotency claim, capped
exponential-backoff retry, dead-letter queue + replay, and metrics. New inbound
streams are a route that ACKs + enqueues plus a processor registry entry — they
inherit retry/replay/idempotency for free.

### Ordering

The one ordering hazard is a **swap event arriving before its mint row exists**
(null FK / dropped enrichment). Decision: processors must **upsert the mint
first** (idempotently) before recording its swaps, rather than assume discovery
ran first. This makes ingestion order-independent without partition affinity.
(Targeted hardening — sequenced with the discovery-webhook work that makes
out-of-order delivery common.)

## Decisions & tradeoffs

- **Reduce polling, don't eliminate it.** DexScreener/Gecko/Ton offer no push, so
  polling stays — but lazy + cached + breaker-guarded (Phase 0.3) so a runaway
  can't drain credits (the Helius firehose precedent).
- **Push to clients via Supabase Realtime** rather than build a bespoke SSE/WS
  layer — the client is already initialized and RLS-scoped; lowest-cost path to
  kill client polling.
- **Discovery webhooks are the highest-leverage latency win** (~15m → seconds)
  and the first thing to build next; gated on the Helius plan tier.
- **No new queue infra.** The Redis-backed Mission 2 queue is the substrate;
  revisit a DB-backed queue only if per-attempt delivery history is required.

## Sequenced follow-ons (post-Phase-1)

1. Helius asset-created **discovery webhook** → kill the 15m Pulse lag.
2. Migrate alerts / portfolio / Pulse client reads to **Supabase Realtime** (RLS
   audit + polling fallback).
3. Mint-before-swap **ordering** guard in the ingestion processors.
4. Persistent **tracked-wallet subscriptions** (paid tier) to drop the 20m poll.
5. Provider-latency p95 metrics on the `/admin/ops` dashboard (extends Phase 0.3
   breaker + Mission 2 metrics).

## What Phase 1 delivered for this mission

- This decision record.
- The durable **retry / replay / idempotency / DLQ** layer (Mission 2) that every
  future event-driven source reuses.
- Provider **circuit breakers** (Phase 0.3) that make "reduce polling, lazy + cached"
  safe to roll out without credit blowouts.
