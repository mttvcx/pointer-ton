import 'server-only';

import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';

const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL?.trim() || 'https://cloudflare-eth.com'),
});

/** Resolve a `.eth` name to a checksummed `0x` address (mainnet). */
export async function resolveEnsToAddress(name: string): Promise<`0x${string}` | null> {
  const raw = name.trim().toLowerCase();
  if (!raw.endsWith('.eth')) return null;
  try {
    return await client.getEnsAddress({ name: normalize(raw) });
  } catch {
    return null;
  }
}
