'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils/cn';

type PackConfettiProps = {
  active: boolean;
  intense?: boolean;
  mega?: boolean;
  /** Full-screen infinite rain (mythic showcase / heli). */
  rain?: boolean;
};

type ConfettiPiece = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  hue: number;
  size: number;
  drift: number;
};

export function PackConfetti({ active, intense = false, mega = false, rain = false }: PackConfettiProps) {
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (!active || rain) return;
    setBurst((b) => b + 1);
    if (!intense) return;
    const t = setInterval(() => setBurst((b) => b + 1), 1800);
    return () => clearInterval(t);
  }, [active, intense, rain]);

  const pieces = useMemo(() => {
    if (!active) return [] as ConfettiPiece[];
    const count = rain ? 420 : mega ? 240 : intense ? 120 : 36;
    return Array.from({ length: count }, (_, id) => ({
      id: id + (rain ? 0 : burst * 1000),
      left: Math.random() * 100,
      delay: Math.random() * (rain ? 7.5 : mega ? 2.4 : intense ? 1.2 : 0.6),
      duration: rain ? 3.8 + Math.random() * 3.2 : mega ? 3.2 + Math.random() * 2.4 : 2.4 + Math.random() * 1.8,
      hue: Math.floor(Math.random() * 360),
      size: rain ? 10 + Math.random() * 14 : mega ? 12 + Math.random() * 16 : intense ? 8 + Math.random() * 8 : 5 + Math.random() * 4,
      drift: rain ? -200 + Math.random() * 400 : mega ? -160 + Math.random() * 320 : -40 + Math.random() * 80,
    }));
  }, [active, intense, mega, rain, burst]);

  if (!active) return null;

  return (
    <div
      className={cn(
        'pack-confetti pointer-events-none absolute inset-0 overflow-hidden',
        (mega || rain) && 'pack-confetti--mega-layer',
        rain && 'pack-confetti--rain',
      )}
      aria-hidden
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          className={cn(
            'pack-confetti-piece',
            (intense || mega || rain) && 'pack-confetti-piece--intense',
            (mega || rain) && 'pack-confetti-piece--mega',
            rain && 'pack-confetti-piece--rain',
          )}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.55,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--confetti-hue' as string]: p.hue,
            ['--confetti-drift' as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
