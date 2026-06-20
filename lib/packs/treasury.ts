import 'server-only';

import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { isValidPublicKey } from '@/lib/utils/addresses';

/**
 * Packs treasury — the server-signing wallet that funds real pack opens.
 *
 * Flow: the user pays the pack price (SOL) to {@link getPacksTreasuryAddress}.
 * The treasury then buys each won token on-chain and delivers it to the user.
 * The house edge (≥22%, enforced by pack economics) is what the treasury keeps.
 *
 * SECURITY: `PACKS_TREASURY_SECRET_KEY` is a hot signing key. Keep it server-only,
 * fund it conservatively, and never expose it to the client bundle. The public
 * address may be surfaced to the client (it is just a deposit target).
 */

let _cached: Keypair | null = null;

function parseSecret(raw: string): Keypair | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    // JSON array form (Solana CLI keypair file contents).
    if (trimmed.startsWith('[')) {
      const arr = JSON.parse(trimmed) as number[];
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
    // base58 form.
    return Keypair.fromSecretKey(bs58.decode(trimmed));
  } catch {
    return null;
  }
}

/** The treasury signing keypair, or null when not configured. */
export function getPacksTreasuryKeypair(): Keypair | null {
  if (_cached) return _cached;
  const raw = process.env.PACKS_TREASURY_SECRET_KEY;
  if (!raw) return null;
  const kp = parseSecret(raw);
  if (kp) _cached = kp;
  return kp;
}

/**
 * Public treasury address. Prefers the explicit `NEXT_PUBLIC_PACKS_TREASURY_ADDRESS`
 * (client-safe deposit target); otherwise derives it from the secret key.
 */
export function getPacksTreasuryAddress(): string | null {
  const explicit = process.env.NEXT_PUBLIC_PACKS_TREASURY_ADDRESS?.trim();
  if (explicit && isValidPublicKey(explicit)) return explicit;
  const kp = getPacksTreasuryKeypair();
  return kp ? kp.publicKey.toBase58() : null;
}

export function getPacksTreasuryPubkey(): PublicKey | null {
  const addr = getPacksTreasuryAddress();
  if (!addr) return null;
  try {
    return new PublicKey(addr);
  } catch {
    return null;
  }
}

/** Can the server actually sign + fulfill pack rewards on-chain? */
export function isPacksTreasuryConfigured(): boolean {
  return getPacksTreasuryKeypair() != null;
}

/** Reset cached keypair (tests only). */
export function __resetPacksTreasuryCache(): void {
  _cached = null;
}
