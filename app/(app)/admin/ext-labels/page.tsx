'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';

type Row = {
  id: string;
  subject_type: string;
  subject: string;
  label: string;
  category: string | null;
  source: string;
  confidence: number | null;
  auto_verified: boolean;
  hidden: boolean;
  created_at: string;
};

const SOURCES = ['', 'user', 'ai', 'x', 'admin'];
const STATUSES = ['', 'live', 'queued', 'hidden'];

export default function AdminExtLabelsPage() {
  const { getAccessToken } = usePointerAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Sign in required');
      const qs = new URLSearchParams();
      if (source) qs.set('source', source);
      if (status) qs.set('status', status);
      const res = await fetch(`/api/admin/ext-labels?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { rows: Row[] };
      setRows(data.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, source, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: string) => {
    const token = await getAccessToken();
    if (!token) return;
    await fetch('/api/admin/ext-labels', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    void load();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header>
        <h1 className="text-lg font-semibold text-fg-primary">Extension labels</h1>
        <p className="mt-1 text-sm text-fg-muted">
          The self-growing tag pool — community, AI (Claude), X affiliations, and admin. Approve queued ones, hide the wrong ones, or delete.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded border border-border-subtle bg-bg-sunken px-2 py-1 text-sm text-fg-secondary">
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s || 'all sources'}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-border-subtle bg-bg-sunken px-2 py-1 text-sm text-fg-secondary">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || 'all statuses'}
            </option>
          ))}
        </select>
        <button onClick={() => void load()} className="rounded border border-border-subtle px-3 py-1 text-sm text-fg-secondary hover:text-fg-primary">
          Refresh
        </button>
        <span className="ml-auto text-xs text-fg-muted">{rows.length} shown</span>
      </div>

      {error && <p className="text-sm text-signal-bear">{error}</p>}

      {loading ? (
        <p className="text-sm text-fg-muted">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border-subtle">
          <table className="w-full text-sm">
            <thead className="bg-bg-sunken text-[12px] uppercase tracking-wide text-fg-muted">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Subject</th>
                <th className="px-3 py-2 text-left font-semibold">Label</th>
                <th className="px-3 py-2 text-left font-semibold">Source</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border-subtle">
                  <td className="px-3 py-2 text-fg-secondary">{r.subject_type === 'handle' ? `@${r.subject}` : `${r.subject.slice(0, 6)}…${r.subject.slice(-4)}`}</td>
                  <td className="px-3 py-2 text-fg-primary">
                    {r.label}
                    {r.confidence != null && <span className="ml-1 text-xs text-fg-muted">{Math.round(r.confidence * 100)}%</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-bg-sunken px-1.5 py-0.5 text-xs text-fg-muted">{r.source}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.hidden ? <span className="text-signal-bear">hidden</span> : r.auto_verified ? <span className="text-signal-bull">live</span> : <span className="text-yellow-400">queued</span>}
                  </td>
                  <td className="space-x-1 px-3 py-2 text-right">
                    {!r.auto_verified && !r.hidden && (
                      <button onClick={() => void act(r.id, 'approve')} className="rounded border border-signal-bull/40 px-2 py-0.5 text-xs text-signal-bull">
                        Approve
                      </button>
                    )}
                    {!r.hidden ? (
                      <button onClick={() => void act(r.id, 'hide')} className="rounded border border-border-subtle px-2 py-0.5 text-xs text-fg-muted">
                        Hide
                      </button>
                    ) : (
                      <button onClick={() => void act(r.id, 'unhide')} className="rounded border border-border-subtle px-2 py-0.5 text-xs text-fg-secondary">
                        Unhide
                      </button>
                    )}
                    <button onClick={() => void act(r.id, 'delete')} className="rounded border border-signal-bear/40 px-2 py-0.5 text-xs text-signal-bear">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-fg-muted">
                    No labels yet — browse some profiles to fill the pool.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
