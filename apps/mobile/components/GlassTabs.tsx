import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radius } from '../src/theme';

// iOS 26 Liquid Glass (expo-glass-effect), loaded optionally with a blur fallback.
// Mirrors the require/try pattern in GlassNav so both stay visually cohesive.
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

export type GlassTab = { key: string; label: string; count?: number; accent?: string };

const HEIGHT = 44;
const PAD = 4;
const SEL_H = HEIGHT - PAD * 2;

export function GlassTabs({
  tabs,
  activeIndex,
  onChange,
  style,
}: {
  tabs: GlassTab[];
  activeIndex: number;
  onChange: (index: number) => void;
  style?: ViewStyle;
}) {
  const [w, setW] = useState(0);
  const tx = useRef(new Animated.Value(0)).current;
  const n = Math.max(tabs.length, 1);
  // Track width excludes the symmetric inner padding so cells span edge-to-edge.
  const cell = w > 0 ? (w - PAD * 2) / n : 0;
  const clamped = Math.min(Math.max(activeIndex, 0), n - 1);

  useEffect(() => {
    if (!w) return;
    Animated.spring(tx, {
      toValue: clamped * cell,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [clamped, w, cell]);

  const inner = (
    <>
      {w > 0 ? (
        <Animated.View
          style={[s.sel, { width: cell, transform: [{ translateX: tx }] }]}
          pointerEvents="none"
        >
          {liquid && GlassView ? (
            <GlassView
              glassEffectStyle="regular"
              tintColor="rgba(150,158,172,0.18)"
              style={s.selGlass}
            />
          ) : (
            <View style={s.selFill} />
          )}
        </Animated.View>
      ) : null}

      {tabs.map((t, i) => {
        const isActive = i === clamped;
        const accent = t.accent ?? colors.accent;
        return (
          <Pressable
            key={t.key}
            style={s.tab}
            onPress={() => onChange(i)}
            hitSlop={6}
          >
            <Text
              style={[s.label, isActive ? s.labelOn : null]}
              numberOfLines={1}
            >
              {t.label}
            </Text>
            {typeof t.count === 'number' ? (
              <Text
                style={[
                  s.count,
                  { color: isActive ? accent : colors.fgFaint },
                ]}
                numberOfLines={1}
              >
                {t.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </>
  );

  return (
    <View
      style={[s.wrap, style]}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
    >
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

const s = StyleSheet.create({
  wrap: { height: HEIGHT },
  island: {
    flex: 1,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAD,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fallback: { backgroundColor: 'transparent' },
  frost: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13,16,22,0.22)' },
  tab: {
    flex: 1,
    height: SEL_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  sel: { position: 'absolute', left: PAD, top: PAD, height: SEL_H },
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
  label: {
    color: colors.fgMuted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  labelOn: { color: colors.fg },
  count: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
