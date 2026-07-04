import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '../components/Screen';
import { Logo } from '../components/Logo';
import { CoinIcon } from '../components/CoinIcon';
import { PressScale } from '../components/PressScale';
import { colors, radius } from '../src/theme';
import { getLiveTokens } from '../src/api/endpoints';
import { compactUsd, priceUsd, pseudoChange } from '../src/format';
import { useWatchlist } from '../src/local';
import { usePortfolio, useCashBalance } from '../src/account';
import { TraderSheet } from '../components/TraderSheet';
import { DepositFlow } from '../components/DepositFlow';
import { DragSheet } from '../components/DragSheet';
import { WEEKLY, type WeeklyTrade } from '../src/demo';
import { PulseBoard } from '../components/PulseBoard';
import { PerpsList } from '../components/PerpsList';
import { MiniSpark } from '../components/MiniSpark';
import { GlassFill } from '../components/GlassFill';
import { ReferralButton } from '../components/ReferralButton';
import type { PulseBundle, PerpMarket } from '../src/types';

const SCREEN_W = Dimensions.get('window').width;

// Order intentionally NOT FOMO's (they lead Crypto·Perps·Trending): Trending leads,
// Perps sits mid-row. Our own rhythm.
const CHIPS: { label: string; sort: 'mc' | 'vol' | 'holders' | 'new'; badge?: string }[] = [
  { label: 'Trending', sort: 'mc' },
  { label: 'Crypto', sort: 'mc' },
  { label: 'Gainers', sort: 'vol' },
  { label: 'Perps', sort: 'vol', badge: 'New' },
  { label: 'Most held', sort: 'holders' },
  { label: 'Graduated', sort: 'new' },
];

