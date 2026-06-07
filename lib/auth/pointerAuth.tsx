'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePrivy, useConnectWallet } from '@privy-io/react-auth';
import { TonConnectUIProvider, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';
import { useUIStore } from '@/store/ui';
import { useAuthSyncStore } from '@/store/authSync';
import {
  toastAuthenticated,
  toastLoggedOut,
  toastLoggingOut,
} from '@/lib/auth/authToasts';

function fallbackTonConnectManifestUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const base =
    raw && raw.length > 0 ? raw.replace(/\/$/, '') : 'http://127.0.0.1:3001';
  return `${base}/tonconnect-manifest.json`;
}

const SESSION_KEY = 'pointer_ton_session';
const SYNCED_USER_KEY = 'pointer_auth_synced_user';
/** Set on sign-out so landing Start Trading never silently reuses a Privy cookie session. */
const LANDING_REQUIRE_SIGN_IN_KEY = 'pointer_require_sign_in';
/** Set when Start Trading opens Privy — survives Google OAuth redirects back to `/`. */
const LANDING_ENTER_PENDING_KEY = 'pointer_landing_enter_pending';
/** localStorage backup — OAuth return when sessionStorage is cleared mid-flow. */
const LANDING_ENTER_PENDING_LS = 'pointer_landing_enter_pending_at';
const LANDING_ENTER_PENDING_TTL_MS = 15 * 60 * 1000;

export function clearLandingRequireSignIn() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(LANDING_REQUIRE_SIGN_IN_KEY);
  } catch {
    /* no-op */
  }
}

export function readLandingRequireSignIn(): boolean {
  return readLandingRequireSignInInternal();
}

function readLandingRequireSignInInternal(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(LANDING_REQUIRE_SIGN_IN_KEY) === '1';
  } catch {
    return false;
  }
}

function setLandingRequireSignIn() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(LANDING_REQUIRE_SIGN_IN_KEY, '1');
  } catch {
    /* no-op */
  }
}

export function setLandingEnterPending() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(LANDING_ENTER_PENDING_KEY, '1');
    localStorage.setItem(LANDING_ENTER_PENDING_LS, String(Date.now()));
  } catch {
    /* no-op */
  }
}

export function readLandingEnterPending(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(LANDING_ENTER_PENDING_KEY) === '1') return true;
    const raw = localStorage.getItem(LANDING_ENTER_PENDING_LS);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < LANDING_ENTER_PENDING_TTL_MS;
  } catch {
    return false;
  }
}

export function clearLandingEnterPending() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(LANDING_ENTER_PENDING_KEY);
    localStorage.removeItem(LANDING_ENTER_PENDING_LS);
  } catch {
    /* no-op */
  }
}

export type PointerAuthUser = {
  id: string;
  email?: { address?: string };
  twitter?: { username?: string };
  google?: { name?: string };
};

type Ctx = {
  ready: boolean;
  authenticated: boolean;
  /** True only when Privy has an active session (not legacy TON JWT alone). */
  privyAuthenticated: boolean;
  /** True while a sign-out is tearing down — used to suppress the brief "Connect wallet" flash. */
  loggingOut: boolean;
  /**
   * In-app "Connect wallet" CTA. Chain-aware: SOL/BNB/Base jump straight to a
   * wallet picker via Privy's `useConnectWallet`; TON falls back to the full
   * Privy modal. Use this only inside the authenticated shell.
   */
  login: () => Promise<void>;
  /**
   * Landing / marketing CTA. Opens the Pointer-branded sign-in overlay on the landing page
   * (see `LandingSignInModal`) — not Privy's generic modal.
   */
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  user: PointerAuthUser | null;
  linkedTonAddress: string | null;
};

const PointerAuthContext = createContext<Ctx | null>(null);

export function usePointerAuth() {
  const v = useContext(PointerAuthContext);
  if (!v) throw new Error('usePointerAuth requires PointerAuthProvider');
  return v;
}

function readSession(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSession(t: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (t) sessionStorage.setItem(SESSION_KEY, t);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* no-op */
  }
}

function decodeJwtWallet(token: string): string | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const pad = part.length % 4 === 0 ? '' : '='.repeat(4 - (part.length % 4));
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/') + pad);
    const payload = JSON.parse(json) as { w?: string };
    return typeof payload.w === 'string' ? payload.w : null;
  } catch {
    return null;
  }
}

