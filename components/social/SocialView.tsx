'use client';

import { useState } from 'react';
import { Check, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { shortenAddress } from '@/lib/utils/addresses';
import { formatRelativeTime } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import {
  useFriendRequests,
  useFriends,
  useFollowing,
  useSocialActions,
} from '@/lib/hooks/useSocial';

type Tab = 'friends' | 'requests' | 'following';

function personLabel(p: { username?: string | null; twitterHandle?: string | null; walletAddress?: string | null }): string {
  if (p.username?.trim()) return p.username;
  if (p.twitterHandle?.trim()) return `@${p.twitterHandle.replace(/^@/, '')}`;
  if (p.walletAddress?.trim()) return shortenAddress(p.walletAddress, 4);
  return 'Unknown';
}

function Avatar({ label }: { label: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-sunken text-[11px] font-semibold text-fg-secondary">
      {label.replace(/^@/, '').slice(0, 2).toUpperCase()}
    </span>
  );
}

export function SocialView() {
  const [tab, setTab] = useState<Tab>('friends');
  const friends = useFriends();
  const requests = useFriendRequests();
  const following = useFollowing();
  const { respond, unfollow } = useSocialActions();

  const reqCount = requests.data?.requests.length ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-accent-primary" strokeWidth={2} />
        <h1 className="text-[16px] font-semibold text-fg-primary">Social</h1>
        {following.data?.counts ? (
          <span className="ml-auto text-[11px] text-fg-muted">
            {following.data.counts.following} following · {following.data.counts.followers} followers
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-sunken p-1">
        {(['friends', 'requests', 'following'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-semibold capitalize transition',
              tab === t ? 'bg-bg-hover text-fg-primary' : 'text-fg-muted hover:text-fg-secondary',
            )}
          >
            {t}
            {t === 'requests' && reqCount > 0 ? (
              <span className="rounded-full bg-accent-primary px-1.5 text-[9px] font-bold text-white">{reqCount}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="min-h-[200px] rounded-xl border border-border-subtle bg-bg-raised p-1.5">
        {tab === 'friends' ? (
          friends.isLoading ? (
            <Empty text="Loading friends…" />
          ) : (friends.data?.friends.length ?? 0) === 0 ? (
            <Empty text="No friends yet. Accept a request or add someone." />
          ) : (
            friends.data!.friends.map((f) => (
              <div key={f.userId} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-bg-hover">
                <Avatar label={personLabel(f)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-fg-primary">{personLabel(f)}</p>
                  {f.walletAddress ? <p className="truncate font-mono text-[10px] text-fg-muted">{shortenAddress(f.walletAddress, 5)}</p> : null}
                </div>
                <span className="shrink-0 text-[10px] text-fg-muted">{f.since ? formatRelativeTime(f.since) : ''}</span>
              </div>
            ))
          )
        ) : tab === 'requests' ? (
          requests.isLoading ? (
            <Empty text="Loading requests…" />
          ) : reqCount === 0 ? (
            <Empty text="No incoming friend requests." />
          ) : (
            requests.data!.requests.map((r) => (
              <div key={r.requestId} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-bg-hover">
                <Avatar label={personLabel(r)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-fg-primary">{personLabel(r)}</p>
                  <p className="text-[10px] text-fg-muted">wants to be friends</p>
                </div>
                <button
                  type="button"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ requestId: r.requestId, accept: true })}
                  className="btn-press flex h-7 w-7 items-center justify-center rounded-md bg-signal-bull/15 text-signal-bull transition hover:bg-signal-bull/25 disabled:opacity-40"
                  aria-label="Accept"
                >
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ requestId: r.requestId, accept: false })}
                  className="btn-press flex h-7 w-7 items-center justify-center rounded-md bg-signal-bear/15 text-signal-bear transition hover:bg-signal-bear/25 disabled:opacity-40"
                  aria-label="Decline"
                >
                  <X className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            ))
          )
        ) : following.isLoading ? (
          <Empty text="Loading…" />
        ) : (following.data?.following.length ?? 0) === 0 ? (
          <Empty text="Not following anyone yet. Follow a wallet or trader to see their moves." />
        ) : (
          following.data!.following.map((f) => (
            <div key={`${f.targetType}:${f.targetRef}`} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-bg-hover">
              <Avatar label={f.targetType === 'wallet' ? f.targetRef : personLabel(f)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-fg-primary">
                  {f.targetType === 'wallet' ? shortenAddress(f.targetRef, 5) : f.targetType === 'twitter' ? `@${f.targetRef}` : personLabel(f)}
                </p>
                <p className="text-[10px] capitalize text-fg-muted">{f.targetType}</p>
              </div>
              <button
                type="button"
                disabled={unfollow.isPending}
                onClick={() => unfollow.mutate({ targetType: f.targetType, targetRef: f.targetRef })}
                className="btn-press flex items-center gap-1 rounded-md border border-border-subtle px-2 py-1 text-[11px] font-medium text-fg-secondary transition hover:border-signal-bear/40 hover:text-signal-bear disabled:opacity-40"
              >
                <UserMinus className="h-3 w-3" strokeWidth={2} /> Unfollow
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <UserPlus className="h-6 w-6 text-fg-muted/50" strokeWidth={1.5} />
      <p className="text-[12px] text-fg-muted">{text}</p>
    </div>
  );
}
