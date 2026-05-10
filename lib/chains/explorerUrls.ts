import { inferMintKind } from '@/lib/chains/mintKind';

/** Account / contract page on the canonical explorer for this address shape. */
export function explorerUrlForAccount(address: string): string {
  const a = address.trim();
  const k = inferMintKind(a);
  if (k === 'sol') return `https://solscan.io/account/${encodeURIComponent(a)}`;
  if (k === 'ton') return `https://tonviewer.com/${encodeURIComponent(a)}`;
  if (k === 'evm') return `https://etherscan.io/address/${a}`;
  return `https://tonviewer.com/${encodeURIComponent(a)}`;
}

/** Solana transaction (base58 signature). */
export function explorerUrlSolanaTx(signature: string): string {
  return `https://solscan.io/tx/${encodeURIComponent(signature.trim())}`;
}

/** TON transaction hash / id as used by Tonviewer. */
export function explorerUrlTonTx(hash: string): string {
  return `https://tonviewer.com/transaction/${encodeURIComponent(hash.trim())}`;
}
