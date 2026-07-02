import React from 'react';
import { Dimensions, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../src/theme';

const { width: W, height: H } = Dimensions.get('window');

/**
 * App backdrop — Pointer's own look (off FOMO's flat black): a deep mint-tinted
 * night gradient, with a soft, feathered mint AURA glowing from the top-left where
 * the brand mark sits. The aura is a true radial gradient (SVG) so it melts into
 * the black — elegant depth, not a hard circle.
 */
export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[s.root, style]}>
      <LinearGradient colors={colors.bgGradient} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} />
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="aura" cx={W * 0.24} cy={H * 0.05} r={W * 0.95} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors.accent} stopOpacity="0.18" />
            <Stop offset="0.5" stopColor={colors.accent} stopOpacity="0.05" />
            <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#aura)" />
      </Svg>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
