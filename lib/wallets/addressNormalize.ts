import { PublicKey } from '@solana/web3.js';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

/** Normalize wallet string for storage / duplicate checks (TON, Solana, EVM). */
export function normalizeWalletAddressForStorage(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const ton = normalizeTonAddress(s);
  if (ton) return ton;
  try {
    return new PublicKey(s).toBase58();
  } catch {
    /* not Solana */
  }
  const lo = s.toLowerCase();
  if (/^0x[a-f0-9]{40}$/.test(lo)) return lo;
  return null;
}
