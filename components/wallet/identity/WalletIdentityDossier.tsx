'use client';

import { Copy, ExternalLink, Pencil, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { WalletIdentityView, WalletTokenContextView, WalletIntelBadgeKind } from '@/lib/walletIdentity/types';
import type { TraderMintHoverStats } from '@/lib/trading/mintTopTraders';
import { explorerAddressUrl, shortenAddress } from '@/lib/utils/addresses';
import { formatCompactUsd, formatNumber, formatRelativeTime } from '@/lib/utils/formatters';
import type { MockWideStatsShape } from '@/lib/walletIdentity/mockWalletWideStats';
import { WalletIdentityBadges } from '@/components/wallet/identity/WalletIdentityBadges';
import { cn } from '@/lib/utils/cn';
import { labelColorClass } from '@/lib/hooks/useWalletLabels';

function SectionTitle({ children }: { children: string }) {
  return <div className="text-[10px] font-semibold tracking-tight text-fg-muted">{children}</div>;
}

function RowKV({ k, v, vCls }: { k: string; v: string; vCls?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1 text-[10px]">
      <span className="shrink-0 text-fg-muted">{k}</span>
      <span className={cn('min-w-0 truncate text-right tabular-nums font-medium', vCls ?? 'text-fg-primary')}>
        {v}
      </span>
    </div>
  );
}

export function WalletIdentityDossier({
  identity,
  tokenCtx,
  mintStats,
  wide,
  onTrack,
  onLabel,
}: {
  identity: WalletIdentityView;
  tokenCtx: WalletTokenContextView | null;
  mintStats: TraderMintHoverStats | null | undefined;
  wide: MockWideStatsShape;
  onTrack: () => void;
  onLabel: () => void;
}) {
  const ex = explorerAddressUrl(identity.address);
  const monogram = identity.displayName.slice(0, 2).toUpperCase();

  let headerKinds: WalletIntelBadgeKind[] = identity.badges;
  if (!headerKinds.includes('kol') && identity.knownIdentity?.badges.includes('kol')) {
    headerKinds = ['kol', ...headerKinds.filter((x) => x !== 'kol')];
  }

  const profileHref = identity.knownIdentity?.profileUrl;

  return (
    <div className="flex max-h-[min(560px,calc(100dvh-120px))] w-[min(22rem,calc(100vw-28px))] flex-col rounded-xl border border-white/[0.1] bg-[#070910]/[0.98] shadow-2xl backdrop-blur-md">
      <div className="flex items-start gap-2 border-b border-white/[0.07] p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-[12px] font-semibold tracking-tight text-fg-secondary">
          {identity.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={identity.avatarUrl} alt="" className="h-full w-full rounded-md object-cover" />
          ) : (
            monogram
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-[13px] font-semibold tracking-tight text-fg-primary">
              {identity.displayName}
            </h3>
            <WalletIdentityBadges kinds={headerKinds.slice(0, 8)} max={8} />
          </div>
          {identity.handle ? (
            <p className="mt-0.5 truncate text-[11px] text-signal-info/90">{identity.handle}</p>
          ) : null}
          <p className="mt-0.5 truncate text-[10px] tabular-nums tracking-tight text-fg-muted" title={identity.address}>
            {shortenAddress(identity.address, 8)}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(identity.address);
                toast.success('Address copied');
              }}
              className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-[10px] font-semibold text-fg-secondary hover:bg-white/[0.04]"
            >
              <Copy className="h-3 w-3" strokeWidth={2} />
              Copy
            </button>
            <a
              href={ex}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-[10px] font-semibold text-fg-secondary hover:bg-white/[0.04]"
            >
              <ExternalLink className="h-3 w-3" strokeWidth={2} />
              Explorer
            </a>
            {profileHref ? (
              <a
                href={profileHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-[10px] font-semibold text-fg-secondary hover:bg-white/[0.04]"
              >
                Profile
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-2">
        <div>
          <SectionTitle>Identity</SectionTitle>
          <div className="mt-1 divide-y divide-white/[0.05]">
            <RowKV k="Signals" v={identity.identityHeadline !== identity.shortAddress ? identity.identityHeadline : 'Unlabeled wallet'} />
            <RowKV k="Source line" v={identity.identitySourceLabel} />
            {identity.confidenceLabel ? <RowKV k="Confidence" v={identity.confidenceLabel} /> : null}
          </div>
        </div>

        <div>
          <SectionTitle>Labels</SectionTitle>
          <div className="mt-1 flex flex-wrap gap-1">
            {identity.systemLabels.map((t) => (
              <span
                key={t}
                className="rounded border border-white/[0.1] px-1.5 py-px text-[9px] font-medium text-fg-secondary"
              >
                {t}
              </span>
            ))}
            {identity.userLabelText ? (
              <span
                className={cn(
                  'rounded border border-white/[0.1] px-1.5 py-px text-[9px] font-semibold',
                  identity.userLabelColor ? labelColorClass(String(identity.userLabelColor)) : 'text-accent-primary',
                )}
              >
                {identity.userLabelText}
              </span>
            ) : (
              <span className="text-[9px] text-fg-muted">No user label</span>
            )}
          </div>
          <button
            type="button"
            onClick={onLabel}
            className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-signal-info hover:underline"
          >
            <Pencil className="h-3 w-3" strokeWidth={2} />
            Rename / label
          </button>
        </div>

        <div>
          <SectionTitle>Groups</SectionTitle>
          <div className="mt-1 flex flex-wrap gap-1">
            {identity.groups.length ? (
              identity.groups.map((g) => (
                <span key={g} className="rounded-full border border-border-subtle px-2 py-px text-[9px] text-fg-secondary">
                  {g}
                </span>
              ))
            ) : (
              <span className="text-[9px] text-fg-muted">No groups pinned</span>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              toast.message('Groups', { description: 'Persisted cohorts arrive with account sync — UI hook only for now.' })
            }
            className="mt-1 text-[10px] font-semibold text-signal-info hover:underline"
          >
            + Add to group
          </button>
        </div>

        {tokenCtx ? (
          <div>
            <SectionTitle>{`This mint (${tokenCtx.tokenSymbol})`}</SectionTitle>
            <div className="mt-1 divide-y divide-white/[0.05]">
              <RowKV k="Bought (notional)" v={formatCompactUsd(tokenCtx.boughtUsd)} vCls="text-signal-bull" />
              <RowKV k="Sold" v={formatCompactUsd(tokenCtx.soldUsd)} vCls="text-signal-bear" />
              <RowKV
                k="Realized PnL"
                v={`${tokenCtx.realizedPnlUsd >= 0 ? '+' : ''}${formatCompactUsd(tokenCtx.realizedPnlUsd)}`}
                vCls={tokenCtx.realizedPnlUsd >= 0 ? 'text-signal-bull' : 'text-signal-bear'}
              />
              {tokenCtx.remainingPct != null ? (
                <RowKV k="Position (proxy %)" v={`${formatNumber(tokenCtx.remainingPct, { decimals: 1 })}%`} />
              ) : null}
              {tokenCtx.rank != null ? <RowKV k="Desk rank" v={`#${tokenCtx.rank}`} /> : null}
              {tokenCtx.topTraderNote ? <RowKV k="Highlight" v={tokenCtx.topTraderNote} vCls="text-fg-secondary" /> : null}
              <RowKV k="First fill" v={tokenCtx.firstBuyAt ? formatRelativeTime(tokenCtx.firstBuyAt) : '—'} />
              <RowKV k="Last action" v={tokenCtx.lastActionAt ? formatRelativeTime(tokenCtx.lastActionAt) : '—'} />
              {mintStats ? <RowKV k="Pointer fills sampled" v={`${mintStats.buy_count + mintStats.sell_count}`} /> : null}
            </div>
          </div>
        ) : null}

        <div>
          <SectionTitle>Wallet rollup (preview)</SectionTitle>
          <div className="mt-1 divide-y divide-white/[0.05]">
            <RowKV k="7D PnL (est)" v={`${wide.pnl7dUsd >= 0 ? '+' : ''}$${formatNumber(wide.pnl7dUsd, { decimals: 0 })}`} />
            <RowKV
              k="30D PnL (est)"
              v={`${(wide.pnl30dUsd ?? 0) >= 0 ? '+' : ''}$${formatNumber(wide.pnl30dUsd ?? 0, { decimals: 0 })}`}
            />
            <RowKV k="7D tokens" v={`${wide.tokenCount7d}`} />
            <RowKV k="Tracked by" v={`${wide.trackedByCount}`} />
            <RowKV k="Renamed by" v={`${wide.renamedByCount}`} />
            <RowKV k="Rolling volume est." v={formatCompactUsd(wide.totalVolumeUsd)} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-t border-white/[0.07] bg-black/25 px-3 py-2">
        <button
          type="button"
          onClick={onTrack}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-white/[0.1] px-2 py-1.5 text-[10px] font-semibold text-fg-secondary hover:bg-white/[0.05]"
        >
          <Star className="h-3 w-3" strokeWidth={2} />
          Open desk intel
        </button>
        <button
          type="button"
          onClick={() =>
            toast.message('Blacklist', {
              description: 'Local mute lists ship with synced preferences — hook not wired.',
            })
          }
          className="inline-flex items-center justify-center gap-1 rounded-md border border-white/[0.08] px-2 py-1.5 text-[10px] font-semibold text-fg-muted hover:bg-white/[0.04]"
        >
          <Trash2 className="h-3 w-3 opacity-70" strokeWidth={2} />
          Mute
        </button>
      </div>
    </div>
  );
}
