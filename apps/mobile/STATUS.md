# Pointer Mobile — status & context

Living status doc for the mobile app on branch **`claude/reverent-mayer-2b1a14`**
(worktree). If a chat is lost, start here + `git log --oneline` to resume.

_Last updated: 2026-07-03 (Pointer Financial — Capital Dashboard page shipped; see "Pointer Financial" below)._

## ▶ Resume when the DB is back (do this first)
Mobile is **feature-complete for everything that doesn't touch the pending backend.**
Everything left needs the Supabase restore + social schema applied. In order:
1. **Apply the social DB schema** (web Claude already wired follow/friend/Expo-push
   routes on main — inert until the tables exist). Provision `squads`/`squad_members` too.
2. **Build `POST /api/crossmint/webhook`** (Svix verify → mirror `/api/trade/execute`;
   Solana-only v1) so Apple Pay buys record cost-basis/points/cashback.
3. Add `users.twitter_handle` in `/api/wallets/sync-privy`; expose in `/api/me`.
4. Add `POST /api/push/register` for Expo push tokens.
5. **Then, on mobile (same-day):** wire follow/unfollow + friends UI to `/api/social/*`,
   real squad membership to `/api/squads/*`, show the connected X handle, register the
   Expo push token (needs `expo-notifications` → a rebuild), and swap the
   leaderboard / "Traders here" demos to real named-trader data.
6. **Rebuild** (`eas build`) picks up: new icon/splash + push module.
7. **Pointer Financial (real):** run `scripts/financial-accounts.sql`, set
   `BRIDGE_API_KEY` (+ `BRIDGE_API_BASE`), verify the Bridge REST paths in
   `lib/financial/bridgeClient.ts` against their live API. Then request the Apple
   Pay `payment-pass-provisioning` entitlement + wire the PassKit native module in
   `src/financial/wallet.ts`. Until keys are set the whole layer stays in local
   simulation (safe — no real accounts).

---

## What this is
Native Pointer app (`apps/mobile/`, Expo SDK 54 / RN 0.81 / React 19, Hermes).
It's a **thin client to the existing web backend** (repo root Next.js app),
**shares the same Privy app** as web, and reuses `/api/*`. Goal: FOMO-parity +
its own liquid-glass identity.

## How to run — TWO targets
- **Expo Go (demo)** — fast UI loop. `.env` has `EXPO_PUBLIC_DEMO=1` → Privy +
  Crossmint are **metro-stubbed**, wallet/trade/sign-in are stubbed, public data
  (Pulse/tokens/prices) is real. Run: `npx expo start`.
- **EAS dev build (real)** — real Privy sign-in + Crossmint Apple Pay. `.env` is
  currently `EXPO_PUBLIC_DEMO=0` (real mode). Native modules only run here, NOT
  Expo Go. Build: `eas build --profile development --platform ios`; then
  `npx expo start --dev-client`. **Flip `EXPO_PUBLIC_DEMO` in `.env`: `1`=Expo Go,
  `0`=dev build.**
  - Metro tip: after changing `.env` or `metro.config.js`, restart with `-c`.
  - iPhone can't auto-discover the dev server on Windows Wi-Fi → in the Pointer
    dev app use **"Enter URL manually"** = `http://<PC-LAN-IP>:8082`, or start
    with `--tunnel`.

## Credentials / setup (all wired)
- **Privy App ID** `cmoot23of00cf0cjx8h7wpppu` (same as web) + mobile **Client ID**
  `client-WY6Ygjk…`. Google + Apple login enabled (Apple: Services-less native,
  Client ID = bundle id `com.pointer.app`, key `UQ289LNQUR`, team `DR667WLXTL`).
  Mobile Privy client has app id `com.pointer.app` + URL scheme `pointer` set.
- **Crossmint** staging: client key `ck_staging_…` in `.env` (mobile);
  **server key `sk_staging_…` in Vercel** as `CROSSMINT_SERVER_API_KEY` (for the
  future webhook). Keys live in `.env` (gitignored) + `eas.json` `development.env`.
- **EAS**: project `@mttvcx/pointer-mobile` (`782edf66-…`), bundle `com.pointer.app`,
  scheme `pointer`. First iOS dev build succeeded on Moustapha's Apple account
  (personal — will move to a "Pointer Inc" org later; dev builds are private/
  reversible).
