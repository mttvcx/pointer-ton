import type { QueryClient } from '@tanstack/react-query';
import type { AppChainId } from '@/lib/chains/appChain';
import type { PulseColumnId } from '@/lib/utils/constants';
import type { Tables } from '@/lib/supabase/types';
import type { Json } from '@/lib/supabase/types';
import type { PulseTokenBundle } from '@/types/tokens';
import { bundleMatchesPulseColumn, tokenMatchesPulseColumn } from '@/lib/pulse/columnGates';

type TokenRow = Tables<'tokens'>;
type SnapshotRow = Tables<'token_market_snapshots'>;

export type PulseFeedQueryData = {
  items: PulseTokenBundle[];
  fetchError: string | null;
};

function pulseQueryKey(column: PulseColumnId, chain: AppChainId) {
  return ['pulse', column, chain] as const;
}

export { tokenMatchesPulseColumn } from '@/lib/pulse/columnGates';

export function mergeTokenIntoPulseCache(
  qc: QueryClient,
  column: PulseColumnId,
  chain: AppChainId,
  token: TokenRow,
): boolean {
  const key = pulseQueryKey(column, chain);
  const prev = qc.getQueryData<PulseFeedQueryData>(key);
  if (!prev) return false;

  const matches = tokenMatchesPulseColumn(token, column, chain);
  const ix = prev.items.findIndex((b) => b.token.mint === token.mint);

  if (!matches) {
    if (ix < 0) return false;
    const next = prev.items.filter((_, i) => i !== ix);
    qc.setQueryData<PulseFeedQueryData>(key, { ...prev, items: next });
    return true;
  }

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
  let items = prev.items.map((b) => {
    if (b.token.mint !== snapshot.mint) return b;
    touched = true;
    return { ...b, snapshot };
  });
  if (!touched) return false;

  if (column === 'new') {
    items = items.filter((b) => bundleMatchesPulseColumn(b, column, chain));
  }

  qc.setQueryData<PulseFeedQueryData>(key, { ...prev, items });
  return true;
}

/** Merge holder / risk fields into an existing cached snapshot row. */
export function mergePartialSnapshotIntoPulseCache(
  qc: QueryClient,
  column: PulseColumnId,
  chain: AppChainId,
  mint: string,
  patch: {
    holder_count?: number | null;
    top10_holder_pct?: number | null;
    dev_holding_pct?: number | null;
    extended_metrics?: Record<string, unknown> | null;
  },
): boolean {
  const key = pulseQueryKey(column, chain);
  const prev = qc.getQueryData<PulseFeedQueryData>(key);
  if (!prev) return false;

  let touched = false;
  let items = prev.items.map((b) => {
    if (b.token.mint !== mint) return b;
    touched = true;
    const snap = b.snapshot;
    const base = snap ?? {
      id: -1,
      mint,
      market_cap_usd: null,
      liquidity_usd: null,
      price_usd: null,
      volume_5m_usd: null,
      volume_1h_usd: null,
      volume_24h_usd: null,
      txns_5m: null,
      txns_1h: null,
      holder_count: null,
      top10_holder_pct: null,
      dev_holding_pct: null,
      extended_metrics: null,
      snapshot_at: new Date().toISOString(),
    };
    const prevExt =
      base.extended_metrics &&
      typeof base.extended_metrics === 'object' &&
      !Array.isArray(base.extended_metrics)
        ? (base.extended_metrics as Record<string, unknown>)
        : {};
    const nextExt =
      patch.extended_metrics != null
        ? { ...prevExt, ...patch.extended_metrics }
        : base.extended_metrics;

    return {
      ...b,
      snapshot: {
        ...base,
        holder_count: patch.holder_count ?? base.holder_count,
        top10_holder_pct: patch.top10_holder_pct ?? base.top10_holder_pct,
        dev_holding_pct: patch.dev_holding_pct ?? base.dev_holding_pct,
        extended_metrics: nextExt as Json,
        snapshot_at: new Date().toISOString(),
      },
    };
  });
  if (!touched) return false;

  if (column === 'new') {
    items = items.filter((b) => bundleMatchesPulseColumn(b, column, chain));
  }

  qc.setQueryData<PulseFeedQueryData>(key, { ...prev, items });
  return true;
}
