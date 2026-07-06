import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

/** The real Visa wordmark (grey transparent PNG, 966×313 ≈ 3.08:1). */
const VISA = require('../assets/visa.png');
const ASPECT = 966 / 313;

/**
 * Visa logo for the card mocks. `size` = height; width follows the real aspect.
 * `tint` optionally recolors it (e.g. dark on a light metal card); default keeps
 * the native grey so it reads like the real mark.
 */
export function VisaMark({ size = 22, tint, style }: { size?: number; tint?: string; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={VISA}
      resizeMode="contain"
      tintColor={tint}
      style={[{ height: size, width: Math.round(size * ASPECT) }, style]}
    />
  );
}
