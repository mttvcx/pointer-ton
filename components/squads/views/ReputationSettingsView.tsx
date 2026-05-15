'use client';

import { useEffect, useState } from 'react';
import { Check, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import type { PointerIdentity } from '@/lib/squads/types';
import { DEFAULT_POINTER_IDENTITY, PointerIdentitySchema } from '@/lib/squads/types';
import { SquadPanel } from '@/components/squads/squadsPrimitives';
import { cn } from '@/lib/utils/cn';

function mergeIdentity(patch?: Partial<PointerIdentity> | null): PointerIdentity {
  return {
    ...DEFAULT_POINTER_IDENTITY,
    ...(patch ?? {}),
    privacy: { ...DEFAULT_POINTER_IDENTITY.privacy, ...(patch?.privacy ?? {}) },
  };
}

export function ReputationSettingsView() {
  const { getAccessToken, authenticated } = usePointerAuth();
  const [ident, setIdent] = useState<PointerIdentity>(() => mergeIdentity());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authenticated) {
      setIdent(mergeIdentity());
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const token = await getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/me/pointer-identity', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled && res.ok) {
          const j = (await res.json()) as { identity?: PointerIdentity };
          setIdent(mergeIdentity(j.identity));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, getAccessToken]);

  const dn = ident.displayName ?? '';
  const displayLenOk = dn.length <= 48;

  async function save() {
    if (!authenticated) {
      toast.message('Sign in required', {
        description: 'Connect your wallet to save reputation preferences.',
      });
      return;
    }
    const ethRaw = ident.ethereumAddress?.trim() ?? '';
    if (ethRaw.length > 0 && !/^0x[a-fA-F0-9]{40}$/.test(ethRaw)) {
      toast.error('Fix invalid Ethereum address', {
        description: 'Use a full 0x-prefixed 20-byte hex address or leave blank.',
      });
      return;
    }

    const next: PointerIdentity = {
      ...ident,
      displayName: ident.displayName?.trim() || null,
      xUsername: ident.xUsername?.trim().replace(/^@/, '') || null,
      telegramUsername: ident.telegramUsername?.trim() || null,
      discordId: ident.discordId?.trim() || null,
      ethereumAddress: ethRaw.length === 0 ? null : ethRaw,
      privacy: { ...DEFAULT_POINTER_IDENTITY.privacy, ...ident.privacy },
    };
    let payload: PointerIdentity;
    try {
      payload = PointerIdentitySchema.parse(next);
    } catch {
      toast.error('Could not validate settings');
      return;
    }
    setSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/me/pointer-identity', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: payload }),
      });
      if (!res.ok) throw new Error('save_failed');
      const j = (await res.json()) as { identity: PointerIdentity };
      setIdent(mergeIdentity(j.identity));
      toast.success('Reputation settings saved');
    } catch {
      toast.error('Could not save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-[12px] text-fg-muted">Loading settings…</p>;
  }

  return (
    <div className="grid min-h-0 gap-6 lg:grid-cols-[1fr_300px]">
      <SquadPanel tone="premium" className="ring-1 ring-[#334b63]/28">
        <div className="flex flex-wrap items-start gap-3 border-b border-border-subtle pb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-ethos/10">
            <Shield className="h-4 w-4 text-accent-ethos" strokeWidth={2.2} />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-fg-primary">Reputation settings</h2>
            <p className="mt-0.5 text-[11.5px] text-fg-muted">
              Manage the identity, links, and trust signals you choose to surface in Squads.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="grid gap-1.5">
              <span className="mb-1.5 text-xs font-medium text-fg-muted">Pointer display name</span>
              <div className="relative">
                <input
                  value={ident.displayName ?? ''}
                  maxLength={48}
                  onChange={(e) =>
                    setIdent((i) => ({ ...i, displayName: e.target.value || null }))
                  }
                  className="h-9 w-full rounded-md border border-border-subtle bg-bg-sunken px-3 pr-10 text-sm text-fg-primary transition-colors placeholder:text-fg-muted focus:border-accent-ethos/50 focus:outline-none focus:ring-1 focus:ring-accent-ethos/20"
                />
                {displayLenOk && dn.length > 0 ? (
                  <Check
                    className="absolute top-2.5 right-2 h-4 w-4 text-[#6ee7b7]"
                    strokeWidth={2.6}
                  />
                ) : null}
              </div>
              <span className="text-right text-[10px] text-fg-muted">
                {(ident.displayName ?? '').length} / 48
              </span>
            </label>

            <label className="grid gap-1.5">
              <span className="mb-1.5 text-xs font-medium text-fg-muted">X username (optional)</span>
              <input
                value={ident.xUsername ? `@${ident.xUsername.replace(/^@/, '')}` : ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/^@+/, '').trim();
                  setIdent((i) => ({ ...i, xUsername: raw || null }));
                }}
                placeholder="@username"
                className="h-9 rounded-md border border-border-subtle bg-bg-sunken px-3 text-sm text-fg-primary transition-colors placeholder:text-fg-muted focus:border-accent-ethos/50 focus:outline-none focus:ring-1 focus:ring-accent-ethos/20"
              />
            </label>

            <div className="grid gap-1.5">
              <span className="mb-1.5 text-xs font-medium text-fg-muted">Telegram / Discord handle (optional)</span>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={ident.telegramUsername ?? ''}
                  onChange={(e) =>
                    setIdent((i) => ({ ...i, telegramUsername: e.target.value.trim() || null }))
                  }
                  placeholder="Telegram"
                  className="h-9 rounded-md border border-border-subtle bg-bg-sunken px-3 text-sm text-fg-primary transition-colors placeholder:text-fg-muted focus:border-accent-ethos/50 focus:outline-none focus:ring-1 focus:ring-accent-ethos/20"
                />
                <input
                  value={ident.discordId ?? ''}
                  onChange={(e) =>
                    setIdent((i) => ({ ...i, discordId: e.target.value.trim() || null }))
                  }
                  placeholder="Discord"
                  className="h-9 rounded-md border border-border-subtle bg-bg-sunken px-3 text-sm text-fg-primary transition-colors placeholder:text-fg-muted focus:border-accent-ethos/50 focus:outline-none focus:ring-1 focus:ring-accent-ethos/20"
                />
              </div>
            </div>

            <label className="grid gap-1.5">
              <span className="mb-1.5 text-xs font-medium text-fg-muted">Ethereum address (optional)</span>
              <input
                value={ident.ethereumAddress ?? ''}
                onChange={(e) =>
                  setIdent((i) => ({ ...i, ethereumAddress: e.target.value.trim() || null }))
                }
                placeholder="0x…"
                className="h-9 rounded-md border border-border-subtle bg-bg-sunken px-3 font-mono text-sm tabular-nums tracking-tight text-fg-primary transition-colors placeholder:text-fg-muted focus:border-accent-ethos/50 focus:outline-none focus:ring-1 focus:ring-accent-ethos/20"
              />
              <span className="text-[10px] text-fg-muted">Used to link your Ethos identity.</span>
            </label>
          </div>

          <div className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-bg-sunken">
            <ToggleRow
              title="Show Ethos badge publicly"
              description="Display your Ethos verification badge on your profile and in Squads."
              on={ident.privacy?.showEthos ?? true}
              onToggle={(v) =>
                setIdent((i) => ({
                  ...i,
                  privacy: { ...DEFAULT_POINTER_IDENTITY.privacy, ...i.privacy, showEthos: v },
                }))
              }
            />
            <ToggleRow
              title="Show reputation summary"
              description="Surface a compact summary of your reputation (rank, score, and top signals)."
              on={ident.privacy?.showReputationSummary ?? true}
              onToggle={(v) =>
                setIdent((i) => ({
                  ...i,
                  privacy: {
                    ...DEFAULT_POINTER_IDENTITY.privacy,
                    ...i.privacy,
                    showReputationSummary: v,
                  },
                }))
              }
            />
            <ToggleRow
              title="Looking-for-squad visibility"
              description="Allow others to see you in Looking for squad."
              on={ident.privacy?.lookingForSquadVisible ?? true}
              onToggle={(v) =>
                setIdent((i) => ({
                  ...i,
                  privacy: {
                    ...DEFAULT_POINTER_IDENTITY.privacy,
                    ...i.privacy,
                    lookingForSquadVisible: v,
                  },
                }))
              }
            />
            <ToggleRow
              title="Allow squad invites"
              description="Let other traders invite you to join their squads."
              on={ident.privacy?.allowInvites ?? true}
              onToggle={(v) =>
                setIdent((i) => ({
                  ...i,
                  privacy: {
                    ...DEFAULT_POINTER_IDENTITY.privacy,
                    ...i.privacy,
                    allowInvites: v,
                  },
                }))
              }
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-start gap-3 rounded-md border border-[#27303d] bg-[#0a0e14] p-3 text-[11px] text-fg-muted">
          <LockMini />
          <p>
            Your Solana and TON wallets are never shared.{' '}
            <button
              type="button"
              className="font-medium text-accent-ethos underline-offset-2 transition hover:text-accent-glow hover:underline"
              onClick={() =>
                toast.message('Wallet privacy', {
                  description:
                    'Chain execution wallets stay out of Squads. Optional links here only strengthen reputation signals you approve.',
                })
              }
            >
              Learn more
            </button>{' '}
            · You choose what to link and what to show.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !displayLenOk}
          className="mt-5 h-10 w-full rounded-md bg-accent-ethos text-sm font-semibold text-bg-base transition-colors hover:bg-accent-ethos-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save reputation settings'}
        </button>

        {!authenticated ? (
          <p className="mt-2 text-center text-[11px] text-fg-muted">
            Previewing controls — connect to sync.
          </p>
        ) : null}
      </SquadPanel>

      <SquadPanel tone="premium" className="ring-1 ring-[#334b63]/28">
        <div className="flex flex-wrap items-start gap-3 border-b border-border-subtle pb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-ethos/10">
            <Shield className="h-4 w-4 text-accent-ethos" strokeWidth={2.2} />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-fg-primary">How reputation works</h2>
            <p className="mt-0.5 text-[11.5px] text-fg-muted">
              Pointer builds reputation from verifiable signals across multiple sources. You control
              what&apos;s visible.
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-0 text-[11.5px]">
          <NumberedExplainer
            index={1}
            title="Source-attributed signals"
            body="Activity, performance, and community feedback from on-chain and social sources."
          />
          <NumberedExplainer
            index={2}
            title="Optional identities"
            body="Ethos ties on-chain handles to identities you verify. Useful context—not a substitute for homework."
          />
          <NumberedExplainer
            index={3}
            title="No forced doxxing"
            body="Nothing is required to participate. You choose what to link and what to show."
          />
          <NumberedExplainer
            index={4}
            title="Privacy first"
            body="We never share your Solana or TON wallets. They stay encrypted and private."
          />
        </ul>

        <p className="mt-4 flex items-center gap-2 border-t border-border-subtle pt-3 text-[10.5px] text-fg-muted">
          <LockMini />
          You&apos;re in control. Show less anytime.
        </p>
      </SquadPanel>
    </div>
  );
}

function LockMini() {
  return (
    <svg
      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}

function ToggleRow({
  title,
  description,
  on,
  onToggle,
}: {
  title: string;
  description: string;
  on: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-3">
      <div>
        <p className="text-sm font-medium text-fg-primary">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-fg-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onToggle(!on)}
        className={cn(
          'relative mt-1 h-[28px] w-[46px] shrink-0 rounded-full transition-colors',
          on ? 'bg-accent-ethos' : 'bg-[#343f4f]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-[22px] w-[22px] rounded-full bg-white shadow transition-transform',
            on ? 'translate-x-[18px]' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}

function NumberedExplainer({ index, title, body }: { index: number; title: string; body: string }) {
  return (
    <li className="flex items-start gap-2.5 border-t border-border-subtle/50 py-2.5 first:border-t-0 first:pt-0">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-ethos/10 text-xs font-bold tabular-nums text-accent-ethos">
        {index}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-fg-primary">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-fg-muted">{body}</p>
      </div>
    </li>
  );
}
