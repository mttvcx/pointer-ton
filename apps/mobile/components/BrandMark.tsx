import React from 'react';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../src/theme';

/**
 * Pointer brand mark (placeholder, our own — not FOMO's asset). Two white rings.
 * Swap for the real logo asset later; the layout slot is what matters now.
 */
export function BrandMark({
  size = 28,
  color = '#fff',
  hole = colors.bg,
}: {
  size?: number;
  color?: string;
  hole?: string;
}) {
  const h = (size * 22) / 40;
  return (
    <Svg width={size} height={h} viewBox="0 0 40 22">
      <Circle cx={13} cy={11} r={9} fill={color} />
      <Circle cx={27} cy={11} r={9} fill={color} />
      <Circle cx={13} cy={11} r={3.4} fill={hole} />
      <Circle cx={27} cy={11} r={3.4} fill={hole} />
    </Svg>
  );
}
