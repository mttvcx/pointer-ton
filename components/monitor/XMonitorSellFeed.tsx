'use client';

import { useEffect, useRef, useState } from 'react';
import { TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useXMonitorPreviewStore } from '@/store/xMonitorPreview';

type SellRow = {
  id: number;
  handle: string;
  token: string;
  ticker: string;
  sol: number;
  usd: number;
  pnlPct: number;
  ageSec: number;
};

const NAMES = ['cupsey', 'orangie', 'euris', 'mrfrog', 'waddles', 'jidn', 'kev', 'assasin', 'gh0stee', 'dv'];
const TOKENS: Array<[string, string]> = [
  ['Retardio', 'RETARDIO'],
  ['Fartcoin', 'FART'],
  ['Peanut', 'PNUT'],
  ['Moo Deng', 'MOODENG'],
  ['Goatseus', 'GOAT'],
  ['Chill Guy', 'CHILL'],
  ['Pudgy', 'PENGU'],
  ['Book of Meme', 'BOME'],
];

function makeSell(seq: number): SellRow {
  const n = NAMES[seq % NAMES.length] ?? 'trader';
  const [token, ticker] = TOKENS[(seq * 3) % TOKENS.length] ?? ['Token', 'TOKEN'];
  const sol = Number((0.4 + ((seq * 7) % 90) / 10).toFixed(2));
  const pnl = (((seq * 37) % 400) - 120) / 10;
  return {
    id: seq,
    handle: n,
    token,
    ticker,
    sol,
    usd: Math.round(sol * 168),
    pnlPct: Number(pnl.toFixed(1)),
    ageSec: (seq % 6) * 4,
  };
}

export function XMonitorSellFeed() {
  const preview = useXMonitorPreviewStore((s) => s.preview);
  const [rows, setRows] = useState<SellRow[]>([]);
  const seqRef = useRef(1);

  useEffect(() => {
    if (!preview) {
      setRows([]);
      return;
    }
    setRows(Array.from({ length: 8 }, (_, i) => makeSell(i + 1)));
    seqRef.current = 9;
    const id = window.setInterval(() => {
      setRows((prev) => [makeSell(seqRef.current++), ...prev].slice(0, 40));
    }, 4200);
    return () => window.clearInterval(id);
  }, [preview]);

  if (!preview) {
    return (
      <p className="px-3 py-6 text-center text-[11px] leading-relaxed text-fg-muted">
        No sells yet. Sells from tracked accounts appear here in real time once the feed is live.
        <br />
        <span className="text-fg-muted/70">Turn on Preview (beside Pulse/Stocks) to see sample flow.</span>
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1 p-1.5">
      {rows.map((r) => {
        const up = r.pnlPct >= 0;
        return (
          <li
            key={r.id}
            className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 transition-colors hover:bg-white/[0.06]"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-signal-bear/15 text-signal-bear">
              <TrendingDown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11.5px] text-white">
                <span className="font-semibold">@{r.handle}</span>{' '}
                <span className="text-fg-muted">sold</span>{' '}
                <span className="font-semibold">${r.ticker}</span>
              </p>
              <p className="text-[10px] text-fg-muted">
                {r.sol} SOL · ${r.usd.toLocaleString('en-US')} · {r.ageSec}s ago
              </p>
            </div>
            <span
              className={cn(
                'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                up ? 'bg-signal-bull/15 text-signal-bull' : 'bg-signal-bear/15 text-signal-bear',
              )}
            >
              {up ? '+' : ''}
              {r.pnlPct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}
