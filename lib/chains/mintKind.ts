import { PublicKey } from '@solana/web3.js';
import type { AppChainId } from '@/lib/chains/appChain';
import { looksLikeBitcoinAddress } from '@/lib/utils/bitcoinAddress';
import { looksLikeSolanaAddress } from '@/lib/utils/addresses';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

export type InferredMintKind = 'ton' | 'btc' | 'sol' | 'evm' | 'unknown';

/** Infer host chain from mint / contract string (no DB `chain` column). */
export function inferMintKind(mint: string): InferredMintKind {
  const raw = mint.trim();
  if (normalizeTonAddress(raw) != null) return 'ton';
  if (looksLikeBitcoinAddress(raw)) return 'btc';
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

/**
 * Header chain to activate when opening `/token/[mint]` from clipboard.
 * `0x…` mints are ambiguous (BNB vs Base); prefer the user's current chain when already on an EVM rail,
 * otherwise default to BNB (common pump/brainshare flow).
 */
export function appChainForMintNavigation(mint: string, activeChain: AppChainId): AppChainId {
  const k = inferMintKind(mint.trim());
  if (k === 'ton') return 'ton';
  if (k === 'sol') return 'sol';
  if (k === 'evm') {
    if (activeChain === 'bnb' || activeChain === 'base') return activeChain;
    return 'bnb';
  }
  return activeChain;
}

/** Tracker watchlist addresses must match the selected header chain (TON / Solana / EVM). */
export function isValidTrackedWalletAddress(addr: string, chain: AppChainId): boolean {
  return mintMatchesAppChain(addr.trim(), chain);
}

/** Token explorer URL from mint shape + user's header chain preference for ambiguous EVM mints (0x). */
export function explorerTokenHrefFromMint(mint: string, evmPrefer: AppChainId): string {
  const raw = mint.trim();
  const k = inferMintKind(raw);
  if (k === 'sol') {
    return `https://solscan.io/token/${encodeURIComponent(raw)}`;
  }
  if (k === 'ton') {
    return `https://tonviewer.com/${encodeURIComponent(raw)}`;
  }
  if (k === 'evm') {
    if (evmPrefer === 'bnb') return `https://bscscan.com/token/${raw}`;
    if (evmPrefer === 'base') return `https://basescan.org/token/${raw}`;
    return `https://etherscan.io/token/${raw}`;
  }
  return `https://tonviewer.com/${encodeURIComponent(raw)}`;
}

/** Accessible label when linking out to whichever explorer matches {@link explorerTokenHrefFromMint}. */
export function explorerTokenAriaLabel(chain: AppChainId): string {
  if (chain === 'sol') return 'Solscan token explorer';
  if (chain === 'ton') return 'TON explorer';
  if (chain === 'bnb') return 'BscScan token explorer';
  if (chain === 'base') return 'Basescan token explorer';
  return 'Token explorer';
}
