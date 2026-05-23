'use client';

import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { CELL_PRIMARY_CLASS, CELL_SECONDARY_CLASS } from './deskTokens';
import { FundingSharedPopover } from './FundingSharedPopover';
import {
  VenueIcon,
  isKnownCexVenue,
  isSolanaWalletAddress,
  truncateFundingWallet,
} from './VenueIcon';

export type FundingCellProps = {
  /** CEX name (e.g. Binance) or, for wallet-funded rows, the source wallet address. */
  venue?: string | null;
  /** Holder/trader wallet — used as line-1 label when funding is not from a known CEX. */
  fundingWallet?: string | null;
  ageSinceFund?: string | null;
  solFunding?: string | null;
  txCount?: number | null;
  /** Wallets sharing this funding source (Shared Funding popover). */
  sharedFundedCount?: number | null;
  className?: string;
};

function FundingMetaLine({
  ageSinceFund,
  solFunding,
  txCount,
}: {
  ageSinceFund?: string | null;
  solFunding?: string | null;
  txCount?: number | null;
}) {
  const hasMeta = ageSinceFund || solFunding || txCount != null;
  if (!hasMeta) return null;

  return (
    <span className={cn(CELL_SECONDARY_CLASS, 'flex items-center gap-1')}>
      {ageSinceFund ? <span>{ageSinceFund}</span> : null}
      {ageSinceFund && (solFunding || txCount != null) ? (
        <span className="text-fg-muted/30">·</span>
      ) : null}
      {solFunding ? (
        <span className="inline-flex items-center gap-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/chains/sol.png" alt="" width={10} height={10} className="h-2.5 w-2.5 opacity-80" />
          <span>{solFunding}</span>
        </span>
      ) : null}
      {solFunding && txCount != null ? <span className="text-fg-muted/30">·</span> : null}
      {txCount != null ? (
        <span className="inline-flex items-center gap-0.5">
          <Layers className="h-2.5 w-2.5 text-fg-muted/70" strokeWidth={2} aria-hidden />
          <span>{txCount}</span>
        </span>
      ) : null}
    </span>
  );
}

export function FundingCell({
  venue,
  fundingWallet,
  ageSinceFund,
  solFunding,
  txCount,
  sharedFundedCount,
  className,
}: FundingCellProps) {
  if (!venue && !fundingWallet) {
    return <span className="text-[12px] font-normal text-fg-muted/60">{'\u2014'}</span>;
  }

  const cex =
    venue != null &&
    isKnownCexVenue(venue) &&
    !isSolanaWalletAddress(venue);

  const walletSource =
    fundingWallet ??
    (venue && (!isKnownCexVenue(venue) || isSolanaWalletAddress(venue)) ? venue : null);

  const line1Label = cex
    ? venue!
    : walletSource
      ? truncateFundingWallet(walletSource)
      : '\u2014';

  const fundedCount = sharedFundedCount ?? txCount ?? 1;
  const totalSol = solFunding ?? '\u2014';
  const showSharedPopover = fundedCount > 0 && totalSol !== '\u2014';

  const cellBody = (
    <div className={cn('flex flex-col gap-[2px]', className)}>
      <span className={cn(CELL_PRIMARY_CLASS, 'flex items-center gap-1.5')}>
        <VenueIcon venue={cex ? venue : null} />
        <span
          className={cn(
            'truncate',
            cex ? 'font-medium text-fg-primary' : 'font-normal text-fg-muted',
          )}
        >
          {line1Label}
        </span>
      </span>
      <FundingMetaLine
        ageSinceFund={ageSinceFund}
        solFunding={solFunding}
        txCount={txCount}
      />
    </div>
  );

  if (!showSharedPopover) {
    return cellBody;
  }

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="block w-full cursor-default rounded-sm text-left outline-none focus-visible:ring-1 focus-visible:ring-accent-primary/40"
        >
          {cellBody}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="z-50 border-0 bg-transparent p-0 shadow-none" side="top" align="start">
        <FundingSharedPopover
          fundedCount={fundedCount}
          totalSol={totalSol}
          seed={walletSource ?? venue ?? undefined}
        />
      </HoverCardContent>
    </HoverCard>
  );
}
