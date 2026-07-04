import React, { useEffect } from 'react';
import {
  CrossmintProvider,
  CrossmintCheckoutProvider,
  CrossmintEmbeddedCheckout,
  useCrossmintCheckout,
} from '@crossmint/client-sdk-react-native-ui';
import { CROSSMINT_CLIENT_KEY } from '../env';

/**
 * REAL Crossmint checkout — Apple-Pay-ONLY, delivered to the user's wallet.
 *
 * The order is created SERVER-side (onramp orders can't be built client-side), so
 * this renders the *existing-order* flow: we pass the `orderId` + `clientSecret`
 * the backend minted and Crossmint shows just the Apple Pay sheet — NO card form,
 * no "powered by" chrome. Loaded only in real mode via a lazy require in ./index.
 */
export type CrossmintCheckoutProps = {
  orderId: string;
  clientSecret: string;
  /** Fires once the order reaches the delivered/completed phase. */
  onCompleted: (order: unknown) => void;
  /** Fires if the order fails (so the sheet can show an honest error). */
  onFailed?: () => void;
};

/** Watches the order and fires on terminal phases (completed / failed). */
function PhaseWatcher({ onCompleted, onFailed }: { onCompleted: (o: unknown) => void; onFailed?: () => void }) {
  const { order } = useCrossmintCheckout();
  useEffect(() => {
    const phase = (order as { phase?: string } | undefined)?.phase;
    if (phase === 'completed') onCompleted(order);
    else if (phase === 'failed') onFailed?.();
  }, [order, onCompleted, onFailed]);
  return null;
}

export function CrossmintCheckout({ orderId, clientSecret, onCompleted, onFailed }: CrossmintCheckoutProps) {
  return (
    <CrossmintProvider apiKey={CROSSMINT_CLIENT_KEY} consoleLogLevel="silent">
      <CrossmintCheckoutProvider>
        <CrossmintEmbeddedCheckout
          orderId={orderId}
          clientSecret={clientSecret}
          payment={{
            crypto: { enabled: false },
            fiat: {
              enabled: true,
              defaultCurrency: 'usd',
              // Apple Pay ONLY — no card form, no Google Pay chrome.
              allowedMethods: { applePay: true, googlePay: false, card: false },
            },
            defaultMethod: 'fiat',
          }}
        />
        <PhaseWatcher onCompleted={onCompleted} onFailed={onFailed} />
      </CrossmintCheckoutProvider>
    </CrossmintProvider>
  );
}
