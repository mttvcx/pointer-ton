import React from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

/**
 * Crypto brand marks drawn as vector SVG (gradients + facets) — crisp at any size,
 * no raster assets. Solana uses its signature purple→green gradient with a bevel
 * highlight for the 3D feel. name → the token's mark.
 */
export type CryptoName = 'solana' | 'ethereum' | 'bitcoin' | 'bnb' | 'base' | 'usdc';

export function CryptoLogo({ name, size = 64 }: { name: CryptoName; size?: number }) {
  if (name === 'solana') {
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Defs>
          <LinearGradient id="sol" x1="6" y1="40" x2="42" y2="8" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#9945FF" />
            <Stop offset="1" stopColor="#19FB9B" />
          </LinearGradient>
        </Defs>
        <Path d="M6 10 L34 10 L42 18 L14 18 Z" fill="url(#sol)" />
        <Path d="M6 21 L34 21 L42 29 L14 29 Z" fill="url(#sol)" />
        <Path d="M6 32 L34 32 L42 40 L14 40 Z" fill="url(#sol)" />
        <Path d="M6 10 L34 10 L33 12 L7 12 Z" fill="#ffffff" fillOpacity={0.28} />
        <Path d="M6 21 L34 21 L33 23 L7 23 Z" fill="#ffffff" fillOpacity={0.28} />
        <Path d="M6 32 L34 32 L33 34 L7 34 Z" fill="#ffffff" fillOpacity={0.28} />
      </Svg>
    );
  }

  if (name === 'ethereum') {
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Path d="M24 3 L24 19 L37 25 Z" fill="#8A92B2" />
        <Path d="M24 3 L11 25 L24 19 Z" fill="#C5CCEC" />
        <Path d="M24 33 L24 22 L37 27 Z" fill="#62688F" />
        <Path d="M24 33 L11 27 L24 22 Z" fill="#8A92B2" />
        <Path d="M24 45 L24 35 L37 29 Z" fill="#454A75" />
        <Path d="M24 45 L24 35 L11 29 Z" fill="#62688F" />
      </Svg>
    );
  }

  if (name === 'bitcoin') {
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Circle cx="24" cy="24" r="23" fill="#F7931A" />
        <G rotation="-14" origin="24, 24">
          <SvgText x="24" y="35" fontSize="30" fontWeight="700" fill="#ffffff" textAnchor="middle">
            ₿
          </SvgText>
        </G>
      </Svg>
    );
  }

  if (name === 'bnb') {
    const d = 5.6;
    const dia = (cx: number, cy: number) => `M${cx} ${cy - d} L${cx + d} ${cy} L${cx} ${cy + d} L${cx - d} ${cy} Z`;
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Circle cx="24" cy="24" r="23" fill="#F3BA2F" />
        <Path d={dia(24, 24)} fill="#ffffff" />
        <Path d={dia(24, 13)} fill="#ffffff" />
        <Path d={dia(24, 35)} fill="#ffffff" />
        <Path d={dia(13, 24)} fill="#ffffff" />
        <Path d={dia(35, 24)} fill="#ffffff" />
      </Svg>
    );
  }

  if (name === 'base') {
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Path d="M38 7 A22 22 0 1 0 38 41 Z" fill="#0052FF" />
      </Svg>
    );
  }

  // usdc
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle cx="24" cy="24" r="23" fill="#2775CA" />
      <Circle cx="24" cy="24" r="17.5" fill="none" stroke="#ffffff" strokeWidth="2.4" />
      <SvgText x="24" y="34" fontSize="26" fontWeight="700" fill="#ffffff" textAnchor="middle">
        $
      </SvgText>
    </Svg>
  );
}
