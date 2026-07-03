import React, { useMemo } from 'react';
import Svg, { Defs, LinearGradient as SvgGrad, Path, Stop } from 'react-native-svg';
import { colors } from '../src/theme';

/**
 * Lightweight filled line chart from normalized 0..1 points (oldest → newest).
 * viewBox-scaled so it stretches to whatever width the parent gives it.
 */
export function Sparkline({
  data,
  height = 46,
  color = colors.bull,
  gradId = 'sparkgrad',
}: {
  data: number[];
  height?: number;
  color?: string;
  gradId?: string;
}) {
  const W = 320;
  const H = height;
  const { line, area } = useMemo(() => {
    const pts = data.map((v, i) => {
      const x = (i / Math.max(1, data.length - 1)) * W;
      const y = H - v * (H - 4) - 2;
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return { line: `M${pts.join(' L')}`, area: `M${pts.join(' L')} L${W} ${H} L0 ${H} Z` };
  }, [data, H]);
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <Defs>
        <SvgGrad id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </SvgGrad>
      </Defs>
      <Path d={area} fill={`url(#${gradId})`} />
      <Path d={line} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
