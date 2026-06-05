'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

type Stats = {
  profileCount: number;
  walletCount: number;
  byChain: Record<string, number>;
  bySource: Record<string, number>;
};

export default function AdminIdentityPage() {
  const [importJson, setImportJson] = useState('');
  const [importResult, setImportResult] = useState<string | null>(null);

  const statsQ = useQuery({
    queryKey: ['admin-identity-stats'],
    queryFn: async () => {
      const r = await fetch('/api/identity/import');
      if (!r.ok) throw new Error('stats_failed');
      return r.json() as Promise<{ stats: Stats; duplicates: unknown[] }>;
    },
    staleTime: 10_000,
  });

  async function runImport() {
    setImportResult(null);
    try {
      const rows = JSON.parse(importJson) as unknown;
      const r = await fetch('/api/identity/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'seed', rows }),
      });
      const json = await r.json();
      setImportResult(JSON.stringify(json, null, 2));
      void statsQ.refetch();
    } catch (e) {
      setImportResult(e instanceof Error ? e.message : 'import_failed');
    }
  }

  const stats = statsQ.data?.stats;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-sm text-fg-primary">
      <header>
        <h1 className="text-lg font-semibold">Identity registry (dev)</h1>
        <p className="mt-1 text-fg-muted">
          Kolscan / GMGN seed data and manual imports. Production imports require admin auth headers.
        </p>
      </header>

      <section className="rounded-md border border-border-subtle bg-bg-raised p-4">
        <h2 className="text-base font-medium">Registry stats</h2>
        {statsQ.isLoading ? (
          <p className="mt-2 text-fg-muted">Loading…</p>
        ) : stats ? (
          <ul className="mt-2 space-y-1 tabular-nums text-fg-secondary">
            <li>Profiles: {stats.profileCount}</li>
            <li>Wallets: {stats.walletCount}</li>
            <li>By chain: {JSON.stringify(stats.byChain)}</li>
            <li>By source: {JSON.stringify(stats.bySource)}</li>
          </ul>
        ) : (
          <p className="mt-2 text-rose-400">Could not load stats (admin auth may be required).</p>
        )}
      </section>

      <section className="rounded-md border border-border-subtle bg-bg-raised p-4">
        <h2 className="text-base font-medium">Import JSON</h2>
        <textarea
          className="mt-2 h-40 w-full rounded-md border border-border-subtle bg-bg-base p-2 font-mono text-[11px]"
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          placeholder='[{ "chain": "solana", "address": "...", "displayName": "...", "source": "kolscan" }]'
        />
        <button
          type="button"
          className="mt-2 rounded-md bg-accent-primary px-3 py-1.5 text-[12px] font-semibold text-black"
          onClick={() => void runImport()}
        >
          Import
        </button>
        {importResult ? (
          <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-black/40 p-2 text-[10px] text-white/70">
            {importResult}
          </pre>
        ) : null}
      </section>
    </main>
  );
}
