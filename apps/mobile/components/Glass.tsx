import React from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { colors, radius } from '../src/theme';

const liquid = (() => {
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
})();

/**
 * One glass surface for the whole app. iOS 26 → real Liquid Glass (GlassView);
 * other iOS / Android → an expo-blur frosted panel; web/unsupported → a tinted
 * solid. A hairline top border + soft inner tint sell the "premium native" feel
 * (this is what keeps it from looking like a generic RN app).
 */
export function Glass({
  children,
  style,
  intensity = 24,
  interactive = false,
  ...rest
}: ViewProps & { intensity?: number; interactive?: boolean }) {
  const frame = [s.base, style];

  if (liquid) {
    return (
      <GlassView
        glassEffectStyle="regular"
        isInteractive={interactive}
        tintColor="rgba(14,21,31,0.55)"
        style={frame}
        {...rest}
      >
        <View style={s.hairline} pointerEvents="none" />
        {children}
      </GlassView>
    );
  }

  if (Platform.OS !== 'web') {
    return (
      <View style={[frame, s.clip]} {...rest}>
        <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, s.tint]} pointerEvents="none" />
        <View style={s.hairline} pointerEvents="none" />
        {children}
      </View>
    );
  }

  return (
    <View style={[frame, { backgroundColor: colors.bgRaised }]} {...rest}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  clip: { backgroundColor: 'rgba(14,21,31,0.35)' },
  tint: { backgroundColor: 'rgba(10,15,24,0.30)' },
  hairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
});
