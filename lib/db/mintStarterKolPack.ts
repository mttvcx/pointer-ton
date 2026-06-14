import 'server-only';

import type { AppChainId } from '@/lib/chains/appChain';
import { mintMatchesAppChain } from '@/lib/chains/mintKind';
import type { KolHandleRow } from '@/lib/track/kolHandlesLocal';
import {
  chainSupportsStarterKolMint,
  starterKolEntriesForChain,
  starterKolGroupLabel,
  starterKolPackSlug,
} from '@/lib/track/starterKolPacks';
import { insertTrackerGroup, listTrackerGroupsForUser } from '@/lib/db/trackerGroups';
import { upsertTrackedWallet } from '@/lib/db/wallets';
import { normalizeWalletAddressForStorage } from '@/lib/wallets/addressNormalize';

export type MintStarterKolResult = {
  chain: AppChainId;
  imported: number;
  skipped: number;
  kolRows: KolHandleRow[];
  groupId: string;
};

/** Opt-in: add curated KOL watchlist for one chain (SOL or EVM — same 20 on eth/bnb/base). */
export async function mintStarterKolPackForUser(
  userId: string,
  chain: AppChainId,
): Promise<MintStarterKolResult> {
  if (!chainSupportsStarterKolMint(chain)) {
    throw new Error('unsupported_chain');
  }

  const kolRows = starterKolEntriesForChain(chain);
  if (kolRows.length === 0) {
    throw new Error('empty_pack');
  }

  const slug = starterKolPackSlug(chain);
  const groups = await listTrackerGroupsForUser(userId);
  let group = groups.find((g) => g.is_starter && g.slug === slug);
  if (!group) {
    group = await insertTrackerGroup({
      user_id: userId,
      label: starterKolGroupLabel(chain),
      app_chain: chain,
      is_starter: true,
      slug,
      sort_order: chain === 'sol' ? 0 : 10,
    });
  }

  let imported = 0;
  let skipped = 0;
  for (const entry of kolRows) {
    const norm = normalizeWalletAddressForStorage(entry.wallet);
    if (!norm || !mintMatchesAppChain(norm, chain)) {
      skipped += 1;
      continue;
    }
    await upsertTrackedWallet({
      user_id: userId,
      wallet_address: norm,
      label: entry.name,
      notify: true,
      group_id: group.id,
    });
    imported += 1;
  }

  return { chain, imported, skipped, kolRows, groupId: group.id };
}
