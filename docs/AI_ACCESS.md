# AI Access Policy (§10 — Subscription / Holdings Gate)

AI features require **one of**:
- **(A)** linked wallets holding **≥ 5 SOL combined** (`AI_ACCESS_MIN_SOL`), or
- **(B)** an **active Pointer subscription**.

## Design

- **Pure decision** (`lib/access/aiAccessDecision.ts`, 10 tests) — subscription
  wins outright; otherwise verified holdings vs threshold; otherwise the grace
  rule. The correctness invariant: **never wrongly revoke**. A *confirmed* below-
  threshold balance denies; an *unverifiable* balance (RPC failure) keeps access
  **within a grace window**, never on a cold first-ever check (no security hole).
- **I/O** (`lib/access/aiAccess.ts`) — `getAiAccess(userId)`:
  1. `hasActiveSubscription` (Supabase). If subscribed → granted, skip RPC.
  2. else sum native SOL across linked Solana wallets via `getBalance`, **cached
     10m** in Redis (so AI calls don't hammer RPC).
  3. on RPC failure → `null` holdings; if a recent grant is cached (6h grace) →
     keep access; else deny.
  4. a real grant refreshes the grace window.
- **Enforcement** is gated by **`AI_ACCESS_ENFORCED`** (default **OFF**). The gate
  is fully built + tested but does not block until you flip it to `1` — so it
  ships without disrupting the founder beta. `assertAiAccess` is wired into
  `runCascade` (the single AI chokepoint), so enabling it covers **every** AI
  pipeline at once.
- **Errors** → `AiAccessError` → **HTTP 403** `ai_access_denied` with the decision
  (`basis`, `reason`, `holdingsSol`, `thresholdSol`) so the client can show the
  upgrade flow.
- **"Why access"** → `GET /api/me/ai-access` returns the live decision + headline.

## Subscriptions

`scripts/subscriptions.sql` creates the `subscriptions` table (one active row per
user, `current_period_end` for expiry). `lib/access/subscription.ts` reads it and
returns null gracefully before the migration is applied (holdings path still
works). Granting a subscription = insert an `active` row (provider integration —
Stripe/crypto — is a follow-on; the access gate is provider-agnostic).

## Operate

| Env | Default | Effect |
| --- | --- | --- |
| `AI_ACCESS_ENFORCED` | `0` (off) | Set `1` to enforce the gate in production |
| `AI_ACCESS_MIN_SOL` | `5` | Combined-SOL threshold |

**Founder beta:** leave `AI_ACCESS_ENFORCED` unset (off) so founders use AI freely;
flip to `1` when you want holdings/subscription to gate AI. Apply
`scripts/subscriptions.sql` whenever you wire subscriptions.

## Tests

`lib/access/aiAccessDecision.test.ts` — subscription override, threshold
boundaries (incl. custom threshold), confirmed-below denies, fail-open grace,
no-grace-on-cold-failure, and headline formatting.
