import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { CoinIcon } from './CoinIcon';
import { PressScale } from './PressScale';
import { getPulseFeed } from '../src/api/endpoints';
import { ageShort, compactUsd, priceUsd, pseudoChange } from '../src/format';
import { colors, radius } from '../src/theme';
import type { PulseBundle, PulseColumn, PulseFeed } from '../src/types';

/**
 * OPERATOR PULSE BOARD — the Advanced-mode Home. The web terminal's three Pulse
 * columns (New / Stretch / Migrated) rebuilt for a phone as a "filing cabinet":
 * the active column is centered and full-width, with its neighbors PEEKING at the
 * edges like folder tabs. Swipe to switch. When a token alerts in an off-screen
 * column, that side's edge GLOWS (and the row outlines) so the operator can see
 * it without leaving the current column — opt-in "Auto-jump" scrolls there for you.
 */

const { width: SCREEN } = Dimensions.get('window');
const PEEK = 26; // px of each neighbor column visible at the edge (the folder tab)
const GAP = 10;
const COL_W = SCREEN - 2 * PEEK - 2 * GAP;
const PAGE = COL_W + GAP;
const SIDE = PEEK + GAP; // content padding so a snapped column sits centered

type ColDef = { key: PulseColumn; label: string; accent: string };
const COLS: ColDef[] = [
  { key: 'new', label: 'NEW', accent: colors.accent },
  { key: 'stretch', label: 'STRETCH', accent: colors.warn },
  { key: 'migrated', label: 'MIGRATED', accent: colors.bull },
];

type Alert = { col: number; mint: string; sym: string; key: number };

const compactNum = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
};

