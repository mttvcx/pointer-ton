import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, PanResponder, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../components/Screen';
import { CoinIcon } from '../components/CoinIcon';
import { HlBadge } from '../components/HlBadge';
import { PressScale } from '../components/PressScale';
import { PerpCandles } from '../components/PerpCandles';
import { PerpTradeSheet } from '../components/PerpTradeSheet';
import { getPerpMarkets } from '../src/api/endpoints';
import { API_URL } from '../src/env';
import { colors, radius } from '../src/theme';
import { usd } from '../src/format';
import { toggleWatch, useIsWatched } from '../src/local';
import { shareReferral } from '../src/share';
import type { PerpMarket } from '../src/types';

const TIMEFRAMES = ['1D', '1W', '3M', '6M', '1Y', 'All'];
const TABS = ['Holders', 'About'];

const iconUri = (m: PerpMarket) => (/\.png$/i.test(m.iconSrc) ? `${API_URL}${m.iconSrc}` : null);
const px = (n: number) => usd(n, n >= 1 ? 2 : 4);
function compact(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function PerpScreen({ market: initial, onBack }: { market: PerpMarket; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);
  const [tf, setTf] = useState('1D');
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [trade, setTrade] = useState<{ open: boolean; side: 'long' | 'short' }>({ open: false, side: 'long' });
  const watched = useIsWatched(`perp:${initial.coin}`);

  // Keep the market fresh from the same live feed the list uses (no extra call).
  const q = useQuery({ queryKey: ['perp-markets'], queryFn: getPerpMarkets, staleTime: 10_000, refetchInterval: 15_000 });
  const market = q.data?.find((m) => m.id === initial.id) ?? initial;
  const up = market.chg24 >= 0;
  const chgUsd = (market.mark * market.chg24) / 100;

  // slide-in + swipe-back (mirrors TokenScreen)
  const W = Dimensions.get('window').width;
  const tx = useRef(new Animated.Value(W)).current;
  useEffect(() => {
    Animated.timing(tx, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [tx]);
  const back = useRef(onBack);
  back.current = onBack;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx > 12 && g.dx > Math.abs(g.dy) * 2.2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        if (g.dx > 0) tx.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > 90 || g.vx > 0.4) {
          Animated.timing(tx, { toValue: W, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(
            ({ finished }) => finished && back.current(),
          );
        } else {
          Animated.spring(tx, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 3 }).start();
        }
      },
    }),
  ).current;

  const holders = useMemo(() => demoPositions(market), [market.coin, market.mark]);

  return (
    <Screen>
      <Animated.View {...pan.panHandlers} style={{ flex: 1, transform: [{ translateX: tx }] }}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          <View style={s.pad}>
            <View style={s.topBar}>
              <PressScale onPress={onBack} to={0.85} hitSlop={10}>
                <Ionicons name="chevron-back" size={26} color={colors.fgSecondary} />
              </PressScale>
              <View style={s.head}>
                <View style={s.iconWrap}>
                  <CoinIcon uri={iconUri(market)} symbol={market.coin} size={40} />
                  <View style={s.hlBadge}>
                    <HlBadge size={15} />
                  </View>
                </View>
                <View>
                  <View style={s.titleLine}>
                    <Text style={s.coin}>{market.coin}</Text>
                    <View style={s.lev}>
                      <Text style={s.levText}>{market.maxLeverage}x</Text>
                    </View>
                  </View>
                  <Text style={s.label} numberOfLines={1}>
                    {market.label}
                  </Text>
                </View>
              </View>
              <View style={s.actions}>
                <PressScale onPress={() => toggleWatch(`perp:${market.coin}`)} to={0.85} hitSlop={8}>
                  <Ionicons name={watched ? 'star' : 'star-outline'} size={21} color={watched ? colors.warn : colors.fgSecondary} />
                </PressScale>
                <PressScale onPress={() => shareReferral('')} to={0.85} hitSlop={8}>
                  <Ionicons name="share-outline" size={21} color={colors.fgSecondary} />
                </PressScale>
              </View>
            </View>

            <View style={s.priceRow}>
              <View>
                <Text style={s.price}>{px(market.mark)}</Text>
                <Text style={[s.chg, { color: up ? colors.bull : colors.bear }]}>
                  {up ? '▲' : '▼'} {usd(Math.abs(chgUsd), 2)} ({Math.abs(market.chg24).toFixed(2)}%) <Text style={s.chgAge}>24h</Text>
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={s.oiRow}>
                  <Ionicons name="swap-horizontal" size={16} color={colors.fgMuted} />
                  <Text style={s.oiVal}>{compact(market.oiUsd)}</Text>
                </View>
                <Text style={s.oiLabel}>Open interest</Text>
              </View>
            </View>
          </View>

          <View style={s.chart}>
            <PerpCandles coin={market.coin} mark={market.mark} height={230} />
          </View>

          <View style={s.pad}>
            <View style={s.tfRow}>
              <View style={s.tfChip}>
                <Ionicons name="stats-chart" size={13} color={colors.bull} />
                <Text style={s.tfChipText}>15m</Text>
                <Ionicons name="chevron-expand" size={13} color={colors.fgMuted} />
              </View>
              {TIMEFRAMES.map((t) => (
                <PressScale key={t} onPress={() => setTf(t)} to={0.9} hitSlop={5}>
                  <Text style={[s.tf, t === tf && s.tfOn]}>{t}</Text>
                </PressScale>
              ))}
              <Ionicons name="pulse" size={18} color={colors.bull} style={{ marginLeft: 'auto' }} />
            </View>

            <View style={s.tabs}>
              {TABS.map((t, i) => (
                <PressScale key={t} onPress={() => setTab(i)} to={0.94} style={s.tabBtn}>
                  <Text style={[s.tabText, i === tab && s.tabTextOn]}>{t}</Text>
                  {i === tab ? <View style={s.tabUnderline} /> : null}
                </PressScale>
              ))}
            </View>

            {tab === 0 ? (
              <>
                <View style={s.holderHead}>
                  <View style={s.friendsRow}>
                    <Text style={s.friendsLabel}>Friends only</Text>
                    <Switch
                      value={friendsOnly}
                      onValueChange={setFriendsOnly}
                      trackColor={{ false: colors.bgRaised2, true: colors.accent }}
                      thumbColor="#fff"
                    />
                  </View>
                  <View style={s.levSizeRow}>
                    <Text style={s.levSizeLabel}>Leveraged size</Text>
                    <Ionicons name="information-circle-outline" size={13} color={colors.fgMuted} />
                  </View>
                </View>
                {(friendsOnly ? [] : holders).map((h) => (
                  <View key={h.name} style={s.holder}>
                    <View style={[s.dot, { backgroundColor: h.color }]} />
                    <View style={{ flex: 1 }}>
                      <View style={s.holderNameLine}>
                        <Text style={s.holderName}>{h.name}</Text>
                        <View style={[s.posBadge, { backgroundColor: h.long ? colors.bullSoft : 'rgba(230,110,60,0.16)' }]}>
                          <Text style={[s.posBadgeText, { color: h.long ? colors.bull : '#E6803C' }]}>
                            {h.lev}x {h.long ? 'Long' : 'Short'}
                          </Text>
                        </View>
                      </View>
                      <Text style={s.holderEntry}>Avg. entry: {px(h.entry)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.holderValue}>{usd(h.size, 2)}</Text>
                      <Text style={[s.holderPnl, { color: h.pnl >= 0 ? colors.bull : colors.bear }]}>
                        {h.pnl >= 0 ? '+' : '-'}
                        {usd(Math.abs(h.pnl), 2)}
                      </Text>
                    </View>
                  </View>
                ))}
                {friendsOnly ? <Text style={s.friendsEmpty}>No friends are positioned here yet.</Text> : null}
              </>
            ) : (
              <View style={s.about}>
                <AboutRow label="Market" value={`${market.coin} · ${market.label}`} />
                <AboutRow label="Mark price" value={px(market.mark)} />
                <AboutRow label="Oracle price" value={px(market.oraclePx)} />
                <AboutRow label="Open interest" value={compact(market.oiUsd)} />
                <AboutRow label="24h volume" value={compact(market.vol24Usd)} />
                <AboutRow label="Max leverage" value={`${market.maxLeverage}x`} />
                <AboutRow
                  label="Funding / 1h"
                  value={`${(market.fundingHourly * 100).toFixed(4)}%`}
                  tone={market.fundingHourly >= 0 ? colors.bull : colors.bear}
                />
                <AboutRow label="Next funding" value={market.fundingCountdown || '—'} />
                <Text style={s.aboutNote}>Live Hyperliquid market data. Positions above are illustrative until order signing ships.</Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={[s.bar, { bottom: insets.bottom + 14 }]}>
          <PressScale style={[s.side, { backgroundColor: colors.bear }]} onPress={() => setTrade({ open: true, side: 'short' })}>
            <Text style={s.sideText}>Short</Text>
          </PressScale>
          <PressScale style={[s.side, { backgroundColor: colors.bull }]} onPress={() => setTrade({ open: true, side: 'long' })}>
            <Text style={[s.sideText, { color: '#04120C' }]}>Long</Text>
          </PressScale>
        </View>
      </Animated.View>

      <PerpTradeSheet
        key={trade.side}
        market={market}
        side={trade.side}
        visible={trade.open}
        onClose={() => setTrade((t) => ({ ...t, open: false }))}
      />
    </Screen>
  );
}

function AboutRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={s.aboutRow}>
      <Text style={s.aboutLabel}>{label}</Text>
      <View style={s.leader} />
      <Text style={[s.aboutVal, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

/* Deterministic illustrative leveraged positions for the Holders tab. */
const NAMES = ['mev', 'nf_triax', 'sol_sniper', 'degenkat', 'liquidfren', 'onchain_od', 'ser_pump', 'ghosttrade'];
const DOTS = ['#3DE07A', '#B5392B', '#6E56CF', '#C9A21E', '#33B5E5', '#E6803C', '#9AA4B2', '#3D8BFF'];
function seedNum(seed: string, salt: number): number {
  let h = salt * 2654435761;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (h % 100000) / 100000;
}
function demoPositions(m: PerpMarket) {
  return NAMES.map((name, i) => {
    const r = seedNum(m.coin + name, i + 1);
    const long = r > 0.4;
    const lev = [5, 10, 20, 20, 40][Math.floor(seedNum(name, i) * 5)] ?? 20;
    const size = Math.round((2000 + r * 1_240_000) * 100) / 100;
    const entry = m.mark * (1 + (seedNum(name, i + 3) - 0.5) * 0.08);
    const dir = long ? 1 : -1;
    const pnl = Math.round(size * ((m.mark - entry) / entry) * dir * lev * 100) / 100;
    return { name, color: DOTS[i % DOTS.length], long, lev, size, entry, pnl };
  }).sort((a, b) => b.size - a.size);
}

const s = StyleSheet.create({
  pad: { paddingHorizontal: 18 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1, marginLeft: 6 },
  iconWrap: { width: 40, height: 40 },
  hlBadge: { position: 'absolute', right: -3, bottom: -3 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  coin: { color: colors.fg, fontSize: 20, fontWeight: '800' },
  lev: { backgroundColor: colors.accentSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  levText: { color: colors.accentGlow, fontSize: 11, fontWeight: '700' },
  label: { color: colors.fgMuted, fontSize: 13, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 16 },

  priceRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 18 },
  price: { color: colors.fg, fontSize: 34, fontWeight: '700', letterSpacing: -1 },
  chg: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  chgAge: { color: colors.fgMuted, fontWeight: '500' },
  oiRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  oiVal: { color: colors.fg, fontSize: 20, fontWeight: '700' },
  oiLabel: { color: colors.fgMuted, fontSize: 13, marginTop: 2 },

  chart: { marginTop: 14 },

  tfRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 12 },
  tfChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.bgRaised, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 5 },
  tfChipText: { color: colors.fg, fontSize: 12.5, fontWeight: '700' },
  tf: { color: colors.fgFaint, fontSize: 13.5 },
  tfOn: { color: colors.fg, fontWeight: '700' },

  tabs: { flexDirection: 'row', gap: 30, marginTop: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBtn: { paddingBottom: 12 },
  tabText: { color: colors.fgFaint, fontSize: 16 },
  tabTextOn: { color: colors.fg, fontWeight: '700' },
  tabUnderline: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, backgroundColor: colors.accent },

  holderHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 4 },
  friendsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  friendsLabel: { color: colors.fg, fontSize: 15, fontWeight: '600' },
  levSizeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  levSizeLabel: { color: colors.fgMuted, fontSize: 13.5 },

  holder: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  dot: { width: 34, height: 34, borderRadius: 17 },
  holderNameLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  holderName: { color: colors.fg, fontSize: 16, fontWeight: '700' },
  posBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  posBadgeText: { fontSize: 12, fontWeight: '700' },
  holderEntry: { color: colors.fgMuted, fontSize: 13, marginTop: 3 },
  holderValue: { color: colors.fg, fontSize: 16, fontWeight: '700' },
  holderPnl: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  friendsEmpty: { color: colors.fgMuted, fontSize: 14, textAlign: 'center', paddingVertical: 40 },

  about: { marginTop: 6 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  aboutLabel: { color: colors.fgMuted, fontSize: 14 },
  leader: { flex: 1, height: 1, borderBottomWidth: 1, borderBottomColor: colors.border, marginHorizontal: 8, transform: [{ translateY: 3 }] },
  aboutVal: { color: colors.fg, fontSize: 14, fontWeight: '600' },
  aboutNote: { color: colors.fgFaint, fontSize: 12.5, lineHeight: 18, marginTop: 14 },

  bar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 12 },
  side: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 14 },
  sideText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
