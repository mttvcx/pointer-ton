'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { stripPrivyOAuthSearchParams } from '@/lib/auth/oauthPopup';

/**
 * Strip `privy_oauth_*` params so refresh/bookmark stays clean after redirect
 * fallbacks — but ONLY once Privy has actually consumed the code (authenticated).
 *
 * Stripping while an unprocessed `privy_oauth_code` is still in the URL made the
 * FIRST Google login silently fail (Privy never got to read the code), forcing the
 * user to click "Continue with Google" a second time. We now wait for the session
 * to land before cleaning the URL.
 */
export function PrivyOAuthReturnCleanup() {
  const pathname = usePathname();
  const { ready, authenticated } = usePrivy();

  useEffect(() => {
    // Never strip on the OAuth bridge — Privy needs the callback query params to finish login.
    if (pathname?.startsWith('/auth/oauth')) return;
    // Leave any code in place until Privy has consumed it; otherwise the first
    // login attempt fails and the account chooser reappears.
    if (!ready || !authenticated) return;
    stripPrivyOAuthSearchParams();
  }, [pathname, ready, authenticated]);

  return null;
}
