import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { PressScale } from '../components/PressScale';
import { XBadge } from '../components/XBadge';
import { ActivityFeed } from '../components/ActivityFeed';
import { GlassFill } from '../components/GlassFill';
import { colors, radius } from '../src/theme';
import { getLeaderboard, type LeaderEntry } from '../src/demo/traders';
import { shareText } from '../src/share';
import type { PulseBundle } from '../src/types';

const RANGES = ['24h', '7d', '30d', 'All'];
const MEDALS = ['#E3B321', '#B7C0CC', '#C57B3A'];
type SocialView = 'activity' | 'leaderboard';

/* ---- formatters (no Intl — Hermes-safe) ---- */
const group = (int: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
function usd(n: number, dec = 2): string {
  const [i, f] = Math.abs(n).toFixed(dec).split('.');
  return `$${group(i)}${f ? '.' + f : ''}`;
}
const avatarUri = (h: string) => `https://api.dicebear.com/9.x/avataaars/png?seed=${encodeURIComponent(h)}&size=96`;

export function SocialScreen({
  onOpenTrader,
  onOpenToken,
}: {
  onOpenTrader: (t: { handle: string; name: string; color: string; initial: string }) => void;
  onOpenToken: (b: PulseBundle) => void;
}) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<SocialView>('activity');
  const [range, setRange] = useState(0);
  const rows = useMemo(() => getLeaderboard(range, 'today'), [range]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 10 }]} showsVerticalScrollIndicator={false}>
        <View style={s.titleRow}>
          <Text style={s.title}>Social</Text>
          <PressScale
            onPress={() => shareText('🏆 Top traders on Pointer — copy their trades, half your fees back.', 'https://pointer-ton-orcin.vercel.app')}
            to={0.85}
            hitSlop={8}
            style={s.shareBtn}
          >
            <GlassFill />
            <Ionicons name="share-outline" size={20} color={colors.fgSecondary} />
          </PressScale>
        </View>

        <View style={s.tabsRow}>
          {(['activity', 'leaderboard'] as SocialView[]).map((v) => (
            <PressScale key={v} onPress={() => setView(v)} to={0.96} style={[s.tab, view === v && s.tabOn]}>
              <GlassFill active={view === v} />
              <Ionicons
                name={v === 'activity' ? 'pulse-outline' : 'trophy-outline'}
                size={15}
                color={view === v ? colors.fg : colors.fgMuted}
              />
              <Text style={[s.tabText, view === v && s.tabTextOn]}>{v === 'activity' ? 'Activity' : 'Leaderboard'}</Text>
            </PressScale>
          ))}
        </View>

        {view === 'activity' ? (
          <ActivityFeed onOpenToken={onOpenToken} onOpenTrader={onOpenTrader} />
        ) : (
          <>
            <View style={s.rankCard}>
              <GlassFill />
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
              <View style={s.sectionHead}>
                <View style={s.sectionBar} />
                <Text style={s.section}>Top traders</Text>
              </View>
              <View style={s.ranges}>
                {RANGES.map((r, i) => (
                  <PressScale key={r} onPress={() => setRange(i)} to={0.94} style={[s.range, i === range && s.rangeOn]}>
                    <Text style={[s.rangeText, i === range && s.rangeTextOn]}>{r}</Text>
                  </PressScale>
                ))}
              </View>
            </View>

            {rows.map((t) => (
              <TraderRow key={t.handle} t={t} onOpen={onOpenTrader} />
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function TraderRow({
  t,
  onOpen,
}: {
  t: LeaderEntry;
  onOpen: (x: { handle: string; name: string; color: string; initial: string }) => void;
}) {
  return (
    <PressScale
      onPress={() => onOpen({ handle: t.handle, name: t.name, color: t.color, initial: t.initial })}
      to={0.98}
      style={s.row}
    >
      <View style={s.rankBox}>
        {t.rank <= 3 ? (
          <View style={[s.medal, { backgroundColor: MEDALS[t.rank - 1] }]}>
            <Text style={s.medalText}>{t.rank}</Text>
          </View>
        ) : (
          <Text style={s.rankNum}>{t.rank}</Text>
        )}
      </View>

      <Image source={{ uri: avatarUri(t.handle) }} style={[s.avatar, { backgroundColor: t.color }]} />

      <View style={{ flex: 1 }}>
        <View style={s.nameRow}>
          <Text style={s.name} numberOfLines={1}>
            {t.name}
          </Text>
          {t.xConnected ? <XBadge size={16} /> : null}
        </View>
        <Text style={s.handle} numberOfLines={1}>
          {t.handle}
        </Text>
        <View style={s.holdings}>
          {t.holdings.map((h, i) => (
            <View key={i} style={[s.holding, { backgroundColor: h.color, marginLeft: i ? -7 : 0 }]}>
              <Text style={s.holdingInitial}>{h.initial}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={s.pnl}>+{usd(t.periodPnl)}</Text>
    </PressScale>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 130 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.fg, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  shareBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },

  tabsRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  tabOn: { borderColor: 'rgba(255,255,255,0.28)' },
  tabText: { color: colors.fgMuted, fontSize: 14, fontWeight: '700' },
  tabTextOn: { color: colors.fg },

  rankCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: 16, marginTop: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionBar: { width: 3, height: 16, borderRadius: 2, backgroundColor: colors.accent },
  you: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8732A', alignItems: 'center', justifyContent: 'center' },
  youInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
  rankLabel: { color: colors.fgMuted, fontSize: 13 },
  rankValue: { color: colors.accentGlow, fontSize: 18, fontWeight: '700', marginTop: 2 },
  rankPnl: { color: colors.fg, fontSize: 20, fontWeight: '700' },

  rangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 6 },
  section: { color: colors.fg, fontSize: 17, fontWeight: '700' },
  ranges: { flexDirection: 'row', gap: 4 },
  range: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.sm },
  rangeOn: { backgroundColor: colors.bgRaised2 },
  rangeText: { color: colors.fgMuted, fontSize: 13, fontWeight: '600' },
  rangeTextOn: { color: colors.fg },

  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  rankBox: { width: 24, alignItems: 'center' },
  medal: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  medalText: { color: '#1A1A1A', fontSize: 12, fontWeight: '800' },
  rankNum: { color: colors.fgMuted, fontSize: 15, fontWeight: '700' },
  avatar: { width: 46, height: 46, borderRadius: 23 },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.fg, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  handle: { color: colors.fgMuted, fontSize: 13, marginTop: 1 },
  holdings: { flexDirection: 'row', marginTop: 6 },
  holding: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.bg },
  holdingInitial: { color: '#fff', fontSize: 9, fontWeight: '800' },

  pnl: { color: colors.bull, fontSize: 17, fontWeight: '800' },
});