/** Hermes-safe thousands grouping (no Intl). */
function groupInt(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Split a USD amount into grouped dollars + 2-digit cents; null → 0.00. */
function fmtBalance(v: number | null): { dollars: string; cents: string } {
  if (v == null || !Number.isFinite(v)) return { dollars: '0', cents: '00' };
  const abs = Math.abs(v);
  let dollars = Math.floor(abs);
  let cents = Math.round((abs - dollars) * 100);
  if (cents === 100) {
    dollars += 1;
    cents = 0;
  }
  return { dollars: groupInt(dollars), cents: String(cents).padStart(2, '0') };
}

/** "+3,328.67%" → the trade multiple ("34x" / "1.9x") — our depth-first framing. */
function multStr(w: WeeklyTrade): string {
  const pct = Number(w.pnlPct.replace(/[^0-9.-]/g, '')) || 0;
  const m = 1 + pct / 100;
  return m >= 10 ? `${Math.round(m)}x` : `${m.toFixed(1)}x`;
}

type TraderRef = { handle: string; name?: string; color?: string; initial?: string };

export function HomeScreen({
  onOpenToken,
  onOpenPerp,
  onOpenTrader,
  advanced,
  onOpenEducation,
  onOpenReferral,
}: {
  onOpenToken: (b: PulseBundle) => void;
  onOpenPerp: (m: PerpMarket) => void;
  onOpenTrader: (t: TraderRef) => void;
  advanced: boolean;
  onOpenEducation: () => void;
  onOpenReferral: () => void;
}) {
  return advanced ? (
    <PulseBoard onOpenToken={onOpenToken} />
  ) : (
    <SimpleHome onOpenToken={onOpenToken} onOpenPerp={onOpenPerp} onOpenTrader={onOpenTrader} onOpenEducation={onOpenEducation} onOpenReferral={onOpenReferral} />
  );
}

function SimpleHome({
  onOpenToken,
  onOpenPerp,
  onOpenTrader,
  onOpenEducation,
  onOpenReferral,
}: {
  onOpenToken: (b: PulseBundle) => void;
  onOpenPerp: (m: PerpMarket) => void;
  onOpenTrader: (t: TraderRef) => void;
  onOpenEducation: () => void;
  onOpenReferral: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(0);
  const [trade, setTrade] = useState<WeeklyTrade | null>(null);
  const [weekIdx, setWeekIdx] = useState(0);
  const [deposit, setDeposit] = useState(false);
  const [feeInfo, setFeeInfo] = useState(false);
  const [watchOnly, setWatchOnly] = useState(false);
  const watchlist = useWatchlist();
  const sort = CHIPS[active].sort;

  // Real portfolio value once signed in (real build); demo stays $0.00 honestly.
  const portfolio = usePortfolio();
  const totalUsd = portfolio.data ? (portfolio.data.summary?.totalValue ?? 0) + (portfolio.data.solUsd ?? 0) : null;
  const uPnl = portfolio.data?.summary?.unrealizedPnl ?? null;
  const uPnlPct = portfolio.data?.summary?.unrealizedPnlPct ?? null;
  const bal = fmtBalance(totalUsd);
  // Spendable USD cash = wallet USDC (real build); the "one balance" you buy from.
  const cash = useCashBalance();
  const cashStr = cash.data != null ? fmtBalance(cash.data) : null;
  const isPerps = !watchOnly && CHIPS[active].label === 'Perps';

  // Scroll feature: the top bar is transparent at rest (the gradient/aura show
  // behind the mark), then fades to a solid header + hairline as you scroll.
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerFade = scrollY.interpolate({ inputRange: [0, 46], outputRange: [0, 1], extrapolate: 'clamp' });

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
      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor={colors.fgMuted} />}
      >
        {/* Header row: separate floating liquid-glass chips + a glass selector for
            the active one (no green outline). */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollsToTop={false} contentContainerStyle={s.bleedChips}>
          <PressScale onPress={() => setWatchOnly((v) => !v)} to={0.95} style={[s.chip, s.chipIcon, watchOnly && s.chipOn]}>
            <GlassFill active={watchOnly} />
            <Ionicons name={watchOnly ? 'star' : 'star-outline'} size={15} color={colors.fg} />
          </PressScale>
          {CHIPS.map((c, i) => {
            const on = !watchOnly && i === active;
            return (
              <PressScale key={c.label} onPress={() => { setWatchOnly(false); setActive(i); }} to={0.95} style={[s.chip, on && s.chipOn]}>
                <GlassFill active={on} />
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
            <View style={{ flex: 1 }}>
              <Text style={s.balanceLabel}>Portfolio value</Text>
              <Text style={s.balance}>
                ${bal.dollars}<Text style={s.cents}>.{bal.cents}</Text>
              </Text>
              <Text style={s.sub}>
                {uPnl != null ? (
                  <Text style={{ color: uPnl >= 0 ? colors.bull : colors.bear }}>
                    {uPnl >= 0 ? '+' : '−'}${groupInt(Math.abs(Math.round(uPnl)))}
                    {uPnlPct != null ? ` (${uPnl >= 0 ? '+' : '−'}${Math.abs(uPnlPct).toFixed(1)}%)` : ''}
                  </Text>
                ) : (
                  '—'
                )}
                <Text style={{ color: colors.fgMuted }}>{uPnl != null ? ' · unrealized' : ' · Past 24h'}</Text>
              </Text>
              {cashStr ? (
                <Text style={s.cashLine}>
                  <Ionicons name="cash-outline" size={12} color={colors.accentGlow} /> ${cashStr.dollars}.{cashStr.cents} cash to spend
                </Text>
              ) : null}
            </View>
            <PressScale onPress={() => setDeposit(true)} style={s.depositWrap}>
              <View style={s.deposit}>
                <LinearGradient colors={[colors.accentGlow, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={s.depositSheen}
                  pointerEvents="none"
                />
                <Ionicons name="add" size={18} color={colors.onAccent} />
                <Text style={s.depositText}>Deposit</Text>
              </View>
            </PressScale>
          </View>

          <View style={s.sectionHead}>
            <View style={s.sectionBar} />
            <Text style={s.sectionTitle}>Weekly Top Trades</Text>
          </View>
        </View>

        {WEEKLY.length ? (
          <View style={{ marginTop: 2 }}>
            {/* Horizontal pager — one trade card per page, swipe sideways to flip
                through the ranking (keeps the section one card tall so the token
                list below stays on-screen when you change category chips). */}
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onMomentumScrollEnd={(e) => setWeekIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
            >
              {WEEKLY.slice(0, 5).map((w, i) => (
                <View key={w.name} style={{ width: SCREEN_W, paddingHorizontal: 18 }}>
                  <PressScale onPress={() => setTrade(w)} to={0.98} style={s.wHero}>
                    <GlassFill />
                    <View style={s.wHeroHead}>
                      <View style={s.wHeroTag}>
                        <Ionicons name={i === 0 ? 'flame' : 'trophy'} size={12} color={colors.accentGlow} />
                        <Text style={s.wHeroTagText}>{i === 0 ? 'Trade of the week' : `#${i + 1} this week`}</Text>
                      </View>
                      <View style={s.wTokenRow}>
                        <View style={[s.wTokenBadge, { backgroundColor: w.tokenColor }]}>
                          <Text style={s.wTokenText}>{w.tokenInitial}</Text>
                        </View>
                        <Text style={s.wTokenSym}>{w.token}</Text>
                      </View>
                    </View>
                    <View style={s.wHeroMid}>
                      <Text style={s.wMult}>{multStr(w)}</Text>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={s.wAmt}>{w.amt}</Text>
                        <Text style={s.wEntry}>
                          {w.avgEntry} → {w.avgExit}
                        </Text>
                      </View>
                    </View>
                    <View style={s.wHeroFoot}>
                      <View style={[s.wAvatar, { backgroundColor: w.color }]}>
                        <Text style={s.wInitial}>{w.initial}</Text>
                      </View>
                      <Text style={s.wName} numberOfLines={1}>
                        {w.name}
                      </Text>
                      <Text style={s.wThesis} numberOfLines={1}>
                        {w.thesis}
                      </Text>
                    </View>
                  </PressScale>
                </View>
              ))}
            </ScrollView>
            {/* page dots */}
            <View style={s.dots}>
              {WEEKLY.slice(0, 5).map((w, i) => (
                <View key={w.name} style={[s.dot, i === weekIdx && s.dotOn]} />
              ))}
            </View>
          </View>
        ) : null}

        {isPerps ? (
          <View style={s.pad}>
            <PerpsList onOpenPerp={onOpenPerp} />
          </View>
        ) : (
          <>
        <View style={s.pad}>
          <PressScale style={s.banner} to={0.99} onPress={() => setFeeInfo(true)}>
            <GlassFill />
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
                  <View style={s.spark}>
                    <MiniSpark seed={b.token.mint} up={ch.up} width={54} height={26} />
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
      </Animated.ScrollView>
      <View style={[s.topHeader, { paddingTop: insets.top + 8 }]}>
        {/* Liquid-glass header: transparent while floating at rest, frosts as
            content scrolls under it. */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { opacity: headerFade }]}>
          <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={s.topHeaderTint} />
          <View style={s.topHeaderHairline} />
        </Animated.View>
        <Logo size={40} />
        <View style={s.headerRight}>
          <ReferralButton onPress={onOpenReferral} />
          <PressScale onPress={onOpenEducation} to={0.85} hitSlop={8} style={s.headerBtn}>
            <GlassFill />
            <Ionicons name="book-outline" size={21} color={colors.fgSecondary} />
          </PressScale>
        </View>
      </View>
      <TraderSheet trade={trade} onClose={() => setTrade(null)} onOpenTrader={onOpenTrader} />
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
            <GlassFill />
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
  topHeader: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10, zIndex: 20, overflow: 'hidden' },
  topHeaderTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,19,15,0.42)' },
  topHeaderHairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  bleed: { gap: 12, paddingTop: 12, paddingHorizontal: 18 },
  bleedChips: { gap: 8, paddingTop: 18, paddingHorizontal: 18 },

  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  balanceLabel: { color: colors.fgMuted, fontSize: 12.5, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 },
  balance: { color: colors.fg, fontSize: 46, fontWeight: '600', letterSpacing: -1.5 },
  cents: { color: colors.fgFaint, fontSize: 46, fontWeight: '600' },
  sub: { color: colors.fgFaint, fontSize: 13, marginTop: 6 },
  cashLine: { color: colors.accentGlow, fontSize: 12.5, fontWeight: '600', marginTop: 6 },

  // Weekly Top Trades — hero + ranked list (our own layout, not FOMO's carousel).
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  dotOn: { backgroundColor: colors.accent, width: 18 },
  wHero: { borderRadius: radius.lg, padding: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.accent + '3D' },
  wHeroHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wHeroTag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  wHeroTagText: { color: colors.accentGlow, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.3 },
  wTokenRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wTokenBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  wTokenText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  wTokenSym: { color: colors.fg, fontSize: 14, fontWeight: '700' },
  wHeroMid: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14 },
  wMult: { color: colors.accentGlow, fontSize: 46, fontWeight: '800', letterSpacing: -1.5 },
  wAmt: { color: colors.bull, fontSize: 18, fontWeight: '800' },
  wEntry: { color: colors.fgMuted, fontSize: 12.5, marginTop: 2 },
  wHeroFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  wAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  wInitial: { color: '#fff', fontSize: 12, fontWeight: '700' },
  wName: { color: colors.fg, fontSize: 14, fontWeight: '700' },
  wThesis: { color: colors.fgMuted, fontSize: 12.5, flex: 1, textAlign: 'right' },

  wRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, padding: 12, marginTop: 8, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  wRank: { color: colors.fgFaint, fontSize: 14, fontWeight: '800', width: 16, textAlign: 'center' },
  wRowName: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  wRowTokenLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  wTokenDot: { width: 12, height: 12, borderRadius: 6 },
  wRowToken: { color: colors.fgMuted, fontSize: 13 },
  wRowMult: { color: colors.accentGlow, fontSize: 17, fontWeight: '800' },
  wRowAmt: { color: colors.bull, fontSize: 13, fontWeight: '600', marginTop: 1 },
  depositWrap: { borderRadius: 15, shadowColor: colors.accent, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  deposit: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 15, paddingVertical: 14, paddingHorizontal: 20, overflow: 'hidden', backgroundColor: colors.accent },
  depositSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '62%' },
  depositText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 26 },
  sectionBar: { width: 3, height: 16, borderRadius: 2, backgroundColor: colors.accent },
  sectionTitle: { color: colors.fg, fontSize: 18, fontWeight: '600' },
  weekCard: { width: 178, borderRadius: radius.lg, padding: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  weekTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  weekAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  weekInitial: { color: '#fff', fontSize: 14, fontWeight: '600' },
  weekName: { color: colors.fg, fontSize: 16, fontWeight: '600', flex: 1 },
  weekBottom: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12 },
  weekToken: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  weekTokenText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  weekAmt: { color: colors.bull, fontSize: 17, fontWeight: '600' },

  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  chipIcon: { paddingHorizontal: 11 },
  chipOn: { borderColor: 'rgba(255,255,255,0.28)' },
  chipText: { color: colors.fgSecondary, fontSize: 15, fontWeight: '500' },
  chipTextActive: { color: colors.fg, fontWeight: '700' },
  newBadge: { backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  newText: { color: colors.onAccent, fontSize: 11, fontWeight: '700' },

  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.lg, padding: 14, marginTop: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  bannerText: { color: colors.fgSecondary, fontSize: 15, flex: 1 },
  bannerAccent: { color: colors.accent, fontWeight: '600' },

  list: { marginTop: 14, minHeight: 240 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 13, flex: 1 },
  rowText: { flex: 1 },
  ticker: { color: colors.fg, fontSize: 18, fontWeight: '600' },
  mc: { color: colors.fgMuted, fontSize: 14, marginTop: 2 },
  spark: { marginHorizontal: 12 },
  rowRight: { alignItems: 'flex-end', minWidth: 88 },
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
  feeClose: { alignSelf: 'stretch', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  feeCloseText: { color: colors.fg, fontSize: 16, fontWeight: '700' },
});
