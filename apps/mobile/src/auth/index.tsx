import React, { createContext, useContext } from 'react';
import { PRIVY_APP_ID } from '../env';

/**
 * Auth abstraction so the app runs in TWO modes:
 *  - DEMO (default when no Privy app id, or EXPO_PUBLIC_DEMO=1): no Privy at all →
 *    runs in plain EXPO GO (no dev build, no accounts). Public data (Pulse, tokens)
 *    is real; wallet/trade/funding are stubbed so you can SEE the app instantly.
 *  - REAL: Privy embedded wallet + the live money path (needs an EAS dev build).
 *
 * Screens use useAuth() — never @privy-io/expo directly — so the Privy native
 * modules are only loaded in REAL mode (lazy require below).
 */
export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1' || !PRIVY_APP_ID;

export type AuthState = {
  ready: boolean;
  isLoggedIn: boolean;
  /** Embedded Solana wallet address (for SOL tokens). */
  walletAddress: string | null;
  /** Embedded EVM wallet address (for ETH / Base / BNB tokens). Both are created
   *  automatically at signup so the one account trades on every chain. */
  evmAddress: string | null;
  demo: boolean;
  getToken: () => Promise<string | null>;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  /** Apple/Google OAuth via Privy (REAL only; no-op in demo). */
  loginWithOAuth: (provider: 'google' | 'apple') => Promise<void>;
  /** The connected X/Twitter handle (from Privy linked accounts), or null. */
  twitterHandle: string | null;
  /** The connected X/Twitter profile picture URL, or null (used as the avatar). */
  avatarUrl: string | null;
  /** Link an X/Twitter account to the signed-in user; resolves with the handle
   *  (REAL only; no-op → null in demo). */
  linkTwitter: () => Promise<string | null>;
  logout: () => Promise<void>;
  /** Sign + broadcast a base64 tx via the RPC the app provides (REAL only). */
  signAndSend: (txBase64: string, rpcUrl: string, token: string) => Promise<string>;
};

const Ctx = createContext<AuthState | null>(null);
export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside provider');
  return v;
}
export const AuthContext = Ctx;

/* Module token getter so the API layer stays Privy-free. */
let tokenGetter: () => Promise<string | null> = async () => null;
export function registerTokenGetter(fn: () => Promise<string | null>) {
  tokenGetter = fn;
}
export function authToken(): Promise<string | null> {
  return tokenGetter();
}

/** Demo provider — zero Privy. Auto "logged in" with a demo wallet. */
function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  const value: AuthState = {
    ready: true,
    isLoggedIn: true,
    walletAddress: 'Demo1111111111111111111111111111111111111111',
    evmAddress: '0xDeM00000000000000000000000000000000000000',
    demo: true,
    getToken: async () => null,
    sendCode: async () => {},
    verifyCode: async () => {},
    loginWithOAuth: async () => {},
    twitterHandle: null,
    avatarUrl: null,
    linkTwitter: async () => null,
    logout: async () => {},
    signAndSend: async () => {
      throw new Error('Trading is off in demo. Sign in with the real build to trade.');
    },
  };
  registerTokenGetter(value.getToken);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Picks demo vs real. Real is lazy-required so Privy never loads in Expo Go. */
export function AppAuthProvider({ children }: { children: React.ReactNode }) {
  if (DEMO) return <DemoAuthProvider>{children}</DemoAuthProvider>;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrivyAuthProvider } = require('./privy') as typeof import('./privy');
  return <PrivyAuthProvider>{children}</PrivyAuthProvider>;
}
