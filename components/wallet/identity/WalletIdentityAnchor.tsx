'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWalletIntelStore } from '@/store/walletIntelStore';
import { useWalletLabels, labelColorClass } from '@/lib/hooks/useWalletLabels';
import { useTrackedWalletsLookup } from '@/lib/hooks/useTrackedWalletsLookup';
import { useTraderMintHoverStats } from '@/lib/hooks/useTraderMintHoverStats';
import { resolveWalletIdentityCore } from '@/lib/walletIdentity/resolveWalletIdentity';
import {
  buildWalletTokenContextFromTraderRow,
  tokenContextFromHoverStats,
} from '@/lib/walletIdentity/types';
import type { MintTopTraderRow } from '@/lib/trading/mintTopTraders';
import type { WalletIntelBadgeKind } from '@/lib/walletIdentity/types';
import { appChainForWalletAddress } from '@/lib/chains/walletIntelChain';

import { WalletIdentityBadges } from '@/components/wallet/identity/WalletIdentityBadges';
import { WalletCompactTooltipPanel } from '@/components/wallet/identity/WalletCompactTooltipPanel';
import { WalletIdentityDossier } from '@/components/wallet/identity/WalletIdentityDossier';
import { WalletMintTradesFilterButton } from '@/components/tokens/cells/WalletMintTradesFilterButton';
import { mockWalletWideStats } from '@/lib/walletIdentity/mockWalletWideStats';
import { cn } from '@/lib/utils/cn';

const COMPACT_MS = 150;
const COMPACT_PANEL_W = 300;
const COMPACT_PANEL_H = 210;
const LEAVE_MS = 280;

