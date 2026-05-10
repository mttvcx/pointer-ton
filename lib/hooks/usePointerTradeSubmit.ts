'use client';

import { useCallback } from 'react';
import bs58 from 'bs58';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { useSignAndSendTransaction, useWallets } from '@privy-io/react-auth/solana';
import type { TradeQuoteApiOk } from '@/lib/trading/quoteTypes';

function swapTxBytesFromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export function usePointerTradeSubmit() {
  const [tonConnectUI] = useTonConnectUI();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { wallets } = useWallets();

  const submitFromQuote = useCallback(
    async (opts: {
      quote: TradeQuoteApiOk;
      walletAddress: string;
      mint: string;
      getAccessToken: () => Promise<string | null>;
    }): Promise<{ signature: string }> => {
      const { quote, walletAddress, mint, getAccessToken } = opts;

      if (quote.chain === 'sol') {
        if (!quote.swapTransaction) {
          throw new Error('missing_sol_swap_transaction');
        }
        const wallet = wallets.find((w) => w.address === walletAddress);
        if (!wallet) {
          throw new Error('sol_wallet_not_found_for_address');
        }
        const txBytes = swapTxBytesFromBase64(quote.swapTransaction);
        const { signature } = await signAndSendTransaction({
          transaction: txBytes,
          wallet,
          chain: 'solana:mainnet',
        });
        const sig58 = bs58.encode(signature);

        const token = await getAccessToken();
        if (!token) throw new Error('no_token');

        const execRes = await fetch('/api/trade/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            chain: 'sol',
            txSignature: sig58,
            userPublicKey: walletAddress,
            mint,
            side: quote.side,
            amountInRaw: quote.summary.amountInRaw,
            amountOutRaw: quote.summary.amountOutRaw ?? '0',
            amountSolNotional: quote.summary.amountSolEstimate,
          }),
        });
        const execJson: unknown = await execRes.json();
        if (!execRes.ok) {
          const msg =
            typeof execJson === 'object' && execJson && 'message' in execJson
              ? String((execJson as { message: unknown }).message)
              : `Execute failed (${execRes.status})`;
          throw new Error(msg);
        }
        return { signature: sig58 };
      }

      if (!quote.tonConnect?.messages?.length) {
        throw new Error('missing_ton_connect_payload');
      }
      const result = await tonConnectUI.sendTransaction({
        validUntil: quote.tonConnect.validUntil,
        messages: quote.tonConnect.messages,
      });

      const token = await getAccessToken();
      if (!token) throw new Error('no_token');

      const execRes = await fetch('/api/trade/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          signedTransaction: result.boc,
          userPublicKey: walletAddress,
          mint,
          side: quote.side,
          amountInRaw: quote.summary.amountInRaw,
          amountOutRaw: quote.summary.amountOutRaw ?? '0',
          amountSolNotional: quote.summary.amountSolEstimate,
        }),
      });
      const execJson: unknown = await execRes.json();
      if (!execRes.ok) {
        const msg =
          typeof execJson === 'object' && execJson && 'message' in execJson
            ? String((execJson as { message: unknown }).message)
            : `Execute failed (${execRes.status})`;
        throw new Error(msg);
      }
      const signature =
        typeof execJson === 'object' && execJson && 'signature' in execJson
          ? String((execJson as { signature: unknown }).signature)
          : '';
      return { signature };
    },
    [tonConnectUI, signAndSendTransaction, wallets],
  );

  return { submitFromQuote };
}
