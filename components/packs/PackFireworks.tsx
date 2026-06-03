'use client';

import { cn } from '@/lib/utils/cn';

/** Fireworks burst for legendary / mythic reveals. */
export function PackFireworks({ active, intense = false, mega = false }: { active: boolean; intense?: boolean; mega?: boolean }) {
  if (!active) return null;

  const sparks = Array.from({ length: mega ? 120 : intense ? 48 : 24 }, (_, i) => i);
  const trails = mega ? Array.from({ length: 24 }, (_, i) => i) : intense ? Array.from({ length: 12 }, (_, i) => i) : [];

  return (
    <div className={cn('pack-fireworks pointer-events-none absolute inset-0 overflow-hidden', mega && 'pack-fireworks--mega')} aria-hidden>
      {trails.map((i) => (
        <span
          key={`t-${i}`}
          className="pack-firework-trail"
          style={{
            left: `${12 + ((i * 41) % 76)}%`,
            animationDelay: `${i * 0.18}s`,
            ['--trail-hue' as string]: `${(i * 67 + 40) % 360}`,
          }}
        />
      ))}
      {sparks.map((i) => (
        <span
          key={i}
          className="pack-firework-spark"
          style={{
            left: `${5 + ((i * 37) % 90)}%`,
            top: `${8 + ((i * 53) % 75)}%`,
            animationDelay: `${(i % 9) * 0.1}s`,
            animationDuration: `${1.1 + (i % 5) * 0.15}s`,
            ['--spark-hue' as string]: `${(i * 47 + 20) % 360}`,
          }}
        />
      ))}
      <div className="pack-firework-flash absolute inset-0" />
    </div>
  );
}
