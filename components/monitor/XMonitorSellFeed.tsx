'use client';

import { useEffect, useRef, useState } from 'react';
import { TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useXMonitorPreviewStore } from '@/store/xMonitorPreview';

/**
 * X-Monitor Sell feed = YOUR OWN automation sells — the exits taken by the
 * X-monitor auto-buy / auto-launch pipeline (take-profit, trailing/stop, manual
 * close of an auto-bought bag). NOT a feed of other traders' buys/sells (that's
 * the wallet tracker). Real data lands here when the delegated auto-exec engine
 * fires (auto_exec_ledger, kind='sell'); until then it's empty + a preview sample.
 */

type AutoSellRow = {
  id: number;
  ticker: string;
  source: string;
  sol: number;
  usd: number;
  pnlPct: number;
  ageSec: number;
};

const TICKERS = ['MOODENG', 'FART', 'PNUT', 'GOAT', 'CHILL', 'PENGU', 'BOME', 'RETARDIO'];
/** Which automation produced the exit. */
const SOURCES = ['CA rule', 'Keyword rule', 'Auto-launch', 'Trailing stop', 'Take-profit'];

function makeAutoSell(seq: number): AutoSellRow {
  const ticker = TICKERS[(seq * 3) % TICKERS.length] ?? 'TOKEN';
  const source = SOURCES[seq % SOURCES.length] ?? 'Rule';
  const sol = Number((0.4 + ((seq * 7) % 90) / 10).toFixed(2));
  const pnl = (((seq * 37) % 400) - 120) / 10;
  return {
    id: seq,
    ticker,
    source,
    sol,
    usd: Math.round(sol * 168),
    pnlPct: Number(pnl.toFixed(1)),
    ageSec: (seq % 6) * 4,
  };
}

export function XMonitorSellFeed() {
  const preview = useXMonitorPreviewStore((s) => s.preview);
  const [rows, setRows] = useState<AutoSellRow[]>([]);
  const seqRef = useRef(1);

  useEffect(() => {
    if (!preview) {
      setRows([]);
      return;
    }
    setRows(Array.from({ length: 8 }, (_, i) => makeAutoSell(i + 1)));
    seqRef.current = 9;
    const id = window.setInterval(() => {
      setRows((prev) => [makeAutoSell(seqRef.current++), ...prev].slice(0, 40));
    }, 4200);
    return () => window.clearInterval(id);
  }, [preview]);

  if (!preview) {
    return (
      <p className="px-3 py-6 text-center text-[11px] leading-relaxed text-fg-muted">
        No automation sells yet. When your X-monitor auto-buys and auto-launches take profit or stop
        out, those exits show here.
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
                <span className="text-fg-muted">Auto-sold</span>{' '}
                <span className="font-semibold">${r.ticker}</span>{' '}
                <span className="text-fg-muted">· via {r.source}</span>
              </p>
              <p className="text-[10px] text-fg-muted">
                {r.sol} SOL out · ${r.usd.toLocaleString('en-US')} · {r.ageSec}s ago
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
