import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, PanResponder, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { PressScale } from '../components/PressScale';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { XBadge } from '../components/XBadge';
import { CopyTradeSheet } from '../components/CopyTradeSheet';
import { PnlShareCard } from '../components/PnlShareCard';
import { GlassFill } from '../components/GlassFill';
import { GlossButton } from '../components/GlossButton';
import { colors, radius } from '../src/theme';
import { getDemoTrader, type TraderPosition } from '../src/demo/traders';
import { toggleFollow, useIsFollowing, useCopy } from '../src/local';
import { follow as apiFollow, unfollow as apiUnfollow } from '../src/api/social';
import { useAuth } from '../src/auth';
import { shareText } from '../src/share';
import type { PulseBundle } from '../src/types';

/** Build a token bundle from one of a trader's positions so tapping it opens the
 *  full token screen (demo — the position doesn't carry a live mint/snapshot). */
function positionToBundle(pos: TraderPosition): PulseBundle {
  const price = pos.heldAmount && pos.heldAmount > 0 ? pos.valueUsd / pos.heldAmount : Math.max(1e-8, pos.valueUsd / 1e6);
  const mc = price * 1e9;
  const mint = `D3mo${pos.sym.replace(/[^A-Za-z0-9]/g, '')}`.padEnd(24, '1').slice(0, 24);
  return {
    token: {
      mint,
      chain: 'sol',
      symbol: pos.sym,
      name: pos.name,
      decimals: 6,
      image_url: null,
      description: null,
      twitter_handle: null,
      telegram_url: null,
      website_url: null,
      creator_wallet: null,
      launch_pad: pos.verified ? 'pump' : null,
      raw_metadata: null,
      is_lp_locked: true,
      mint_authority: null,
      freeze_authority: null,
      bonding_progress: null,
      created_at: null,
    },
    snapshot: {
      market_cap_usd: mc,
      price_usd: price,
      liquidity_usd: mc * 0.12,
      volume_24h_usd: mc * 0.5,
      holder_count: 5_000,
      top10_holder_pct: null,
      dev_holding_pct: null,
      extended_metrics: null,
      snapshot_at: null,
    },
  };
}

const RANGES = ['24h', '7d', '30d'];
const RANGE_MULT = [1, 3.1, 6.6];

/* ---- formatters (no Intl — Hermes-safe) ---- */
function group(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function usd(n: number, dec = 2): string {
  const neg = n < 0;
  const [int, frac] = Math.abs(n).toFixed(dec).split('.');
  return `${neg ? '-' : ''}$${group(int)}${frac ? '.' + frac : ''}`;
}
function compactNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n));
}
function fmtAmount(n: number): string {
  const [int, frac] = n.toFixed(2).split('.');
  return `${group(int)}.${frac}`;
}

/** Green portfolio line + soft area fill. */
function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  const W = 360;
  const H = 150;
  const stroke = up ? colors.bull : colors.bear;
  const { line, area, lastX, lastY } = useMemo(() => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const span = max - min || 1;
    const pts = data.map((v, i) => {
      const x = (i / Math.max(1, data.length - 1)) * W;
      const y = H - ((v - min) / span) * (H - 16) - 8;
      return [x, y] as const;
    });
    const ln = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const last = pts[pts.length - 1];
    return { line: ln, area: `${ln} L${W} ${H} L0 ${H} Z`, lastX: last[0], lastY: last[1] };
  }, [data]);

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id="pgrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stroke} stopOpacity={0.22} />
          <Stop offset="1" stopColor={stroke} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#pgrad)" />
      <Path d={line} fill="none" stroke={stroke} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={lastX} cy={lastY} r={5} fill={stroke} />
    </Svg>
  );
}

type Status = 'open' | 'closed';
type Kind = 'all' | 'tokens' | 'perps';

