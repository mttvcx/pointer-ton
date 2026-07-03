import React, { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Entrance wrapper — fades + rises up on mount, with an optional stagger `delay`.
 * The vertical sibling of <Slide/>. Native-driver (transform + opacity) so it stays
 * smooth. Use ascending delays on siblings for a premium cascade.
 */
export function Rise({
  delay = 0,
  from = 14,
  children,
  style,
}: {
  delay?: number;
  from?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(from)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay, useNativeDriver: true }),
      Animated.spring(y, { toValue: 0, delay, useNativeDriver: true, speed: 15, bounciness: 3 }),
    ]).start();
  }, []);
  return <Animated.View style={[style, { opacity, transform: [{ translateY: y }] }]}>{children}</Animated.View>;
}
