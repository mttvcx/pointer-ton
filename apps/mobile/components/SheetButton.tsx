import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressScale } from './PressScale';
import { colors, radius } from '../src/theme';

/**
 * Full-width sheet CTA with FOMO's state palette: gray when the action isn't yet
 * possible ("Enter an amount"), blue to move cash, green to go long, red to short.
 * A leading chevron chip appears in the disabled/blue states (matches FOMO).
 */
export type SheetButtonVariant = 'disabled' | 'blue' | 'long' | 'short' | 'primary';

const BG: Record<SheetButtonVariant, string> = {
  disabled: colors.bgRaised2,
  blue: colors.accent,
  long: colors.bull,
  short: colors.bear,
  primary: colors.accent,
};

export function SheetButton({
  label,
  variant,
  onPress,
  chevron,
  style,
}: {
  label: string;
  variant: SheetButtonVariant;
  onPress?: () => void;
  /** Show the leading ">>" chip (FOMO uses it on the gray/blue states). */
  chevron?: boolean;
  style?: ViewStyle;
}) {
  const disabled = variant === 'disabled';
  const fg = disabled ? colors.fgMuted : variant === 'blue' || variant === 'primary' ? colors.onAccent : '#04120C';
  return (
    <PressScale onPress={disabled ? undefined : onPress} to={disabled ? 1 : 0.97} style={[s.btn, { backgroundColor: BG[variant] }, style]}>
      {chevron ? (
        <View style={s.chip}>
          <Ionicons name="chevron-forward" size={15} color={fg} />
        </View>
      ) : null}
      <Text style={[s.label, { color: fg }]}>{label}</Text>
    </PressScale>
  );
}

const s = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingVertical: 16, overflow: 'hidden' },
  chip: { position: 'absolute', left: 10, width: 40, height: 34, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 17, fontWeight: '700' },
});
