'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { useAdminFetch } from '@/lib/admin/useAdminApi';
import type { DoctorReport, OpsHealthSnapshot, OpsProvider } from '@/lib/admin/opsTypes';
import { cn } from '@/lib/utils/cn';

type Tone = 'ok' | 'warn' | 'bad' | 'idle';

const TONE_DOT: Record<Tone, string> = {
  ok: 'bg-signal-bull',
  warn: 'bg-amber-400',
  bad: 'bg-signal-bear',
  idle: 'bg-fg-muted/50',
};

function StatusDot({ tone }: { tone: Tone }) {
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', TONE_DOT[tone])} aria-hidden />;
}

function Card({
  title,
  tone,
  hint,
  children,
}: {
  title: string;
  tone: Tone;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-raised p-4">
      <header className="flex items-center gap-2">
        <StatusDot tone={tone} />
        <h2 className="text-[13px] font-semibold text-fg-primary">{title}</h2>
        {hint ? <span className="ml-auto text-[10px] uppercase tracking-wide text-fg-muted">{hint}</span> : null}
      </header>
      {children}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: Tone }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12px] text-fg-muted">{label}</span>
      <span className={cn('num text-[13px] font-semibold tabular-nums text-fg-primary', tone === 'bad' && 'text-signal-bear', tone === 'warn' && 'text-amber-400')}>
        {value}
      </span>
    </div>
  );
}

function SectionError({ error }: { error: string }) {
  return (
    <p className="text-[12px] text-signal-bear">
      Could not read this signal: <span className="font-mono text-[11px]">{error}</span>
    </p>
  );
}

