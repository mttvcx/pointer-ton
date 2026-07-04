import { useQuery } from '@tanstack/react-query';
import { DEMO, useAuth } from './auth';
import { getMe, getMyWallets, getPortfolio, getPoints, getCashBalance } from './api/endpoints';
import { getPointerIdentity, getSquads } from './api/social';

/**
 * Real-account hooks. All are DISABLED in demo (Expo Go) and until the user is
 * signed in, so screens keep their demo fixtures in preview and only swap to live
 * data on a real, authenticated build. Never throws into the UI — screens read
 * `.data` and fall back when it's undefined.
 */

export function useMe() {
  const auth = useAuth();
  return useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    enabled: !DEMO && auth.isLoggedIn,
    staleTime: 60_000,
    retry: 1,
  });
}

/** Pointer identity (connected X handle, bio, socials) — Redis-backed, live now. */
export function usePointerIdentity() {
  const auth = useAuth();
  return useQuery({
    queryKey: ['pointer-identity'],
    queryFn: getPointerIdentity,
    enabled: !DEMO && auth.isLoggedIn,
    staleTime: 60_000,
    retry: 1,
  });
}

/** Real squads the user is in / can discover (empty until crews get created). */
export function useSquads() {
  const auth = useAuth();
  return useQuery({
    queryKey: ['squads', 'list'],
    queryFn: getSquads,
    enabled: !DEMO && auth.isLoggedIn,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useMyWallets() {
  const auth = useAuth();
  return useQuery({
    queryKey: ['wallets', 'my'],
    queryFn: getMyWallets,
    enabled: !DEMO && auth.isLoggedIn,
    staleTime: 30_000,
    retry: 1,
  });
}

export function usePortfolio() {
  const auth = useAuth();
  return useQuery({
    queryKey: ['portfolio', auth.walletAddress],
    queryFn: () => getPortfolio(),
    enabled: !DEMO && auth.isLoggedIn && Boolean(auth.walletAddress),
    staleTime: 30_000,
    retry: 1,
  });
}

export function usePoints() {
  const auth = useAuth();
  return useQuery({
    queryKey: ['points', 'me'],
    queryFn: getPoints,
    enabled: !DEMO && auth.isLoggedIn,
    staleTime: 60_000,
    retry: 1,
  });
}

/** Spendable USD cash balance (the wallet's on-chain USDC). */
export function useCashBalance() {
  const auth = useAuth();
  return useQuery({
    queryKey: ['cash-balance', auth.walletAddress],
    queryFn: () => getCashBalance(auth.walletAddress as string),
    enabled: !DEMO && auth.isLoggedIn && Boolean(auth.walletAddress),
    staleTime: 20_000,
    retry: 1,
  });
}
