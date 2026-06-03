'use client';

import type { PackOpenResult, PackReward } from '@/types/pack';
import { RARITY_THEME, PACK_VISUAL } from '@/lib/packs/rarityTheme';
import { formatPackMc, formatPackTokenAmount, formatPackVal } from '@/lib/packs/formatDisplay';
import { isInsanePackPull } from '@/lib/packs/pullIntensity';
import { PackSolAmount } from '@/components/packs/PackSolAmount';
import { cn } from '@/lib/utils/cn';

type PackShareCardProps = {
  result: PackOpenResult;
};

function pickShareHero(rewards: PackReward[]): PackReward | null {
  const token = rewards.find((r) => r.kind === 'token_reward' || r.kind === 'legendary_reward');
  return token ?? rewards[0] ?? null;
}

export function PackShareCard({ result }: PackShareCardProps) {
  const vis = PACK_VISUAL[result.packType];
  const hero = pickShareHero(result.rewards);
  const theme = hero ? RARITY_THEME[hero.rarity] : RARITY_THEME.rare;
  const isToken = hero && (hero.kind === 'token_reward' || hero.kind === 'legendary_reward');
  const insane = result.isJackpotPull || isInsanePackPull(result.highlightRarity);

  const pulledSol = hero?.valueSol ?? result.totalTokenValueSol;
  const paidSol = result.priceSol;
  const profitSol = pulledSol - paidSol;
  const solUsd =
    hero?.valueUsd != null && hero.valueSol != null && hero.valueSol > 0
      ? hero.valueUsd / hero.valueSol
      : null;
  const profitUsd = solUsd != null ? profitSol * solUsd : null;
  const multiplier = paidSol > 0 ? pulledSol / paidSol : null;

  return (
    <div
      className={cn(
        'pack-share-card relative w-[540px] overflow-hidden rounded-sm border-2 bg-[#020204] text-white',
        insane ? 'border-amber-300/70 pack-share-holo' : 'border-white/15',
      )}
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0',
          insane
            ? 'bg-[radial-gradient(ellipse_100%_80%_at_50%_0%,rgba(251,191,36,0.42),transparent_50%),radial-gradient(ellipse_70%_50%_at_90%_90%,rgba(232,121,249,0.28),transparent_55%),radial-gradient(ellipse_60%_40%_at_10%_80%,rgba(56,189,248,0.18),transparent_50%)]'
            : 'bg-[radial-gradient(ellipse_85%_60%_at_50%_-5%,rgba(88,101,242,0.38),transparent_60%)]',
        )}
      />
      <div className="pack-share-shine pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative p-7 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/branding/pointer-bird-transparent.png" alt="" className="h-8 w-8 object-contain" draggable={false} />
            <div>
              <span className="text-xl font-semibold tracking-tight">pointer.</span>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">Packs</p>
            </div>
          </div>
          <div className="text-right">
            <p className={cn('text-[11px] font-bold uppercase tracking-[0.22em]', vis.accent)}>
              {result.packLabel}
            </p>
            <p className="text-[10px] text-white/40">Just ripped</p>
          </div>
        </div>

        {hero && isToken ? (
          <>
            <div className="relative mt-6 flex justify-center">
              {multiplier != null && multiplier >= 1.5 ? (
                <div
                  className={cn(
                    'absolute -right-1 top-0 z-10 rounded-sm border px-2.5 py-1 font-mono text-sm font-bold tabular-nums shadow-lg',
                    insane
                      ? 'border-amber-300/50 bg-amber-400/20 text-amber-200'
                      : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300',
                  )}
                >
                  {multiplier.toFixed(1)}×
                </div>
              ) : null}
              <div
                className={cn(
                  'relative overflow-hidden rounded-sm border-2 shadow-[0_28px_70px_-18px_rgba(0,0,0,0.95)]',
                  insane ? 'h-40 w-40 border-amber-300/55' : 'h-36 w-36 border-white/20',
                )}
              >
                <div className={cn('absolute inset-0 opacity-40', insane ? 'bg-amber-400/30' : 'bg-violet-500/20')} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hero.tokenIconUrl ?? '/branding/pointer-bird-transparent.png'}
                  alt=""
                  className="relative h-full w-full object-cover"
                />
              </div>
            </div>

            <p className={cn('mt-5 text-center text-[11px] font-bold uppercase tracking-[0.24em]', theme.text)}>
              {theme.label} pull
            </p>
            <p className="mt-1 text-center text-[34px] font-bold leading-none tracking-tight">
              {hero.tokenSymbol}
            </p>
            {hero.tokenName ? (
              <p className="mt-1 text-center text-sm text-white/45">{hero.tokenName}</p>
            ) : null}

            <div
              className={cn(
                'mt-6 rounded-sm border p-5',
                insane ? 'border-amber-300/25 bg-black/55' : 'border-white/10 bg-black/45',
              )}
            >
              <div className="flex items-end justify-between gap-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Pulled</p>
                  <div className="mt-1.5">
                    <PackSolAmount amount={Number(pulledSol.toFixed(pulledSol >= 10 ? 1 : 2))} size="lg" />
                  </div>
                  {hero.valueUsd != null ? (
                    <p className="mt-1 font-mono text-base tabular-nums text-white/50">
                      {formatPackVal(hero.valueUsd, null)}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Profit</p>
                  <div
                    className={cn(
                      'mt-1.5 flex items-center justify-end gap-2',
                      profitSol >= 0 ? 'text-emerald-400' : 'text-rose-400',
                    )}
                  >
                    <span className="font-mono text-3xl font-bold tabular-nums leading-none">
                      {profitSol >= 0 ? '+' : ''}
                      {profitSol.toFixed(profitSol >= 10 ? 1 : 2)}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/chains/sol.png" alt="" width={24} height={24} className="object-contain" />
                  </div>
                  {profitUsd != null ? (
                    <p
                      className={cn(
                        'mt-1 font-mono text-base font-semibold tabular-nums',
                        profitUsd >= 0 ? 'text-emerald-400/85' : 'text-rose-400/85',
                      )}
                    >
                      {profitUsd >= 0 ? '+' : '-'}${Math.abs(profitUsd).toFixed(0)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.08] pt-4 text-center">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35">MC</p>
                  <p className="mt-1 font-mono text-sm tabular-nums text-white/90">{formatPackMc(hero.marketCapUsd)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35">Amt</p>
                  <p className="mt-1 font-mono text-sm tabular-nums text-white/90">
                    {formatPackTokenAmount(hero.amountTokens)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35">Val</p>
                  <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-accent-glow">
                    {formatPackVal(hero.valueUsd, hero.valueSol)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-[10px] text-white/35">
              <span className="inline-flex items-center gap-1">
                Paid <PackSolAmount amount={paidSol} size="sm" />
              </span>
              <span>pointer · packs</span>
            </div>
          </>
        ) : hero ? (
          <div className="mt-8 text-center">
            <p className={cn('text-[11px] font-bold uppercase tracking-[0.22em]', theme.text)}>{theme.label}</p>
            <p className="mt-4 text-4xl font-bold tracking-tight">{hero.title}</p>
            <p className="mt-5 font-mono text-6xl font-bold tracking-tight">{hero.displayValue}</p>
            <p className="mt-6 text-sm text-white/40">
              {result.packLabel} pack · pointer
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
