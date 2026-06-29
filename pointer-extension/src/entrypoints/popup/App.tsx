import { useCallback, useEffect, useState } from 'react';
import { pointer } from '@/pointer/client';
import { apiBase } from '@/pointer/auth';
import type { ExtMe } from '@/pointer/types';

type Tab = 'home' | 'labels' | 'settings' | 'account';
type State = { phase: 'loading' } | { phase: 'disconnected' } | { phase: 'connected'; me: ExtMe };

const SITES = ['X', 'DexScreener', 'Solscan', 'Axiom', 'Pump.fun', 'GMGN', 'Photon', 'BullX'];
const base = () => apiBase();

export function PopupApp() {
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [tab, setTab] = useState<Tab>('home');

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

  // Disconnected / loading = a single clean screen, no nav.
  if (state.phase !== 'connected') {
    return (
      <Shell title="pointer">
        <div style={{ padding: 16 }}>
          {state.phase === 'loading' ? (
            <p style={S.muted}>Checking connection…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>
              <p style={{ ...S.lead, margin: 0 }}>
                Crypto intelligence on every page you browse — hover any token, wallet, or profile.
                Connect your Pointer account to turn it on.
              </p>
              <button style={S.primary} onClick={() => void pointer.connect()}>Connect Pointer</button>
              <p style={S.foot}>Read-only — Pointer can never move your funds.</p>
            </div>
          )}
        </div>
      </Shell>
    );
  }

  const me = state.me;
  return (
    <Shell title={TAB_TITLE[tab]}>
      <div style={S.body}>
        {tab === 'home' && <Home me={me} />}
        {tab === 'labels' && <Labels />}
        {tab === 'settings' && <Settings />}
        {tab === 'account' && <Account me={me} />}
      </div>
      <Nav tab={tab} onTab={setTab} />
    </Shell>
  );
}

/* ─────────────────────────── shell + nav ─────────────────────────── */
function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={S.shell}>
      <header style={S.header}>
        <img src="/pointer-bird.png" alt="" width={20} height={20} style={{ objectFit: 'contain' }} />
        <span style={S.wordmark}>{title}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-muted)' }}>v0.0.1</span>
      </header>
      {children}
    </div>
  );
}

const TAB_TITLE: Record<Tab, string> = { home: 'pointer', labels: 'Labels', settings: 'Settings', account: 'Account' };

