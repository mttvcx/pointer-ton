'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  useConnectWallet,
  useLoginWithEmail,
  usePrivy,
} from '@privy-io/react-auth';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  clearLandingEnterPending,
  clearLandingRequireSignIn,
  readLandingEnterPending,
  setLandingEnterPending,
} from '@/lib/auth/pointerAuth';
import { dismissAuthToast, toastAuthenticated, toastAuthenticating } from '@/lib/auth/authToasts';
import { loginWithOAuthPopup } from '@/lib/auth/oauthPopup';
import { cn } from '@/lib/utils/cn';

type Step = 'methods' | 'otp';
type AuthMode = 'signup' | 'login';

const LAST_AUTH_KEY = 'pointer_last_auth_method';

type LandingSignInModalProps = {
  open: boolean;
  onClose: () => void;
};

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function XMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  );
}

/** Official Phantom mark — purple gradient tile + ghost. */
function PhantomMark() {
  return (
    <svg aria-hidden viewBox="0 0 128 128" className="h-4 w-4 shrink-0">
      <rect width="128" height="128" rx="30" fill="url(#phantom-grad)" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M110.584 64.914h-11.442c0-23.149-18.97-41.914-42.37-41.914-23.111 0-41.9 18.306-42.36 41.058-.476 23.523 21.631 43.942 45.157 43.942h3.014c20.76 0 48.562-16.186 52.906-35.935.803-3.651-2.069-7.151-4.905-7.151ZM45.854 66.972c0 3.119-2.55 5.668-5.669 5.668-3.119 0-5.668-2.549-5.668-5.668v-9.17c0-3.119 2.549-5.668 5.668-5.668 3.119 0 5.669 2.549 5.669 5.668v9.17Zm20.389 0c0 3.119-2.549 5.668-5.668 5.668-3.12 0-5.669-2.549-5.669-5.668v-9.17c0-3.119 2.549-5.668 5.669-5.668 3.119 0 5.668 2.549 5.668 5.668v9.17Z"
        fill="#FFFDF8"
      />
      <defs>
        <linearGradient id="phantom-grad" x1="64" y1="0" x2="64" y2="128" gradientUnits="userSpaceOnUse">
          <stop stopColor="#534BB1" />
          <stop offset="1" stopColor="#551BF9" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function SocialButton({
  children,
  onClick,
  disabled,
  badge,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'btn-press focus-ring relative flex w-full items-center gap-2.5 rounded-lg border border-border-subtle/70 bg-bg-sunken/50 px-3 py-2.5',
        'text-[13px] font-medium text-fg-secondary transition hover:border-border-subtle hover:bg-bg-hover hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-50',
        badge && 'pr-20',
      )}
    >
      {children}
      {badge ? (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border-subtle/70 bg-bg-raised px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-fg-muted">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function LandingSignInModal({ open, onClose }: LandingSignInModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready: privyReady, authenticated: privyAuthenticated } = usePrivy();
  const [step, setStep] = useState<Step>('methods');
  const [mode, setMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState<'google' | 'twitter' | 'email' | 'otp' | 'wallet' | null>(null);
  const [lastAuth, setLastAuth] = useState<string | null>(null);

  useEffect(() => {
    try {
      setLastAuth(localStorage.getItem(LAST_AUTH_KEY));
    } catch {
      setLastAuth(null);
    }
  }, [open]);

  const enterApp = useCallback(() => {
    clearLandingEnterPending();
    clearLandingRequireSignIn();
    onClose();
    dismissAuthToast();
    toastAuthenticated();
    if (pathname === '/') {
      router.push('/pulse');
    }
  }, [onClose, pathname, router]);

  const onLoginComplete = useCallback(() => {
    setBusy(null);
    enterApp();
  }, [enterApp]);

  const onLoginError = useCallback(() => {
    setBusy(null);
    clearLandingEnterPending();
    dismissAuthToast();
    toast.error('Sign-in failed', { description: 'Try again or use another method.' });
  }, []);

  const { sendCode, loginWithCode, state: emailState } = useLoginWithEmail({
    onComplete: onLoginComplete,
    onError: onLoginError,
  });
  const { connectWallet } = useConnectWallet({
    onSuccess: () => {
      setBusy(null);
      try {
        localStorage.setItem(LAST_AUTH_KEY, 'phantom');
      } catch {
        /* no-op */
      }
      enterApp();
    },
    onError: () => {
      setBusy(null);
      toast.error('Wallet connection failed');
    },
  });

  useEffect(() => {
    if (!open) return;
    setLandingEnterPending();
  }, [open]);

  useEffect(() => {
    if (open) return;
    // Don't clear the pending-enter flag while Privy is still restoring its
    // session. On a Google OAuth return the page remounts with the modal
    // closed and `authenticated` momentarily false; clearing here would strip
    // the flag the landing redirect needs, stranding the user on `/`.
    if (!privyReady) return;
    if (privyAuthenticated) return;
    clearLandingEnterPending();
  }, [open, privyReady, privyAuthenticated]);

  /** Privy OAuth redirect often remounts before `onComplete` fires — watch session here too. */
  useEffect(() => {
    if (!privyReady || !privyAuthenticated) return;
    if (!open && !readLandingEnterPending()) return;
    onLoginComplete();
  }, [open, privyReady, privyAuthenticated, onLoginComplete]);

  useEffect(() => {
    if (!open) {
      setStep('methods');
      setEmail('');
      setOtp('');
      setBusy(null);
      setMode('signup');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const title = step === 'otp' ? 'Check your email' : mode === 'signup' ? 'Sign Up' : 'Log in';
  const emailSending = busy === 'email' || emailState.status === 'sending-code';
  const googleBusy = busy === 'google';
  const twitterBusy = busy === 'twitter';

  async function onGoogle() {
    if (!privyReady || googleBusy) return;
    setBusy('google');
    setLandingEnterPending();
    toastAuthenticating();
    try {
      localStorage.setItem(LAST_AUTH_KEY, 'google');
    } catch {
      /* no-op */
    }
    try {
      await loginWithOAuthPopup('google');
      onLoginComplete();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'popup_blocked') {
        toast.error('Allow popups to sign in with Google', {
          description: 'Or use email / Phantom below.',
        });
      } else {
        toast.error('Google sign-in failed', { description: 'Try again or use another method.' });
      }
      setBusy(null);
      clearLandingEnterPending();
      dismissAuthToast();
    }
  }

  async function onTwitter() {
    if (!privyReady || twitterBusy) return;
    setBusy('twitter');
    setLandingEnterPending();
    toastAuthenticating();
    try {
      localStorage.setItem(LAST_AUTH_KEY, 'twitter');
    } catch {
      /* no-op */
    }
    try {
      await loginWithOAuthPopup('twitter');
      onLoginComplete();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'popup_blocked') {
        toast.error('Allow popups to sign in with X', {
          description: 'Or use email / Phantom below.',
        });
      } else {
        toast.error('X sign-in failed', { description: 'Try again or use another method.' });
      }
      setBusy(null);
      clearLandingEnterPending();
      dismissAuthToast();
    }
  }

  async function onSendEmail(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !privyReady) return;
    setBusy('email');
    try {
      await sendCode({ email: trimmed });
      setStep('otp');
      setOtp('');
    } catch {
      toast.error('Could not send code', { description: 'Check the email and try again.' });
    } finally {
      setBusy(null);
    }
  }

  async function onVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.trim();
    if (!code) return;
    setBusy('otp');
    setLandingEnterPending();
    toastAuthenticating();
    try {
      localStorage.setItem(LAST_AUTH_KEY, 'email');
    } catch {
      /* no-op */
    }
    try {
      await loginWithCode({ code });
    } catch {
      setBusy(null);
      dismissAuthToast();
      toast.error('Invalid code', { description: 'Check your email and try again.' });
    }
  }

  function onPhantom() {
    if (!privyReady) return;
    setBusy('wallet');
    setLandingEnterPending();
    toastAuthenticating();
    // Restrict the Privy modal to Phantom only so it routes straight to the
    // Phantom extension (Axiom-style) instead of showing the full picker
    // (Solflare / Backpack / MetaMask / OKX …).
    connectWallet({ walletChainType: 'solana-only', walletList: ['phantom'] });
  }

  return (
    <div className="fixed inset-0 z-[560] flex animate-in fade-in items-center justify-center p-4 duration-200">
      <button
        type="button"
        className="absolute inset-0 bg-black/90 backdrop-blur-[2px]"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="landing-sign-in-title"
        className="relative w-full max-w-[360px] animate-in zoom-in-95 fade-in overflow-hidden rounded-xl border border-border-subtle bg-bg-base shadow-[0_32px_80px_-24px_rgba(0,0,0,0.9)] duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-5 pb-1 pt-4">
          <h2 id="landing-sign-in-title" className="text-center text-[17px] font-semibold tracking-tight text-fg-primary">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-press focus-ring absolute right-3 top-3 rounded-md p-1 text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-4 px-5 pb-5 pt-2">
          {step === 'methods' ? (
            <>
              <form onSubmit={(e) => void onSendEmail(e)} className="space-y-3">
                <label className="block space-y-1.5" htmlFor="landing-email">
                  <span className="text-[12px] font-medium text-fg-secondary">Email</span>
                  <input
                    id="landing-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email"
                    className="focus-ring w-full rounded-lg border border-border-subtle bg-bg-sunken/70 px-3 py-2.5 text-[13px] text-fg-primary outline-none placeholder:text-fg-muted/50"
                  />
                </label>

                <button
                  type="submit"
                  disabled={!email.trim() || emailSending || !privyReady}
                  className={cn(
                    'btn-press focus-ring flex w-full items-center justify-center rounded-lg py-2.5 text-[13px] font-semibold text-white',
                    'bg-gradient-to-b from-[#6b77f7] to-[#5865F2]',
                    'shadow-[0_4px_14px_-4px_rgba(88,101,242,0.55),inset_0_1px_0_rgb(255_255_255/0.16)]',
                    'transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  {emailSending ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'signup' ? 'Sign Up' : 'Log in'}
                </button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border-subtle/70" />
                </div>
                <p className="relative mx-auto w-fit bg-bg-base px-3 text-[11px] text-fg-muted">
                  Or {mode === 'signup' ? 'Sign Up' : 'Log in'}
                </p>
              </div>

              <div className="space-y-2">
                <SocialButton
                  onClick={() => void onGoogle()}
                  disabled={googleBusy || !privyReady}
                  badge={lastAuth === 'google' ? 'Last used' : undefined}
                >
                  {googleBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleMark />}
                  <span className="flex-1 text-left">Continue with Google</span>
                </SocialButton>

                <SocialButton
                  onClick={() => void onTwitter()}
                  disabled={twitterBusy || !privyReady}
                  badge={lastAuth === 'twitter' ? 'Last used' : undefined}
                >
                  {twitterBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XMark />}
                  <span className="flex-1 text-left">Continue with X</span>
                </SocialButton>

                <SocialButton
                  onClick={onPhantom}
                  disabled={busy === 'wallet' || !privyReady}
                  badge={lastAuth === 'phantom' ? 'Last used' : undefined}
                >
                  {busy === 'wallet' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PhantomMark />
                  )}
                  <span className="flex-1 text-left">Connect with Phantom</span>
                </SocialButton>
              </div>

              <p className="text-center text-[12px] text-fg-muted">
                {mode === 'signup' ? (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="font-medium text-accent-primary hover:underline"
                    >
                      Log in
                    </button>
                  </>
                ) : (
                  <>
                    Don&apos;t have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('signup')}
                      className="font-medium text-accent-primary hover:underline"
                    >
                      Sign up
                    </button>
                  </>
                )}
              </p>
            </>
          ) : (
            <form onSubmit={(e) => void onVerifyOtp(e)} className="space-y-3">
              <p className="text-center text-[12px] leading-relaxed text-fg-secondary">
                We sent a code to{' '}
                <span className="font-medium text-fg-primary">{email}</span>
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter code"
                className="focus-ring w-full rounded-lg border border-border-subtle bg-bg-sunken/70 px-3 py-2.5 text-center text-base font-semibold tabular-nums tracking-[0.25em] text-fg-primary outline-none placeholder:text-fg-muted/40"
              />
              <button
                type="submit"
                disabled={!otp.trim() || busy === 'otp'}
                className={cn(
                  'btn-press focus-ring flex w-full items-center justify-center rounded-lg py-2.5 text-[13px] font-semibold text-white',
                  'bg-gradient-to-b from-[#6b77f7] to-[#5865F2]',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                {busy === 'otp' ? 'Verifying…' : 'Continue'}
              </button>
              <button
                type="button"
                onClick={() => setStep('methods')}
                className="w-full text-center text-[12px] font-medium text-fg-muted hover:text-fg-secondary"
              >
                Back
              </button>
            </form>
          )}
        </div>

        {step === 'methods' ? (
          <p className="border-t border-border-subtle/70 px-5 py-3 text-center text-[10px] leading-relaxed text-fg-muted">
            By creating an account, you agree to Pointer&apos;s{' '}
            <a href="/privacy" className="text-accent-primary hover:underline">
              Privacy Policy
            </a>{' '}
            and{' '}
            <a href="/terms" className="text-accent-primary hover:underline">
              Terms of Service
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}
