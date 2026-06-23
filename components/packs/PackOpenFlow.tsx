'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PackOpenResult, PackPublicConfig, PackType } from '@/types/pack';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { usePackPurchase } from '@/lib/packs/usePackPurchase';
import {
  celebrationFromTestMode,
  JACKPOT_STING_MS,
  resolvePackCelebration,
  type PackCelebration,
  type PackTestCelebration,
} from '@/lib/packs/celebrations';
import {
  getOpenAnimationProfile,
  isCalmPackType,
  resolveRevealIntensity,
  shouldShowConfetti,
  shouldShowFireworks,
} from '@/lib/packs/pullIntensity';
import { PACK_VISUAL } from '@/lib/packs/rarityTheme';
import { formatPackVal } from '@/lib/packs/formatDisplay';
import { PackConfetti } from '@/components/packs/PackConfetti';
import { PackFifaFireworks } from '@/components/packs/PackFifaFireworks';
import { PackFoilBox } from '@/components/packs/PackFoilBox';
import { PackFoilDesign } from '@/components/packs/PackFoilDesign';
import { PackFireworks } from '@/components/packs/PackFireworks';
import { PackCandleSurgeReveal } from '@/components/packs/PackCandleSurgeReveal';
import { PackHelicopterReveal } from '@/components/packs/PackHelicopterReveal';
import { PackMythicShowcase } from '@/components/packs/PackMythicShowcase';
import { PackVaultOpenReveal } from '@/components/packs/PackVaultOpenReveal';
import { PackRewardCard } from '@/components/packs/PackRewardCard';
import { PackShareCard } from '@/components/packs/PackShareCard';
import { PackSolAmount } from '@/components/packs/PackSolAmount';
import { exportShareImagePng } from '@/lib/share/exportShareImage';
import { usePackCelebrationSound } from '@/components/packs/usePackCelebrationSound';
import { playPackOpenBurst } from '@/lib/packs/packSounds';
import { cn } from '@/lib/utils/cn';

type FlowStage =
  | 'confirm'
  | 'opening'
  | 'jackpot_sting'
  | 'helicopter'
  | 'mythic_showcase'
  | 'vault_open'
  | 'candle_surge'
  | 'reveal'
  | 'summary';
type OpenPhase = 'float' | 'shake' | 'burst';

type PackOpenFlowProps = {
  config: PackPublicConfig | null;
  onClose: () => void;
  /** Dev-only — forces a specific celebration test pull. */
  testCelebration?: PackTestCelebration;
  /** Live commerce — charge the user (real SOL → treasury) before opening. */
  live?: boolean;
};

function openTimings(packType: PackType) {
  const profile = getOpenAnimationProfile(packType);
  if (profile === 'calm') {
    return { shakeAt: null as number | null, burstAt: 2000, revealAt: 2400 };
  }
  if (profile === 'standard') {
    return { shakeAt: 900, burstAt: 2100, revealAt: 2600 };
  }
  return { shakeAt: 750, burstAt: 1950, revealAt: 2500 };
}

function resolveFlowCelebration(
  packType: PackType,
  result: PackOpenResult,
  testCelebration?: PackTestCelebration,
): PackCelebration {
  const testOverride = testCelebration ? celebrationFromTestMode(testCelebration) : null;
  if (testOverride) return testOverride;
  return resolvePackCelebration(packType, result);
}

function stageFromCelebration(c: PackCelebration): FlowStage {
  if (c === 'helicopter_jackpot') return 'helicopter';
  if (c === 'vault_open') return 'vault_open';
  if (c === 'candle_surge') return 'candle_surge';
  return 'reveal';
}

type DeliveryState = 'idle' | 'pending' | 'delivered' | 'failed';

/**
 * Poll the live-commerce delivery outcome. The open response returns instantly;
 * the treasury buy + transfer finish a few seconds later server-side. We poll
 * the payment row until it leaves `verified`. On timeout we stay 'pending'
 * rather than claim an outcome we can't confirm.
 */
