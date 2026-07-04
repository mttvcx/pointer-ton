/**
 * Pointer extension — liquid-glass component kit. Reusable, theme-token driven
 * primitives shared by popup + sidepanel. Pairs with styles.css.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/* ───────────────────────── icons ───────────────────────── */
const sv = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
};
type IP = { size?: number };
const mk = (path: ReactNode) => ({ size = 18 }: IP) => (
  <svg {...sv} width={size} height={size}>
    {path}
  </svg>
);
export const Ic = {
  Home: mk(<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>),
  Wallet: mk(<><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M16 12h3" /><path d="M3 9h13a2 2 0 012 2" /></>),
  Tag: mk(<><path d="M3 3h7l11 11-7 7L3 10V3z" /><circle cx="7.5" cy="7.5" r="1.3" /></>),
  Gear: mk(<><circle cx="12" cy="12" r="3.1" /><path d="M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 2h-4l-.5 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 005 12a7 7 0 00.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2L10 22h4l.5-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z" /></>),
  User: mk(<><circle cx="12" cy="8" r="3.6" /><path d="M5 20a7 7 0 0114 0" /></>),
  ChevronDown: mk(<path d="M6 9l6 6 6-6" />),
  ChevronRight: mk(<path d="M9 6l6 6-6 6" />),
  Back: mk(<path d="M15 6l-6 6 6 6" />),
  Plus: mk(<path d="M12 5v14M5 12h14" />),
  Trash: mk(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />),
  Import: mk(<><path d="M12 3v12M8 11l4 4 4-4" /><path d="M5 21h14" /></>),
  Export: mk(<><path d="M12 15V3M8 7l4-4 4 4" /><path d="M5 21h14" /></>),
  Search: mk(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></>),
  Copy: mk(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></>),
  External: mk(<><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M19 13v6a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h6" /></>),
  Refresh: mk(<><path d="M20 11a8 8 0 10-2.3 6" /><path d="M20 4v7h-7" /></>),
  Sparkle: mk(<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />),
  Lock: mk(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>),
  Check: mk(<path d="M5 13l4 4L19 7" />),
  Bolt: mk(<path d="M13 3L5 14h6l-1 7 8-11h-6z" />),
  Target: mk(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /></>),
  Crown: mk(<path d="M4 18h16M4 18l-1-9 5 4 4-7 4 7 5-4-1 9" />),
  Chart: mk(<><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8 16v-4M12 16V8M16 16v-7" /></>),
  X: mk(<path d="M4 4l16 16M20 4L4 20" />),
  Send: mk(<path d="M21 4L3 11l6 2 2 6 4-7 6-8z" />),
  Shield: mk(<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />),
  Help: mk(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 113.5 2.3c-.8.4-1 .9-1 1.7" /><path d="M12 17h.01" /></>),
  Bug: mk(<><rect x="7" y="8" width="10" height="11" rx="5" /><path d="M7 12H3M21 12h-4M7 16H4M20 16h-3M9 8V6a3 3 0 016 0v2" /></>),
  Gift: mk(<><rect x="4" y="9" width="16" height="11" rx="1.5" /><path d="M2 9h20M12 9v11M12 9s-1-5-4-5a2 2 0 000 5M12 9s1-5 4-5a2 2 0 010 5" /></>),
  Id: mk(<><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="11" r="2" /><path d="M14 9h4M14 13h4M6 15a3 3 0 016 0" /></>),
  Panel: mk(<><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M14 4v16" /></>),
  Plug: mk(<><path d="M9 2v6M15 2v6" /><path d="M7 8h10v3a5 5 0 01-10 0z" /><path d="M12 16v6" /></>),
};
export type IconName = keyof typeof Ic;

/* ───────────────────────── chains ───────────────────────── */
export interface Chain {
  id: string;
  name: string;
  sym: string;
  c1: string;
  c2: string;
  beta?: boolean;
}
export const CHAINS: Chain[] = [
  { id: 'sol', name: 'Solana', sym: 'SOL', c1: '#14f195', c2: '#9945ff' },
  { id: 'bnb', name: 'BNB', sym: 'BNB', c1: '#f3ba2f', c2: '#b88a1b' },
  { id: 'ton', name: 'TON', sym: 'TON', c1: '#3aa6f0', c2: '#1f7fd1', beta: true },
  { id: 'base', name: 'Base', sym: 'BASE', c1: '#5b8dff', c2: '#2455e6' },
  { id: 'eth', name: 'Ethereum', sym: 'ETH', c1: '#9aa6ff', c2: '#5b6bd6' },
];

export function ChainMark({ chain, size = 18 }: { chain: Chain; size?: number }) {
  // Real Pointer chain logos (bundled from the web app's /public/chains).
  return (
    <img
      src={`/chains/${chain.id}.png`}
      alt={chain.name}
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block', flexShrink: 0 }}
    />
  );
}

/* ───────────────────────── primitives ───────────────────────── */
export function GlassCard({
  children,
  strong,
  hover,
  className = '',
  style,
  onClick,
}: {
  children: ReactNode;
  strong?: boolean;
  hover?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div
      className={`${strong ? 'glass-strong' : 'glass'} glass-card ${hover ? 'glass-card--hover' : ''} ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

type BtnVariant = 'primary' | 'accent' | 'glass' | 'ghost' | 'danger';
export function GlassButton({
  children,
  variant = 'glass',
  sm,
  block,
  disabled,
  onClick,
  href,
  style,
}: {
  children: ReactNode;
  variant?: BtnVariant;
  sm?: boolean;
  block?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
  style?: CSSProperties;
}) {
  const cls = `btn btn--${variant} ${sm ? 'btn--sm' : ''} ${block ? 'btn--block' : ''}`;
  if (href)
    return (
      <a className={cls} href={href} target="_blank" rel="noreferrer" style={style}>
        {children}
      </a>
    );
  return (
    <button className={cls} disabled={disabled} onClick={onClick} style={style}>
      {children}
    </button>
  );
}

export function IconButton({ label, onClick, children, spinning }: { label: string; onClick?: () => void; children: ReactNode; spinning?: boolean }) {
  return (
    <button className="icon-btn" aria-label={label} onClick={onClick}>
      <span className={spinning ? 'spin' : undefined} style={{ display: 'grid', placeItems: 'center' }}>
        {children}
      </span>
    </button>
  );
}

export function Pill({ children, onClick, chip, style }: { children: ReactNode; onClick?: () => void; chip?: boolean; style?: CSSProperties }) {
  return (
    <button className={`pill ${chip ? 'pill--chip' : ''}`} onClick={onClick} style={style} tabIndex={chip ? -1 : 0}>
      {children}
    </button>
  );
}

export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'bull' | 'gold' }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="progress">
      <div className={`progress__fill ${tone === 'bull' ? 'progress__fill--bull' : tone === 'gold' ? 'progress__fill--gold' : ''}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button role="switch" aria-checked={on} className={`toggle ${on ? 'toggle--on' : ''}`} onClick={onClick}>
      <span className="toggle__knob" />
    </button>
  );
}

export function Segmented<T extends string>({ options, value, onChange, sm }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (id: T) => void; sm?: boolean }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.id} className={`seg__btn ${sm ? 'seg__btn--sm' : ''} ${o.id === value ? 'seg__btn--active' : ''}`} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="glass glass-card fade-in" style={{ alignItems: 'center', textAlign: 'center', padding: '26px 20px', gap: 4 }}>
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 52,
          height: 52,
          borderRadius: 16,
          marginBottom: 8,
          color: 'var(--pt-accent)',
          background: 'var(--pt-accent-soft)',
          border: '1px solid var(--pt-accent-line)',
        }}
      >
        {icon}
      </div>
      <p style={{ margin: 0, fontWeight: 650, fontSize: 14 }}>{title}</p>
      <p className="meta" style={{ margin: '2px 0 0', lineHeight: 1.5, maxWidth: 250 }}>{body}</p>
      {action && <div style={{ marginTop: 14, width: '100%' }}>{action}</div>}
    </div>
  );
}

/* ───────────────────────── chain selector ───────────────────────── */
export function ChainSelector({ value, onChange }: { value: Chain; onChange: (c: Chain) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(() => setOpen(false));
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="pill" onClick={() => setOpen((o) => !o)} aria-label="Select chain">
        <ChainMark chain={value} size={16} />
        <Ic.ChevronDown size={13} />
      </button>
      {open && (
        <div className="popover" style={{ top: '100%', right: 0, marginTop: 8, minWidth: 168, padding: 5 }}>
          {CHAINS.map((c) => (
            <button
              key={c.id}
              className="menu-item"
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              style={{ justifyContent: 'flex-start' }}
            >
              <ChainMark chain={c} size={18} />
              <span style={{ flex: 1, fontWeight: 550 }}>{c.name}</span>
              {c.beta && <span className="meta" style={{ color: 'var(--pt-accent)' }}>beta</span>}
              {c.id === value.id && <Ic.Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── usage indicator + popover ───────────────────────── */
export interface Usage {
  aiAccess: boolean;
  subscription: 'none' | 'active' | 'founder';
  solBalance: number | null;
  monthlyVolumeSol: number | null;
  scansRemaining: number | null;
}
const UNLOCK_SOL = 5;

export function UsageIndicator({ usage }: { usage: Usage }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(() => setOpen(false));
  const unlockPct = usage.solBalance != null ? Math.min(100, (usage.solBalance / UNLOCK_SOL) * 100) : null;
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="pill" onClick={() => setOpen((o) => !o)} aria-label="AI usage" style={{ flexDirection: 'column', alignItems: 'stretch', height: 'auto', padding: '4px 9px', gap: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ color: usage.aiAccess ? 'var(--pt-accent)' : 'var(--fg-muted)', display: 'grid', placeItems: 'center' }}>
            {usage.aiAccess ? <Ic.Sparkle size={13} /> : <Ic.Lock size={12} />}
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 700 }}>
            {usage.aiAccess ? 'AI' : unlockPct != null ? `${Math.round(unlockPct)}%` : 'AI'}
          </span>
        </span>
        <span className="usage-underline" style={{ width: 28 }}>
          <span style={{ width: `${usage.aiAccess ? 100 : unlockPct ?? 8}%` }} />
        </span>
      </button>
      {open && <UsagePopover usage={usage} />}
    </div>
  );
}

function UsagePopover({ usage }: { usage: Usage }) {
  const planLabel = usage.subscription === 'founder' ? 'Founder' : usage.subscription === 'active' ? 'Premium' : 'Free';
  const unlockPct = usage.solBalance != null ? Math.min(100, (usage.solBalance / UNLOCK_SOL) * 100) : 0;
  const remainingSol = usage.solBalance != null ? Math.max(0, UNLOCK_SOL - usage.solBalance) : null;
  return (
    <div className="popover" style={{ top: '100%', right: 0, marginTop: 8, width: 244, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
        <span style={{ color: 'var(--pt-accent)', display: 'grid', placeItems: 'center' }}><Ic.Sparkle size={15} /></span>
        <span style={{ fontWeight: 650, fontSize: 13 }}>{planLabel} plan · AI</span>
        <span className="pill pill--chip" style={{ marginLeft: 'auto', height: 22, color: usage.aiAccess ? 'var(--signal-bull)' : 'var(--fg-muted)' }}>
          {usage.aiAccess ? 'Unlocked' : 'Locked'}
        </span>
      </div>

      {!usage.aiAccess ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 6 }}>
            <span className="meta">Unlock progress</span>
            <span style={{ fontWeight: 650 }}>{usage.solBalance != null ? `${usage.solBalance.toFixed(2)} / ${UNLOCK_SOL} SOL` : '—'}</span>
          </div>
          <ProgressBar value={unlockPct} />
          <p className="meta" style={{ margin: '10px 0 0', lineHeight: 1.5 }}>
            {remainingSol != null ? <>Hold <b style={{ color: 'var(--fg-secondary)' }}>{remainingSol.toFixed(2)} more SOL</b> across tracked wallets — or subscribe — to unlock AI scans.</> : 'Hold ≥5 SOL across tracked wallets, or subscribe, to unlock AI scans.'}
          </p>
        </>
      ) : (
        <>
          <Stat k="Scans remaining" v={usage.scansRemaining != null ? String(usage.scansRemaining) : '∞'} />
          <Stat k="SOL balance" v={usage.solBalance != null ? `${usage.solBalance.toFixed(2)} SOL` : '—'} />
          <Stat k="30d volume" v={usage.monthlyVolumeSol != null ? `${usage.monthlyVolumeSol.toFixed(1)} SOL` : '—'} />
        </>
      )}
    </div>
  );
}
function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
      <span className="meta">{k}</span>
      <span style={{ fontSize: 12.5, fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
    </div>
  );
}

/* ───────────────────────── outside-click hook ───────────────────────── */
export function useOutside(onOut: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onOut]);
  return ref;
}

/* ───────────────────────── copy hook ───────────────────────── */
export function useCopy(): [boolean, (s: string) => void] {
  const [done, setDone] = useState(false);
  const copy = (s: string) => {
    void navigator.clipboard?.writeText(s);
    setDone(true);
    setTimeout(() => setDone(false), 1100);
  };
  return [done, copy];
}
