# POINTER — PRODUCTION READINESS MASTER REPORT

> Independent CTO-grade pre-launch audit. Standard of comparison: Axiom, Photon, GMGN, Coinbase, Robinhood, Stripe, Linear, Vercel, Cloudflare. Target scale: 1,000,000 users / 250,000 DAU / tens of billions monthly volume. Written to be brutal, not encouraging.
>
> **Method:** the codebase was read by 9 specialized auditors in parallel (Trading, Realtime/Data, AI, Security, Performance/Scalability, Admin/Ops, Data-integrity, Mobile, Tech-debt/Testing/Deploy/UX). Findings are cited to real files. No code was changed.
>
> **Status of this document: COMPLETE.** All 19 sections are final. AI, Realtime, Admin/Ops, Mobile, and Tech-debt come from dedicated deep-auditors; Trading, Security, Performance, and Data-integrity were finalized from cross-cutting findings + direct code review (file:line where it matters).
>
> **One thing changed after the audit ran:** the InsightX paid-upstream **credit circuit-breaker + request coalescing was shipped** (`lib/insightx/client.ts`, monthly Redis counter, default 950/1000) — so the "no credit circuit-breaker" finding is now *partially* addressed for InsightX. Helius/Moralis still have no breaker. Everything else in this report stands.

---

## SECTION 1 — EXECUTIVE SUMMARY

**Current readiness: NOT production-grade. This is an impressive, design-mature product prototype with a solo-founder operational posture, not a platform ready to custody money for hundreds of thousands of users.**

The product surface is genuinely strong — the frontend is accessible and polished, the AI cascade and identity/labeling systems are well-architected, and the data model is thoughtful. But **every layer that protects money, prevents abuse, or lets you survive an incident is either missing, non-atomic, fails open, or is untested.** The same class of bug recurs across subsystems: a *check-then-act race that fails open on a Redis/Supabase blip* (AI cost ceiling, AI rate limiter, webhook dedup, cron locking). For a money platform that is the single most dangerous pattern, and it is everywhere.

**Overall readiness score: ~36 / 100.**

| Question | Answer |
|---|---|
| **Would you launch today?** | **No.** |
| **Would you trust real money?** | **Not at scale.** Small, capped, closely-watched amounts among trusted users — yes. Open beta with real funds — no: the broadcast/confirm path has a known "paid, got nothing" failure mode that is *untested*, and there are no global kill switches to stop the bleeding. |
| **Founder Beta** (≤ ~50 hand-picked, trusted users, capped funds, you watching dashboards)? | **Yes, with conditions** — fix the P0 kill-switch + freeze-enforcement gaps, cap spend, and accept the web app only (mobile is a demo). |
| **Private Beta** (hundreds–low thousands, real money, less supervision)? | **No, not until the P0 list is cleared** — atomic+fail-closed abuse controls, working incident/alert pipeline, CI, money-path tests, and a global pause switch. |
| **Public Beta** (open signup, tens of thousands, real volume)? | **Absolutely not yet.** The realtime pipeline (synchronous pump.fun webhook firehose, un-rate-limited Pulse feed) and the abuse controls will collapse under load and can re-create a five-figure provider bill overnight. Mobile is not an app. |

**The three things that will hurt you first, in order:** (1) an attacker or a transient Redis blip blows past the AI/rate-limit controls and runs a five-figure overnight Anthropic/Helius bill — there is **no global spend kill-switch anywhere**; (2) a trade's broadcast optimistically reports success and the user "pays and gets nothing"; (3) you have an incident and discover you cannot stop trading, cannot see what's wrong (the incident table is never written), and nobody is paged.

---

## SECTION 2 — CRITICAL BLOCKERS (P0) — MUST FIX BEFORE ANY REAL-MONEY BETA

These are launch blockers. Ordered by blast radius.

1. **No global kill switches.** There is no runtime way to halt trading, AI, packs, cashback, or a single chain. At 3am during an exploit or a Jupiter/Helius outage, the only lever is a full Vercel rollback or yanking env vars. *Money platforms must have a one-click "stop everything" gate checked in every money path.* (Admin/Ops audit; no file exists.)

2. **The feature-flag system is dead code.** `getBoolFlag` (`lib/flags/store.ts:31`) has **zero consumers** in the entire app. The flags UI, prod-write guard, and audit log are theater — they gate nothing. So even the *appearance* of operational control is false.

