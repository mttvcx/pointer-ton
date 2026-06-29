import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

declare global {
  // eslint-disable-next-line no-var
  var __pointerSupabaseAdmin: ReturnType<typeof createSupabaseClient<Database>> | undefined;
}

/**
 * Server-side Supabase clients.
 *
 * Two flavors:
 *
 *   `createServerSupabase()` - anon-key, cookie-aware. Use from RSCs and
 *   route handlers when you want PostgREST + RLS to apply. We don't actually
 *   use Supabase Auth (Privy is the auth source), so this client mainly
 *   exists for forward-compatibility and for reading public tables.
 *
 *   `createAdminSupabase()` - service-role, bypasses RLS. Use from API
 *   routes after the caller has been authenticated via Privy. This is the
 *   client every `lib/db/*.ts` wrapper uses.
 *
 * **Connection pooling:** `@supabase/supabase-js` talks to PostgREST over HTTPS
 * (`NEXT_PUBLIC_SUPABASE_URL`). It does not use the Postgres pooler. For
 * Prisma/Drizzle/raw SQL from serverless, use the Supabase **transaction
 * pooler** (port 6543) — see `.env.example` (`DATABASE_URL` / pooler URL).
 *
 * Never expose the service-role key to the browser. Both functions live
 * server-side only and reference `process.env.SUPABASE_SERVICE_ROLE_KEY`,
 * which Next.js will refuse to inline into client bundles.
 */

export async function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase env vars missing on server');
  }

  // Lazy import: keeps `next/headers` out of the module's import graph so the
  // admin client (which doesn't need cookies) is importable under `node --test`.
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies; this is expected when
          // `createServerSupabase()` is called from an RSC. Middleware
          // (`lib/supabase/middleware.ts`) handles cookie refresh.
        }
      },
    },
  });
}

/** Test seam: inject a fake admin client (e.g. lib/testing/fakeSupabase) so money
 *  modules are driveable under `node --test` without a real database. */
export function __setAdminSupabaseForTest(client: unknown): void {
  globalThis.__pointerSupabaseAdmin = client as ReturnType<typeof createSupabaseClient<Database>>;
}
export function __resetAdminSupabaseForTest(): void {
  globalThis.__pointerSupabaseAdmin = undefined;
}

export function createAdminSupabase() {
  if (globalThis.__pointerSupabaseAdmin) return globalThis.__pointerSupabaseAdmin;

  const url =
    process.env.SUPABASE_SERVICE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase admin env vars missing on server');
  }

  globalThis.__pointerSupabaseAdmin = createSupabaseClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'x-pointer-client': 'admin' },
    },
  });
  return globalThis.__pointerSupabaseAdmin;
}
