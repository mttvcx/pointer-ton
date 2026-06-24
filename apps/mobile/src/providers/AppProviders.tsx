import React from 'react';
import { PrivyProvider } from '@privy-io/expo';
import { PRIVY_APP_ID, PRIVY_CLIENT_ID } from '../env';

/**
 * Root providers. Uses the SAME Privy App ID as the web app so a user has one
 * identity + the same embedded Solana wallet across web and mobile.
 *
 * NOTE (Phase 0 spike): @privy-io/expo requires native modules → this runs in an
 * EAS dev build, NOT Expo Go. It also needs an "Expo app client" created in the
 * Privy dashboard (its id = EXPO_PUBLIC_PRIVY_CLIENT_ID). Verify the exact
 * provider props against the installed @privy-io/expo version (see README).
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      clientId={PRIVY_CLIENT_ID}
      config={{
        embedded: {
          solana: { createOnLogin: 'users-without-wallets' },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
