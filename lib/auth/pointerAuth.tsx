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
import { TonConnectUIProvider, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

const SESSION_KEY = 'pointer_ton_session';

type PointerAuthUser = {
  id: string;
  email?: { address?: string };
  twitter?: { username?: string };
  google?: { name?: string };
};

type Ctx = {
  ready: boolean;
  authenticated: boolean;
  login: () => Promise<void>;
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
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const payloadTokenRef = useRef<string | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setSessionToken(readSession());
      setReady(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

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

  const login = useCallback(async () => {
    const existing = readSession();
    if (wallet && !existing) {
      await tonConnectUI.disconnect();
    }
    tonConnectUI.openModal();
  }, [tonConnectUI, wallet]);

  const logout = useCallback(async () => {
    writeSession(null);
    setSessionToken(null);
    await tonConnectUI.disconnect();
  }, [tonConnectUI]);

  const getAccessToken = useCallback(async () => {
    return sessionToken ?? readSession();
  }, [sessionToken]);

  const linkedTonAddress = useMemo(() => {
    const raw = wallet?.account?.address;
    return raw ? normalizeTonAddress(raw) : null;
  }, [wallet?.account?.address]);

  const user = useMemo((): PointerAuthUser | null => {
    const raw = wallet?.account?.address;
    if (!raw) return null;
    return { id: raw };
  }, [wallet?.account?.address]);

  const tokenMatchesWallet = useMemo(() => {
    const token = sessionToken ?? readSession();
    if (!token || !wallet?.account?.address) return false;
    const jwtWallet = decodeJwtWallet(token);
    const wa = normalizeTonAddress(wallet.account.address);
    return Boolean(jwtWallet && wa && normalizeTonAddress(jwtWallet) === wa);
  }, [sessionToken, wallet]);

  const authenticated = Boolean(ready && wallet && tokenMatchesWallet);

  const value = useMemo(
    () => ({
      ready,
      authenticated,
      login,
      logout,
      getAccessToken,
      user: authenticated ? user : null,
      linkedTonAddress,
    }),
    [ready, authenticated, login, logout, getAccessToken, user, linkedTonAddress],
  );

  return <PointerAuthContext.Provider value={value}>{children}</PointerAuthContext.Provider>;
}

export function PointerAuthProvider({ children }: { children: ReactNode }) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://127.0.0.1:3001';
  const manifestUrl = `${base.replace(/\/$/, '')}/api/tonconnect-manifest`;

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <InnerAuth>{children}</InnerAuth>
    </TonConnectUIProvider>
  );
}
