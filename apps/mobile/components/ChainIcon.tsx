import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

/** Flat chain logos (from pointer-web public/chains) — distinct from the 3D
 * coin renders the login screen uses. */
const CHAIN_ASSETS: Record<string, number> = {
  sol: require('../assets/chains/sol.png'),
  eth: require('../assets/chains/eth.png'),
  base: require('../assets/chains/base.png'),
  bnb: require('../assets/chains/bnb.png'),
};

export function ChainIcon({ id, size = 16, style }: { id: string; size?: number; style?: StyleProp<ImageStyle> }) {
  const src = CHAIN_ASSETS[id];
  if (!src) return null;
  return <Image source={src} style={[{ width: size, height: size, borderRadius: size / 2 }, style]} />;
}
