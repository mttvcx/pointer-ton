import { apiBase } from '@/pointer/auth';
import type { ExtMe } from '@/pointer/types';
import { GlassButton, GlassCard, Ic, Pill, ProgressBar } from './components';

const UNLOCK_SOL = 5;
const base = () => apiBase();

type Nav = 'home' | 'labels' | 'settings' | 'account';

export function Home({ me, onNav }: { me: ExtMe; onNav: (t: Nav) => void }) {
  const premium = me.subscription !== 'none';
  const unlockPct = me.solBalance != null ? Math.min(100, (me.solBalance / UNLOCK_SOL) * 100) : null;

  const actions = [
    { icon: <Ic.Target size={17} />, label: 'Check project', run: () => window.open(`${base()}/pulse`, '_blank') },
    { icon: <Ic.Wallet size={17} />, label: 'Track wallet', run: () => window.open(`${base()}/track`, '_blank') },
    { icon: <Ic.Tag size={17} />, label: 'Add label', run: () => onNav('labels') },
    { icon: <Ic.Bolt size={17} />, label: 'Quick buy', run: () => window.open(base(), '_blank') },
  ];

  return (
    <>
      {/* hero status */}
      <GlassCard strong style={{ gap: 0, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '15px 16px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="dot" />
            <span style={{ fontWeight: 650, fontSize: 13.5 }}>Connected</span>
            <Pill chip style={{ marginLeft: 'auto', height: 24, color: premium ? 'var(--pt-gold-1)' : 'var(--fg-secondary)' }}>
              {premium ? <Ic.Crown size={12} /> : null} {me.subscription === 'founder' ? 'Founder' : premium ? 'Premium' : 'Free'}
            </Pill>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 16 }}>
            <span className="meta">{me.aiAccess ? 'AI access' : 'Unlock AI access'}</span>
            <span style={{ fontSize: 12.5, fontWeight: 650, color: me.aiAccess ? 'var(--signal-bull)' : 'var(--fg-primary)' }}>
              {me.aiAccess ? 'Unlocked' : me.solBalance != null ? `${me.solBalance.toFixed(2)} / ${UNLOCK_SOL} SOL` : 'Locked'}
            </span>
          </div>
          <div style={{ marginTop: 8 }}>
            <ProgressBar value={me.aiAccess ? 100 : unlockPct ?? 6} tone={me.aiAccess ? 'bull' : 'accent'} />
          </div>
          <p className="meta" style={{ margin: '10px 0 0', lineHeight: 1.5 }}>
            {me.aiAccess
              ? me.scansRemaining != null
                ? `${me.scansRemaining} AI scans remaining today.`
                : 'AI scans active across every page you browse.'
              : 'Hold ≥5 SOL across tracked wallets, or go Premium, to unlock AI scans.'}
          </p>
        </div>

        {!premium && (
          <a className="row" href={`${base()}/pricing`} target="_blank" rel="noreferrer" style={{ borderTop: '1px solid var(--glass-border)', borderRadius: 0, padding: '11px 16px' }}>
            <span style={{ color: 'var(--pt-gold-1)', display: 'grid', placeItems: 'center' }}><Ic.Crown size={16} /></span>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 12.5 }}>Go Premium — unlock everything</span>
            <span style={{ color: 'var(--pt-gold-1)', fontSize: 12, fontWeight: 700 }}>Upgrade</span>
          </a>
        )}
      </GlassCard>

      {/* quick actions */}
      <div>
        <div className="section-label" style={{ marginBottom: 8 }}>Quick actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {actions.map((a) => (
            <button key={a.label} className="glass glass-card glass-card--hover" style={{ padding: 13, gap: 9, alignItems: 'flex-start', flexDirection: 'row' }} onClick={a.run}>
              <span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 8, color: 'var(--pt-accent)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>{a.icon}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, alignSelf: 'center', textAlign: 'left' }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      <GlassButton variant="primary" block href={base()}>
        Open Pointer <Ic.External size={15} />
      </GlassButton>
    </>
  );
}
