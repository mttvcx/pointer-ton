import 'server-only';

import { createPublicClient, http } from 'viem';
import { EVM_VIEM_CHAIN, evmTradeRpcUrl, type EvmTradeChain } from '@/lib/evm/evmTradeChains';

/**
 * Server-side confirmation of an EVM swap tx before we record it / credit points.
 * Prevents a client from POSTing a fake or someone-else's hash to farm rewards:
 * the receipt must exist, have succeeded, and have been sent FROM the claimed
 * wallet. Returns null on any RPC error (caller records best-effort, no points).
 */
export async function verifyEvmSwapTx(
  chain: EvmTradeChain,
  txHash: string,
  expectedFrom: string,
): Promise<{ ok: boolean; from: string; to: string | null } | null> {
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return { ok: false, from: '', to: null };
  try {
    const client = createPublicClient({
      chain: EVM_VIEM_CHAIN[chain],
      transport: http(evmTradeRpcUrl(chain)),
    });
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    const from = (receipt.from ?? '').toLowerCase();
    const ok = receipt.status === 'success' && from === expectedFrom.trim().toLowerCase();
    return { ok, from, to: (receipt.to ?? null) as string | null };
  } catch {
    return null;
  }
}
