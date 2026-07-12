'use client';

import { useEffect, useState } from 'react';
import type { SibylAnswer, SibylCard } from '@/sibyl/types';
import { CardRenderer } from '@/components/sibyl/SibylCards';
import { sibylSerif } from '@/components/sibyl/fonts';
import { TwitterProfileHoverTrigger } from '@/components/tokens/PulseRichPopovers';

/** Reveal `text` character-by-character when `enabled` — the "AI writing it out" feel. */
function useTypewriter(text: string, enabled: boolean): { shown: string; done: boolean } {
  const [shown, setShown] = useState(enabled ? '' : text);
  useEffect(() => {
    if (!enabled) {
      setShown(text);
      return;
    }
    setShown('');
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [text, enabled]);
  return { shown, done: shown.length >= text.length };
}

/** Cards read best in-flow in this order — token/chart lead, then structure. */
const CARD_ORDER: SibylCard['type'][] = ['token', 'chart', 'holders', 'risk', 'table', 'dune', 'narrative', 'social', 'similar', 'timeline', 'wallet', 'kol'];
function orderCards(cards: SibylCard[]): SibylCard[] {
  return [...cards].sort((a, b) => CARD_ORDER.indexOf(a.type) - CARD_ORDER.indexOf(b.type));
}

/** The CT-native answer block: verdict → confidence → why → action → inline cards. */
export function SibylAnswerView({ answer, typeOut = false }: { answer: SibylAnswer; typeOut?: boolean }) {
  const conf = Math.round(answer.confidence);
  const cards = orderCards(answer.cards);
  const { shown: verdictShown, done: verdictDone } = useTypewriter(answer.verdict, typeOut);

  // Conversational reply (greeting / smalltalk / meta) — plain prose, none of the
  // verdict/confidence/cards chrome (there's no subject to grade).
  if (answer.chat) {
    return (
      <div className="s-fg text-[14px] leading-relaxed">
        {verdictShown}
        {typeOut && !verdictDone ? <span className="ml-0.5 inline-block animate-pulse">▋</span> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* worked-through meta */}
      <div className="s-faint flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
          Worked through {answer.agentsRun.length} {answer.agentsRun.length === 1 ? 'agent' : 'agents'}
        </span>
        <span>·</span>
        <span className="capitalize">{answer.mode.replace('_', ' ').toLowerCase()}</span>
        {answer.agentsRun.length ? (
          <>
            <span>·</span>
            <span>{answer.agentsRun.join(' · ')}</span>
          </>
        ) : null}
        {answer.memory && answer.memory.seenCount > 0 ? (
          <span className="s-accent inline-flex items-center gap-1 rounded-full border s-border px-1.5 py-0.5 font-medium">
            ◆ Sibyl has analyzed this {answer.memory.seenCount}× before
          </span>
        ) : null}
      </div>

      {/* verdict — serif headline */}
      <div>
        <div className="s-faint text-[9px] font-semibold uppercase tracking-[0.18em]">Verdict</div>
        <div className={`${sibylSerif.className} s-fg mt-0.5 text-[26px] leading-[1.15] tracking-tight`}>
          {verdictShown}
          {typeOut && !verdictDone ? <span className="ml-0.5 inline-block animate-pulse">▋</span> : null}
        </div>
      </div>

      {/* confidence */}
      <div className="flex items-center gap-2.5">
        <div className="s-panel2 h-1.5 flex-1 overflow-hidden rounded-full">
          <div className={`h-full rounded-full ${conf >= 66 ? 'bg-emerald-400' : conf >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${conf}%` }} />
        </div>
        <span className="s-muted text-[11px] font-semibold tabular-nums">{conf}% confidence</span>
      </div>

      {/* why */}
      {answer.why.length > 0 ? (
        <ul className="space-y-1.5">
          {answer.why.map((w, i) => (
            <li key={i} className="s-fg flex gap-2.5 text-[13.5px] leading-relaxed">
              <span className="s-faint mt-[7px] h-1 w-1 shrink-0 rounded-full bg-current" />
              {w}
            </li>
          ))}
        </ul>
      ) : null}

      {/* action */}
      <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] px-3.5 py-2.5">
        <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-500">Action</div>
        <div className="s-fg mt-0.5 text-[13.5px] font-medium">{answer.action}</div>
      </div>

      {/* inline cards — charts / tables render in the answer */}
      {cards.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cards.map((c) => (
            <div key={c.id} className={c.type === 'chart' || c.type === 'table' ? 'sm:col-span-2' : ''}>
              <CardRenderer card={c} />
            </div>
          ))}
        </div>
      ) : null}

      {/* clickable entities (KOLs / wallets → X) — @handles get the rich X profile hover */}
      {answer.entities.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {answer.entities.map((e) => {
            const pill = (
              <a
                href={e.href ?? (e.handle ? `https://x.com/${e.handle}` : '#')}
                target="_blank"
                rel="noreferrer"
                className="inline-block rounded-full border border-sky-400/25 bg-sky-400/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-sky-500 transition hover:border-sky-400/50"
              >
                {e.handle ? `@${e.handle}` : e.label}
              </a>
            );
            return e.handle ? (
              <TwitterProfileHoverTrigger key={`${e.kind}:${e.id}`} handle={e.handle} side="top">
                {pill}
              </TwitterProfileHoverTrigger>
            ) : (
              <span key={`${e.kind}:${e.id}`}>{pill}</span>
            );
          })}
        </div>
      ) : null}

      {/* caveats */}
      {answer.caveats && answer.caveats.length > 0 ? (
        <div className="space-y-0.5 text-[11px] leading-relaxed text-amber-600">
          {answer.caveats.map((c, i) => (
            <div key={i}>⚠ {c}</div>
          ))}
        </div>
      ) : null}

      {/* sources */}
      <div className="s-border s-faint flex flex-wrap items-center gap-1.5 border-t pt-2.5 text-[10px]">
        <span className="uppercase tracking-wider">Sources</span>
        {answer.sources.map((s) =>
          s.url ? (
            <a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="s-panel2 s-muted rounded-md px-1.5 py-0.5 underline-offset-2 transition hover:underline hover:text-[var(--s-accent)]"
            >
              {s.label}
            </a>
          ) : (
            <span key={s.label} className="s-panel2 s-muted rounded-md px-1.5 py-0.5">{s.label}</span>
          ),
        )}
      </div>
    </div>
  );
}
