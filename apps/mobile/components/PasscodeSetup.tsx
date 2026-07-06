import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from './Screen';
import { PressScale } from './PressScale';
import { colors, radius } from '../src/theme';

const LEN = 6;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

/**
 * Set a Pointer passcode — enter 6 digits, then confirm. Silver/metallic finance
 * treatment (matches the premium finance section, distinct from the green app).
 * On a mismatch the dots shake and reset. Local-only for now; wire to secure-store
 * + the real app-lock when the finance security layer ships.
 */
export function PasscodeSetup({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<'create' | 'confirm'>('create');
  const [first, setFirst] = useState('');
  const [code, setCode] = useState('');
  const shake = useRef(new Animated.Value(0)).current;

  const doShake = () => {
    Vibration.vibrate(30);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0.6, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const press = (k: string) => {
    if (k === '') return;
    if (k === 'del') {
      setCode((c) => c.slice(0, -1));
      return;
    }
    if (code.length >= LEN) return;
    Vibration.vibrate(6);
    const next = code + k;
    setCode(next);
    if (next.length < LEN) return;

    if (phase === 'create') {
      setTimeout(() => {
        setFirst(next);
        setCode('');
        setPhase('confirm');
      }, 120);
    } else {
      setTimeout(() => {
        if (next === first) onDone();
        else {
          doShake();
          setCode('');
        }
      }, 120);
    }
  };

  const title = phase === 'create' ? 'Set a passcode' : 'Confirm your passcode';
  const sub = phase === 'create' ? 'Locks your money in this app.' : 'Enter the same 6 digits again.';
  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-12, 12] });

  return (
    <Screen>
      <View style={[s.top, { paddingTop: insets.top + 8 }]}>
        <PressScale onPress={onClose} style={s.close} to={0.9}>
          <Ionicons name="chevron-back" size={24} color={colors.fgSecondary} />
        </PressScale>
        <Text style={s.topTitle}>Passcode</Text>
        <View style={s.close} />
      </View>

      <View style={s.body}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.sub}>{sub}</Text>

        <Animated.View style={[s.dots, { transform: [{ translateX }] }]}>
          {Array.from({ length: LEN }).map((_, i) => {
            const filled = i < code.length;
            const active = i === code.length;
            return <View key={i} style={[s.dot, filled && s.dotFilled, active && s.dotActive]} />;
          })}
        </Animated.View>
      </View>

      <View style={[s.pad, { paddingBottom: insets.bottom + 20 }]}>
        {KEYS.map((k, i) => (
          <Pressable key={i} style={s.key} onPress={() => press(k)} disabled={k === ''}>
            {k === 'del' ? (
              <Ionicons name="backspace-outline" size={26} color={colors.fg} />
            ) : (
              <Text style={s.keyText}>{k}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const SILVER = '#C7CCD1';

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10 },
  topTitle: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  body: { alignItems: 'center', paddingTop: 40 },
  title: { color: colors.fg, fontSize: 28, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center' },
  sub: { color: colors.fgMuted, fontSize: 15, marginTop: 10 },

  dots: { flexDirection: 'row', gap: 16, marginTop: 46 },
  dot: { width: 15, height: 15, borderRadius: 8, borderWidth: 1.5, borderColor: colors.borderStrong },
  dotFilled: { backgroundColor: SILVER, borderColor: SILVER },
  dotActive: { borderColor: SILVER },

  pad: { marginTop: 'auto', flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 24 },
  key: { width: '33.33%', alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  keyText: { color: colors.fg, fontSize: 30, fontWeight: '500' },
});
