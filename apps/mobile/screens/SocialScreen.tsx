import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { PressScale } from '../components/PressScale';
import { colors, radius } from '../src/theme';
import { toggleFollow, useIsFollowing } from '../src/local';
import { LEADERBOARD } from '../src/demo';

type Trader = (typeof LEADERBOARD)[number];

const RANGES = ['24h', '7d', '30d', 'All'];
const MEDALS = ['#E3B321', '#B7C0CC', '#C57B3A'];

export function SocialScreen() {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState(0);

  return (
    <Screen>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 10 }]} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Leaderboard</Text>

        <View style={s.rankCard}>
          <View style={s.you}>
            <Text style={s.youInitial}>P</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.rankLabel}>Your rank</Text>
            <Text style={s.rankValue}>#—</Text>
          </View>
          <Text style={s.rankPnl}>$0</Text>
        </View>

        <View style={s.rangeRow}>
          <Text style={s.section}>Top traders</Text>
          <View style={s.ranges}>
            {RANGES.map((r, i) => (
              <PressScale key={r} onPress={() => setRange(i)} to={0.94} style={[s.range, i === range && s.rangeOn]}>
                <Text style={[s.rangeText, i === range && s.rangeTextOn]}>{r}</Text>
              </PressScale>
            ))}
          </View>
        </View>

        {LEADERBOARD.map((t) => (
          <TraderRow key={t.handle} t={t} />
        ))}
      </ScrollView>
    </Screen>
  );
}

function TraderRow({ t }: { t: Trader }) {
  const following = useIsFollowing(t.handle);
  return (
    <View style={s.row}>
      <View style={s.rankBox}>
        {t.rank <= 3 ? (
          <View style={[s.medal, { backgroundColor: MEDALS[t.rank - 1] }]}>
            <Text style={s.medalText}>{t.rank}</Text>
          </View>
        ) : (
          <Text style={s.rankNum}>{t.rank}</Text>
        )}
      </View>
      <View style={[s.avatar, { backgroundColor: t.color }]}>
        <Text style={s.avatarText}>{t.initial}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.name} numberOfLines={1}>{t.name}</Text>
        <Text style={s.handle}>{t.handle}</Text>
      </View>
      <Text style={s.pnl}>{t.pnl}</Text>
      <PressScale onPress={() => toggleFollow(t.handle)} to={0.88} hitSlop={6} style={[s.followBtn, following && s.followingBtn]}>
        <Ionicons name={following ? 'checkmark' : 'add'} size={15} color={following ? colors.bull : colors.fg} />
        <Text style={[s.followText, following && { color: colors.bull }]}>{following ? 'Following' : 'Follow'}</Text>
      </PressScale>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 130 },
  title: { color: colors.fg, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  rankCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bgRaised, borderRadius: radius.lg, padding: 16, marginTop: 16 },
  you: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8732A', alignItems: 'center', justifyContent: 'center' },
  youInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
  rankLabel: { color: colors.fgMuted, fontSize: 13 },
  rankValue: { color: colors.accentGlow, fontSize: 18, fontWeight: '600', marginTop: 2 },
  rankPnl: { color: colors.fg, fontSize: 20, fontWeight: '700' },
  rangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 4 },
  section: { color: colors.fg, fontSize: 17, fontWeight: '600' },
  ranges: { flexDirection: 'row', gap: 4 },
  range: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm },
  rangeOn: { backgroundColor: colors.bgRaised2 },
  rangeText: { color: colors.fgMuted, fontSize: 13 },
  rangeTextOn: { color: colors.fg, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.bgRaised2, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  followingBtn: { backgroundColor: colors.accentSoft },
  followText: { color: colors.fg, fontSize: 12, fontWeight: '600' },
  rankBox: { width: 26, alignItems: 'center' },
  medal: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  medalText: { color: '#1A1A1A', fontSize: 12, fontWeight: '700' },
  rankNum: { color: colors.fgMuted, fontSize: 15, fontWeight: '600' },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  name: { color: colors.fg, fontSize: 16, fontWeight: '600' },
  handle: { color: colors.fgMuted, fontSize: 13, marginTop: 1 },
  pnl: { color: colors.bull, fontSize: 16, fontWeight: '600' },
});
