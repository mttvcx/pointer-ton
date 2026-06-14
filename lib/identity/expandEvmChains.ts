import type { AppChainId } from '@/lib/chains/appChain';
import type { IdentitySeedRow } from '@/lib/identity/types';
import { appChainFromSeedChain } from '@/lib/identity/normalize';
import { isValidEvmAddress } from '@/lib/identity/normalize';

const EVM_CHAINS: AppChainId[] = ['eth', 'bnb', 'base'];

function isEvmSeedRow(row: IdentitySeedRow): boolean {
  const chain = appChainFromSeedChain(String(row.chain));
  if (chain === 'eth' || chain === 'bnb' || chain === 'base') return true;
  return isValidEvmAddress(row.address);
}

/** Fan out one EVM wallet row to eth + bnb + base (same 0x on each chain). */
export function expandSeedRowsToEvmChains(
  rows: IdentitySeedRow[],
  chains: AppChainId[] = EVM_CHAINS,
): IdentitySeedRow[] {
  const targets = chains.filter((c) => c === 'eth' || c === 'bnb' || c === 'base');
  if (targets.length === 0) return rows;

  const out: IdentitySeedRow[] = [];
  for (const row of rows) {
    if (!isEvmSeedRow(row)) {
      out.push(row);
      continue;
    }
    for (const chain of targets) {
      const slug = chain === 'eth' ? 'ethereum' : chain;
      out.push({ ...row, chain: slug as IdentitySeedRow['chain'] });
    }
  }
  return out;
}
