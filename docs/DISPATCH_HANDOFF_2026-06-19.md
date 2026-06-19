# Dispatch Handoff — Pointer QA continuation (2026-06-19)

> **For:** the next Claude (dispatch / cloud / mobile-driven) picking up Pointer (`pointer-ton`).
> **From:** the local QA + fix session of 2026-06-19.
> **Read order:** this file → `docs/QA_RUN_REPORT_2026-06-19.md` → `HANDOFF.md` → `AGENTS.md`.

---

## 0. TL;DR — where things stand

A full QA pass vs Axiom was done locally. **1 P0 + 8 P1 + 1 P2 were fixed** in the working tree (uncommitted), with a complete report at `docs/QA_RUN_REPORT_2026-06-19.md`. `npm test` = **238/238 pass**. The biggest open items are infra (paid Helius) and a few documented P1/P2s. The local human is now driving you from their phone via dispatch.

**⚠️ FIRST THING TO CHECK:** are the QA fixes committed/pushed? Run `git log --oneline -3`. If the top commit is `5104d56` ("Fix Token-2022 desk balances…"), **the fixes are NOT in git yet** — see §1. You cannot continue the fix work meaningfully until they are, or you'll redo it.

---

## 1. Git state — the linchpin

As of handoff, the working tree had **three independent buckets of changes, none committed**:

| Bucket | Files | Owner | Action |
|--------|-------|-------|--------|
| **QA fixes** (this is the work) | `app/api/trade/quote/route.ts`, `app/api/trade/execute/route.ts`*, `app/api/creators/auth/dev/route.ts`, `app/page.tsx`, `components/packs/PacksTerminal.tsx`, `components/portfolio/PortfolioDashboard.tsx`, `components/referral/ReferralDashboard.tsx`, `components/tokens/PulseColumn.tsx`, `lib/db/creators.ts`, `lib/predictions/fetchMarkets.ts`, `lib/trade/ingestExecutedSwap.ts`, `lib/trading/deskWalletDisplayStats.ts`, `tests/deskWalletDisplayStats.test.ts`, `docs/QA_RUN_REPORT_2026-06-19.md`, `docs/DISPATCH_HANDOFF_2026-06-19.md` (this file) | QA session | **Commit + push** so dispatch can build on it. |
| **Login fixes (WIP)** | `app/auth/oauth/page.tsx`, `components/auth/LandingSignInModal.tsx`, `components/auth/PrivyOAuthReturnCleanup.tsx`, `lib/auth/oauthPopup.ts` | **The human (in Cursor)** | Do **not** fold into the QA commit. Human commits these separately. |
| **Pre-existing doc edits** | `AGENTS.md`, `HANDOFF.md`, `README.md`, `docs/POINTER-QA-HANDOFF.md` | Predates this session | Leave as-is unless asked. |

> *`app/api/trade/execute/route.ts` was read but **not modified** — the P0 fix lives entirely in `quote/route.ts`. It only appears above for context.

**Recommended:** commit the QA-fixes bucket on a branch (e.g. `qa/2026-06-19-fixes`) and push, keeping the login + doc buckets out. The human must approve the commit/push (outward-facing). If you're dispatch and the human asks you to do it, scope the `git add` to the QA-fix file list above only.

**`.env.local` is git-ignored** (secrets) and will NOT travel to a cloud worktree. See §4.

---

## 2. What you (dispatch) CAN and CANNOT do

Dispatch runs in the cloud from the GitHub repo. It has **no access to the human's local machine**.

**CAN do (code/CI):**
- Read/edit code, run `npm test`, `tsc --noEmit`, lint.
- Implement the remaining documented P1/P2 fixes (§3).
- API-only reasoning, schema/Zod work, unit tests.

**CANNOT do (needs the human at the local machine):**
- **Live browser QA** (Chrome extension is local) — Pulse/desk/portfolio visual checks.
- **Live trades** — the funded Privy wallet + click-to-buy is local; you cannot sign.
- **Hit the running dev server** at `127.0.0.1:3001` (that's on the human's PC).
- **See `.env.local` secrets** (Helius/Supabase/Privy keys) unless provided to the cloud env.

→ Route anything requiring a browser, wallet, or the local server **back to the human**. Do the code; ask them to verify live.

---

## 3. The work — done vs open (with file pointers)

Full detail + repro steps in `docs/QA_RUN_REPORT_2026-06-19.md` §5–§6. Summary:

### Fixed (in working tree, needs commit)
- **P0** USDC buys recorded `fee=0` + skipped referral/points → `app/api/trade/quote/route.ts` (SOL-equiv notional via `getSolUsdPrice`).
- **P1** referral "50%" vs 30% → `ReferralDashboard.tsx`, `app/page.tsx`.
- **P1** predictions demo shown as "LIVE · KALSHI" → `lib/predictions/fetchMarkets.ts` (+ fixed `evLooksCrypto` typo).
- **P1** desk PnL −100% on held position w/ no price → `lib/trading/deskWalletDisplayStats.ts` (+ test).
- **P1** post-trade ingest gated to QA mint → `lib/trade/ingestExecutedSwap.ts`.
- **P1** portfolio fake "Realized PNL" curve + fabricated "Return Distribution" → `components/portfolio/PortfolioDashboard.tsx`.
- **P1** packs no "simulated" label → `components/packs/PacksTerminal.tsx`.
- **P1** dev creator-auth raw DB write → `lib/db/creators.ts` + `app/api/creators/auth/dev/route.ts`.
- **P2** Pulse NEW "< 30m" label → `components/tokens/PulseColumn.tsx`.

