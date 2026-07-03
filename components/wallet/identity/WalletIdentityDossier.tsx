'use client';

import type { ReactNode } from 'react';
import { Copy, ExternalLink, Pencil, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { WalletIdentityView, WalletTokenContextView, WalletIntelBadgeKind } from '@/lib/walletIdentity/types';
import type { TraderMintHoverStats } from '@/lib/trading/mintTopTraders';
import { explorerAddressUrl, shortenAddress } from '@/lib/utils/addresses';
import { formatCompactUsd, formatNumber, formatRelativeTime } from '@/lib/utils/formatters';
import type { MockWideStatsShape } from '@/lib/walletIdentity/mockWalletWideStats';
import { WalletIdentityBadges } from '@/components/wallet/identity/WalletIdentityBadges';
import { TopHolderPills } from '@/components/wallet/identity/TopHolderCredentials';
import type { TopHolderCredential } from '@/lib/walletIdentity/topHolder';
import { cn } from '@/lib/utils/cn';
import { labelColorClass } from '@/lib/hooks/useWalletLabels';
import {
  modalBtnPrimaryClass,
  modalBtnSecondaryClass,
  modalSectionLabelClass,
} from '@/lib/ui/modalChrome';

function RowKV({ k, v, vCls }: { k: string; v: string; vCls?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-[11px]">
      <span className="shrink-0 text-fg-muted">{k}</span>
      <span className={cn('min-w-0 truncate text-right font-mono tabular-nums font-medium', vCls ?? 'text-fg-primary')}>
        {v}
      </span>
    </div>
  );
}

function ChipBtn({
  children,
  onClick,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const cls =
    'inline-flex items-center gap-1 rounded-sm border border-border-subtle bg-bg-sunken px-2 py-1 text-[10px] font-medium text-fg-secondary transition hover:bg-bg-hover hover:text-fg-primary';
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export function WalletIdentityDossier({
  identity,
  tokenCtx,
  mintStats,
  wide,
  topHoldings = [],
  onTrack,
  onLabel,
}: {
  identity: WalletIdentityView;
  tokenCtx: WalletTokenContextView | null;
  mintStats: TraderMintHoverStats | null | undefined;
  wide?: MockWideStatsShape | null;
  topHoldings?: TopHolderCredential[];
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
  const identityIsDefault =
    identity.identityHeadline === identity.shortAddress ||
    identity.identityHeadline === 'Unlabeled wallet';

  return (
    <div className="flex max-h-[min(520px,calc(100dvh-120px))] w-[min(20rem,calc(100vw-28px))] flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-raised shadow-2xl">
      <div className="flex items-start gap-2.5 border-b border-border-subtle px-3 py-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-sunken text-[11px] font-semibold text-fg-secondary">
          {identity.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={identity.avatarUrl} alt="" className="h-full w-full rounded-[5px] object-cover" />
          ) : (
            monogram
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-[13px] font-semibold text-fg-primary">{identity.displayName}</h3>
            <WalletIdentityBadges kinds={headerKinds.slice(0, 6)} max={6} variant="text" />
          </div>
          {identity.handle ? (
            <p className="mt-0.5 truncate text-[11px] text-fg-muted">{identity.handle}</p>
          ) : null}
          <p className="mt-0.5 truncate font-mono text-[10px] tabular-nums text-fg-muted" title={identity.address}>
            {shortenAddress(identity.address, 8)}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <ChipBtn
              onClick={() => {
                void navigator.clipboard?.writeText(identity.address);
                toast.success('Address copied');
              }}
            >
              <Copy className="h-3 w-3" strokeWidth={2} />
              Copy
            </ChipBtn>
            <ChipBtn href={ex}>
              <ExternalLink className="h-3 w-3" strokeWidth={2} />
              Explorer
            </ChipBtn>
            {profileHref ? <ChipBtn href={profileHref}>Profile</ChipBtn> : null}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-2.5">
        {!identityIsDefault ? (
          <div>
            <p className={modalSectionLabelClass}>Identity</p>
            <p className="mt-1 text-[11px] text-fg-secondary">{identity.identityHeadline}</p>
          </div>
        ) : null}

        <div>
          <p className={modalSectionLabelClass}>Label</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {identity.systemLabels.map((t) => (
              <span
                key={t}
                className="rounded-sm border border-border-subtle bg-bg-sunken px-1.5 py-px text-[9px] font-medium text-fg-secondary"
              >
                {t}
              </span>
            ))}
            {identity.userLabelText ? (
              <span
                className={cn(
                  'rounded-sm border border-border-subtle bg-bg-sunken px-1.5 py-px text-[9px] font-semibold',
                  identity.userLabelColor ? labelColorClass(String(identity.userLabelColor)) : 'text-fg-primary',
                )}
              >
                {identity.userLabelText}
              </span>
            ) : (
              <span className="text-[10px] text-fg-muted">None</span>
            )}
            <button
              type="button"
              onClick={onLabel}
              className="ml-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-fg-secondary transition hover:text-fg-primary"
            >
              <Pencil className="h-3 w-3" strokeWidth={2} />
              Edit
            </button>
          </div>
        </div>

        {topHoldings.length > 0 ? (
          <div>
            <p className={modalSectionLabelClass}>Top Holder</p>
            <TopHolderPills credentials={topHoldings} className="mt-1" />
          </div>
        ) : null}

        {tokenCtx ? (
          <div className="rounded-md border border-border-subtle bg-bg-sunken px-2.5 py-2">
            <p className={modalSectionLabelClass}>{`This mint · ${tokenCtx.tokenSymbol}`}</p>
            <div className="mt-1 divide-y divide-border-subtle">
              <RowKV k="Bought" v={formatCompactUsd(tokenCtx.boughtUsd)} vCls="text-signal-bull" />
              <RowKV k="Sold" v={formatCompactUsd(tokenCtx.soldUsd)} vCls="text-signal-bear" />
              <RowKV
                k="Realized PnL"
                v={`${tokenCtx.realizedPnlUsd >= 0 ? '+' : ''}${formatCompactUsd(tokenCtx.realizedPnlUsd)}`}
                vCls={tokenCtx.realizedPnlUsd >= 0 ? 'text-signal-bull' : 'text-signal-bear'}
              />
              <RowKV
                k="First fill"
                v={tokenCtx.firstBuyAt ? formatRelativeTime(tokenCtx.firstBuyAt) : '—'}
              />
              {mintStats ? (
                <RowKV k="Fills sampled" v={`${mintStats.buy_count + mintStats.sell_count}`} />
              ) : null}
            </div>
          </div>
        ) : null}

        {wide ? (
          <div className="rounded-md border border-border-subtle bg-bg-sunken px-2.5 py-2">
            <p className={modalSectionLabelClass}>Wallet rollup</p>
            <div className="mt-1 divide-y divide-border-subtle">
              <RowKV
                k="7D PnL"
                v={`${wide.pnl7dUsd >= 0 ? '+' : ''}$${formatNumber(wide.pnl7dUsd, { decimals: 0 })}`}
                vCls={wide.pnl7dUsd >= 0 ? 'text-signal-bull' : 'text-signal-bear'}
              />
              <RowKV
                k="30D PnL"
                v={`${(wide.pnl30dUsd ?? 0) >= 0 ? '+' : ''}$${formatNumber(wide.pnl30dUsd ?? 0, { decimals: 0 })}`}
                vCls={(wide.pnl30dUsd ?? 0) >= 0 ? 'text-signal-bull' : 'text-signal-bear'}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex gap-1.5 border-t border-border-subtle bg-bg-raised px-3 py-2">
        <button
          type="button"
          onClick={onTrack}
          className={cn(modalBtnPrimaryClass, 'flex-1 py-1.5 text-[11px]')}
        >
          <Star className="h-3 w-3" strokeWidth={2} />
          Open desk intel
        </button>
        <button
          type="button"
          onClick={() =>
            toast.message('Mute', {
              description: 'Local mute lists ship with synced preferences.',
            })
          }
          className={cn(modalBtnSecondaryClass, 'px-2.5 py-1.5 text-[11px]')}
          aria-label="Mute wallet"
        >
          <Trash2 className="h-3 w-3" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
