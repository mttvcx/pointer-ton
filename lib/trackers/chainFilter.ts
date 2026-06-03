import type { AppChainId } from '@/lib/chains/appChain';
import { mintMatchesAppChain } from '@/lib/chains/mintKind';
import type { TrackedWalletRow } from '@/lib/db/wallets';

/** Chain filter — EVM wallets in a group only show on that group's chain rail. */
export function trackedWalletMatchesAppChain(
  row: Pick<TrackedWalletRow, 'wallet_address' | 'group_id'>,
  chain: AppChainId,
  groupChainById: Map<string, AppChainId>,
): boolean {
  if (!mintMatchesAppChain(row.wallet_address, chain)) return false;
  if (!row.group_id) return true;
  const groupChain = groupChainById.get(row.group_id);
  if (!groupChain) return true;
  if (chain === 'bnb' || chain === 'base') return groupChain === chain;
  return groupChain === chain;
}
