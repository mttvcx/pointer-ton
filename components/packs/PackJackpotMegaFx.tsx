'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils/cn';

/** Full-screen mega burst for mythic helicopter climax. */
export function PackJackpotMegaFx({ active }: { active: boolean }) {
  const confetti = useMemo(
    () =>
      Array.from({ length: 220 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2.4,
        duration: 2.8 + Math.random() * 2.2,
        hue: Math.floor(Math.random() * 360),
        size: 10 + Math.random() * 14,
        drift: -120 + Math.random() * 240,
        rotate: Math.random() * 360,
      })),
    [],
  );

  const snow = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 4,
        duration: 3 + Math.random() * 4,
        size: 2 + Math.random() * 4,
      })),
    [],
  );

  const sparks = useMemo(
    () =>
      Array.from({ length: 64 }, (_, i) => ({
        id: i,
        left: 20 + Math.random() * 60,
        top: 15 + Math.random() * 55,
        delay: 0.4 + Math.random() * 1.8,
        scale: 0.6 + Math.random() * 1.4,
      })),
    [],
  );

  if (!active) return null;

  return (
    <div className="pack-jackpot-mega-fx pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {snow.map((s) => (
        <span
          key={`snow-${s.id}`}
          className="pack-jackpot-snowflake"
          style={{
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}

      <div className="pack-jackpot-mega-flash absolute inset-0" />
      {Array.from({ length: 20 }, (_, i) => (
        <span
          key={`ray-${i}`}
          className="pack-jackpot-mega-ray"
          style={{ ['--ray-angle' as string]: `${i * 18}deg`, animationDelay: `${(i % 6) * 0.05}s` }}
        />
      ))}

      {sparks.map((s) => (
        <span
          key={`spark-${s.id}`}
          className="pack-jackpot-mega-spark"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            animationDelay: `${s.delay}s`,
            transform: `scale(${s.scale})`,
          }}
        />
      ))}

      {confetti.map((p) => (
        <span
          key={p.id}
          className={cn('pack-jackpot-mega-confetti')}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.55,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--confetti-hue' as string]: p.hue,
            ['--confetti-drift' as string]: `${p.drift}px`,
            ['--confetti-rotate' as string]: `${p.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}
