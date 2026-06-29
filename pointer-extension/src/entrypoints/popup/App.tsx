import { useCallback, useEffect, useState } from 'react';
import { pointer } from '@/pointer/client';
import { apiBase } from '@/pointer/auth';
import type { ExtMe } from '@/pointer/types';

type State = { phase: 'loading' } | { phase: 'disconnected' } | { phase: 'connected'; me: ExtMe };

const SITES = ['X', 'DexScreener', 'Solscan', 'Axiom', 'Pump.fun', 'GMGN', 'Photon', 'BullX'];

export function PopupApp() {
  const [state, setState] = useState<State>({ phase: 'loading' });

  const refresh = useCallback(async () => {
    const res = await pointer.me();
    if (res.ok && (res.data as ExtMe).connected) setState({ phase: 'connected', me: res.data as ExtMe });
    else setState({ phase: 'disconnected' });
  }, []);

  useEffect(() => {
    void refresh();
    const onVis = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVis);
    const id = window.setInterval(() => void refresh(), 2500);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(id);
    };
  }, [refresh]);

  return (
    <div style={{ width: 340, padding: 16, boxSizing: 'border-box' }}>
      <Brand />

      {state.phase === 'loading' && (
        <div style={{ ...card, color: 'var(--fg-muted)', fontSize: 13 }}>Checking connection…</div>
      )}

      {state.phase === 'disconnected' && (
        <>
          <p style={lead}>Crypto intelligence on every page you browse. Connect to see it live.</p>
          <Primary onClick={() => void pointer.connect()}>Connect Pointer</Primary>
          <Footnote>Read-only — Pointer can never move your funds.</Footnote>
        </>
      )}

      {state.phase === 'connected' && (
        <>
          <div style={card}>
            <RowTop>
              <Dot /> <span style={{ fontWeight: 600 }}>Connected</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-muted)' }}>
                {apiBase().replace(/^https?:\/\//, '')}
              </span>
            </RowTop>
            <Divider />
            <Row label="AI access" value={state.me.aiAccess ? 'Unlocked' : 'Locked'} good={state.me.aiAccess} />
            <Row label="Plan" value={state.me.subscription === 'none' ? 'Free' : cap(state.me.subscription)} />
            {!state.me.aiAccess && (
              <p style={hint}>Hold ≥5 SOL across tracked wallets, or subscribe, to unlock AI scans.</p>
            )}
          </div>

          <div style={{ ...card, paddingTop: 12 }}>
            <div style={sectionLabel}>Live on</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SITES.map((s) => (
                <span key={s} style={chip}>{s}</span>
              ))}
            </div>
            <p style={{ ...hint, marginBottom: 0 }}>Hover any contract address, wallet, or profile.</p>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Primary as="a" href={apiBase()} target="_blank">Open Pointer</Primary>
            <Ghost onClick={() => void pointer.connect()}>Reconnect</Ghost>
          </div>
        </>
      )}

      <Footer />
    </div>
  );
}

/* ---------- brand ---------- */
function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <img src="/pointer-bird.png" alt="" width={22} height={22} style={{ objectFit: 'contain' }} />
      <span style={{ fontWeight: 600, fontSize: 19, letterSpacing: '-0.02em', lineHeight: 1 }}>pointer</span>
      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-muted)' }}>v0.0.1</span>
    </div>
  );
}

function Footer() {
  return (
    <div style={{ display: 'flex', gap: 14, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
      {[
        ['Docs', `${apiBase()}/docs`],
        ['X', 'https://x.com/tradepointer'],
        ['Support', `${apiBase()}/support`],
      ].map(([label, href]) => (
        <a key={label} href={href} target="_blank" rel="noreferrer" style={footLink}>{label}</a>
      ))}
    </div>
  );
}

/* ---------- primitives ---------- */
function Row({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0' }}>
      <span style={{ color: 'var(--fg-muted)', fontSize: 12.5 }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: 12.5, color: good ? 'var(--signal-bull)' : 'var(--fg-primary)' }}>{value}</span>
    </div>
  );
}
function RowTop({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}>{children}</div>;
}
function Dot() {
  return <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--signal-bull)', boxShadow: '0 0 8px var(--signal-bull)' }} />;
}
function Divider() {
  return <div style={{ height: 1, background: 'var(--border-subtle)', margin: '10px -14px' }} />;
}
function Primary({ children, onClick, as, href, target }: { children: React.ReactNode; onClick?: () => void; as?: 'a'; href?: string; target?: string }) {
  const s: React.CSSProperties = {
    flex: 1, display: 'block', textAlign: 'center', padding: '10px 0', borderRadius: 9, border: 'none',
    cursor: 'pointer', fontWeight: 600, fontSize: 13, textDecoration: 'none',
    color: 'var(--bg-base)', background: 'var(--fg-primary)',
  };
  return as === 'a' ? <a style={s} href={href} target={target} rel="noreferrer">{children}</a> : <button style={s} onClick={onClick}>{children}</button>;
}
function Ghost({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return <button onClick={onClick} style={{ flex: 1, padding: '10px 0', borderRadius: 9, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: 'var(--fg-primary)', background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>{children}</button>;
}
function Footnote({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 11, color: 'var(--fg-muted)', textAlign: 'center', marginTop: 10, marginBottom: 0 }}>{children}</p>;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const card: React.CSSProperties = { background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 14, marginBottom: 0 };
const lead: React.CSSProperties = { color: 'var(--fg-secondary)', fontSize: 13, lineHeight: 1.5, margin: '0 0 14px' };
const hint: React.CSSProperties = { color: 'var(--fg-muted)', fontSize: 11.5, lineHeight: 1.45, margin: '10px 0 0' };
const sectionLabel: React.CSSProperties = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-muted)', marginBottom: 8 };
const chip: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: 'var(--fg-secondary)', background: 'var(--bg-hover)', borderRadius: 6, padding: '3px 7px' };
const footLink: React.CSSProperties = { fontSize: 11.5, color: 'var(--fg-muted)', textDecoration: 'none' };
