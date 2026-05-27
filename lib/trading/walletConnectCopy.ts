import type { AppChainId } from '@/lib/chains/appChain';
import { nativeTicker } from '@/lib/chains/nativeCurrency';

/** User-facing copy when no trading wallet is connected. */
export function walletConnectRequiredMessage(chain: AppChainId): string {
  if (chain === 'ton') {
    return 'Connect your TON wallet via TonConnect after sign-in.';
  }
  return 'Connect your Solana wallet after sign-in.';
}

export function walletConnectRequiredTitle(chain: AppChainId): string {
  if (chain === 'ton') {
    return 'Connect TON wallet';
  }
  return `Connect ${nativeTicker(chain)} wallet`;
}

export function viewOnlyWalletTradeMessage(chain: AppChainId): string {
  if (chain === 'ton') {
    return 'Use a non-imported wallet linked in TonConnect to trade.';
  }
  return 'This imported wallet cannot sign swaps in Pointer yet.';
}

export function noWalletLinkedBanner(chain: AppChainId): string {
  if (chain === 'ton') {
    return 'No TON wallet linked. Connect with TonConnect after sign-in.';
  }
  return `No ${nativeTicker(chain)} wallet selected. Add or connect a wallet for this network.`;
}
