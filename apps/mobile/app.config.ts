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
  scheme: 'pointer',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  backgroundColor: '#080D14',
  icon: './assets/icon.png',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.pointer.app',
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
    // Privy embedded-wallet + auth native modules (added during setup — see README).
    // '@privy-io/expo',
    'expo-font',
    'expo-secure-store',
    'expo-web-browser',
  ],
  extra: {
    // Read by src/env.ts. Set via .env (EXPO_PUBLIC_*) or EAS build profile env.
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://pointer-ton-orcin.vercel.app',
    privyAppId: process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? '',
    privyClientId: process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? '',
    // Crossmint client-side key (ck_…) for the Apple Pay → token checkout.
    crossmintClientKey: process.env.EXPO_PUBLIC_CROSSMINT_CLIENT_KEY ?? '',
  },
});
