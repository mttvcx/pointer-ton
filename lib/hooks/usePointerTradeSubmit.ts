'use client';

import { useCallback } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import type { TradeQuoteApiOk } from '@/lib/trading/quoteTypes';

export function usePointerTradeSubmit() {
  const [tonConnectUI] = useTonConnectUI();

  const submitFromQuote = useCallback(
    async (opts: {
      quote: TradeQuoteApiOk;
      walletAddress: string;
      mint: string;
      getAccessToken: () => Promise<string | null>;
    }): Promise<{ signature: string }> => {
      const { quote, walletAddress, mint, getAccessToken } = opts;
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
    [tonConnectUI],
  );

  return { submitFromQuote };
}
