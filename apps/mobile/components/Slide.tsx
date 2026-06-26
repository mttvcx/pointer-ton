import React, { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Animated step wrapper — fades + slides in on mount. Give it a changing `key`
 * (e.g. the step index) so each step animates instead of hard-cutting. `dir`
 * controls slide direction: 1 = in from right (forward), -1 = from left (back).
 */
export function Slide({ dir = 1, children, style }: { dir?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const x = useRef(new Animated.Value(dir * 26)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(x, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 2 }),
    ]).start();
  }, []);
  return <Animated.View style={[style, { opacity, transform: [{ translateX: x }] }]}>{children}</Animated.View>;
}
