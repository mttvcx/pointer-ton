import { toast } from 'sonner';
import { Check } from 'lucide-react';

/** Single id so loading → done swaps in place (Axiom-style). */
export const AUTH_TOAST_ID = 'pointer-auth-toast';

/**
 * Auth status toasts deliberately use the neutral app theme (border-subtle on
 * bg-base) — NOT sonner's green `richColors` success style. The loading states
 * keep the default spinner; the done states show a muted check, so sign-in /
 * sign-out reads on-brand instead of a green outline.
 */
const DONE_ICON = <Check className="h-4 w-4 text-fg-secondary" strokeWidth={2.25} aria-hidden />;

export function toastAuthenticating() {
  toast.loading('Authenticating…', { id: AUTH_TOAST_ID });
}

export function toastAuthenticated() {
  toast('Authenticated', { id: AUTH_TOAST_ID, icon: DONE_ICON });
}

export function toastLoggingOut() {
  toast.loading('Logging out…', { id: AUTH_TOAST_ID });
}

export function toastLoggedOut() {
  toast('Logged out', { id: AUTH_TOAST_ID, icon: DONE_ICON });
}

export function dismissAuthToast() {
  toast.dismiss(AUTH_TOAST_ID);
}
