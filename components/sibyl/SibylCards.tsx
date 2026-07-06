'use client';

import type { SibylCard } from '@/sibyl/types';
import { TwitterProfileHoverTrigger, TwitterTweetHoverTrigger } from '@/components/tokens/PulseRichPopovers';

/* Liquid-glass surface: faint fill, hairline border, inner top-highlight + soft drop. */
const glass =
  'rounded-2xl s-panel s-border border backdrop-blur-2xl ' +
  'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_12px_40px_-16px_rgba(0,0,0,0.7)]';
const label = 'text-[10px] font-semibold uppercase tracking-[0.14em] s-faint';

function usd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toPrecision(3)}`;
}
const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

/** Smooth SVG area sparkline from a price series. Green if it ended up, red if down. */
function Sparkline({ points, height = 120 }: { points: number[]; height?: number }) {
  const w = 320;
  const h = height;
  const pad = 6;
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = (w - pad * 2) / (points.length - 1);
  const x = (i: number) => pad + i * stepX;
  const y = (v: number) => pad + (h - pad * 2) * (1 - (v - min) / span);
  const line = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`;
  const up = points[points.length - 1]! >= points[0]!;
  const stroke = up ? '#34d399' : '#fb7185';
  const gid = `spark-${up ? 'u' : 'd'}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-28 w-full">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function CardRenderer({ card }: { card: SibylCard }) {
  switch (card.type) {
    case 'token': {
      const d = card.data;
      const up = (d.change24hPct ?? 0) >= 0;
      return (
        <div className={`${glass} p-4`}>
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold s-fg">{d.symbol ?? short(d.mint)}</div>
              <div className="truncate text-[11px] s-faint">
                {d.name ?? short(d.mint)}
                {d.ageLabel ? ` · ${d.ageLabel}` : ''}
                {d.protocol ? ` · ${d.protocol}` : ''}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[14px] font-semibold tabular-nums s-fg">{usd(d.priceUsd)}</div>
              <div className={`text-[12px] font-medium ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
                {d.change24hPct != null ? `${up ? '+' : ''}${d.change24hPct.toFixed(1)}%` : '—'}
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              ['MC', usd(d.marketCapUsd)],
              ['Liq', usd(d.liquidityUsd)],
              ['Vol 24h', usd(d.volume24hUsd)],
            ].map(([k, v]) => (
              <div key={k}>
                <div className={label}>{k}</div>
                <div className="text-[13px] font-semibold tabular-nums s-fg">{v}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case 'chart': {
      const pts = card.data.points ?? [];
      const up = pts.length >= 2 && pts[pts.length - 1]! >= pts[0]!;
      return (
        <div className={`${glass} p-4`}>
          <div className="flex items-center justify-between">
            <div className={label}>
              {card.data.symbol ?? 'Price'} · {card.data.tf}
            </div>
            {pts.length >= 2 ? (
              <span className={`text-[11px] font-medium ${up ? 'text-emerald-400' : 'text-rose-400'}`}>{up ? '▲' : '▼'}</span>
            ) : null}
          </div>
          <div className="mt-2">
            {pts.length >= 2 ? (
              <Sparkline points={pts} />
            ) : (
              <div className="flex h-28 items-center justify-center text-[11px] s-faint">No candles yet</div>
            )}
          </div>
          <div className="mt-1 text-[10px] s-faint">
            {card.data.source.includes('sample') ? 'sample candles — live OHLCV wires in with Birdeye' : card.data.source}
          </div>
        </div>
      );
    }
    case 'holders': {
      const d = card.data;
      return (
        <div className={`${glass} p-4`}>
          <div className="flex items-center justify-between">
            <div className={label}>Holders</div>
            <div className="text-[11px] s-faint">Top-10 {d.top10Pct != null ? `${d.top10Pct.toFixed(0)}%` : '—'}</div>
          </div>
          <div className="mt-2 space-y-1">
            {d.rows.map((r) => (
              <div key={r.address} className="flex items-center gap-2 text-[12px]">
                <span className="w-4 s-faint">{r.rank}</span>
                <span className={`min-w-0 flex-1 truncate ${r.isKol ? 'text-sky-500' : 's-muted'}`}>{r.label ?? short(r.address)}</span>
                <span className={`tabular-nums ${r.pct >= 40 ? 'font-bold text-rose-400' : 's-muted'}`}>{r.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case 'wallet': {
      const d = card.data;
      return (
        <div className={`${glass} p-4`}>
          <div className={label}>Wallet</div>
          <div className="mt-1 text-[13px] font-semibold s-fg">{d.label ?? short(d.address)}</div>
          <div className="mt-2 flex gap-4 text-[12px]">
            {d.pnlUsd != null ? <span className="text-emerald-400">PnL {usd(d.pnlUsd)}</span> : null}
            {d.holdingPct != null ? <span className="s-muted">Holds {d.holdingPct.toFixed(0)}%</span> : null}
          </div>
        </div>
      );
    }
    case 'kol':
      return (
        <TwitterProfileHoverTrigger handle={card.data.handle} side="left">
          <a href={`https://x.com/${card.data.handle}`} target="_blank" rel="noreferrer" className={`${glass} block p-3 transition hover:opacity-90`}>
            <div className="text-[13px] font-semibold text-sky-500">@{card.data.handle}</div>
            <div className="text-[11px] s-faint">{card.data.note}</div>
          </a>
        </TwitterProfileHoverTrigger>
      );
    case 'narrative': {
      const d = card.data;
      return (
        <div className={`${glass} p-4`}>
          <div className="flex items-center justify-between">
            <div className={label}>Narrative</div>
            <span className="rounded-full border s-border px-2 py-0.5 text-[10px] capitalize s-muted">
              {d.stage}
              {d.strengthening ? ' ↑' : d.strengthening === false ? ' ↓' : ''}
            </span>
          </div>
          <div className="mt-1 text-[13px] font-semibold s-fg">{d.name}</div>
          <p className="mt-1 text-[12px] leading-relaxed s-muted">{d.summary}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(d.spread).map(([k, v]) => (
              <span key={k} className="rounded-md s-panel2 px-2 py-0.5 text-[10px] s-muted">
                {k} {v}
              </span>
            ))}
          </div>
          {d.originTweetUrl ? (
            <TwitterTweetHoverTrigger url={d.originTweetUrl} side="top">
              <a href={d.originTweetUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-sky-500 hover:underline">
                Origin tweet →
              </a>
            </TwitterTweetHoverTrigger>
          ) : null}
        </div>
      );
    }
    case 'dune':
      return (
        <div className={`${glass} p-4`}>
          <div className={label}>{card.data.title}</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {card.data.rows.map((r) => (
              <div key={r.label}>
                <div className="text-[10px] s-faint">{r.label}</div>
                <div className="text-[14px] font-semibold tabular-nums s-fg">{r.value}</div>
              </div>
            ))}
          </div>
        </div>
      );
    case 'table': {
      const d = card.data;
      return (
        <div className={`${glass} overflow-hidden p-4`}>
          {d.title ? <div className={`${label} mb-2`}>{d.title}</div> : null}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b s-border text-left">
                  {d.columns.map((c) => (
                    <th key={c} className="whitespace-nowrap py-1.5 pr-4 font-semibold s-faint">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.rows.map((row, i) => (
                  <tr key={i} className="border-b s-border last:border-0">
                    {row.map((cell, j) => (
                      <td key={j} className={`whitespace-nowrap py-1.5 pr-4 ${j === 0 ? 'font-medium s-fg' : 'tabular-nums s-muted'}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {d.note ? <div className="mt-2 text-[10px] s-faint">{d.note}</div> : null}
        </div>
      );
    }
    case 'risk': {
      const d = card.data;
      const tone = d.score >= 60 ? 'text-rose-400' : d.score >= 35 ? 'text-amber-400' : 'text-emerald-400';
      return (
        <div className={`${glass} p-4`}>
          <div className="flex items-center justify-between">
            <div className={label}>Risk</div>
            <div className={`text-[18px] font-bold tabular-nums ${tone}`}>{d.score}</div>
          </div>
          <div className="mt-2 space-y-1">
            {d.flags.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px]">
                <span className={`h-1.5 w-1.5 rounded-full ${f.severity === 'high' ? 'bg-rose-400' : f.severity === 'med' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <span className="s-muted">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case 'social': {
      const d = card.data;
      return (
        <div className={`${glass} p-4`}>
          <div className="flex items-center justify-between">
            <div className={label}>Social velocity</div>
            <span className="text-[11px] capitalize s-muted">
              {d.velocity} · {d.handleCount} in {d.window}
            </span>
          </div>
          <div className="mt-2 space-y-1">
            {d.kols.map((k) => (
              <TwitterProfileHoverTrigger key={k.handle} handle={k.handle} side="left">
                <a href={`https://x.com/${k.handle}`} target="_blank" rel="noreferrer" className="flex items-baseline gap-2 text-[12px] hover:underline">
                  <span className="text-sky-500">@{k.handle}</span>
                  <span className="s-faint">{k.note}</span>
                </a>
              </TwitterProfileHoverTrigger>
            ))}
          </div>
          {d.tweets && d.tweets.length > 0 ? (
            <div className="s-border mt-2.5 space-y-1 border-t pt-2.5">
              <div className={label}>Tweets driving it</div>
              {d.tweets.map((t) => (
                <TwitterTweetHoverTrigger key={t.url} url={t.url} side="left">
                  <a href={t.url} target="_blank" rel="noreferrer" className="flex items-baseline gap-2 text-[12px] hover:underline">
                    <span className="text-sky-500">{t.handle ? `@${t.handle}` : 'tweet'}</span>
                    <span className="s-faint">{t.note ?? 'view tweet'}</span>
                  </a>
                </TwitterTweetHoverTrigger>
              ))}
            </div>
          ) : null}
        </div>
      );
    }
    case 'timeline':
      return (
        <div className={`${glass} p-4`}>
          <div className={label}>Timeline</div>
          <div className="mt-2 space-y-1">
            {card.data.events.map((e, i) => (
              <div key={i} className="text-[12px] s-muted">
                <span className="s-faint">{e.at}</span> — {e.label}
              </div>
            ))}
          </div>
        </div>
      );
    case 'similar':
      return (
        <div className={`${glass} p-4`}>
          <div className={label}>Similar setups</div>
          <div className="mt-2 space-y-2">
            {card.data.items.map((it, i) => (
              <div key={i} className="text-[12px]">
                <div className="font-medium s-fg">{it.symbol}</div>
                <div className="s-faint">
                  {it.note}
                  {it.outcome ? ` → ${it.outcome}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
}
