'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';

type EndpointRow = {
  endpoint: string;
  credits: number;
  calls: number;
};

type Stats = {
  totalCreditsToday: number;
  byEndpoint: EndpointRow[];
  projectedMonthlyCredits: number;
  projectedMonthlyUsd: number;
};

export default function AdminHeliusUsagePage() {
  const { authenticated, getAccessToken } = usePointerAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [since, setSince] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Sign in required');
      const res = await fetch('/api/admin/helius-usage', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as {
        since?: string;
        stats?: Stats;
        error?: string;
        message?: string;
      };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      setSince(json.since ?? null);
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

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-sm text-fg-muted">
        Sign in with a founder wallet to view Helius usage.
      </div>
    );
  }

  const maxCredits = stats?.byEndpoint[0]?.credits ?? 1;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-lg font-semibold text-fg-primary">Helius credit usage</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Logged RPC/DAS calls wrapped with `heliusCall`. Run migration: scripts/helius-usage.sql
        </p>
        {since ? <p className="mt-1 text-xs text-fg-muted">UTC day since {since}</p> : null}
      </header>

      {loading ? <p className="text-sm text-fg-muted">Loading…</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {stats ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Credits today (success)" value={stats.totalCreditsToday.toLocaleString()} />
          <StatCard
            label="Projected monthly credits"
            value={stats.projectedMonthlyCredits.toLocaleString()}
          />
          <StatCard label="Projected monthly USD" value={`$${stats.projectedMonthlyUsd.toFixed(2)}`} />
        </div>
      ) : null}

      {stats ? (
        <section className="rounded-lg border border-border-subtle bg-bg-raised p-4">
          <h2 className="text-sm font-semibold text-fg-primary">Credits by endpoint</h2>
          <div className="mt-4 space-y-3">
            {stats.byEndpoint.map((row) => {
              const pct = Math.max(4, Math.round((row.credits / maxCredits) * 100));
              return (
                <div key={row.endpoint}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                    <span className="font-mono text-fg-primary">{row.endpoint}</span>
                    <span className="shrink-0 tabular-nums text-fg-muted">
                      {row.credits.toLocaleString()} cr · {row.calls} calls
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-bg-base">
                    <div
                      className="h-full rounded-full bg-accent-primary/80"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {stats.byEndpoint.length === 0 ? (
              <p className="text-sm text-fg-muted">No logged calls yet today.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border-subtle bg-bg-raised text-fg-muted">
            <tr>
              <th className="px-3 py-2">Endpoint</th>
              <th className="px-3 py-2">Credits</th>
              <th className="px-3 py-2">Calls</th>
            </tr>
          </thead>
          <tbody>
            {(stats?.byEndpoint ?? []).map((row) => (
              <tr key={row.endpoint} className="border-b border-border-subtle/60">
                <td className="px-3 py-2 font-mono">{row.endpoint}</td>
                <td className="px-3 py-2 tabular-nums">{row.credits.toLocaleString()}</td>
                <td className="px-3 py-2 tabular-nums">{row.calls}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
