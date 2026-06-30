import { useCallback, useEffect, useState } from 'react';
import { apiBase } from '@/pointer/auth';
import type { ExtMe } from '@/pointer/types';
import {
  cacheBytes,
  clearCache,
  DEFAULT_SETTINGS,
  fmtBytes,
  getSettings,
  setSettings,
  type ExtSettings,
  type Language,
} from '@/lib/settings';
import { GlassButton, Ic, IconButton, Segmented, Toggle } from './components';

const base = () => apiBase();
type View = 'index' | 'general' | 'trading' | 'x';
const SLIPPAGE = [100, 300, 500, 1000] as const;

export function Settings({ me }: { me: ExtMe }) {
  const [view, setView] = useState<View>('index');
  const [s, setS] = useState<ExtSettings>(DEFAULT_SETTINGS);
  const [bytes, setBytes] = useState<number | null>(null);
  const [cleared, setCleared] = useState(false);
  const premium = me.subscription !== 'none';
  const version = (() => {
    try {
      return chrome.runtime.getManifest().version;
    } catch {
      return '0.0.1';
    }
  })();

  const refreshCache = useCallback(async () => setBytes(await cacheBytes()), []);
  useEffect(() => {
    void getSettings().then(setS);
    void refreshCache();
  }, [refreshCache]);
  const patch = async (p: Partial<ExtSettings>) => setS(await setSettings(p));

  if (view === 'general')
    return (
      <Sub title="General" onBack={() => setView('index')}>
        <Card>
          <RowKV label="Language">
            <Segmented<Language> sm value={s.language} onChange={(language) => void patch({ language })} options={[{ id: 'en', label: 'EN' }, { id: 'zh', label: '中文' }, { id: 'ru', label: 'РУ' }]} />
          </RowKV>
          <RowToggle label="Show changelog on update" desc="Open the changelog when Pointer updates" on={s.showChangelog} onClick={() => void patch({ showChangelog: !s.showChangelog })} />
          <RowToggle label="Hover cards" desc="Show Pointer cards on hover, everywhere you browse" on={s.hoverCards} onClick={() => void patch({ hoverCards: !s.hoverCards })} />
        </Card>
      </Sub>
    );
  if (view === 'trading')
    return (
      <Sub title="Trading settings" onBack={() => setView('index')}>
        <Card>
          <RowKV label="Default slippage">
            <Segmented<string> sm value={String(s.defaultSlippageBps)} onChange={(v) => void patch({ defaultSlippageBps: Number(v) })} options={SLIPPAGE.map((b) => ({ id: String(b), label: `${b / 100}%` }))} />
          </RowKV>
          <RowKV label="Quick-buy presets">
            <span style={{ fontSize: 12, color: 'var(--fg-secondary)', fontVariantNumeric: 'tabular-nums' }}>{s.quickBuyPresetsSol.join(' · ')} SOL</span>
          </RowKV>
        </Card>
        <p className="meta" style={{ margin: '2px 2px 0', lineHeight: 1.5 }}>Trades always open in Pointer for signing — the extension never holds keys.</p>
      </Sub>
    );
  if (view === 'x')
    return (
      <Sub title="X / Twitter" onBack={() => setView('index')}>
        <Card>
          <RowToggle label="Inline cards on X" desc="Render token & wallet cards directly in the feed" on={s.xInlineCards} onClick={() => void patch({ xInlineCards: !s.xInlineCards })} />
        </Card>
      </Sub>
    );

  return (
    <>
      {/* premium */}
      {premium ? (
        <div className="glass-strong glass-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <span className="premium__icon"><Ic.Crown size={17} /></span>
          <span style={{ flex: 1 }}>
            <div style={{ fontWeight: 650, fontSize: 13 }}>{me.subscription === 'founder' ? 'Founder' : 'Premium'} active</div>
            <div className="meta">All features unlocked — thank you.</div>
          </span>
          <span style={{ color: 'var(--signal-bull)', display: 'grid', placeItems: 'center' }}><Ic.Check size={18} /></span>
        </div>
      ) : (
        <a className="premium" href={`${base()}/pricing`} target="_blank" rel="noreferrer">
          <span className="premium__shine" />
          <span className="premium__icon"><Ic.Crown size={17} /></span>
          <span style={{ flex: 1, position: 'relative' }}>
            <div style={{ fontWeight: 650, fontSize: 13.5 }}>Pointer Premium</div>
            <div className="meta" style={{ color: 'rgba(246,223,154,0.75)' }}>Unlimited AI · priority data · lower fees</div>
          </span>
          <span style={{ position: 'relative', fontSize: 12, fontWeight: 700, color: 'var(--pt-gold-1)' }}>Upgrade</span>
        </a>
      )}

      {/* grouped rows */}
      <div className="glass row-group">
        <SettingRow icon={<Ic.Gear size={15} />} title="General" onClick={() => setView('general')} />
        <SettingRow icon={<Ic.Chart size={15} />} title="Trading settings" onClick={() => setView('trading')} />
        <SettingRow icon={<Ic.Tag size={15} />} title="Label settings" sub="Sync, import & export" href={`${base()}/settings`} external />
        <SettingRow icon={<Ic.X size={15} />} title="X settings" onClick={() => setView('x')} />
        <SettingRow icon={<Ic.Shield size={15} />} title="Platform controls" href={`${base()}/settings`} external />
        <SettingRow icon={<Ic.Help size={15} />} title="Support & feedback" href={`${base()}/support`} external />
        <SettingRow icon={<Ic.Bug size={15} />} title="Report a bug" href={`${base()}/support`} external />
      </div>

      {/* storage */}
      <div className="glass glass-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
        <span className="row__icon"><Ic.Refresh size={15} /></span>
        <span style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>Cache</div>
          <div className="meta">{bytes == null ? '—' : fmtBytes(bytes)} · labels & settings kept</div>
        </span>
        <GlassButton variant="glass" sm onClick={async () => { await clearCache(); await refreshCache(); setCleared(true); setTimeout(() => setCleared(false), 1400); }}>
          {cleared ? <><Ic.Check size={13} /> Cleared</> : 'Clear'}
        </GlassButton>
      </div>

      {/* footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 4 }}>
        {[['X', 'https://x.com/tradepointer'], ['Telegram', 'https://t.me/'], ['Docs', `${base()}/docs`]].map(([l, h]) => (
          <a key={l} href={h} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'var(--fg-muted)', textDecoration: 'none' }}>{l}</a>
        ))}
        <span style={{ fontSize: 11.5, color: 'var(--fg-muted)', marginLeft: 'auto' }}>v{version}</span>
      </div>
    </>
  );
}

/* ───────────────────────── pieces ───────────────────────── */
function Sub({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <IconButton label="Back" onClick={onBack}>
          <Ic.Back size={18} />
        </IconButton>
        <span style={{ fontWeight: 650, fontSize: 13.5 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="glass glass-card" style={{ gap: 0, padding: '4px 14px' }}>{children}</div>;
}
function SettingRow({ icon, title, sub, onClick, href, external }: { icon: React.ReactNode; title: string; sub?: string; onClick?: () => void; href?: string; external?: boolean }) {
  const body = (
    <>
      <span className="row__icon">{icon}</span>
      <span className="row__body">
        <span className="row__title">{title}</span>
        {sub && <span className="row__sub">{sub}</span>}
      </span>
      <span className="row__chev">{external ? <Ic.External size={14} /> : <Ic.ChevronRight size={16} />}</span>
    </>
  );
  if (href)
    return (
      <a className="row" href={href} target="_blank" rel="noreferrer">
        {body}
      </a>
    );
  return (
    <button className="row" onClick={onClick}>
      {body}
    </button>
  );
}
function RowKV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0' }}>
      <span style={{ fontSize: 12.5, color: 'var(--fg-secondary)' }}>{label}</span>
      <span style={{ marginLeft: 'auto' }}>{children}</span>
    </div>
  );
}
function RowToggle({ label, desc, on, onClick }: { label: string; desc?: string; on: boolean; onClick: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderTop: '1px solid var(--glass-border)' }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500 }}>{label}</span>
        {desc && <span className="row__sub" style={{ whiteSpace: 'normal' }}>{desc}</span>}
      </span>
      <span style={{ marginLeft: 'auto' }}>
        <Toggle on={on} onClick={onClick} />
      </span>
    </div>
  );
}
