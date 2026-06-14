# Realtime ingestion — audit & runbook

Last updated: 2026-06-12

Pointer Pulse is **not Axiom-ready** until this loop runs automatically in production without manual `backfill:active-mints`.

---

## 1. What runs automatically today

| Job | Schedule (Vercel) | Endpoint | What it does |
|-----|-------------------|----------|--------------|
| **Discover** | every 2 min | `GET/POST /api/cron/discover-tokens` | TonAPI jettons, Helius DAS launchpads, GeckoTerminal new pools (ETH/BSC/Base) → `tokens` inserts |
| **Enrich** | every 3 min | `/api/cron/enrich-pulse` | DexScreener V/MC/tx → **persists** `token_market_snapshots`; Sol holder/pump/social/dex-paid → token + snapshot patches |
| **Index** | every 5 min | `/api/cron/index-active-mints` | Top visible Sol Pulse mints → Helius enhanced tx backfill → `mint_swaps`, wallet stats, `mint_index_status` |
| **Retry** | every 10 min | `/api/cron/retry-failed-indexes` | Re-attempt `mint_index_status.status = failed` (15m+ stale) |
| **Legacy poll** | (removed from schedule) | `/api/cron/pulse-poll` | Alias of discover — kept for manual compat |

**Cold-start (no cron):** Pulse feed sync-polls TonAPI (TON) or Helius DAS (SOL) when a column has fewer than 6 rows, then widens the DB window.

**Inline on feed GET:** DexScreener + Moralis/pump.fun overlay (best-effort, 6–9s cap) — cron persist is what makes the next fetch show real numbers instead of `--`.

---

## 2. What still required manual before this change

| Command | Was required for |
|---------|------------------|
| `npm run backfill:active-mints` | Indexer / chain tape for desk trades & top traders |
| `npm run setup:webhooks` | Real-time swap stream into `mint_swaps` |
| Hitting `/api/cron/pulse-poll` manually | Local discovery without Vercel |

After deploy + `CRON_SECRET`, **indexing is automatic** via `index-active-mints`. Manual backfill remains useful for one-off deep history.

---

## 3. Missing / external infra

| Piece | Status |
|-------|--------|
| **Supabase pg_cron** | Not used — Vercel crons call Next routes |
| **Helius webhook** | Route exists (`POST /api/webhooks/helius`); registration via `npm run setup:webhooks` needs **public HTTPS URL** (deploy or ngrok) |
| **Polling worker** | Vercel cron + optional `npm run cron:loop` locally |
| **Redis** | Upstash used for AI cache / rate limits, not Pulse discovery |

### Helius webhook checklist

1. Deploy Pointer (or `ngrok http 3001` + set `NEXT_PUBLIC_APP_URL`)
2. `HELIUS_API_KEY`, `HELIUS_WEBHOOK_AUTH_TOKEN`, `HELIUS_WEBHOOK_ID` in env
3. `npm run setup:webhooks` — subscribes to swap / token events for indexed mints
4. Swaps → webhook handler → `mint_swaps` upsert → Pulse desk refreshes via TanStack refetch

**True sub-second tape** needs webhook + paid Helius (enhanced tx volume). Cron indexing alone is **2–5 min lag**.

---

## 4. Required env vars

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | DB |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server writes |
| `CRON_SECRET` | prod yes | Cron auth |
| `HELIUS_API_KEY` | yes (Sol) | DAS discovery, indexer, RPC |
| `HELIUS_WEBHOOK_AUTH_TOKEN` | webhook | Verify webhook POSTs |
| `TON_API_KEY` | optional | Higher TonAPI rate limits |
| `MORALIS_API_KEY` | optional | Sol holder counts in enrich |
| `JUPITER_API_KEY` | optional | Swaps only — not ingestion |
| `POINTER_PAUSE_INGEST=1` | kill switch | Pauses all cron ingest |
| `POINTER_CRON_SECRET` | optional | `/api/indexer/auto-backfill` |

---

## 5. Why Axiom shows dozens of rows and Pointer showed a handful

