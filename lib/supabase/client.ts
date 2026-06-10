'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

let _browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Anon-key Supabase client for the browser. Used for realtime subscriptions
 * and reads of non-RLS-protected tables (tokens, token_market_snapshots,
 * alerts where user_id is null). User-scoped reads/writes always go through
 * API routes that use the service-role admin client.
 *
 * Memoized so repeated calls share one socket / one realtime connection.
 */
export function createClient() {
  if (_browserClient) return _browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing',
    );
  }

  _browserClient = createBrowserClient<Database>(url, anonKey);
  return _browserClient;
}
