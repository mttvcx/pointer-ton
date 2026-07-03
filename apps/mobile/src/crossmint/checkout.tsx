import React, { useEffect } from 'react';
import {
  CrossmintProvider,
  CrossmintCheckoutProvider,
  CrossmintEmbeddedCheckout,
  useCrossmintCheckout,
} from '@crossmint/client-sdk-react-native-ui';
import { CROSSMINT_CLIENT_KEY } from '../env';
import { tokenLocator } from './locator';
import type { ChainId } from '../types';

/**
 * REAL Crossmint embedded checkout — "$X of a token via Apple Pay, delivered to
 * the user's wallet." Loaded ONLY in real mode (native SDK) via a lazy require in
 * ./index, so Expo Go / demo never touches it.
 *
 * The token is a fiat "exact-in" line item (spend $amount, receive as many tokens
 * as that buys); Crossmint runs the fiat→token conversion + on-chain delivery to
 * `recipientWallet` (the user's Privy embedded wallet on that chain).
 */
export type CrossmintCheckoutProps = {
  chain: ChainId | undefined;
  mint: string;
  /** USD amount to spend, as a plain string ("5", "25"). */
  amountUsd: string;
  /** Where the token is delivered — the Privy Solana or EVM wallet for the chain. */
  recipientWallet: string;
  /** Optional; Apple Pay/Google Pay supply the email automatically when omitted. */
  email?: string | null;
  onCompleted: (order: unknown) => void;
};

/** Watches the checkout order and fires once it reaches the delivered/completed phase. */
function CompletionWatcher({ onCompleted }: { onCompleted: (o: unknown) => void }) {
  const { order } = useCrossmintCheckout();
  useEffect(() => {
    const phase = (order as { phase?: string } | undefined)?.phase;
    if (phase === 'completed') onCompleted(order);
  }, [order, onCompleted]);
  return null;
}

export function CrossmintCheckout({ chain, mint, amountUsd, recipientWallet, email, onCompleted }: CrossmintCheckoutProps) {
  return (
    <CrossmintProvider apiKey={CROSSMINT_CLIENT_KEY} consoleLogLevel="silent">
      <CrossmintCheckoutProvider>
        <CrossmintEmbeddedCheckout
          lineItems={{
            tokenLocator: tokenLocator(chain, mint),
            executionParameters: { mode: 'exact-in', amount: amountUsd, maxSlippageBps: '500' },
          }}
          recipient={{ walletAddress: recipientWallet }}
          payment={{
            ...(email ? { receiptEmail: email } : {}),
            crypto: { enabled: false },
            fiat: {
              enabled: true,
              defaultCurrency: 'usd',
              allowedMethods: { applePay: true, googlePay: true, card: true },
            },
            defaultMethod: 'fiat',
          }}
        />
        <CompletionWatcher onCompleted={onCompleted} />
      </CrossmintCheckoutProvider>
    </CrossmintProvider>
  );
}
