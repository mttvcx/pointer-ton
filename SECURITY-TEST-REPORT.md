# Pointer — Pre-Beta Safety Baseline

Baseline of automated tests + a security/permission audit so future agent edits
can't silently break economics, scoring, fee math, or the live/demo boundary.

No UI was changed. No trading-execution logic was changed. One low-risk
hardening was applied (rate limit on the public bug-report endpoint — see §5).

---

## 1. Commands to run before every commit

```bash
npm run typecheck   # tsc --noEmit (strict)
npm run lint        # eslint
npm test            # node --test (unit + safety + API-contract suites)
npm run build       # next build  (must pass)
```

`npm test` runs every `lib/**/*.test.ts` and `tests/**/*.test.ts` via the Node
test runner (`node --import tsx --test`). `npm run test:packs` still runs the
original pack-pricing suite on its own.

Quick gate (fast feedback): `npm run typecheck && npm test`
Full gate (pre-push): add `npm run lint && npm run build`.

---

## 2. Tests added

| File | Covers |
|------|--------|
| `lib/championship/scoring.test.ts` | PTCS: PnL points ($10→1pt), ROI multiplier tiers, volume points, profit-event bonuses, drawdown penalty, placement table, full `scoreParticipant` composition, disqualification zeroing, prize qualification |
| `lib/packs/packEconomics.test.ts` | Full-open EV `<` price, EV `≤` 78% ceiling, house edge `≥` 22% across 6 SOL/USD scenarios × all tiers; per-card×cards identity; validation guards (bps≠10000, cardsPerOpen<1, EV>price) |
| `tests/feeMath.test.ts` | Default platform fee = 1% (100 bps); fee formula `(lamports*bps)/10000` incl. flooring; autobuy/autolaunch use same path; referral share default 3000 bps + bounds clamping (`0..10000`) + invalid→fallback; share never exceeds platform fee |
| `tests/liveDemoSafety.test.ts` | All demo gates default OFF with no env flags; `"0"/"false"` never enables; explicit `"1"/"true"` opt-in works; `table-demo` does not enable full client/server fixtures; championship demo force-off honored; `EMPTY_TOKEN_EXTENDED_METRICS` is all-null |
| `tests/apiContracts.test.ts` | `/api/packs/open` simulated-ledger + live-commerce-OFF flags, pack-type enum, valid economics; `/api/pulse/feed` column enum + chain fallback; `/api/tokens/[mint]` mint validation; `/api/reports/bug` webhook gating + payload model |
| `lib/packs/pricing.test.ts` | (pre-existing) dynamic pricing + economics |

Result: **54 tests passing**.

### Notes / limitations
- **No "pack sell fee 2%" exists in code.** Packs run on a *simulated ledger*
  (`PACKS_OPEN_USES_SIMULATED_LEDGER = true`, `PACKS_LIVE_COMMERCE_ENABLED =
  false`); there is no live buy/sell/charge path, so there is nothing to test or
  fee. If a 2% pack-sell fee is intended for live commerce, it must be
  implemented first, then tested. Not invented here.
- The trade platform-fee formula is **inlined** in `app/api/trade/execute/route.ts`
  (both SOL and TON branches). `tests/feeMath.test.ts` mirrors that exact
  arithmetic and pins the expected values. If the route changes the formula,
  update the mirror (and ideally extract a shared helper — see §7).
- API routes that import `server-only` (DB / Privy / Helius) can't be imported
  into the Node test process, so API suites test the routes' pure building
  blocks + documented gating contracts rather than invoking handlers. Full
  black-box HTTP smoke tests would need a running server.

---

## 3. Live / demo safety

Verified the single most important pre-beta invariant: **in a clean environment
(no demo env flags), every demo gate returns `false`**, so no synthetic token
rows, traders, holders, wallet intel, or pack ledgers can render.

Gates audited & tested (all default-off):
- `uiDemoModeFromEnv()` / `isUiDemoMode()` ← `NEXT_PUBLIC_UI_DEMO_MODE`
- `preferTokenTableDemoRows()` ← `NEXT_PUBLIC_POINTER_TABLE_DEMO`
- `demoFixturesEnabledServer()` / `demoFixturesEnabledClient()` / `demoTablesEnabled()`
- `championshipDemoDataEnabled()` ← `NEXT_PUBLIC_CHAMPIONSHIP_DEMO`

Live-data integrity confirmed:
- Token metrics fall back to `EMPTY_TOKEN_EXTENDED_METRICS` (all-null) — never
  invented holder/security numbers.
- Pulse feed (`lib/helius/feed.ts`) only injects a demo row for the single QA
  mint **and** only when `demoFixturesEnabledServer()` is true.

---

## 4. Security scan

