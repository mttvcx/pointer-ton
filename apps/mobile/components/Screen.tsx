import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors } from '../src/theme';

/** App background — flat near-black, FOMO-style. No gradient, no glow. */
export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.root, style]}>{children}</View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
