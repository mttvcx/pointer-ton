'use client';

import { useState, type ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AppToaster } from '@/components/providers/AppToaster';
import { WalletTrackerToaster } from '@/components/providers/WalletTrackerToaster';
import { ProvisionServerSigner } from '@/components/auth/ProvisionServerSigner';
import { AuthSyncGate } from '@/components/auth/AuthSyncGate';
import { PrivyOAuthReturnCleanup } from '@/components/auth/PrivyOAuthReturnCleanup';
import { PointerSignInHost } from '@/components/auth/PointerSignInHost';
import { SandboxProvider } from '@/components/sandbox/SandboxProvider';
import { PointerAuthProvider } from '@/lib/auth/pointerAuth';
import { FounderBetaDesktopGate } from '@/components/beta/FounderBetaDesktopGate';
import { PRIVY_APP_ID, privyClientConfig } from '@/lib/privy/publicConfig';

/**
 * Client providers: TanStack Query → Privy (same app id as `pointer`) → TonConnect + Pointer session.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? '';

  if (!PRIVY_APP_ID) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-screen items-center justify-center px-6 text-center">
          <div className="max-w-md space-y-3 border border-border-subtle p-6 text-left">
            <p className="text-sm font-medium text-signal-bear">NEXT_PUBLIC_PRIVY_APP_ID is missing.</p>
            <p className="text-xs text-fg-secondary">
              Copy <code className="tabular-nums">.env.example</code> to <code className="tabular-nums">.env.local</code>, set{' '}
              <code className="tabular-nums">NEXT_PUBLIC_PRIVY_APP_ID</code> and{' '}
              <code className="tabular-nums">PRIVY_APP_SECRET</code> from{' '}
              <a
                href="https://dashboard.privy.io"
                className="text-accent-primary underline"
                target="_blank"
                rel="noreferrer"
              >
                dashboard.privy.io
              </a>
              , plus <code className="tabular-nums">POINTER_SESSION_SECRET</code> and{' '}
              <code className="tabular-nums">NEXT_PUBLIC_APP_URL</code> (e.g. http://127.0.0.1:3001), then restart{' '}
              <code className="tabular-nums">npm run dev</code>.
            </p>
          </div>
        </div>
      </QueryClientProvider>
    );
  }

  if (!appUrl) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-screen items-center justify-center px-6 text-center">
          <div className="max-w-md space-y-3 border border-border-subtle p-6 text-left">
            <p className="text-sm font-medium text-signal-bear">NEXT_PUBLIC_APP_URL is missing.</p>
            <p className="text-xs text-fg-secondary">
              Set <code className="tabular-nums">NEXT_PUBLIC_APP_URL=http://127.0.0.1:3001</code> in{' '}
              <code className="tabular-nums">.env.local</code> for TonConnect manifest + absolute links.
            </p>
          </div>
        </div>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider appId={PRIVY_APP_ID} config={privyClientConfig}>
        <PointerAuthProvider>
          <AuthSyncGate />
          <PrivyOAuthReturnCleanup />
          <PointerSignInHost />
          <ProvisionServerSigner />
          <SandboxProvider />
          <FounderBetaDesktopGate>{children}</FounderBetaDesktopGate>
          <WalletTrackerToaster />
          <AppToaster />
        </PointerAuthProvider>
      </PrivyProvider>
      {process.env.NODE_ENV === 'development' &&
      process.env.NEXT_PUBLIC_RQ_DEVTOOLS === '1' ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  );
}
