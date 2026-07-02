import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Linking, PanResponder, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { PressScale } from '../components/PressScale';
import { colors, radius } from '../src/theme';

/**
 * Education — short lesson videos (Invo-style cards: thumbnail + play, title, date,
 * duration). Tapping a card opens its YouTube video. Placeholder thumbnails + URLs
 * for now; the founder swaps in the real video links. Opens with a slide-in.
 */
type Lesson = { id: string; title: string; date: string; mins: string; tint: [string, string]; url: string };

// Placeholder YouTube URLs — swap for the real lesson videos.
const LESSONS: Lesson[] = [
  { id: 'why', title: 'Why Pointer Exists', date: 'Jul 2, 2026', mins: '1 Min', tint: ['#0E3B30', '#000000'], url: 'https://www.youtube.com/' },
  { id: 'overview', title: 'Feature Overview', date: 'Jul 2, 2026', mins: '2 Min', tint: ['#0C2E3B', '#000000'], url: 'https://www.youtube.com/' },
  { id: 'copy', title: 'Copy Trading 101', date: 'Jul 2, 2026', mins: '3 Min', tint: ['#1B2E12', '#000000'], url: 'https://www.youtube.com/' },
  { id: 'deposit', title: 'Deposit USDC', date: 'Jul 2, 2026', mins: '1 Min', tint: ['#10233B', '#000000'], url: 'https://www.youtube.com/' },
  { id: 'ai', title: 'Reading the AI Verdict', date: 'Jul 2, 2026', mins: '2 Min', tint: ['#241033', '#000000'], url: 'https://www.youtube.com/' },
];

export function EducationScreen({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const W = Dimensions.get('window').width;
  const tx = useRef(new Animated.Value(W)).current;

  useEffect(() => {
    Animated.timing(tx, { toValue: 0, duration: 270, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [tx]);

  const close = useRef(onClose);
  close.current = onClose;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx > 12 && g.dx > Math.abs(g.dy) * 1.6,
      onPanResponderMove: (_, g) => {
        if (g.dx > 0) tx.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > 90 || g.vx > 0.4) {
          Animated.timing(tx, { toValue: W, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(
            ({ finished }) => finished && close.current(),
          );
        } else {
          Animated.spring(tx, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 3 }).start();
        }
      },
    }),
  ).current;

  const openVideo = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Screen>
      <Animated.View {...pan.panHandlers} style={{ flex: 1, transform: [{ translateX: tx }] }}>
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <PressScale onPress={onClose} to={0.85} hitSlop={10} style={s.back}>
            <Ionicons name="chevron-back" size={26} color={colors.fgSecondary} />
          </PressScale>
          <Text style={s.title}>Education</Text>
          <View style={s.back} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 40, paddingTop: 10 }}
          showsVerticalScrollIndicator={false}
        >
          {LESSONS.map((l) => (
            <PressScale key={l.id} to={0.98} style={s.card} onPress={() => openVideo(l.url)}>
              <LinearGradient colors={l.tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.thumb}>
                <View style={s.play}>
                  <Ionicons name="play" size={26} color={colors.onAccent} style={{ marginLeft: 3 }} />
                </View>
              </LinearGradient>
              <Text style={s.cardTitle}>{l.title}</Text>
              <View style={s.metaRow}>
                <Text style={s.meta}>{l.date}</Text>
                <View style={s.dot} />
                <Text style={s.meta}>{l.mins}</Text>
                <View style={{ flex: 1 }} />
                <Ionicons name="logo-youtube" size={17} color={colors.bear} />
              </View>
            </PressScale>
          ))}
        </ScrollView>
      </Animated.View>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10 },
  back: { width: 40, alignItems: 'flex-start' },
  title: { color: colors.fg, fontSize: 18, fontWeight: '700' },

  card: { backgroundColor: colors.bgRaised, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 12, marginTop: 16 },
  thumb: { height: 180, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  play: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.fg, fontSize: 20, fontWeight: '700', marginTop: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 6, marginBottom: 2 },
  meta: { color: colors.fgMuted, fontSize: 13.5 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.fgFaint },
});
