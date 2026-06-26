// Learn more https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// DEMO build (Expo Go, no accounts): stub @privy-io/expo so Metro doesn't try to
// bundle Privy's native peer deps (viem, expo-apple-authentication, passkeys, …).
// Privy is only used in the REAL (EAS dev build) path, where this alias is off.
if (process.env.EXPO_PUBLIC_DEMO === '1') {
  console.log('[metro.config] DEMO mode → aliasing @privy-io/expo to stub');
  const stub = path.resolve(__dirname, 'src/auth/privyStub.js');
  const original = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === '@privy-io/expo') {
      return { type: 'sourceFile', filePath: stub };
    }
    return (original || context.resolveRequest)(context, moduleName, platform);
  };
}

module.exports = config;