- New **app icon** (`assets/icon.png`) + **splash** (`assets/splash.png`,
  expo-splash-screen, cover) committed — **appear only after a fresh `eas build`.**

## DONE (real, on the dev build)
- Auth: Privy dual-chain embedded wallets (SOL + EVM) auto-created at signup;
  `/api/auth/sync` binds to the **same Pointer account as web** (Google/Apple).
- Real data: Home **portfolio value** + unrealized P&L, **cash balance** (wallet
  USDC), Profile **identity**, **username edit** → `/api/auth/sync`, Account real
  wallet addresses + email.
- **Buy (Apple Pay → token) via Crossmint** — Deposit → Apple Pay → pick token →
  real embedded checkout, delivered to the Privy wallet. Token then shows in
  on-chain holdings.
- **Debit deposit → Onramper** card on-ramp (cash → USDC).
- Token page real: **Live trades** (`/api/tokens/:mint/trades`) + **Top holders**
  distribution w/ dev/sniper flags (`/api/tokens/:mint/holders`) + **real OHLC
  candlestick chart** (`/api/tokens/:mint/chart`, interval per range chip).
- **Connect X** in onboarding + Account really links via Privy `useLinkWithOAuth`
  and uses the @handle AS the username (skips manual step); username persists via
  `/api/auth/sync` (the twitter_handle link itself is still backend-pending).
- **Weekly Top Trades** redesigned off FOMO's carousel → hero + ranked list,
  multiple-first (`Nx`).
- Cross-chain "All" board (SOL/ETH/Base/BNB demo feeds + chain badges), nav stack
  (swipe-back returns correctly + locked horizontal), clickable trader positions,
  AI verdict auto-opens, perp rows → live detail sheet, referral own-code, share =
  referral invite, **Squads tab** (demo membership).