### Open — good candidates for dispatch (pure code)
- **BUG-11 (P1):** repo not typecheck-clean. 12 `tsc` errors in `tests/protocolClassify.test.ts` (×7), `tests/pulseColumnGates.test.ts` (×4), `lib/market/dexscreenerTokenHydrate.ts` (×1, `'ton'` not in `ProtocolBrandId`). Also fix `package.json` `typecheck` so it doesn't pipe through `tail` (currently masks `tsc`'s non-zero exit → CI looks green when it isn't).
- **BUG-14 (P2):** `lib/indexer/kickoffMintIndex.ts:15-32` — debounce only covers `status==='indexing'`; broaden to terminal states + longer gap so perpetually-empty mints don't re-backfill every poll.
- **BUG-15 (P2):** raw SQL in routes → move to `lib/db/*`: `app/api/tokens/[mint]/top-traders/route.ts`, `…/trader-stats/route.ts`, `app/api/points/me/route.ts`.
- **BUG-16 (P2):** ad-hoc hex → theme tokens in `components/tokens/TokenChart.tsx`, `PortfolioDashboard.tsx` `TinyLineChart`, `components/wallet/DepositAssetIcon.tsx`.
- **BUG-13 (P2):** `lib/market/pulseMetricsEnrich.ts:430` — split cheap DB reads from expensive enrich so holder pills survive `QA_MINT_ONLY`.

### Open — needs human/local or infra (NOT dispatch-solvable alone)
- **BUG-10 (P1):** `/stock/[symbol]` hangs (HTTP 000/60s). Likely dev-compile starvation under Helius load; verify with a fresh server / prod build. Stock terminal also lacks a Preview banner (`app/(app)/stock/[symbol]/page.tsx`).
- **BUG-17 (P0-for-parity, infra):** Helius free/dev plan 429-storms the dev server. **Paid Helius + webhook on a deployed URL** is the top blocker vs Axiom.
- **Runtime-confirm BUG-03:** the predictions fix is on disk + tests pass, but the running dev server served a stale module (watcher missed the `lib/` change). Confirm `source:'demo', live:false` after a server restart.

---

## 4. How to run / verify

```bash
npm install
npm run dev            # → http://127.0.0.1:3001  (PORT 3001, not 3000)
npm test               # 238 tests, must stay green
npx tsc --noEmit       # NOTE: `npm run typecheck` masks failures via | tail — run tsc directly
```

- **Env:** copy `.env.example` → `.env.local`. A local backup of the human's env (pre-QA values) is at **`.env.local.qabak`**. QA set `NEXT_PUBLIC_FOUNDER_BETA=1` (0.001 SOL presets) and `POINTER_QA_MINT_ONLY=0` (recommended — ungates holder enrich for all indexed mints).
- **Dispatch has no `.env.local`** → DB/Helius/Privy-dependent runtime checks won't work in the cloud. Stick to `npm test` / `tsc` / static reasoning, and ask the human to run live checks.
- Test mints: ISLANDS `yoA2CoHk6HRNtFuTP1kVt5xkcvG7mr5raQ5zuNxpump` (indexed, Token-2022) · WIF `CExejcGZSEnk4FBsBQa3nMnU1jjCYsjw4x9d7cJ4pump` (the QA mint).

---

## 5. Gotchas (will bite you if unaware)

1. **`npm run typecheck` lies** — it's `tsc … | tee | tail`, so exit code is `tail`'s (0). Always run `npx tsc --noEmit` directly. There are 12 pre-existing errors; don't assume green.
2. **Helius free plan = 429 storms** locally → balance 500s, slow Pulse (10–14s), `pulse_sol_cold_poll_timeout_12000ms` spam, and the `/stock` route hanging. Not a code bug for most of it; it's the plan.
3. **Next dev watcher can miss `lib/` edits under load** — if a change to a `lib/` module doesn't seem to take effect, the running server is serving a stale compile. Restart to confirm.
4. **Don't touch the login files** (`auth/oauth/*`, `LandingSignInModal.tsx`, `oauthPopup.ts`, `PrivyOAuthReturnCleanup.tsx`) — that's the human's live WIP.
5. **AGENTS.md hard rules:** no raw SQL in routes (use `lib/db/*`), Zod at every boundary, theme tokens only, `getFeeBpsForUser` is the single fee seam, **no commit/push unless the human asks**.
6. **Trading safety:** max 0.001 SOL/test, one buy + one sell, never loop failed txs. Only the human can actually sign.

---

## 6. Suggested first moves for dispatch

1. `git log --oneline -3` → if fixes aren't committed, ask the human to let you commit the QA-fix bucket (§1) on a branch + push.
2. Read `docs/QA_RUN_REPORT_2026-06-19.md` for full context.
3. Pick up **BUG-11** (typecheck) — it's pure code, high value, unblocks CI, and is fully dispatch-solvable.
4. Then BUG-14 / BUG-15 / BUG-16 (pure code, low risk).
5. For anything needing a browser/wallet/live server (BUG-10, BUG-13 runtime, BUG-03 runtime confirm), **write the code and hand back to the human to verify locally.**

---

## 7. Handing back to the human / local Claude

- Live browser QA, real trades, and `127.0.0.1:3001` checks must happen on the **local** machine.
- The human is on their phone via dispatch; keep changes committed + pushed so they can review on GitHub mobile.
- When the human is back at the PC, the local session can re-run the live E2E (one 0.001 SOL buy + sell) to confirm any trade-path changes.
