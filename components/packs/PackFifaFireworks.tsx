'use client';

import { cn } from '@/lib/utils/cn';

/** FIFA-style white radial bursts — icon / legendary moments. */
export function PackFifaFireworks({ active, intense = false, mega = false }: { active: boolean; intense?: boolean; mega?: boolean }) {
  if (!active) return null;

  const rays = Array.from({ length: mega ? 24 : intense ? 16 : 10 }, (_, i) => i);
  const sparks = Array.from({ length: mega ? 96 : intense ? 32 : 18 }, (_, i) => i);

  return (
    <div className={cn('pack-fifa-fx pointer-events-none absolute inset-0 overflow-hidden', mega && 'pack-fifa-fx--mega')} aria-hidden>
      <div className="pack-fifa-flash absolute inset-0" />
      {rays.map((i) => (
        <span
          key={`r-${i}`}
          className="pack-fifa-ray"
          style={{
            ['--ray-angle' as string]: `${i * (360 / rays.length)}deg`,
            animationDelay: `${(i % 5) * 0.06}s`,
          }}
        />
      ))}
      {sparks.map((i) => (
        <span
          key={i}
          className="pack-fifa-spark"
          style={{
            left: `${50 + Math.cos(i * 1.7) * 38}%`,
            top: `${42 + Math.sin(i * 2.1) * 32}%`,
            animationDelay: `${0.08 + (i % 8) * 0.07}s`,
          }}
        />
      ))}
    </div>
  );
}
