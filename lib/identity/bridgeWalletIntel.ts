import type { AppChainId } from '@/lib/chains/appChain';
import { resolveWalletIdentity } from '@/lib/identity/identityService';
import type {
  RecognizedWalletRecord,
  WalletIntelBadgeKind,
} from '@/lib/walletIdentity/types';
import type { IdentityBadgeKind } from '@/lib/identity/types';

function mapBadge(b: IdentityBadgeKind): WalletIntelBadgeKind | null {
  switch (b) {
    case 'KOL':
      return 'kol';
    case 'Smart Money':
      return 'smart_money';
    case 'Whale':
      return 'whale';
    case 'Sniper':
      return 'sniper';
    case 'Insider':
      return 'insider';
    case 'Dev':
      return 'dev';
    case 'Fresh Wallet':
      return 'fresh';
    default:
      return null;
  }
}

function mapSource(source: string): RecognizedWalletRecord['source'] {
  if (source === 'kolscan' || source === 'gmgn') return 'import';
  if (source === 'pointer') return 'pointer_directory';
  return 'import';
}

function mapCategory(
  cat: string | null,
): RecognizedWalletRecord['category'] {
  switch (cat) {
    case 'kol':
      return 'kol';
    case 'smart_money':
      return 'smart_money';
    case 'whale':
      return 'whale';
    case 'sniper':
      return 'sniper';
    case 'insider':
      return 'insider';
    case 'dev':
      return 'deployer';
    default:
      return 'other';
  }
}

/** Bridge Pointer identity registry → legacy {@link RecognizedWalletRecord}. */
export function recognizedWalletFromRegistry(
  chain: AppChainId,
  address: string,
): RecognizedWalletRecord | null {
  const r = resolveWalletIdentity({ chain, address });
  if (!r.identityId || r.displayName === r.shortAddress) return null;
  const badges: WalletIntelBadgeKind[] = [];
  for (const b of r.badges) {
    const m = mapBadge(b);
    if (m && !badges.includes(m)) badges.push(m);
  }
  return {
    address,
    displayName: r.displayName,
    handle: r.twitterHandle ? `@${r.twitterHandle.replace(/^@/, '')}` : undefined,
    source: mapSource(r.source ?? 'import'),
    confidence: r.confidence ?? 0.7,
    category: mapCategory(r.primaryCategory),
    badges,
    avatarUrl: r.avatarUrl ?? undefined,
    profileUrl: r.twitterHandle ? `https://x.com/${r.twitterHandle.replace(/^@/, '')}` : undefined,
    notes: r.sourceLabel,
    lastVerifiedAt: new Date().toISOString(),
  };
}
