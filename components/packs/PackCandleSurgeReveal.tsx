'use client';

import { useEffect } from 'react';
import type { PackReward } from '@/types/pack';
import { usePackCelebrationSound } from '@/components/packs/usePackCelebrationSound';
import { PackRewardCard } from '@/components/packs/PackRewardCard';
import { PACK_POINTER_LOGO } from '@/lib/packs/constants';

const CANDLE_SURGE_MS = 6_800;

/** Static prior bars on the chart (bull = green, bear = red). */
const CHART_HISTORY = [
  { bull: false, body: 22, wickTop: 5, wickBottom: 3 },
  { bull: true, body: 18, wickTop: 4, wickBottom: 3 },
  { bull: true, body: 26, wickTop: 6, wickBottom: 3 },
  { bull: false, body: 14, wickTop: 3, wickBottom: 4 },
  { bull: true, body: 20, wickTop: 5, wickBottom: 3 },
  { bull: true, body: 16, wickTop: 4, wickBottom: 2 },
] as const;

type PackCandleSurgeRevealProps = {
  reward: PackReward;
  onComplete: () => void;
};

/** Epic surge — zoom into Pointer chart, centered green candle prints, camera tracks up. */
export function PackCandleSurgeReveal({ reward, onComplete }: PackCandleSurgeRevealProps) {
  usePackCelebrationSound('candle_surge');

  useEffect(() => {
    const t = setTimeout(onComplete, CANDLE_SURGE_MS);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div className="pack-candle-scene relative h-full min-h-[min(78vh,640px)] w-full overflow-hidden">
      <div className="pack-candle-void pointer-events-none absolute inset-0" aria-hidden />

      <div className="pack-candle-stage">
        <div className="pack-candle-glitch-rgb pointer-events-none" aria-hidden />
        <div className="pack-candle-glitch-scan pointer-events-none" aria-hidden />

        <div className="pack-candle-camera">
          <div className="pack-candle-world">
            <div className="pack-candle-chart-header">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={PACK_POINTER_LOGO} alt="" width={14} height={14} className="object-contain opacity-80" />
                <span className="pack-candle-pair">Pointer chart</span>
                <span className="pack-candle-tag">1m</span>
              </div>
              <span className="pack-candle-price-live">+847.2%</span>
            </div>

            <div className="pack-candle-chart-area">
              <div className="pack-candle-grid-h" aria-hidden />
              <div className="pack-candle-grid-v" aria-hidden />

              <div className="pack-candle-candles-row">
                <div className="pack-candle-history" aria-hidden>
                  {CHART_HISTORY.map((bar, i) => (
                    <div key={i} className="pack-candle-bar">
                      <div className="pack-candle-bar-wick-top" style={{ height: bar.wickTop }} />
                      <div
                        className={
                          bar.bull
                            ? 'pack-candle-bar-body pack-candle-bar-body--bull'
                            : 'pack-candle-bar-body pack-candle-bar-body--bear'
                        }
                        style={{ height: bar.body }}
                      />
                      <div className="pack-candle-bar-wick-bottom" style={{ height: bar.wickBottom }} />
                    </div>
                  ))}
                </div>

                <div className="pack-candle-hero">
                  <div className="pack-candle-hero-wick" aria-hidden />
                  <div className="pack-candle-hero-body" aria-hidden />
                </div>
              </div>
            </div>

            <div className="pack-candle-volume-strip" aria-hidden>
              <div className="pack-candle-volume-history">
                {CHART_HISTORY.map((bar, i) => (
                  <div
                    key={i}
                    className={bar.bull ? 'pack-candle-vol pack-candle-vol--bull' : 'pack-candle-vol pack-candle-vol--bear'}
                    style={{ height: 6 + (bar.body % 12) }}
                  />
                ))}
              </div>
              <div className="pack-candle-vol pack-candle-vol--bull pack-candle-vol--surge" />
            </div>
          </div>
        </div>

        <div className="pack-candle-card-hud">
          <PackRewardCard reward={reward} revealed settled spotlight />
        </div>
      </div>
    </div>
  );
}
