import { PublicKey } from '@solana/web3.js';
import type { AppChainId } from '@/lib/chains/appChain';
import { looksLikeSolanaAddress } from '@/lib/utils/addresses';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

export type InferredMintKind = 'ton' | 'sol' | 'evm' | 'unknown';

/** Infer host chain from mint / contract string (no DB `chain` column). */
export function inferMintKind(mint: string): InferredMintKind {
  const raw = mint.trim();
  if (normalizeTonAddress(raw) != null) return 'ton';
  if (looksLikeSolanaAddress(raw)) {
    try {
      new PublicKey(raw);
      return 'sol';
    } catch {
      return 'unknown';
    }
  }
  if (/^0x[a-fA-F0-9]{40}$/.test(raw)) return 'evm';
  return 'unknown';
}

export function mintMatchesAppChain(mint: string, chain: AppChainId): boolean {
  const k = inferMintKind(mint);
  if (chain === 'ton') return k === 'ton';
  if (chain === 'sol') return k === 'sol';
  if (chain === 'bnb' || chain === 'base') return k === 'evm';
  return false;
}

/** Token detail routes accept TON, Solana base58 mints, or `0x` contract addresses. */
export function isValidTokenMintParam(mint: string): boolean {
  return inferMintKind(mint.trim()) !== 'unknown';
}

/** Tracker watchlist addresses must match the selected header chain (TON / Solana / EVM). */
export function isValidTrackedWalletAddress(addr: string, chain: AppChainId): boolean {
  return mintMatchesAppChain(addr.trim(), chain);
}
