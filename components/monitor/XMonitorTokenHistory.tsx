'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Rocket, ShoppingCart, Eye } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useXMonitorPreviewStore } from '@/store/xMonitorPreview';

type HistKind = 'launched' | 'bought' | 'watched';
type HistRow = {
  id: number;
  name: string;
  ticker: string;
  image: string;
  mcUsd: number;
  ageMin: number;
  kind: HistKind;
};

const SEED: Array<[string, string, HistKind]> = [
  ['Retardio', 'RETARDIO', 'launched'],
  ['Fartcoin', 'FART', 'bought'],
  ['Moo Deng', 'MOODENG', 'watched'],
  ['Chill Guy', 'CHILL', 'bought'],
  ['Goatseus', 'GOAT', 'launched'],
  ['Peanut', 'PNUT', 'watched'],
  ['Pudgy Penguins', 'PENGU', 'bought'],
  ['Book of Meme', 'BOME', 'launched'],
];

function makeRows(): HistRow[] {
  return SEED.map(([name, ticker, kind], i) => ({
    id: i + 1,
    name,
    ticker,
    image: `https://picsum.photos/seed/pt-hist-${ticker}/64`,
    mcUsd: Math.round((12 + i * 37) * 1000 * (i % 3 === 0 ? 90 : 12)),
    ageMin: (i + 1) * 7,
    kind,
  }));
}

const KIND_META: Record<HistKind, { label: string; icon: typeof Rocket; cls: string }> = {
  launched: { label: 'Launched', icon: Rocket, cls: 'bg-accent-primary/15 text-accent-primary' },
  bought: { label: 'Bought', icon: ShoppingCart, cls: 'bg-signal-bull/15 text-signal-bull' },
  watched: { label: 'Watched', icon: Eye, cls: 'bg-white/10 text-fg-secondary' },
};

function fmtMc(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export function XMonitorTokenHistory() {
  const preview = useXMonitorPreviewStore((s) => s.preview);
  const [rows, setRows] = useState<HistRow[]>([]);

  useEffect(() => {
    setRows(preview ? makeRows() : []);
  }, [preview]);

  if (!preview) {
    return (
      <p className="px-3 py-6 text-center text-[11px] leading-relaxed text-fg-muted">
        Tokens you launch, buy, or watch from the monitor show up here.
        <br />
        <span className="text-fg-muted/70">Turn on Preview to see sample history.</span>
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1 p-1.5">
      {rows.map((r) => {
        const meta = KIND_META[r.kind];
        const Icon = meta.icon;
        return (
          <li
            key={r.id}
            className="flex items-center gap-2.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 transition-colors hover:bg-white/[0.06]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={r.image}
              alt=""
              referrerPolicy="no-referrer"
              className="h-9 w-9 shrink-0 rounded-md object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-white">
                {r.name} <span className="text-fg-muted">${r.ticker}</span>
              </p>
              <p className="text-[10px] text-fg-muted">
                {fmtMc(r.mcUsd)} MC · {r.ageMin}m ago
              </p>
            </div>
            <span className={cn('inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide', meta.cls)}>
              <Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
              {meta.label}
            </span>
          </li>
        );
      })}
      <li className="px-1 pt-1 text-center">
        <Link href="/portfolio" className="text-[10px] text-fg-muted hover:text-accent-primary hover:underline">
          View full history →
        </Link>
      </li>
    </ul>
  );
}
