// Demo stub for @crossmint/client-sdk-react-native-ui. Metro aliases the SDK here
// when EXPO_PUBLIC_DEMO=1 (see metro.config.js) so Crossmint's native deps are
// never bundled and the app runs in plain Expo Go. Never evaluated at runtime —
// src/crossmint/checkout.tsx is only required in REAL mode (CROSSMINT_READY).
const disabled = () => {
  throw new Error('Crossmint is disabled in the demo build');
};
module.exports = {
  CrossmintProvider: disabled,
  CrossmintCheckoutProvider: disabled,
  CrossmintEmbeddedCheckout: disabled,
  useCrossmintCheckout: disabled,
};
