'use client';

import type { SibylCard } from '@/sibyl/types';

const glass = 'rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl';
const label = 'text-[10px] font-semibold uppercase tracking-wider text-white/40';

function usd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toPrecision(3)}`;
}
const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

export function CardRenderer({ card }: { card: SibylCard }) {
  switch (card.type) {
    case 'token': {
      const d = card.data;
      const up = (d.change24hPct ?? 0) >= 0;
      return (
        <div className={`${glass} p-4`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[15px] font-semibold text-white">{d.symbol ?? short(d.mint)}</div>
              <div className="text-[11px] text-white/45">{d.name ?? short(d.mint)}{d.ageLabel ? ` · ${d.ageLabel}` : ''}{d.protocol ? ` · ${d.protocol}` : ''}</div>
            </div>
            <div className="text-right">
              <div className="text-[14px] font-semibold tabular-nums text-white">{usd(d.priceUsd)}</div>
              <div className={`text-[12px] font-medium ${up ? 'text-emerald-400' : 'text-rose-400'}`}>{d.change24hPct != null ? `${up ? '+' : ''}${d.change24hPct.toFixed(1)}%` : '—'}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[['MC', usd(d.marketCapUsd)], ['Liq', usd(d.liquidityUsd)], ['Vol 24h', usd(d.volume24hUsd)]].map(([k, v]) => (
              <div key={k}><div className={label}>{k}</div><div className="text-[13px] font-semibold tabular-nums text-white/90">{v}</div></div>
            ))}
          </div>
        </div>
      );
    }
    case 'chart':
      return (
        <div className={`${glass} p-4`}>
          <div className={label}>Chart · {card.data.symbol ?? ''} · {card.data.tf}</div>
          <div className="mt-2 flex h-28 items-end gap-[3px]">
            {Array.from({ length: 40 }, (_, i) => {
              const h = 20 + ((i * 37) % 70);
              const green = ((i * 13) % 5) < 3;
              return <div key={i} className={`flex-1 rounded-sm ${green ? 'bg-emerald-400/60' : 'bg-rose-400/50'}`} style={{ height: `${h}%` }} />;
            })}
          </div>
          <div className="mt-1 text-[10px] text-white/35">{card.data.source} — live candles wire in with Birdeye/Helius</div>
        </div>
      );
    case 'holders': {
      const d = card.data;
      return (
        <div className={`${glass} p-4`}>
          <div className="flex items-center justify-between"><div className={label}>Holders</div><div className="text-[11px] text-white/50">Top-10 {d.top10Pct != null ? `${d.top10Pct.toFixed(0)}%` : '—'}</div></div>
          <div className="mt-2 space-y-1">
            {d.rows.map((r) => (
              <div key={r.address} className="flex items-center gap-2 text-[12px]">
                <span className="w-4 text-white/35">{r.rank}</span>
                <span className={`min-w-0 flex-1 truncate ${r.isKol ? 'text-sky-300' : 'text-white/80'}`}>{r.label ?? short(r.address)}</span>
                <span className={`tabular-nums ${r.pct >= 40 ? 'font-bold text-rose-400' : 'text-white/70'}`}>{r.pct.toFixed(1)}%</span>
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
          <div className="mt-1 text-[13px] font-semibold text-white">{d.label ?? short(d.address)}</div>
          <div className="mt-2 flex gap-4 text-[12px]">
            {d.pnlUsd != null ? <span className="text-emerald-400">PnL {usd(d.pnlUsd)}</span> : null}
            {d.holdingPct != null ? <span className="text-white/70">Holds {d.holdingPct.toFixed(0)}%</span> : null}
          </div>
        </div>
      );
    }
    case 'kol':
      return (
        <a href={`https://x.com/${card.data.handle}`} target="_blank" rel="noreferrer" className={`${glass} block p-3 transition hover:border-white/20`}>
          <div className="text-[13px] font-semibold text-sky-300">@{card.data.handle}</div>
          <div className="text-[11px] text-white/50">{card.data.note}</div>
        </a>
      );
    case 'narrative': {
      const d = card.data;
      return (
        <div className={`${glass} p-4`}>
          <div className="flex items-center justify-between"><div className={label}>Narrative</div><span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] capitalize text-white/70">{d.stage}{d.strengthening ? ' ↑' : d.strengthening === false ? ' ↓' : ''}</span></div>
          <div className="mt-1 text-[13px] font-semibold text-white">{d.name}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-white/60">{d.summary}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(d.spread).map(([k, v]) => (
              <span key={k} className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/55">{k} {v}</span>
            ))}
          </div>
        </div>
      );
    }
    case 'dune':
      return (
        <div className={`${glass} p-4`}>
          <div className={label}>{card.data.title}</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {card.data.rows.map((r) => (
              <div key={r.label}><div className="text-[10px] text-white/40">{r.label}</div><div className="text-[14px] font-semibold tabular-nums text-white">{r.value}</div></div>
            ))}
          </div>
        </div>
      );
    case 'risk': {
      const d = card.data;
      const tone = d.score >= 60 ? 'text-rose-400' : d.score >= 35 ? 'text-amber-400' : 'text-emerald-400';
      return (
        <div className={`${glass} p-4`}>
          <div className="flex items-center justify-between"><div className={label}>Risk</div><div className={`text-[18px] font-bold tabular-nums ${tone}`}>{d.score}</div></div>
          <div className="mt-2 space-y-1">
            {d.flags.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px]">
                <span className={`h-1.5 w-1.5 rounded-full ${f.severity === 'high' ? 'bg-rose-400' : f.severity === 'med' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <span className="text-white/70">{f.label}</span>
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
          <div className="flex items-center justify-between"><div className={label}>Social velocity</div><span className="text-[11px] capitalize text-white/60">{d.velocity} · {d.handleCount} in {d.window}</span></div>
          <div className="mt-2 space-y-1">
            {d.kols.map((k) => (
              <a key={k.handle} href={`https://x.com/${k.handle}`} target="_blank" rel="noreferrer" className="flex items-baseline gap-2 text-[12px] hover:underline">
                <span className="text-sky-300">@{k.handle}</span><span className="text-white/45">{k.note}</span>
              </a>
            ))}
          </div>
        </div>
      );
    }
    case 'timeline':
      return (
        <div className={`${glass} p-4`}>
          <div className={label}>Timeline</div>
          <div className="mt-2 space-y-1">{card.data.events.map((e, i) => <div key={i} className="text-[12px] text-white/70"><span className="text-white/40">{e.at}</span> — {e.label}</div>)}</div>
        </div>
      );
    case 'similar':
      return (
        <div className={`${glass} p-4`}>
          <div className={label}>Similar setups</div>
          <div className="mt-2 space-y-2">
            {card.data.items.map((it, i) => (
              <div key={i} className="text-[12px]"><div className="font-medium text-white/85">{it.symbol}</div><div className="text-white/50">{it.note}{it.outcome ? ` → ${it.outcome}` : ''}</div></div>
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
}