export function TraderProfileScreen({
  handle,
  name,
  color,
  initial,
  onBack,
  onOpenToken,
}: {
  handle: string;
  name?: string;
  color?: string;
  initial?: string;
  onBack: () => void;
  onOpenToken: (b: PulseBundle) => void;
}) {
  const insets = useSafeAreaInsets();
  const p = useMemo(() => getDemoTrader(handle, { name, color, initial }), [handle, name, color, initial]);
  const auth = useAuth();
  const following = useIsFollowing(p.handle);
  // Local toggle for instant UI + the real one-way follow (drives notifications)
  // against the backend when signed in. Follow by X handle since that's what we
  // have for a trader; best-effort so a provisioning gap never blocks the tap.
  const onToggleFollow = () => {
    const wasFollowing = following;
    toggleFollow(p.handle);
    if (!auth.demo) {
      const ref = p.handle.replace(/^@/, '');
      (wasFollowing ? apiUnfollow('twitter', ref) : apiFollow('twitter', ref)).catch(() => {});
    }
  };
  const [range, setRange] = useState(0);
  const [status, setStatus] = useState<Status>('open');
  const [kind, setKind] = useState<Kind>('all');
  const [sortDesc, setSortDesc] = useState(true);
  const [copyOpen, setCopyOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePos, setSharePos] = useState<TraderPosition | null>(null);
  const copying = useCopy(p.handle);
  const topPos = p.open[0];

  // Slide-in on open + swipe-right to drag back (matches the token screen).
  const W = Dimensions.get('window').width;
  const tx = useRef(new Animated.Value(W)).current;
  useEffect(() => {
    Animated.timing(tx, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [tx]);
  const back = useRef(onBack);
  back.current = onBack;
  const pan = useRef(
    PanResponder.create({
      // Only claim a clearly horizontal drag, and once claimed don't yield to the
      // ScrollView — so a diagonal finger can't scroll the page up/down mid-swipe.
      onMoveShouldSetPanResponder: (_, g) => g.dx > 12 && g.dx > Math.abs(g.dy) * 2.2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        if (g.dx > 0) tx.setValue(g.dx); // horizontal only — never translate on Y
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

  const base = status === 'open' ? p.open : p.closed;
  const list = useMemo(() => {
    const byKind = kind === 'all' ? base : base.filter((x) => (kind === 'perps' ? x.kind === 'perp' : x.kind === 'token'));
    const metric = (x: TraderPosition) => (status === 'open' ? x.valueUsd : x.pnlUsd);
    return [...byKind].sort((a, b) => (sortDesc ? metric(b) - metric(a) : metric(a) - metric(b)));
  }, [base, kind, status, sortDesc]);

  const pnl = p.pnl24hUsd * RANGE_MULT[range];
  const chartData = range === 0 ? p.chart.slice(-16) : range === 1 ? p.chart.slice(-28) : p.chart;
  const dollars = Math.floor(p.portfolioUsd);
  const cents = Math.round((p.portfolioUsd - dollars) * 100);

  return (
    <Animated.View style={[s.root, { transform: [{ translateX: tx }] }]} {...pan.panHandlers}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 6, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* top bar */}
        <View style={s.topBar}>
          <PressScale onPress={onBack} to={0.85} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={colors.fgSecondary} />
          </PressScale>
          <View style={s.topIcons}>
            <PressScale onPress={() => setStatus('closed')} to={0.85} hitSlop={8}>
              <Ionicons name="time-outline" size={22} color={colors.fgSecondary} />
            </PressScale>
            <PressScale onPress={() => setShareOpen(true)} to={0.85} hitSlop={8}>
              <Ionicons name="share-outline" size={22} color={colors.fgSecondary} />
            </PressScale>
          </View>
        </View>

        {/* identity */}
        <View style={s.idRow}>
          <View style={[s.avatar, { backgroundColor: p.color }]}>
            <Text style={s.avatarText}>{p.initial}</Text>
          </View>
          <View style={s.idActions}>
            <PressScale
              onPress={() => shareText(`Watch ${p.handle} on Pointer.`, 'https://pointer-ton-orcin.vercel.app')}
              to={0.9}
              style={s.dmBtn}
            >
              <GlassFill />
              <Ionicons name="paper-plane-outline" size={20} color={colors.fg} />
            </PressScale>
            <PressScale onPress={onToggleFollow} to={0.94} style={[s.followBtn, following && s.followingBtn]}>
              <GlassFill active={following} />
              <Text style={[s.followText, following && s.followingText]}>{following ? 'Following' : 'Follow'}</Text>
            </PressScale>
          </View>
        </View>

        <View style={s.nameRow}>
          <Text style={s.name} numberOfLines={1}>
            {p.name}
          </Text>
          {p.xConnected ? <XBadge /> : null}
        </View>
        <Text style={s.handle}>{p.handle}</Text>

        <View style={s.statRow}>
          <Text style={s.statNum}>
            {p.following} <Text style={s.statLabel}>Following</Text>
          </Text>
          <Text style={s.statNum}>
            {compactNum(p.followers)} <Text style={s.statLabel}>Followers</Text>
          </Text>
        </View>

        {p.mutuals.length ? (
          <View style={s.mutualsRow}>
            <View style={s.mutualStack}>
              {p.mutuals.map((m, i) => (
                <View key={i} style={[s.mutualAvatar, { backgroundColor: m.color, marginLeft: i ? -8 : 0 }]} />
              ))}
            </View>
            <Text style={s.mutualsText}>{p.mutuals.length} mutuals following</Text>
          </View>
        ) : null}

        <View style={s.metaRow}>
          <Meta icon="time-outline" text={p.avgHold} />
          <Meta icon="swap-horizontal" text={`${p.trades} trades`} />
          <Meta icon="calendar-outline" text={p.joined} />
        </View>

        {/* COPY TRADE — the primary thing you do with a trader (FOMO copy model) */}
        {copying ? (
          <PressScale onPress={() => setCopyOpen(true)} to={0.97} style={s.copyCtaActive}>
            <GlassFill active />
            <Ionicons name="repeat" size={19} color={colors.bull} />
            <Text style={[s.copyCtaText, { color: colors.bull }]}>Copying · ${copying.sizeUsd.toLocaleString()}/trade</Text>
          </PressScale>
        ) : (
          <GlossButton onPress={() => setCopyOpen(true)} style={{ marginTop: 20 }}>
            <Ionicons name="repeat" size={19} color={colors.onAccent} />
            <Text style={s.copyCtaText}>Copy {p.name}'s trades</Text>
          </GlossButton>
        )}
        <Text style={s.copyCtaHint}>
          {copying
            ? `You copy @${p.handle.replace(/^@/, '')}'s buys at $${copying.sizeUsd.toLocaleString()} each. Tap to change or stop.`
            : 'Mirror their buys at a size you choose — you approve each one, nothing auto-fires.'}
        </Text>

        {/* portfolio value + range */}
        <View style={s.pnlRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.value}>
              {usd(dollars, 0)}
              <Text style={s.valueCents}>.{String(cents).padStart(2, '0')}</Text>
            </Text>
            <Text style={s.pnlSub}>
              <Text style={s.pnlUp}>+{usd(pnl)}</Text> <Text style={s.pnlRange}>{RANGES[range]}</Text>
            </Text>
          </View>
          <View style={s.ranges}>
            {RANGES.map((r, i) => (
              <PressScale key={r} onPress={() => setRange(i)} to={0.92} style={[s.range, i === range && s.rangeOn]}>
                <Text style={[s.rangeText, i === range && s.rangeTextOn]}>{r}</Text>
              </PressScale>
            ))}
          </View>
        </View>

        <Sparkline data={chartData} up />

        {/* total cash */}
        <View style={s.cashCard}>
          <View style={s.cashIcon}>
            <GlassFill />
            <Text style={s.cashGlyph}>$</Text>
          </View>
          <View>
            <Text style={s.cashLabel}>Total cash</Text>
            <Text style={s.cashValue}>{usd(p.totalCashUsd)}</Text>
          </View>
        </View>

        {/* positions header */}
        <View style={s.posHead}>
          <Text style={s.posTitle}>
            Positions <Text style={s.posCount}>({base.length})</Text>
          </Text>
          <View style={s.statusToggle}>
            <PressScale onPress={() => setStatus('open')} to={0.95} style={[s.statusBtn, status === 'open' && s.statusBtnOn]}>
              {status === 'open' ? <View style={s.statusDot} /> : null}
              <Text style={[s.statusText, status === 'open' && s.statusTextOn]}>Open</Text>
            </PressScale>
            <PressScale onPress={() => setStatus('closed')} to={0.95} style={[s.statusBtn, status === 'closed' && s.statusBtnOnDark]}>
              <Text style={[s.statusText, status === 'closed' && s.statusTextOn]}>Closed</Text>
            </PressScale>
          </View>
        </View>

        {/* kind filter + sort */}
        <View style={s.filterRow}>
          <View style={s.kindTabs}>
            {(['all', 'tokens', 'perps'] as Kind[]).map((k) => (
              <PressScale key={k} onPress={() => setKind(k)} to={0.95} style={[s.kindTab, kind === k && s.kindTabOn]}>
                <Text style={[s.kindText, kind === k && s.kindTextOn]}>
                  {k === 'all' ? 'All' : k === 'tokens' ? 'Tokens' : 'Perps'}
                </Text>
              </PressScale>
            ))}
          </View>
          <PressScale onPress={() => setSortDesc((d) => !d)} to={0.9} hitSlop={6} style={s.sortBtn}>
            <Text style={s.sortText}>Top trades</Text>
            <Ionicons name={sortDesc ? 'arrow-down' : 'arrow-up'} size={14} color={colors.fgMuted} />
          </PressScale>
        </View>

        {list.length ? (
          list.map((pos, i) => (
            <PositionRow
              key={`${pos.sym}-${i}`}
              pos={pos}
              status={status}
              onOpen={() => onOpenToken(positionToBundle(pos))}
              onShare={() => setSharePos(pos)}
            />
          ))
        ) : (
          <Text style={s.noPos}>No {status} positions</Text>
        )}
      </ScrollView>

      <CopyTradeSheet
        visible={copyOpen}
        onClose={() => setCopyOpen(false)}
        trader={{ handle: p.handle, name: p.name, color: p.color, initial: p.initial, xConnected: p.xConnected }}
      />

      {topPos ? (
        <PnlShareCard
          visible={shareOpen}
          onClose={() => setShareOpen(false)}
          symbol={topPos.sym}
          name={topPos.name}
          pnlUsd={topPos.pnlUsd}
          pnlPct={topPos.pnlPct}
          investedUsd={Math.max(0, topPos.valueUsd - topPos.pnlUsd)}
        />
      ) : null}

      {sharePos ? (
        <PnlShareCard
          visible
          onClose={() => setSharePos(null)}
          symbol={sharePos.sym}
          name={sharePos.name}
          pnlUsd={sharePos.pnlUsd}
          pnlPct={sharePos.pnlPct}
          investedUsd={Math.max(0, sharePos.valueUsd - sharePos.pnlUsd)}
        />
      ) : null}
    </Animated.View>
  );
}

function PositionRow({
  pos,
  status,
  onOpen,
  onShare,
}: {
  pos: TraderPosition;
  status: Status;
  onOpen: () => void;
  onShare: () => void;
}) {
  return (
    <View style={s.posRow}>
      <PressScale onPress={onOpen} to={0.98} style={s.posTapZone}>
        <View style={[s.posIcon, { backgroundColor: pos.color }]}>
          <Text style={s.posInitial}>{pos.initial}</Text>
          {pos.verified ? (
            <View style={s.posVerified}>
              <VerifiedBadge size={16} />
            </View>
          ) : null}
        </View>
        <View style={s.posMid}>
          <Text style={s.posSym} numberOfLines={1}>
            {pos.sym}
          </Text>
          <Text style={s.posSub} numberOfLines={1}>
            {status === 'closed' ? pos.dateLabel : `${fmtAmount(pos.heldAmount ?? 0)} ${pos.sym}`}
          </Text>
        </View>
      </PressScale>
      <PressScale onPress={onShare} to={0.9} hitSlop={8} style={s.posRight}>
        <View style={s.posValueLine}>
          <Text style={[s.posValue, status === 'closed' && s.posValueGain]}>
            {status === 'closed' ? `+${usd(pos.pnlUsd)}` : usd(pos.valueUsd)}
          </Text>
          <Ionicons name="share-outline" size={12} color={colors.fgMuted} />
        </View>
        <Text style={s.posPct}>▲ {pos.pnlPct.toFixed(2)}%</Text>
      </PressScale>
    </View>
  );
}

function Meta({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={s.meta}>
      <Ionicons name={icon} size={14} color={colors.fgMuted} />
      <Text style={s.metaText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topIcons: { flexDirection: 'row', gap: 20 },

  idRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  idActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dmBtn: { width: 48, height: 44, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  followBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', borderRadius: 12, paddingHorizontal: 26, height: 44, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  followingBtn: { borderColor: 'rgba(255,255,255,0.28)' },
  followText: { color: colors.fg, fontSize: 16, fontWeight: '700' },
  followingText: { color: colors.fgSecondary },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14 },
  name: { color: colors.fg, fontSize: 30, fontWeight: '800', letterSpacing: -0.5, flexShrink: 1 },
  xBadge: { width: 24, height: 24, borderRadius: 7, backgroundColor: colors.bgRaised2, alignItems: 'center', justifyContent: 'center' },
  handle: { color: colors.fgMuted, fontSize: 16, marginTop: 2 },

  statRow: { flexDirection: 'row', gap: 24, marginTop: 16 },
  statNum: { color: colors.fg, fontSize: 16, fontWeight: '800' },
  statLabel: { color: colors.fgMuted, fontWeight: '500' },

  mutualsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  mutualStack: { flexDirection: 'row' },
  mutualAvatar: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.bg },
  mutualsText: { color: colors.fgSecondary, fontSize: 15 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: colors.fgMuted, fontSize: 14 },

  copyCtaActive: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 14, paddingVertical: 15, marginTop: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.bull + '66' },
  copyCtaText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },
  copyCtaHint: { color: colors.fgMuted, fontSize: 12.5, lineHeight: 17, marginTop: 8 },

  pnlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 26 },
  value: { color: colors.fg, fontSize: 40, fontWeight: '800', letterSpacing: -1.2 },
  valueCents: { color: colors.fgFaint },
  pnlSub: { fontSize: 16, marginTop: 4 },
  pnlUp: { color: colors.bull, fontWeight: '700' },
  pnlRange: { color: colors.fgMuted },
  uRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  uTxt: { fontSize: 13, fontWeight: '700' },
  uLabel: { color: colors.fgFaint, fontSize: 11, fontWeight: '600', marginLeft: 2 },
  ranges: { flexDirection: 'row', gap: 5, marginTop: 8 },
  range: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm },
  rangeOn: { backgroundColor: colors.bgRaised2 },
  rangeText: { color: colors.fgMuted, fontSize: 14, fontWeight: '600' },
  rangeTextOn: { color: colors.fg },

  cashCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  cashIcon: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  cashGlyph: { color: colors.fg, fontSize: 22, fontWeight: '700' },
  cashLabel: { color: colors.fgMuted, fontSize: 15 },
  cashValue: { color: colors.fg, fontSize: 22, fontWeight: '700', marginTop: 2 },

  posHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28 },
  posTitle: { color: colors.fg, fontSize: 22, fontWeight: '800' },
  posCount: { color: colors.fgFaint, fontWeight: '700' },
  statusToggle: { flexDirection: 'row', backgroundColor: colors.bgRaised, borderRadius: radius.pill, padding: 3 },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 32, borderRadius: radius.pill },
  statusBtnOn: { backgroundColor: colors.accentSoft },
  statusBtnOnDark: { backgroundColor: colors.bgRaised2 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accentGlow },
  statusText: { color: colors.fgMuted, fontSize: 14, fontWeight: '700' },
  statusTextOn: { color: colors.fg },

  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  kindTabs: { flexDirection: 'row', gap: 8 },
  kindTab: { paddingHorizontal: 16, height: 34, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  kindTabOn: { backgroundColor: colors.bgRaised2, borderColor: colors.borderStrong },
  kindText: { color: colors.fgMuted, fontSize: 14, fontWeight: '700' },
  kindTextOn: { color: colors.fg },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortText: { color: colors.fgMuted, fontSize: 14, fontWeight: '600' },

  noPos: { color: colors.fgFaint, fontSize: 15, textAlign: 'center', paddingVertical: 40 },

  posRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13 },
  posTapZone: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 13 },
  posIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  posInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
  posVerified: { position: 'absolute', bottom: -1, right: -2 },
  posMid: { flex: 1, gap: 3 },
  posSym: { color: colors.fg, fontSize: 18, fontWeight: '700' },
  posSub: { color: colors.fgMuted, fontSize: 13.5 },
  posRight: { alignItems: 'flex-end', gap: 3 },
  posValueLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  posValue: { color: colors.fg, fontSize: 18, fontWeight: '700' },
  posValueGain: { color: colors.bull },
  posPct: { color: colors.bull, fontSize: 14, fontWeight: '600' },
});
