'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';

type CacheRow = {
  cache_key: string;
  scan_type: string;
  hit_count: number;
  model_used: string;
  created_at: string;
  expires_at: string;
  source_mint: string | null;
  source_wallet: string | null;
  mc_at_scan: number | null;
};

type Stats = {
  entriesToday: number;
  cacheHitsToday: number;
  estimatedCostSavedUsd: number;
  hitRatePct: number;
};

export default function AdminAiCachePage() {
  const { authenticated, getAccessToken } = usePointerAuth();
  const [top, setTop] = useState<CacheRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flushKey, setFlushKey] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Sign in required');
      const res = await fetch('/api/admin/ai-cache', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as {
        top?: CacheRow[];
        stats?: Stats;
        error?: string;
        message?: string;
      };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      setTop(json.top ?? []);
      setStats(json.stats ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (authenticated) void load();
  }, [authenticated, load]);

  async function flush() {
    const key = flushKey.trim();
    if (!key) return;
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch('/api/admin/ai-cache', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cacheKey: key }),
    });
    if (res.ok) {
      setFlushKey('');
      void load();
    }
  }

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-sm text-fg-muted">
        Sign in with a founder wallet to view AI cache stats.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-lg font-semibold text-fg-primary">AI scan cache</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Shared global cache — one LLM run serves all users until TTL or MC invalidation.
        </p>
      </header>

      {loading ? <p className="text-sm text-fg-muted">Loading…</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Cache hits today" value={String(stats.cacheHitsToday)} />
          <StatCard label="Entries written today" value={String(stats.entriesToday)} />
          <StatCard label="Est. cost saved (USD)" value={`$${stats.estimatedCostSavedUsd}`} />
          <StatCard label="Hit rate (est.)" value={`${stats.hitRatePct}%`} />
        </div>
      ) : null}

      <section className="rounded-lg border border-border-subtle bg-bg-raised p-4">
        <h2 className="text-sm font-semibold text-fg-primary">Flush cache key</h2>
        <p className="mt-1 text-xs text-fg-muted">Use after prompt updates.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={flushKey}
            onChange={(e) => setFlushKey(e.target.value)}
            placeholder="token_scan:So111…:mc12"
            className="min-w-0 flex-1 rounded-md border border-border-subtle bg-bg-base px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void flush()}
            className="rounded-md bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15"
          >
            Flush
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-fg-primary">Top keys by hits (today)</h2>
        <div className="overflow-x-auto rounded-lg border border-border-subtle">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border-subtle bg-bg-raised text-fg-muted">
              <tr>
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Hits</th>
                <th className="px-3 py-2">Model</th>
              </tr>
            </thead>
            <tbody>
              {top.map((row) => (
                <tr key={row.cache_key} className="border-b border-border-subtle/60">
                  <td className="max-w-[280px] truncate px-3 py-2 font-mono text-[10px]">
                    {row.cache_key}
                  </td>
                  <td className="px-3 py-2">{row.scan_type}</td>
                  <td className="px-3 py-2 tabular-nums">{row.hit_count}</td>
                  <td className="px-3 py-2 text-fg-muted">{row.model_used}</td>
                </tr>
              ))}
              {top.length === 0 && !loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-fg-muted">
                    No cache rows yet today. Run migrations: scripts/ai-scan-cache.sql
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-raised px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-fg-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-fg-primary">{value}</p>
    </div>
  );
}
