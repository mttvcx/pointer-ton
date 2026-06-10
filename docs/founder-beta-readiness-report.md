# Founder Beta Readiness Report

**Date:** 2026-06-08  
**Environment:** `http://localhost:3001`  
**Demo mode:** off (`NEXT_PUBLIC_UI_DEMO_MODE=0`)  
**Founder beta flag:** set `NEXT_PUBLIC_FOUNDER_BETA=1` in `.env.local` for desktop gate + 0.001 SOL presets

---

## Sprint deliverables (P0-1 → P0-5)

| P0 | Area | Status | Notes |
|----|------|--------|-------|
| P0-1 | Auth E2E | **Ready for manual verify** | X OAuth added to sign-in modal; copy matches Privy methods; wallet re-sync when Phantom address arrives; `upsertUserFromPrivy` preserves real wallet |
| P0-2 | Trade E2E | **Ready for manual Phantom** | External Phantom synced to `user_wallets`; founder presets `[0.001, 0.01, 0.1, 0.5]` SOL when `NEXT_PUBLIC_FOUNDER_BETA=1` |
| P0-3 | Sol unknown cleanup | **Pass** | 0/62 (0.0%) after backfill; Fixes A–E shipped in `74db336` |
| P0-4 | Desktop-only beta gate | **Pass** | `FounderBetaDesktopGate` blocks viewports < 1024px when founder flag on |
| P0-5 | Pulse quality | **Pass** | Column-specific empty states; sparse MC/V → `--` via `NumberDisplay` |

---

## Automated verification

```
npm run typecheck   → pass
npm test            → 108/108 pass
npm run backfill:protocol → Sol unknown 0/62 (0.0%)
```

---

## Founder Beta Test Plan (requires manual Phantom)

| Area | Result | Severity | Notes |
|------|--------|----------|-------|
| Auth | **Manual** | P0 | Sign in via email / Google / X / Phantom; confirm `users` row + `starter_trackers_seeded_at` |
| Wallet connect | **Manual** | P0 | Phantom via landing modal; confirm `user_wallets` has Phantom row as primary |
| Trade quote | **Manual** | P0 | Token page → 0.001 SOL buy → quote returns without 403 |
| Trade execute | **Manual** | P0 | Sign in Phantom → smallest preset → `trades` row + portfolio refresh |
| Portfolio | **Manual** | P1 | `/portfolio` loads after auth sync (`backendReady`) |
| Trackers | **Manual** | P1 | `/track` + starter groups seeded |
| Points/cashback | **Manual** | P1 | `/points` loads; trade awards `user_points` |
| PnL card | **Manual** | P1 | Share card renders after position exists |
| Sol unknown rate | **Pass** | — | 0.0% visible Pulse (DB) |
| Mobile | **Gated** | — | Desktop-only overlay when `NEXT_PUBLIC_FOUNDER_BETA=1` |

**Verdict:** **Not Founder Beta Ready** until manual Phantom auth + trade pass on localhost. Code path is unblocked; automated gates pass.

---

## Manual test checklist (Phantom on localhost)

1. Set in `.env.local`:
   ```
   NEXT_PUBLIC_FOUNDER_BETA=1
   NEXT_PUBLIC_APP_URL=http://127.0.0.1:3001
   ```
2. Restart `npm run dev`
3. **Auth:** Landing → Sign Up → Connect with Phantom → lands on `/pulse`
4. **DB:** `users` row for your `privy_id`; `starter_trackers_seeded_at` set; `tracked_wallets` + `tracker_groups` seeded
5. **Routes:** `/portfolio`, `/track`, `/portfolio?tab=trackers`, `/points` load without sign-in wall
6. **Trade:** Open any Sol Pulse token → Buy → **0.001 SOL** → quote → execute → confirm `trades` row

---

## DB proof queries (Supabase SQL editor)

```sql
select id, privy_id, wallet_address, email, starter_trackers_seeded_at, created_at
from users order by created_at desc limit 5;

select label, wallet_address, is_primary, is_imported, is_active
from user_wallets where user_id = '<your-user-id>' order by is_primary desc;

select id, mint, side, amount_sol, tx_signature, status, confirmed_at
from trades where user_id = '<your-user-id>' order by confirmed_at desc limit 3;

select action, points, metadata, created_at
from user_points where user_id = '<your-user-id>' order by created_at desc limit 10;

select
  count(*) filter (where chain = 'sol' and (protocol_id is null or source_confidence < 0.5)) as sol_unknown,
  count(*) filter (where chain = 'sol') as sol_total
from tokens;
```
