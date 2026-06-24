import { getAccessToken, useEmbeddedSolanaWallet } from '@privy-io/expo';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { api } from '../api/client';
import { SOLANA_RPC_URL } from '../env';

function b64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(global.Buffer.from(b64, 'base64'));
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
 * Mobile trade flow (ported from web lib/hooks/usePointerTradeSubmit.ts, adapted to
 * Privy Expo's constraint — it only exposes signAndSendTransaction, no sign-only):
 *
 *   quote   → /api/trade/quote (base64 swap tx)
 *   sign+send → Privy embedded wallet signs AND broadcasts through a Connection we
 *               point at the backend's auth-gated /api/solana/rpc proxy, so the
 *               private Helius key never ships in the app (no #8100002, no key leak).
 *   record  → /api/trade/execute with the resulting txSignature (the external-wallet
 *             path — server records the trade; it does NOT re-broadcast).
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

    // 2) Sign + broadcast via the auth-gated proxy connection (key stays server-side).
    const connection = new Connection(SOLANA_RPC_URL, {
      commitment: 'confirmed',
      httpHeaders: { Authorization: `Bearer ${token}` },
    });
    const tx = VersionedTransaction.deserialize(b64ToBytes(quote.swapTransaction));
    const provider = await wallet.getProvider();
    const { signature } = await provider.request({
      method: 'signAndSendTransaction',
      params: { transaction: tx, connection },
    });

    // 3) Record (does not re-broadcast — Privy already sent it).
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

  return { submit, hasWallet: Boolean(solana?.wallets?.[0]) };
}
