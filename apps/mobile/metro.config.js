// Learn more https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// REAL build: Privy's SDK pulls in `jose` (and rpc-websockets / @noble/hashes),
// which ship multi-target builds via package "exports". Without this, Metro picks
// jose's Node build → `import 'crypto'` → red-screen crash. Preferring the
// react-native/browser conditions resolves them to the RN-safe builds.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require'];

// DEMO build (Expo Go, no accounts): stub the native SDKs (Privy + Crossmint) so
// Metro doesn't bundle their native peer deps (viem, expo-apple-authentication,
// passkeys, webview, …). Both are only used in the REAL (EAS dev build) path,
// where these aliases are off.
if (process.env.EXPO_PUBLIC_DEMO === '1') {
  console.log('[metro.config] DEMO mode → aliasing @privy-io/expo + Crossmint SDK to stubs');
  const stubs = {
    '@privy-io/expo': path.resolve(__dirname, 'src/auth/privyStub.js'),
    '@crossmint/client-sdk-react-native-ui': path.resolve(__dirname, 'src/crossmint/crossmintStub.js'),
  };
  const original = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (stubs[moduleName]) {
      return { type: 'sourceFile', filePath: stubs[moduleName] };
    }
    return (original || context.resolveRequest)(context, moduleName, platform);
  };
}

module.exports = config;
