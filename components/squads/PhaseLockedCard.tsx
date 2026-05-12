'use client';

import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Placeholder for Squads areas that are not wired yet — keeps an empty route purposeful.
 */
export function PhaseLockedCard({
  phase,
  title,
  intent,
  bullets,
  cta,
  className,
}: {
  phase: 'Phase 2' | 'Phase 3' | 'Phase 4' | 'Phase 5';
  title: string;
  intent: string;
  bullets?: ReadonlyArray<string>;
  cta?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-[#1f2835] bg-[#080d14]/90 p-4',
        className,
      )}
      aria-label={`${title} — ${phase}`}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#152232]/80 px-2 py-1 text-[10px] font-semibold tabular-nums text-[#93c5fd] ring-1 ring-inset ring-white/[0.08]">
          <Lock className="h-3 w-3 shrink-0" strokeWidth={2.2} aria-hidden />
          <span>Soon</span>
          <span className="sr-only">({phase})</span>
        </span>
        <h2 className="text-[14px] font-semibold text-fg-primary">{title}</h2>
      </div>
      <p className="text-[12px] leading-relaxed text-fg-secondary">{intent}</p>
      {bullets?.length ? (
        <ul className="grid gap-1 text-[11.5px] text-fg-muted">
          {bullets.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-[#5EBBFF]/70" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {cta ? <div className="pt-1">{cta}</div> : null}
    </div>
  );
}
