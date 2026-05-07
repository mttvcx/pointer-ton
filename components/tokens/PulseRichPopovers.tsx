'use client';

import { useRef, useState, type ReactNode } from 'react';
import { ExternalLink, Lock, Shield, User, Bot } from 'lucide-react';
import { TokenImage } from '@/components/shared/TokenImage';
import {
  formatAgeShort,
  formatNumber,
  formatPercent,
  formatRelativeTime,
} from '@/lib/utils/formatters';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import type { PulseTokenBundle } from '@/types/tokens';
import type { PulseSocialModel } from '@/lib/tokens/pulseSocialLinks';
import { agentBuybackPctFromMetadata } from '@/lib/tokens/pulseRichMetadata';

function solscanAccountUrl(address: string): string {
  return `https://solscan.io/account/${encodeURIComponent(address)}`;
}

function isTwitterishUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return h === 'x.com' || h === 'twitter.com';
  } catch {
    return false;
  }
}

/** Axiom-style dense hover card; use `pointer-events-auto` on interactive panels. */
export function PulseRichHover({
  children,
  panel,
  wide,
}: {
  children: ReactNode;
  panel: ReactNode;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (t.current) clearTimeout(t.current);
    t.current = null;
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => {
        clear();
        t.current = setTimeout(() => setOpen(true), 100);
      }}
      onMouseLeave={() => {
        clear();
        t.current = setTimeout(() => setOpen(false), 200);
      }}
    >
      {children}
      {open ? (
        <div
          className={cn(
            'pointer-events-auto absolute left-1/2 top-[calc(100%+10px)] z-[100] max-h-[min(72vh,30rem)] max-w-[calc(100vw-1.25rem)] -translate-x-1/2 overflow-y-auto overflow-x-hidden',
            'rounded-2xl border border-white/[0.07] bg-[#08090b]/97 shadow-[0_28px_70px_-16px_rgba(0,0,0,0.88),inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl',
            wide ? 'w-[19.5rem]' : 'w-[17.25rem]',
          )}
          role="dialog"
          aria-label="Details"
        >
          {panel}
        </div>
      ) : null}
    </span>
  );
}

const labelMuted = 'text-[10px] font-medium uppercase tracking-wide text-[#9ca3af]';

export function TwitterProfileHoverPanel({
  bundle,
  model,
  followers,
}: {
  bundle: PulseTokenBundle;
  model: PulseSocialModel;
  followers: number | null;
}) {
  const { token } = bundle;
  const profile = model.twitterProfile;
  if (!profile?.url) return null;

  const handle = profile.handle?.replace(/^@/, '') ?? '';
  const bio =
    typeof token.description === 'string' && token.description.trim()
      ? token.description.trim()
      : null;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl">
      <div className="relative h-12 w-full overflow-hidden bg-gradient-to-b from-white/[0.07] to-[#0a0b0d]">
        <TokenImage
          src={token.image_url}
          alt=""
          size={400}
          className="!h-12 !w-full !rounded-none !object-cover opacity-[0.25] brightness-[0.4]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08090b] via-transparent to-transparent" />
      </div>
      <div className="relative -mt-4 flex flex-col gap-2 px-3 pb-3 pt-0">
        <div className="flex items-end gap-2">
          <TokenImage
            src={token.image_url}
            alt={token.symbol ?? ''}
            size={48}
            className="!rounded-xl ring-2 ring-[#121316]"
          />
          <div className="min-w-0 flex-1 pb-0.5">
            <p className="truncate text-[13px] font-semibold text-white">{token.name ?? '-'}</p>
            <p className="text-[11px] text-white/45">@{handle || 'profile'}</p>
          </div>
        </div>
        {bio ? (
          <p className="line-clamp-4 text-[11px] leading-snug text-white/72">{bio}</p>
        ) : null}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/90">
          <span>
            <span className="text-white/40">Followers </span>
            <span className="font-semibold tabular-nums text-[#7dd3fc]">
              {followers != null && followers > 0
                ? formatNumber(followers, { compact: true })
                : '-'}
            </span>
          </span>
        </div>
        <a
          href={profile.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] py-2 text-center text-[12px] font-semibold text-[#7dd3fc] transition hover:border-[#7dd3fc]/35 hover:bg-[#7dd3fc]/[0.08]"
        >
          See profile on X
        </a>
      </div>
    </div>
  );
}

