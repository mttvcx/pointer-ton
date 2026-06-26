import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '../components/Logo';
import { GoogleIcon } from '../components/GoogleIcon';
import { PressScale } from '../components/PressScale';

// Founder's grass + sky background — the image IS the screen container.
const BG = require('../assets/scene/login-field.png');

// Founder's 3D coins (transparent PNGs, 1024x1536 → height ≈ width * 1.5).
const COINS = {
  solana: require('../assets/crypto/sol.png'),
  bnb: require('../assets/crypto/bnb.png'),
  ethereum: require('../assets/crypto/eth.png'),
  base: require('../assets/crypto/base.png'),
} as const;

type Float = {
  coin: keyof typeof COINS;
  w: number;
  drift: number;
  dur: number;
  from: 'top' | 'bottom' | 'left' | 'right';
  enterDelay: number;
  blur?: number;
  pos: { top?: number | string; bottom?: number | string; left?: number | string; right?: number | string };
};

// FOMO layout + the founder's slide-in choreography (each coin enters from its
// own edge after the wordmark appears). Then the coins drift at a turtle pace.
const FLOATS: Float[] = [
  { coin: 'solana', w: 206, drift: 6, dur: 12000, from: 'top', enterDelay: 560, blur: 6, pos: { top: '3%', left: -48 } },
  { coin: 'bnb', w: 330, drift: 5, dur: 15000, from: 'left', enterDelay: 680, blur: 11, pos: { top: '-8%', right: -118 } },
  { coin: 'base', w: 246, drift: 6, dur: 13000, from: 'left', enterDelay: 800, blur: 6, pos: { top: '41%', left: -130 } },
  { coin: 'ethereum', w: 260, drift: 7, dur: 14000, from: 'bottom', enterDelay: 920, blur: 6, pos: { top: '39%', right: -100 } },
];

const SLIDE = 130;

function FloatingCoin({ f }: { f: Float }) {
  const enter = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 660, delay: f.enterDelay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      // gentle turtle drift begins once the coin has slid into place
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(sway, { toValue: 1, duration: f.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
          Animated.timing(sway, { toValue: 0, duration: f.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
        ]),
      );
      loop.start();
    });
  }, []);

  const slide = (offset: number) => enter.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] });
  const slideX = f.from === 'left' ? slide(-SLIDE) : f.from === 'right' ? slide(SLIDE) : 0;
  const slideY = f.from === 'top' ? slide(-SLIDE) : f.from === 'bottom' ? slide(SLIDE) : 0;
  const swayY = sway.interpolate({ inputRange: [0, 1], outputRange: [f.drift, -f.drift] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', width: f.w, height: f.w * 1.5, zIndex: 3 },
        f.pos as object,
        { opacity: enter, transform: [{ translateX: slideX }, { translateY: slideY }, { translateY: swayY }] },
      ]}
    >
      <Image source={COINS[f.coin]} style={{ width: f.w, height: f.w * 1.5 }} resizeMode="contain" blurRadius={f.blur} />
    </Animated.View>
  );
}

export function LoginScreen({ onEnter }: { onEnter: () => void }) {
  const insets = useSafeAreaInsets();
  const brand = useRef(new Animated.Value(0)).current; // wordmark + bird appear first
  const foot = useRef(new Animated.Value(0)).current; // subtext + buttons fade in last

  useEffect(() => {
    Animated.timing(brand, { toValue: 1, duration: 480, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    // fade the bottom in once the coins have settled (~1.6s), over ~0.9s
    Animated.timing(foot, { toValue: 1, duration: 900, delay: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, []);

  const brandRise = brand.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <ImageBackground source={BG} resizeMode="cover" style={s.root}>
      <StatusBar style="dark" />
      {FLOATS.map((f, i) => (
        <FloatingCoin key={i} f={f} />
      ))}

      <View style={[s.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 22 }]}>
        <Animated.View style={[s.brand, { opacity: brand, transform: [{ translateY: brandRise }] }]}>
          <Logo size={122} style={s.logo} />
          <Text style={s.wordmark}>pointer.</Text>
        </Animated.View>

        <Animated.Text style={[s.tagline, { opacity: foot }]}>Trade anything with{'\n'}the best edge.</Animated.Text>

        <Animated.View style={[s.actions, { opacity: foot }]}>
          <PressScale style={s.apple} onPress={onEnter}>
            <Ionicons name="logo-apple" size={24} color="#000" />
            <Text style={s.appleText}>Sign in with Apple</Text>
          </PressScale>
          <PressScale style={s.google} onPress={onEnter}>
            <GoogleIcon size={22} />
            <Text style={s.googleText}>Sign in with Google</Text>
          </PressScale>
          <Text style={s.terms}>By signing up, you agree to our Terms of Service and Privacy Policy.</Text>
        </Animated.View>
      </View>
    </ImageBackground>
  );
}

// White branding. Wordmark + subtext have no shadow (founder's call); the tiny
// terms text keeps a soft shadow so it stays legible over the grass.
const darkShadow = { textShadowColor: 'rgba(0,0,0,0.42)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 1 } } as const;

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 22, zIndex: 5 },
  brand: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 36 },
  logo: { tintColor: '#fff', marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } },
  wordmark: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 72, letterSpacing: -2.4 },
  tagline: { color: '#fff', fontFamily: 'Inter_500Medium', fontSize: 24, textAlign: 'center', marginBottom: 20, lineHeight: 31 },
  actions: { gap: 12 },
  apple: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 17, shadowColor: '#0A1622', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 7 } },
  appleText: { color: '#000', fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  google: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#11161D', borderRadius: 16, paddingVertical: 17, shadowColor: '#0A1622', shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 7 } },
  googleText: { color: '#fff', fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  terms: { color: 'rgba(255,255,255,0.96)', fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 17, paddingHorizontal: 20, fontFamily: 'Inter_500Medium', ...darkShadow },
});