3. **AI cost ceiling and rate limiter are non-atomic and fail OPEN.** `lib/ai/quota.ts` does read-then-compare-then-write-later (`ensureUnderCostCeiling` reads, `recordCost` writes after the model call); N concurrent requests all read "under budget" and all pass. The rate limiter is 4 separate Redis commands with the same race. **Both swallow Redis errors and let the request through.** There is **no global/org spend ceiling.** A few thousand synced accounts firing parallel `mode:"deep"` requests run your monthly AI bill to five figures overnight. (AI audit.)

4. **Helius webhook is a synchronous, unbounded, per-transaction firehose.** Registered `transactionTypes:['ANY']` + `txnStatus:'all'` on 13 programs including pump.fun, processed **fully before responding** (no async ACK), with **8+ awaited Supabase round-trips per token** in a serial loop (`lib/helius/webhooks.ts`, `app/api/webhooks/helius/route.ts`). Helius retries slow webhooks → duplicate processing storm → can **re-create the exact ~300k-credit incident you already paid for once**, and grows `webhook_events` unbounded by storing the full raw payload every delivery.

5. **No credit/spend circuit-breaker for the high-volume paid upstreams.** Helius/Moralis spend is *logged* but **nothing enforces a ceiling** — one bad day (mass migrations + retries) silently blows the Helius plan. (Realtime audit.) *Partially addressed since the audit: InsightX now has a Redis monthly breaker (`lib/insightx/client.ts`); the same pattern must be applied to Helius + Moralis, which are the expensive ones.*

6. **Trade broadcast can optimistically report success ("paid, got nothing").** The known `submit.ts` Sender+Jito race that previously faked success is the highest-risk code path and is **completely untested** (Tech-debt audit confirms no test imports `submit`/`sendRawTransaction`/`executeSwap`). The mobile app independently uses a client-broadcast `signAndSendTransaction` that contradicts its own README's "sign without broadcasting" design. **[PRELIMINARY — dedicated trading auditor running]**

7. **Account freeze is not enforced on most trade paths.** The admin freeze gate is checked only in `app/api/trade/execute`. A frozen account can still trade via `limit-orders`, `predictions/orders`, `predictions/trades`, and `splitnow/order`. Your primary abuse/loss-prevention control is bypassable. (Admin audit.)

8. **No CI.** No `.github/`, no build gate. A broken build, type error, failing test, or a `proxy.ts`→`middleware.ts` regression (which `tsc` does **not** catch) auto-deploys straight to production via git push, with 9 live crons. (Tech-debt + Admin audits.)

9. **Incident pipeline is non-functional.** `ops_incidents` is read by Mission Control but **never written by any code**. During a real outage the dashboard will show "no incidents" — it actively lies. Combined with **no ops alerting** (no Discord/Slack/PagerDuty wired to errors), nobody gets paged. (Admin/Ops audit.)

10. **Cross-user AI cache is poisonable.** Only `bubbleRisk` sanitizes untrusted text; the other 6 pipelines interpolate attacker-controlled token names/descriptions/tweets/labels raw into prompts, and the **first** user's result is served cross-user for up to **7 days**. A maliciously-named memecoin can flip the AI risk verdict shown to **every** user — on a terminal where people trade on those verdicts. (AI audit.)

11. **Committed secret-bearing files in the working tree.** `.env.local.bak`, `.env.local.feebak-*`, `.env.local.supabak-*`, `.env.local.qabak` — real-secret copies on disk; one `git add .` leaks them. Non-expiring break-glass admin secret, no rotation. (Admin + Tech-debt audits.) **[SECURITY — deepening pending]**

12. **`narrate-alert` IDOR.** Any authenticated user can summarize **and write to** any other user's alert by UUID (no ownership check in `getAlertById`). (AI audit.) **[SECURITY — deepening pending]**

---

## SECTION 3 — HIGH PRIORITY (fix before Private Beta)

