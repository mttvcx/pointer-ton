import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BetaGateClient } from './BetaClient';

export const metadata: Metadata = {
  title: 'Beta access',
  description: 'Enter your Pointer invite code.',
};

export default function BetaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#060708] text-white/50">
          Loading...
        </div>
      }
    >
      <BetaGateClient />
    </Suspense>
  );
}
