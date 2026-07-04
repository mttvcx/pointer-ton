import React from 'react';
import { StyleSheet, Text, Vibration, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressScale } from './PressScale';
import { colors } from '../src/theme';

/**
 * FOMO-style numeric entry keypad. Operates on a decimal-string value ("0", "12",
 * "4.50"); the parent owns the string and formats it. Guards a single dot and a
 * 2-decimal cap. Light haptic per key.
 */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

export function applyKey(value: string, key: string): string {
  if (key === '⌫') {
    const next = value.slice(0, -1);
    return next.length ? next : '0';
  }
  if (key === '.') {
    return value.includes('.') ? value : `${value}.`;
  }
  // digit
  if (value.includes('.')) {
    const [, frac = ''] = value.split('.');
    if (frac.length >= 2) return value; // cap 2 decimals
  }
  if (value === '0') return key; // replace leading zero
  return `${value}${key}`;
}

export function Keypad({ onKey }: { onKey: (key: string) => void }) {
  return (
    <View style={s.grid}>
      {KEYS.map((k) => (
        <PressScale
          key={k}
          to={0.9}
          style={s.key}
          onPress={() => {
            Vibration.vibrate(6);
            onKey(k);
          }}
        >
          {k === '⌫' ? (
            <View style={s.back}>
              <Ionicons name="close" size={18} color={colors.bg} />
            </View>
          ) : (
            <Text style={s.keyText}>{k}</Text>
          )}
        </PressScale>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  key: { width: '33.33%', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  keyText: { color: colors.fg, fontSize: 27, fontWeight: '500' },
  back: { width: 42, height: 30, borderRadius: 7, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
