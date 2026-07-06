'use client';

import type { SibylAnswer, SibylCard } from '@/sibyl/types';
import { CardRenderer } from '@/components/sibyl/SibylCards';
import { sibylSerif } from '@/components/sibyl/fonts';

/** Cards read best in-flow in this order — token/chart lead, then structure. */
const CARD_ORDER: SibylCard['type'][] = ['token', 'chart', 'holders', 'risk', 'table', 'dune', 'narrative', 'social', 'similar', 'timeline', 'wallet', 'kol'];
function orderCards(cards: SibylCard[]): SibylCard[] {
  return [...cards].sort((a, b) => CARD_ORDER.indexOf(a.type) - CARD_ORDER.indexOf(b.type));
}

/** The CT-native answer block: verdict → confidence → why → action → inline cards. */
export function SibylAnswerView({ answer }: { answer: SibylAnswer }) {
  const conf = Math.round(answer.confidence);
  const cards = orderCards(answer.cards);
  return (
    <div className="space-y-4">
      {/* worked-through meta (Perplexity-style) */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-white/35">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
          Worked through {answer.agentsRun.length} {answer.agentsRun.length === 1 ? 'agent' : 'agents'}
        </span>
        <span>·</span>
        <span className="capitalize">{answer.mode.replace('_', ' ').toLowerCase()}</span>
        {answer.agentsRun.length ? (
          <>
            <span>·</span>
            <span className="text-white/25">{answer.agentsRun.join(' · ')}</span>
          </>
        ) : null}
      </div>

      {/* verdict — serif, the headline */}
      <div>
        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35">Verdict</div>
        <div className={`${sibylSerif.className} mt-0.5 text-[26px] leading-[1.15] tracking-tight text-white`}>{answer.verdict}</div>
      </div>

      {/* confidence */}
      <div className="flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className={`h-full rounded-full ${conf >= 66 ? 'bg-emerald-400' : conf >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`}
            style={{ width: `${conf}%` }}
          />
        </div>
        <span className="text-[11px] font-semibold tabular-nums text-white/55">{conf}% confidence</span>
      </div>

      {/* why */}
      {answer.why.length > 0 ? (
        <ul className="space-y-1.5">
          {answer.why.map((w, i) => (
            <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-white/80">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-white/30" />
              {w}
            </li>
          ))}
        </ul>
      ) : null}

      {/* action */}
      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3.5 py-2.5">
        <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-300/70">Action</div>
        <div className="mt-0.5 text-[13.5px] font-medium text-white/90">{answer.action}</div>
      </div>

      {/* inline cards — charts / tables / holders render right in the answer */}
      {cards.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cards.map((c) => (
            <div key={c.id} className={c.type === 'chart' || c.type === 'table' ? 'sm:col-span-2' : ''}>
              <CardRenderer card={c} />
            </div>
          ))}
        </div>
      ) : null}

      {/* clickable entities (KOLs / wallets → X) */}
      {answer.entities.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {answer.entities.map((e) => (
            <a
              key={`${e.kind}:${e.id}`}
              href={e.href ?? (e.handle ? `https://x.com/${e.handle}` : '#')}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-sky-400/20 bg-sky-400/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-sky-300 transition hover:border-sky-400/50"
            >
              {e.handle ? `@${e.handle}` : e.label}
            </a>
          ))}
        </div>
      ) : null}

      {/* caveats */}
      {answer.caveats && answer.caveats.length > 0 ? (
        <div className="space-y-0.5 text-[11px] leading-relaxed text-amber-300/70">
          {answer.caveats.map((c, i) => (
            <div key={i}>⚠ {c}</div>
          ))}
        </div>
      ) : null}

      {/* sources */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-2.5 text-[10px] text-white/30">
        <span className="uppercase tracking-wider">Sources</span>
        {answer.sources.map((s) => (
          <span key={s.label} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-white/45">{s.label}</span>
        ))}
      </div>
    </div>
  );
}
