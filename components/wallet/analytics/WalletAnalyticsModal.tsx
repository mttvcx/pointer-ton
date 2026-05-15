'use client';

import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Globe, Loader2 } from 'lucide-react';
import { WalletAnalyticsHeader } from '@/components/wallet/analytics/WalletAnalyticsHeader';
import { WalletBalancePanel } from '@/components/wallet/analytics/WalletBalancePanel';
import { WalletIntelActivityDemo } from '@/components/wallet/analytics/WalletIntelDemoPanels';
import { WalletPerformancePanel } from '@/components/wallet/analytics/WalletPerformancePanel';
import { WalletPnlChart } from '@/components/wallet/analytics/WalletPnlChart';
import { WalletPositionsTable } from '@/components/wallet/analytics/WalletPositionsTable';
import { buildDemoWalletAnalyticsPayload } from '@/lib/dev/demoWalletAnalyticsPayload';
import {
  demoWalletActivityRows,
  demoWalletPositions,
} from '@/lib/dev/demoWalletIntelRows';
import type { WalletAnalyticsPayload } from '@/lib/wallet-analytics/types';
import type { WalletAnalyticsTimeframe } from '@/lib/wallet-analytics/types';
import type { WalletPositionRow } from '@/lib/wallet-analytics/types';
import type { PnlSharePayload } from '@/lib/share/types';
import { cn } from '@/lib/utils/cn';
import { useWalletIntelStore } from '@/store/walletIntelStore';
import { useWalletLabelsStore } from '@/store/walletLabels';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';

type AnalyticsResponse = {
  timeframe: WalletAnalyticsTimeframe;
  data: WalletAnalyticsPayload;
};

type DeskTabId = 'most_profitable' | 'active_positions' | 'trades_history' | 'dev_tokens';

const DESK_TABS: { id: DeskTabId; label: string }[] = [
  { id: 'most_profitable', label: 'Most Profitable' },
  { id: 'active_positions', label: 'Active Positions' },
  { id: 'trades_history', label: 'Trades History' },
  { id: 'dev_tokens', label: 'Dev Tokens' },
];

/** Above CompactInstantTradePanel `z-[240]` and token tooltips; below alert-rule popout ~630. */
const WALLET_INTEL_Z = 'z-[560]';

