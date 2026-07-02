import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PressScale } from './PressScale';
import { GlassFill } from './GlassFill';
import { colors } from '../src/theme';

/**
 * Glass "$" header button that opens the referral screen — with a light-shine
 * sweeping across the dollar glyph on a loop to draw the eye ("you can earn here").
 */
export function ReferralButton({ onPress }: { onPress: () => void }) {
  const x = useRef(new Animated.Value(-24)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: 52, duration: 850, useNativeDriver: true }),
        Animated.delay(1700),
        Animated.timing(x, { toValue: -24, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [x]);

  return (
    <PressScale onPress={onPress} to={0.85} hitSlop={8} style={s.btn}>
      <GlassFill />
      <Text style={s.glyph}>$</Text>
      <Animated.View pointerEvents="none" style={[s.shineWrap, { transform: [{ translateX: x }, { skewX: '-18deg' }] }]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </PressScale>
  );
}

const s = StyleSheet.create({
  btn: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  glyph: { color: colors.accentGlow, fontSize: 21, fontWeight: '700' },
  shineWrap: { position: 'absolute', top: -8, left: 0, width: 13, height: 56 },
});
