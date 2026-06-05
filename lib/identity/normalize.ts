import { PublicKey } from '@solana/web3.js';
import type { AppChainId } from '@/lib/chains/appChain';
import { looksLikeSolanaAddress } from '@/lib/utils/addresses';
import type { IdentityAddressType } from '@/lib/identity/types';

const EVM_RE = /^0x[a-fA-F0-9]{40}$/;

/** Map seed / provider chain slugs to {@link AppChainId}. */
export function appChainFromSeedChain(raw: string): AppChainId | null {
  const s = raw.trim().toLowerCase();
  if (s === 'sol' || s === 'solana') return 'sol';
  if (s === 'eth' || s === 'ethereum') return 'eth';
  if (s === 'bnb' || s === 'bsc') return 'bnb';
  if (s === 'base') return 'base';
  if (s === 'ton') return 'ton';
  return null;
}

export function addressTypeForChain(chain: AppChainId): IdentityAddressType {
  return chain === 'sol' ? 'solana' : chain === 'ton' ? 'solana' : 'evm';
}

export function isValidSolanaAddress(addr: string): boolean {
  const s = addr.trim();
  if (!looksLikeSolanaAddress(s)) return false;
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}

export function isValidEvmAddress(addr: string): boolean {
  return EVM_RE.test(addr.trim());
}

export function normalizeWalletAddress(
  chain: AppChainId,
  address: string,
): { normalized: string; addressType: IdentityAddressType; valid: boolean } {
  const addressType = addressTypeForChain(chain);
  const raw = address.trim();
  if (addressType === 'solana' && chain === 'sol') {
    if (!isValidSolanaAddress(raw)) return { normalized: raw, addressType, valid: false };
    return { normalized: raw, addressType, valid: true };
  }
  if (addressType === 'evm') {
    if (!isValidEvmAddress(raw)) return { normalized: raw.toLowerCase(), addressType, valid: false };
    return { normalized: raw.toLowerCase(), addressType, valid: true };
  }
  if (chain === 'ton') {
    return { normalized: raw, addressType: 'solana', valid: raw.length > 8 };
  }
  return { normalized: raw, addressType, valid: false };
}

export function walletRegistryKey(chain: AppChainId, address: string): string {
  const { normalized } = normalizeWalletAddress(chain, address);
  return `${chain}:${normalized}`;
}

export function normalizeDisplayName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function truncateDisplayName(name: string, max = 22): string {
  const t = name.trim();
  if (t.length <= max) return t;
  if (max <= 3) return t.slice(0, max);
  return `${t.slice(0, max - 1)}…`;
}

export function normalizeTwitterHandle(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const h = raw.trim().replace(/^@/, '');
  return h.length > 0 ? h : null;
}
