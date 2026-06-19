'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { stripPrivyOAuthSearchParams } from '@/lib/auth/oauthPopup';

/** Strip `privy_oauth_*` params so refresh/bookmark stays clean after redirect fallbacks. */
export function PrivyOAuthReturnCleanup() {
  const pathname = usePathname();

  useEffect(() => {
    // Never strip on the OAuth bridge — Privy needs the callback query params to finish login.
    if (pathname?.startsWith('/auth/oauth')) return;
    stripPrivyOAuthSearchParams();
  }, [pathname]);

  return null;
}
