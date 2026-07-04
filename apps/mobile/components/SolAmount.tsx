import React from 'react';
import { Image, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { colors } from '../src/theme';

/** Flat Solana logo (assets/chains) — the clean inline mark, NOT the 3D coin
 * render (assets/crypto) the login screen uses. Reads as a glyph next to a number. */
const SOL_MARK = require('../assets/chains/sol.png');

/**
 * Compact number formatting that drops trailing-zero noise: 0.5, 1, 0.05, 1.25.
 * Uses up to 4 significant-ish decimals then strips trailing zeros and any
 * dangling decimal point. System font only (no monospaced number fonts).
 */
function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (value === 0) return '0';
  // Round to 4 decimals, strip trailing zeros / trailing dot.
  const fixed = value.toFixed(4);
  return fixed.replace(/\.?0+$/, '');
}

export function SolAmount({
  value,
  size = 13,
  color = colors.fg,
  weight,
  style,
}: {
  value: number | string;
  size?: number;
  color?: string;
  weight?: TextStyle['fontWeight'];
  style?: ViewStyle;
}) {
  const text = typeof value === 'number' ? formatAmount(value) : value;
  // The Solana mark renders a touch larger than the cap height so it reads as an
  // inline glyph rather than a floating icon.
  const mark = Math.round(size * 1.05);

  return (
    <View style={[s.row, style]}>
      <Image source={SOL_MARK} style={{ width: mark, height: mark }} resizeMode="contain" />
      <Text
        style={{ color, fontSize: size, fontWeight: weight, marginLeft: Math.round(size * 0.3) }}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
