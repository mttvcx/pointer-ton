import React, { useState } from 'react';
import { PrivyProvider } from '@privy-io/expo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PRIVY_APP_ID, PRIVY_CLIENT_ID } from '../env';

/**
 * Root providers. Privy uses the SAME App ID as web → one identity + the same
 * embedded Solana wallet across web and mobile. TanStack Query for caching/polling
 * (matches the web stack).
 *
 * NOTE (Phase 0 spike): @privy-io/expo requires native modules → runs in an EAS dev
 * build, NOT Expo Go, and needs an "Expo app client" id from the Privy dashboard
 * (EXPO_PUBLIC_PRIVY_CLIENT_ID). Verify props against the installed version.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider
        appId={PRIVY_APP_ID}
        clientId={PRIVY_CLIENT_ID}
        config={{ embedded: { solana: { createOnLogin: 'users-without-wallets' } } }}
      >
        {children}
      </PrivyProvider>
    </QueryClientProvider>
  );
}
