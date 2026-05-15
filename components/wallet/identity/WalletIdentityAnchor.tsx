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
import { mockWalletWideStats } from '@/lib/walletIdentity/mockWalletWideStats';
import { cn } from '@/lib/utils/cn';

const COMPACT_MS = 380;
const LEAVE_MS = 160;

export function WalletIdentityAnchor({
  address,
  mint,
  tokenSymbol,
  topTraderRow,
  rank,
  creatorWallet,
  href,
  preferIntelModal = false,
  truncate = 5,
  className,
  inlineBadges = [],
  isDev,
  isSniper,
  showInlineBadges,
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
  truncate?: number;
  className?: string;
  inlineBadges?: WalletIntelBadgeKind[];
  isDev?: boolean;
  isSniper?: boolean;
  showInlineBadges?: boolean;
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
      : labelDisp?.text ?? address;

  const positionPanel = useCallback((wPanel: number) => {
    const el = anchorRef.current;
    if (!el) return { x: 12, y: 80 };
    const r = el.getBoundingClientRect();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    let x = r.left;
    let y = r.bottom + 6;
    if (x + wPanel > vw - 10) x = Math.max(8, vw - wPanel - 10);
    if (y > vh - 120) y = Math.max(60, r.top - 340);
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
      setXyCompact(positionPanel(312));
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
    setXyDossier(positionPanel(360));
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
    'font-mono text-sm tabular-nums tracking-tight',
    labelDisp?.labeled === true ? labelColorClass(labelDisp.color) : 'text-accent-primary',
  );

  function linkModifierNav(e: React.MouseEvent): boolean {
    return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
  }

  const triggerInner =
    href != null ? (
      <Link
        href={href}
        className={cn('min-w-0 truncate underline-offset-2 hover:underline focus:outline-none', textClsBase, className)}
        prefetch={false}
        onClick={(e) => {
          if (linkModifierNav(e)) return;
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
          'min-w-0 truncate text-left underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-info/35',
          textClsBase,
          className,
        )}
        onClick={openClickSurface}
      >
        {displayText}
      </button>
    );

  const showBadgeRow = showInlineBadges !== false && identity.badges.length > 0;

  return (
    <>
      <span
        ref={anchorRef}
        className="inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5"
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
        {triggerInner}
        {showBadgeRow ? (
          <WalletIdentityBadges kinds={identity.badges} max={3} className="font-sans" />
        ) : null}
      </span>

      {compact && xyCompact && !dossier
        ? createPortal(
            <div
              className="fixed z-[420]"
              style={{ left: xyCompact.x, top: xyCompact.y }}
              onMouseEnter={() => {
                clearT();
                setCompact(true);
              }}
              onMouseLeave={hideCompactSoon}
            >
              <WalletCompactTooltipPanel stats={stats} wide={wideDemo} tokenCtx={tokenSurface} />
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
