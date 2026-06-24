import { getAccessToken, useEmbeddedSolanaWallet } from '@privy-io/expo';
import { VersionedTransaction } from '@solana/web3.js';
import { api } from '../api/client';

function b64ToBytes(b64: string): Uint8Array {
  const bin = global.Buffer.from(b64, 'base64');
  return new Uint8Array(bin);
}
function bytesToB64(bytes: Uint8Array): string {
  return global.Buffer.from(bytes).toString('base64');
}

type QuoteResp = {
  swapTransaction: string | null;
  summary: { amountInRaw: string; amountOutRaw?: string; amountSolEstimate: number };
};

export type TradeParams = {
  mint: string;
  side: 'buy' | 'sell';
  amountSol: number;
  slippageBps?: number;
};

/**
 * Ported from web lib/hooks/usePointerTradeSubmit.ts (embedded-wallet path):
 *   quote  → /api/trade/quote (returns a base64 swap tx)
 *   sign   → Privy embedded Solana wallet signs ONLY (never broadcasts)
 *   execute→ /api/trade/execute relays the signed bytes; the SERVER broadcasts
 *            via lib/solana/broadcast.ts (Helius key never on device, the #8100002 fix).
 *
 * SPIKE-VERIFIED STEP: the exact sign-only call on @privy-io/expo. Confirm against
 * the installed version — it must return a SIGNED VersionedTransaction without
 * broadcasting. If only signAndSend exists, this is the single place to adapt.
 */
export function useTradeSubmit() {
  const solana = useEmbeddedSolanaWallet();

  async function submit(p: TradeParams): Promise<{ signature: string }> {
    const wallet = solana?.wallets?.[0];
    if (!wallet) throw new Error('No embedded Solana wallet');
    const userPublicKey = wallet.address;
    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated');

    // 1) Quote
    const quote = await api<QuoteResp>('/api/trade/quote', {
      token,
      method: 'POST',
      body: {
        side: p.side,
        userPublicKey,
        mint: p.mint,
        amountSol: p.amountSol,
        slippageBps: p.slippageBps ?? 500,
      },
    });
    if (!quote.swapTransaction) throw new Error('No swap transaction in quote');

    // 2) Sign-only (embedded wallet). <-- verify this API in the Privy RN spike.
    const tx = VersionedTransaction.deserialize(b64ToBytes(quote.swapTransaction));
    const provider = await wallet.getProvider();
    const { signedTransaction } = await provider.request({
      method: 'signTransaction',
      params: { transaction: tx },
    });
    const signedBytes: Uint8Array =
      typeof (signedTransaction as VersionedTransaction).serialize === 'function'
        ? (signedTransaction as VersionedTransaction).serialize()
        : (signedTransaction as Uint8Array);

    // 3) Execute (server broadcasts + confirms + records).
    const exec = await api<{ signature: string }>('/api/trade/execute', {
      token,
      method: 'POST',
      body: {
        chain: 'sol',
        signedTransaction: bytesToB64(signedBytes),
        userPublicKey,
        mint: p.mint,
        side: p.side,
        amountInRaw: quote.summary.amountInRaw,
        amountOutRaw: quote.summary.amountOutRaw ?? '0',
        amountSolNotional: quote.summary.amountSolEstimate,
      },
    });
    return { signature: exec.signature };
  }

  return { submit, hasWallet: Boolean(solana?.wallets?.[0]) };
}