function InnerAuth({ children }: { children: ReactNode }) {
  const privy = usePrivy();
  const { connectWallet } = useConnectWallet();
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const queryClient = useQueryClient();
  const [localReady, setLocalReady] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const payloadTokenRef = useRef<string | null>(null);
  const syncingRef = useRef(false);
  const privyAuthBaselineRef = useRef<boolean | null>(null);

  const [privyReadyTimedOut, setPrivyReadyTimedOut] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setSessionToken(readSession());
      setLocalReady(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!privy.ready) return;

    if (privyAuthBaselineRef.current === null) {
      privyAuthBaselineRef.current = privy.authenticated;
      return;
    }

    const was = privyAuthBaselineRef.current;
    const now = privy.authenticated;
    if (was === now) return;

    privyAuthBaselineRef.current = now;
    if (now) {
      clearLandingRequireSignIn();
      toastAuthenticated();
    }
  }, [privy.ready, privy.authenticated]);

  useEffect(() => {
    if (privy.ready) {
      setPrivyReadyTimedOut(false);
      return;
    }
    const t = setTimeout(() => setPrivyReadyTimedOut(true), 20_000);
    return () => clearTimeout(t);
  }, [privy.ready]);

  useEffect(() => {
    const id0 =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    payloadTokenRef.current = id0;
    tonConnectUI.setConnectRequestParameters({ state: 'ready', value: { tonProof: id0 } });

    return tonConnectUI.onStatusChange((w) => {
      if (!w) {
        const id =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;
        payloadTokenRef.current = id;
        tonConnectUI.setConnectRequestParameters({ state: 'ready', value: { tonProof: id } });
        return;
      }

      const proof = w.connectItems?.tonProof;
      if (!proof || proof.name !== 'ton_proof' || !('proof' in proof)) return;
      if (syncingRef.current) return;
      syncingRef.current = true;

      void (async () => {
        try {
          const account = w.account;
          const pub = account.publicKey;
          if (!pub) {
            throw new Error('Wallet did not return a public key; try another TON wallet.');
          }
          const body = {
            address: account.address,
            network: account.chain,
            public_key: pub,
            payloadToken: payloadTokenRef.current!,
            proof: {
              ...proof.proof,
              state_init: account.walletStateInit,
            },
          };

          const res = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          });
          const json = (await res.json().catch(() => ({}))) as {
            accessToken?: string;
            message?: string;
          };
          if (!res.ok || !json.accessToken) {
            throw new Error(json.message ?? `sync failed (${res.status})`);
          }
          writeSession(json.accessToken);
          setSessionToken(json.accessToken);
          void queryClient.invalidateQueries();
        } catch (e) {
          const message = e instanceof Error ? e.message : 'unknown error';
          toast.error('TonConnect sign-in failed', { description: message.slice(0, 240) });
        } finally {
          syncingRef.current = false;
        }
      })();
    });
  }, [tonConnectUI, queryClient]);

  const pointerSessionValid = useMemo(() => {
    const token = sessionToken ?? readSession();
    if (!token || !wallet?.account?.address) return false;
    const jwtWallet = decodeJwtWallet(token);
    const wa = normalizeTonAddress(wallet.account.address);
    return Boolean(jwtWallet && wa && normalizeTonAddress(jwtWallet) === wa);
  }, [sessionToken, wallet]);

  const privyAuthenticated =
    privy.authenticated && (privy.ready || privyReadyTimedOut);

  const authenticated =
    privyAuthenticated || Boolean(localReady && pointerSessionValid);

  const login = useCallback(async () => {
    if (!privy.ready) {
      if (!privyReadyTimedOut) {
        toast.message('Loading sign-in…', { description: 'One moment, then try again.' });
        return;
      }
      toast.error('Sign-in provider blocked', {
        description:
          'Allow auth.privy.io in your ad blocker, then refresh. In dashboard.privy.io add http://127.0.0.1:3001 and http://localhost:3001 as allowed origins.',
      });
      return;
    }
    if (!privy.authenticated) {
      try {
        const chain = useUIStore.getState().activeChain;
        if (chain === 'sol' || chain === 'eth' || chain === 'bnb' || chain === 'base') {
          await connectWallet();
          return;
        }
        await privy.login();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not open sign-in';
        toast.error('Sign-in unavailable', { description: message.slice(0, 200) });
      }
      return;
    }
    const chain = useUIStore.getState().activeChain;
    if (chain !== 'ton') {
      return;
    }
    const existing = readSession();
    if (wallet && !existing) {
      await tonConnectUI.disconnect();
    }
    tonConnectUI.openModal();
  }, [
    privy.ready,
    privyReadyTimedOut,
    privy.authenticated,
    privy.login,
    connectWallet,
    tonConnectUI,
    wallet,
  ]);

  const signIn = useCallback(async () => {
    if (!privy.ready) {
      if (!privyReadyTimedOut) {
        toast.message('Loading sign-in…', { description: 'One moment, then try again.' });
        return;
      }
      toast.error('Sign-in provider blocked', {
        description:
          'Allow auth.privy.io in your ad blocker, then refresh. In dashboard.privy.io add this origin as allowed.',
      });
      return;
    }
    try {
      privy.login();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not open sign-in';
      toast.error('Sign-in unavailable', { description: message.slice(0, 200) });
    }
  }, [privy.ready, privy.login, privyReadyTimedOut]);

  const logout = useCallback(async () => {
    setLoggingOut(true);
    toastLoggingOut();
    privyAuthBaselineRef.current = false;
    setLandingRequireSignIn();
    writeSession(null);
    setSessionToken(null);
    try {
      sessionStorage.removeItem(SYNCED_USER_KEY);
    } catch {
      /* no-op */
    }
    useAuthSyncStore.getState().reset();
    queryClient.clear();

    // Never let a hung provider call freeze the "Logging out…" toast. Each
    // teardown step is isolated and time-boxed; local state is already cleared
    // above so the user is effectively logged out regardless of the outcome.
    const withTimeout = (p: Promise<unknown>, ms: number) =>
      Promise.race([
        Promise.resolve(p).catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, ms)),
      ]);

    await withTimeout(tonConnectUI.disconnect(), 4000);
    await withTimeout(privy.logout(), 4000);
    toastLoggedOut();
    setLoggingOut(false);
  }, [privy, tonConnectUI, queryClient]);

  const getAccessToken = useCallback(async () => {
    if (privy.authenticated) {
      const t = await privy.getAccessToken();
      if (t) return t;
    }
    return sessionToken ?? readSession();
  }, [privy.authenticated, privy.getAccessToken, sessionToken]);

  const linkedTonAddress = useMemo(() => {
    const raw = wallet?.account?.address;
    return raw ? normalizeTonAddress(raw) : null;
  }, [wallet?.account?.address]);

  const user = useMemo((): PointerAuthUser | null => {
    if (privy.authenticated && privy.user) {
      return {
        id: privy.user.id,
        email: privy.user.email?.address
          ? { address: privy.user.email.address }
          : undefined,
        twitter: privy.user.twitter?.username
          ? { username: privy.user.twitter.username }
          : undefined,
        google: privy.user.google?.name ? { name: privy.user.google.name } : undefined,
      };
    }
    const raw = wallet?.account?.address;
    if (pointerSessionValid && raw) return { id: raw };
    return null;
  }, [privy.authenticated, privy.user, wallet?.account?.address, pointerSessionValid]);

  /** Shell paints after hydration — never block Topbar/BottomBar on Privy SDK load. */
  const ready = localReady;

  const value = useMemo(
    () => ({
      ready,
      authenticated,
      privyAuthenticated,
      loggingOut,
      login,
      signIn,
      logout,
      getAccessToken,
      user: authenticated ? user : null,
      linkedTonAddress,
    }),
    [
      ready,
      authenticated,
      privyAuthenticated,
      loggingOut,
      login,
      signIn,
      logout,
      getAccessToken,
      user,
      linkedTonAddress,
    ],
  );

  return <PointerAuthContext.Provider value={value}>{children}</PointerAuthContext.Provider>;
}

export function PointerAuthProvider({ children }: { children: ReactNode }) {
  const [manifestUrl, setManifestUrl] = useState(fallbackTonConnectManifestUrl);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const next = `${window.location.origin}/tonconnect-manifest.json`;
    if (next === manifestUrl) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- match host for TonConnect manifest
    setManifestUrl(next);
  }, [manifestUrl]);

  return (
    <TonConnectUIProvider key={manifestUrl} manifestUrl={manifestUrl}>
      <InnerAuth>{children}</InnerAuth>
    </TonConnectUIProvider>
  );
}