export function WalletAnalyticsModal() {
  const open = useWalletIntelStore((s) => s.walletOpen);
  const wallet = useWalletIntelStore((s) => s.wallet);
  const closeWallet = useWalletIntelStore((s) => s.closeWallet);
  const openShare = useWalletIntelStore((s) => s.openShare);

  const [walletSnapshot, setWalletSnapshot] = useState(wallet);
  /* eslint-disable react-hooks/set-state-in-effect -- retain wallet for overlay exit animation */
  useEffect(() => {
    if (wallet) setWalletSnapshot(wallet);
  }, [wallet]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const displayWallet = wallet ?? walletSnapshot;
  const { mounted: overlayMounted, visible: overlayVisible } = useOverlayPresence(
    open && Boolean(displayWallet),
  );

  const byLabel = useWalletLabelsStore((s) => s.byAddress);

  const [tf, setTf] = useState<WalletAnalyticsTimeframe>('30d');
  const [deskTab, setDeskTab] = useState<DeskTabId>('most_profitable');
  const [posSearch, setPosSearch] = useState('');
  const [labelDraftState, setLabelDraftState] = useState<{ address: string; value: string }>({
    address: '',
    value: '',
  });

  const walletAddress = displayWallet?.address;
  const walletChain = displayWallet?.chain;
  const walletRowDemo = displayWallet?.rowDemo ?? false;
  const labelDraft =
    walletAddress && labelDraftState.address === walletAddress
      ? labelDraftState.value
      : walletAddress
        ? byLabel[walletAddress]?.label ?? ''
        : '';

  const q = useQuery({
    queryKey: ['wallet-analytics', walletAddress, tf, walletRowDemo],
    enabled: Boolean(open && walletAddress),
    queryFn: async (): Promise<AnalyticsResponse> => {
      const res = await fetch(
        `/api/wallet/${encodeURIComponent(walletAddress!)}/analytics?tf=${encodeURIComponent(tf)}`,
      );
      if (!res.ok) throw new Error('wallet_analytics_failed');
      return res.json() as Promise<AnalyticsResponse>;
    },
    retry: 1,
  });

  const apiPayload = q.data?.data;

  const mergedFromApi = useMemo((): WalletAnalyticsPayload | undefined => {
    if (!apiPayload || !walletAddress || !walletChain) return undefined;
    if (!walletRowDemo) return apiPayload;
    const demos = demoWalletPositions(walletAddress, walletChain);
    return {
      ...apiPayload,
      positions: demos.length > 0 ? demos : apiPayload.positions,
    };
  }, [apiPayload, walletAddress, walletChain, walletRowDemo]);

  const fallbackDemo = useMemo(
    () =>
      walletAddress && walletChain
        ? buildDemoWalletAnalyticsPayload(walletAddress, walletChain, tf)
        : undefined,
    [walletAddress, walletChain, tf],
  );

  /** API failed or unreachable — show full client-side demo so layout + Share PnL still work. */
  const isOfflineDemo = Boolean(!q.isLoading && q.isError);

  const effectiveData = useMemo((): WalletAnalyticsPayload | undefined => {
    if (!walletAddress) return undefined;
    if (q.isLoading) return undefined;
    if (mergedFromApi) return mergedFromApi;
    return fallbackDemo;
  }, [walletAddress, q.isLoading, mergedFromApi, fallbackDemo]);

  const displayPositions = useMemo(() => {
    if (!effectiveData) return [];
    let r = effectiveData.positions;
    const sq = posSearch.trim().toLowerCase();
    if (sq) {
      r = r.filter(
        (p) =>
          p.symbol.toLowerCase().includes(sq) ||
          p.mint.toLowerCase().includes(sq) ||
          (p.name?.toLowerCase().includes(sq) ?? false),
      );
    }
    if (deskTab === 'most_profitable') {
      return [...r].sort((a, b) => (b.pnlUsd ?? -Infinity) - (a.pnlUsd ?? -Infinity));
    }
    return r;
  }, [effectiveData, posSearch, deskTab]);

  const showExtraDemos = Boolean(walletRowDemo || isOfflineDemo);

  const demoActivity = useMemo(
    () => (walletAddress && showExtraDemos ? demoWalletActivityRows(walletAddress) : []),
    [walletAddress, showExtraDemos],
  );

  const shareFromRow = (row: WalletPositionRow) => {
    if (!displayWallet || !effectiveData) return;
    const trimmed = labelDraft.trim();
    const payload: PnlSharePayload = {
      walletAddress: displayWallet.address,
      walletLabel: trimmed || null,
      tokenMint: row.mint,
      tokenTicker: row.symbol,
      tokenName: row.name,
      tokenIconUrl: row.imageUrl,
      chain: displayWallet.chain,
      timeframe: tf,
      pnlUsd: row.pnlUsd,
      pnlPct: row.pnlPct,
      investedUsd: row.boughtUsd,
      positionUsd: row.remainingUsd,
      realizedUsd: null,
      unrealizedUsd: null,
    };
    openShare(payload);
  };

  if (!overlayMounted || !displayWallet) return null;

  return (
    <div className={cn('fixed inset-0 flex items-center justify-center p-3 sm:p-6', WALLET_INTEL_Z)} role="presentation">
      <button
        type="button"
        className={cn(
          'absolute inset-0 z-40 bg-bg-base/75 backdrop-blur-sm',
          overlayBackdropClasses(overlayVisible),
          'fill-mode-forwards',
        )}
        aria-label="Close wallet analytics"
        onClick={() => closeWallet()}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-50 flex h-[min(92vh,880px)] max-h-[min(92vh,880px)] w-full max-w-[1220px] flex-col overflow-hidden rounded-xl border border-border-subtle fill-mode-forwards',
          'bg-bg-raised shadow-panel',
          overlayPanelClasses(overlayVisible),
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <WalletAnalyticsHeader
            address={displayWallet.address}
            chain={displayWallet.chain}
            labelDraft={labelDraft}
            onLabelChange={(value) =>
              setLabelDraftState({ address: displayWallet.address, value })
            }
            timeframe={tf}
            onTimeframe={(next) => setTf(next)}
            onClose={() => closeWallet()}
            onRefresh={() => void q.refetch()}
          />

          {q.isLoading ? (
            <div className="flex min-h-[560px] items-center justify-center py-24 text-fg-muted">
              <Loader2 className="h-6 w-6 animate-spin" strokeWidth={2} />
            </div>
          ) : !effectiveData ? (
            <div className="flex min-h-[560px] flex-col items-center justify-center px-6 py-16">
              <p className="text-center text-[13px] text-signal-bear">
                Could not load wallet intelligence. Try again shortly.
              </p>
            </div>
          ) : (
            <>
              {isOfflineDemo ? (
                <div className="mx-3 mt-2 flex h-7 items-center gap-2 rounded-md border border-amber-300/[0.13] bg-amber-300/[0.035] px-2.5 text-[10px] font-medium text-amber-100/70 sm:mx-4">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300/65" aria-hidden />
                  <span>
                    <span className="font-semibold text-amber-100/80">Demo mode</span> · synthetic wallet data shown
                  </span>
                </div>
              ) : null}
              {!isOfflineDemo && walletRowDemo ? (
                <div className="mx-3 mt-2 flex h-7 items-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.025] px-2.5 text-[10px] font-medium text-fg-muted sm:mx-4">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-primary/60" aria-hidden />
                  Preview rows · Share PnL is enabled on positions
                </div>
              ) : null}
              <div className="mx-3 mt-2 grid overflow-hidden rounded-lg border border-border-subtle bg-bg-sunken/40 lg:grid-cols-[0.86fr_1.2fr_0.98fr] lg:divide-x lg:divide-border-subtle sm:mx-4">
                <WalletBalancePanel data={effectiveData} currency="USD" />
                <div className="flex min-h-[206px] flex-col border-t border-border-subtle p-3 lg:border-t-0">
                  <h3 className="mb-3 text-xs font-semibold text-fg-primary">REALIZED PNL</h3>
                  <WalletPnlChart points={effectiveData.chart} className="mt-1.5 min-h-[174px] flex-1" />
                </div>
                <WalletPerformancePanel data={effectiveData} timeframe={tf} />
              </div>

              <div className="mx-3 mt-3 flex flex-wrap items-end justify-between gap-3 border-b border-border-subtle pb-0 sm:mx-4">
                <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-2">
                  {DESK_TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDeskTab(t.id)}
                      className={cn(
                        'relative shrink-0 whitespace-nowrap px-2 pb-1 text-xs transition',
                        deskTab === t.id
                          ? 'font-semibold text-fg-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-accent-primary'
                          : 'text-fg-muted hover:text-fg-secondary',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {(deskTab === 'most_profitable' || deskTab === 'active_positions') ? (
                    <input
                      type="search"
                      value={posSearch}
                      onChange={(e) => setPosSearch(e.target.value)}
                      placeholder="Search by name or address"
                      className="h-7 w-[min(100%,220px)] rounded border border-border-subtle bg-bg-sunken px-2.5 text-xs text-fg-primary placeholder:text-fg-muted focus:border-accent-primary/50 focus:outline-none"
                    />
                  ) : null}
                  <span className="inline-flex h-5 items-center rounded border border-border-subtle bg-bg-sunken px-2 text-[10px] text-fg-muted transition-colors hover:text-fg-primary">
                    <Globe className="mr-1 h-3 w-3 opacity-80" strokeWidth={2} aria-hidden />
                    USD
                  </span>
                </div>
              </div>

              <div className="mx-3 min-h-[380px] sm:mx-4">
                {deskTab === 'most_profitable' || deskTab === 'active_positions' ? (
                  <WalletPositionsTable rows={displayPositions} timeframe={tf} onShareRow={shareFromRow} />
                ) : deskTab === 'trades_history' ? (
                  showExtraDemos ? (
                    <WalletIntelActivityDemo rows={demoActivity} />
                  ) : (
                    <div className="flex min-h-[320px] items-center justify-center rounded-b-lg border border-t-0 border-white/[0.07] bg-[#070a0f]/45 px-4 py-9 text-center text-[12px] text-fg-muted">
                      Trade history is indexed as activity streams online — demo mode shows sample rows.
                    </div>
                  )
                ) : (
                  <div className="flex min-h-[280px] flex-col items-center justify-center rounded-b-lg border border-t-0 border-white/[0.07] bg-[#070a0f]/45 px-4 py-12 text-center">
                    <p className="text-[12px] font-medium text-fg-secondary">Dev tokens</p>
                    <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-fg-muted">
                      Cross-launch tokens from this deployer will appear here when the index is wired.
                    </p>
                  </div>
                )}
              </div>

              {effectiveData.statsComputedAt ? (
                <p className="mx-3 mb-3 mt-2 text-[10px] text-fg-muted sm:mx-4">
                  Indexed stats refreshed from telemetry when available — chart illustrates the selected
                  window.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
