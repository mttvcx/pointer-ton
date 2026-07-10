import type { WalletIntel } from '@/pointer/types';
import { deepLinks } from '@/pointer/client';
import { apiBase } from '@/pointer/auth';

/**
 * Wallet dossier hover card — shown when the hovered address is a wallet (no token
 * market), not a contract. Mirrors the TokenCard's density/theme so the two read
 * as one system. Data from `/api/ext/wallet/[address]`.
 */

const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

function usd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  const s = n < 0 ? '−' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}K`;
  if (a >= 1) return `${s}$${a.toFixed(2)}`;
  return `${s}$${a.toPrecision(3)}`;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'bull' | 'bear' }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: 'var(--fg-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
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

export function WalletCard({ data }: { data: WalletIntel }) {
  const base = apiBase();
  const realized = data.realizedPnlUsd;
  const tone = realized == null ? undefined : realized >= 0 ? 'bull' : 'bear';

  return (
    <div className="pt-card" style={{ padding: 14 }}>
      {/* header — clearly a WALLET, not a token */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--bg-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="var(--fg-muted)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7h15a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2h11" />
            <path d="M16 12h.01" />
          </svg>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {short(data.address)}
            </span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#c8ccff', background: 'rgba(124,131,255,0.16)', border: '1px solid rgba(124,131,255,0.4)', borderRadius: 999, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Wallet
            </span>
          </div>
          <div style={{ color: 'var(--fg-muted)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.labels?.[0] ?? data.behavior ?? data.favoriteEcosystem ?? 'On-chain wallet'}
          </div>
        </div>
      </div>

      {/* stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
        <Stat label="Net worth" value={usd(data.netWorthUsd)} />
        <Stat label="Realized" value={usd(realized)} tone={tone} />
        <Stat label="Unrealized" value={usd(data.unrealizedPnlUsd)} tone={data.unrealizedPnlUsd == null ? undefined : data.unrealizedPnlUsd >= 0 ? 'bull' : 'bear'} />
      </div>

      {(data.recentBuys?.length || data.recentSells?.length) ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {data.recentBuys?.slice(0, 3).map((b) => (
            <span key={`b${b.mint}`} style={{ fontSize: 11, fontWeight: 600, color: 'var(--signal-bull)', background: 'rgba(61,220,151,0.1)', borderRadius: 6, padding: '2px 7px' }}>
              ↑ {b.symbol ?? short(b.mint)}
            </span>
          ))}
          {data.recentSells?.slice(0, 3).map((s) => (
            <span key={`s${s.mint}`} style={{ fontSize: 11, fontWeight: 600, color: 'var(--signal-bear)', background: 'rgba(244,97,95,0.1)', borderRadius: 6, padding: '2px 7px' }}>
              ↓ {s.symbol ?? short(s.mint)}
            </span>
          ))}
        </div>
      ) : null}

      <a
        href={deepLinks.wallet(base, data.address)}
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'block',
          textAlign: 'center',
          padding: '8px 0',
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 12,
          textDecoration: 'none',
          color: 'var(--fg-primary)',
          background: 'var(--bg-hover)',
        }}
      >
        Open wallet in Pointer
      </a>
    </div>
  );
}
