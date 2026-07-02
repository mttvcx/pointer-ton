import React from 'react';
import { Image } from 'react-native';

/** The real Hyperliquid mark (official logo asset). Marks every perp market as
 *  Hyperliquid-sourced. */
const HL = require('../assets/protocols/hyperliquid.png');

export function HlBadge({ size = 14 }: { size?: number }) {
  return <Image source={HL} style={{ width: size, height: size }} resizeMode="contain" />;
}
