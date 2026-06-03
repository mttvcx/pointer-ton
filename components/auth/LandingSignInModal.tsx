'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  useConnectWallet,
  useLoginWithEmail,
  useLoginWithOAuth,
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
import { dismissAuthToast, toastAuthenticating } from '@/lib/auth/authToasts';
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
    <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function PhantomMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0">
      <circle cx="12" cy="12" r="10" fill="#AB9FF2" />
      <ellipse cx="9.5" cy="11" rx="1.2" ry="1.6" fill="#1C1C1C" />
      <ellipse cx="14.5" cy="11" rx="1.2" ry="1.6" fill="#1C1C1C" />
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
        'btn-press focus-ring relative flex w-full items-center gap-3 rounded-xl border border-border-subtle bg-bg-sunken/80 px-4 py-3',
        'text-[14px] font-medium text-fg-primary transition hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50',
        badge && 'pr-24',
      )}
    >
      {children}
      {badge ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-border-subtle bg-bg-raised px-1.5 py-0.5 text-[10px] font-medium text-fg-muted">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function LandingSignInModal({ open, onClose }: LandingSignInModalProps) {
  const router = useRouter();
  const { ready: privyReady, authenticated: privyAuthenticated } = usePrivy();
  const [step, setStep] = useState<Step>('methods');
  const [mode, setMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState<'google' | 'email' | 'otp' | 'wallet' | null>(null);
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
    router.push('/pulse');
  }, [onClose, router]);

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

  const { initOAuth, loading: oauthLoading } = useLoginWithOAuth({
    onComplete: onLoginComplete,
    onError: onLoginError,
  });
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
    if (privyAuthenticated) return;
    clearLandingEnterPending();
  }, [open, privyAuthenticated]);

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
  const googleBusy = busy === 'google' || oauthLoading;

  async function onGoogle() {
    if (!privyReady || oauthLoading) return;
    setBusy('google');
    setLandingEnterPending();
    toastAuthenticating();
    try {
      localStorage.setItem(LAST_AUTH_KEY, 'google');
    } catch {
      /* no-op */
    }
    try {
      await initOAuth({ provider: 'google' });
    } catch {
      setBusy(null);
      clearLandingEnterPending();
      dismissAuthToast();
      toast.error('Google sign-in unavailable');
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
    connectWallet({ walletChainType: 'solana-only' });
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
        className="relative w-full max-w-[440px] animate-in zoom-in-95 fade-in overflow-hidden rounded-2xl border border-border-subtle bg-bg-base shadow-[0_32px_80px_-24px_rgba(0,0,0,0.9)] duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-6 pb-2 pt-5">
          <h2 id="landing-sign-in-title" className="text-center text-[22px] font-semibold tracking-tight text-fg-primary">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-press focus-ring absolute right-4 top-4 rounded-lg p-1.5 text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-5 px-6 pb-6 pt-3">
          {step === 'methods' ? (
            <>
              <form onSubmit={(e) => void onSendEmail(e)} className="space-y-4">
                <label className="block space-y-2" htmlFor="landing-email">
                  <span className="text-[13px] font-medium text-fg-secondary">Email</span>
                  <input
                    id="landing-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email"
                    className="focus-ring w-full rounded-xl border border-border-subtle bg-bg-sunken/70 px-4 py-3 text-[14px] text-fg-primary outline-none placeholder:text-fg-muted/50"
                  />
                </label>

                <button
                  type="submit"
                  disabled={!email.trim() || emailSending || !privyReady}
                  className={cn(
                    'btn-press focus-ring flex w-full items-center justify-center rounded-xl py-3 text-[14px] font-semibold text-white',
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
                  <div className="w-full border-t border-border-subtle" />
                </div>
                <p className="relative mx-auto w-fit bg-bg-base px-3 text-[12px] text-fg-muted">
                  Or {mode === 'signup' ? 'Sign Up' : 'Log in'}
                </p>
              </div>

              <div className="space-y-2.5">
                <SocialButton
                  onClick={() => void onGoogle()}
                  disabled={googleBusy || !privyReady}
                  badge={lastAuth === 'google' ? 'Last used' : undefined}
                >
                  {googleBusy ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <GoogleMark />}
                  <span className="flex-1 text-left">Continue with Google</span>
                </SocialButton>

                <SocialButton
                  onClick={onPhantom}
                  disabled={busy === 'wallet' || !privyReady}
                  badge={lastAuth === 'phantom' ? 'Last used' : undefined}
                >
                  {busy === 'wallet' ? (
                    <Loader2 className="h-[18px] w-[18px] animate-spin" />
                  ) : (
                    <PhantomMark />
                  )}
                  <span className="flex-1 text-left">Connect with Phantom</span>
                </SocialButton>
              </div>

              <p className="text-center text-[13px] text-fg-muted">
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
            <form onSubmit={(e) => void onVerifyOtp(e)} className="space-y-4">
              <p className="text-center text-[13px] leading-relaxed text-fg-secondary">
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
                className="focus-ring w-full rounded-xl border border-border-subtle bg-bg-sunken/70 px-4 py-3 text-center text-lg font-semibold tabular-nums tracking-[0.25em] text-fg-primary outline-none placeholder:text-fg-muted/40"
              />
              <button
                type="submit"
                disabled={!otp.trim() || busy === 'otp'}
                className={cn(
                  'btn-press focus-ring flex w-full items-center justify-center rounded-xl py-3 text-[14px] font-semibold text-white',
                  'bg-gradient-to-b from-[#6b77f7] to-[#5865F2]',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                {busy === 'otp' ? 'Verifying…' : 'Continue'}
              </button>
              <button
                type="button"
                onClick={() => setStep('methods')}
                className="w-full text-center text-[13px] font-medium text-fg-muted hover:text-fg-secondary"
              >
                Back
              </button>
            </form>
          )}
        </div>

        {step === 'methods' ? (
          <p className="border-t border-border-subtle px-6 py-4 text-center text-[11px] leading-relaxed text-fg-muted">
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
