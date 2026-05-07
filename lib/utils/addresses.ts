import { PublicKey } from '@solana/web3.js';

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]+$/;

// "Horizontal ellipsis" U+2026 separator for shortened addresses.
const ELLIPSIS = '\u2026';

/** Lightweight string-only check. Use {@link isValidPublicKey} when you need
 * cryptographic certainty (it instantiates a `PublicKey`). */
export function looksLikeSolanaAddress(value: string): boolean {
  if (!value || value.length < 32 || value.length > 44) return false;
  return BASE58_REGEX.test(value);
}

export function isValidPublicKey(value: string): boolean {
  if (!looksLikeSolanaAddress(value)) return false;
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}${ELLIPSIS}${address.slice(-chars)}`;
}

export function shortenSignature(sig: string, chars = 6): string {
  return shortenAddress(sig, chars);
}

export function explorerTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

export function explorerAddressUrl(address: string): string {
  return `https://solscan.io/account/${address}`;
}

export function explorerTokenUrl(mint: string): string {
  return `https://solscan.io/token/${mint}`;
}

/** Native SOL pseudo-mint Jupiter and most aggregators use. */
export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export function isNativeSol(mint: string): boolean {
  return mint === SOL_MINT;
}
