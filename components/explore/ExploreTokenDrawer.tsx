'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BellPlus,
  Copy,
  ExternalLink,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { openAlertRulesPopoutDetached } from '@/components/alerts/AlertRulesSection';
import { explorerUrlForAccount } from '@/lib/chains/explorerUrls';
import { openCopilotQuickAsk } from '@/lib/copilot/quickAsk';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { usePulseQuickBuy } from '@/lib/hooks/usePulseQuickBuy';
import { BUY_PRESETS_SOL } from '@/lib/utils/constants';
import type { SocialCatalystType, TokenExploreItem } from '@/types/explore';
import { formatCompactUsd } from '@/lib/utils/formatters';
import { shortenAddress } from '@/lib/utils/addresses';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { cn } from '@/lib/utils/cn';
import { usePulseColumnStore } from '@/store/pulseColumns';
import { useUIStore } from '@/store/ui';

const COPILOT_PROMPTS = [
  'Why is this token trending?',
  'Is this mostly social or wallet-driven?',
  'What are the risks?',
  'Which wallets are buying?',
  'What are people saying?',
  'Is this a late move?',
] as const;

function aiOverviewQuestion(ticker: string): string {
  return (
    `Give an AI overview of ${ticker}. Use this structure: ` +
    `What it is · Why it's moving now · Narrative · Wallet signal · Social signal · Risks · What changed recently. ` +
    `Use cautious language and only fields Pointer already tracks.`
  );
}

