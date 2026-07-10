import { useState } from 'react';
import type { TokenIntel } from '@/pointer/types';
import { deepLinks, pointer } from '@/pointer/client';
import { apiBase } from '@/pointer/auth';

/**
 * Free-tier "AI recap" — a Grok-powered 24h X-native narrative (why it moved +
 * sentiment), fetched on demand so the hover stays cheap. Collapsed by default;
 * expands the card downward. Soft-degrades when the recap engine isn't configured.
 */
function AiRecap({ mint }: { mint: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'empty' | 'error'>('idle');
  const [text, setText] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  const load = async () => {
    if (state === 'loading') return;
    setState('loading');
    const res = await pointer.ai('recap', mint);
    if (res.ok && res.data.ai?.summary) {
      setText(res.data.ai.summary);
      setModel(res.data.ai.model ?? null);
      setState('done');
    } else if (res.ok) {
      setState('empty');
    } else {
      setState('error');
    }
  };

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))', paddingTop: 10 }}>
      {state === 'idle' && (
        <button
          type="button"
          onClick={load}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            width: '100%',
            justifyContent: 'center',
            padding: '8px 0',
            borderRadius: 8,
            cursor: 'pointer',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
            background: 'var(--bg-hover)',
            color: 'var(--fg-primary)',
            font: 'inherit',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <span aria-hidden>✦</span> AI recap · last 24h
        </button>
      )}

      {state === 'loading' && (
        <div style={{ color: 'var(--fg-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px' }}>
          <span className="pt-spin" style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--fg-muted)', borderTopColor: 'transparent', display: 'inline-block' }} />
          Reading the last 24h on X…
        </div>
      )}

      {state === 'done' && text && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ color: 'var(--fg-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>
              AI recap · 24h
            </span>
            {model ? (
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--fg-muted)', border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))', borderRadius: 5, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                {model}
              </span>
            ) : null}
          </div>
          <p style={{ margin: 0, color: 'var(--fg-secondary, #cbd5e1)', fontSize: 12.5, lineHeight: 1.55 }}>{text}</p>
        </div>
      )}

      {state === 'empty' && (
        <div style={{ color: 'var(--fg-muted)', fontSize: 11.5, padding: '2px' }}>AI recap isn’t available for this token right now.</div>
      )}

      {state === 'error' && (
        <button type="button" onClick={load} style={{ color: 'var(--signal-bull)', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 12, padding: 2 }}>
          Couldn’t load — retry
        </button>
      )}
    </div>
  );
}

const shortMint = (m: string) => (m.length > 12 ? `${m.slice(0, 4)}…${m.slice(-4)}` : m);

/** Copy-to-clipboard control for the contract address. Actually copies (with a
 *  fallback for shadow-DOM/content-script contexts) — never navigates. */
function CopyCa({ mint }: { mint: string }) {
  const [done, setDone] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const flash = () => {
      setDone(true);
      window.setTimeout(() => setDone(false), 1200);
    };
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = mint;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      ta.remove();
      flash();
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(mint).then(flash, fallback);
    else fallback();
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy contract address"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 9px',
        borderRadius: 8,
        cursor: 'pointer',
        border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
        background: 'var(--bg-hover)',
        color: done ? 'var(--signal-bull)' : 'var(--fg-muted)',
        font: 'inherit',
        fontSize: 11,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span>{shortMint(mint)}</span>
      {done ? (
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
      ) : (
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg>
      )}
      <span style={{ color: done ? 'var(--signal-bull)' : 'var(--fg-muted)' }}>{done ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

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

      {/* contract address — copy (never navigates) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ color: 'var(--fg-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 700 }}>CA</span>
        <CopyCa mint={data.mint} />
      </div>

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

      {/* Free-tier Grok 24h recap — expands on demand */}
      <AiRecap mint={data.mint} />
    </div>
  );
}
