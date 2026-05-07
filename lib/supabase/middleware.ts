import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './types';

/**
 * Refreshes Supabase auth cookies on every request. Pointer authenticates via
 * Privy (not Supabase Auth) so this middleware is largely a no-op today, but
 * we wire it up now so:
 *
 *   - if we ever enable Supabase Third-Party Auth with Privy JWTs, the
 *     cookie plumbing is already in place
 *   - server-side `createServerSupabase()` calls always see a fresh session
 *
 * Mounted from `middleware.ts` at the project root.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Touch the session so the cookie refresh path executes.
  await supabase.auth.getUser();

  return response;
}