export function ExploreTokenDrawer({
  item,
  open,
  onClose,
}: {
  item: TokenExploreItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const { authenticated } = usePointerAuth();
  const activeChain = useUIStore((s) => s.activeChain);
  const { buyToken, busyMint } = usePulseQuickBuy();
  const quickSol = usePulseColumnStore((s) => s.byColumn.new.quickBuySol);
  const buyAmt =
    typeof quickSol === 'number' && Number.isFinite(quickSol) && quickSol > 0
      ? quickSol
      : BUY_PRESETS_SOL[1]!;

  const { mounted, visible } = useOverlayPresence(open && Boolean(item));

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /* Always call hooks. Build overview from latest item or null. */
  const overview = useMemo(() => buildOverview(item), [item]);

  if (!mounted || !item) return null;

  const demoFixture = Boolean(item.isDemoFixture);
  const explorer = explorerUrlForAccount(item.tokenAddress);

  return (
    <div className="fixed inset-0 z-[520] flex justify-end" role="presentation">
      <button
        type="button"
        className={cn(
          'absolute inset-0 bg-[rgba(3,5,10,0.58)] backdrop-blur-md',
          overlayBackdropClasses(visible),
          'fill-mode-forwards',
        )}
        aria-label="Close"
        onClick={onClose}
      />
      <aside
        className={cn(
          'relative flex h-full w-full max-w-md flex-col border-l border-white/[0.08]',
          'bg-[rgba(8,13,20,0.94)] shadow-[-24px_0_64px_-24px_rgba(0,0,0,0.75)] backdrop-blur-xl',
          overlayPanelClasses(visible),
          'fill-mode-forwards',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5">
          <div className="flex min-w-0 gap-3">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-bg-base ring-1 ring-white/10">
              {item.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.iconUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[12px] font-bold text-fg-muted">
                  {item.ticker.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-[16px] font-semibold text-fg-primary">{item.ticker}</h2>
                <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                  {item.chainTicker}
                </span>
                {item.ageLabel ? (
                  <span className="text-[10px] text-fg-muted">{item.ageLabel} old</span>
                ) : null}
              </div>
              <p className="truncate text-[12px] text-fg-secondary">{item.name}</p>
              <button
                type="button"
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-fg-muted hover:text-accent-primary"
                onClick={() => {
                  void navigator.clipboard.writeText(item.tokenAddress);
                  toast.success('Address copied');
                }}
              >
                <span className="font-mono">{shortenAddress(item.tokenAddress, 6)}</span>
                <Copy className="h-3 w-3 shrink-0" />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-fg-muted transition hover:bg-white/[0.05] hover:text-fg-primary"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap gap-2 border-b border-white/[0.05] px-4 py-2.5">
          <button
            type="button"
            disabled={!authenticated}
            title={!authenticated ? 'Sign in to use Co-pilot' : 'Open Co-pilot with this token loaded'}
            onClick={() =>
              openCopilotQuickAsk({
                entity: { type: 'token', id: item.tokenAddress, label: item.ticker },
                question: aiOverviewQuestion(item.ticker),
              })
            }
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg bg-accent-primary px-3 py-1.5 text-[12px] font-semibold text-fg-inverse',
              'shadow-[0_0_0_1px_rgba(56,189,248,0.25)] hover:bg-accent-glow disabled:opacity-35',
            )}
          >
            <Sparkles className="h-3.5 w-3.5" /> AI Overview
          </button>
          <button
            type="button"
            disabled={busyMint !== null || !authenticated}
            title={!authenticated ? 'Sign in to trade' : undefined}
            onClick={() => void buyToken(item.tokenAddress, buyAmt)}
            className="rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-[12px] font-semibold text-fg-primary hover:bg-white/[0.06] disabled:opacity-35"
          >
            {busyMint === item.tokenAddress ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buying…
              </span>
            ) : (
              `Buy (${buyAmt} SOL)`
            )}
          </button>
          <button
            type="button"
            disabled
            title="Tracked-wallet lists ship next — use Pulse watches for now"
            className="rounded-lg border border-white/12 px-3 py-1.5 text-[12px] font-semibold text-fg-secondary opacity-40"
          >
            Track
          </button>
          <button
            type="button"
            disabled={!authenticated}
            title={!authenticated ? 'Sign in to manage alerts' : 'Open the Pulse alert builder'}
            onClick={() => {
              openAlertRulesPopoutDetached();
              toast.message('Pulse alert builder', {
                description:
                  'Create listing rules scoped to Pulse — mint-specific guards ship next.',
              });
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[12px] font-semibold',
              'text-fg-primary hover:bg-white/[0.04] disabled:opacity-35',
            )}
          >
            <BellPlus className="h-3.5 w-3.5" /> Add alert
          </button>
          <Link
            href={`/token/${encodeURIComponent(item.tokenAddress)}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[12px] font-semibold text-fg-primary hover:bg-white/[0.04]"
          >
            Full page <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <a
            href={explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[12px] font-semibold text-fg-primary hover:bg-white/[0.04]"
          >
            Explorer <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-3">
          {demoFixture ? (
            <div className="mb-3 rounded-lg border border-amber-500/22 bg-amber-500/[0.07] px-3 py-2 text-[10px] leading-snug text-amber-50/95">
              Demo fixture — wallet and KOL deltas are synthetic so you can review the surface. They are not live indexed
              signals.
            </div>
          ) : null}

          {/* AI Overview card — structured, first-class. */}
          <section className="rounded-2xl border border-accent-primary/25 bg-gradient-to-br from-accent-primary/[0.08] via-accent-primary/[0.025] to-transparent p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-tight text-fg-primary">
                <Sparkles className="h-3.5 w-3.5 text-accent-primary" /> AI Overview
              </h3>
              <span className="rounded-full border border-white/[0.1] bg-white/[0.03] px-2 py-px text-[9px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
                {demoFixture ? 'Synthesis · demo' : 'Synthesis · Pointer fields'}
              </span>
            </div>
            <dl className="mt-2.5 grid gap-1.5 text-[11px] leading-snug">
              <Insight k="What it is" v={overview.whatItIs} />
              <Insight k="Why it's moving" v={overview.whyMoving} />
              <Insight k="Wallet signal" v={overview.walletSignal} />
              <Insight k="Social signal" v={overview.socialSignal} />
              <Insight k="Narrative" v={overview.narrative} />
              <Insight k="Risks" v={overview.risks} tone={item.riskScore >= 60 ? 'risk' : 'normal'} />
              <Insight k="What changed" v={overview.whatChanged} />
            </dl>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-2.5">
              <button
                type="button"
                disabled={!authenticated}
                title={!authenticated ? 'Sign in to use Co-pilot' : 'Ask Co-pilot for a deep overview'}
                onClick={() =>
                  openCopilotQuickAsk({
                    entity: { type: 'token', id: item.tokenAddress, label: item.ticker },
                    question: aiOverviewQuestion(item.ticker),
                  })
                }
                className="rounded-lg bg-accent-primary/95 px-3 py-1.5 text-[11px] font-semibold text-fg-inverse hover:bg-accent-primary disabled:opacity-35"
              >
                Ask Co-pilot
              </button>
              <span className="text-[9.5px] text-fg-muted/85">
                Built from live Pointer fields · Co-pilot adds narrative and source-checks on request.
              </span>
            </div>
          </section>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.05] to-transparent px-3 py-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
                Mindshare
              </div>
              <div className="mt-1 text-[20px] font-semibold tabular-nums text-accent-primary">
                {item.mindshareScore.toFixed(1)}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.05] to-transparent px-3 py-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
                Wallet score
              </div>
              <div className="mt-1 text-[20px] font-semibold tabular-nums text-teal-200/95">
                {item.walletScore.toFixed(0)}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.05] to-transparent px-3 py-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
                Social score
              </div>
              <div className="mt-1 text-[20px] font-semibold tabular-nums text-violet-200/95">
                {item.socialScore.toFixed(0)}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.05] to-transparent px-3 py-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
                Risk
              </div>
              <div className="mt-1 text-[20px] font-semibold tabular-nums text-rose-200/90">
                {item.riskScore.toFixed(0)}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px]">
            <Metric k="Trend" v={item.trendDirection} cap />
            <Metric k="Mcap" v={formatCompactUsd(item.marketCap)} />
            <Metric k="Liquidity" v={formatCompactUsd(item.liquidity)} />
            <Metric k="Volume (Δ)" v={formatCompactUsd(item.volumeWindow ?? item.volume24h)} />
            <Metric k="Txns (Δ)" v={item.txnsWindow != null ? String(item.txnsWindow) : '—'} />
            <Metric
              k="Buy/Sell"
              v={item.buySellRatio != null ? item.buySellRatio.toFixed(2) : '—'}
            />
            <Metric k="Event score" v={`${Math.round(item.eventScore)}`} />
            <Metric k="Momentum" v={`${Math.round(item.momentumScore)}`} />
            <Metric k="Wallets Δ" v={item.trackedWalletBuys ?? '—'} span={2} />
            <Metric k="Fresh Δ" v={item.freshWalletBuys ?? '—'} span={2} />
            <Metric k="Smart Δ" v={item.smartWalletBuys ?? '—'} span={2} />
            <Metric k="KOL mentions" v={item.kolMentionCount ?? '—'} span={2} />
            <Metric
              k="Last snapshot"
              v={item.lastUpdatedAt ? new Date(item.lastUpdatedAt).toLocaleTimeString() : '—'}
              span={2}
            />
            <Metric k="Header chain" v={nativeTicker(activeChain)} span={2} cap />
          </div>

          <section className="mt-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              Why it&apos;s moving
            </h3>
            <div className="mt-2 rounded-xl border border-white/[0.07] bg-gradient-to-br from-white/[0.035] to-transparent p-3 text-[12px] leading-relaxed text-fg-secondary">
              {item.reasonSummary}{' '}
              <span className="block pt-2 text-[10px] text-fg-muted">
                Confidence:{' '}
                <span className="font-semibold capitalize text-fg-primary">
                  {item.confidenceLevel}
                </span>{' '}
                • Drivers:{' '}
                {item.topCatalysts.length
                  ? item.topCatalysts.join(' · ')
                  : 'On-chain activity only'}
                .
              </span>
              <span className="block pt-1 text-[10px] text-fg-muted">
                Bearish lens: liquidity depth, concentration, deployer cues — surfaced in the risk
                panel on the token route.
              </span>
            </div>
          </section>

          <section className="mt-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                What people are saying
              </h3>
              <span className="text-[9px] text-fg-muted">Source-backed snippets</span>
            </div>
            {item.topSources.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-white/10 bg-black/20 px-3 py-3 text-[12px] text-fg-secondary">
                No social sources yet. Add X handles on the token route or wait for ingestion — we
                only render verifiable links here.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {demoFixture ? (
                  <li className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[10px] text-amber-100/90">
                    Cards below are inferred from token-linked profiles and sites — treat as
                    orientation, not verified transcripts.
                  </li>
                ) : null}
                {item.topSources.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold text-fg-primary">
                          <span className="truncate">{s.authorName}</span>
                          {s.authorHandle ? (
                            <span className="truncate text-[10px] font-normal text-fg-muted">
                              @{s.authorHandle.replace(/^@/, '')}
                            </span>
                          ) : null}
                        </div>
                        <span className="mt-1 inline-flex rounded-full border border-white/[0.08] bg-black/25 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-fg-muted">
                          {badgeLabel(s.catalystType)}
                        </span>
                      </div>
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[11px] text-accent-primary hover:underline"
                        >
                          Open
                        </a>
                      ) : null}
                    </div>
                    <p className="mt-2 line-clamp-4 text-[11px] leading-snug text-fg-secondary">
                      {s.text}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-5 pb-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              Co-pilot prompts
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COPILOT_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={!authenticated}
                  title={!authenticated ? 'Sign in to use Co-pilot' : undefined}
                  onClick={() =>
                    openCopilotQuickAsk({
                      entity: { type: 'token', id: item.tokenAddress, label: item.ticker },
                      question: `${p} (${item.ticker})`,
                    })
                  }
                  className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-fg-secondary transition hover:bg-white/[0.06] hover:text-fg-primary disabled:opacity-35"
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-fg-muted">
              Pointer Co-pilot answers short-term explainers from the same tooltip pipeline used
              elsewhere — treat replies as suggestions, not certainties.
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}

/* ----------------------------- helpers ----------------------------- */

type Overview = {
  whatItIs: string;
  whyMoving: string;
  walletSignal: string;
  socialSignal: string;
  narrative: string;
  risks: string;
  whatChanged: string;
};

function buildOverview(item: TokenExploreItem | null): Overview {
  if (!item) {
    return {
      whatItIs: '—',
      whyMoving: '—',
      walletSignal: '—',
      socialSignal: '—',
      narrative: '—',
      risks: '—',
      whatChanged: '—',
    };
  }
  const tracked = item.trackedWalletBuys;
  const fresh = item.freshWalletBuys;
  const smart = item.smartWalletBuys;
  const kol = item.kolMentionCount;

  const walletParts: string[] = [];
  if (tracked != null) walletParts.push(`${tracked} tracked`);
  if (fresh != null) walletParts.push(`${fresh} fresh`);
  if (smart != null) walletParts.push(`${smart} smart`);
  const walletSignal =
    walletParts.length > 0
      ? walletParts.join(' · ')
      : 'Wallet ingestion not connected for this chain yet.';

  const socialPieces: string[] = [];
  if (kol != null && kol > 0) socialPieces.push(`${kol} KOL mention${kol === 1 ? '' : 's'}`);
  if (item.socialScore >= 22) socialPieces.push('linked official channels');
  else if (item.socialScore >= 14) socialPieces.push('light official presence');
  const socialSignal =
    socialPieces.length > 0 ? socialPieces.join(' · ') : 'No social corpus indexed yet.';

  const narrativeFromCatalysts =
    item.topCatalysts.length > 0
      ? item.topCatalysts.slice(0, 3).join(' · ')
      : 'Mindshare carried by mixed market flows rather than a single catalyst.';

  const risks =
    item.riskScore >= 70
      ? `Risk ${Math.round(item.riskScore)} — concentration or thin liquidity flagged. Treat sizing carefully.`
      : item.riskScore >= 55
        ? `Risk ${Math.round(item.riskScore)} — readable but not premium. Cross-check liquidity depth.`
        : `Risk ${Math.round(item.riskScore)} — within tolerance for this cohort.`;

  const whatChanged = item.lastUpdatedAt
    ? `Last snapshot ${new Date(item.lastUpdatedAt).toLocaleTimeString()} · trend reads ${item.trendDirection} on ${item.confidenceLevel} confidence.`
    : 'Awaiting a fresh snapshot from the indexer.';

  return {
    whatItIs: `${item.ticker} (${item.name}) on ${item.chainTicker}${item.ageLabel ? ` · ${item.ageLabel} old` : ''}.`,
    whyMoving: item.hoverOneLiner,
    walletSignal,
    socialSignal,
    narrative: narrativeFromCatalysts,
    risks,
    whatChanged,
  };
}

function Insight({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone?: 'normal' | 'risk';
}) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-baseline gap-x-2">
      <dt className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-fg-muted/95">{k}</dt>
      <dd
        className={cn(
          'text-[11px] text-fg-secondary',
          tone === 'risk' && 'text-rose-200/90',
        )}
      >
        {v}
      </dd>
    </div>
  );
}

function Metric({
  k,
  v,
  span,
  cap,
}: {
  k: string;
  v: ReactNode;
  span?: number;
  cap?: boolean;
}) {
  return (
    <div className={span === 2 ? 'col-span-2' : undefined}>
      <div className="text-[10px] text-fg-muted">{k}</div>
      <div className={`tabular-nums text-fg-primary ${cap ? 'capitalize' : ''}`}>{v}</div>
    </div>
  );
}

function badgeLabel(ct: SocialCatalystType): string {
  switch (ct) {
    case 'kol_catalyst':
      return 'KOL catalyst';
    case 'listing_catalyst':
      return 'Listing / venue';
    case 'viral_post':
      return 'Viral post';
    case 'smart_wallet_signal':
      return 'Wallet signal';
    case 'narrative_driver':
      return 'Narrative';
    case 'risk_warning':
      return 'Risk';
    case 'official':
      return 'Official';
    default:
      return 'Related';
  }
}
