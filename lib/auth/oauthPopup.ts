'use client';

export const POINTER_OAUTH_MESSAGE = 'pointer:oauth-complete' as const;

export type OAuthPopupProvider = 'google' | 'twitter';

function popupOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

/**
 * Privy headless OAuth must finish in the same window that started the flow.
 * Popups with `window.opener` never auto-complete (Privy skips `popupFlow`), which
 * caused the Google account-chooser loop when initOAuth ran again on return.
 */
export function loginWithOAuthRedirect(provider: OAuthPopupProvider): void {
  if (typeof window === 'undefined') return;
  const origin = popupOrigin();
  window.location.assign(`${origin}/auth/oauth?provider=${encodeURIComponent(provider)}`);
}

/** @deprecated Use {@link loginWithOAuthRedirect} — kept as alias for call sites. */
export function loginWithOAuthPopup(provider: OAuthPopupProvider): Promise<void> {
  loginWithOAuthRedirect(provider);
  return new Promise(() => {
    /* page navigates away */
  });
}

/** Remove Privy OAuth query junk after a full-page redirect fallback. */
export function stripPrivyOAuthSearchParams(): boolean {
  if (typeof window === 'undefined') return false;
  const url = new URL(window.location.href);
  const keys = ['privy_oauth_state', 'privy_oauth_provider', 'privy_oauth_code'];
  if (!keys.some((k) => url.searchParams.has(k))) return false;
  for (const k of keys) url.searchParams.delete(k);
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, '', next);
  return true;
}
