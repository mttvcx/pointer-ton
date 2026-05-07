'use client';

/**
 * Pointer TON: user creation + session issuance happen in TonConnect `onStatusChange`
 * (`lib/auth/pointerAuth.tsx`). This hook remains as a no-op for call sites.
 */
export function useAuthSync() {}
