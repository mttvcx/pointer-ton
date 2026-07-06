import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PressScale } from './PressScale';

/**
 * Silver metallic CTA — the finance section's primary button (distinct from the
 * app's green GlossButton). Brushed-metal gradient + a white top sheen, so it
 * reads like the metal card. Content (dark text/icons) passed as children.
 */
export function MetalButton({
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
      style={[{ borderRadius: radius, shadowColor: '#C7CCD1', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 }, style]}
    >
      <View style={[s.inner, { borderRadius: radius }]}>
        <LinearGradient colors={['#EDF0F3', '#C4CBD2', '#9BA3AC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(255,255,255,0.65)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.sheen} pointerEvents="none" />
        {children}
      </View>
    </PressScale>
  );
}

const s = StyleSheet.create({
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 15, overflow: 'hidden' },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
});
