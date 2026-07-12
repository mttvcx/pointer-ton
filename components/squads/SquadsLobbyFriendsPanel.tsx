'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { LayoutGrid, RefreshCw, Search, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { buildReferralInviteUrl } from '@/lib/referral/referralUrls';
import { toast } from 'sonner';

const DEMO_FRIENDS = [
  { id: '1', handle: 'testerr34', monogram: 'TE', leader: true },
] as const;

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function SquadsLobbyFriendsPanel({
  lobbyTitle,
  memberCap = 10,
  onClose,
}: {
  lobbyTitle: string;
  memberCap?: number;
  onClose: () => void;
}) {
  const count = DEMO_FRIENDS.length;
  const { getAccessToken } = usePrivy();
  const [copying, setCopying] = useState(false);

  async function copyInviteLink() {
    if (copying) return;
    setCopying(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast.error('Sign in to get your invite link.');
        return;
      }
      const res = await fetch('/api/referrals/code', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('code');
      const { code } = (await res.json()) as { code?: string };
      if (!code) throw new Error('empty');
      const url = buildReferralInviteUrl(code);
      const ok = await writeClipboard(url);
      if (ok) {
        toast.success('Invite link copied', { description: url });
      } else {
        // Clipboard blocked (e.g. no focus) — surface the link so it's still usable.
        toast.message('Invite link', { description: url });
      }
    } catch {
      toast.error('Could not fetch your invite link. Try again.');
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="absolute inset-0 z-[3] flex flex-col bg-bg-raised">
      <div className="shrink-0 space-y-2 border-b border-border-subtle p-3">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted"
              strokeWidth={2}
              aria-hidden
            />
            <input
              type="search"
              placeholder="Search friends…"
              className="w-full rounded-md border border-border-subtle bg-bg-hover py-2 pl-8 pr-2 text-[12px] text-fg-primary placeholder:text-fg-muted focus:border-accent-primary/35 focus:outline-none"
            />
          </div>
          <button
            type="button"
            title="Grid view"
            aria-label="Grid view"
            className="btn-press flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-subtle text-fg-muted transition hover:border-border-default hover:bg-bg-hover hover:text-fg-primary"
          >
            <LayoutGrid className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => void copyInviteLink()}
            disabled={copying}
            className="btn-press shrink-0 rounded-md bg-accent-primary px-3 py-2 text-[11px] font-semibold text-fg-inverse transition hover:brightness-110 disabled:opacity-50"
          >
            {copying ? 'Copying…' : 'Add Friend'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[12px] font-medium text-fg-primary">
            {lobbyTitle}{' '}
            <span className="tabular-nums text-fg-muted">
              {count}/{memberCap}
            </span>
          </p>
          <button
            type="button"
            title="Refresh members"
            aria-label="Refresh members"
            className="btn-press rounded p-0.5 text-fg-muted transition hover:text-fg-primary"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {DEMO_FRIENDS.map((f) => (
          <li key={f.id}>
            <div className="flex items-center gap-2.5 rounded-md border border-border-subtle bg-bg-base/50 px-2.5 py-2">
              <div className="relative shrink-0">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-primary/20 text-[11px] font-bold text-accent-primary">
                  {f.monogram}
                </span>
                {f.leader ? (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px]" aria-hidden>
                    👑
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-fg-primary">{f.handle}</p>
                {f.leader ? (
                  <p className="text-[10px] text-fg-muted">Squad leader</p>
                ) : null}
              </div>
              <button
                type="button"
                title="Invite to squad"
                aria-label="Invite to squad"
                className="btn-press flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-subtle text-fg-muted transition hover:border-border-default hover:bg-bg-hover hover:text-accent-primary"
              >
                <UserPlus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="shrink-0 border-t border-border-subtle p-2">
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'w-full rounded-md py-2 text-[12px] font-medium text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary',
          )}
        >
          Back to chat
        </button>
      </div>
    </div>
  );
}
