import React, { useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../src/theme';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Tiny deterministic price sparkline for token rows — trends up (mint) or down
 * (red) per the row's change. Pointer's own signal-dense row treatment; FOMO's
 * rows are flat text, this gives every row a glanceable shape.
 */
export function MiniSpark({ seed, up, width = 58, height = 26 }: { seed: string; up: boolean; width?: number; height?: number }) {
  const d = useMemo(() => {
    let h = hash(seed);
    const rng = () => {
      h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
      return h / 4294967296;
    };
    const N = 14;
    const pad = 3;
    let v = up ? 0.32 : 0.68;
    const pts: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      const drift = up ? (rng() - 0.37) * 0.3 : (rng() - 0.63) * 0.3;
      v = Math.max(0.08, Math.min(0.92, v + drift));
      const x = pad + (i / (N - 1)) * (width - 2 * pad);
      const y = pad + (1 - v) * (height - 2 * pad);
      pts.push([x, y]);
    }
    return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  }, [seed, up, width, height]);

  return (
    <Svg width={width} height={height}>
      <Path d={d} fill="none" stroke={up ? colors.bull : colors.bear} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
    </Svg>
  );
}
