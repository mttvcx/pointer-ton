import { toast } from 'sonner';

/** Single id so loading → success swaps in place (Axiom-style). */
export const AUTH_TOAST_ID = 'pointer-auth-toast';

export function toastAuthenticating() {
  toast.loading('Authenticating…', { id: AUTH_TOAST_ID });
}

export function toastAuthenticated() {
  toast.success('Authenticated', { id: AUTH_TOAST_ID });
}

export function toastLoggingOut() {
  toast.loading('Logging out…', { id: AUTH_TOAST_ID });
}

export function toastLoggedOut() {
  toast.success('Logged out', { id: AUTH_TOAST_ID });
}

export function dismissAuthToast() {
  toast.dismiss(AUTH_TOAST_ID);
}