export function PulseBoard({ onOpenToken }: { onOpenToken: (b: PulseBundle) => void }) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [active, setActive] = useState(0);
  const [autoJump, setAutoJump] = useState(false);
  const [alert, setAlert] = useState<Alert | null>(null);

  const q = useQuery({
    queryKey: ['pulse-board', 'sol'],
    queryFn: async () => {
      const fetchCol = (c: PulseColumn) =>
        getPulseFeed(c, 'sol').catch(() => ({ items: [] } as unknown as PulseFeed));
      const [n, s, m] = await Promise.all(COLS.map((c) => fetchCol(c.key)));
      return [n.items ?? [], s.items ?? [], m.items ?? []] as PulseBundle[][];
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const data = q.data ?? [[], [], []];

  // Clear an alert once the operator lands on its column.
  useEffect(() => {
    if (alert && alert.col === active) setAlert(null);
  }, [active, alert]);

  // DEMO: periodically surface a cross-column alert so the folder-edge glow is
  // visible. Real wiring later: tracked-wallet buys / threshold crossings push here.
  const alertSeq = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      const candidates = COLS.map((_, i) => i).filter((i) => i !== active && data[i]?.length);
      if (!candidates.length) return;
      const col = candidates[alertSeq.current % candidates.length];
      const list = data[col];
      const b = list[alertSeq.current % list.length];
      alertSeq.current += 1;
      const sym = (b.token.symbol ?? '?').replace(/^\$/, '');
      setAlert({ col, mint: b.token.mint, sym, key: alertSeq.current });
      Vibration.vibrate(12);
      if (autoJump) scrollRef.current?.scrollTo({ x: col * PAGE, animated: true });
    }, 7000);
    return () => clearInterval(id);
  }, [active, autoJump, data]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / PAGE);
    if (i !== active) setActive(Math.max(0, Math.min(COLS.length - 1, i)));
  };

  const jumpTo = (i: number) => {
    setActive(i);
    scrollRef.current?.scrollTo({ x: i * PAGE, animated: true });
  };

  // One shared pulse loop drives every glow (folder edge + tab dot + row outline).
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 720, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 720, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  const alertSide = alert ? (alert.col < active ? 'left' : alert.col > active ? 'right' : null) : null;
  const alertAccent = alert ? COLS[alert.col].accent : colors.accent;

  return (
    <View style={[s.root, { paddingTop: insets.top + 6 }]}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.titleRow}>
          <Text style={s.title}>Pulse</Text>
          <View style={s.opBadge}>
            <Text style={s.opBadgeText}>OPERATOR</Text>
          </View>
        </View>
        <Pressable style={[s.autoBtn, autoJump && s.autoBtnOn]} onPress={() => setAutoJump((v) => !v)}>
          <Ionicons name="navigate" size={12} color={autoJump ? '#fff' : colors.fgMuted} />
          <Text style={[s.autoText, autoJump && s.autoTextOn]}>Auto-jump</Text>
        </Pressable>
      </View>

      {/* Persistent AI strip */}
      <View style={s.aiStrip}>
        <View style={s.aiDot} />
        <Text style={s.aiText} numberOfLines={1}>
          Pointer AI is scanning {data[0].length + data[1].length + data[2].length} live mints across the desk
        </Text>
        <Ionicons name="sparkles" size={13} color={colors.accentGlow} />
      </View>

      {/* Folder tabs — always see all three columns + where an alert fired */}
      <View style={s.tabs}>
        {COLS.map((c, i) => {
          const on = i === active;
          const alerted = alert?.col === i;
          return (
            <Pressable key={c.key} style={s.tab} onPress={() => jumpTo(i)}>
              <View style={[s.tabDot, { backgroundColor: c.accent, opacity: on ? 1 : 0.4 }]} />
              <Text style={[s.tabLabel, on && { color: colors.fg }]}>{c.label}</Text>
              <Text style={[s.tabCount, on && { color: c.accent }]}>{data[i].length}</Text>
              {alerted ? <Animated.View style={[s.tabAlert, { backgroundColor: c.accent, opacity: glow }]} /> : null}
            </Pressable>
          );
        })}
      </View>

      {/* Peeking carousel */}
      <View style={s.carouselWrap}>
        {q.isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
        ) : (
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToOffsets={COLS.map((_, i) => i * PAGE)}
            snapToAlignment="start"
            disableIntervalMomentum
            contentContainerStyle={{ paddingHorizontal: SIDE }}
            onMomentumScrollEnd={onMomentumEnd}
          >
            {COLS.map((c, i) => (
              <Column
                key={c.key}
                def={c}
                items={data[i]}
                dim={i !== active}
                alertMint={alert?.col === i ? alert.mint : null}
                glow={glow}
                onOpenToken={onOpenToken}
              />
            ))}
          </ScrollView>
        )}

        {/* Folder-edge glow toward an off-screen alert */}
        {alertSide === 'left' ? (
          <Animated.View style={[s.edge, s.edgeLeft, { opacity: glow }]} pointerEvents="none">
            <LinearGradient
              colors={[alertAccent + 'AA', alertAccent + '00']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}
        {alertSide === 'right' ? (
          <Animated.View style={[s.edge, s.edgeRight, { opacity: glow }]} pointerEvents="none">
            <LinearGradient
              colors={[alertAccent + '00', alertAccent + 'AA']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}
      </View>

      {/* Alert toast → tap to jump */}
      {alert && alert.col !== active ? (
        <PressScale onPress={() => jumpTo(alert.col)} style={[s.toast, { bottom: insets.bottom + 92 }]}>
          <View style={[s.toastDot, { backgroundColor: alertAccent }]} />
          <Text style={s.toastText} numberOfLines={1}>
            <Text style={{ fontWeight: '800' }}>${alert.sym}</Text> popped in {COLS[alert.col].label}
          </Text>
          <Text style={[s.toastGo, { color: alertAccent }]}>Jump ›</Text>
        </PressScale>
      ) : null}
    </View>
  );
}

function Column({
  def,
  items,
  dim,
  alertMint,
  glow,
  onOpenToken,
}: {
  def: ColDef;
  items: PulseBundle[];
  dim: boolean;
  alertMint: string | null;
  glow: Animated.AnimatedInterpolation<number>;
  onOpenToken: (b: PulseBundle) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.col, dim && s.colDim]}>
      <View style={s.colHead}>
        <View style={[s.colAccent, { backgroundColor: def.accent }]} />
        <Text style={s.colTitle}>{def.label}</Text>
        <Text style={[s.colCount, { color: def.accent }]}>{items.length}</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(it) => it.token.mint}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96, gap: 7 }}
        ListEmptyComponent={
          <View style={s.colEmpty}>
            <Ionicons name="pulse" size={20} color={colors.fgFaint} />
            <Text style={s.colEmptyText}>Quiet for now.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TokenRow
            bundle={item}
            accent={def.accent}
            alerted={item.token.mint === alertMint}
            glow={glow}
            onPress={() => onOpenToken(item)}
          />
        )}
      />
    </View>
  );
}