function Nav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const items: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: 'home', icon: <IcHome />, label: 'Home' },
    { id: 'labels', icon: <IcTag />, label: 'Labels' },
    { id: 'settings', icon: <IcGear />, label: 'Settings' },
    { id: 'account', icon: <IcUser />, label: 'Account' },
  ];
  return (
    <nav style={S.nav}>
      {items.map((it) => {
        const active = tab === it.id;
        return (
          <button key={it.id} onClick={() => onTab(it.id)} style={{ ...S.navBtn, color: active ? 'var(--fg-primary)' : 'var(--fg-muted)' }} aria-label={it.label}>
            <span style={{ display: 'grid', placeItems: 'center', width: 22, height: 22 }}>{it.icon}</span>
            <span style={{ fontSize: 9.5, fontWeight: active ? 600 : 500 }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ─────────────────────────── views ─────────────────────────── */
function Home({ me }: { me: ExtMe }) {
  return (
    <div style={S.col}>
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <span style={S.dot} /> <b>Connected</b>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-muted)' }}>{base().replace(/^https?:\/\//, '')}</span>
        </div>
        <Hr />
        <KV k="AI access" v={me.aiAccess ? 'Unlocked' : 'Locked'} good={me.aiAccess} />
        <KV k="Plan" v={me.subscription === 'none' ? 'Free' : cap(me.subscription)} />
        {!me.aiAccess && <p style={S.hint}>Hold ≥5 SOL across tracked wallets, or subscribe, to unlock AI scans.</p>}
      </div>

      <div style={S.card}>
        <div style={S.label}>Live on</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SITES.map((s) => <span key={s} style={S.chip}>{s}</span>)}
        </div>
        <p style={{ ...S.hint, marginBottom: 0 }}>Hover any contract address, wallet, or profile.</p>
      </div>

      <a style={S.primaryLink} href={base()} target="_blank" rel="noreferrer">Open Pointer</a>
    </div>
  );
}

function Labels() {
  return (
    <div style={S.col}>
      <div style={{ display: 'flex', gap: 6 }}>
        {['Profiles', 'Wallets', 'Tokens'].map((t, i) => (
          <span key={t} style={{ ...S.chip, background: i === 0 ? 'var(--bg-hover)' : 'transparent', color: i === 0 ? 'var(--fg-primary)' : 'var(--fg-muted)', padding: '5px 10px' }}>{t}</span>
        ))}
        <button style={{ ...S.ghostSm, marginLeft: 'auto' }} onClick={() => window.open(base(), '_blank')}>+ Add</button>
      </div>
      <div style={{ ...S.card, alignItems: 'center', textAlign: 'center', padding: 22 }}>
        <IcTag size={22} />
        <p style={{ ...S.lead, margin: '10px 0 2px', fontWeight: 600, color: 'var(--fg-primary)' }}>No labels yet</p>
        <p style={{ ...S.hint, marginTop: 0 }}>
          Hover a wallet or profile anywhere you browse and save a private note or label — it syncs to your Pointer account.
        </p>
      </div>
    </div>
  );
}

function Settings() {
  const rows = [
    ['General', '/settings'],
    ['Trading settings', '/settings/trading'],
    ['X / Twitter', '/settings'],
    ['Notifications', '/settings'],
    ['Support & feedback', '/support'],
    ['Report a bug', '/support'],
  ] as const;
  return (
    <div style={S.col}>
      <a style={{ ...S.card, ...S.rowLink, background: 'linear-gradient(180deg,var(--bg-raised),var(--bg-hover))' }} href={`${base()}/pricing`} target="_blank" rel="noreferrer">
        <span style={{ fontWeight: 600 }}>Pointer Premium</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--signal-bull)', fontWeight: 600 }}>Upgrade →</span>
      </a>
      <div style={{ ...S.card, padding: 4 }}>
        {rows.map(([label, path], i) => (
          <a key={label} href={`${base()}${path}`} target="_blank" rel="noreferrer"
             style={{ ...S.listRow, borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
            <span>{label}</span>
            <span style={{ color: 'var(--fg-muted)' }}>›</span>
          </a>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', paddingTop: 2 }}>
        {[['Docs', `${base()}/docs`], ['X', 'https://x.com/tradepointer'], ['Telegram', 'https://t.me/']].map(([l, h]) => (
          <a key={l} href={h} target="_blank" rel="noreferrer" style={S.footLink}>{l}</a>
        ))}
      </div>
    </div>
  );
}

function Account({ me }: { me: ExtMe }) {
  const copy = (s: string) => void navigator.clipboard?.writeText(s);
  return (
    <div style={S.col}>
      <div style={{ ...S.card, padding: 4 }}>
        <Field k="Account" v={me.email ?? me.username ?? '—'} />
        <Field k="User ID" v={short(me.userId)} onCopy={me.userId ? () => copy(me.userId!) : undefined} top />
        <Field k="Plan" v={me.subscription === 'none' ? 'Free' : cap(me.subscription)} top />
        <Field k="Referral" v={me.referralCode ?? '—'} onCopy={me.referralCode ? () => copy(me.referralCode!) : undefined} top />
      </div>
      <a style={S.ghostLink} href={base()} target="_blank" rel="noreferrer">Manage in Pointer</a>
      <button style={{ ...S.ghostLink, color: 'var(--signal-bear)', background: 'transparent', border: '1px solid var(--border-subtle)' }} onClick={() => void pointer.connect()}>
        Reconnect
      </button>
    </div>
  );
}

/* ─────────────────────────── primitives ─────────────────────────── */
function KV({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0' }}>
      <span style={{ color: 'var(--fg-muted)', fontSize: 12.5 }}>{k}</span>
      <span style={{ fontWeight: 600, fontSize: 12.5, color: good ? 'var(--signal-bull)' : 'var(--fg-primary)' }}>{v}</span>
    </div>
  );
}
function Field({ k, v, onCopy, top }: { k: string; v: string; onCopy?: () => void; top?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '11px 12px', borderTop: top ? '1px solid var(--border-subtle)' : 'none' }}>
      <span style={{ color: 'var(--fg-muted)', fontSize: 12.5 }}>{k}</span>
      <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
      {onCopy && <button onClick={onCopy} style={S.copy} aria-label="Copy">⧉</button>}
    </div>
  );
}
function Hr() { return <div style={{ height: 1, background: 'var(--border-subtle)', margin: '10px -14px' }} />; }

/* line icons (Pointer's own, 1.6px stroke) */
const sv = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
function IcHome() { return <svg {...sv}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>; }
function IcTag({ size = 18 }: { size?: number }) { return <svg {...sv} width={size} height={size}><path d="M3 3h7l11 11-7 7L3 10V3z" /><circle cx="7.5" cy="7.5" r="1.4" /></svg>; }
function IcGear() { return <svg {...sv}><circle cx="12" cy="12" r="3.2" /><path d="M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 2h-4l-.5 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 005 12a7 7 0 00.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2L10 22h4l.5-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z" /></svg>; }
function IcUser() { return <svg {...sv}><circle cx="12" cy="8" r="3.6" /><path d="M5 20a7 7 0 0114 0" /></svg>; }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const short = (s: string | null) => (s ? `${s.slice(0, 6)}…${s.slice(-4)}` : '—');

const S: Record<string, React.CSSProperties> = {
  shell: { width: 340, height: 480, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' },
  header: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' },
  wordmark: { fontWeight: 600, fontSize: 16, letterSpacing: '-0.02em', lineHeight: 1 },
  body: { flex: 1, overflowY: 'auto', padding: 16 },
  col: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: { display: 'flex', flexDirection: 'column', background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 14 },
  nav: { display: 'flex', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-sunken)' },
  navBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '9px 0', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color .12s' },
  primary: { width: '100%', padding: '11px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: 'var(--bg-base)', background: 'var(--fg-primary)' },
  primaryLink: { display: 'block', textAlign: 'center', padding: '11px 0', borderRadius: 9, fontWeight: 600, fontSize: 13, textDecoration: 'none', color: 'var(--bg-base)', background: 'var(--fg-primary)' },
  ghostLink: { display: 'block', textAlign: 'center', padding: '10px 0', borderRadius: 9, fontWeight: 600, fontSize: 13, textDecoration: 'none', cursor: 'pointer', color: 'var(--fg-primary)', background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' },
  ghostSm: { padding: '5px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', color: 'var(--fg-primary)', background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' },
  rowLink: { flexDirection: 'row', alignItems: 'center', textDecoration: 'none', color: 'var(--fg-primary)', cursor: 'pointer' },
  listRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 12px', textDecoration: 'none', color: 'var(--fg-primary)', fontSize: 13, cursor: 'pointer' },
  copy: { marginLeft: 8, background: 'transparent', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: 99, background: 'var(--signal-bull)', boxShadow: '0 0 8px var(--signal-bull)' },
  lead: { color: 'var(--fg-secondary)', fontSize: 13, lineHeight: 1.5 },
  muted: { color: 'var(--fg-muted)', fontSize: 13 },
  hint: { color: 'var(--fg-muted)', fontSize: 11.5, lineHeight: 1.45, margin: '10px 0 0' },
  foot: { fontSize: 11, color: 'var(--fg-muted)', textAlign: 'center', margin: 0 },
  label: { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-muted)', marginBottom: 8 },
  chip: { fontSize: 11, fontWeight: 500, color: 'var(--fg-secondary)', background: 'var(--bg-hover)', borderRadius: 6, padding: '3px 7px' },
  footLink: { fontSize: 11.5, color: 'var(--fg-muted)', textDecoration: 'none' },
};