| Check | Result |
|-------|--------|
| Hardcoded API keys / secrets in source | **None.** All secrets read from `process.env`. |
| Private keys committed | **None.** No `-----BEGIN`, no key material. VAPID/Privy private keys are env-only and server-side. |
| Service-role key exposure | **OK.** `SUPABASE_SERVICE_ROLE_KEY` used only in `lib/supabase/server.ts` (`createAdminSupabase`); Next never inlines non-`NEXT_PUBLIC_` env into client bundles. |
| `NEXT_PUBLIC_*` misuse | **OK.** All public vars are non-secret config or intentionally public (VAPID *public* key, Privy app id, app URL, Onramper publishable key, demo flags). |
| Wallet / private-key leakage to client | **None found.** |
| `eval` / `new Function` | **None.** |
| `dangerouslySetInnerHTML` | Only static constants (theme bootstrap, CSS keyframes) — no user input. |
| `child_process` | Only in `scripts/` build tooling — not in runtime/request paths. |
| Public read rate limits | **Present** via `proxy.ts` → `enforcePublicApiRateLimit` for `/api/tokens/*`, `/api/prices/tickers`, `/api/stats/platform-volume`, `/api/resolve-address`, `/api/push/vapid-public-key`. |
| Oversized payload risk | Bug-report description capped at 12 000 chars; **screenshot data URL / context not size-bounded** (see §6 / §7). |

---

## 5. Auth / permission audit

| Surface | Control | Verdict |
|---------|---------|---------|
| `/api/admin/*` | `authorizeAdminRequest` — `POINTER_ADMIN_SECRET` (timing-safe) → else founder wallet in prod | OK (see prod-secret caveat) |
| `/api/referrals/payout` | `POINTER_ADMIN_SECRET` (timing-safe) | OK |
| `/api/cron/*` | `CRON_SECRET` bearer / `x-cron-secret` (timing-safe) | OK |
| `/api/webhooks/helius` | `HELIUS_WEBHOOK_AUTH_TOKEN` + signature dedup | OK |
| `/api/creators/auth/dev` | `assertCreatorDevLoginAllowed` (`CREATOR_PORTAL_DEV_LOGIN=1` or NODE_ENV=development) | OK |
| Pack test celebrations (`testCelebration`/`testJackpot`) | `NODE_ENV === 'development'` only | OK |
| Live pack commerce | `PACKS_LIVE_COMMERCE_ENABLED = false` (hard off → 403) | OK |
| Trade execute | Privy token verify + synced user + `userCanUseWalletForTrading` (imported keys view-only) | OK |

**Applied fix (low-risk):** `/api/reports/bug` is public + unauthenticated and,
when a webhook is configured, could be spammed to flood the Discord/Slack
webhook. Added it to `isPublicApiRateLimitPath` in
`lib/rate-limit/publicEdge.ts` so it's covered by the existing per-IP sliding
window (default 120/min). The limiter **fails open** when Upstash Redis is
unconfigured, so no new hard dependency and no behavior change in dev.

---

## 6. Issues found

### Applied (low-risk)
1. **Bug-report endpoint had no rate limit** → added to the public rate-limit
   path list (§5). Mechanism pre-existing, fails open, generous cap.

### Listed — NOT changed (need approval / behavior-sensitive)
2. **`lib/supabase/server.ts` has no `import 'server-only'`.** Not currently a
   leak (Next won't inline the service key), but adding the guard would turn an
   accidental client import into a build error. Risk: could break the build if
   anything imports it transitively from a client component — needs a build
   check before applying.
3. **Bug-report body not size-bounded** beyond `description ≤ 12 000`.
   `screenshotDataUrl` and `context` can be large; `coercePayload` trusts the
   client shape (`return o as BugReportPayload`). Recommend a max raw-body /
   screenshot length check. Behavior-affecting → not applied.
4. **Dev-convenience auth defaults to allow when `NODE_ENV !== 'production'`**
   for cron/admin/payout/creator-dev-login. Intentional, but means a deployed
   environment **must** set `NODE_ENV=production` AND configure
   `POINTER_ADMIN_SECRET` / `CRON_SECRET` / `HELIUS_WEBHOOK_AUTH_TOKEN`.
   Ops/config item, not a code bug.
5. **Pack live-commerce path is unimplemented** (simulated ledger). Before any
   real money flows, add: provable fairness (commit-reveal/VRF), per-user spend
   limits/cooldowns, region+age gate, and the reward-pool reservation — all
   already marked `TODO(compliance)/TODO(fairness)` in the route.

---

## 7. Recommendations (future, optional)
- Extract the inlined platform-fee math from `app/api/trade/execute/route.ts`
  into a shared pure helper (e.g. `lib/solana/platformFee.ts`) and have both the
  route and `tests/feeMath.test.ts` import it — single source of truth. (Touches
  execution path → do under review.)
- Add a CI step running `npm run typecheck && npm test && npm run build` on PRs.
- Consider a pre-commit hook (husky/lint-staged) wiring the §1 commands.
