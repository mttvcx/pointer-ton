/**
 * Header chain toggle + persisted `activeChain`.
 * Bitcoin L1 is intentionally excluded — spot/perps settle on Solana (and EVM/TON rails),
 * not on a native BTC chain in this product.
 */
export const APP_CHAIN_IDS = ['sol', 'eth', 'bnb', 'base', 'ton'] as const;
export type AppChainId = (typeof APP_CHAIN_IDS)[number];

// Solana is the primary chain — new users land here, not TON.
export const DEFAULT_APP_CHAIN: AppChainId = 'sol';

export function isAppChainId(v: string): v is AppChainId {
  return (APP_CHAIN_IDS as readonly string[]).includes(v);
}

/**
 * When rehydrating persisted UI, map removed / legacy values (e.g. `btc`) to a valid id.
 * Returns `null` if the caller should keep the store default.
 */
export function normalizePersistedAppChain(raw: unknown): AppChainId | null {
  if (raw == null) return null;
  if (typeof raw === 'string' && isAppChainId(raw)) return raw;
  return DEFAULT_APP_CHAIN;
}
