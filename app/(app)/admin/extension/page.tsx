'use client';

import { EXTENSION_READINESS, summarizeReadiness, type ReadinessStatus } from '@/lib/extension/readiness';
import { cn } from '@/lib/utils/cn';

const STATUS_TONE: Record<ReadinessStatus, string> = {
  done: 'border-signal-bull/40 bg-signal-bull/10 text-signal-bull',
  in_progress: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400',
  blocked: 'border-signal-bear/40 bg-signal-bear/10 text-signal-bear',
  todo: 'border-border-subtle bg-bg-sunken text-fg-muted',
};
const STATUS_LABEL: Record<ReadinessStatus, string> = {
  done: 'Done',
  in_progress: 'In progress',
  blocked: 'Blocked',
  todo: 'To do',
};
const CATEGORY_LABEL: Record<string, string> = {
  injection: 'Injection surfaces',
  chrome: 'Chrome platform',
  auth: 'Auth / session bridge',
  release: 'Release',
};

export default function AdminExtensionPage() {
  const s = summarizeReadiness();
  const categories = ['injection', 'chrome', 'auth', 'release'] as const;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-lg font-semibold text-fg-primary">Extension readiness</h1>
        <p className="mt-1 text-sm text-fg-muted">
          The gate to start Pointer Extension development. Work begins only when Pointer itself is production-ready and
          every item here is <span className="text-signal-bull">done</span>.
        </p>
      </header>

      <div className="rounded-md border border-border-subtle bg-bg-raised p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-fg-muted">Overall</span>
          <span className="text-[13px] tabular-nums text-fg-secondary">
            {s.done}/{s.total} done · {s.percent}%
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-bg-sunken">
          <div className={cn('h-full', s.ready ? 'bg-signal-bull' : 'bg-yellow-400')} style={{ width: `${s.percent}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-fg-muted">
          <span>{s.in_progress} in progress</span>
          <span className="text-signal-bear">{s.blocked} blocked</span>
          <span>{s.todo} to do</span>
          <span className={cn('ml-auto font-semibold', s.ready ? 'text-signal-bull' : 'text-fg-muted')}>
            {s.ready ? 'READY' : 'NOT READY'}
          </span>
        </div>
      </div>

      {categories.map((cat) => {
        const items = EXTENSION_READINESS.filter((i) => i.category === cat);
        if (items.length === 0) return null;
        return (
          <section key={cat} className="rounded-md border border-border-subtle bg-bg-raised">
            <div className="border-b border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
              {CATEGORY_LABEL[cat]}
            </div>
            <div className="divide-y divide-border-subtle/40">
              {items.map((i) => (
                <div key={i.key} className="flex items-start gap-3 px-3 py-2.5">
                  <span
                    className={cn(
                      'mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      STATUS_TONE[i.status],
                    )}
                  >
                    {STATUS_LABEL[i.status]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-fg-primary">{i.label}</p>
                    {i.note ? <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">{i.note}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