export function WebsiteHoverPanel({ url }: { url: string }) {
  const display = url.replace(/^https?:\/\//i, '');
  const twitterish = isTwitterishUrl(url);
  return (
    <div className="flex flex-col gap-2.5 p-3">
      <div>
        <p className={labelMuted}>Website</p>
        <p className="mt-1 break-all text-[12px] font-medium leading-snug text-white">{display}</p>
        {twitterish ? (
          <p className="mt-1.5 text-[10px] text-[#70C0E8]/90">
            Resolves to X / Twitter (metadata external link).
          </p>
        ) : null}
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 rounded-lg border border-white/14 py-2 text-[11px] font-semibold text-[#70C0E8] hover:border-[#70C0E8]/45 hover:bg-[#70C0E8]/[0.07]"
      >
        Open link
        <ExternalLink className="h-3 w-3 opacity-80" strokeWidth={2} aria-hidden />
      </a>
    </div>
  );
}

export function BrandLinkHoverPanel({ url, title }: { url: string; title: string }) {
  const display = url.replace(/^https?:\/\//i, '');
  return (
    <div className="flex flex-col gap-2 p-3">
      <p className={labelMuted}>{title}</p>
      <p className="break-all text-[11px] leading-snug text-white/90">{display}</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#70C0E8] hover:underline"
      >
        Open
        <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden />
      </a>
    </div>
  );
}

export function FeeShareHoverPanel({ bundle }: { bundle: PulseTokenBundle }) {
  const { token, snapshot } = bundle;
  const dev = token.creator_wallet;
  const top10 = snapshot?.top10_holder_pct;
  const devPct = snapshot?.dev_holding_pct;
  const locked = token.is_lp_locked === true;

  return (
    <div className="flex flex-col gap-2.5 p-3">
      <div>
        <p className={labelMuted}>Fee authority</p>
        {dev ? (
          <a
            href={solscanAccountUrl(dev)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2 text-[11px] text-white transition hover:border-white/15"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <User className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" strokeWidth={2} aria-hidden />
              <span className="truncate tabular-nums tabular-nums">{shortenAddress(dev, 4)}</span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" strokeWidth={2} aria-hidden />
          </a>
        ) : (
          <p className="mt-1 text-[11px] text-white/50">No creator wallet indexed.</p>
        )}
        <div className="mt-2 flex flex-col gap-0.5 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <Lock className="h-3 w-3" strokeWidth={2} aria-hidden />
            {locked ? 'Locked' : 'Unknown'}
          </span>
          <span className="text-[10px] text-[#9ca3af]">Status</span>
        </div>
      </div>
      <div>
        <p className={labelMuted}>Shares</p>
        <p className="mt-1 text-[10px] leading-snug text-white/55">
          Holder mix from our latest snapshot.
        </p>
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2">
            <span className="flex min-w-0 items-center gap-2">
              <TokenImage src={token.image_url} alt="" size={28} className="!rounded-md" />
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold text-white">
                  {token.symbol ?? 'Supply'}
                </span>
                <span className="text-[10px] text-emerald-400/90">Top 10 holders</span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold tabular-nums text-white">
              {top10 != null ? formatPercent(top10, { decimals: 2 }) : '-'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2">
            <span className="flex min-w-0 items-center gap-2">
              <User className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" strokeWidth={2} aria-hidden />
              <span className="truncate tabular-nums text-[11px] text-white">
                {dev ? shortenAddress(dev, 4) : '-'}
              </span>
            </span>
            <span className="text-[12px] font-semibold tabular-nums text-white">
              {devPct != null ? formatPercent(devPct, { decimals: 2 }) : '-'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgentHoverPanel({ bundle }: { bundle: PulseTokenBundle }) {
  const rate = agentBuybackPctFromMetadata(bundle);
  const pay = bundle.token.creator_wallet;
  const rateLabel = rate != null ? `${Math.round(rate)}% Buyback` : 'Buyback';

  return (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <p className="text-[11px] font-medium text-[#d1d5db]">Agent actions</p>
        <div className="mt-2 flex items-center gap-2">
          <Bot className="h-5 w-5 shrink-0 text-emerald-400" strokeWidth={2} aria-hidden />
          <div>
            <p className="text-[13px] font-semibold text-emerald-400">{rateLabel}</p>
            <p className="text-[10px] text-[#9ca3af]">Rate</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ['Buybacks', '$0'],
            ['Revenue', '$0'],
            ['Unclaimed', '$0'],
            ['Claimed', '$0'],
          ] as const
        ).map(([k, v]) => (
          <div
            key={k}
            className="rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1.5 text-center"
          >
            <p className="text-[12px] font-semibold tabular-nums text-white">{v}</p>
            <p className="text-[9px] text-[#9ca3af]">{k}</p>
          </div>
        ))}
      </div>
      <div>
        <p className={labelMuted}>Payment authority</p>
        {pay ? (
          <a
            href={solscanAccountUrl(pay)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2"
          >
            <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-white">
              <Shield className="h-3.5 w-3.5 shrink-0 text-emerald-400" strokeWidth={2} aria-hidden />
              <span className="truncate tabular-nums">{shortenAddress(pay, 4)}</span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" strokeWidth={2} aria-hidden />
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function PumpFunHoverPanel({ bundle, pumpUrl }: { bundle: PulseTokenBundle; pumpUrl: string }) {
  const { token } = bundle;
  const t = formatRelativeTime(token.created_at);

  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-xl">
      <div className="relative h-24 w-full bg-bg-hover">
        <TokenImage
          src={token.image_url}
          alt=""
          size={320}
          className="!h-24 !w-full !rounded-none !object-cover"
        />
      </div>
      <div className="px-3 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[13px] font-semibold text-white">{token.name ?? token.symbol}</p>
          <p className="shrink-0 text-[11px] text-[#70C0E8]">{t}</p>
        </div>
        <p className="mt-0.5 truncate tabular-nums text-[10px] text-[#9ca3af]">
          {shortenAddress(token.mint, 6)}
        </p>
        <a
          href={pumpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex w-full items-center justify-center rounded-lg border border-white/15 bg-black/40 py-2 text-[11px] font-semibold text-white transition hover:border-emerald-400/40 hover:text-emerald-300"
        >
          Open in pump.fun
        </a>
      </div>
    </div>
  );
}

export function DevFundedHoverPanel({ bundle }: { bundle: PulseTokenBundle }) {
  const { token } = bundle;
  const sol = token.initial_liquidity_sol;
  const at = token.initial_liquidity_at;
  const devPct = bundle.snapshot?.dev_holding_pct;

  return (
    <div className="flex w-[15rem] flex-col gap-2.5 p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="tabular-nums text-[11px] text-white">
          {token.creator_wallet ? shortenAddress(token.creator_wallet, 6) : '-'}
        </span>
        {token.creator_wallet ? (
          <a
            href={solscanAccountUrl(token.creator_wallet)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#9ca3af] hover:text-[#70C0E8]"
            aria-label="Solscan"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-white/[0.08] bg-black/35 px-2 py-2 text-center">
          <p className="text-[12px] font-semibold tabular-nums text-white">
            {sol != null ? `${formatNumber(sol, { decimals: 3 })}` : '-'}
          </p>
          <p className="text-[9px] text-[#9ca3af]">SOL seeded</p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-black/35 px-2 py-2 text-center">
          <p className="text-[12px] font-semibold tabular-nums text-white">
            {at ? formatAgeShort(at) : '-'}
          </p>
          <p className="text-[9px] text-[#9ca3af]">Funded</p>
        </div>
      </div>
      {devPct != null ? (
        <p className="text-[10px] text-[#9ca3af]">
          Dev ~{formatPercent(devPct, { decimals: 0 })} of supply (snapshot)
        </p>
      ) : null}
    </div>
  );
}