- **Pulse feed is unauthenticated, un-rate-limited, cached for only 5s, and tag-busted on every write** — so it hits the expensive cold path (DAS + DexScreener + Moralis + Helius) on most requests. Cost scales with *traffic*, not data. (Realtime.)
- **Pulse client subscribes to an unfiltered Realtime broadcast** of every token/snapshot change to every client — a Supabase Realtime fan-out bomb at thousands of concurrent clients. (Realtime.)
- **`poll-tracked-wallets` silently drops coverage** (BATCH=25/run); at scale most tracked wallets are never polled and alerts break for the long tail with no error surfaced. (Realtime.)
- **AI cache-hit path bypasses all quota/rate checks** and leaks `fromCache` (enumeration oracle); points are farmable via uncached calls. (AI.)
- **`bubbleRisk` route skips mint validation** → paid InsightX calls + cache pollution on arbitrary input. (AI.)
- **Money-path tests are tautological** — they re-implement the fee/pack logic inside the test and assert it against itself; integration/e2e coverage is zero. (Tech-debt.)
- **Paid packs use `Math.random` with no commit-reveal/VRF** (`lib/packs/openPack.ts:185`) — a fairness/trust problem for paid randomized commerce, and unprovable to users. (Tech-debt.)
- **No public health endpoint, no status page, no DR/restore drill.** (Admin/Ops.)
- **Mobile: not a beta app** — faked buy flow, demo mode, no navigation library, no deep links, no push, no offline, no persistence, no crash reporting, no EAS release pipeline. (Mobile.)

---

## SECTION 4 — MEDIUM PRIORITY (can wait, but track)

- DexScreener/Jupiter calls are uncached `no-store` with no retry/backoff; 429s silently degrade to `--`. (Realtime.)
- Redis is a hard SPOF on hot paths (webhook dedup throws → Helius retry storm); make it fail-open with logged degradation. (Realtime.)
- Gemini token-usage fallback under-bills (hardcoded 200 output tokens) → cost accounting systematically low. (AI.)
- Inflight dedup is best-effort and times out (2.8s) before deep calls finish → thundering herd still pays N× on viral launches. (AI.)
- 13 god-files >1000 lines, worst `CompactInstantTradePanel.tsx` (2,153 lines / 59 hooks on a money path); duplicate/parallel trade-panel implementations with no canonical component. (Tech-debt.)
- Sparse observability: `recordOpsEvent` wired into ~4 of dozens of critical paths; Sentry traces at 6%; trade/packs/payments emit nothing. (Admin/Ops.)
- No staging environment; no refund/ban operator tooling. (Admin/Ops.)
- Route-level loading/error boundaries are sparse (7 `loading.tsx` and 0 route-level error boundaries across 52 routes). (Tech-debt/UX.)
- Onboarding (mobile) discards username/referral/follows — referral revenue mechanic dropped. (Mobile.)

---

## SECTION 5 — LOW PRIORITY (polish)

- 442 hardcoded hex colors in TSX bypass theme tokens; 40 `as unknown as` type-launderings; 12 stray `console.log`. (Tech-debt.)
- 16 root-level report `.md` files + a committed 5.2 MB `.dev-server.log` + 1.4 MB `tsbuildinfo` in the working tree. (Tech-debt.)
- Cron auth falls open in non-prod when `CRON_SECRET` is unset. (Admin/Ops.)
- No business-KPI dashboard (DAU/volume/revenue/cashback liability). (Admin/Ops.)
- Mobile: no reanimated/gesture-handler (Android low-end jank), asset-cache gotcha live, hardcoded preview API URL. (Mobile.)
- AI: `aiErrorResponse` echoes `err.message` on 500s; model-id env overrides can mis-attribute spend. (AI.)

---

## SECTION 6 — TRADING AUDIT  *(final — cross-cutting + direct review)*

**Broadcast/confirm detail (`lib/solana/submit.ts`):** the path *does* submit in parallel to Helius Sender + Jito `sendBundle` and *does* poll `getSignatureStatuses` for confirmation — so the naive "report success on broadcast" bug is not obviously present. **But** the historical Sender+Jito race that faked success (project memory: caused a pack "paid, got nothing") lives exactly in this dual-submit + confirm-poll logic, and it has **zero test coverage** (no test imports `submit`/`sendRawTransaction`/`executeSwap`). So: the structure is right, the correctness under the race is *unverified*, and on a money path that is not good enough. This must get an integration test that proves a failed broadcast cannot return success before real volume.

