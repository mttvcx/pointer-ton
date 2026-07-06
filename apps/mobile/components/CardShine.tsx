import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const W = Dimensions.get('window').width;

/**
 * A metallic shine that sweeps diagonally across a card on a loop — the moving
 * reflection that sells the "premium card" look. Drop inside a card face that has
 * `overflow: 'hidden'`; it fills the parent and clips to its rounded corners.
 */
export function CardShine({ intensity = 0.28, period = 3200, delay = 2600 }: { intensity?: number; period?: number; delay?: number }) {
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: 1, duration: period, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(delay),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [period, delay, x]);

  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-W * 0.9, W * 0.9] });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]}>
      <Animated.View style={[styles.band, { transform: [{ translateX }, { rotate: '18deg' }] }]}>
        <LinearGradient
          colors={['transparent', `rgba(255,255,255,${intensity})`, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  band: { position: 'absolute', top: '-60%', bottom: '-60%', width: 90 },
});
