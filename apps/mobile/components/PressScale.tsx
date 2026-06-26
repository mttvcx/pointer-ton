import React, { useRef } from 'react';
import { Animated, Pressable, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Tap feedback — spring scale-down on press, spring back on release. Uses the
 * native driver so it runs on the UI thread (smooth even in Expo Go). The fuller
 * 120fps gesture motion arrives with Reanimated in the EAS dev build.
 */
export function PressScale({
  children,
  onPress,
  style,
  to = 0.96,
  hitSlop,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  to?: number;
  hitSlop?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop}
      onPressIn={() => Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 50, bounciness: 0 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 7 }).start()}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