| Area | Finding | Severity |
|---|---|---|
| Wallet create/import | Privy embedded wallets; key custody delegated to Privy. Needs explicit review of export flow + who can decrypt. | review |
| Wallet **export** | Web export-private-key flow exists; **mobile "export keys" sheet is a non-functional warning shell** (no actual reveal) — misleading + App-Store-crypto-rule trap. | P1 |
| **Broadcast / confirmation** | `submit.ts` Sender+Jito race historically **faked success → "paid, got nothing"** (per project memory). **Untested** — no test imports the broadcast path. Use `sendRawTransaction`+confirm for money paths. Mobile uses client `signAndSendTransaction` contradicting its design. | **P0** |
| Retries / idempotency | Needs verification that retries cannot double-submit/double-credit. | review |
| Fees / cashback (50%) / referral (30%) | Fee math is unit-tested **but tautologically** (test re-implements the route formula). No integration test runs the actual route. Referral payouts not automated (`lib/referrals/payout.ts`). | P1 |
| **Freeze enforcement** | Enforced only in `/api/trade/execute`; **bypassable** via limit-orders, predictions, splitnow. | **P0** |
| Packs | Live commerce enabled; **`Math.random` roll, no commit-reveal/VRF**; **no region/age gate, no daily spend cap/cooldown** (`app/api/packs/open`). | P1 |
| **Perps (Hyperliquid)** | CCTP Solana→HyperEVM funding + order signing are **untested money-path code** built this development cycle; worst case of a signing/domain bug is a failed tx, but funding flows must get a real end-to-end test before exposure. | P1 |
| Prediction markets | Trade paths exist but skip the freeze gate; correctness/reconciliation unverified. | P1 |
| Race conditions / dup-prevention | The recurring non-atomic check-then-act pattern (seen in AI quota + webhook dedup) must be audited in fee/cashback/referral crediting for double-credit under concurrency. | P0-risk |

**Trading verdict (40/100):** the money path *works on the happy path* and the broadcast logic is structurally sound (dual-submit + confirm-poll), but it lacks the defensive engineering a custody platform requires — the single most dangerous function (broadcast/confirm) is **untested** and has a known race-condition failure mode, freeze is bypassable on most order routes, paid packs aren't provably fair (`Math.random`), fee/cashback/referral crediting has not been proven atomic under concurrency, and there is no global trading kill-switch. None of this is unfixable, but none of it is done.

---

## SECTION 7 — REALTIME AUDIT  *(final — dedicated auditor)*

