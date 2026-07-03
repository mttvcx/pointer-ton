import { useQuery } from '@tanstack/react-query';
import { DEMO, useAuth } from '../auth';
import { SOLANA_RPC_URL } from '../env';
import { fetchYieldRate, prepareYieldDeposit } from './api';

/**
 * Live Smart Yield APY (from the backend → Lulo). Disabled in demo and until
 * signed in. Returns the real % when the backend has a LULO_API_KEY, else null —
 * screens then fall back to their demo APY. Never throws into the UI.
 */
export function useYieldRate(): number | null {
  const auth = useAuth();
  const q = useQuery({
    queryKey: ['financial', 'yield'],
    queryFn: fetchYieldRate,
    enabled: !DEMO && auth.isLoggedIn,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  return q.data?.configured ? q.data.apyPct ?? null : null;
}

/**
 * "Put to work" — deposit USDC into Smart Yield (Lulo). Mirrors the trade path:
 * backend builds the unsigned tx → Privy wallet signs + broadcasts via the
 * /api/solana/rpc proxy. Real funds move, so this only runs on a real build with a
 * wallet; throws a friendly error when the backend isn't keyed yet.
 */
export function useYieldDeposit() {
  const auth = useAuth();

  async function deposit(amountUsd: number): Promise<{ signature: string }> {
    if (DEMO || auth.demo) throw new Error('Not available in demo');
    if (!auth.walletAddress) throw new Error('No wallet');
    const token = await auth.getToken();
    if (!token) throw new Error('Not authenticated');

    const prep = await prepareYieldDeposit(auth.walletAddress, amountUsd);
    if (!prep.configured) throw new Error('Smart Yield isn’t switched on yet');
    if (!prep.transaction) throw new Error(prep.error || 'Could not build the deposit');

    const signature = await auth.signAndSend(prep.transaction, SOLANA_RPC_URL, token);
    return { signature };
  }

  return { deposit, canDeposit: !DEMO && !auth.demo && Boolean(auth.walletAddress) };
}
