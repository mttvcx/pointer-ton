import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

// Deterministic faint star field (no Math.random so positions don't flicker).
const hash = (n: number) => {
  const x = Math.sin(n) * 43758.5453;
  return x - Math.floor(x);
};
const STARS = Array.from({ length: 28 }, (_, i) => ({
  left: `${(hash(i + 1) * 100).toFixed(2)}%`,
  top: `${(hash(i + 11) * 64).toFixed(2)}%`,
  size: 1 + hash(i + 3) * 1.7,
  op: 0.1 + hash(i + 5) * 0.32,
}));

function Blob({
  color,
  size,
  top,
  left,
  drift,
  dur,
  delay,
  opacity,
}: {
  color: string;
  size: number;
  top: number;
  left: number;
  drift: number;
  dur: number;
  delay: number;
  opacity: number;
}) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: dur, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const tx = a.interpolate({ inputRange: [0, 1], outputRange: [-drift, drift] });
  const ty = a.interpolate({ inputRange: [0, 1], outputRange: [drift * 0.5, -drift * 0.5] });
  const id = `aurora-${color.replace('#', '')}`;
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, top, left, opacity, transform: [{ translateX: tx }, { translateY: ty }] }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity="0.9" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

export function AuroraBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#0A0E1A', '#05070E', '#04050A']} style={StyleSheet.absoluteFill} />
      {STARS.map((st, i) => (
        <View
          key={i}
          style={{ position: 'absolute', left: st.left as `${number}%`, top: st.top as `${number}%`, width: st.size, height: st.size, borderRadius: st.size / 2, backgroundColor: '#fff', opacity: st.op }}
        />
      ))}
      <Blob color="#9945FF" size={430} top={400} left={-130} drift={26} dur={9000} delay={0} opacity={0.5} />
      <Blob color="#00A3E0" size={470} top={470} left={70} drift={22} dur={11000} delay={800} opacity={0.45} />
      <Blob color="#14F195" size={380} top={540} left={220} drift={30} dur={10000} delay={400} opacity={0.38} />
    </View>
  );
}
