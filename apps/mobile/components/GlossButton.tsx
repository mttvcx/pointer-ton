import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PressScale } from './PressScale';
import { colors } from '../src/theme';

/**
 * Primary CTA with a premium glossy-mint finish — a mint gloss gradient, a soft
 * white top sheen, and an accent glow-shadow so it lifts off the screen and pulls
 * the eye. Pointer's signature "tap me" button. Pass content as children.
 */
export function GlossButton({
  onPress,
  children,
  style,
  radius = 14,
  to = 0.97,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  radius?: number;
  to?: number;
}) {
  return (
    <PressScale
      onPress={onPress}
      to={to}
      style={[{ borderRadius: radius, shadowColor: colors.accent, shadowOpacity: 0.45, shadowRadius: 13, shadowOffset: { width: 0, height: 5 }, elevation: 7 }, style]}
    >
      <View style={[s.inner, { borderRadius: radius }]}>
        <LinearGradient colors={[colors.accentGlow, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.sheen}
          pointerEvents="none"
        />
        {children}
      </View>
    </PressScale>
  );
}

const s = StyleSheet.create({
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 15, overflow: 'hidden', backgroundColor: colors.accent },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '60%' },
});