function fmtAge(min: number | null): string {
  if (min == null) return '—';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m ago`;
}

function DoctorPanel({ report }: { report: DoctorReport }) {
  const tone: Tone = report.status === 'critical' ? 'bad' : report.status === 'warn' ? 'warn' : 'ok';
  const skin =
    report.status === 'critical'
      ? 'border-signal-bear/40 bg-signal-bear/10'
      : report.status === 'warn'
        ? 'border-amber-400/40 bg-amber-400/10'
        : 'border-signal-bull/40 bg-signal-bull/10';
  return (
    <section className={cn('rounded-lg border p-4', skin)}>
      <header className="flex items-center gap-2">
        <StatusDot tone={tone} />
        <h2 className="text-[13px] font-semibold text-fg-primary">Pointer Doctor</h2>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-fg-muted">read-only diagnosis</span>
      </header>
      <p className="mt-1.5 text-[13px] text-fg-secondary">{report.summary}</p>
      {report.findings.length ? (
        <ul className="mt-3 space-y-2">
          {report.findings.map((find) => (
            <li key={find.id} className="rounded-md border border-border-subtle bg-bg-raised/60 p-2.5">
              <div className="flex items-center gap-2">
                <StatusDot tone={find.severity === 'critical' ? 'bad' : 'warn'} />
                <span className="text-[12.5px] font-semibold text-fg-primary">{find.title}</span>
              </div>
              <p className="mt-1 text-[12px] text-fg-muted">{find.detail}</p>
              <p className="mt-1 text-[11.5px] text-accent-primary">&rarr; {find.action}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[12px] text-fg-muted">
          No issues detected across trading, pulse, indexer, crons, providers, or open incidents.
        </p>
      )}
    </section>
  );
}

export default function OpsHealthPage() {
  const adminFetch = useAdminFetch();
  const q = useQuery({
    queryKey: ['ops-health'],
    queryFn: async (): Promise<OpsHealthSnapshot> => {
      const res = await adminFetch('/api/admin/ops/health');
      if (!res.ok) throw new Error(`ops_health_${res.status}`);
      return res.json() as Promise<OpsHealthSnapshot>;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });

  const snap = q.data;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-fg-primary">Pointer Ops · System Health</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Live production signals — Postgres aggregates + runtime config. Read-only. Honest by
            design: a signal we can&apos;t read says so; it is never faked green.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-fg-muted">
            {q.isFetching
              ? 'Refreshing…'
              : snap
                ? `Updated ${new Date(snap.generatedAt).toLocaleTimeString()}`
                : ''}
          </span>
          <button
            type="button"
            onClick={() => void q.refetch()}
            className="focus-ring flex h-8 items-center gap-1.5 rounded-md border border-border-subtle px-2.5 text-[12px] text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', q.isFetching && 'animate-spin')} aria-hidden />
            Refresh
          </button>
        </div>
      </header>

      {q.isError ? (
        <div className="rounded-lg border border-signal-bear/40 bg-signal-bear/10 p-4 text-[13px] text-signal-bear">
          Failed to load health snapshot: {(q.error as Error)?.message ?? 'unknown error'}
        </div>
      ) : null}

      {snap?.flags.pauseIngest ? (
        <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-[13px] text-amber-300">
          <strong>Ingest is paused</strong> — <code className="font-mono text-[11px]">POINTER_PAUSE_INGEST=1</code>. Token
          discovery, enrichment and indexing crons are short-circuited to a no-op.
        </div>
      ) : null}

      {snap ? <DoctorPanel report={snap.doctor} /> : null}

      {!snap && q.isLoading ? (
        <p className="text-sm text-fg-muted">Reading production signals…</p>
      ) : null}

      {snap ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {/* Trading */}
          {snap.trading.ok ? (
            (() => {
              const t = snap.trading;
              const rate = t.failRatePct;
              const tone: Tone = rate == null ? 'idle' : rate > 20 ? 'bad' : rate > 5 ? 'warn' : 'ok';
              return (
                <Card title="Trading" tone={tone} hint="last 24h">
                  <Stat label="Confirmed" value={t.confirmed.toLocaleString()} />
                  <Stat label="Failed" value={t.failed.toLocaleString()} tone={t.failed > 0 ? 'warn' : undefined} />
                  <Stat label="Pending" value={t.pending.toLocaleString()} />
                  <Stat
                    label="Fail rate"
                    value={rate == null ? '—' : `${rate.toFixed(1)}%`}
                    tone={tone === 'idle' ? undefined : tone}
                  />
                  <Stat label="Volume today (SOL)" value={t.volumeSolToday.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
                </Card>
              );
            })()
          ) : (
            <Card title="Trading" tone="bad" hint="last 24h">
              <SectionError error={snap.trading.error} />
            </Card>
          )}

          {/* Indexer */}
          {snap.indexer.ok ? (
            (() => {
              const i = snap.indexer;
              const tone: Tone =
                i.total === 0 ? 'idle' : i.byStatus.failed > Math.max(3, i.total * 0.2) ? 'bad' : i.byStatus.failed > 0 ? 'warn' : 'ok';
              return (
                <Card title="Indexer" tone={tone} hint="mint_index_status">
                  <Stat label="Indexed" value={i.byStatus.indexed.toLocaleString()} />
                  <Stat label="Failed" value={i.byStatus.failed.toLocaleString()} tone={i.byStatus.failed > 0 ? 'warn' : undefined} />
                  <Stat label="Pending" value={i.byStatus.pending.toLocaleString()} />
                  <Stat label="Indexing / no-swaps" value={`${i.byStatus.indexing} / ${i.byStatus.no_swaps}`} />
                  {i.recentFailures.length > 0 ? (
                    <div className="mt-1 border-t border-border-subtle pt-2">
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-fg-muted">Recent failures</p>
                      <ul className="space-y-1">
                        {i.recentFailures.map((f) => (
                          <li key={f.mint} className="truncate text-[11px] text-fg-secondary" title={f.lastError ?? ''}>
                            <span className="font-mono">{f.mint.slice(0, 6)}…</span>{' '}
                            <span className="text-fg-muted">{f.lastError ?? 'unknown'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </Card>
              );
            })()
          ) : (
            <Card title="Indexer" tone="bad" hint="mint_index_status">
              <SectionError error={snap.indexer.error} />
            </Card>
          )}

          {/* Pulse */}
          {snap.pulse.ok ? (
            (() => {
              const p = snap.pulse;
              const tone: Tone =
                p.ageMinutes == null ? 'idle' : p.ageMinutes > 120 ? 'bad' : p.ageMinutes > 45 ? 'warn' : 'ok';
              return (
                <Card title="Pulse discovery" tone={tone} hint="tokens">
                  <Stat label="Newest token" value={fmtAge(p.ageMinutes)} tone={tone === 'idle' ? undefined : tone} />
                  <Stat label="Discovered last hour" value={p.tokensLastHour.toLocaleString()} />
                  <p className="mt-1 text-[11px] text-fg-muted">
                    Discovery cron runs every 15m. &gt;45m stale = amber, &gt;2h = red.
                  </p>
                </Card>
              );
            })()
          ) : (
            <Card title="Pulse discovery" tone="bad" hint="tokens">
              <SectionError error={snap.pulse.error} />
            </Card>
          )}

          {/* Helius usage */}
          {snap.helius.ok ? (
            <Card title="Helius usage" tone="ok" hint="today">
              <div className="space-y-1">
                {Object.entries(snap.helius.stats)
                  .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
                  .slice(0, 6)
                  .map(([k, v]) => (
                    <Stat key={k} label={k} value={String(v)} />
                  ))}
              </div>
              <Link href="/admin/helius-usage" className="mt-1 text-[11px] text-accent-primary hover:underline">
                Full Helius usage →
              </Link>
            </Card>
          ) : (
            <Card title="Helius usage" tone="warn" hint="today">
              <SectionError error={snap.helius.error} />
            </Card>
          )}

          {/* Flags */}
          <Card title="Runtime flags" tone={snap.flags.pauseIngest ? 'warn' : 'ok'} hint="env">
            <Stat label="Ingest paused" value={snap.flags.pauseIngest ? 'YES' : 'no'} tone={snap.flags.pauseIngest ? 'warn' : undefined} />
            <Stat label="Packs live commerce" value={snap.flags.packsLiveCommerce ? 'on' : 'off'} />
            <Stat label="Packs treasury configured" value={snap.flags.packsTreasuryConfigured ? 'yes' : 'no'} />
            <Link href="/admin/flags" className="mt-1 text-[11px] text-accent-primary hover:underline">
              DB feature flags →
            </Link>
          </Card>

          {/* Providers */}
          <Card
            title="Providers configured"
            tone={snap.providers.some((p) => p.critical && !p.configured) ? 'bad' : 'ok'}
            hint="env presence"
          >
            <ul className="grid grid-cols-1 gap-1">
              {snap.providers.map((p: OpsProvider) => (
                <li key={p.key} className="flex items-center gap-2 text-[12px]">
                  <StatusDot tone={p.configured ? 'ok' : p.critical ? 'bad' : 'idle'} />
                  <span className="text-fg-secondary">{p.label}</span>
                  {p.critical ? <span className="text-[9px] uppercase tracking-wide text-fg-muted">crit</span> : null}
                  <span className={cn('ml-auto text-[11px]', p.configured ? 'text-fg-muted' : p.critical ? 'text-signal-bear' : 'text-fg-muted')}>
                    {p.configured ? 'set' : 'missing'}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[10px] leading-snug text-fg-muted">
              Presence only — secret values are never read or exposed here.
            </p>
          </Card>
        </div>
      ) : null}

      {snap ? (
        <section className="rounded-lg border border-border-subtle bg-bg-raised p-4">
          <header className="mb-2 flex items-center gap-2">
            <h2 className="text-[13px] font-semibold text-fg-primary">Open incidents</h2>
            <span className="ml-auto text-[10px] uppercase tracking-wide text-fg-muted">auto-opened from errors</span>
          </header>
          {Array.isArray(snap.incidents) ? (
            snap.incidents.length === 0 ? (
              <p className="text-[12px] text-fg-muted">No open incidents — nothing erroring right now.</p>
            ) : (
              <ul className="space-y-1">
                {snap.incidents.map((inc) => {
                  const tone: Tone = inc.severity === 'warn' ? 'warn' : 'bad';
                  return (
                    <li key={inc.id} className="flex items-center gap-2 text-[12px]">
                      <StatusDot tone={tone} />
                      <span className="shrink-0 rounded bg-bg-sunken px-1 text-[9px] uppercase tracking-wide text-fg-muted">
                        {inc.category}
                      </span>
                      <span className="shrink-0 font-mono text-fg-secondary">{inc.name}</span>
                      {inc.sampleMessage ? (
                        <span className="min-w-0 truncate text-fg-muted" title={inc.sampleMessage}>
                          {inc.sampleMessage}
                        </span>
                      ) : null}
                      <span className="ml-auto shrink-0 rounded bg-bg-sunken px-1.5 tabular-nums text-fg-secondary">
                        ×{inc.count}
                      </span>
                      <span className="w-14 shrink-0 text-right tabular-nums text-fg-muted">
                        {fmtAge(Math.max(0, Math.round((Date.now() - new Date(inc.lastSeen).getTime()) / 60_000)))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            <SectionError error={snap.incidents.error} />
          )}
        </section>
      ) : null}

      {snap ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Cron runs */}
          <section className="rounded-lg border border-border-subtle bg-bg-raised p-4">
            <header className="mb-2 flex items-center gap-2">
              <h2 className="text-[13px] font-semibold text-fg-primary">Cron runs</h2>
              <span className="ml-auto text-[10px] uppercase tracking-wide text-fg-muted">last recorded</span>
            </header>
            {Array.isArray(snap.crons) ? (
              snap.crons.length === 0 ? (
                <p className="text-[12px] text-fg-muted">
                  No cron runs recorded yet — the substrate is live; rows appear after the next cron tick.
                </p>
              ) : (
                <ul className="space-y-1">
                  {snap.crons.map((c) => {
                    const tone: Tone = c.status === 'error' ? 'bad' : c.status === 'paused' ? 'warn' : c.ageMinutes > 30 ? 'warn' : 'ok';
                    return (
                      <li key={c.name} className="flex items-center gap-2 text-[12px]">
                        <StatusDot tone={tone} />
                        <span className="font-mono text-fg-secondary">{c.name}</span>
                        <span className="ml-auto tabular-nums text-fg-muted">{fmtAge(c.ageMinutes)}</span>
                        <span className="w-16 text-right tabular-nums text-fg-muted">
                          {c.durationMs != null ? `${c.durationMs}ms` : '—'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : (
              <SectionError error={snap.crons.error} />
            )}
            <p className="mt-2 text-[10px] leading-snug text-fg-muted">
              Covers all crons — the shared wrapper plus the bespoke handlers (refresh-leaderboard,
              check-limit-alerts).
            </p>
          </section>

          {/* Recent events */}
          <section className="rounded-lg border border-border-subtle bg-bg-raised p-4">
            <header className="mb-2 flex items-center gap-2">
              <h2 className="text-[13px] font-semibold text-fg-primary">Recent events</h2>
              <span className="ml-auto text-[10px] uppercase tracking-wide text-fg-muted">ops_events</span>
            </header>
            {Array.isArray(snap.recentEvents) ? (
              snap.recentEvents.length === 0 ? (
                <p className="text-[12px] text-fg-muted">No events recorded yet.</p>
              ) : (
                <ul className="space-y-1">
                  {snap.recentEvents.map((e, i) => {
                    const tone: Tone =
                      e.status === 'error' ? 'bad' : e.status === 'paused' || e.severity === 'warn' ? 'warn' : 'ok';
                    return (
                      <li key={`${e.ts}-${i}`} className="flex items-center gap-2 text-[11px]">
                        <StatusDot tone={tone} />
                        <span className="shrink-0 tabular-nums text-fg-muted">{new Date(e.ts).toLocaleTimeString()}</span>
                        <span className="shrink-0 rounded bg-bg-sunken px-1 text-[9px] uppercase tracking-wide text-fg-muted">
                          {e.category}
                        </span>
                        <span className="shrink-0 font-mono text-fg-secondary">{e.name}</span>
                        {e.message ? (
                          <span className="min-w-0 truncate text-fg-muted" title={e.message}>
                            {e.message}
                          </span>
                        ) : null}
                        <span className="ml-auto shrink-0 tabular-nums text-fg-muted">
                          {e.durationMs != null ? `${e.durationMs}ms` : ''}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : (
              <SectionError error={snap.recentEvents.error} />
            )}
          </section>
        </div>
      ) : null}

      {/* Honest scope note */}
      <section className="rounded-lg border border-border-subtle bg-bg-sunken/40 p-4">
        <h2 className="text-[12px] font-semibold text-fg-secondary">Not yet instrumented (Phase 1 honesty)</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-fg-muted">
          Now captured via <code className="font-mono text-[11px]">ops_events</code>: per-cron runs, trade-broadcast +
          provider failures, and auto-opened incidents. Still <strong>deliberately absent</strong> rather than mocked:
          full provider uptime %, webhook delivery history, deployment markers, request traces, and the read-only
          Pointer Doctor — the next Ops phase. This page still reports only what production can truthfully answer.
        </p>
      </section>
    </div>
  );
}
