'use client';

import type { ReactNode } from 'react';
import { ArrowUpRight, Heart, MessageCircle, Users } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatNumber, formatRelativeTime } from '@/lib/utils/formatters';
import {
  coinCommunityWebUrl,
  type CoinCommunitySummary,
} from '@/lib/communities/coinCommunity';
import { useCoinCommunity } from '@/lib/hooks/useCoinCommunity';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

const PANEL_BG = '#0a0a0a';
const CC_LOGO_SRC = '/pulse-glyphs/coin-communities.png';

function CoinCommunityHoverShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="w-[320px] overflow-hidden rounded-xl border border-white/[0.06] shadow-2xl shadow-black/60"
      style={{ backgroundColor: PANEL_BG }}
    >
      {children}
    </div>
  );
}

function StatPill({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-white/45">{icon}</span>
      <span className="font-medium tabular-nums text-white">{value}</span>
      <span className="text-white/45">{label}</span>
    </span>
  );
}

function MessageRow({ message }: { message: CoinCommunitySummary['messages'][number] }) {
  const name = message.displayName || message.username || 'anon';
  return (
    <div className="flex gap-2 px-3 py-2">
      <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
        {message.profileImageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote avatar */
          <img
            src={message.profileImageUrl}
            alt=""
            width={28}
            height={28}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[11px] font-medium text-white/40">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-[11.5px] font-semibold leading-none text-white/90">
            {name}
          </span>
          {message.createdAt ? (
            <span className="shrink-0 text-[10px] leading-none text-white/35">
              {formatRelativeTime(message.createdAt)}
            </span>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-white/65">
          {message.content || '\u2014'}
        </p>
        {message.likeCount > 0 ? (
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-white/35">
            <Heart className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
            {formatNumber(message.likeCount, { decimals: 0 })}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function CoinCommunityHoverBody({ data }: { data: CoinCommunitySummary }) {
  const symbol = data.tokenSymbol ? `$${data.tokenSymbol}` : 'Token';
  return (
    <CoinCommunityHoverShell>
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-white/[0.06]">
          {data.tokenImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote token image */
            <img
              src={data.tokenImageUrl}
              alt=""
              width={40}
              height={40}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-white/40">
              <Users className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold leading-tight text-white">
            {symbol} Community
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] leading-none text-white/45">
            {/* eslint-disable-next-line @next/next/no-img-element -- bundled brand glyph */}
            <img
              src={CC_LOGO_SRC}
              alt=""
              width={12}
              height={12}
              className="h-3 w-3 shrink-0 object-contain opacity-80"
              draggable={false}
            />
            Coin Communities
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 px-3 pb-2.5 text-[11.5px]">
        <StatPill
          icon={<Users className="h-3 w-3" strokeWidth={2} aria-hidden />}
          value={formatNumber(data.memberCount, { decimals: 0 })}
          label="members"
        />
        <StatPill
          icon={<MessageCircle className="h-3 w-3" strokeWidth={2} aria-hidden />}
          value={formatNumber(data.postCount, { decimals: 0 })}
          label="posts"
        />
        <StatPill
          icon={<Heart className="h-3 w-3" strokeWidth={2} aria-hidden />}
          value={formatNumber(data.totalLikes, { decimals: 0 })}
          label="likes"
        />
      </div>

      {data.messages.length > 0 ? (
        <div className="divide-y divide-white/[0.04] border-y border-white/[0.04]">
          {data.messages.slice(0, 3).map((m) => (
            <MessageRow key={m.id} message={m} />
          ))}
        </div>
      ) : (
        <div className="border-y border-white/[0.04] px-3 py-3 text-center text-[11.5px] text-white/45">
          No posts yet — be the first.
        </div>
      )}

      <div className="px-3 py-3">
        <a
          href={data.webUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-white/[0.06] py-2 text-center text-[12px] font-medium text-white/90 transition-colors hover:bg-white/[0.10]"
        >
          Open community
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </a>
      </div>
    </CoinCommunityHoverShell>
  );
}

function CoinCommunityHoverSkeleton() {
  return (
    <CoinCommunityHoverShell>
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
        <div className="h-10 w-10 animate-pulse rounded-md bg-white/[0.06]" />
        <div className="min-w-0 flex-1">
          <div className="h-3 w-32 animate-pulse rounded bg-white/[0.06]" />
          <div className="mt-1.5 h-2.5 w-24 animate-pulse rounded bg-white/[0.04]" />
        </div>
      </div>
      <div className="flex gap-3 px-3 pb-3">
        <div className="h-2.5 w-16 animate-pulse rounded bg-white/[0.04]" />
        <div className="h-2.5 w-16 animate-pulse rounded bg-white/[0.04]" />
        <div className="h-2.5 w-16 animate-pulse rounded bg-white/[0.04]" />
      </div>
      <div className="space-y-0 border-y border-white/[0.04] py-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-2 px-3 py-2">
            <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-white/[0.05]" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-2.5 w-24 animate-pulse rounded bg-white/[0.05]" />
              <div className="h-2 w-full animate-pulse rounded bg-white/[0.04]" />
              <div className="h-2 w-4/5 animate-pulse rounded bg-white/[0.03]" />
            </div>
          </div>
        ))}
      </div>
    </CoinCommunityHoverShell>
  );
}

function CoinCommunityHoverEmpty({ mint }: { mint: string }) {
  return (
    <CoinCommunityHoverShell>
      <div className="px-3 py-5 text-center">
        <p className="text-[13px] font-medium text-white/80">Community not loaded</p>
        <p className="mt-1 text-[11.5px] text-white/45">Open on Coin Communities to view posts.</p>
        <a
          href={coinCommunityWebUrl(mint)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-white/90 transition-colors hover:bg-white/[0.10]"
        >
          Open community
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </a>
      </div>
    </CoinCommunityHoverShell>
  );
}

export function CoinCommunityHoverCard({ mint }: { mint: string }) {
  const { data, isLoading, isError } = useCoinCommunity(mint);
  if (isLoading && !data) return <CoinCommunityHoverSkeleton />;
  if (isError && !data) return <CoinCommunityHoverEmpty mint={mint} />;
  if (!data) return <CoinCommunityHoverSkeleton />;
  return <CoinCommunityHoverBody data={data} />;
}

/**
 * HoverCard wrapper — wraps any trigger element with a Radix HoverCard that shows
 * {@link CoinCommunityHoverCard} on hover. Mirrors `TwitterProfileHoverTrigger`.
 */
export function CoinCommunityHoverTrigger({
  mint,
  children,
  side = 'top',
  align = 'center',
  sideOffset = 8,
}: {
  mint: string;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}) {
  return (
    <HoverCard openDelay={120} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={cn('w-auto border-0 bg-transparent p-0 shadow-none')}
        collisionPadding={12}
      >
        <CoinCommunityHoverCard mint={mint} />
      </HoverCardContent>
    </HoverCard>
  );
}
