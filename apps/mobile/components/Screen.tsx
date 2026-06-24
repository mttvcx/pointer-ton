import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../src/theme';

/**
 * App background. A deep, faintly accent-tinted vertical gradient + a soft top
 * glow give every screen depth so glass surfaces read as floating material —
 * the difference between "native premium" and "flat RN".
 */
export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={s.root}>
      <LinearGradient colors={['#0c1422', colors.bg, '#070a10']} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(88,101,242,0.18)', 'rgba(88,101,242,0)']}
        style={s.glow}
        pointerEvents="none"
      />
      <View style={[s.content, style]}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  content: { flex: 1 },
});
