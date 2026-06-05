import type { AppChainId } from '@/lib/chains/appChain';
import { mintMatchesAppChain } from '@/lib/chains/mintKind';

const ETH_CHAIN: AppChainId = 'eth';

/** Filter synced Privy / linked wallets to Ethereum (`0x`) addresses. */
export function filterEthereumPortfolioWallets<T extends { wallet_address: string }>(rows: T[]): T[] {
  return rows.filter((w) => mintMatchesAppChain(w.wallet_address, ETH_CHAIN));
}