1. **Discovery gap** — Only `pulse-poll` every 2 min; no enrich/index cron; Dex overlay **not persisted** → UI showed `--` after refetch.
2. **TON bias** — Feed **blocking** TonAPI poll when sparse; Sol only fire-and-forget async until this fix (now sync DAS on cold start).
3. **Column gates** — Migrated tokens filtered from NEW (fixed); stretch needs `bonding_progress` populated (pump.fun enrich cron path).
4. **Indexer disconnected** — Pulse visibility did not enqueue Helius backfill without manual script.
5. **Rate limits** — Free Helius DAS credits exhaust quickly; 429s → partial discovery (see `helius_usage` table).

---

## 6. Local commands

```bash
# Dev server
npm run dev

# One-shot cron (server must be up)
npm run cron:local all
npm run cron:local discover

# Direct pipeline (no HTTP)
node --import tsx scripts/run-ingest-loop.ts --minutes=12 --interval=120
```

Auth: set `CRON_SECRET` in `.env.local`; dev without secret allows cron routes when `NODE_ENV !== production`.

---

## 7. Paid API report

| Service | Required? | Unlocks | Broken without | Est. cost |
|---------|-----------|---------|----------------|-----------|
| **Helius** | **Yes** (Sol product) | DAS discovery, enhanced tx indexer, webhooks, Sender | No new Sol mints, no chain tape, no swaps | Developer ~$49/mo; Business if heavy indexer |
| **Moralis** | Optional | Holder count, top10/dev/sniper % on Pulse rows | Holder icon empty; strip metrics `--` | Free tier limited; Pro ~$49/mo |
| **Jupiter API key** | Optional | Swap quotes/execution rate limits | Trades fail/slow under load — **not** Pulse rows | Free at portal.jup.ag |
| **Birdeye** | Optional | Not wired in Phase 1 | N/A | — |
| **DexScreener** | Free | V/MC/tx/paid flag | Metrics `--` when cron enrich fails | $0 (rate limit ~300/min) |
| **TonAPI** | Optional | TON jetton discovery | TON column sparse | Free tier OK for beta |
| **GeckoTerminal** | Free | EVM new pools | BNB/Base/ETH NEW empty | $0 |

**Minimum to ship Sol Pulse:** Helius paid or generous dev plan + Vercel Pro (cron) + Supabase.

---

## 8. Acceptance checklist

- [ ] Deploy with `CRON_SECRET` and verify Vercel cron logs
- [ ] SOL NEW ≥ 20 rows during active market (after 10–20 min loop)
- [ ] MIGRATED rows with real V/MC (not all `$1.9K` duplicates)
- [ ] STRETCH populated when `bonding_progress ≥ 85` exists
- [ ] No Helius CDN URLs as website (sanitized in enrich)
- [ ] `mint_index_status.indexed` grows without manual backfill
- [ ] Register Helius webhook on production URL for live tape

---

## 9. Verification log template

Run `npm run cron:loop` and paste:

```
pulseBefore / pulseAfter (sol new/stretch/migrated)
tokens discovered (solDas + gecko + ton)
dexPersisted / metricsPersisted
indexedCount / totalSwapsInserted / heliusCalls
failed mints before → after
429 count (from logs / helius_usage)
```

---

## 10. Local verification (2026-06-13)

One-shot `npm run cron:local all`:

| Step | Result |
|------|--------|
| **Discover** | tonapi 86, gecko eth 6 / bsc 9 / base 13, solDas 0 (credits/rate limit — re-run later) |
| **Enrich** | 111 tokens considered; **14 Dex snapshots persisted** (Sol); 1 metrics patch |
| **Index** | 4 Sol mints processed; **829 swaps inserted**; 36 Helius calls |
| **Retry** | 1 failed mint re-indexed successfully |

Pulse feed counts after loop (via `/api/pulse/feed`):

| Chain | NEW | STRETCH | MIGRATED |
|-------|-----|---------|----------|
| **SOL** | 9 | — | 3 |
| **TON** | 60 | — | — |

**Still not Axiom-ready:** SOL NEW &lt; 20 (Helius DAS returning 0 this session), EVM Dex persist 0 (needs address normalization audit), sub-second tape still needs deployed webhook.

**Next:** Deploy with `CRON_SECRET`, register Helius webhook on prod URL, add `MORALIS_API_KEY` for holder counts.
