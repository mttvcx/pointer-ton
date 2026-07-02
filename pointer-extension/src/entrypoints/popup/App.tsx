import { useCallback, useEffect, useState } from 'react';
import { pointer } from '@/pointer/client';
import { apiBase } from '@/pointer/auth';
import type { ExtMe } from '@/pointer/types';
import {
  ChainSelector,
  CHAINS,
  GlassButton,
  Ic,
  IconButton,
  UsageIndicator,
  type Chain,
  type Usage,
} from './components';
import { Home } from './Home';
import { Labels } from './Labels';
import { Settings } from './Settings';
import { Account } from './Account';

type Tab = 'home' | 'labels' | 'settings' | 'account';
type State = { phase: 'loading' } | { phase: 'disconnected' } | { phase: 'connected'; me: ExtMe };
type Mode = 'popup' | 'sidepanel';

const TAB_TITLE: Record<Tab, string> = { home: 'Pointer', labels: 'Labels', settings: 'Settings', account: 'Account' };

export function PopupApp({ mode = 'popup' }: { mode?: Mode }) {
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [tab, setTab] = useState<Tab>('home');
  const [chain, setChain] = useState<Chain>(CHAINS[0]!);

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

  const connected = state.phase === 'connected';
  const me = connected ? state.me : null;

  return (
    <div className={`pt-app ${mode === 'sidepanel' ? 'pt-app--panel' : ''}`}>
      <Header title={connected ? TAB_TITLE[tab] : 'Pointer'} me={me} chain={chain} setChain={setChain} mode={mode} />

      {!connected ? (
        <div className="pt-scroll" style={{ justifyContent: 'center' }}>
          {state.phase === 'loading' ? (
            <Loading />
          ) : (
            <Disconnected onConnect={() => void pointer.connect()} />
          )}
        </div>
      ) : (
        <>
          <div className="pt-scroll" key={tab}>
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tab === 'home' && <Home me={state.me} onNav={setTab} />}
              {tab === 'labels' && <Labels />}
              {tab === 'settings' && <Settings me={state.me} />}
              {tab === 'account' && <Account me={state.me} onLogout={() => { setState({ phase: 'loading' }); void refresh(); }} />}
            </div>
          </div>
          <BottomNav tab={tab} onTab={setTab} />
        </>
      )}
    </div>
  );
}

/* ───────────────────────── header ───────────────────────── */
function Header({ title, me, chain, setChain, mode }: { title: string; me: ExtMe | null; chain: Chain; setChain: (c: Chain) => void; mode: Mode }) {
  const usage: Usage | null = me
    ? { aiAccess: me.aiAccess, subscription: me.subscription, solBalance: me.solBalance, monthlyVolumeSol: me.monthlyVolumeSol, scansRemaining: me.scansRemaining }
    : null;

  const openPanel = async () => {
    try {
      const sp = (chrome as unknown as { sidePanel?: { open: (o: { windowId: number }) => Promise<void> } }).sidePanel;
      const win = await chrome.windows.getCurrent();
      if (sp && win.id != null) {
        await sp.open({ windowId: win.id });
        window.close();
      }
    } catch {
      /* sidepanel unavailable — no-op */
    }
  };

  return (
    <header className="pt-header">
      <div className="pt-brand">
        <img src="/pointer-bird.png" alt="Pointer" width={24} height={24} style={{ objectFit: 'contain' }} />
        {/* Just the bird as the brand mark; show the section name only when connected (never the redundant "Pointer"). */}
        {title !== 'Pointer' && <span className="pt-brand__title">{title}</span>}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7 }}>
        {usage && <UsageIndicator usage={usage} />}
        {me && <ChainSelector value={chain} onChange={setChain} />}
        {mode === 'popup' && (
          <IconButton label="Open side panel" onClick={openPanel}>
            <Ic.Panel size={17} />
          </IconButton>
        )}
      </div>
    </header>
  );
}

/* ───────────────────────── bottom nav ───────────────────────── */
function BottomNav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const items: { id: Tab; icon: (p: { size?: number }) => React.ReactElement; label: string }[] = [
    { id: 'home', icon: Ic.Home, label: 'Home' },
    { id: 'labels', icon: Ic.Tag, label: 'Labels' },
    { id: 'settings', icon: Ic.Gear, label: 'Settings' },
    { id: 'account', icon: Ic.User, label: 'Account' },
  ];
  return (
    <nav className="pt-nav">
      {items.map((it) => {
        const Icon = it.icon;
        const active = tab === it.id;
        return (
          <button key={it.id} className={`pt-nav__item ${active ? 'pt-nav__item--active' : ''}`} onClick={() => onTab(it.id)} aria-label={it.label}>
            <Icon size={19} />
            <span className="pt-nav__label">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ───────────────────────── loading / disconnected ───────────────────────── */
function Loading() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', gap: 12, color: 'var(--fg-muted)' }}>
      <span className="spin" style={{ display: 'grid', placeItems: 'center', color: 'var(--pt-accent)' }}>
        <Ic.Refresh size={22} />
      </span>
      <span className="meta">Connecting to Pointer…</span>
    </div>
  );
}

function Disconnected({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 0, padding: '0 14px' }}>
      {/* Bird dominates — ~2/3 of the popup width, no box around it. */}
      <img src="/pointer-bird.png" alt="Pointer" width={198} height={198} style={{ objectFit: 'contain', marginBottom: 4 }} />
      {/* Web wordmark: semibold (not heavy), tracking-tight, all white incl. the period. */}
      <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff' }}>
        pointer.
      </div>
      <p style={{ margin: '14px 0 0', fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, maxWidth: 252, color: 'var(--fg-secondary)' }}>
        Labels, PnL, and AI on every token, wallet, and profile you browse.
      </p>
      <div style={{ width: '100%', marginTop: 24 }}>
        <GlassButton variant="primary" block onClick={onConnect}>
          <Ic.Plug size={16} /> Connect Pointer
        </GlassButton>
      </div>
    </div>
  );
}
