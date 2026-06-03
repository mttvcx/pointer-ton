'use client';

import type { PackReward } from '@/types/pack';
import { RARITY_THEME } from '@/lib/packs/rarityTheme';
import {
  formatPackMc,
  formatPackTokenAmount,
  formatPackVal,
} from '@/lib/packs/formatDisplay';
import { cn } from '@/lib/utils/cn';
import { Percent, Sparkles, Trophy, Zap } from 'lucide-react';

type PackRewardCardProps = {
  reward: PackReward;
  revealed?: boolean;
  flipDelayMs?: number;
  spotlight?: boolean;
  insane?: boolean;
  /** Mythic drift animation — only the jackpot card. */
  drifting?: boolean;
  interactive?: boolean;
  /** Skip flip — card stays visible (helicopter / post-reveal). */
  settled?: boolean;
  /** Calm tiers use fade instead of 3D flip (no white edge flash). */
  calmReveal?: boolean;
  /** Native large render for PES showcase (avoids blurry CSS scale). */
  size?: 'default' | 'showcase';
};

function isTokenPull(reward: PackReward): boolean {
  return reward.kind === 'token_reward' || reward.kind === 'legendary_reward';
}

function UtilityIcon({ kind }: { kind: PackReward['kind'] }) {
  if (kind === 'cashback_multiplier') return <Percent className="h-10 w-10 text-amber-200" strokeWidth={1.75} />;
  if (kind === 'points_multiplier') return <Zap className="h-10 w-10 text-sky-200" strokeWidth={1.75} />;
  if (kind === 'rare_access_badge') return <Trophy className="h-10 w-10 text-violet-200" strokeWidth={1.75} />;
  return <Sparkles className="h-10 w-10 text-fuchsia-200" strokeWidth={1.75} />;
}

export function PackRewardCard({
  reward,
  revealed = true,
  flipDelayMs = 0,
  spotlight = false,
  insane = false,
  drifting = false,
  interactive = false,
  settled = false,
  calmReveal = false,
  size = 'default',
}: PackRewardCardProps) {
  const theme = RARITY_THEME[reward.rarity];
  const token = isTokenPull(reward);
  const showSpotlight = spotlight && revealed && !settled;
  const isShowcase = size === 'showcase';

  return (
    <div
      className={cn(
        'pack-reward-flip relative',
        revealed && !settled && calmReveal && 'pack-reward-flip--calm pack-reward-flip--revealed',
        revealed && !settled && !calmReveal && 'pack-reward-flip--revealed',
        revealed && settled && 'pack-reward-flip--settled',
        interactive && 'pack-tcg-reward-hover',
      )}
      style={settled ? undefined : { animationDelay: `${flipDelayMs}ms` }}
    >
      {showSpotlight ? (
        <div
          className={cn(
            'pack-rarity-beam pointer-events-none absolute -inset-6 -z-10 rounded-sm opacity-70',
            insane ? 'pack-rarity-beam--insane' : `bg-gradient-to-b ${theme.beam} to-transparent`,
          )}
          aria-hidden
        />
      ) : null}

      <div className={cn(drifting && revealed && 'pack-reward-insane-drift-inner')}>
        <article
          className={cn(
            'pack-reward-card-face relative flex flex-col overflow-hidden rounded-sm border bg-[#06080d]',
            isShowcase ? 'w-[280px]' : 'w-[168px]',
            theme.ring.replace('ring-', 'border-'),
            theme.glow,
            insane && 'border-amber-300/50 shadow-[0_0_48px_-4px_rgba(251,191,36,0.55)]',
            token ? (isShowcase ? 'h-[412px]' : 'h-[248px]') : isShowcase ? 'h-[366px]' : 'h-[220px]',
            isShowcase && 'pack-reward-card-face--showcase',
          )}
        >
          <div
            className={cn(
              'flex items-center justify-center border-b border-white/[0.06] px-2 font-bold uppercase tracking-[0.18em]',
              isShowcase ? 'h-9 text-[11px]' : 'h-7 text-[10px]',
              theme.text,
              theme.bg,
            )}
          >
            {theme.label}
          </div>

          {token ? (
            <>
              <div className={cn('relative overflow-hidden rounded-sm border border-white/10 bg-black/40', isShowcase ? 'mx-4 mt-4' : 'mx-3 mt-3')}>
                <div className="aspect-square w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={reward.tokenIconUrl ?? '/branding/pointer-bird-transparent.png'}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </div>
                <div className={cn('absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent', isShowcase ? 'px-3 py-2' : 'px-2 py-1.5')}>
                  <p className={cn('truncate font-bold text-white', isShowcase ? 'text-[17px]' : 'text-[13px]')}>{reward.tokenSymbol ?? reward.title}</p>
                  <p className={cn('truncate text-white/55', isShowcase ? 'text-[12px]' : 'text-[10px]')}>{reward.tokenName ?? reward.subtitle}</p>
                </div>
              </div>

              <div className={cn('mt-auto space-y-1.5 pt-2', isShowcase ? 'space-y-2 px-4 pb-4' : 'px-3 pb-3')}>
                <div className={cn('flex items-center justify-between gap-2', isShowcase ? 'text-[11px]' : 'text-[10px]')}>
                  <span className="font-semibold uppercase tracking-wide text-fg-muted">MC</span>
                  <span className="font-mono tabular-nums text-fg-primary">
                    {formatPackMc(reward.marketCapUsd)}
                  </span>
                </div>
                <div className={cn('flex items-center justify-between gap-2', isShowcase ? 'text-[11px]' : 'text-[10px]')}>
                  <span className="font-semibold uppercase tracking-wide text-fg-muted">Amt</span>
                  <span className="font-mono tabular-nums text-fg-primary">
                    {formatPackTokenAmount(reward.amountTokens)}
                  </span>
                </div>
                <div className={cn('flex items-center justify-between gap-2 border-t border-white/[0.06] pt-1.5', isShowcase ? 'text-[11px]' : 'text-[10px]')}>
                  <span className="font-semibold uppercase tracking-wide text-accent-glow">Val</span>
                  <span className={cn('font-mono font-semibold tabular-nums text-accent-glow', isShowcase ? 'text-[15px]' : 'text-[12px]')}>
                    {formatPackVal(reward.valueUsd, reward.valueSol)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                <UtilityIcon kind={reward.kind} />
              </div>
              <div>
                <p className="text-sm font-semibold text-fg-primary">{reward.title}</p>
                <p className="mt-1 text-[11px] text-fg-muted">{reward.subtitle}</p>
              </div>
              <p className="font-mono text-2xl font-bold tabular-nums text-fg-primary">{reward.displayValue}</p>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
