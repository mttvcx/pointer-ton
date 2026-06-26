import { useAuth } from '../auth';
import { api } from '../api/client';
import { SOLANA_RPC_URL } from '../env';

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
 * Mobile trade flow (ported from web usePointerTradeSubmit, adapted to Privy Expo
 * which only does signAndSend — no sign-only):
 *   quote     → /api/trade/quote (base64 swap tx)
 *   sign+send → auth.signAndSend() — the embedded wallet broadcasts through a
 *               Connection pointed at the auth-gated /api/solana/rpc proxy, so the
 *               Helius key never ships in the app (no #8100002, no key leak).
 *   record    → /api/trade/execute (txSignature path).
 */
export function useTradeSubmit() {
  const auth = useAuth();

  async function submit(p: TradeParams): Promise<{ signature: string }> {
    if (!auth.walletAddress) throw new Error('No wallet');
    const token = await auth.getToken();
    if (!token) throw new Error('Not authenticated');
    const userPublicKey = auth.walletAddress;

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

    const signature = await auth.signAndSend(quote.swapTransaction, SOLANA_RPC_URL, token);

    await api('/api/trade/execute', {
      token,
      method: 'POST',
      body: {
        chain: 'sol',
        txSignature: signature,
        userPublicKey,
        mint: p.mint,
        side: p.side,
        amountInRaw: quote.summary.amountInRaw,
        amountOutRaw: quote.summary.amountOutRaw ?? '0',
        amountSolNotional: quote.summary.amountSolEstimate,
      },
    });
    return { signature };
  }

  return { submit, hasWallet: Boolean(auth.walletAddress) && !auth.demo };
}
