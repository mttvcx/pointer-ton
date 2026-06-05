import type { AppChainId } from '@/lib/chains/appChain';
import { geckoNetworkForAppChain } from '@/lib/chains/evmTokenChain';
import type { GeckoPulseNetwork } from '@/lib/evm/geckoTerminalPulse';
import { pollGeckoNewPools } from '@/lib/evm/geckoTerminalPulse';

export const ETHEREUM_APP_CHAIN: AppChainId = 'eth';

export function ethereumGeckoNetwork(): GeckoPulseNetwork {
  return geckoNetworkForAppChain('eth') ?? 'eth';
}

/** Ingest latest Ethereum pools from Gecko Terminal into `tokens`. */
export async function pollEthereumNewPools(): Promise<number> {
  return pollGeckoNewPools(ethereumGeckoNetwork());
}
