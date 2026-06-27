import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, Vibration, View, type ViewStyle } from 'react-native';
import { copyText } from '../src/clipboard';
import { colors } from '../src/theme';
import { PressScale } from './PressScale';

/**
 * Tap-to-copy control. Copies `value` to the clipboard (best-effort), gives a
 * tiny haptic, and flips the icon to a green checkmark for 1.2s as confirmation.
 * NEVER navigates — copying a CA / token name is the entire job here.
 */
export function CopyButton({
  value,
  size = 14,
  color = colors.fgFaint,
  label,
  style,
}: {
  value: string;
  size?: number;
  color?: string;
  label?: string;
  style?: ViewStyle;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onPress = async () => {
    const ok = await copyText(value);
    if (!ok) return;
    Vibration.vibrate(8);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1200);
  };

  return (
    <PressScale onPress={onPress} style={[s.row, style]} hitSlop={8}>
      <Ionicons
        name={copied ? 'checkmark-circle' : 'copy-outline'}
        size={size}
        color={copied ? colors.bull : color}
      />
      {label ? (
        <Text style={[s.label, { fontSize: size, color: copied ? colors.bull : color }]}>{label}</Text>
      ) : null}
    </PressScale>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  label: { fontWeight: '600' },
});
