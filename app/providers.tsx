'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'sonner';
import { PointerAuthProvider } from '@/lib/auth/pointerAuth';

/**
 * Client-side providers. Mounted once from `app/layout.tsx`.
 *
 * TanStack Query wraps TonConnect + Pointer session auth so authenticated
 * mutations can update cached server state after TonConnect sign-in.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  if (!appUrl) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-screen items-center justify-center px-6 text-center">
          <div className="max-w-md space-y-3 border border-border-subtle p-6 text-left">
            <p className="text-sm font-medium text-signal-bear">NEXT_PUBLIC_APP_URL is missing.</p>
            <p className="text-xs text-fg-secondary">
              TonConnect needs a public URL for its manifest (use{' '}
              <code className="tabular-nums">http://127.0.0.1:3001</code> with the default dev script). Copy{' '}
              <code className="tabular-nums">.env.example</code> to{' '}
              <code className="tabular-nums">.env.local</code>, set{' '}
              <code className="tabular-nums">NEXT_PUBLIC_APP_URL</code> and{' '}
              <code className="tabular-nums">POINTER_SESSION_SECRET</code>, then restart{' '}
              <code className="tabular-nums">npm run dev</code>.
            </p>
          </div>
        </div>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PointerAuthProvider>
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          richColors
          toastOptions={{
            classNames: {
              toast: 'border border-border-subtle text-fg-primary',
              title: 'text-sm font-medium',
              description: 'text-xs text-fg-secondary',
            },
          }}
        />
      </PointerAuthProvider>
      {process.env.NODE_ENV === 'development' ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  );
}