export function WalletIdentityAnchor({
  address,
  mint,
  tokenSymbol,
  topTraderRow,
  rank,
  creatorWallet,
  href,
  preferIntelModal = false,
  navigateOnClick = false,
  truncate = 5,
  className,
  inlineBadges = [],
  isDev,
  isSniper,
  showInlineBadges,
  badgeBeforeAddress = false,
  suppressFilterButton = false,
  addressFormat = 'default',
  onFilterMintTrades,
  tradesFilterActive,
  addressNoTruncate = false,
  maxBadges = 3,
}: {
  address: string;
  mint?: string;
  tokenSymbol?: string | null;
  topTraderRow?: MintTopTraderRow | null;
  rank?: number | null;
  creatorWallet?: string | null;
  href?: string;
  /** Plain click opens centered desk intel (+ share) instead of the dossier popover. */
  preferIntelModal?: boolean;
  /** Plain click follows `href` (Trades desk — hover popup still works). */
  navigateOnClick?: boolean;
  truncate?: number;
  className?: string;
  inlineBadges?: WalletIntelBadgeKind[];
  isDev?: boolean;
  isSniper?: boolean;
  showInlineBadges?: boolean;
  /** Render classification icons before the address (Axiom Trades column). */
  badgeBeforeAddress?: boolean;
  /** Hide built-in filter button when rendered externally at row end. */
  suppressFilterButton?: boolean;
  /** `axiom` → `H13. MYa` (3 + dot + space + 3). */
  addressFormat?: 'default' | 'axiom';
  /** Jump to Trades tab filtered to this wallet on the current mint. */
  onFilterMintTrades?: (address: string) => void;
  tradesFilterActive?: boolean;
  /** Desk trades row — never collapse the address to zero width. */
  addressNoTruncate?: boolean;
  /** Cap badge icons before/after the address. */
  maxBadges?: number;
}) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const dossierWrapRef = useRef<HTMLDivElement | null>(null);
  const [compact, setCompact] = useState(false);
  const [dossier, setDossier] = useState(false);
  const [xyCompact, setXyCompact] = useState<{ x: number; y: number } | null>(null);
  const [xyDossier, setXyDossier] = useState<{ x: number; y: number } | null>(null);

  const tCompact = useRef<number | null>(null);
  const tLeave = useRef<number | null>(null);

  const { resolveLabel, openLabelModal } = useWalletLabels();
  const { isTracked } = useTrackedWalletsLookup();
  const openIntel = useWalletIntelStore((s) => s.openWallet);

  const labelDisp = resolveLabel(address, truncate);
  const tracked = isTracked(address);

  const extras = useMemo(() => {
    const e = [...inlineBadges];
    if (isDev) e.push('dev');
    if (isSniper) e.push('sniper');
    if (topTraderRow?.realized_pnl_usd && topTraderRow.realized_pnl_usd >= 10_000) e.push('top_trader');
    if ((topTraderRow?.win_rate ?? 0) > 0.62) e.push('high_win_rate');
    return e as WalletIntelBadgeKind[];
  }, [inlineBadges, isDev, isSniper, topTraderRow]);

  const identity = useMemo(
    () =>
      resolveWalletIdentityCore({
        address,
        chain: appChainForWalletAddress(address),
        labelDisplay: labelDisp ?? null,
        isTracked: tracked,
        extras,
        creatorWallet: creatorWallet ?? null,
      }),
    [address, labelDisp, tracked, extras, creatorWallet],
  );

  const wideDemo = useMemo(() => mockWalletWideStats(address), [address]);

  const tokenCtxFromRow =
    mint != null &&
    tokenSymbol != null &&
    topTraderRow != null &&
    rank != null &&
    rank > 0
      ? buildWalletTokenContextFromTraderRow({
          mint,
          symbol: tokenSymbol ?? 'TOKEN',
          rank,
          row: topTraderRow,
        })
      : null;

  const mintStatsNeeded = dossier || compact;
  const { stats } = useTraderMintHoverStats(mint, address, Boolean(mint && mintStatsNeeded));

  const hoverTokenCtx =
    mint != null && tokenSymbol != null && stats
      ? tokenContextFromHoverStats(mint, tokenSymbol ?? 'TOKEN', stats)
      : null;

  const tokenSurface = tokenCtxFromRow ?? hoverTokenCtx ?? null;

  const displayText =
    labelDisp?.labeled === true
      ? labelDisp.label + (labelDisp.emoji ? ` ${labelDisp.emoji}` : '')
      : addressFormat === 'axiom' && address.length >= 6
        ? `${address.slice(0, 3)}. ${address.slice(-3)}`
        : labelDisp?.text ?? address;

  const positionPanel = useCallback((wPanel: number, hPanel: number) => {
    const el = anchorRef.current;
    if (!el) return { x: 12, y: 80 };
    const r = el.getBoundingClientRect();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const gap = 8;
    let x = r.left;
    let y = r.bottom + gap;
    if (x + wPanel > vw - 10) x = Math.max(8, vw - wPanel - 10);
    if (y + hPanel > vh - 10) {
      y = r.top - hPanel - gap;
    }
    if (y < 10) y = Math.max(10, r.bottom + gap);
    return { x, y };
  }, []);

  const clearT = () => {
    if (tCompact.current) window.clearTimeout(tCompact.current);
    if (tLeave.current) window.clearTimeout(tLeave.current);
    tCompact.current = null;
    tLeave.current = null;
  };

  const scheduleCompact = () => {
    clearT();
    tCompact.current = window.setTimeout(() => {
      setCompact(true);
      setXyCompact(positionPanel(COMPACT_PANEL_W, COMPACT_PANEL_H));
      tCompact.current = null;
    }, COMPACT_MS);
  };

  const hideCompactSoon = () => {
    clearT();
    tLeave.current = window.setTimeout(() => {
      setCompact(false);
      setXyCompact(null);
      tLeave.current = null;
    }, LEAVE_MS);
  };

  const openDossier = () => {
    clearT();
    setCompact(false);
    setXyCompact(null);
    setDossier(true);
    setXyDossier(positionPanel(360, 420));
  };

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setDossier(false);
      setXyDossier(null);
    }
    if (dossier) window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [dossier]);

  useEffect(() => {
    if (!dossier) return;
    function md(e: MouseEvent) {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (dossierWrapRef.current?.contains(t)) return;
      setDossier(false);
      setXyDossier(null);
    }
    window.addEventListener('mousedown', md);
    return () => window.removeEventListener('mousedown', md);
  }, [dossier]);

  const onIntel = () => {
    openIntel({ address, chain: appChainForWalletAddress(address), rowDemo: true });
    setDossier(false);
    setXyDossier(null);
  };

  const openClickSurface = () => {
    clearT();
    setCompact(false);
    setXyCompact(null);
    if (preferIntelModal) {
      onIntel();
    } else {
      openDossier();
    }
  };

  const textClsBase = cn(
    'font-sans text-[12px] font-normal tabular-nums tracking-normal',
    labelDisp?.labeled === true ? labelColorClass(labelDisp.color) : 'text-fg-secondary',
  );

  function linkModifierNav(e: React.MouseEvent): boolean {
    return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
  }

  const triggerInner =
    href != null ? (
      <Link
        href={href}
        className={cn(
          'underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/35',
          addressNoTruncate ? 'shrink-0 whitespace-nowrap' : 'min-w-0 truncate',
          textClsBase,
          className,
        )}
        prefetch={false}
        onMouseEnter={scheduleCompact}
        onMouseLeave={hideCompactSoon}
        onClick={(e) => {
          if (linkModifierNav(e)) return;
          if (navigateOnClick) return;
          e.preventDefault();
          openClickSurface();
        }}
      >
        {displayText}
      </Link>
    ) : (
      <button
        type="button"
        className={cn(
          'text-left underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/35',
          addressNoTruncate ? 'shrink-0 whitespace-nowrap' : 'min-w-0 truncate',
          textClsBase,
          className,
        )}
        onMouseEnter={scheduleCompact}
        onMouseLeave={hideCompactSoon}
        onClick={openClickSurface}
      >
        {displayText}
      </button>
    );

  const showBadgeRow = showInlineBadges !== false && identity.badges.length > 0;

  const badgeRow =
    showBadgeRow ? (
      <WalletIdentityBadges
        kinds={identity.badges}
        max={maxBadges}
        variant="icon"
        className="font-sans"
      />
    ) : null;

  return (
    <>
      <span
        ref={anchorRef}
        className={cn(
          'inline-flex items-center gap-x-1 gap-y-0.5',
          addressNoTruncate ? 'shrink-0' : 'max-w-full min-w-0 flex-wrap',
        )}
        onMouseEnter={() => {
          scheduleCompact();
        }}
        onMouseLeave={() => {
          hideCompactSoon();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openLabelModal(address);
        }}
      >
        {badgeBeforeAddress ? badgeRow : null}
        {mint && onFilterMintTrades && !suppressFilterButton ? (
          <WalletMintTradesFilterButton
            active={tradesFilterActive}
            onClick={() => onFilterMintTrades(address)}
          />
        ) : null}
        {triggerInner}
        {!badgeBeforeAddress ? badgeRow : null}
      </span>

      {compact && xyCompact && !dossier
        ? createPortal(
            <div
              className="fixed z-[500]"
              style={{ left: xyCompact.x, top: xyCompact.y }}
              onMouseEnter={() => {
                clearT();
                setCompact(true);
              }}
              onMouseLeave={hideCompactSoon}
            >
              <WalletCompactTooltipPanel
                address={address}
                stats={stats}
                tokenCtx={tokenSurface}
                onOpenChart={onIntel}
                onOpenSettings={openDossier}
                onFilter={
                  onFilterMintTrades ? () => onFilterMintTrades(address) : undefined
                }
              />
            </div>,
            document.body,
          )
        : null}

      {dossier && xyDossier
        ? createPortal(
            <div
              ref={dossierWrapRef}
              role="dialog"
              aria-modal="false"
              className="fixed z-[460]"
              style={{ left: xyDossier.x, top: xyDossier.y }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <WalletIdentityDossier
                identity={identity}
                tokenCtx={tokenSurface}
                mintStats={stats}
                wide={wideDemo}
                onTrack={onIntel}
                onLabel={() => openLabelModal(address)}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
