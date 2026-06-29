'use client';

import { useQuery } from '@tanstack/react-query';
import { useAdminFetch } from '@/lib/admin/useAdminApi';

type Row = { member: string; usd: number };
type Summary = {
  hourly: number;
  daily: number;
  monthly: number;
  caps: { hourly: number; daily: number; monthly: number };
  topUsers: Row[];
  topEndpoints: Row[];
  providers: Row[];
  error?: boolean;
};

const usd = (n: number) => `$${(n || 0).toFixed(2)}`;

function Meter({ label, spent, cap }: { label: string; spent: number; cap: number }) {
  const pct = cap > 0 ? Math.min(100, (spent / cap) * 100) : 0;
  const tone = pct >= 90 ? 'bg-signal-bear' : pct >= 70 ? 'bg-yellow-400' : 'bg-signal-bull';
  return (
    <div className="rounded-md border border-border-subtle bg-bg-raised p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{label}</span>
        <span className="text-[12px] tabular-nums text-fg-secondary">
          {usd(spent)} <span className="text-fg-muted">/ {usd(cap)}</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg-sunken">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-right text-[10px] tabular-nums text-fg-muted">{pct.toFixed(0)}%</p>
    </div>
  );
}

function Leaderboard({ title, rows, mono }: { title: string; rows: Row[]; mono?: boolean }) {
  return (
    <section className="rounded-md border border-border-subtle bg-bg-raised">
      <div className="border-b border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        {title}
      </div>
      {rows.length === 0 ? (
        <p className="p-3 text-[12px] text-fg-muted">No spend today.</p>
      ) : (
        <div className="divide-y divide-border-subtle/40">
          {rows.map((r) => (
            <div key={r.member} className="flex items-center justify-between px-3 py-1.5 text-[12px]">
              <span className={'min-w-0 truncate text-fg-secondary ' + (mono ? 'font-mono' : '')}>{r.member}</span>
              <span className="shrink-0 tabular-nums text-fg-primary">{usd(r.usd)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AdminAiSpendPage() {
  const adminFetch = useAdminFetch();
  const q = useQuery({
    queryKey: ['admin-ai-spend'],
    queryFn: async (): Promise<Summary> => {
      const r = await adminFetch('/api/admin/ai-spend');
      if (!r.ok) throw new Error(`ai_spend_${r.status}`);
      return (await r.json()) as Summary;
    },
    refetchInterval: 15_000,
  });
  const s = q.data;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-lg font-semibold text-fg-primary">AI spend</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Organization-wide AI cost vs the hard ceilings. Spend is reserved atomically before each model call and
          settled to the real cost; ceilings fail closed. Caps are env-configurable
          (<code>AI_GLOBAL_HOURLY/DAILY/MONTHLY_USD</code>).
        </p>
      </header>

      {s?.error ? <p className="text-[13px] text-signal-bear">Spend store unreachable.</p> : null}

      {s ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Meter label="This hour" spent={s.hourly} cap={s.caps.hourly} />
            <Meter label="Today" spent={s.daily} cap={s.caps.daily} />
            <Meter label="This month" spent={s.monthly} cap={s.caps.monthly} />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Leaderboard title="Top users (today)" rows={s.topUsers} mono />
            <Leaderboard title="Top endpoints (today)" rows={s.topEndpoints} />
            <Leaderboard title="Providers (today)" rows={s.providers} mono />
          </div>
        </>
      ) : (
        <p className="text-sm text-fg-muted">Loading spend…</p>
      )}
    </div>
  );
}
