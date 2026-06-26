# Pointer Mobile (Expo)

Native iOS/Android client for Pointer. **Uses the existing Next.js API** (`pointer-ton.vercel.app`) — not a rebuild.

Stack: Expo SDK 56 · React Native 0.85 · `@privy-io/expo` (same Privy App ID as web) · EAS cloud builds from Windows.

## Design docs (read before UI work)

| Doc | Purpose |
|-----|---------|
| **`DESIGN-SYSTEM.md`** | Tokens, components, Simple/Advanced per screen |
| **`DESIGN-CRITIQUES.md`** | Anti-slop fixes (Ocean not blurple, flat bg, hierarchy) |
| **`ADVANCED-MODE-PLAN.md`** | Operator mode scope + build order |
| **`DESIGN-STUDY.md`** | FOMO benchmark mapping |

## What's here (mobile-foundation branch)

- **Onboarding** — experience picker (Simple vs Advanced), wallet provisioning
- **5-tab glass nav** — Home, Search, center **Adv.** toggle, Social, Profile
- **Token screen** — Simple/Advanced morph, BuySheet (market/limit stubs in Advanced)
- **Funding** — deposit flow, Apple Pay path (where configured)
- **Privy auth** — email OTP + embedded Solana wallet, real `/api/trade/*` path

Phase 0 wedge (Pulse → token → AI verdict → trade) is superseded by the full shell above.

## One-time setup (Windows)

1. **Accounts** (start the slow ones now — they gate iOS):
   - Expo account → `npm i -g eas-cli && eas login`
   - **Apple Developer — ORGANIZATION** account ($99/yr, needs a D-U-N-S number;
     required by Apple's wallet guideline 3.1.5(i)). Slowest item — start day 1.
   - Google Play Developer ($25 one-time).
2. **Privy dashboard:** open the SAME app as web. Create an **Expo app client**
   (Settings → Clients) → copy its **client id**. Add the `pointer://` redirect.
3. `cd apps/mobile && npm install`
4. `npx expo install --fix` — replaces the `*` versions in package.json with the
   exact SDK-56-compatible ones (Privy, expo-secure-store, polyfills, etc.).
5. `cp .env.example .env` and fill `EXPO_PUBLIC_PRIVY_APP_ID` (same as web) +
   `EXPO_PUBLIC_PRIVY_CLIENT_ID` (from step 2). `EXPO_PUBLIC_API_URL` defaults to prod.
6. In `app.config.ts`, uncomment the `'@privy-io/expo'` plugin once installed.

## Run it (no Mac)

Expo Go will **not** work — Privy ships native modules, so you need a dev build:

```bash
# Build a dev client once, in Apple's/Google's cloud (from Windows):
npm run build:dev:android      # eas build -p android  → install the APK on an Android device
npm run build:dev:ios          # eas build -p ios       → installs on your iPhone via the EAS link

# Then iterate on JS instantly (the dev client connects to Metro over your network):
npm start                      # expo start --dev-client → scan the QR from the dev client
```

EAS pushes JS/UI changes; only native/SDK changes need a new dev build.

## Verify on a dev build — what "green" looks like

On the dev build, on a real device:
1. **Login** completes (Privy email OTP) — `LoginScreen`.
2. **Pulse feed** loads (`/api/pulse/feed`, public). Tap a token.
3. The **AI verdict chip** loads on the token screen — this calls the *authed*
   `/api/ai/explain-token`, so a verdict appearing proves the device Bearer token
   authenticates against the existing backend with zero backend changes.
4. **The one hard dependency** — the sign-only step in
   `src/trade/useTradeSubmit.ts`. Do a tiny buy: it must `/api/trade/quote` → have
   the embedded Solana wallet **sign without broadcasting** → `/api/trade/execute`
   (server broadcasts). Confirm `@privy-io/expo` exposes that sign-only primitive
   (`useEmbeddedSolanaWallet().getProvider().request({ method: 'signTransaction' })`
   or the version's equivalent). If only `signAndSend` exists, adapt **only** that
   one call. A confirmed signature back = the whole money path works on mobile.

When green, the next steps are the Turborepo move + the 5-tab expo-router structure +
the Simple/Advanced expansion on the token screen.

## Deferred: Turborepo restructure (deliberate next step)

Per the approved plan the target is a Turborepo monorepo (`apps/web` + `apps/mobile`
+ `packages/shared-types|api-client|trading`). That move is **intentionally not done
yet** so the live web app keeps deploying from `main` untouched. It lands as its own
PR and requires setting the **Vercel project Root Directory → `apps/web`** (a
dashboard change). Until then this Expo app is self-contained and talks to the
deployed API over HTTPS.
