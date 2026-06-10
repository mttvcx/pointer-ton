# Founder Beta Readiness — Sprint 2 Report

**Date:** 2026-06-08  
**Environment:** `http://localhost:3001`  
**Sol classification:** cleared (0% unknown)

---

## Verdict: **Not Founder Beta Ready**

Automated gates pass. **Auth + trade + PnL share require your manual Phantom session** — no confirmed trades or share cards in DB yet.

---

## Beta matrix

| Check | Result | Evidence |
|-------|--------|----------|
| **Auth** | **Manual pending** | Sign-in modal shows Email / Google / X / Phantom; DB has Privy users but no Sprint 2 trade proof |
| **Wallet connect** | **Manual pending** | Latest user has embedded `Pointer Wallet` rows; Phantom external sync code ready |
| **Portfolio** | **Code ready** | `/portfolio` gated when signed out; syncing UX added |
| **Trackers** | **Partial** | Latest user: `starter_trackers_seeded_at` set, 1 group, **0 tracked_wallets** — verify after fresh Phantom login |
| **Points/cashback** | **Manual pending** | No `user_points` rows for latest user (no trade yet) |
| **Quote** | **Manual pending** | Jupiter quote path wired; 0.001 SOL preset when `NEXT_PUBLIC_FOUNDER_BETA=1` |
| **Execute buy** | **Manual pending** | No `trades` rows |
| **Execute sell** | **Not tested** | Blocked until buy succeeds |
| **Trade DB row** | **Fail** (no data) | 0 trades for latest user |
| **PnL tracker** | **Manual pending** | Requires portfolio + positions |
| **PnL card export** | **Manual pending** | No `pnl_cards` rows |
| **Sol unknown rate** | **Pass** | **0/62 (0.0%)** |
| **Desktop gate** | **Pass** | Global `FounderBetaDesktopGate` + mobile trade soft-block |

---

## Automated verification (`npm run verify:founder-beta`)

```
Sol unknown: 0/62 (0.0%) → PASS
Latest user: privy session, starter_trackers_seeded_at=yes
user_wallets: Pointer Wallet (primary) + embedded Sol/EVM
trades: none
user_points: none
pnl_cards: none
```

---

## Sprint 2 code changes (local, uncommitted)

| Area | Change |
|------|--------|
| Auth | X OAuth in modal; wallet re-sync; external Phantom → `user_wallets` |
| Trade | 0.001 SOL founder presets; mobile trade blocked on narrow viewports |
| Portfolio | “Setting up your account…” while `backendReady` syncs |
| Desktop scope | `FounderBetaDesktopGate` on all routes via `providers.tsx` |
| Tooling | `npm run verify:founder-beta` DB proof script |

---

## Manual Phantom checklist (~10 min)

1. **`.env.local`**
   ```
   NEXT_PUBLIC_FOUNDER_BETA=1
   NEXT_PUBLIC_APP_URL=http://127.0.0.1:3001
   NEXT_PUBLIC_UI_DEMO_MODE=0
   ```
2. Restart `npm run dev`
3. Landing → **Connect with Phantom** (not email — use your founder wallet)
4. Confirm routes load: `/portfolio`, `/track`, `/portfolio?tab=wallets`, `/points`
5. Pulse → pick a **liquid** token (pump.fun with MC/volume) → token page
6. Buy → **0.001 SOL** → quote → approve in Phantom
7. Re-run `npm run verify:founder-beta` — expect `trades` + `user_points`
8. Portfolio → closed/active position → **Share PnL** → copy `/share/…` link → open in new tab
9. Confirm Pointer branding on share page

---

## DB proof queries

```sql
-- After Phantom trade
select id, side, amount_sol, status, tx_signature, confirmed_at
from trades where user_id = '<user-id>' order by confirmed_at desc limit 3;

select source, amount, metadata, created_at
from user_points where user_id = '<user-id>' order by created_at desc limit 10;

select share_token, trade_id, created_at from pnl_cards
where user_id = '<user-id>' order by created_at desc limit 3;

-- Trackers (expect starter packs with wallets)
select tg.label, count(tw.id) from tracker_groups tg
left join tracked_wallets tw on tw.group_id = tg.id
where tg.user_id = '<user-id>' group by tg.id, tg.label;
```

---

## Remaining blockers

1. **No confirmed Phantom trade in DB** — P0 gate for Founder Beta Ready
2. **No PnL share card generated** — depends on trade
3. **Tracker seeding** — latest DB user has 0 tracked wallets despite `starter_trackers_seeded_at`; re-verify on fresh Phantom account (may be edge case: empty group marked seeded)
4. **Landing hydration warning** in dev (cosmetic, pre-existing)
5. **Sprint 1 auth/trade fixes uncommitted** — commit when manual pass confirmed

---

## When to call Founder Beta Ready

All three must pass on localhost with **your** Phantom wallet:

- [ ] Auth + all signed-in routes
- [ ] Quote + execute buy (0.001 SOL minimum)
- [ ] PnL share card create + export

Then re-run this matrix and update each row to **Pass** with screenshot paths.
