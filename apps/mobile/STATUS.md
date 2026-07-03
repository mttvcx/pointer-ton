# Pointer Mobile — status & context

Living status doc for the mobile app on branch **`claude/reverent-mayer-2b1a14`**
(worktree). If a chat is lost, start here + `git log --oneline` to resume.

_Last updated: 2026-07-03._

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
  distribution w/ dev/sniper flags (`/api/tokens/:mint/holders`).
- Cross-chain "All" board (SOL/ETH/Base/BNB demo feeds + chain badges), nav stack
  (swipe-back returns correctly + locked horizontal), clickable trader positions,
  AI verdict auto-opens, perp rows → live detail sheet, referral own-code, share =
  referral invite, **Squads tab** (demo membership).

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
