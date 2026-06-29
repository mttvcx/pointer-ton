# Emergency Control System (Phase 0.1)

The "stop the bleeding" layer. A single, durable, **live-without-redeploy** set of
switches to halt money/AI/data flow during an incident. Built to **fail closed**.

> TL;DR for on-call: go to **Admin → Emergency** (`/admin/emergency`), flip the
> switch, add a reason. It takes effect within ~5 seconds. To undo, flip it back.

---

## What you can control

| Switch | Effect when OFF / ON |
|---|---|
| **Trading** (global kill) | Blocks all trade execution (spot sol/ton, limit orders, SplitNow, predictions). |
| **AI** (global kill) | Blocks every AI call at the cascade chokepoint. |
| **Packs** | Blocks pack opens. |
| **Cashback** | Trades still execute; cashback accrual is **skipped** (not failed). |
| **Referral** | Trades still execute; referral accrual is **skipped** (not failed). |
| **Per-chain** (sol / base / eth / bnb / ton) | Blocks trading on that one chain only. |
| **Maintenance mode** | Blocks **all** writes/money/AI; **reads stay up** (users can still view). Crons + the Helius webhook skip. Shows a critical banner. |
| **Read-only mode** | Blocks all mutations (trades/packs/writes); reads + AI stay up. Shows a banner. |
| **Emergency banner** | A message strip shown to every user (info / warn / critical). |

All changes are **reversible** (flip back), **audit-logged** (`admin_audit_log`,
action `emergency.set`, with before/after + reason + actor + IP), and require the
**`emergency.control`** permission (superadmin / break-glass only).

---

## How it works

- **Store:** Redis key `emergency:controls` (a single JSON blob), durable on
  Upstash. Changing it does **not** require a deploy — it propagates within the
  cache TTL (~5s).
- **Read path:** `getControls()` (`lib/emergency/controls.ts`) reads through a 5s
  in-process cache, so the hot path is ~0 Redis calls.
- **FAIL CLOSED:** if the controls store cannot be read and there is no cached
  value, every protected path (trade/AI/pack/cashback/referral, all chains) is
  treated as **paused** and read-only is forced. Reads still work, so the app
  degrades instead of vanishing. A transient Redis blip is tolerated with the
  last-known value (5s window); a sustained outage trips fail-closed.
- **Setting controls** throws if Redis is unreachable — the admin sees "change
  NOT applied" rather than a silent no-op.

The pure decision logic lives in `lib/emergency/decisions.ts` (no I/O — fully
unit-tested in `lib/emergency/decisions.test.ts`).

---

## Where it's enforced

Every guard is called at the **top** of the entry point and fails closed:

| Path | File | Guard |
|---|---|---|
| **All AI** | `lib/ai/cascade.ts` (`runCascade` chokepoint) | `assertAiAllowed()` |
| Spot trade (sol/ton) | `app/api/trade/execute/route.ts` | `assertTradingAllowed(chain)` |
| Limit orders | `app/api/limit-orders/route.ts` | `assertTradingAllowed('sol')` |
| SplitNow | `app/api/splitnow/order/route.ts` | `assertTradingAllowed('sol')` |
| Predictions | `app/api/predictions/orders/route.ts` | `assertTradingAllowed()` |
| Packs | `app/api/packs/open/route.ts` | `assertPacksAllowed()` |
| Cashback accrual | `lib/cashback/accrual.ts` | `isCashbackEnabled()` → skip |
| Referral accrual | `lib/referrals/earnings.ts` | `isReferralEnabled()` → skip |
| **All crons** | `lib/ingest/cronRoute.ts` (`runAuthorizedCron` chokepoint) | `isReadOnly()` → skip |
| Helius webhook | `app/api/webhooks/helius/route.ts` | `isReadOnly()` → ACK + skip |

Blocked HTTP requests return **503** `{ error: 'service_unavailable', code, message }`
with `Retry-After: 60` (via `emergencyBlockedResponse`).

To guard a **new** money/AI/write route, add one line at the top:

```ts
import { assertTradingAllowed, EmergencyBlockedError, emergencyBlockedResponse } from '@/lib/emergency/controls';
// ...
try { await assertTradingAllowed(chain); }
catch (e) { if (e instanceof EmergencyBlockedError) return emergencyBlockedResponse(e); throw e; }
```

For a side-effect (must not fail its parent), use the boolean form:
`if (!(await isCashbackEnabled())) return;`

---

## API

- `GET  /api/admin/emergency` → current full controls (perm `emergency.control`).
- `POST /api/admin/emergency` → apply a patch (perm `emergency.control`, audited).
  Body: any subset of `{ trading, ai, packs, cashback, referral, chains:{sol,base,eth,bnb,ton}, maintenance, readOnly, banner, reason }`.
  `banner` is `{ message, level }` or `null` to clear.
- `GET  /api/emergency/status` → public, non-sensitive `{ maintenance, readOnly, banner }` (drives the user banner).

The `EmergencyBanner` (`components/emergency/EmergencyBanner.tsx`) is mounted in
the app shell and polls the public status every 30s.

---

## Config

- `INSIGHTX_MONTHLY_BUDGET` is unrelated (provider breaker). The emergency system
  has **no env config** — it's all runtime via the admin panel.
- Requires Upstash (`UPSTASH_REDIS_REST_URL` / `_TOKEN`) — the same store the rest
  of the app already depends on.

---

## Known limitation / follow-on

`proxy.ts` runs on the **edge runtime** and cannot import the `server-only` Redis
controls, so there is **no hard full-site lockdown at the edge** today.
Maintenance mode is enforced at the route level (every write/money/AI path fails
closed) + the banner — which is the safer, more useful default (users can still
read during maintenance). A hard edge gate that returns a maintenance page for
**all** routes should use **Vercel Edge Config** (sub-ms edge reads) — that is the
documented next step, not Redis.

This is **Phase 0.1**. Phase 0.2 (atomic AI spend ceilings) and provider circuit
breakers are separate.
