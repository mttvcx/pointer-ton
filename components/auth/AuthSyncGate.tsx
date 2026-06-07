'use client';

import { useAuthSync } from '@/lib/hooks/useAuthSync';

/**
 * Mounts the Privy → Supabase user sync at the provider level so the DB user
 * row and embedded "Pointer Wallet" are provisioned the moment Privy
 * authenticates — even while the user is still on the landing page. Keeping
 * this above the `(app)` shell avoids the `user_not_synced` race when a fresh
 * sign-in lands somewhere other than the app (or navigates immediately).
 */
export function AuthSyncGate() {
  useAuthSync();
  return null;
}
