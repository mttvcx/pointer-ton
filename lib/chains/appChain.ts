export const APP_CHAIN_IDS = ['ton', 'sol', 'bnb', 'base'] as const;
export type AppChainId = (typeof APP_CHAIN_IDS)[number];

export const DEFAULT_APP_CHAIN: AppChainId = 'ton';

export function isAppChainId(v: string): v is AppChainId {
  return (APP_CHAIN_IDS as readonly string[]).includes(v);
}
