import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Tap feedback — spring scale-down on press, spring back on release. Uses the
 * native driver so it runs on the UI thread (smooth even in Expo Go). The fuller
 * 120fps gesture motion arrives with Reanimated in the EAS dev build.
 *
 * The visual box (bg/padding/radius) + the scale live on the inner Animated.View
 * so the whole box presses. But sizing props (flex/width/alignSelf) are ALSO
 * forwarded to the outer Pressable — otherwise a `flex: 1` only sized the inner
 * view and the touchable collapsed to its content (e.g. a keypad's three keys
 * bunching into "123"). Buttons without those props are unaffected.
 */
const SIZING_KEYS = [
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'width',
  'minWidth',
  'maxWidth',
] as const;

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

  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  for (const k of SIZING_KEYS) if (flat[k] != null) outer[k] = flat[k];

  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop}
      style={outer as ViewStyle}
      onPressIn={() => Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 50, bounciness: 0 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 7 }).start()}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
