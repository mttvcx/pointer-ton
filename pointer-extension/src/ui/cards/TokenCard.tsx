import type { TokenIntel } from '@/pointer/types';
import { deepLinks } from '@/pointer/client';
import { apiBase } from '@/pointer/auth';

/** Compact USD / number formatting for the dense hover card. */
function usd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (a >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(3)}`;
}
function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function num(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${Math.round(n)}`;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'bull' | 'bear' }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: 'var(--fg-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {label}
      </div>
      <div
        style={{
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: tone === 'bull' ? 'var(--signal-bull)' : tone === 'bear' ? 'var(--signal-bear)' : 'var(--fg-primary)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function TokenCard({ data }: { data: TokenIntel }) {
  const base = apiBase();
  const up = (data.change24hPct ?? 0) >= 0;
  return (
    <div className="pt-card" style={{ padding: 14 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {data.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.iconUrl} alt="" width={32} height={32} style={{ borderRadius: 8 }} />
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-hover)' }} />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-primary)' }}>
            {data.symbol ?? `${data.mint.slice(0, 4)}…`}
          </div>
          <div style={{ color: 'var(--fg-muted)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.name ?? data.mint}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{usd(data.priceUsd)}</div>
          <div style={{ fontSize: 12, color: up ? 'var(--signal-bull)' : 'var(--signal-bear)' }}>
            {pct(data.change24hPct)}
          </div>
        </div>
      </div>

      {/* stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
        <Stat label="MC" value={usd(data.marketCapUsd)} />
        <Stat label="Liq" value={usd(data.liquidityUsd)} />
        <Stat label="Vol 24h" value={usd(data.volume24hUsd)} />
        <Stat label="Holders" value={num(data.holderCount)} />
        <Stat label="Top 10" value={data.top10Pct != null ? `${data.top10Pct.toFixed(1)}%` : '—'} />
        <Stat
          label="Age"
          value={data.ageDays != null ? (data.ageDays < 1 ? '<1d' : `${Math.round(data.ageDays)}d`) : '—'}
        />
      </div>

      {/* risk row */}
      {(data.bundlersPct != null || data.snipersPct != null) && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <Stat label="Bundlers" value={data.bundlersPct != null ? `${data.bundlersPct.toFixed(1)}%` : '—'} tone={data.bundlersPct && data.bundlersPct > 20 ? 'bear' : undefined} />
          <Stat label="Snipers" value={data.snipersPct != null ? `${data.snipersPct.toFixed(1)}%` : '—'} tone={data.snipersPct && data.snipersPct > 15 ? 'bear' : undefined} />
        </div>
      )}

      {/* actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <a
          href={deepLinks.quickBuy(base, data.mint)}
          target="_blank"
          rel="noreferrer"
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '8px 0',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 12,
            textDecoration: 'none',
            color: 'var(--bg-base)',
            background: 'var(--signal-bull)',
          }}
        >
          Quick Buy
        </a>
        <a
          href={deepLinks.token(base, data.mint)}
          target="_blank"
          rel="noreferrer"
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '8px 0',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 12,
            textDecoration: 'none',
            color: 'var(--fg-primary)',
            background: 'var(--bg-hover)',
          }}
        >
          Open in Pointer
        </a>
      </div>
    </div>
  );
}
