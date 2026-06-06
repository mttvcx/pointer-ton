'use client';

export const POINTER_CLIENT_NAV_EVT = 'pointer:client-nav';

export type ClientNavigateDetail = {
  path: string;
  replace?: boolean;
};

/** Client-side route change without a full document reload (dev webpack stays warm). */
export function requestClientNavigate(path: string, opts?: { replace?: boolean }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ClientNavigateDetail>(POINTER_CLIENT_NAV_EVT, {
      detail: { path, replace: opts?.replace },
    }),
  );
}

export function goToPulse(opts?: { replace?: boolean }) {
  requestClientNavigate('/pulse', opts);
}

export function isOnPulseRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/pulse');
}

export function isOnTokenRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/token/');
}
