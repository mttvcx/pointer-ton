import { PublicKey } from '@solana/web3.js';

/** Canonical base58 for DB lookups and wallet matching. */
export function canonicalSolAddress(addr: string | null | undefined): string | null {
  if (!addr?.trim()) return null;
  try {
    return new PublicKey(addr.trim()).toBase58();
  } catch {
    return addr.trim();
  }
}

export function solAddressesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ca = canonicalSolAddress(a);
  const cb = canonicalSolAddress(b);
  if (!ca || !cb) return false;
  return ca === cb;
}
