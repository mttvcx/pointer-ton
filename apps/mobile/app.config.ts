import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Pointer Mobile — Expo app config.
 *
 * `pointer://` is the load-bearing URL scheme: Privy auth redirects, referral
 * links, and PnL/share deep links all ride it. Env-driven so the same binary can
 * point at prod vs a preview API via EAS build profiles.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Pointer',
  slug: 'pointer-mobile',
  owner: 'mttvcx',
  scheme: 'pointer',
  version: '0.1.0',
  // EAS Update (dynamic config can't be auto-written, so set explicitly).
  runtimeVersion: { policy: 'appVersion' },
  updates: { url: 'https://u.expo.dev/782edf66-e786-4d79-9522-bddbba8f4c19' },
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  backgroundColor: '#080D14',
  icon: './assets/icon.png',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.pointer.app',
    // Sign in with Apple (Privy OAuth) — the plugin wires the entitlement.
    usesAppleSignIn: true,
    // 17+ (crypto/finance); finalize rating during App Store setup.
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'com.pointer.app',
    adaptiveIcon: {
      backgroundColor: '#080D14',
      foregroundImage: './assets/android-icon-foreground.png',
    },
  },
  plugins: [
    'expo-font',
    'expo-secure-store',
    'expo-web-browser',
    // Sign in with Apple entitlement for Privy OAuth.
    'expo-apple-authentication',
    // Full-bleed launch image (bird over the field). `cover` fills the screen;
    // the teal bg matches the sky for any brief edge before the image paints.
    ['expo-splash-screen', { image: './assets/splash.png', resizeMode: 'cover', backgroundColor: '#B4D4CC' }],
    // Remote push (follows/friends notifications). Takes effect on the next build.
    'expo-notifications',
    // Note: @privy-io/expo, @crossmint/client-sdk-react-native-ui, react-native-webview
    // and @privy-io/expo-native-extensions autolink — they need no config plugin.
  ],
  extra: {
    // Read by src/env.ts. Set via .env (EXPO_PUBLIC_*) or EAS build profile env.
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://pointer.am',
    privyAppId: process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? '',
    privyClientId: process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? '',
    // Crossmint client-side key (ck_…) for the Apple Pay → token checkout.
    crossmintClientKey: process.env.EXPO_PUBLIC_CROSSMINT_CLIENT_KEY ?? '',
    // EAS project link (dynamic config can't be auto-written, so it's set here).
    eas: { projectId: '782edf66-e786-4d79-9522-bddbba8f4c19' },
  },
});
