import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { PressScale } from '../components/PressScale';
import { XBadge } from '../components/XBadge';
import { colors, radius } from '../src/theme';
import { getLeaderboard, type LeaderEntry } from '../src/demo/traders';
import { shareText } from '../src/share';

const RANGES = ['24h', '7d', '30d', 'All'];
const MEDALS = ['#E3B321', '#B7C0CC', '#C57B3A'];

/* ---- formatters (no Intl — Hermes-safe) ---- */
const group = (int: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
function usd(n: number, dec = 2): string {
  const neg = n < 0;
  const [i, f] = Math.abs(n).toFixed(dec).split('.');
  return `${neg ? '-' : ''}$${group(i)}${f ? '.' + f : ''}`;
}
function compactUsd(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `$${(a / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (a >= 1e3) return `$${(a / 1e3).toFixed(0)}K`;
  return `$${Math.round(a)}`;
}
const avatarUri = (h: string) => `https://api.dicebear.com/9.x/avataaars/png?seed=${encodeURIComponent(h)}&size=96`;

export function SocialScreen({
  onOpenTrader,
}: {
  onOpenTrader: (t: { handle: string; name: string; color: string; initial: string }) => void;
}) {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState(0);
  const [sort, setSort] = useState<'today' | 'net'>('today');
  const rows = useMemo(() => getLeaderboard(range, sort), [range, sort]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 10 }]} showsVerticalScrollIndicator={false}>
        <View style={s.titleRow}>
          <Text style={s.title}>Leaderboard</Text>
          <PressScale
            onPress={() =>
              shareText('🏆 Top traders on Pointer — half your fees back, real P&L. Catch the board.', 'https://pointer-ton-orcin.vercel.app')
            }
            to={0.85}
            hitSlop={8}
            style={s.shareBtn}
          >
            <Ionicons name="share-outline" size={20} color={colors.fgSecondary} />
          </PressScale>
        </View>

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

        {/* period + honest sort */}
        <View style={s.controls}>
          <View style={s.ranges}>
            {RANGES.map((r, i) => (
              <PressScale key={r} onPress={() => setRange(i)} to={0.94} style={[s.range, i === range && s.rangeOn]}>
                <Text style={[s.rangeText, i === range && s.rangeTextOn]}>{r}</Text>
              </PressScale>
            ))}
          </View>
          <View style={s.sortToggle}>
            <PressScale onPress={() => setSort('today')} to={0.95} style={[s.sortBtn, sort === 'today' && s.sortBtnOn]}>
              <Text style={[s.sortText, sort === 'today' && s.sortTextOn]}>Today</Text>
            </PressScale>
            <PressScale onPress={() => setSort('net')} to={0.95} style={[s.sortBtn, sort === 'net' && s.sortBtnOn]}>
              <Text style={[s.sortText, sort === 'net' && s.sortTextOn]}>Net</Text>
            </PressScale>
          </View>
        </View>

        <Text style={s.caption}>
          {sort === 'today'
            ? `Ranked by ${RANGES[range]} gain. Tap “Net” for true unrealized P&L —`
            : 'Ranked by true unrealized P&L (up or down) — no pump psyop.'}
          {sort === 'today' ? <Text style={s.captionEm}> not a pump psyop.</Text> : null}
        </Text>

        {rows.map((t) => (
          <TraderRow key={t.handle} t={t} range={range} onOpen={onOpenTrader} />
        ))}
      </ScrollView>
    </Screen>
  );
}

function TraderRow({
  t,
  range,
  onOpen,
}: {
  t: LeaderEntry;
  range: number;
  onOpen: (x: { handle: string; name: string; color: string; initial: string }) => void;
}) {
  const down = t.netUPnl < 0;
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

      <View style={s.right}>
        <Text style={s.pnl}>+{usd(t.periodPnl)}</Text>
        <View style={[s.uChip, down ? s.uChipDown : s.uChipUp]}>
          <Ionicons name={down ? 'arrow-down' : 'arrow-up'} size={10} color={down ? colors.bear : colors.bull} />
          <Text style={[s.uText, { color: down ? colors.bear : colors.bull }]}>
            {down ? `${compactUsd(t.toBreakEven)} to break even` : `${compactUsd(t.netUPnl)} up`}
          </Text>
        </View>
      </View>
    </PressScale>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 130 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.fg, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  shareBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgRaised },

  rankCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bgRaised, borderRadius: radius.lg, padding: 16, marginTop: 16 },
  you: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8732A', alignItems: 'center', justifyContent: 'center' },
  youInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
  rankLabel: { color: colors.fgMuted, fontSize: 13 },
  rankValue: { color: colors.accentGlow, fontSize: 18, fontWeight: '700', marginTop: 2 },
  rankPnl: { color: colors.fg, fontSize: 20, fontWeight: '700' },

  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 6 },
  ranges: { flexDirection: 'row', gap: 4 },
  range: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.sm },
  rangeOn: { backgroundColor: colors.bgRaised2 },
  rangeText: { color: colors.fgMuted, fontSize: 13, fontWeight: '600' },
  rangeTextOn: { color: colors.fg },
  sortToggle: { flexDirection: 'row', backgroundColor: colors.bgRaised, borderRadius: radius.pill, padding: 3 },
  sortBtn: { paddingHorizontal: 13, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  sortBtnOn: { backgroundColor: colors.bgRaised2 },
  sortText: { color: colors.fgMuted, fontSize: 13, fontWeight: '700' },
  sortTextOn: { color: colors.fg },

  caption: { color: colors.fgFaint, fontSize: 12, lineHeight: 17, marginBottom: 8 },
  captionEm: { color: colors.fgMuted, fontWeight: '700' },

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

  right: { alignItems: 'flex-end', gap: 5 },
  pnl: { color: colors.bull, fontSize: 17, fontWeight: '800' },
  uChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.sm },
  uChipUp: { backgroundColor: colors.bullSoft },
  uChipDown: { backgroundColor: colors.bearSoft },
  uText: { fontSize: 11, fontWeight: '700' },
});
