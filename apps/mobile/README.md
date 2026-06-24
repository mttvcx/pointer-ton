# Pointer Mobile (Expo) — Phase 0 foundation

Native iOS/Android app for Pointer. **It is a client to the existing Pointer
Next.js API** (`pointer-ton.vercel.app`, 170 routes) — not a rebuild. This folder
is the Phase 0 scaffold + the **Privy spike** that de-risks the one hard
dependency before screen work begins.

Stack: Expo SDK 56 (New Architecture) · React Native 0.85 · `@privy-io/expo`
(same Privy App ID as web → one identity + one embedded Solana wallet) ·
`@solana/web3.js`. Builds from **Windows with no Mac/Xcode** via EAS cloud builds.

## What's here

- `App.tsx` — the **Phase 0 spike screen** (Privy email login → `getAccessToken()`
  → `GET /api/me` to prove mobile reuses the web backend auth → shows the embedded
  Solana wallet). This is throwaway; it exists only to turn the plan's risks green.
- `app.config.ts` — Pointer branding, the load-bearing `pointer://` scheme, bundle
  ids (`com.pointer.app`), env-driven `extra` (API url + Privy ids).
- `src/polyfills.ts` — `react-native-get-random-values` + `Buffer` (required before
  any `@solana/web3.js` use).
- `src/env.ts`, `src/api/client.ts` — typed Bearer-token client to the existing API.
- `src/providers/AppProviders.tsx` — `PrivyProvider` (creates the embedded Solana
  wallet on login).
- `eas.json` — development / preview / production build profiles.

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

## Phase 0 spike — what "green" looks like

On the dev build, on a real device:
1. Email login completes (Privy).
2. **Test /api/me** logs a `200` with your synced user — proves the device Bearer
   token authenticates against the existing backend with zero backend changes.
3. An embedded **SOL wallet address** appears.
4. **Verify the hard dependency:** that `@privy-io/expo` exposes a **sign-only**
   primitive for the embedded Solana wallet (returns a signed `VersionedTransaction`
   without broadcasting) — required to preserve the hardened sign-only →
   `/api/trade/execute` server-broadcast money path. Check the installed version's
   docs for `useEmbeddedSolanaWallet().getProvider()` / `signTransaction`. If only
   `signAndSend` exists, that's the one thing to adapt in `packages/trading` later.

When all four are green, Phase 1 (real navigation + the Simple token screen + the
ported quote→sign→execute flow) begins.

## Deferred: Turborepo restructure (deliberate next step)

Per the approved plan the target is a Turborepo monorepo (`apps/web` + `apps/mobile`
+ `packages/shared-types|api-client|trading`). That move is **intentionally not done
yet** so the live web app keeps deploying from `main` untouched. It lands as its own
PR and requires setting the **Vercel project Root Directory → `apps/web`** (a
dashboard change). Until then this Expo app is self-contained and talks to the
deployed API over HTTPS.
