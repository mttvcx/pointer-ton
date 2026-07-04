import { useState } from 'react';
import { pointer } from '@/pointer/client';
import { apiBase } from '@/pointer/auth';
import type { ExtMe } from '@/pointer/types';
import { GlassButton, Ic, useCopy } from './components';

const base = () => apiBase();
const shortId = (s: string | null) => (s ? `${s.slice(0, 8)}…${s.slice(-6)}` : '—');

export function Account({ me, onLogout }: { me: ExtMe; onLogout: () => void }) {
  const [copied, copy] = useCopy();
  const [copiedRef, copyRef] = useCopy();
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    setBusy(true);
    await pointer.disconnect();
    onLogout();
  };

  return (
    <>
      {/* identity card */}
      <div className="glass-strong glass-card" style={{ alignItems: 'center', padding: '20px 16px 18px', gap: 2 }}>
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 56,
            height: 56,
            borderRadius: 18,
            marginBottom: 10,
            fontSize: 22,
            fontWeight: 700,
            color: '#fff',
            background: 'linear-gradient(150deg, var(--pt-accent), var(--pt-accent-2))',
            boxShadow: 'var(--pt-accent-glow)',
          }}
        >
          {(me.username ?? me.email ?? 'P').slice(0, 1).toUpperCase()}
        </div>
        <div style={{ fontWeight: 650, fontSize: 14.5 }}>{me.username ?? me.email ?? 'Pointer account'}</div>
        <div className="meta">{me.subscription === 'founder' ? 'Founder' : me.subscription === 'active' ? 'Premium member' : 'Free plan'}</div>
      </div>

      {/* rows */}
      <div className="glass row-group">
        <AccountRow icon={<Ic.User size={15} />} title="Account" value={me.email ?? '—'} onClick={me.email ? () => copy(me.email!) : undefined} hint={copied ? 'Copied' : undefined} />
        <Sep />
        <AccountRow icon={<Ic.X size={15} />} title="Twitter / X" value={me.username ? `@${me.username}` : 'Connect'} href={`${base()}/settings`} external />
        <Sep />
        <AccountRow icon={<Ic.Send size={15} />} title="Telegram" value="Connect" href="https://t.me/" external />
        <Sep />
        <AccountRow icon={<Ic.Id size={15} />} title="User ID" value={shortId(me.userId)} onClick={me.userId ? () => copy(me.userId!) : undefined} mono />
      </div>

      {/* referral — glowing */}
      <button
        className="glass-card"
        onClick={me.referralCode ? () => copyRef(me.referralCode!) : undefined}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          textAlign: 'left',
          cursor: me.referralCode ? 'pointer' : 'default',
          background: 'linear-gradient(135deg, var(--pt-accent-soft), rgba(154,124,255,0.05))',
          border: '1px solid var(--pt-accent-line)',
          boxShadow: 'var(--pt-accent-glow)',
        }}
      >
        <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 11, color: '#fff', background: 'linear-gradient(180deg, var(--pt-accent), var(--pt-accent-2))' }}>
          <Ic.Gift size={17} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 12.5 }}>Referral code</div>
          <div className="meta" style={{ fontFamily: 'inherit', letterSpacing: '0.02em', color: 'var(--fg-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            {me.referralCode ?? 'Earn rewards in Pointer'}
          </div>
        </span>
        <span className="meta" style={{ color: copiedRef ? 'var(--signal-bull)' : 'var(--pt-accent)', display: 'grid', placeItems: 'center' }}>
          {copiedRef ? <Ic.Check size={16} /> : me.referralCode ? <Ic.Copy size={15} /> : <Ic.ChevronRight size={15} />}
        </span>
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
        <GlassButton variant="glass" block href={base()}>
          Manage in Pointer <Ic.External size={15} />
        </GlassButton>
        <GlassButton variant="danger" block disabled={busy} onClick={logout}>
          {busy ? 'Logging out…' : 'Log out'}
        </GlassButton>
      </div>
    </>
  );
}

function AccountRow({
  icon,
  title,
  value,
  href,
  external,
  onClick,
  mono,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  mono?: boolean;
  hint?: string;
}) {
  const body = (
    <>
      <span className="row__icon">{icon}</span>
      <span className="row__body">
        <span className="row__title">{title}</span>
      </span>
      <span className="meta" style={{ color: 'var(--fg-secondary)', fontVariantNumeric: mono ? 'tabular-nums' : undefined, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {hint ?? value}
      </span>
      <span className="row__chev">{external ? <Ic.External size={14} /> : onClick ? <Ic.Copy size={14} /> : <Ic.ChevronRight size={15} />}</span>
    </>
  );
  if (href)
    return (
      <a className="row" href={href} target="_blank" rel="noreferrer">
        {body}
      </a>
    );
  return (
    <button className="row" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {body}
    </button>
  );
}

function Sep() {
  return <div style={{ height: 1, background: 'var(--glass-border)', margin: '0 13px' }} />;
}
