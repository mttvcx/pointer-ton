import type { Json } from '@/lib/supabase/types';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function unixToIso(sec: number): string | null {
  if (!Number.isFinite(sec) || sec <= 0) return null;
  const ms = sec > 1e12 ? sec : sec * 1000;
  const d = new Date(ms);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

/**
 * Best-effort on-chain / indexer time from Helius enhanced tx, DAS asset, or Gecko blob.
 * Used for `tokens.created_at` so Pulse ages reflect mint time, not webhook lag.
 */
export function extractChainObservedAt(raw: Json | unknown): string | null {
  const root = asRecord(raw);
  if (!root) return null;

  for (const key of ['timestamp', 'blockTime', 'block_time', 'created_at', 'createdAt']) {
    const v = root[key];
    if (typeof v === 'number') {
      const iso = unixToIso(v);
      if (iso) return iso;
    }
    if (typeof v === 'string' && v.trim()) {
      const d = new Date(v);
      if (Number.isFinite(d.getTime())) return d.toISOString();
    }
  }

  const minted = root.minted_at ?? root.mintedAt;
  if (typeof minted === 'number') {
    const iso = unixToIso(minted);
    if (iso) return iso;
  }

  const content = asRecord(root.content);
  const metadata = content && asRecord(content.metadata);
  if (metadata) {
    const created = metadata.created_at ?? metadata.createdAt;
    if (typeof created === 'string') {
      const d = new Date(created);
      if (Number.isFinite(d.getTime())) return d.toISOString();
    }
  }

  return null;
}
