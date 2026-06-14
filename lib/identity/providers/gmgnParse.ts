import type { AppChainId } from '@/lib/chains/appChain';
import type { IdentitySeedRow } from '@/lib/identity/types';
import { gmgnWalletCopyUrl } from '@/lib/identity/config';
import { appChainFromSeedChain } from '@/lib/identity/normalize';
import { isValidEvmAddress, isValidSolanaAddress } from '@/lib/identity/normalize';
import { shortenAddress } from '@/lib/utils/addresses';

function displayNameFromGmgnRow(
  r: Record<string, unknown>,
  address: string,
): string {
  const raw = String(r.name ?? r.displayName ?? r.nickname ?? '').trim();
  const emoji = String(r.emoji ?? '').trim();
  if (raw) return emoji ? `${emoji} ${raw}` : raw;
  if (emoji) return `${emoji} ${shortenAddress(address, 4)}`;
  return shortenAddress(address, 5);
}

/** GMGN Track tab / WalletCopy export — `{ address, name?, emoji? }[]`. */
export function parseGmgnExport(raw: unknown, defaultChain: AppChainId): IdentitySeedRow[] {
  if (!Array.isArray(raw)) return [];
  const out: IdentitySeedRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const address = String(r.address ?? r.wallet ?? r.wallet_address ?? '').trim();
    if (!address) continue;
    const chain = appChainFromSeedChain(String(r.chain ?? defaultChain)) ?? defaultChain;
    if (chain === 'sol' && !isValidSolanaAddress(address)) continue;
    if ((chain === 'eth' || chain === 'bnb' || chain === 'base') && !isValidEvmAddress(address)) {
      continue;
    }
    const displayName = displayNameFromGmgnRow(r, address);
    out.push({
      chain,
      address,
      displayName,
      avatarUrl: typeof r.avatar === 'string' ? r.avatar : typeof r.avatarUrl === 'string' ? r.avatarUrl : null,
      twitterHandle: typeof r.twitter === 'string' ? r.twitter : null,
      category: 'kol',
      badges: ['KOL'],
      source: 'gmgn',
      sourceUrl: gmgnWalletCopyUrl(chain === 'bnb' ? 'bnb' : chain === 'base' ? 'base' : 'eth'),
      confidence: 0.75,
      rank: typeof r.rank === 'number' ? r.rank : null,
      pnlUsd: typeof r.pnl_usd === 'number' ? r.pnl_usd : typeof r.pnlUsd === 'number' ? r.pnlUsd : null,
      pnlPct: typeof r.pnl_pct === 'number' ? r.pnl_pct : null,
      winRate: typeof r.win_rate === 'number' ? r.win_rate : null,
      txCount: typeof r.tx_count === 'number' ? r.tx_count : null,
      trackedCount: typeof r.tracked === 'number' ? r.tracked : null,
      renamedCount: typeof r.renamed === 'number' ? r.renamed : null,
    });
  }
  return out;
}
