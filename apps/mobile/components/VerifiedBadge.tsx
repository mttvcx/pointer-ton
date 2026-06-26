import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../src/theme';

// Scalloped verification seal (12 gentle bumps) + a hand-drawn checkmark path —
// gives it the "notched" character a plain circle + icon-font check can't.
function sealPath(cx: number, cy: number, outer: number, inner: number, bumps: number): string {
  const step = Math.PI / bumps;
  let d = '';
  for (let i = 0; i < bumps * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = i * step - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return `${d}Z`;
}

const SEAL = sealPath(8, 8, 7.1, 6.1, 12);

export function VerifiedBadge({ size = 16, color = colors.verify }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d={SEAL} fill={color} stroke={colors.bg} strokeWidth={1} strokeLinejoin="round" />
      <Path d="M5 8.1 L7.1 10.3 L11.1 5.9" fill="none" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
