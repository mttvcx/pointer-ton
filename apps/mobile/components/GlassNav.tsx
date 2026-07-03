import React, { useEffect, useRef, useState } from 'react';
import { Animated, type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Logo } from './Logo';
import { colors } from '../src/theme';

// iOS 26 Liquid Glass (expo-glass-effect), loaded optionally with a blur fallback.
let GlassView: React.ComponentType<any> | null = null;
let liquid = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ge = require('expo-glass-effect');
  GlassView = ge.GlassView ?? null;
  liquid = typeof ge.isLiquidGlassAvailable === 'function' ? ge.isLiquidGlassAvailable() : false;
} catch {
  liquid = false;
}

export type NavTab = 'home' | 'search' | 'financial' | 'social' | 'profile';

// Slot order: 0 home · 1 search · 2 brand(Adv) · 3 financial(card) · 4 social · 5 profile.
const SLOT_OF: Record<NavTab, number> = { home: 0, search: 1, financial: 3, social: 4, profile: 5 };
const SLOTS = 6;
const HEIGHT = 64;
const SEL_H = 58;

export function GlassNav({
  active,
  onSelect,
  bottom,
  advanced,
  onToggleAdvanced,
}: {
  active: NavTab;
  onSelect: (t: NavTab) => void;
  bottom: number;
  advanced: boolean;
  onToggleAdvanced: () => void;
}) {
  const [w, setW] = useState(0);
  const tx = useRef(new Animated.Value(0)).current;
  const cell = w / SLOTS;
  const slot = SLOT_OF[active];

  useEffect(() => {
    if (!w) return;
    Animated.spring(tx, { toValue: slot * cell, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
  }, [slot, w]);

  const color = (t: NavTab) => (active === t ? '#fff' : colors.fgMuted);

  const inner = (
    <>
      {w > 0 ? (
        <Animated.View style={[s.sel, { width: cell, transform: [{ translateX: tx }] }]} pointerEvents="none">
          {liquid && GlassView ? (
            <GlassView glassEffectStyle="regular" tintColor="rgba(150,158,172,0.18)" style={s.selGlass} />
          ) : (
            <View style={s.selFill} />
          )}
        </Animated.View>
      ) : null}

      <Slot onPress={() => onSelect('home')}>
        <Ionicons name="home" size={23} color={color('home')} />
      </Slot>
      <Slot onPress={() => onSelect('search')}>
        <Ionicons name="search" size={23} color={color('search')} />
      </Slot>
      <Slot onPress={onToggleAdvanced}>
        <View style={[s.center, advanced && s.centerOn]}>
          <Logo size={56} style={{ tintColor: advanced ? colors.accent : colors.fgMuted }} />
          <Text style={[s.advExp, { color: advanced ? colors.accentGlow : colors.fgSecondary }]}>Adv.</Text>
        </View>
      </Slot>
      <Slot onPress={() => onSelect('financial')}>
        <Ionicons name={active === 'financial' ? 'card' : 'card-outline'} size={23} color={color('financial')} />
      </Slot>
      <Slot onPress={() => onSelect('social')}>
        <Ionicons name={advanced ? 'notifications' : 'people'} size={23} color={color('social')} />
      </Slot>
      <Slot onPress={() => onSelect('profile')}>
        <View style={s.profile}>
          <Logo size={15} />
        </View>
      </Slot>
    </>
  );

  return (
    <View style={[s.wrap, { bottom }]} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {liquid && GlassView ? (
        <GlassView glassEffectStyle="regular" style={s.island}>
          {inner}
        </GlassView>
      ) : (
        <View style={[s.island, s.fallback]}>
          <BlurView intensity={72} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={s.frost} pointerEvents="none" />
          {inner}
        </View>
      )}
    </View>
  );
}

function Slot({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable style={s.slot} onPress={onPress} hitSlop={6}>
      {children}
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14, height: HEIGHT },
  island: {
    flex: 1,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fallback: { backgroundColor: 'transparent' },
  frost: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13,16,22,0.22)' },
  slot: { flex: 1, height: HEIGHT, alignItems: 'center', justifyContent: 'center' },
  sel: { position: 'absolute', left: 0, top: (HEIGHT - SEL_H) / 2, height: SEL_H },
  selGlass: {
    flex: 1,
    borderRadius: SEL_H / 2,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  selFill: {
    flex: 1,
    borderRadius: SEL_H / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  center: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  centerOn: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  advExp: { position: 'absolute', top: 3, right: 3, color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: -0.2, textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 3 },
  profile: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
});