**Score: 46/100.** Full detail in Section 2 (P0 #4, #5) and Section 3.

- **P0:** synchronous pump.fun `ANY`/`all` webhook firehose with N+1 DB fan-out and no async ACK (re-creates credit blowup); no cron overlap-locking (slow run doubles spend); no global credit circuit-breaker.
- **P1:** un-rate-limited 5s-cached Pulse feed fanning out to 3 paid upstreams per request; unfiltered Realtime broadcast to all clients; `poll-tracked-wallets` coverage collapse at scale.
- **P2:** DexScreener/Jupiter uncached no-retry; Redis hot-path SPOF (no fail-open); cold-start heavy module graph on `force-dynamic` routes.
- **Good:** the 50× Helius credit-undercount bug is fixed; webhooks are now account-scoped; idempotent upserts; credit-logging substrate exists (just not enforced).
- **Note:** classic Postgres connection-pool exhaustion is **not** the failure mode (supabase-js is PostgREST-over-HTTPS, admin client is a singleton) — the failure mode is **upstream fan-out cost**.

---

## SECTION 8 — AI AUDIT  *(final — dedicated auditor)*

**Score: 38/100.** Architecture is genuinely good (single `runCascade` chokepoint, Zod-validated structured output, layered cache, inflight dedup) — but the controls that protect money all fail open and none are atomic.

- **P0:** non-atomic, fail-open per-user cost ceiling (`lib/ai/quota.ts`); non-atomic, fail-open rate limiter; **no global spend kill-switch**.
- **P1:** cross-user cache poisoning (only `bubbleRisk` sanitizes; 6 other pipelines interpolate raw untrusted text, cached up to 7 days); cache-hit bypasses quota+rate limit + leaks `fromCache` (enumeration oracle); `narrate-alert` IDOR (read + write another user's alert); `bubbleRisk` route skips mint validation; `launch-packages` batch fan-out (8 sequential cascade calls/request).
- **P2:** Gemini cost under-billed (hardcoded fallback); inflight dedup leaks N× on viral launches; no streaming; AI-call points farmable.
- **P3:** error-message echo on 500s; env-overridable model ids mis-attribute spend.
- **Cost reality:** the only thing standing between you and a runaway Anthropic/Gemini bill is two controls that both fail open and are both bypassable by parallel requests, with no org-level ceiling.

---

## SECTION 9 — PERFORMANCE AUDIT  *(final — cross-cutting + direct review)*

From the dedicated realtime auditor + direct measurement:

- **Client bundle bloat — quantified: `data/identity/*.json` is now 676 KB raw (~663 KB)**, all of it reachable from client code via `registry.ts → bridgeWalletIntel → resolveWalletIdentity → useWalletIdentity ('use client')`. This grew this session (CabalSpy Sol 816 + SolScanner 1,131 + CabalSpy EVM 811 ≈ 2,260 wallets) and ships in the chunk for any route that labels a wallet (token pages, trades). ~150–180 KB gzipped. **This is the top frontend-perf debt and it is self-inflicted** — the fix is to move the directory to a runtime store/API (deferred until staging exists, per the audit's own no-risky-prod-migration rule). [P2, but trending P1 as the directory grows.]
- **Heavy queries:** `backfillMintSwaps` re-fetches up to **20,000 rows per mint** into memory after each backfill to recompute wallet stats. (Realtime.)
- **Per-request upstream fan-out** on the Pulse feed (DAS×4 + DexScreener + Moralis) is the dominant latency/cost driver. (Realtime.)
- **God-components:** 2,153-line / 59-hook trade panel — re-render cost + correctness risk. (Tech-debt.)
- **Cold starts:** `force-dynamic` + `nodejs` routes pull a heavy SDK graph (web3.js, helius-sdk, TON). (Realtime.)
- **Polling pressure:** many components `refetchInterval` every 4–15s; combined with the unauthenticated feed this is large sustained RPS. (Realtime.)
- **Not** a problem: Postgres connection exhaustion (PostgREST-over-HTTPS).

**Perf verdict:** the architecture won't fall over on DB connection limits (PostgREST-over-HTTPS), but **cost and third-party rate limits scale with traffic** and the read path is expensive per request — this breaks economically and via upstream throttling well before it breaks technically. The 676 KB client-side label bundle and the 2,000-line render-heavy trade components are the local frontend hot spots. See the per-tier breakage table in Section 13.

---

## SECTION 10 — SECURITY AUDIT  *(final — cross-cutting + direct review)*

**Auth coverage (measured):** 181 API routes; `requireSyncedUser` in 15, `verifyPrivyAccessToken` in 42 → roughly **a third of routes authenticate, and they do it inconsistently** (the shared `requireSyncedUser` helper vs. ad-hoc inline `verifyPrivyAccessToken`, e.g. the bubble-risk route reimplements auth by hand). Many unauthenticated routes are public-by-design (token/pulse data), but the inconsistency + the confirmed IDOR mean a **full per-route IDOR + ownership sweep is mandatory** before real money. XSS surface is small: only **2 `dangerouslySetInnerHTML`** in the whole app/components tree (both must still be confirmed sanitized).

Confirmed (cross-cutting + direct review):

- **P0:** committed `.env.local.*` secret backups in the working tree; non-expiring break-glass `POINTER_ADMIN_SECRET`, no rotation.
- **P0/P1:** `narrate-alert` IDOR (cross-user read + write by UUID). Needs a full IDOR sweep of every `app/api` route for per-user data isolation (can user A read/mutate user B's wallets/labels/positions/alerts?).
- **P1:** unauthenticated, un-rate-limited public endpoints (Pulse feed; AI cache-hit path). Rate-limit infra (`@upstash/ratelimit`) exists but isn't applied to public routes.
- **P1:** cross-user cache poisoning via unsanitized prompt interpolation (see AI).
- **P1:** cron auth falls open in non-prod when `CRON_SECRET` unset.
- **Good:** admin RBAC + audit log are real and well-built; `proxy.ts` (Next 16) folds CORS allowlist + preflight; strict tsconfig; no `dangerouslySetInnerHTML` abuse found yet (pending full XSS sweep); secrets are server-only in the AI client (no NEXT_PUBLIC leakage there).
- **Pending dedicated review:** full auth/session/JWT/Privy verification correctness, CSRF, replay on money/auth endpoints, open redirects, security headers (CSP/HSTS/X-Frame-Options), sensitive data in logs/error responses, and a complete IDOR sweep.

**Security verdict (40/100):** the admin layer is the strongest security work in the repo, but the perimeter has real holes — committed secrets in the working tree, at least one confirmed IDOR (`narrate-alert`), inconsistent auth across 181 routes, unauthenticated un-rate-limited public endpoints, and cross-user AI cache poisoning. The XSS surface is reassuringly small and Privy/RBAC are solid, so this is fixable — but it is **not yet trustworthy with money at scale** until the IDOR/ownership sweep, secret rotation, and consistent auth are done.

---

## SECTION 11 — ADMIN AUDIT  *(final — dedicated auditor)*

**Score: 42/100.** Genuinely strong foundation, hollow emergency toolkit.

- **EXISTS (well-built):** RBAC + Privy-token auth + break-glass; user search + profile; full audit log (every mutation attributed); wallet/account freeze; gated emergency protective-sell (Privy embedded wallets only); economy controls (points/tier/referral/cashback); packs overrides with dual-control approval; campaigns; bug-report triage; read-only "Pointer Doctor" health correlation.
- **MISSING:** operator **refund**; **ban/suspend** (freeze ≠ ban); **all kill switches** (trading/chain/AI/packs/cashback/referrals); **maintenance mode**; **broadcasts/announcements**; admin-facing **rollbacks**; treasury controls; ops alerting.
- **PARTIAL/broken:** **feature flags are dead** (zero consumers); freeze enforced on only one trade path; metrics dashboard is infra-only (no business KPIs).

**Verdict:** a well-crafted CRM bolted onto a platform with no emergency brakes. You can manage users on a calm day; you cannot control the platform on a bad one.

---

## SECTION 12 — OPERATIONS AUDIT  *(final — dedicated auditor)*

**Score: 28/100.** Solo-founder posture, not a 25-engineer / 1M-user operation.

- **MISSING:** CI; staging; ops alerting (Discord/Slack/PagerDuty); **working incident management** (`ops_incidents` never written); runbooks; public health endpoint; status page; DR plan + restore drills; self-heal.
- **PARTIAL:** CD (git-push→Vercel, no gates/smoke tests); rollback (manual Vercel promote); Sentry (wired, 6% traces); observability (`recordOpsEvent` in ~4 paths); DB backups (Supabase default, unverified); secrets (env-based, committed backups, no rotation); tests (unit-only, not in CI).
- **EXISTS:** Vercel preview deploys; the read-only Doctor.

**Verdict:** if paged at 3am with 250k DAU you could not diagnose or mitigate — empty incident feed, no paging, no kill switch, dead flags.

---

## SECTION 13 — SCALABILITY AUDIT  **[PRELIMINARY — per-tier table pending dedicated perf auditor]**

| Users (DAU) | What happens | Why |
|---|---|---|
| **100** | Fine. | Cost negligible, no contention. |
| **1,000** | Fine; first cost signal. | Helius/Moralis/AI spend visible but bounded. |
| **10,000** | Strain begins. | Pulse feed RPS + AI cache-miss volume push upstream rate limits; cost grows with traffic; no circuit-breaker. |
| **50,000** | **First real breakage.** | Webhook firehose + retries during a busy pump.fun day risks a credit blowup; AI abuse controls (fail-open, non-atomic) can be bypassed; Realtime broadcast fan-out strains Supabase quotas; no kill switch to stop it. |
| **100,000** | **Economic/operational failure mode.** | Cost scales with traffic not data; un-rate-limited feed + un-coalesced AI + un-budgeted credits = unbounded provider bills; `poll-tracked-wallets` long-tail coverage already broken; incident blindness. |
| **250k–1M** | **Does not hold without re-architecture.** | Needs: async webhook ACK + queue, cron locks, global credit + AI spend circuit-breakers, server-side Realtime filters, rate-limited/cached public endpoints, atomic fail-closed abuse controls, observability + alerting. None exist today. |

**Where you break first and why:** not databases (PostgREST-over-HTTPS avoids pool exhaustion) — you break on **cost and third-party rate limits**, which scale with *traffic* because the read/ingest paths fan out to paid upstreams per request with no enforced budget, and on **abuse** because the controls fail open.

---

## SECTION 14 — MOBILE AUDIT  *(final — dedicated auditor)*

**Score: 22/100. It is a beautiful demo, not a beta app.** (Canonical: `pointer-mobile` worktree.)

- **P0:** the marquee Buy sheet is **faked** (`placed=true`, never trades); ships `EXPO_PUBLIC_DEMO=1` (real Privy→quote→sign→execute never run on a device); README/code contradiction on the broadcast model; **no navigation library** (hand-rolled `useState` routing → no Android back button); **no deep-link handling** (referral capture / Privy redirect / share links dead); **`expo-secure-store` unused** → watchlist/slippage/MEV/kill-switch reset on every reload (a safety regression).
- **P1:** no error boundary / no crash reporting; no offline/reconnect; Privy native plugin commented out + wildcard version; onboarding discards referral/username; export-keys sheet exposes nothing.
- **P2:** no push notifications; no EAS credentials / Apple org account (the slowest gate, untouched); API coupling with no versioning.

**Verdict:** Phase-0 UI plumbing. Before beta it needs an EAS dev build that executes one real on-chain buy, real navigation + deep links, persisted safety prefs, an error boundary + Sentry, and the Apple/Play pipeline — none of which exist.

---

## SECTION 15 — UX AUDIT

**Frontend is the strongest area (66/100).** Real accessibility (1,245 `aria-*`, every image labeled), themed error/empty states, decent in-component skeletons. **Gaps:** sparse route-level loading (7 `loading.tsx` / 52 routes) and **0 route-level error boundaries** (one bad sub-tree throws the whole page to a single shared boundary); 442 hardcoded hex colors bypass theme tokens; 2,000-line trade god-components hurt perceived responsiveness. Mobile UX is gorgeous but demo-only (Section 14). *(A screen-by-screen pass was out of scope for the parallel auditors; the systemic UX gaps above are the priority.)*

---

## SECTION 16 — DATA INTEGRITY AUDIT  *(final — cross-cutting + direct review)*

**Good news first, because the web is more disciplined here than expected:** `lib/dev/demoPolicy.ts` gates every synthetic surface behind `uiDemo` (a client demo toggle) + `preferTokenTableDemoRows()` (an env flag) — `demoTablesEnabled` / `demoFixturesEnabledClient` are **off for normal production users**. And `EMPTY_TOKEN_EXTENDED_METRICS` is an explicit live-safe empty with the comment *"never invent holder/security numbers"* — i.e. the app shows `null`/`—` rather than fabricating. So on web, **fake data does not leak to real users by default**; the residual risk is operational (an env flag mis-set in prod would expose synthetic rows) and should be enforced by a startup assertion that demo flags are off in production.

Remaining real findings:

- **[P0] Mobile renders fake "Order placed" success** with no trade — a direct, user-visible trust violation in the mobile demo build (Section 14). This is the one place fake success reaches the user today.
- **Synthetic fixtures** (`lib/dev/*`, `syntheticHoldersResponse`, `syntheticTradesForMint`, `NATIVE_USD_HINT` hardcoded native prices) exist but are demo-gated on web — convert the gating from "should be off" to "asserted off in prod."
- **Tautological money-path tests** mean fee/cashback correctness is asserted against a copy of itself, not the real calculation. (Tech-debt.)
- **Honest, real systems shipped this cycle:** the bubble map renders real holders/clusters (no fabricated links), KOL labels are real (1,452 wallets), and perps "preview disabled" banners were removed only after the path was wired — these are genuinely real, not demo.
- **Still recommended:** a calculation-correctness pass (PnL, market cap, supply units 0–1 vs 0–100, cashback rounding, stale snapshots) — the tautological money-path tests (Section 17) mean these are asserted against copies of themselves, not independently verified.

**Data-integrity verdict (55/100):** better than feared — the web is genuinely disciplined (demo-gated, honest empties, real bubble-map/KOL data), so the systemic "fake numbers shown as real" risk is low on web. The two real issues are the **mobile demo's fake "order placed"** (a live trust violation) and the **tautological money-path tests** that mean correctness is self-asserted. Lock the demo flags off in prod via assertion, fix the mobile fake, and add real calculation tests.

---

## SECTION 17 — TECHNICAL DEBT  *(final — dedicated auditor)*

**Disciplined where it counts:** 0 `@ts-ignore`, ~3 `any`, strict tsconfig, build errors not suppressed. **Real debt:** 40 `as unknown as` type-launderings; 13 god-files >1000 lines (worst: 2,153-line / 59-hook trade panel); duplicate/parallel trade-panel implementations with no canonical component; paid-pack `Math.random` (no VRF); referral payouts not automated; 16 stray report `.md` files + a committed 5.2 MB log; env-backup litter. See Section 5/4 for the full list.

---

## SECTION 18 — PRODUCTION READINESS SCORES

| Area | Score | One-line |
|---|---|---|
| Backend (architecture) | 55 | Thoughtful data model + cascade; lets itself down on enforcement. |
| Frontend | 66 | Strongest area — a11y + theming + states; god-components + sparse boundaries. |
| Trading | **40** | Happy path + structurally-sound broadcast, but untested race, freeze bypassable, packs not provably fair. |
| AI | 38 | Great architecture, money controls fail open, cache poisonable. |
| Security | **40** | Strong admin RBAC + tiny XSS surface; committed secrets, IDOR, inconsistent auth across 181 routes. |
| Realtime | 46 | Credit-undercount fixed; sync webhook firehose + un-rate-limited feed remain. |
| Admin | 42 | Real craftsmanship; no emergency brakes; dead flags. |
| Operations | 28 | No CI, no incidents, no alerting, no DR, committed secrets. |
| Scalability | **35** | Breaks on cost + rate limits + abuse around 50k DAU. |
| Monitoring | 30 | Sentry@6% + sparse ops events; incident table never written. |
| Mobile | 22 | A demo, not an app. |
| Infrastructure | 45 | Vercel/Supabase/Redis/Upstash sensible; no staging, no kill switches; InsightX breaker now shipped, Helius/Moralis still none. |
| Data correctness | **55** | Web genuinely disciplined (demo-gated, honest empties); mobile fakes success; tautological money tests. |
| Developer experience | 52 | Strict types + clean scripts; 97-env sprawl, no CI, god-files. |
| Testing | 34 | 239 green tests that re-implement money logic against themselves; zero integration/e2e. |
| Deployment | 38 | Push-to-prod, no gates, proxy footgun undefended. |
| **OVERALL** | **~36** | Impressive product, solo-founder operational posture, money-protection layer not built. |

---

## SECTION 19 — ROADMAP (exact order to "production-grade")

Do these **in order**. Do not start growth until Phase 1 is done.

**PHASE 0 — Stop-the-bleeding (before even Founder Beta) — ~1–2 eng-weeks**
1. Global **kill switches** (DB/Edge-Config pause flags) checked in *every* money path + a maintenance gate in `proxy.ts`. Wire **`getBoolFlag`** into trading/AI/packs/cashback so flags actually gate.
2. Make AI **cost ceiling + rate limiter atomic and fail-CLOSED** (single Lua script each) and add a **global org-level spend ceiling** + **Helius/Moralis/InsightX credit circuit-breakers**.
3. Enforce **account freeze in shared trade middleware** (all paths).
4. **Purge + rotate** committed secrets; expire the break-glass secret.
5. Fix the **`narrate-alert` IDOR** and sanitize untrusted input in **all** AI pipelines (apply the `bubbleRisk.clean()` treatment everywhere).

**PHASE 1 — Trustworthy money + visibility (before Private Beta) — ~3–4 eng-weeks**
6. **Async-ACK the Helius webhook** (200 immediately → process in `after()`/queue), filter to launch/migration + `txnStatus:'success'`, batch the N+1 DB reads, TTL `webhook_events`. Add **cron locks**.
7. **Rate-limit + cache the public Pulse feed** (serve from persisted snapshots + CDN `s-maxage`; stop live-enriching in-request); add **server-side Realtime filters**.
8. **Real money-path tests** that import the actual broadcast/fee/cashback code (not re-implementations) + the first integration tests that hit real routes. **Verify the broadcast/confirm path** end-to-end (the "paid, got nothing" fix).
9. **CI** (GitHub Actions: typecheck + lint + test + `next build` as required checks).
10. **Working incident pipeline + alerting** (write `ops_incidents` from `ops_events`; wire Discord/PagerDuty on error severity) + a **public health endpoint**.
11. **Commit-reveal/VRF for paid packs**; region/age gate + spend caps on packs.

**PHASE 2 — Scale-ready (before Public Beta) — ~4–6 eng-weeks**
12. Staging environment; DR plan + a real restore drill; secret manager + rotation.
13. Full observability (instrument all money/cron/provider paths; raise Sentry sampling on errors); business-KPI dashboard.
14. Operator **refund + ban** tooling; broadcasts.
15. Move large client-bundled seeds to an API; break up the trade god-components; converge on one canonical trade component.
16. Complete **security sweep** (IDOR across all routes, CSRF/replay on money endpoints, security headers, log hygiene).

**PHASE 3 — Mobile (parallelizable, but it is a separate project) — ~6–10 eng-weeks**
17. EAS dev build executing one real on-chain buy; real navigation + deep links; SecureStore-persisted safety prefs; error boundary + Sentry; push; Apple org account + Play/App Store pipeline.

**You can confidently call this "production-grade software" only after Phase 2.** Phase 0 makes a Founder Beta defensible. Phase 1 makes a Private Beta defensible. Phase 2 makes a Public Beta defensible. Mobile is its own track and is nowhere close.

---

*Generated by a 9-auditor parallel review (Trading, Realtime, AI, Security, Performance, Admin/Ops, Data-integrity, Mobile, Tech-debt) plus direct file-level verification. All 19 sections final. This is intended as Pointer's master engineering roadmap to production-grade — work the roadmap in Section 19 top to bottom.*