function TokenRow({
  bundle,
  accent,
  alerted,
  glow,
  onPress,
}: {
  bundle: PulseBundle;
  accent: string;
  alerted: boolean;
  glow: Animated.AnimatedInterpolation<number>;
  onPress: () => void;
}) {
  const { token, snapshot } = bundle;
  const sym = (token.symbol ?? '?').replace(/^\$/, '');
  const ch = useMemo(() => pseudoChange(token.mint), [token.mint]);
  const age = ageShort(token.created_at);
  const bonding = token.bonding_progress;
  const pct = bonding == null ? null : bonding <= 1 ? bonding * 100 : bonding;

  const inner = (
    <View style={s.row}>
      <CoinIcon uri={token.image_url} symbol={sym} size={34} verified={Boolean(token.launch_pad)} />
      <View style={s.rowMid}>
        <View style={s.rowTopLine}>
          <Text style={s.sym} numberOfLines={1}>
            {sym}
          </Text>
          {age ? <Text style={s.age}>{age}</Text> : null}
        </View>
        <View style={s.metrics}>
          <Metric label="MC" value={compactUsd(snapshot?.market_cap_usd)} />
          <Metric label="V" value={compactUsd(snapshot?.volume_24h_usd)} />
          <Metric label="H" value={compactNum(snapshot?.holder_count)} />
        </View>
        {pct != null ? (
          <View style={s.bondTrack}>
            <View style={[s.bondFill, { width: `${Math.min(100, Math.max(2, pct))}%`, backgroundColor: accent }]} />
          </View>
        ) : null}
      </View>
      <View style={s.rowRight}>
        <Text style={s.price} numberOfLines={1}>
          {priceUsd(snapshot?.price_usd)}
        </Text>
        <Text style={[s.chg, { color: ch.up ? colors.bull : colors.bear }]}>
          {ch.up ? '▲' : '▼'} {ch.pct}
        </Text>
      </View>
    </View>
  );

  if (alerted) {
    return (
      <Pressable onPress={onPress}>
        <Animated.View style={[s.rowWrap, s.rowAlert, { borderColor: accent, shadowOpacity: glow as unknown as number }]}>
          {inner}
        </Animated.View>
      </Pressable>
    );
  }
  return (
    <PressScale onPress={onPress} to={0.98} style={s.rowWrap}>
      {inner}
    </PressScale>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metric}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={s.metricValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: colors.fg, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  opBadge: { backgroundColor: colors.accentSoft, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: colors.accent + '55' },
  opBadgeText: { color: colors.accentGlow, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  autoBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.bgRaised, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderColor: colors.border },
  autoBtnOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  autoText: { color: colors.fgMuted, fontSize: 12, fontWeight: '600' },
  autoTextOn: { color: '#fff' },

  aiStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 18, marginTop: 12, backgroundColor: colors.bgRaised, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9 },
  aiDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accentGlow },
  aiText: { flex: 1, color: colors.fgSecondary, fontSize: 12.5, fontWeight: '500' },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginTop: 14 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bgRaised, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  tabDot: { width: 7, height: 7, borderRadius: 4 },
  tabLabel: { color: colors.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.3, flex: 1 },
  tabCount: { color: colors.fgMuted, fontSize: 12, fontWeight: '700' },
  tabAlert: { position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: 3 },

  carouselWrap: { flex: 1, marginTop: 12 },
  col: { width: COL_W, marginRight: GAP, flex: 1 },
  colDim: { opacity: 0.62 },
  colHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  colAccent: { width: 4, height: 14, borderRadius: 2 },
  colTitle: { color: colors.fgSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, flex: 1 },
  colCount: { fontSize: 13, fontWeight: '800' },
  colEmpty: { alignItems: 'center', gap: 8, paddingVertical: 60 },
  colEmptyText: { color: colors.fgFaint, fontSize: 13 },

  rowWrap: { backgroundColor: colors.bgRaised, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  rowAlert: {
    backgroundColor: colors.bgRaised2,
    borderRadius: radius.md,
    borderWidth: 1.5,
    shadowColor: colors.accent,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  rowMid: { flex: 1, gap: 4 },
  rowTopLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sym: { color: colors.fg, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  age: { color: colors.fgFaint, fontSize: 11, fontWeight: '600' },
  metrics: { flexDirection: 'row', gap: 12 },
  metric: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  metricLabel: { color: colors.fgFaint, fontSize: 10, fontWeight: '700' },
  metricValue: { color: colors.fgSecondary, fontSize: 12, fontWeight: '600' },
  bondTrack: { height: 3, borderRadius: 2, backgroundColor: colors.bgRaised2, overflow: 'hidden', marginTop: 1 },
  bondFill: { height: 3, borderRadius: 2 },
  rowRight: { alignItems: 'flex-end', gap: 3 },
  price: { color: colors.fg, fontSize: 14, fontWeight: '700' },
  chg: { fontSize: 12, fontWeight: '600' },

  edge: { position: 'absolute', top: 0, bottom: 0, width: PEEK + 18 },
  edgeLeft: { left: 0 },
  edgeRight: { right: 0 },

  toast: { position: 'absolute', left: 18, right: 18, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: colors.bgRaised2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: 14, paddingVertical: 11 },
  toastDot: { width: 8, height: 8, borderRadius: 4 },
  toastText: { flex: 1, color: colors.fg, fontSize: 13 },
  toastGo: { fontSize: 13, fontWeight: '700' },
});
