'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminFetch, useAdminMe, adminCan } from '@/lib/admin/useAdminApi';

type Event = { id: string; week_label: string; season_label: string; status: string; finalized_at: string | null; starts_at: string };
type Participant = { id: string; display_name: string; realized_pnl_usd: number; event_volume_usd: number; review_status: string };

const REVIEW_STATUSES = ['eligible', 'low_sample', 'under_review', 'flagged', 'disqualified', 'finalized'];

export default function AdminChampionshipPage() {
  const adminFetch = useAdminFetch();
  const qc = useQueryClient();
  const me = useAdminMe().data;
  const [selected, setSelected] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const canReview = adminCan(me, 'championship.review');
  const canFinalize = adminCan(me, 'championship.finalize');

  const eventsQ = useQuery({
    queryKey: ['admin-champ-events'],
    queryFn: async (): Promise<Event[]> => {
      const res = await adminFetch('/api/admin/championship');
      if (!res.ok) throw new Error(`events_${res.status}`);
      return (await res.json()).events as Event[];
    },
  });

  const detailQ = useQuery({
    queryKey: ['admin-champ-detail', selected],
    enabled: Boolean(selected),
    queryFn: async (): Promise<{ event: Event; participants: Participant[]; finalization: unknown }> => {
      const res = await adminFetch(`/api/admin/championship/${selected}`);
      if (!res.ok) throw new Error(`detail_${res.status}`);
      return (await res.json()) as { event: Event; participants: Participant[]; finalization: unknown };
    },
  });

  async function setReview(participantId: string, reviewStatus: string) {
    setMsg(null);
    const reason = reviewStatus === 'disqualified' ? window.prompt('Reason for disqualification?') ?? '' : undefined;
    if (reviewStatus === 'disqualified' && !reason) return;
    const res = await adminFetch(`/api/admin/championship/${selected}/review`, {
      method: 'POST',
      body: JSON.stringify({ participantId, reviewStatus, reason }),
    });
    const json = await res.json();
    if (!res.ok) { setMsg(json.error ?? 'review_failed'); return; }
    void qc.invalidateQueries({ queryKey: ['admin-champ-detail', selected] });
  }

  async function finalize() {
    if (!selected) return;
    const reason = window.prompt('Reason for finalizing this event (min 8 chars)?') ?? '';
    if (reason.trim().length < 8) { setMsg('Reason required (min 8 chars).'); return; }
    const res = await adminFetch(`/api/admin/championship/${selected}/finalize`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason.trim() }),
    });
    const json = await res.json();
    if (!res.ok) { setMsg(json.error ?? 'finalize_failed'); return; }
    setMsg(`Finalized with ${json.entries} ranked entries.`);
    void qc.invalidateQueries({ queryKey: ['admin-champ-events'] });
    void qc.invalidateQueries({ queryKey: ['admin-champ-detail', selected] });
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-semibold text-fg-primary">Championship</h1>
        <p className="mt-1 text-sm text-fg-muted">Review participants and finalize events. Finalization freezes a leaderboard snapshot.</p>
      </header>
      {msg ? <p className="text-[13px] text-fg-secondary">{msg}</p> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-md border border-border-subtle bg-bg-raised">
          <div className="border-b border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Events</div>
          <div className="max-h-[60vh] overflow-auto">
            {eventsQ.data && eventsQ.data.length > 0 ? (
              <ul className="divide-y divide-border-subtle/50">
                {eventsQ.data.map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => setSelected(e.id)} className={`w-full px-3 py-2 text-left text-[13px] hover:bg-bg-hover/60 ${selected === e.id ? 'bg-bg-hover' : ''}`}>
                      <span className="font-medium text-fg-primary">{e.week_label}</span>
                      <span className="ml-2 text-[11px] text-fg-muted">{e.season_label}</span>
                      <span className="ml-2 text-[11px] text-fg-muted">[{e.status}]</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-3 text-sm text-fg-muted">No events.</p>
            )}
          </div>
        </section>

        <section className="rounded-md border border-border-subtle bg-bg-raised">
          <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Participants</span>
            {selected && canFinalize && detailQ.data?.event.status !== 'finalized' ? (
              <button type="button" onClick={() => void finalize()} className="rounded-md bg-accent-primary px-2.5 py-1 text-[12px] font-semibold text-fg-inverse">Finalize event</button>
            ) : null}
          </div>
          <div className="max-h-[60vh] overflow-auto p-3 text-[13px]">
            {!selected ? (
              <p className="text-fg-muted">Select an event.</p>
            ) : detailQ.data ? (
              detailQ.data.participants.length > 0 ? (
                <table className="w-full text-[12px]">
                  <thead className="text-fg-muted"><tr className="text-left"><th className="py-1">Name</th><th className="py-1">PnL</th><th className="py-1">Status</th></tr></thead>
                  <tbody>
                    {detailQ.data.participants.map((p) => (
                      <tr key={p.id} className="border-t border-border-subtle/40 text-fg-secondary">
                        <td className="py-1">{p.display_name}</td>
                        <td className="py-1 tabular-nums">${p.realized_pnl_usd.toLocaleString()}</td>
                        <td className="py-1">
                          {canReview ? (
                            <select className="rounded border border-border-subtle bg-bg-base px-1 py-0.5 text-[11px]" value={p.review_status} onChange={(e) => void setReview(p.id, e.target.value)}>
                              {REVIEW_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            p.review_status
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-fg-muted">No participants for this event.</p>
              )
            ) : (
              <p className="text-fg-muted">Loading…</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
