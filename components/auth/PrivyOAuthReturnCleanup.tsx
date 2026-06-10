'use client';

import { useEffect } from 'react';
import { stripPrivyOAuthSearchParams } from '@/lib/auth/oauthPopup';

/** Strip `privy_oauth_*` params so refresh/bookmark stays clean after redirect fallbacks. */
export function PrivyOAuthReturnCleanup() {
  useEffect(() => {
    stripPrivyOAuthSearchParams();
  }, []);
  return null;
}
