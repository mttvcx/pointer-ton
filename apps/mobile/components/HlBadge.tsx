import React from 'react';
import { SvgXml } from 'react-native-svg';

/**
 * The Hyperliquid mark — the exact `public/chains/hyperliquid.svg` asset from the
 * web app, inlined (not redrawn) so perps markets carry the real HL badge. Marks
 * every perp as Hyperliquid-sourced.
 */
const HL_XML =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#0b1412"/><path fill="#97fce4" d="M8 16V8h2.6l2.4 4.8L15.4 8H18v8h-2v-4.2L12.2 16 8.4 11.8V16H8Z"/></svg>';

export function HlBadge({ size = 14 }: { size?: number }) {
  return <SvgXml xml={HL_XML} width={size} height={size} />;
}
