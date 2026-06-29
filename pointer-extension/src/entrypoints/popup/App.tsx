import { useCallback, useEffect, useState } from 'react';
import { pointer } from '@/pointer/client';
import { apiBase } from '@/pointer/auth';
import type { ExtMe } from '@/pointer/types';

type State =
  | { phase: 'loading' }
  | { phase: 'disconnected' }
  | { phase: 'connected'; me: ExtMe };

export function PopupApp() {
  const [state, setState] = useState<State>({ phase: 'loading' });

  const refresh = useCallback(async () => {
    const res = await pointer.me();
    if (res.ok && (res.data as ExtMe).connected) {
      setState({ phase: 'connected', me: res.data as ExtMe });
    } else {
      setState({ phase: 'disconnected' });
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Re-check when the user returns from the connect tab.
    const onVis = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVis);
    const id = window.setInterval(() => void refresh(), 2500);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(id);
    };
  }, [refresh]);

  return (
    <div style={{ width: 300, padding: 16, fontFamily: 'var(--pt-font)', color: 'var(--fg-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div
          style={{
            width: 22, height: 22, borderRadius: 6, background: 'var(--fg-primary)',
            display: 'grid', placeItems: 'center', color: 'var(--bg-base)', fontWeight: 800, fontSize: 14,
          }}
        >
          P
        </div>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Pointer</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-muted)' }}>v0.0.1</span>
      </div>

      {state.phase === 'loading' && <p style={muted}>Checking connection…</p>}

      {state.phase === 'disconnected' && (
        <>
          <p style={{ ...muted, marginBottom: 12 }}>
            Connect to your Pointer account to see intelligence as you browse. Read-only —
            it can never move your funds.
          </p>
          <button style={primaryBtn} onClick={() => void pointer.connect()}>
            Connect Pointer
          </button>
        </>
      )}

      {state.phase === 'connected' && (
        <>
          <Row label="Status" value="Connected" tone="bull" />
          <Row label="AI access" value={state.me.aiAccess ? 'Unlocked' : 'Locked'} tone={state.me.aiAccess ? 'bull' : undefined} />
          <Row label="Plan" value={state.me.subscription === 'none' ? 'Free' : state.me.subscription} />
          <p style={{ ...muted, margin: '12px 0' }}>
            Hover a contract address, wallet, or profile on X, DexScreener, Solscan, Axiom and more.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <a style={ghostBtn} href={apiBase()} target="_blank" rel="noreferrer">Open Pointer</a>
            <button style={ghostBtn} onClick={() => void pointer.connect()}>Reconnect</button>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'bull' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ color: 'var(--fg-muted)', fontSize: 12 }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: 12, color: tone === 'bull' ? 'var(--signal-bull)' : 'var(--fg-primary)' }}>
        {value}
      </span>
    </div>
  );
}

const muted: React.CSSProperties = { color: 'var(--fg-muted)', fontSize: 12.5, lineHeight: 1.5 };
const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '10px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
  fontWeight: 700, fontSize: 13, color: 'var(--bg-base)', background: 'var(--accent-glow)',
};
const ghostBtn: React.CSSProperties = {
  flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 8, cursor: 'pointer',
  fontWeight: 600, fontSize: 12, textDecoration: 'none',
  color: 'var(--fg-primary)', background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)',
};
