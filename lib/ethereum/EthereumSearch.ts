import type { AppChainId } from '@/lib/chains/appChain';
import { inferMintKind } from '@/lib/chains/mintKind';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';
import { looksLikeSolanaAddress, isValidPublicKey } from '@/lib/utils/addresses';

export type EthereumSearchEntity =
  | 'evm_contract'
  | 'evm_wallet'
  | 'ens'
  | 'ticker'
  | 'ton'
  | 'solana'
  | 'unknown';

const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
const ENS_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i;

export function looksLikeEvmAddress(value: string): boolean {
  return EVM_RE.test(value.trim());
}

export function looksLikeEnsName(value: string): boolean {
  return ENS_RE.test(value.trim());
}

export function detectSearchEntityType(query: string, activeChain: AppChainId): EthereumSearchEntity {
  const q = query.trim();
  if (!q) return 'unknown';
  if (normalizeTonAddress(q) != null) return 'ton';
  if (looksLikeEnsName(q)) return 'ens';
  if (looksLikeEvmAddress(q)) {
    return activeChain === 'eth' || activeChain === 'bnb' || activeChain === 'base'
      ? 'evm_contract'
      : 'evm_wallet';
  }
  if (looksLikeSolanaAddress(q)) {
    try {
      const k = inferMintKind(q);
      if (k === 'sol') return 'solana';
    } catch {
      /* fallthrough */
    }
  }
  if (/^[A-Za-z0-9]{2,12}$/.test(q)) return 'ticker';
  return 'unknown';
}

/** Accepts TON, Solana, EVM `0x`, and ENS names for the command palette. */
export function isValidGlobalSearchQuery(value: string): boolean {
  const s = value.trim();
  if (!s) return false;
  if (looksLikeEnsName(s)) return true;
  if (looksLikeEvmAddress(s)) return true;
  return isValidPublicKey(s);
}

export function normalizeEvmAddress(addr: string): string | null {
  const a = addr.trim().toLowerCase();
  if (!EVM_RE.test(a)) return null;
  return a;
}
