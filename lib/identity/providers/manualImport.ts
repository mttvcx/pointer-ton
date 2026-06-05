import type { IdentitySeedRow } from '@/lib/identity/types';
import { appChainFromSeedChain } from '@/lib/identity/normalize';
import { isValidEvmAddress, isValidSolanaAddress } from '@/lib/identity/normalize';
import type { AppChainId } from '@/lib/chains/appChain';

/** Parse manual JSON array export. */
export function parseManualJsonImport(raw: unknown): IdentitySeedRow[] {
  if (!Array.isArray(raw)) return [];
  const out: IdentitySeedRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const chain = appChainFromSeedChain(String(row.chain ?? ''));
    const address = String(row.address ?? '').trim();
    const displayName = String(row.displayName ?? row.name ?? '').trim();
    if (!chain || !address || !displayName) continue;
    if (chain === 'sol' && !isValidSolanaAddress(address)) continue;
    if ((chain === 'eth' || chain === 'bnb' || chain === 'base') && !isValidEvmAddress(address)) {
      continue;
    }
    out.push({
      chain,
      address,
      displayName,
      avatarUrl: typeof row.avatarUrl === 'string' ? row.avatarUrl : null,
      twitterHandle: typeof row.twitterHandle === 'string' ? row.twitterHandle : null,
      telegramHandle: typeof row.telegramHandle === 'string' ? row.telegramHandle : null,
      category: (row.category as IdentitySeedRow['category']) ?? 'kol',
      badges: Array.isArray(row.badges) ? (row.badges as IdentitySeedRow['badges']) : undefined,
      source: String(row.source ?? 'manual'),
      sourceUrl: typeof row.sourceUrl === 'string' ? row.sourceUrl : null,
      confidence: typeof row.confidence === 'number' ? row.confidence : 0.7,
      verified: Boolean(row.verified),
      rank: typeof row.rank === 'number' ? row.rank : null,
      pnlUsd: typeof row.pnlUsd === 'number' ? row.pnlUsd : null,
      winRate: typeof row.winRate === 'number' ? row.winRate : null,
      txCount: typeof row.txCount === 'number' ? row.txCount : null,
    });
  }
  return out;
}

/** Minimal CSV: chain,address,displayName,source,category,twitter,avatarUrl */
export function parseManualCsvImport(csv: string): IdentitySeedRow[] {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const out: IdentitySeedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(',').map((c) => c.trim());
    const chain = appChainFromSeedChain(cols[idx('chain')] ?? '');
    const address = cols[idx('address')] ?? '';
    const displayName = cols[idx('displayname')] ?? cols[idx('name')] ?? '';
    if (!chain || !address || !displayName) continue;
    out.push({
      chain,
      address,
      displayName,
      source: cols[idx('source')] ?? 'manual',
      category: (cols[idx('category')] as IdentitySeedRow['category']) ?? 'kol',
      twitterHandle: cols[idx('twitter')] ?? null,
      avatarUrl: cols[idx('avatarurl')] ?? null,
      confidence: 0.7,
    });
  }
  return out;
}

export function seedRowsForChain(chain: AppChainId, rows: IdentitySeedRow[]): IdentitySeedRow[] {
  return rows.filter((r) => appChainFromSeedChain(String(r.chain)) === chain);
}
