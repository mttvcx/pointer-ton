import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../src/theme';

/**
 * App backdrop — Pointer's own look (moving off FOMO's flat black): a deep
 * mint-tinted night gradient with a faint aura glowing from the top-left, where
 * the brand mark sits. Subtle by design — it reads as depth, not decoration.
 */
export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[s.root, style]}>
      <LinearGradient colors={colors.bgGradient} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={s.aura} />
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  aura: { position: 'absolute', top: -180, left: -120, width: 380, height: 380, borderRadius: 190, backgroundColor: colors.aura },
});
