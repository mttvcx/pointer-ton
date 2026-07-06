# Pointer Mobile — Launch Action List

Everything that is **built in code** vs **gated on a human action** (config, a
business deal, or a deploy). Code = done on branch `claude/reverent-mayer-2b1a14`.
Mobile stays on the branch; backend routes are cherry-picked to `main` → prod.

Legend: 🟢 done in code · 🔑 needs a key/config (you) · 🤝 needs a partner/approval
· 🚀 needs a prod deploy · 🧑‍💻 needs web-Claude to build

---

## 1. Apple Pay buy (Crossmint)
- 🟢 Server-order flow, Apple-Pay-only, graceful fallback — built + on prod (`07d3b13`).
- 🔑 `CROSSMINT_SERVER_KEY` + `CROSSMINT_ENV` + mobile `ck_` — **set (staging/prod)**.
- 🤝 **Crossmint must enable production Onramp for the project** (`c6855dd5-af36-…`).
  You emailed sales — this is the only thing between you and a real charge.
  → When they reply "enabled", retry **USDC $5**. No code change.

## 2. Credit mode — "spend without selling" (Kamino)
- 🟢 Cash/Credit toggle, 4 tiers w/ real economics, collateral allowlist (blue-chips
  only), borrow math, health factor — built. Borrow flow signs non-custodially via Privy.
- 🚀 **Deploy the new backend routes to prod** (cherry-pick to `main`):
  `app/api/financial/credit/route.ts`, `app/api/financial/credit/borrow/route.ts`,
  `lib/financial/kaminoClient.ts` (+ the `KAMINO_*` lines in `.env.example`).
- 🔑 To flip borrows to REAL on-chain (until then it runs in simulation):
  1. `npm i @kamino-finance/klend-sdk` on the backend
  2. Vercel: `KAMINO_ENABLED=1` (the market defaults to the mainnet main market —
     `KAMINO_MARKET` only needed to override). Verified constants baked in:
     - Main market: `7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF`
     - Klend program: `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD`
     - Call: `KaminoAction.buildBorrowTxns(market, amountBase, USDC_mint, owner, new VanillaObligation(PROGRAM_ID))`
  3. **Verify ONE small borrow on a funded wallet.** Two things to confirm live:
     (a) the collateral is deposited into the obligation first (a `buildDepositTxns`
     step — the borrow assumes collateral is already posted), and (b) the exact
     instruction fields on the returned action (`setupIxs`/`lendingIxs`/`cleanupIxs`).
- 🤝 **Card issuer for the card you spend on:**
  - v1 (borrow-then-spend): **Bridge** — already integrated. Turn on with
    `BRIDGE_API_KEY` (KYB with Bridge). No new partner for the borrow.
  - v2 (auto-borrow at the exact swipe): **Rain (rain.xyz)** — DM their BD for the
    JIT card auth API. Optional polish; not needed to launch.

## 3. Smart Yield (Lulo)
- 🟢 Live-APY read + deposit facade — built, key-gated.
- 🔑 `LULO_API_KEY` (dev.lulo.fi) in Vercel → real APY + deposits. Blank = demo APY.

## 4. Automations (auto-buy + auto-sell)
- 🟢 Mobile bound to `/api/alert-rules` + `/api/auto-sell` (persist + sync). Layer A/B
  live on prod; Layer C (delegated auto-exec) substrate built + **gated OFF**.
- 🧑‍💻 web-Claude: confirm the `chain` field home in `actionConfig`; build mobile
  `GET/PATCH /api/account-controls` (kill switch) + a push-prefs endpoint; finish
  Layer C `signDelegatedSwap` + security review.
- 🔑 `TWITTER_BEARER_TOKEN` (X $200/mo plan) → X-trigger rules fire. `HELIUS_API_KEY`
  ✅ done → wallet/price rules fire after a redeploy.
- 🔑 `NEXT_PUBLIC_HELIUS_API_KEY` — swap the old public key for a **domain-locked**
  one (it's browser-exposed and likely maxed your quota).

## 5. Send money (P2P USDC)
- 🟢 Mobile UI built; transfer honest-stubbed.
- 🧑‍💻 web-Claude: resolve a user's wallet by handle + a USDC transfer-tx builder the
  mobile signs via Privy (or confirm an existing transfer path).

## 6. Account unification
- 🟢 Same Privy App ID → same login = same wallets on web + mobile (automatic).
- ⚠️ Apple "Hide My Email" is the one edge to handle (link-by-email) later.

---

## TL;DR — what's ONLY on you (owner)
1. **Crossmint**: wait for sales to enable prod Onramp → then buys are real.
2. **Kamino go-live**: install the SDK + set `KAMINO_ENABLED`/`KAMINO_MARKET` + verify one borrow.
3. **Card**: `BRIDGE_API_KEY` (KYB) for v1; DM **Rain** only for the fancy JIT v2.
4. **Keys**: `TWITTER_BEARER_TOKEN`, domain-locked `NEXT_PUBLIC_HELIUS_API_KEY`, `LULO_API_KEY`.
5. **Deploys**: cherry-pick the financial/credit + auto-sell routes to `main`; redeploy after env changes.
6. **Rotate** the Crossmint prod keys pasted in chat before wider release.
