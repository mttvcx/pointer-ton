import React, { useRef, useState } from 'react';
import {
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { DragSheet } from './DragSheet';
import { PressScale } from './PressScale';
import { colors, radius } from '../src/theme';

const PAGE_W = Dimensions.get('window').width - 36; // DragSheet has 18px horizontal padding

/**
 * Perps education carousel — opened from the "i" on the Go-long-or-short banner.
 * Four swipeable cards (what are perps · leverage · liquidation · start trading),
 * the standard onboarding pattern for a risky product the user may not know.
 */
const STEPS = [
  {
    key: 'what',
    title: 'What are perps?',
    body: 'Perps (perpetual futures) are a type of trade where you predict whether a price will go up or down. You can go long to bet on the price going up, or short to bet on the price going down.',
    art: <WhatArt />,
  },
  {
    key: 'leverage',
    title: 'What is leverage?',
    body: 'Leverage lets you gain exposure to a larger position relative to your margin. Leverage increases both potential profits and potential losses.',
    art: <LeverageArt />,
  },
  {
    key: 'liquidation',
    title: 'What is liquidation?',
    body: 'Liquidation happens when your losses become too large and you no longer have enough margin to cover the trade. When this happens, your position will be automatically closed.',
    art: <LiquidationArt />,
  },
  {
    key: 'start',
    title: 'Start trading perps',
    body: 'Choose from crypto, stocks, and commodities and trade with up to 50x leverage.',
    art: <StartArt />,
  },
];

export function PerpsExplainer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === STEPS.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / PAGE_W);
    if (i !== page) setPage(Math.max(0, Math.min(STEPS.length - 1, i)));
  };

  const next = () => {
    if (last) {
      onClose();
      return;
    }
    scrollRef.current?.scrollTo({ x: (page + 1) * PAGE_W, animated: true });
  };

  return (
    <DragSheet visible={visible} onClose={onClose}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
      >
        {STEPS.map((st) => (
          <View key={st.key} style={{ width: PAGE_W }}>
            <View style={s.artCard}>{st.art}</View>
            <Text style={s.title}>{st.title}</Text>
            <Text style={s.body}>{st.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={s.dots}>
        {STEPS.map((st, i) => (
          <View key={st.key} style={[s.dot, i === page && s.dotOn]} />
        ))}
      </View>

      <PressScale onPress={next} style={[s.btn, last && s.btnGo]}>
        <Text style={[s.btnText, last && s.btnTextGo]}>{last ? 'Trade perps' : 'Next'}</Text>
      </PressScale>
    </DragSheet>
  );
}

/* ---------- illustrations ---------- */

function WhatArt() {
  return (
    <View style={s.center}>
      <Svg width="100%" height={200} viewBox="0 0 300 200">
        <Path
          d="M6 150 C 60 150, 70 70, 120 95 S 180 150, 210 110 S 270 30, 292 20"
          stroke={colors.bull}
          strokeWidth={7}
          strokeLinecap="round"
          fill="none"
        />
        <Path d="M292 20 L 276 30 M292 20 L 282 38" stroke={colors.bull} strokeWidth={7} strokeLinecap="round" />
      </Svg>
      <View style={s.longPill}>
        <Text style={s.longText}>Long</Text>
      </View>
    </View>
  );
}

function LeverageArt() {
  const marks = ['1x', '2x', '3x', '4x', '5x'];
  return (
    <View style={s.center}>
      <View style={s.levRow}>
        {marks.map((m, i) => {
          const active = i === 2;
          return (
            <View key={m} style={s.levCol}>
              <View style={[s.tick, active && s.tickOn]} />
              <Text style={[s.levLabel, active && s.levLabelOn]}>{m}</Text>
              <View style={[s.tick, active && s.tickOn]} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function LiquidationArt() {
  const candles = [
    { up: true, h: 70, top: 40 },
    { up: false, h: 50, top: 55 },
    { up: false, h: 44, top: 80 },
    { up: true, h: 88, top: 30 },
  ];
  return (
    <View style={[s.center, { paddingHorizontal: 18 }]}>
      <View style={s.chart}>
        {/* current price line */}
        <View style={[s.dashLine, { top: 34 }]} />
        <View style={[s.pill, s.pillWhite, { top: 22 }]}>
          <Text style={s.pillWhiteText}>Current price</Text>
        </View>
        {/* liquidation line */}
        <View style={[s.dashLine, s.dashDanger, { top: 132 }]} />
        <View style={[s.pill, s.pillDanger, { top: 120 }]}>
          <Ionicons name="warning" size={14} color="#1a0d05" />
          <Text style={s.pillDangerText}>Liquidation</Text>
        </View>
        {/* candles */}
        <View style={s.candles}>
          {candles.map((c, i) => (
            <View key={i} style={[s.candle, { height: c.h, marginTop: c.top, backgroundColor: c.up ? colors.bull : colors.chartDown }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

function StartArt() {
  const coins = [
    { bg: '#E11D2A', label: 'S&P', fg: '#fff' },
    { bg: '#0A0A0A', label: 'X', fg: '#fff' },
    { bg: '#76B900', label: 'NV', fg: '#fff' },
    { bg: '#072a25', label: 'H', fg: '#97fce4' },
    { bg: '#3a1d52', label: 'M', fg: '#fff' },
  ];
  return (
    <View style={s.coinReel}>
      {coins.map((c, i) => (
        <View key={i} style={[s.coin, { backgroundColor: c.bg }, i > 0 && { marginLeft: -10 }]}>
          <Text style={[s.coinText, { color: c.fg }]}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  artCard: { backgroundColor: colors.bgRaised, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, height: 300, marginBottom: 22, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.fg, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  body: { color: colors.fgSecondary, fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 14, paddingHorizontal: 6 },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 22 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.borderStrong },
  dotOn: { width: 20, backgroundColor: colors.fgSecondary },

  btn: { backgroundColor: colors.bgRaised, borderRadius: radius.md, paddingVertical: 17, alignItems: 'center', marginTop: 18 },
  btnGo: { backgroundColor: colors.accent },
  btnText: { color: colors.fg, fontSize: 17, fontWeight: '700' },
  btnTextGo: { color: '#fff' },

  longPill: { position: 'absolute', backgroundColor: colors.bull, borderRadius: radius.md, paddingHorizontal: 44, paddingVertical: 15 },
  longText: { color: '#06210F', fontSize: 20, fontWeight: '800' },

  levRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', paddingHorizontal: 8 },
  levCol: { flex: 1, alignItems: 'center', gap: 16 },
  levLabel: { color: colors.fgFaint, fontSize: 26, fontWeight: '700' },
  levLabelOn: { color: colors.accent, fontSize: 46, fontWeight: '800' },
  tick: { width: 2, height: 12, borderRadius: 1, backgroundColor: colors.border },
  tickOn: { backgroundColor: colors.accent, height: 16 },

  chart: { alignSelf: 'stretch', height: 220, justifyContent: 'center' },
  candles: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 18 },
  candle: { width: 12, borderRadius: 3 },
  dashLine: { position: 'absolute', left: 0, right: 0, height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.45)' },
  dashDanger: { borderColor: colors.chartDown },
  pill: { position: 'absolute', right: 0, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  pillWhite: { backgroundColor: '#fff' },
  pillWhiteText: { color: '#000', fontSize: 15, fontWeight: '700' },
  pillDanger: { backgroundColor: colors.chartDown },
  pillDangerText: { color: '#1a0d05', fontSize: 15, fontWeight: '700' },

  coinReel: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  coin: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.bgRaised },
  coinText: { fontSize: 22, fontWeight: '800' },
});