async function pollPackDelivery(
  paymentTx: string,
  getAccessToken: () => Promise<string | null>,
  onResolve: (state: 'delivered' | 'failed') => void,
): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500));
    let token: string | null = null;
    try {
      token = await getAccessToken();
    } catch {
      token = null;
    }
    try {
      const res = await fetch(`/api/packs/payment-status?tx=${encodeURIComponent(paymentTx)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const j = (await res.json()) as { delivered?: boolean; failed?: boolean };
        if (j.delivered) return onResolve('delivered');
        if (j.failed) return onResolve('failed');
      }
    } catch {
      /* transient — keep polling */
    }
  }
}

export function PackOpenFlow({ config, onClose, testCelebration, live = false }: PackOpenFlowProps) {
  const { getAccessToken } = usePointerAuth();
  const { payForPack } = usePackPurchase();
  const [stage, setStage] = useState<FlowStage>('confirm');
  const [openPhase, setOpenPhase] = useState<OpenPhase>('float');
  const [result, setResult] = useState<PackOpenResult | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [opening, setOpening] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryState>('idle');
  const shareRef = useRef<HTMLDivElement>(null);

  usePackCelebrationSound(stage === 'jackpot_sting' ? 'jackpot_sting' : null);

  useEffect(() => {
    if (!config) return;
    setStage('confirm');
    setOpenPhase('float');
    setResult(null);
    setRevealedCount(0);
    setOpening(false);
    setDelivery('idle');
  }, [config, testCelebration]);

  const runOpen = useCallback(async () => {
    if (!config || opening) return;
    setOpening(true);

    // Live commerce: charge the user (real SOL → treasury) BEFORE the cinematic,
    // so the box never "opens" until payment is signed + sent.
    let payment: { paymentTx: string; userWallet: string } | null = null;
    if (live) {
      try {
        payment = await payForPack({ packType: config.type, getAccessToken });
      } catch (e) {
        console.error('[PackOpenFlow] pack payment failed', e);
        toast.error('Pack payment failed', { description: 'Please try again.' });
        setOpening(false);
        return;
      }
    }

    setStage('opening');
    setOpenPhase('float');

    const { shakeAt, burstAt, revealAt } = openTimings(config.type as PackType);
    const shakeTimer = shakeAt != null ? setTimeout(() => setOpenPhase('shake'), shakeAt) : null;
    const burstTimer = setTimeout(() => {
      setOpenPhase('burst');
      if (!isCalmPackType(config.type as PackType)) void playPackOpenBurst();
    }, burstAt);

    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/packs/open', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          packType: config.type,
          ...(testCelebration ? { testCelebration } : {}),
          ...(payment ? { paymentTx: payment.paymentTx, userWallet: payment.userWallet } : {}),
        }),
      });
      const json = (await res.json()) as { result?: PackOpenResult; error?: string; message?: string };
      if (!res.ok || !json.result) {
        throw new Error(json.message ?? json.error ?? 'open_failed');
      }

      setResult(json.result);

      // Live commerce: delivery (treasury buy + transfer) finishes server-side a
      // few seconds after this response. Poll for the real outcome so the summary
      // reflects it honestly instead of always claiming "Delivered".
      if (live && payment) {
        setDelivery('pending');
        void pollPackDelivery(payment.paymentTx, getAccessToken, setDelivery);
      }

      const celebration = resolveFlowCelebration(config.type as PackType, json.result!, testCelebration);
      setTimeout(() => {
        const next = stageFromCelebration(celebration);
        if (next === 'helicopter') {
          setStage('jackpot_sting');
          setTimeout(() => setStage('helicopter'), JACKPOT_STING_MS);
        } else if (next === 'reveal') {
          setStage('reveal');
          setRevealedCount(0);
        } else {
          setStage(next as FlowStage);
        }
        setOpening(false);
      }, revealAt);
    } catch (e) {
      if (shakeTimer) clearTimeout(shakeTimer);
      clearTimeout(burstTimer);
      console.error('[PackOpenFlow] pack open failed', e);
      toast.error('Pack open failed', { description: 'Please try again.' });
      setOpening(false);
      setStage('confirm');
      setOpenPhase('float');
    }
  }, [config, getAccessToken, opening, testCelebration, live, payForPack]);

  /** Hero card was already shown during the cinematic (vault / candle / showcase). */
  const onCelebrationDone = useCallback(() => {
    setStage('reveal');
    setRevealedCount(1);
  }, []);

  /** Helicopter → PES-style 3D showcase (card not counted as revealed yet). */
  const onHelicopterDone = useCallback(() => {
    setStage('mythic_showcase');
  }, []);

  /** Showcase holds until click — then usual card-by-card reveal. */
  const onShowcaseSkip = useCallback(() => {
    setStage('reveal');
    setRevealedCount(1);
  }, []);

  const skipToSummary = useCallback(() => {
    if (!result) return;
    setRevealedCount(result.rewards.length);
    setStage('summary');
  }, [result]);

  useEffect(() => {
    if (stage !== 'reveal' || !result) return;
    if (revealedCount >= result.rewards.length) {
      const t = setTimeout(() => setStage('summary'), 800);
      return () => clearTimeout(t);
    }
    const nextReward = result.rewards[revealedCount];
    const intensity = resolveRevealIntensity(config!.type as PackType, result);
    let delay = isCalmPackType(config!.type as PackType) ? 820 : 680;
    if (intensity === 'jackpot' && nextReward?.rarity === 'mythic') {
      delay = revealedCount === 0 ? 3_400 : 1_200;
    }
    else if (intensity === 'hype' && nextReward && shouldShowConfetti(intensity, nextReward.rarity)) delay = 900;

    const t = setTimeout(() => setRevealedCount((c) => c + 1), delay);
    return () => clearTimeout(t);
  }, [stage, revealedCount, result, config]);

  const onShare = useCallback(async () => {
    if (!shareRef.current || !result) return;
    try {
      await exportShareImagePng(shareRef.current, `pointer-pack-${result.openId.slice(0, 8)}.png`);
      toast.success('Pull card saved');
    } catch {
      toast.error('Could not export image');
    }
  }, [result]);

  if (!config) return null;

  const packType = config.type as PackType;
  const vis = PACK_VISUAL[packType];
  const calm = isCalmPackType(packType);
  const intensity = resolveRevealIntensity(packType, result);
  const topPull = result?.rewards[0];

  const currentRevealRarity =
    stage === 'reveal' && result && revealedCount > 0
      ? result.rewards[revealedCount - 1]!.rarity
      : null;

  const showJackpotFx =
    intensity === 'jackpot' &&
    (stage === 'helicopter' || stage === 'mythic_showcase' || stage === 'summary');
  const showHypeFx =
    intensity === 'hype' &&
    stage === 'reveal' &&
    currentRevealRarity != null &&
    shouldShowFireworks(intensity, currentRevealRarity);
  const showSummaryJackpot = intensity === 'jackpot' && stage === 'summary';

  const showFireworks = showJackpotFx || showHypeFx || showSummaryJackpot;
  const isJackpotSting = stage === 'jackpot_sting';
  const isJackpotHeli = stage === 'helicopter';
  const isMythicShowcase = stage === 'mythic_showcase';

  const showConfetti =
    result != null &&
    !isJackpotSting &&
    (stage === 'helicopter' ||
      isMythicShowcase ||
      (stage === 'reveal' &&
        currentRevealRarity != null &&
        shouldShowConfetti(intensity, currentRevealRarity)) ||
      (stage === 'summary' && intensity !== 'calm' && (intensity === 'jackpot' || topPull != null)));

  const jackpotReward = result?.isJackpotPull ? result.rewards[0] : null;
  const eliteReward = result?.rewards[0] ?? null;

  const showFifaFx =
    !isJackpotSting &&
    (stage === 'helicopter' ||
      isMythicShowcase ||
      (stage === 'reveal' && currentRevealRarity != null && currentRevealRarity === 'legendary') ||
      (stage === 'summary' && topPull?.rarity === 'legendary'));

  const canSkipReveal = result != null && stage === 'reveal';
  const canSkipShowcase = result != null && isMythicShowcase;

  return (
    <div
      className={cn(
        'pack-overlay fixed inset-0 z-[600] overflow-hidden',
        stage === 'helicopter' && 'pack-overlay--jackpot-void',
        isJackpotSting && 'pack-overlay--jackpot-sting',
        isMythicShowcase && 'pack-overlay--mythic-showcase',
        showSummaryJackpot && 'pack-overlay--insane',
      )}
    >
      <PackFireworks
        active={showFireworks && !showFifaFx}
        intense={intensity === 'jackpot'}
        mega={isJackpotHeli || isMythicShowcase}
      />
      <PackFifaFireworks
        active={showFifaFx}
        intense={isJackpotHeli || isMythicShowcase}
        mega={isJackpotHeli || isMythicShowcase}
      />
      <PackConfetti
        active={showConfetti}
        intense={intensity === 'jackpot'}
        mega={isJackpotHeli || isMythicShowcase}
        rain={isMythicShowcase}
      />
      <div
        className={cn(
          'pack-overlay-vignette pointer-events-none absolute inset-0',
          stage === 'opening' && 'pack-overlay-vignette--open',
          stage === 'helicopter' && 'pack-overlay-vignette--jackpot',
          isJackpotSting && 'pack-overlay-vignette--jackpot-sting',
          isMythicShowcase && 'pack-overlay-vignette--mythic-showcase',
          (stage === 'vault_open' || stage === 'candle_surge') && 'pack-overlay-vignette--elite',
          showSummaryJackpot && 'pack-overlay-vignette--insane',
        )}
        aria-hidden
      />
      <button
        type="button"
        className={cn(
          'absolute inset-0',
          isJackpotSting || stage === 'helicopter' || isMythicShowcase || showSummaryJackpot
            ? 'bg-black'
            : 'bg-black/90',
        )}
        aria-label="Dismiss"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-full flex-col">
        <div
          className={cn(
            'relative flex min-h-0 flex-1 flex-col',
            isMythicShowcase || isJackpotHeli ? 'w-full' : 'items-center justify-center px-4 pb-8',
          )}
        >
          {stage === 'jackpot_sting' ? (
            <div className="pack-jackpot-sting pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
              <div className="pack-jackpot-sting-pulse" />
            </div>
          ) : null}

          {stage === 'opening' ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 pb-8">
              <PackFoilBox packType={packType} label={config.label} phase={openPhase} />
            </div>
          ) : null}

          {stage === 'helicopter' && jackpotReward ? (
            <PackHelicopterReveal reward={jackpotReward} onComplete={onHelicopterDone} />
          ) : null}

          {stage === 'mythic_showcase' && jackpotReward ? (
            <PackMythicShowcase reward={jackpotReward} onSkip={onShowcaseSkip} />
          ) : null}

          {stage === 'confirm' ? (
            <div className="flex w-full flex-1 flex-col items-center justify-center px-4 pb-8">
              <div className="w-full max-w-xl rounded-md border border-white/10 bg-[#06080d]/95 p-6 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]">
                {testCelebration ? (
                  <p className="mb-4 rounded-sm border border-violet-400/30 bg-violet-950/30 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-widest text-violet-200">
                    Dev · {testCelebration.replace(/_/g, ' ')} test
                  </p>
                ) : null}
                <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                  <div className="group flex shrink-0 justify-center [perspective:1200px]">
                    <div
                      className={cn(
                        'pack-tcg-lift pack-shelf-shell h-[12.75rem] w-[8.75rem]',
                        `pack-shelf-shell--${packType}`,
                      )}
                    >
                      <div className="relative h-full w-full overflow-hidden rounded-[10px]">
                        <PackFoilDesign
                          type={packType}
                          label={config.label}
                          variant="shelf"
                          className="pack-collectible--confirm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <p className={cn('text-[11px] font-bold uppercase tracking-[0.18em]', vis.accent)}>
                      {config.label} pack
                    </p>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight">Ready to rip?</h2>
                    <p className="mt-2 text-[13px] leading-snug text-fg-secondary">
                      Variable token clips, boosts, and rare passes. Odds disclosed on each pack.
                    </p>
                    <p className="mt-4 flex justify-center sm:justify-start">
                      <PackSolAmount amount={config.packPriceSol} size="lg" />
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-press focus-ring flex-1 rounded-sm border border-border-subtle py-2.5 text-sm font-medium text-fg-secondary hover:bg-bg-hover"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={opening}
                    onClick={() => void runOpen()}
                    className={cn(
                      'btn-press focus-ring flex flex-1 items-center justify-center gap-2 rounded-sm py-2.5 text-sm font-semibold text-white',
                      'bg-gradient-to-b from-[#6b77f7] to-[#5865F2] hover:brightness-110 disabled:opacity-60',
                    )}
                  >
                    {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {live ? 'Buy & open' : 'Open pack'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {stage === 'vault_open' && eliteReward ? (
            <div className="flex w-full flex-1 flex-col items-center justify-center px-4 pb-8">
              <PackVaultOpenReveal reward={eliteReward} onComplete={onCelebrationDone} />
            </div>
          ) : null}

          {stage === 'candle_surge' && eliteReward ? (
            <div className="flex w-full flex-1 flex-col items-center justify-center px-4 pb-8">
              <PackCandleSurgeReveal reward={eliteReward} onComplete={onCelebrationDone} />
            </div>
          ) : null}

          {(stage === 'reveal' || stage === 'summary') && result ? (
            <div className="flex w-full flex-1 flex-col items-center justify-center px-4 pb-8">
            <div className="flex w-full max-w-5xl flex-col items-center">
              {stage === 'summary' ? (
                <div className="mb-8 text-center">
                  <p className={cn('text-[11px] font-bold uppercase tracking-[0.2em]', vis.accent)}>
                    {result.packLabel} pack
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight">Pull complete</h2>
                  {topPull ? (
                    <p className="mt-2 font-mono text-sm tabular-nums text-fg-muted">
                      Best hit · {topPull.tokenSymbol ?? topPull.title} ·{' '}
                      {formatPackVal(topPull.valueUsd, topPull.valueSol)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p
                  className={cn(
                    'mb-8 text-sm font-medium tracking-wide',
                    intensity === 'jackpot' ? 'animate-pulse text-amber-200' : 'text-fg-secondary',
                  )}
                >
                  {intensity === 'jackpot' && revealedCount <= 1 ? 'Mythic secured…' : 'Revealing…'}
                </p>
              )}

              <div className="flex flex-wrap items-end justify-center gap-4 md:gap-5">
                {result.rewards.map((reward, i) => {
                  const isRevealed = stage === 'summary' || i < revealedCount;
                  const isJackpotCard = result.isJackpotPull && i === 0;
                  return (
                    <div
                      key={reward.id}
                      className={cn(isJackpotCard && showSummaryJackpot && 'pack-jackpot-card-only-motion')}
                    >
                      <PackRewardCard
                        reward={reward}
                        revealed={isRevealed}
                        flipDelayMs={isJackpotCard ? 0 : i * 60}
                        spotlight={stage === 'summary' && i === 0}
                        insane={isJackpotCard && isRevealed}
                        drifting={isJackpotCard && stage === 'summary'}
                        interactive={isJackpotCard && stage === 'summary'}
                        settled={isJackpotCard && isRevealed}
                        calmReveal={calm}
                      />
                    </div>
                  );
                })}
              </div>

              {stage === 'summary' ? (
                <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
                  {live ? (
                    delivery === 'delivered' ? (
                      <span
                        title="Winnings were delivered to your wallet on-chain"
                        className="inline-flex items-center gap-1.5 rounded-sm border border-signal-bull/30 px-5 py-2.5 text-sm font-medium text-signal-bull"
                      >
                        <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                        Delivered to wallet
                      </span>
                    ) : delivery === 'failed' ? (
                      <span
                        title="On-chain delivery failed — your payment is queued for a refund"
                        className="inline-flex items-center gap-1.5 rounded-sm border border-red-400/30 px-5 py-2.5 text-sm font-medium text-red-300"
                      >
                        <AlertTriangle className="h-4 w-4" strokeWidth={2} />
                        Delivery failed — refund queued
                      </span>
                    ) : (
                      <span
                        title="Buying your winnings and sending them to your wallet"
                        className="inline-flex items-center gap-1.5 rounded-sm border border-amber-400/30 px-5 py-2.5 text-sm font-medium text-amber-200"
                      >
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                        Delivering to wallet…
                      </span>
                    )
                  ) : (
                    <button
                      type="button"
                      disabled
                      title="Wallet delivery coming with live pack commerce"
                      className="rounded-sm border border-border-subtle px-5 py-2.5 text-sm font-medium text-fg-muted opacity-45"
                    >
                      Add to wallet
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void onShare()}
                    className="btn-press focus-ring inline-flex items-center gap-2 rounded-sm border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-fg-primary hover:bg-white/[0.1]"
                  >
                    <Share2 className="h-4 w-4" strokeWidth={2} />
                    Share pull
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-press focus-ring rounded-sm bg-accent-primary px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
                  >
                    Done
                  </button>
                </div>
              ) : null}
            </div>
            </div>
          ) : null}
        </div>
      </div>

      {result ? (
        <div className="pointer-events-none fixed -left-[9999px] top-0" aria-hidden>
          <div ref={shareRef}>
            <PackShareCard result={result} />
          </div>
        </div>
      ) : null}

      {canSkipShowcase ? (
        <button
          type="button"
          onClick={onShowcaseSkip}
          className="btn-press focus-ring absolute bottom-5 right-5 z-[620] rounded-sm border border-white/15 bg-black/60 px-4 py-2 text-[12px] font-semibold text-white/80 backdrop-blur-sm hover:bg-white/[0.1] hover:text-white"
        >
          Continue
        </button>
      ) : null}

      {canSkipReveal ? (
        <button
          type="button"
          onClick={skipToSummary}
          className="btn-press focus-ring absolute bottom-5 right-5 z-[620] rounded-sm border border-white/15 bg-black/60 px-4 py-2 text-[12px] font-semibold text-white/80 backdrop-blur-sm hover:bg-white/[0.1] hover:text-white"
        >
          Skip
        </button>
      ) : null}
    </div>
  );
}
