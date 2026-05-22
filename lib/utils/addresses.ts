import { PublicKey } from '@solana/web3.js';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]+$/;

// "Horizontal ellipsis" U+2026 separator for shortened addresses.
const ELLIPSIS = '\u2026';

/** True for base58 strings in the usual Solana pubkey length window (legacy mints / indexer IDs). */
export function looksLikeSolanaAddress(value: string): boolean {
  if (!value || value.length < 32 || value.length > 44) return false;
  return BASE58_REGEX.test(value);
}

function isValidSolanaPublicKey(value: string): boolean {
  if (!looksLikeSolanaAddress(value)) return false;
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Accepts TON friendly / raw addresses (`normalizeTonAddress`) and legacy Solana base58 pubkeys
 * (Helius ingest, wrapped mints on Jupiter price API, demo rows).
 */
export function isValidPublicKey(value: string): boolean {
  const s = value.trim();
  if (!s) return false;
  if (normalizeTonAddress(s) != null) return true;
  return isValidSolanaPublicKey(s);
}

/** @deprecated Prefer {@link isValidTrackedWalletAddress} from `@/lib/chains/mintKind` with the active chain. */
export function isValidTonTrackedAddress(value: string): boolean {
  return normalizeTonAddress(value.trim()) != null;
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}${ELLIPSIS}${address.slice(-chars)}`;
}

export function shortenSignature(sig: string, chars = 6): string {
  return shortenAddress(sig, chars);
}

/** Legacy TON tx URL — prefer {@link explorerUrlSolanaTx} / Tonviewer helpers when chain is known. */
export function explorerTxUrl(hash: string): string {
  const h = hash.trim();
  return `https://tonviewer.com/transaction/${encodeURIComponent(h)}`;
}

/**
 * Explorer account URL from address shape (Solana → Solscan, TON → Tonviewer, EVM → Etherscan).
 * Kept in this module (no import from `explorerUrls`) to avoid circular imports with `mintKind`.
 */
export function explorerAddressUrl(address: string): string {
  const a = address.trim();
  if (normalizeTonAddress(a) != null) {
    return `https://tonviewer.com/${encodeURIComponent(a)}`;
  }
  if (looksLikeSolanaAddress(a)) {
    try {
      new PublicKey(a);
      return `https://solscan.io/account/${encodeURIComponent(a)}`;
    } catch {
      /* fallthrough */
    }
  }
  if (/^0x[a-fA-F0-9]{40}$/.test(a)) {
    return `https://etherscan.io/address/${a}`;
  }
  return `https://tonviewer.com/${encodeURIComponent(a)}`;
}

/** Jetton master / contract page (same path shape as Tonviewer accounts). */
export function explorerTokenUrl(mint: string): string {
  const m = mint.trim();
  return `https://tonviewer.com/${encodeURIComponent(m)}`;
}

/** Native SOL pseudo-mint Jupiter and most aggregators use. */
export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
/** World Liberty Financial USD1 on Solana (SPL). */
export const USD1_MINT = 'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB';

export function isNativeSol(mint: string): boolean {
  return mint === SOL_MINT;
}
