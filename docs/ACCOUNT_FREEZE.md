# Account Freeze Enforcement (Phase 0.4)

An admin can **freeze** a user (`/admin/users` → Account control, requires
`account.control`) to immediately stop that account from trading and/or running
automation — e.g. during a fraud / abuse / compliance investigation. This doc is
the contract for **where** the freeze is enforced. Before this phase the gate was
only wired into `trade/execute` + `trade/quote`; every other money/automation
entry point bypassed it. It is now enforced on every per-user create / money-out
path.

## The model

`account_controls` holds at most one active (`status='frozen'`) row per user with
a **scope**:

| scope | blocks `trading` | blocks `automation` |
| --- | --- | --- |
| `trading` | ✅ | — |
| `automation` | — | ✅ |
| `all` | ✅ | ✅ |

Resolution: `isActivityFrozen(userId, kind)` → `blocksActivityForKind(control, kind)`
(pure, unit-tested). 10s in-process cache; invalidated on freeze/release.

## The single gate

One helper, used everywhere (`lib/trade/accountControlGate.ts`):

```ts
const blocked = await accountFreezeGateOrNull(userId, 'trading' | 'automation');
if (blocked) return blocked; // 423 account_frozen | 503 account_control_unavailable
```

- **Fail CLOSED per-user**: if the freeze lookup throws for this user, the gate
  returns **503** (`account_control_unavailable`) — the action is denied, not
  allowed. A throwing check never affects other users.
- **423** (`account_frozen`) when an active control blocks the requested kind.
- Pure decision logic lives in `lib/account/tradingFreezeGate.ts`; the I/O wrapper
  is the only thing routes import. `tradingFreezeGateOrNull` / `checkTradingFreezeGate`
  remain as trading-kind shims for existing callers.

## Enforcement points

**Trading kind** (open a new position / move funds):

| Path | Action gated |
| --- | --- |
| `POST /api/trade/execute` | manual swap (pre-existing) |
| `POST /api/trade/quote` | quote (pre-existing) |
| `POST /api/limit-orders` | create a limit order |
| `POST /api/splitnow/order` | route a split / DCA order |
| `POST /api/packs/open` | open a pack (only when a user is attached) |
| `POST /api/packs/pay` | pay for a pack |
| `POST /api/packs/pay-broadcast` | broadcast the pack payment (defense-in-depth) |
| `POST /api/wallets/send-native` | build a native SOL transfer to sign |

**Automation kind** (arm server/automation that will trade later):

| Path | Action gated |
| --- | --- |
| `POST /api/trackers` | arm a copy-trade tracker |
| `POST /api/trackers/rules` | add an automation rule to a tracker |
| `POST /api/alert-rules` | arm an alert / Twitter-listen auto-buy rule |

Automated auto-buys execute **client-side** (`autoBuyDispatch` → the browser
signs and calls `trade/execute`), so the actual money movement is independently
caught by the trade-execute gate. Arming the rule is gated under `automation`;
firing it is gated under `trading`. Both halves are covered.

## Deliberately NOT gated

- **Cancel / close / disable paths** (`DELETE /api/limit-orders/[id]`, removing a
  tracker, disabling a rule). De-risking actions stay available to a frozen user —
  a freeze stops *new* exposure, it should not trap a user in an open position.
- **`POST /api/predictions/orders`** — places orders on a **server-side house
  Kalshi account** with **no per-user identity**, so per-user freeze does not
  apply. (Its lack of any auth is a separate finding, flagged for review.)
- **`wallets/export-key`** — returning the user their own private key is a custody
  action, not Pointer-mediated trading; a `trading`-scope freeze does not block it.

## Tests

`tests/accountControlGate.test.ts` — 13 cases: trading/automation/all scope
matrix, `all` blocks both kinds (no bypass), released/null blocks neither,
fail-closed 503 on lookup error, and the 423 payload shape. Run:
`node --import tsx --test "tests/accountControlGate.test.ts"`.
