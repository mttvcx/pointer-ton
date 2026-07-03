// Demo stub for @privy-io/expo. Metro aliases @privy-io/expo here when
// EXPO_PUBLIC_DEMO=1 (see metro.config.js) so Privy's native peer deps (viem,
// expo-apple-authentication, …) are never bundled and the app runs in plain Expo
// Go. Never evaluated at runtime — src/auth/privy.tsx is only required in REAL mode.
const disabled = () => {
  throw new Error('Privy is disabled in the demo build');
};
module.exports = {
  PrivyProvider: disabled,
  usePrivy: disabled,
  useLoginWithEmail: disabled,
  useEmbeddedSolanaWallet: disabled,
  useEmbeddedEthereumWallet: disabled,
  getAccessToken: disabled,
  useLoginWithOAuth: disabled,
  useLinkWithOAuth: disabled,
};
