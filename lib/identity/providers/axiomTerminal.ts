import type { AppChainId } from '@/lib/chains/appChain';
import type { IdentitySeedRow } from '@/lib/identity/types';
import { appChainFromSeedChain } from '@/lib/identity/normalize';
import { isValidEvmAddress, isValidSolanaAddress } from '@/lib/identity/normalize';

/**
 * Parse manually pasted Axiom / Terminal wallet export JSON.
 * Accepts array rows or `{ wallets: [...] }` wrapper — user-provided data only.
 */
export function parseAxiomTerminalExport(
  raw: unknown,
  defaultChain: AppChainId,
  source: 'axiom' | 'terminal',
): IdentitySeedRow[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { wallets?: unknown[] }).wallets)
      ? (raw as { wallets: unknown[] }).wallets
      : [];
  const out: IdentitySeedRow[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const address = String(
      r.address ?? r.wallet ?? r.walletAddress ?? r.trackedWalletAddress ?? '',
    ).trim();
    const displayName = String(
      r.displayName ?? r.name ?? r.label ?? r.nickname ?? r.traderName ?? '',
    ).trim();
    if (!address || !displayName) continue;

    const chain =
      appChainFromSeedChain(String(r.chain ?? r.network ?? defaultChain)) ?? defaultChain;
    if (chain === 'sol' && !isValidSolanaAddress(address)) continue;
    if ((chain === 'eth' || chain === 'bnb' || chain === 'base') && !isValidEvmAddress(address)) {
      continue;
    }

    const tags = Array.isArray(r.tags) ? (r.tags as string[]) : [];
    const badges: IdentitySeedRow['badges'] = tags.includes('KOL')
      ? ['KOL']
      : tags.includes('Smart Money')
        ? ['Smart Money']
        : ['KOL'];

    out.push({
      chain,
      address,
      displayName,
      avatarUrl:
        typeof r.avatar === 'string'
          ? r.avatar
          : typeof r.avatarUrl === 'string'
            ? r.avatarUrl
            : null,
      twitterHandle:
        typeof r.twitter === 'string'
          ? r.twitter
          : typeof r.handle === 'string'
            ? r.handle
            : typeof r.twitterHandle === 'string'
              ? r.twitterHandle
              : null,
      telegramHandle: typeof r.telegram === 'string' ? r.telegram : null,
      category:
        (r.category as IdentitySeedRow['category']) ??
        (tags.some((t) => /smart/i.test(t)) ? 'smart_money' : 'kol'),
      badges,
      source,
      sourceUrl: typeof r.sourceUrl === 'string' ? r.sourceUrl : null,
      confidence: typeof r.confidence === 'number' ? r.confidence : 0.72,
      notes: typeof r.notes === 'string' ? r.notes : null,
      rank: typeof r.rank === 'number' ? r.rank : null,
      pnlUsd: typeof r.pnlUsd === 'number' ? r.pnlUsd : null,
      winRate: typeof r.winRate === 'number' ? r.winRate : null,
      txCount: typeof r.txCount === 'number' ? r.txCount : null,
    });
  }
  return out;
}
