'use client';

import type { SibylAnswer } from '@/sibyl/types';

/** The CT-native answer block: verdict → confidence → why → action, then entities. */
export function SibylAnswerView({ answer }: { answer: SibylAnswer }) {
  const conf = Math.round(answer.confidence);
  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Verdict</div>
        <div className="text-[17px] font-semibold leading-snug text-white">{answer.verdict}</div>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full ${conf >= 66 ? 'bg-emerald-400' : conf >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${conf}%` }} />
        </div>
        <span className="text-[11px] font-semibold tabular-nums text-white/60">{conf}%</span>
      </div>

      {answer.why.length > 0 ? (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Why</div>
          <ul className="mt-1 space-y-1">
            {answer.why.map((w, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-white/75"><span className="text-white/25">–</span>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/70">Action</div>
        <div className="text-[13px] font-medium text-white/90">{answer.action}</div>
      </div>

      {answer.entities.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {answer.entities.map((e) => (
            <a
              key={`${e.kind}:${e.id}`}
              href={e.href ?? (e.handle ? `https://x.com/${e.handle}` : '#')}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-sky-400/25 bg-sky-400/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-sky-300 transition hover:border-sky-400/50"
            >
              {e.handle ? `@${e.handle}` : e.label}
            </a>
          ))}
        </div>
      ) : null}

      {answer.caveats && answer.caveats.length > 0 ? (
        <div className="text-[11px] leading-relaxed text-amber-300/70">
          {answer.caveats.map((c, i) => (
            <div key={i}>⚠ {c}</div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-white/35">
        <span>{answer.mode.replace('_', ' ').toLowerCase()}</span>
        <span>·</span>
        <span>agents: {answer.agentsRun.join(', ')}</span>
        <span>·</span>
        <span>sources: {answer.sources.map((s) => s.label).join(', ')}</span>
      </div>
    </div>
  );
}
