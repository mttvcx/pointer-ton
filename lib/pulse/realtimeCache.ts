import type { QueryClient } from '@tanstack/react-query';
import type { AppChainId } from '@/lib/chains/appChain';
import { tokenMatchesAppChain } from '@/lib/chains/evmTokenChain';
import { PULSE_NEAR_MIGRATE_PCT } from '@/lib/tokens/bondingProgress';
import { PULSE_THRESHOLDS, type PulseColumnId } from '@/lib/utils/constants';
import type { Tables } from '@/lib/supabase/types';
import type { PulseTokenBundle } from '@/types/tokens';

type TokenRow = Tables<'tokens'>;
type SnapshotRow = Tables<'token_market_snapshots'>;

export type PulseFeedQueryData = {
  items: PulseTokenBundle[];
  fetchError: string | null;
};

function pulseQueryKey(column: PulseColumnId, chain: AppChainId) {
  return ['pulse', column, chain] as const;
}

/** Client-side column gate — mirrors server listPulseFeedTokens heuristics (best-effort). */
export function tokenMatchesPulseColumn(
  token: TokenRow,
  column: PulseColumnId,
  chain: AppChainId,
): boolean {
  if (!tokenMatchesAppChain(token, chain)) return false;
  const now = Date.now();
  const createdMs = new Date(token.created_at).getTime();

  if (column === 'new') {
    if (!Number.isFinite(createdMs)) return false;
    return now - createdMs <= PULSE_THRESHOLDS.newMaxAgeMinutes * 60_000;
  }

  if (column === 'migrated') {
    return token.migrated_at != null;
  }

  if (token.migrated_at != null) return false;
  if (!Number.isFinite(createdMs)) return false;
  if (now - createdMs > PULSE_THRESHOLDS.stretchMaxAgeHours * 3_600_000) return false;
  const bp = token.bonding_progress;
  return bp != null && Number.isFinite(bp) && bp >= PULSE_NEAR_MIGRATE_PCT;
}

export function mergeTokenIntoPulseCache(
  qc: QueryClient,
  column: PulseColumnId,
  chain: AppChainId,
  token: TokenRow,
): boolean {
  if (!tokenMatchesPulseColumn(token, column, chain)) return false;

  const key = pulseQueryKey(column, chain);
  const prev = qc.getQueryData<PulseFeedQueryData>(key);
  if (!prev) return false;

  const ix = prev.items.findIndex((b) => b.token.mint === token.mint);
  if (ix >= 0) {
    const next = [...prev.items];
    next[ix] = { ...next[ix]!, token: { ...next[ix]!.token, ...token } };
    qc.setQueryData<PulseFeedQueryData>(key, { ...prev, items: next });
    return true;
  }

  const bundle: PulseTokenBundle = { token, snapshot: null };
  qc.setQueryData<PulseFeedQueryData>(key, {
    ...prev,
    items: [bundle, ...prev.items].slice(0, 80),
  });
  return true;
}

export function mergeSnapshotIntoPulseCache(
  qc: QueryClient,
  column: PulseColumnId,
  chain: AppChainId,
  snapshot: SnapshotRow,
): boolean {
  const key = pulseQueryKey(column, chain);
  const prev = qc.getQueryData<PulseFeedQueryData>(key);
  if (!prev) return false;

  let touched = false;
  const items = prev.items.map((b) => {
    if (b.token.mint !== snapshot.mint) return b;
    touched = true;
    return { ...b, snapshot };
  });
  if (!touched) return false;
  qc.setQueryData<PulseFeedQueryData>(key, { ...prev, items });
  return true;
}
