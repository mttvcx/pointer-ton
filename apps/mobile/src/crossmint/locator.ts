import type { ChainId } from '../types';

/**
 * Crossmint identifies a token by a "<chain>:<address>" locator. Map our chain
 * ids to Crossmint's blockchain names (BNB Chain is "bsc" in Crossmint).
 * Verify BNB naming against a live staging order before shipping that chain.
 */
const CM_CHAIN: Record<ChainId, string> = {
  sol: 'solana',
  eth: 'ethereum',
  base: 'base',
  bnb: 'bsc',
};

/** Token locator for a coin, e.g. "solana:<mint>" or "base:0x<contract>". */
export function tokenLocator(chain: ChainId | undefined, mint: string): string {
  return `${CM_CHAIN[chain ?? 'sol']}:${mint}`;
}
