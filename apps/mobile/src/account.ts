import { useQuery } from '@tanstack/react-query';
import { DEMO, useAuth } from './auth';
import { getMe, getMyWallets, getPortfolio, getPoints } from './api/endpoints';

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
