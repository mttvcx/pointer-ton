'use client';

import { useWalletLabels } from '@/lib/hooks/useWalletLabels';

/** Prefetch wallet labels once the app shell is mounted (authenticated layout only). */
export function WalletLabelsBootstrap() {
  useWalletLabels();
  return null;
}
