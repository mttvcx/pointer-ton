/**
 * X profile summary card — the hover payoff on a handle. Renders Pointer's
 * identity directory data: name + category badge + verified, socials, and the
 * KOL's linked wallets (deep-link to per-wallet analytics). A clean "no label
 * yet → tag them" state when the handle isn't in the directory (feeds the
 * crowdsourced directory).
 */
import { pointer } from '@/pointer/client';

export interface ProfileSummary {
  handle: string;
  found: boolean;
  name: string | null;
  badge: string | null;
  verified: boolean;
  telegram: string | null;
  website: string | null;
  notes: string | null;
  wallets: { address: string; chain: string; label: string | null }[];
  labels: string[];
  cas?: { mint: string; chain: string; firstSeen: string }[];
  smartFollowers: number | null;
  smartFollowerList?: { handle: string; name: string; badge: string | null }[];
  ethos: { score: number | null; reviews: number | null } | null;
}

const LOGO_URL = chrome.runtime.getURL('pointer-bird.png');
const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);
const explorer = (chain: string, a: string) =>
  chain === 'solana' || chain === 'sol' ? `https://solscan.io/account/${a}` : `https://etherscan.io/address/${a}`;

export function ProfileCard({ data }: { data: ProfileSummary }) {
  return (
    <div className="pt-card" style={{ width: 320, padding: 0, overflow: 'hidden', color: 'var(--fg-primary)' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', borderBottom: '1px solid var(--border-subtle)' }}>
        <img src={LOGO_URL} alt="" width={15} height={15} style={{ objectFit: 'contain' }} />
        <span style={{ fontWeight: 600, fontSize: 12.5, letterSpacing: '-0.02em' }}>pointer</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-muted)' }}>@{data.handle}</span>
      </div>

      {!data.found ? (
        <div style={{ padding: 16 }}>
          <div style={{ fontWeight: 650, fontSize: 13.5, marginBottom: 4 }}>No Pointer label yet</div>
          <p style={{ color: 'var(--fg-muted)', fontSize: 12, lineHeight: 1.5, margin: '0 0 12px' }}>
            This account isn’t in Pointer’s directory. Tag them — your label is verified and added so everyone benefits.
          </p>
          <button onClick={() => window.open('https://x.com/' + data.handle, '_self')} style={ghost}>
            Tag @{data.handle}
          </button>
        </div>
      ) : (
        <div style={{ padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 12, fontSize: 16, fontWeight: 700, color: '#fff', background: 'linear-gradient(150deg,#7c83ff,#9a7cff)', boxShadow: '0 4px 14px -6px #7c83ff' }}>
              {(data.name ?? data.handle).slice(0, 1).toUpperCase()}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontWeight: 650, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.name ?? `@${data.handle}`}</span>
                {data.verified && <span style={{ color: '#3ddc97', fontSize: 12 }}>✓</span>}
              </div>
              {data.badge && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3, padding: '1px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em', color: '#c8ccff', background: 'rgba(124,131,255,0.16)', border: '1px solid rgba(124,131,255,0.45)' }}>
                  {data.badge}
                </span>
              )}
            </div>
          </div>

          {data.notes && <p style={{ margin: 0, fontSize: 12, color: 'var(--fg-secondary)', lineHeight: 1.45 }}>{data.notes}</p>}

          {/* linked wallets */}
          {data.wallets.length > 0 && (
            <div>
              <div style={label}>Linked wallets · {data.wallets.length}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.wallets.slice(0, 4).map((w) => (
                  <a key={w.address} href={explorer(w.chain, w.address)} target="_blank" rel="noreferrer" style={walletRow}>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{short(w.address)}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, textTransform: 'uppercase', color: 'var(--fg-muted)', fontWeight: 700 }}>{w.chain}</span>
                    <span style={{ color: 'var(--fg-muted)', fontSize: 12 }}>↗</span>
                  </a>
                ))}
                {data.wallets.length > 4 && <span style={{ fontSize: 11, color: 'var(--fg-muted)', paddingLeft: 2 }}>+{data.wallets.length - 4} more</span>}
              </div>
            </div>
          )}

          {/* socials */}
          {(data.telegram || data.website) && (
            <div style={{ display: 'flex', gap: 8 }}>
              {data.telegram && (
                <a href={`https://t.me/${data.telegram.replace(/^@/, '')}`} target="_blank" rel="noreferrer" style={chip}>Telegram</a>
              )}
              {data.website && (
                <a href={data.website} target="_blank" rel="noreferrer" style={chip}>Website</a>
              )}
            </div>
          )}

          <button onClick={() => void pointer.profile(data.handle)} style={ghost}>
            Open in Pointer
          </button>
        </div>
      )}
    </div>
  );
}

const label: React.CSSProperties = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-muted)', fontWeight: 600, marginBottom: 6 };
const walletRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 9, background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)', textDecoration: 'none', color: 'var(--fg-primary)' };
const chip: React.CSSProperties = { flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: 9, fontSize: 11.5, fontWeight: 600, textDecoration: 'none', color: 'var(--fg-secondary)', background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' };
const ghost: React.CSSProperties = { width: '100%', padding: '9px 0', borderRadius: 9, border: '1px solid var(--border-subtle)', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: 'var(--fg-primary)', background: 'var(--bg-hover)' };
