import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Thin circular progress ring with a centered label (e.g. "2/4"). Silver track +
 * a metallic progress arc, so it reads with the finance section's identity. The
 * arc animates to its value on mount / whenever `progress` changes.
 */
export function ProgressRing({
  progress,
  size = 46,
  stroke = 4,
  track = 'rgba(199,204,209,0.20)',
  tint = '#D2D8DE',
  children,
}: {
  progress: number; // 0..1
  size?: number;
  stroke?: number;
  track?: string;
  tint?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: clamped, duration: 650, useNativeDriver: true }).start();
  }, [clamped]);

  const dashoffset = anim.interpolate({ inputRange: [0, 1], outputRange: [c, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tint}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dashoffset}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Convenience: a ring with "done/total" text baked in the middle. */
export function StepRing({ done, total, size = 46 }: { done: number; total: number; size?: number }) {
  return (
    <ProgressRing progress={total > 0 ? done / total : 0} size={size}>
      <Text style={{ color: '#EDF0F3', fontSize: size * 0.3, fontWeight: '800' }}>
        {done}
        <Text style={{ color: 'rgba(199,204,209,0.6)', fontSize: size * 0.24 }}>/{total}</Text>
      </Text>
    </ProgressRing>
  );
}
