import { inferMintKind } from '@/lib/chains/mintKind';

/**
 * Friendly wallet naming — Axiom-style.
 *
 * Wallets created inside Pointer show as "Pointer Wallet 1", "Pointer Wallet 2",
 * … numbered PER CHAIN (each chain restarts at 1). The user's primary wallet on a
 * chain is "Pointer Wallet 1". No "embedded" / "privy" jargon ever surfaces.
 *
 * The number is derived at DISPLAY time from wallet order, so it works for both
 * new and existing accounts with no DB migration. A wallet the user has RENAMED
 * keeps that custom name — we only auto-name wallets whose stored label is one of
 * the legacy auto-defaults (or blank).
 */

/** Stored labels we treat as "not user-chosen" → safe to replace with Pointer Wallet N. */
const AUTO_LABELS = new Set([
  '',
  'wallet',
  'embedded',
  'embedded wallet',
  'privy',
  'privy wallet',
  'pointer wallet',
  'pointer solana',
  'pointer evm',
  'pointer ton',
  'untitled',
  'untitled wallet',
]);

export function isAutoWalletLabel(label: string | null | undefined): boolean {
  const l = (label ?? '').trim().toLowerCase();
  if (!l) return true;
  if (AUTO_LABELS.has(l)) return true;
  // A previously auto-assigned "Pointer Wallet N" is still auto (renumber freely).
  if (/^pointer wallet \d+$/.test(l)) return true;
  return false;
}

export type WalletNameRow = {
  id: string;
  wallet_address: string;
  label: string | null;
  is_imported?: boolean | null;
  slot?: number | null;
};

/**
 * Map of wallet id → display name. Non-imported Pointer wallets with an auto label
 * get "Pointer Wallet N" (numbered per chain by slot order); imported keys get
 * "Imported Wallet"; custom-named wallets keep their name.
 */
export function resolveWalletDisplayNames(rows: readonly WalletNameRow[]): Map<string, string> {
  const out = new Map<string, string>();
  const perChainCount: Record<string, number> = {};
  const ordered = [...rows].sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
  for (const r of ordered) {
    if (!isAutoWalletLabel(r.label)) {
      out.set(r.id, (r.label ?? '').trim());
      continue;
    }
    if (r.is_imported) {
      out.set(r.id, 'Imported Wallet');
      continue;
    }
    const chain = inferMintKind(r.wallet_address); // 'sol' | 'evm' | 'ton' | 'unknown'
    perChainCount[chain] = (perChainCount[chain] ?? 0) + 1;
    out.set(r.id, `Pointer Wallet ${perChainCount[chain]}`);
  }
  return out;
}

/** Single-row convenience when a full-list resolve isn't handy (no numbering). */
export function walletDisplayNameFallback(row: WalletNameRow): string {
  if (!isAutoWalletLabel(row.label)) return (row.label ?? '').trim();
  return row.is_imported ? 'Imported Wallet' : 'Pointer Wallet';
}
