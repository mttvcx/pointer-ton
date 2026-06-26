import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

const SRC = require('../assets/pointer-logo.png');

/** Pointer wordmark/bird (white). */
export function Logo({ size = 34, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={SRC} style={[{ width: size, height: size, resizeMode: 'contain' }, style]} />;
}
