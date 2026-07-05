import 'server-only';

import type { AppChainId } from '@/lib/chains/appChain';
import type { IdentityBadgeKind, ResolvedWalletIdentity } from '@/lib/identity/types';
import { resolveWalletIdentity } from '@/lib/identity/identityService';
import { searchIdentities, listRegistryStats } from '@/lib/identity/registry';
import { prepareIdentityRegistry } from '@/lib/identity/importPersisted';
import type { KOLMention, LabeledWallet, ProviderStatus } from '@/sibyl/data/providers/types';
import { sibylMockMode } from '@/sibyl/config';

/**
 * Pointer internal identity registry — THE MOAT. ~2,260 labeled wallets (KOLs, smart
 * money, snipers, insiders) with connected Twitter handles, shipped as bundled seed
 * JSON (`@/data/identity/*.json`) + layered DB community-labels. This is the data
 * frontier models can't have.
 *
 * Read-only. Resolves holder addresses → real labels via `resolveWalletIdentity`
 * (bundled registry works with zero keys / zero DB — `bootstrap()` loads the seeds
 * lazily). `prepareIdentityRegistry()` additionally merges DB-persisted community
 * labels on top, best-effort. No coupling to any trading path.
 */

const CHAIN: AppChainId = 'sol';

// Merge DB community-labels onto the bundled directory once (best-effort; the bundled
// seeds already resolve without this, so a DB failure degrades gracefully to seeds-only).
let prep: Promise<void> | null = null;
function ensureRegistry(): Promise<void> {
  if (!prep) prep = prepareIdentityRegistry().catch(() => {});
  return prep;
}

function kindFromBadges(badges: IdentityBadgeKind[]): LabeledWallet['kind'] {
  if (badges.includes('KOL')) return 'kol';
  if (badges.some((b) => b === 'Insider' || b === 'Sniper' || b === 'Dev' || b === 'Team' || b === 'Fresh Wallet')) return 'insider';
  if (badges.some((b) => b === 'Smart Money' || b === 'Whale' || b === 'Fund' || b === 'Market Maker' || b === 'Builder')) return 'smart';
  return 'unknown';
}

/** A resolved identity is "known" when it maps to a real registry entry (not the address fallback). */
function isKnown(id: ResolvedWalletIdentity): boolean {
  return id.identityId != null || Boolean(id.twitterHandle) || (id.badges?.length ?? 0) > 0;
}

function toLabeled(id: ResolvedWalletIdentity): LabeledWallet {
  const kind = kindFromBadges(id.badges ?? []);
  return {
    address: id.address,
    label: id.displayName,
    // A connected Twitter handle without a stronger badge still reads as a KOL-tier wallet.
    kind: kind === 'unknown' && id.twitterHandle ? 'kol' : kind,
    handle: id.twitterHandle ?? null,
    pnlUsd: id.stats30d?.pnlUsd ?? null,
  };
}

// Illustrative label used ONLY when the holders themselves are sample data (no HELIUS_API_KEY),
// so the /sibyl demo still shows a labeled top holder. Clearly marked "(sample)".
const SAMPLE_LABEL: Omit<LabeledWallet, 'address'> = {
  label: 'Cupsey (sample)',
  kind: 'kol',
  handle: 'cupseyy',
  pnlUsd: 1_620_000,
};

export function pointerStatus(): ProviderStatus {
  let count = 0;
  try {
    count = listRegistryStats().walletCount;
  } catch {
    /* registry not bootstrapped yet */
  }
  return {
    name: 'pointer',
    // Our own bundled data — always available, even with zero keys.
    configured: count > 0,
    envVars: ['(bundled KOL directory; DB labels via SUPABASE_SERVICE_ROLE_KEY)'],
    note: count > 0 ? `${count} labeled wallets (KOLs / smart money) with Twitter handles.` : 'Labeled wallets / KOLs / classifications. The proprietary edge.',
  };
}

/**
 * Label a set of holder addresses against the real Pointer identity registry.
 * Returns only the addresses that map to a known wallet (KOL / smart / insider).
 * When every address is unknown AND we're in mock mode (fake holders), emits one
 * clearly-marked sample label so the demo stays alive.
 */
export async function labelWallets(addresses: string[], chain: AppChainId = CHAIN): Promise<LabeledWallet[]> {
  await ensureRegistry();
  const out: LabeledWallet[] = [];
  const seen = new Set<string>();
  for (const address of addresses) {
    if (!address || seen.has(address)) continue;
    seen.add(address);
    const id = resolveWalletIdentity({ chain, address });
    if (isKnown(id)) out.push(toLabeled(id));
  }
  if (out.length === 0 && sibylMockMode() && addresses[0]) {
    return [{ address: addresses[0], ...SAMPLE_LABEL }];
  }
  return out;
}

/**
 * Is a named person (e.g. "ansem") among these holders? Resolves the query to the
 * handle(s) that person goes by via the registry (so "ansem" → "blknoiz06"), then
 * checks each holder's connected Twitter handle. Real when holder addresses are real.
 */
export async function isPersonInTrade(
  query: string,
  holderAddresses: string[],
  chain: AppChainId = CHAIN,
): Promise<{ inTrade: boolean; note: string; matchedAddress?: string }> {
  await ensureRegistry();
  const q = query.toLowerCase().replace(/^@/, '').trim();
  if (!q) return { inTrade: false, note: 'No person specified.' };

  // Build the set of handles this person is known by (displayName or handle match).
  const handles = new Set<string>([q]);
  let displayName = query;
  for (const p of searchIdentities(q, 8)) {
    const dn = p.displayName?.toLowerCase() ?? '';
    const th = p.twitterHandle?.toLowerCase() ?? '';
    if (th === q || dn === q || dn.replace(/\s+/g, '') === q) {
      if (p.twitterHandle) handles.add(th);
      if (p.displayName) displayName = p.displayName;
    }
  }

  if (holderAddresses.length === 0) {
    return { inTrade: false, note: `No holder data to confirm ${displayName}.` };
  }
  for (const address of holderAddresses) {
    const id = resolveWalletIdentity({ chain, address });
    const th = id.twitterHandle?.toLowerCase();
    if (th && handles.has(th)) {
      return {
        inTrade: true,
        note: `${id.displayName} (@${id.twitterHandle}) is holding — wallet ${id.shortAddress}.`,
        matchedAddress: address,
      };
    }
  }
  return { inTrade: false, note: `No ${displayName} wallet among the holders checked.` };
}

/**
 * Alpha-group / Discord-signal mentions Pointer has captured for a token. Not in the
 * identity registry — this is a separate capture-tap source (still mock; wiring the
 * community-mentions store is a later step). Kept mock so the card renders.
 */
export async function getGroupMentions(_mint: string): Promise<KOLMention[]> {
  return [
    { handle: 'sniper_squad', name: 'Sniper Squad', note: '#signals drop, ~5m ago' },
    { handle: 'cented7', name: 'Cented', note: 'holding, called early' },
  ];
}

/** Resolve a handle → Pointer identity (for clickable KOL links). Enriched from the registry when known. */
export async function resolveHandle(handle: string): Promise<{ handle: string; name: string; href: string } | null> {
  const h = handle.replace(/^@/, '').trim();
  if (!h) return null;
  await ensureRegistry();
  const hit = searchIdentities(h, 5).find((p) => p.twitterHandle?.toLowerCase() === h.toLowerCase());
  return { handle: h, name: hit?.displayName ?? h, href: `https://x.com/${encodeURIComponent(h)}` };
}
