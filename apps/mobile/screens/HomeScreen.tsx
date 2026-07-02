import React, { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../components/Screen';
import { Logo } from '../components/Logo';
import { CoinIcon } from '../components/CoinIcon';
import { PressScale } from '../components/PressScale';
import { colors, radius } from '../src/theme';
import { getLiveTokens } from '../src/api/endpoints';
import { compactUsd, priceUsd, pseudoChange } from '../src/format';
import { useWatchlist } from '../src/local';
import { TraderSheet } from '../components/TraderSheet';
import { DepositFlow } from '../components/DepositFlow';
import { DragSheet } from '../components/DragSheet';
import { WEEKLY, type WeeklyTrade } from '../src/demo';
import { PulseBoard } from '../components/PulseBoard';
import { PerpsList } from '../components/PerpsList';
import type { PulseBundle } from '../src/types';

const CHIPS: { label: string; sort: 'mc' | 'vol' | 'holders' | 'new'; badge?: string }[] = [
  { label: 'Crypto', sort: 'mc' },
  { label: 'Perps', sort: 'vol', badge: 'New' },
  { label: 'Trending', sort: 'mc' },
  { label: 'Most held', sort: 'holders' },
  { label: 'Graduated', sort: 'new' },
  { label: 'Gainers', sort: 'vol' },
];

export function HomeScreen({
  onOpenToken,
  advanced,
  onOpenEducation,
}: {
  onOpenToken: (b: PulseBundle) => void;
  advanced: boolean;
  onOpenEducation: () => void;
}) {
  return advanced ? <PulseBoard onOpenToken={onOpenToken} /> : <SimpleHome onOpenToken={onOpenToken} onOpenEducation={onOpenEducation} />;
}

function SimpleHome({ onOpenToken, onOpenEducation }: { onOpenToken: (b: PulseBundle) => void; onOpenEducation: () => void }) {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(2);
  const [trade, setTrade] = useState<WeeklyTrade | null>(null);
  const [deposit, setDeposit] = useState(false);
  const [feeInfo, setFeeInfo] = useState(false);
  const [watchOnly, setWatchOnly] = useState(false);
  const watchlist = useWatchlist();
  const sort = CHIPS[active].sort;
  const isPerps = !watchOnly && CHIPS[active].label === 'Perps';

  const q = useQuery({ queryKey: ['live-tokens'], queryFn: () => getLiveTokens(), staleTime: 30_000, refetchInterval: 45_000 });

  const tokens = useMemo(() => {
    let items = [...(q.data ?? [])];
    items.sort((a, b) => {
      const sa = a.snapshot;
      const sb = b.snapshot;
      if (sort === 'vol') return (sb?.volume_24h_usd ?? 0) - (sa?.volume_24h_usd ?? 0);
      if (sort === 'holders') return (sb?.holder_count ?? 0) - (sa?.holder_count ?? 0);
      if (sort === 'new') return Date.parse(sb?.snapshot_at ?? '0') - Date.parse(sa?.snapshot_at ?? '0');
      return (sb?.market_cap_usd ?? 0) - (sa?.market_cap_usd ?? 0);
    });
    if (watchOnly) items = items.filter((b) => watchlist.has(b.token.mint));
    return items;
  }, [q.data, sort, watchOnly, watchlist]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor={colors.fgMuted} />}
      >
        {/* Category row at the very top (Invo-style) — above the balance. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollsToTop={false} contentContainerStyle={s.bleedChips}>
          <PressScale onPress={() => setWatchOnly((v) => !v)} to={0.95} style={[s.chip, s.chipIcon, watchOnly && s.chipActive]}>
            <Ionicons name={watchOnly ? 'star' : 'star-outline'} size={15} color={watchOnly ? '#000' : colors.fg} />
          </PressScale>
          {CHIPS.map((c, i) => {
            const on = !watchOnly && i === active;
            return (
              <PressScale key={c.label} onPress={() => { setWatchOnly(false); setActive(i); }} to={0.95} style={[s.chip, on && s.chipActive]}>
                <Text style={[s.chipText, on && s.chipTextActive]}>{c.label}</Text>
                {c.badge ? (
                  <View style={s.newBadge}>
                    <Text style={s.newText}>{c.badge}</Text>
                  </View>
                ) : null}
              </PressScale>
            );
          })}
        </ScrollView>

        <View style={s.pad}>
          <View style={s.balanceRow}>
            <View>
              <Text style={s.balance}>
                $0<Text style={s.cents}>.00</Text>
              </Text>
              <Text style={s.sub}>-- 24h</Text>
            </View>
            <PressScale onPress={() => setDeposit(true)} style={s.deposit}>
              <Text style={s.depositText}>Deposit</Text>
            </PressScale>
          </View>

          <View style={s.sectionHead}>
            <Ionicons name="bulb-outline" size={18} color={colors.fgSecondary} />
            <Text style={s.sectionTitle}>Weekly Top Trades</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollsToTop={false} contentContainerStyle={s.bleed}>
          {WEEKLY.map((w) => (
            <PressScale key={w.name} onPress={() => setTrade(w)} to={0.97} style={s.weekCard}>
              <View style={s.weekTop}>
                <View style={[s.weekAvatar, { backgroundColor: w.color }]}>
                  <Text style={s.weekInitial}>{w.initial}</Text>
                </View>
                <Text style={s.weekName} numberOfLines={1}>
                  {w.name}
                </Text>
              </View>
              <View style={s.weekBottom}>
                <View style={[s.weekToken, { backgroundColor: w.tokenColor }]}>
                  <Text style={s.weekTokenText}>{w.tokenInitial}</Text>
                </View>
                <Text style={s.weekAmt}>{w.amt}</Text>
              </View>
            </PressScale>
          ))}
        </ScrollView>

        {isPerps ? (
          <View style={s.pad}>
            <PerpsList />
          </View>
        ) : (
          <>
        <View style={s.pad}>
          <PressScale style={s.banner} to={0.99} onPress={() => setFeeInfo(true)}>
            <View style={s.bannerLeft}>
              <Ionicons name="pricetag-outline" size={17} color={colors.accent} />
              <Text style={s.bannerText}>
                <Text style={s.bannerAccent}>Lowest fees</Text> anywhere.
              </Text>
            </View>
            <Ionicons name="information-circle-outline" size={17} color={colors.fgFaint} />
          </PressScale>
        </View>

        <View style={[s.pad, s.list]}>
          {q.isLoading ? (
            [0, 1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)
          ) : tokens.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>{watchOnly ? 'Your watchlist is empty.' : 'No live tokens right now.'}</Text>
              <Text style={s.emptySub}>{watchOnly ? 'Tap the ☆ on any token to add it here.' : 'Pull down to refresh.'}</Text>
            </View>
          ) : (
            tokens.map((b) => {
              const sym = (b.token.symbol ?? '?').replace(/^\$/, '');
              const ch = pseudoChange(b.token.mint);
              return (
                <PressScale key={b.token.mint} onPress={() => onOpenToken(b)} to={0.985} style={s.row}>
                  <View style={s.rowLeft}>
                    <CoinIcon uri={b.token.image_url} symbol={sym} verified={Boolean(b.token.launch_pad)} />
                    <View style={s.rowText}>
                      <Text style={s.ticker} numberOfLines={1}>
                        {sym}
                      </Text>
                      <Text style={s.mc}>{compactUsd(b.snapshot?.market_cap_usd)} MC</Text>
                    </View>
                  </View>
                  <View style={s.rowRight}>
                    <Text style={s.price}>{priceUsd(b.snapshot?.price_usd)}</Text>
                    <Text style={[s.chg, { color: ch.up ? colors.bull : colors.bear }]}>
                      {ch.up ? '▲' : '▼'} {ch.pct}
                    </Text>
                  </View>
                </PressScale>
              );
            })
          )}
          {q.isFetching && !q.isLoading ? <ActivityIndicator color={colors.fgMuted} style={{ marginTop: 12 }} /> : null}
        </View>
          </>
        )}
      </ScrollView>
      <View style={[s.topHeader, { paddingTop: insets.top + 8 }]}>
        <Logo size={40} />
        <PressScale onPress={onOpenEducation} to={0.85} hitSlop={8} style={s.headerBtn}>
          <Ionicons name="book-outline" size={21} color={colors.fgSecondary} />
        </PressScale>
      </View>
      <TraderSheet trade={trade} onClose={() => setTrade(null)} />
      <DepositFlow visible={deposit} onClose={() => setDeposit(false)} />

      <DragSheet visible={feeInfo} onClose={() => setFeeInfo(false)} fullDrag>
        <View style={s.feeInfo}>
          <View style={s.feeIcon}>
            <Ionicons name="cash-outline" size={28} color={colors.accent} />
          </View>
          <Text style={s.feeTitle}>Highest cashback, anywhere</Text>
          <Text style={s.feeBody}>
            Pointer pays you back <Text style={s.feeStrong}>50% of your trading fees</Text> — the highest cashback of any
            platform — and routes every order for <Text style={s.feeStrong}>best execution</Text>. Lower fees, more back,
            better fills.
          </Text>
          <PressScale style={s.feeClose} onPress={() => setFeeInfo(false)}>
            <Text style={s.feeCloseText}>Close</Text>
          </PressScale>
        </View>
      </DragSheet>
    </Screen>
  );
}

function SkeletonRow() {
  return (
    <View style={s.row}>
      <View style={s.rowLeft}>
        <View style={s.skelCoin} />
        <View style={s.rowText}>
          <View style={[s.skelBar, { width: 70 }]} />
          <View style={[s.skelBar, { width: 50, marginTop: 6 }]} />
        </View>
      </View>
      <View style={s.rowRight}>
        <View style={[s.skelBar, { width: 80 }]} />
        <View style={[s.skelBar, { width: 54, marginTop: 6 }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  pad: { paddingHorizontal: 18 },
  topHeader: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10, backgroundColor: colors.bg, zIndex: 20 },
  headerBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgRaised },
  bleed: { gap: 12, paddingTop: 12, paddingHorizontal: 18 },
  bleedChips: { gap: 8, paddingTop: 18, paddingHorizontal: 18 },

  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 18 },
  balance: { color: colors.fg, fontSize: 49, fontWeight: '600', letterSpacing: -1.5 },
  cents: { color: colors.fgFaint, fontSize: 49, fontWeight: '600' },
  sub: { color: colors.fgFaint, fontSize: 13, marginTop: 6 },
  deposit: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 26, marginTop: 4 },
  depositText: { color: colors.onAccent, fontSize: 17, fontWeight: '700' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 26 },
  sectionTitle: { color: colors.fg, fontSize: 18, fontWeight: '600' },
  weekCard: { width: 178, backgroundColor: colors.bgRaised, borderRadius: radius.lg, padding: 14 },
  weekTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  weekAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  weekInitial: { color: '#fff', fontSize: 14, fontWeight: '600' },
  weekName: { color: colors.fg, fontSize: 16, fontWeight: '600', flex: 1 },
  weekBottom: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12 },
  weekToken: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  weekTokenText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  weekAmt: { color: colors.bull, fontSize: 17, fontWeight: '600' },

  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.bgRaised, borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 16 },
  chipIcon: { paddingHorizontal: 11 },
  chipActive: { backgroundColor: '#fff' },
  chipText: { color: colors.fgSecondary, fontSize: 15, fontWeight: '500' },
  chipTextActive: { color: '#000', fontWeight: '600' },
  newBadge: { backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  newText: { color: colors.onAccent, fontSize: 11, fontWeight: '700' },

  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bgRaised, borderRadius: radius.lg, padding: 14, marginTop: 18 },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  bannerText: { color: colors.fgSecondary, fontSize: 15, flex: 1 },
  bannerAccent: { color: colors.accent, fontWeight: '600' },

  list: { marginTop: 14, minHeight: 240 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 13, flex: 1 },
  rowText: { flex: 1 },
  ticker: { color: colors.fg, fontSize: 18, fontWeight: '600' },
  mc: { color: colors.fgMuted, fontSize: 14, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  price: { color: colors.fg, fontSize: 17, fontWeight: '600' },
  chg: { fontSize: 14, marginTop: 2 },

  skelCoin: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgRaised2 },
  skelBar: { height: 11, borderRadius: 4, backgroundColor: colors.bgRaised2 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: colors.fgSecondary, fontSize: 15, fontWeight: '600' },
  emptySub: { color: colors.fgMuted, fontSize: 13, marginTop: 4 },

  feeInfo: { alignItems: 'center', paddingTop: 6, paddingBottom: 8 },
  feeIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  feeTitle: { color: colors.fg, fontSize: 22, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  feeBody: { color: colors.fgSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12, paddingHorizontal: 8 },
  feeStrong: { color: colors.fg, fontWeight: '700' },
  feeClose: { alignSelf: 'stretch', backgroundColor: colors.bgRaised, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 22, borderWidth: 1, borderColor: colors.border },
  feeCloseText: { color: colors.fg, fontSize: 16, fontWeight: '700' },
});
