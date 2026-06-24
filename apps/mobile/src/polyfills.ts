/**
 * Solana / web3 polyfills for React Native. MUST be imported first (index.ts),
 * before @solana/web3.js or any crypto use — RN has no global crypto/Buffer.
 */
import 'react-native-get-random-values';
import { Buffer } from 'buffer';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}
