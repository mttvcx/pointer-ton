'use client';

import { useMemo } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useQuery } from '@tanstack/react-query';
import {
  type BugReportCategoryId,
  type BugReportContext,
  type BugSeverityId,
  POINTER_REPORT_VERSION,
  type BugReportPayload,
} from '@/lib/reports/bugReportModel';
import { fingerprintId, maskMiddle } from '@/lib/reports/sanitizeBugReport';
import { snapshotRecentClientErrors } from '@/lib/reports/clientErrorRing';
import { useUIStore } from '@/store/ui';
import type { EntityRef } from '@/store/ui';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import type { AppChainId } from '@/lib/chains/appChain';

/** Public build ID shown in payloads (override via NEXT_PUBLIC_POINTER_VERSION). */
export const POINTER_APP_VERSION_LABEL =
  typeof process.env.NEXT_PUBLIC_POINTER_VERSION === 'string' &&
  process.env.NEXT_PUBLIC_POINTER_VERSION.trim().length > 0
    ? process.env.NEXT_PUBLIC_POINTER_VERSION.trim()
    : '0.1.0';

export function deriveRouteHints(pathname: string | null): {
  tokenMint: string | null;
  walletFocusMasked: string | null;
} {
  const p = pathname ?? '';
  let tokenMint: string | null = null;
  let walletFocusMasked: string | null = null;

  const tokenMatch = /^\/token\/([^/?#]+)/.exec(p);
  if (tokenMatch?.[1]) tokenMint = decodeURIComponent(tokenMatch[1]);

  const walletMatch = /^\/wallet\/([^/?#]+)/.exec(p);
  if (walletMatch?.[1]) {
    walletFocusMasked = maskMiddle(decodeURIComponent(walletMatch[1]), 4, 4);
  }

  return { tokenMint, walletFocusMasked };
}

function lockEntityBrief(ref: EntityRef | null): BugReportContext['hoverLock'] {
  if (!ref) return null;
  if (ref.type === 'token') {
    return {
      type: 'token',
      idFingerprint: fingerprintId(ref.id, 'tok'),
      labelSnippet:
        typeof ref.label === 'string'
          ? ref.label.slice(0, 72)
          : ref.id.slice(0, 8) + '…',
    };
  }
  return {
    type: 'wallet',
    idFingerprint: fingerprintId(ref.id, 'wal'),
    labelSnippet:
      typeof ref.label === 'string' ? ref.label.slice(0, 72) : maskMiddle(ref.id, 4, 4),
  };
}

/** Collect immutable context at submit-time (outside React render). */
export function collectBugReportContext(params: {
  pathname: string;
  activeChain: AppChainId;
  authenticated: boolean;
  hoveredEntity: EntityRef | null;
  lockedEntity: EntityRef | null;
  pulseFlashMint: string | null;
  activeWalletMasked: string | null;
  activeWalletLabel: string | null;
  connectionStatus?: string | null;
  region?: string | null;
  includeScreenshotRequested: boolean;
  screenshotDataUrl?: string | null;
  recentErrorsOverride?: BugReportContext['recentClientErrors'];
}): BugReportContext {
  const { tokenMint, walletFocusMasked } = deriveRouteHints(params.pathname);

  const tokenHints: string[] = [];
  if (tokenMint) tokenHints.push(tokenMint);
  if (params.pulseFlashMint?.trim()) tokenHints.push(params.pulseFlashMint.trim());

  let hoverLock: BugReportContext['hoverLock'] = null;
  const cand = params.lockedEntity ?? params.hoveredEntity;
  if (cand) hoverLock = lockEntityBrief(cand);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';

  return {
    route: params.pathname || '/',
    submittedAtIso: new Date().toISOString(),
    activeChain: params.activeChain,
    tokenMintHints: [...new Set(tokenHints)].slice(0, 8),
    pulseHighlightMint: params.pulseFlashMint,
    hoverLock,
    viewport: { w: vw, h: vh, dpr },
    userAgent: ua,
    appVersion: POINTER_APP_VERSION_LABEL,
    connectionStatus: params.connectionStatus ?? undefined,
    region: params.region ?? undefined,
    sessionAuthenticated: params.authenticated,
    activeWalletMasked: params.activeWalletMasked,
    activeWalletLabel: params.activeWalletLabel ?? undefined,
    walletPageMasked: walletFocusMasked,
    includeScreenshotRequested: params.includeScreenshotRequested,
    screenshotDataUrl: params.screenshotDataUrl ?? undefined,
    recentClientErrors:
      params.recentErrorsOverride ?? (typeof window !== 'undefined' ? snapshotRecentClientErrors() : undefined),
  };
}

export type ReportFormState = {
  category: BugReportCategoryId;
  severity: BugSeverityId;
  description: string;
  includeScreenshotRequested: boolean;
  screenshotDataUrl?: string | null;
};

export function useBugReportWarmData(): {
  myWalletsPending: boolean;
  activeMasked: string | null;
  activeLabel: string | null;
} {
  const { authenticated, getAccessToken } = usePointerAuth();

  /** Must match other `useQuery({ queryKey: ['wallets-my'] })` callers — identical shape/type for shared cache. */
  const myWalletsQ = useQuery({
    queryKey: ['wallets-my'],
    queryFn: async (): Promise<{ wallets: MyWalletRow[] }> => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/wallets/my', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('wallets');
      return res.json() as Promise<{ wallets: MyWalletRow[] }>;
    },
    enabled: authenticated,
    staleTime: 30_000,
  });

  const { activeAddress } = useActiveSolanaWallet(myWalletsQ.data?.wallets);

  const row = useMemo(
    () =>
      authenticated && activeAddress && Array.isArray(myWalletsQ.data?.wallets)
        ? myWalletsQ.data.wallets.find((w) => w.wallet_address === activeAddress)
        : undefined,
    [authenticated, activeAddress, myWalletsQ.data?.wallets],
  );

  const activeMasked =
    authenticated && typeof activeAddress === 'string' && activeAddress.length > 0
      ? maskMiddle(activeAddress, 4, 4)
      : null;
  const activeLabel =
    authenticated && typeof row?.label === 'string' && row.label.trim().length > 0
      ? row.label.trim().slice(0, 64)
      : null;

  return {
    myWalletsPending: Boolean(authenticated && myWalletsQ.isLoading),
    activeMasked,
    activeLabel,
  };
}

export function buildBugReportPayload(
  form: ReportFormState,
  runtime: Omit<Parameters<typeof collectBugReportContext>[0], 'includeScreenshotRequested'>,
): BugReportPayload {
  return {
    reportVersion: POINTER_REPORT_VERSION,
    category: form.category,
    severity: form.severity,
    description: form.description.trim(),
    context: collectBugReportContext({
      ...runtime,
      includeScreenshotRequested: form.includeScreenshotRequested,
      screenshotDataUrl: form.screenshotDataUrl,
    }),
  };
}