## Pointer Financial (NEW — the capital layer)
The financial layer as its own **card-icon nav-island tab** → a **Capital
Dashboard**, not a banking app. Spec: `docs/POINTER_FINANCIAL.md`. Core model =
**Four States of Capital: Trading · Earning · Spendable · Reserved — never idle.**
- `screens/FinancialScreen.tsx` — Total Capital hero (**counts up** on open), the
  **four-state segmented bar** (each segment/legend row tappable → a state-detail
  sheet explaining what's inside + the trading-context *why*), **Pointer Card**
  visual, live-ticking **Smart Yield** + APY + sparkline, **tax-reserve** strip,
  **PTR Points** row, an **AI insight** card, and a capital **activity** feed.
- **Deep sheets** (`components/FinancialSheets.tsx`): every section opens a real
  management panel —
  - **Card**: freeze toggle, Add-to-Pay, monthly limit, recent card activity.
  - **Smart Yield**: earned + sparkline, rate/principal/projection, auto-sweep +
    keep-liquid controls.
  - **Tax Reserve**: covered banner, realized-gains/liability/reserved, auto-reserve
    toggle, "Export for taxes" → Pointer Taxes handoff.
  - **PTR Points**: tier progress + points-by-source (spend/earn/hold) bars.
  - **AI co-pilot**: reads the user's capital in plain language + "ask" affordance
    (opened by the header AI pill and the insight card).
  - **Move Capital**: shift money between any two states (from/to chips +
    25/50/75/Max); the bar **rebalances with a spring** (model is mutable local
    state). This is the "never idle" interaction made literal.
- `src/demo/capital.ts` — `getDemoCapital()` deterministic model (states, apy,
  earned, card, points/tier/by-source, tax + realized gains, activity, insights).
  `components/Sparkline.tsx` shared; `usd`/`group` money helpers in `src/format.ts`.
- **Provider choice (users never see names, all API-verified 2026-07-03):**
  Bridge (Stripe-owned) = card issuing + Apple/Google Pay push-provisioning + virtual
  accounts + on/off ramp; **Lulo** (lulo.fi, RESTful API, Solana-native, aggregates
  Kamino/Morpho/Maple w/ principal protection) = yield on idle USDC; Crossmint =
  fiat→token buys (already wired). Earlier notes said "Blend" for yield — loose name,
  Lulo is the real pick. One-vendor-light on purpose (the "how easy to start" thesis).
- **First-run journey** (`screens/FinancialOnboarding.tsx`): a fresh account sees
  `FinancialIntro` (pitch) → `FinancialActivation` (just-in-time KYC: legal name +
  country → virtual card issued instantly; animated provisioning; celebratory
  card-ready with Add-to-Apple-Pay). Driven by `src/financial/store.ts`
  (unactivated → active); issued card's last4/frozen thread into the dashboard +
  Card sheet. **DEMO always starts unactivated** so the journey is re-demoable.
- **Backend facade (built, key-gated):** `app/api/financial/{status,activate,
  card/provision}/route.ts` + `lib/financial/bridgeClient.ts` (Bridge:
  customers, virtual accounts, card issuance, Apple Pay provisioning). With no
  `BRIDGE_API_KEY` every route returns `{ configured:false }` and the app uses its
  local simulation — **no faked money**. `lib/financial/db.ts` persists to
  `financial_accounts` (inert until `scripts/financial-accounts.sql` runs).
  Mobile client: `src/financial/api.ts`.
- **Add-to-Apple-Pay** (`src/financial/wallet.ts`): flow wired end-to-end
  (mobile → `POST /api/financial/card/provision` → native PassKit). Simulated in
  demo. **Still needs** (external): a PassKit provisioning native module + Apple's
  `com.apple.developer.payment-pass-provisioning` entitlement (Apple approval) +
  issuer approval. `walletAvailable()` stays false until then; NOT added to
  app.config yet (an unapproved entitlement would break signing).
- **Provider choice (users never see names):** Bridge = card + bank rails + ramp,
  Blend = yield, Crossmint = buys.
- **To make it fully real:** set `BRIDGE_API_KEY` (+ base), run
  `scripts/financial-accounts.sql`, verify the Bridge REST paths in
  `bridgeClient.ts` against their live API, then request the Apple Pay entitlement.
  Move Capital mutates the demo model only (no on-chain effect yet).

## BLOCKED on web backend + DB restore
The web team confirmed these are all **DB-write features**, blocked until the
Supabase restore lands. Contracts agreed (see the handoff prompt in chat / commit
history). Priority once DB is back: provision `squads` schema → follows graph +
`users.twitter_handle` → `/api/me/balance` → **Crossmint webhook**.
- **Follow** (one-way, drives push notifications) — no endpoint/table yet.
  Following a **wallet/KOL** can reuse existing `tracked_wallets`.
- **Friend request** (mutual) — web has it; need the endpoint shapes.
- **Squads** real membership — `squads`/`squad_members` not provisioned
  (`/api/squads/list` returns `provisioned:false`).
- **Connect-X persistence** — `users.twitter_handle` to be added in
  `/api/wallets/sync-privy` (reads Privy linked accounts). Mobile card is an
  honest "coming soon" for now.
- **Buy P&L / points / cashback** — needs `POST /api/crossmint/webhook` (Svix
  verify → mirror `/api/trade/execute`). Solana-only for v1 (trades table is
  Solana-centric; EVM Crossmint buys deliver but won't record yet).
- Named-trader **leaderboard** / social "Traders here" — only points-leaderboard +
  anonymous-wallet top-traders exist today; kept the nicer demo until social lands.

## NEEDS a rebuild
- Icon + splash (next `eas build`).
- **Push notifications** — needs `expo-notifications` (native) + a
  `POST /api/push/register { expoPushToken }` endpoint. Hold until the endpoint
  exists so we only rebuild once.

## Discretionary / next
- **Weekly Top Trades redesign** (move off FOMO look) — pending direction.
- Optionally wire the real anonymous points-leaderboard / top-traders now.

## Key gotchas
- Native SDKs (Privy, Crossmint) are metro-stubbed in DEMO so Expo Go stays clean;
  they're lazy-required only in real mode. Don't un-stub without keeping demo green
  (`npx expo export --platform ios` with DEMO=1 must succeed).
- Dynamic `app.config.ts` can't be auto-written by EAS → `projectId`,
  `updates.url`, `owner` are set by hand there.
- Hermes has no `Intl` — use the manual group helpers, not `toLocaleString`.
