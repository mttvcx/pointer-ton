import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { CoinIcon } from './CoinIcon';
import { ProtocolIcon } from './ProtocolIcon';
import { GlassTabs } from './GlassTabs';
import { getPulseFeed, explainToken } from '../src/api/endpoints';
import { getDemoPulse } from '../src/demo/pulseDemo';
import { useTradeSubmit } from '../src/trade/useTradeSubmit';
import { useQuickBuyPrefs, type SecondButton } from '../src/local';
import { ageShort, compactUsd } from '../src/format';
import { colors, radius } from '../src/theme';
import type { PulseBundle, PulseColumn, PulseFeed } from '../src/types';

/**
 * ADVANCED-MODE HOME — the operator screener. DexScreener-style dense list with
 * glassy New / Stretch / Migrated tabs, real protocol icons, Vol/MC rows, a real
 * quick-buy (primary + optional second buy/sell), an "Ultra" mode where the whole
 * row is a tap-to-buy outline, a yellow flash on an uptick, and press-and-hold →
 * cached AI brief. Tap a row → full buy/sell sheet (token screen). Falls back to
 * demo data so the board is never empty.
 */

type ColDef = { key: PulseColumn; label: string; accent: string };
const COLS: ColDef[] = [
  { key: 'new', label: 'New', accent: colors.accent },
  { key: 'stretch', label: 'Stretch', accent: colors.warn },
  { key: 'migrated', label: 'Migrated', accent: colors.bull },
];

// Demo tracked-tweets carousel (wire to the real X-monitor feed later).
const DEMO_TWEETS = [
  { handle: 'cupseyy', text: 'aped $piss — chart primed, 30 buys in 8h' },
  { handle: 'Euris', text: '$SPCX69 holding the 8% dip, smart money still in' },
  { handle: 'absol', text: 'new CA from a wallet I track → $XGIFT, 827% 24h' },
  { handle: 'kev', text: '$world.xyz quietly climbing, 174k liq' },
  { handle: 'Tibbz', text: 'watching $RTM, 993% but liq thin — careful' },
];

/** Flash the row yellow briefly when a token's price ticks up. */
function useUptickFlash(price: number) {
  const opacity = useRef(new Animated.Value(0)).current;
  const prev = useRef(price);
  useEffect(() => {
    if (price > prev.current && prev.current > 0) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 120, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
    prev.current = price;
  }, [price, opacity]);
  return opacity;
}

export function PulseBoard({ onOpenToken }: { onOpenToken: (b: PulseBundle) => void }) {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(0);
  const [aiMint, setAiMint] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ mint: string; side: 'buy' | 'sell' } | null>(null);
  const { submit, hasWallet } = useTradeSubmit();
  const qb = useQuickBuyPrefs();

  const q = useQuery({
    queryKey: ['pulse-board', 'sol'],
    queryFn: async () => {
      const fetchCol = (c: PulseColumn) =>
        getPulseFeed(c, 'sol').catch(() => ({ items: [] } as unknown as PulseFeed));
      const [n, st, m] = await Promise.all(COLS.map((c) => fetchCol(c.key)));
      // Live feed first; fall back to demo data so the screener is never empty.
      return [
        n.items?.length ? n.items : getDemoPulse('new'),
        st.items?.length ? st.items : getDemoPulse('stretch'),
        m.items?.length ? m.items : getDemoPulse('migrated'),
      ] as PulseBundle[][];
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const data = q.data ?? [[], [], []];
  const items = data[active] ?? [];
  const accent = COLS[active].accent;

  const onQuick = useCallback(
    async (b: PulseBundle, side: 'buy' | 'sell', amountSol?: number) => {
      // No real wallet (demo / not signed in) → open the full sheet instead.
      if (!hasWallet) {
        onOpenToken(b);
        return;
      }
      try {
        setBusy({ mint: b.token.mint, side });
        Vibration.vibrate(8);
        await submit({ mint: b.token.mint, side, amountSol: amountSol ?? qb.sol });
        Vibration.vibrate(18);
      } catch (e) {
        Alert.alert(side === 'buy' ? 'Buy failed' : 'Sell failed', e instanceof Error ? e.message : 'Try again.');
      } finally {
        setBusy(null);
      }
    },
    [hasWallet, submit, qb.sol, onOpenToken],
  );

  const onLongPressAi = useCallback((b: PulseBundle) => {
    Vibration.vibrate(10);
    setAiMint((m) => (m === b.token.mint ? null : b.token.mint));
  }, []);

  return (
    <View style={[s.root, { paddingTop: insets.top + 6 }]}>
      <View style={s.header}>
        <Text style={s.title}>Pulse</Text>
        {!hasWallet ? <Text style={s.demoTag}>demo · tap a row to trade</Text> : null}
      </View>

      <TweetMarquee />

      {/* Column tabs — glassy, matching the bottom nav island */}
      <GlassTabs
        style={s.glassTabs}
        tabs={COLS.map((c, i) => ({ key: c.key, label: c.label, count: data[i].length, accent: c.accent }))}
        activeIndex={active}
        onChange={(i) => {
          setActive(i);
          setAiMint(null);
        }}
      />

      {q.isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.token.mint}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: insets.bottom + 96 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="pulse" size={22} color={colors.fgFaint} />
              <Text style={s.emptyText}>Quiet in {COLS[active].label} right now.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TokenRow
              bundle={item}
              accent={accent}
              ultra={qb.ultra}
              primarySol={qb.sol}
              secondButton={qb.secondButton}
              secondSol={qb.secondSol}
              busyMint={busy?.mint ?? null}
              busySide={busy?.side ?? null}
              aiOpen={aiMint === item.token.mint}
              onOpen={onOpenToken}
              onLongPressAi={onLongPressAi}
              onQuick={onQuick}
            />
          )}
        />
      )}
    </View>
  );
}

function TokenRow({
  bundle,
  accent,
  ultra,
  primarySol,
  secondButton,
  secondSol,
  busyMint,
  busySide,
  aiOpen,
  onOpen,
  onLongPressAi,
  onQuick,
}: {
  bundle: PulseBundle;
  accent: string;
  ultra: boolean;
  primarySol: number;
  secondButton: SecondButton;
  secondSol: number;
  busyMint: string | null;
  busySide: 'buy' | 'sell' | null;
  aiOpen: boolean;
  onOpen: (b: PulseBundle) => void;
  onLongPressAi: (b: PulseBundle) => void;
  onQuick: (b: PulseBundle, side: 'buy' | 'sell', amountSol?: number) => void;
}) {
  const { token, snapshot } = bundle;
  const sym = (token.symbol ?? '?').replace(/^\$/, '');
  const age = ageShort(token.created_at);
  const x = token.twitter_handle ? token.twitter_handle.replace(/^@/, '') : null;
  const flash = useUptickFlash(snapshot?.price_usd ?? 0);
  const busyBuy = busyMint === token.mint && busySide === 'buy';
  const busySell = busyMint === token.mint && busySide === 'sell';

  return (
    <View style={[s.rowWrap, aiOpen && { borderColor: accent + '88' }]}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.warn, opacity: flash }]}
      />
      <Pressable
        onPress={() => onOpen(bundle)}
        onLongPress={() => onLongPressAi(bundle)}
        delayLongPress={240}
        style={s.row}
      >
        {/* Avatar always opens the token (even in Ultra, where the row buys) */}
        <Pressable onPress={() => onOpen(bundle)} hitSlop={4} style={s.coinWrap}>
          <CoinIcon uri={token.image_url} symbol={sym} size={42} />
          <ProtocolIcon launchPad={token.launch_pad} size={16} style={s.protoBadge} />
        </Pressable>

        <View style={s.mid}>
          <View style={s.midTop}>
            <Text style={s.sym} numberOfLines={1}>
              {sym}
            </Text>
            {age ? <Text style={s.age}>{age}</Text> : null}
            {x ? <LinkChip icon="logo-twitter" url={`https://x.com/${x}`} /> : null}
            {token.website_url ? <LinkChip icon="globe-outline" url={token.website_url} /> : null}
            {token.telegram_url ? <LinkChip icon="paper-plane-outline" url={token.telegram_url} /> : null}
          </View>
          {token.name ? (
            <Text style={s.name} numberOfLines={1}>
              {token.name}
            </Text>
          ) : null}
          <View style={s.metrics}>
            <Metric label="VOL" value={compactUsd(snapshot?.volume_24h_usd)} />
            <Metric label="MC" value={compactUsd(snapshot?.market_cap_usd)} />
          </View>
        </View>

        <View style={s.actions}>
          {secondButton === 'sell' ? (
            <QuickBtn kind="sell" outline={ultra} busy={busySell} onPress={() => onQuick(bundle, 'sell')} />
          ) : null}
          {secondButton === 'buy' ? (
            <QuickBtn kind="buy" outline={ultra} label={String(secondSol)} busy={busyBuy} onPress={() => onQuick(bundle, 'buy', secondSol)} />
          ) : null}
          <QuickBtn kind="buy" big outline={ultra} label={String(primarySol)} busy={busyBuy} onPress={() => onQuick(bundle, 'buy', primarySol)} />
        </View>
      </Pressable>

      {aiOpen ? <AiBrief mint={token.mint} /> : null}
    </View>
  );
}

function QuickBtn({
  kind,
  big,
  outline,
  label,
  busy,
  onPress,
}: {
  kind: 'buy' | 'sell';
  big?: boolean;
  outline?: boolean;
  label?: string;
  busy: boolean;
  onPress: () => void;
}) {
  const buy = kind === 'buy';
  const fg = buy ? (outline ? colors.bull : '#04050A') : colors.bear;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={[s.qbtn, big && s.qbtnBig, buy ? (outline ? s.qbtnBuyOutline : s.qbtnBuy) : s.qbtnSell, busy && { opacity: 0.6 }]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : buy ? (
        <>
          <Ionicons name="flash" size={big ? 14 : 12} color={fg} />
          <Text style={[s.qbtnText, big && s.qbtnTextBig, { color: fg }]}>{label}</Text>
        </>
      ) : (
        <Text style={[s.qbtnText, { color: colors.bear }]}>Sell</Text>
      )}
    </Pressable>
  );
}

function AiBrief({ mint }: { mint: string }) {
  const q = useQuery({
    queryKey: ['ai-explain', mint],
    queryFn: () => explainToken(mint, 'fast'),
    staleTime: 5 * 60_000,
    retry: 0,
  });

  let body: React.ReactNode;
  if (q.isLoading) {
    body = (
      <View style={s.aiLoading}>
        <ActivityIndicator size="small" color={colors.accentGlow} />
        <Text style={s.aiMuted}>Pointer AI reading the chain…</Text>
      </View>
    );
  } else if (q.isError || !q.data?.data) {
    body = <Text style={s.aiMuted}>AI brief unavailable — sign in / try the token screen.</Text>;
  } else {
    const d = q.data.data;
    body = (
      <>
        <Text style={s.aiSummary}>{d.summary}</Text>
        {d.riskFlags?.length ? (
          <View style={s.aiFlags}>
            {d.riskFlags.slice(0, 3).map((f) => (
              <View key={f} style={s.aiFlag}>
                <Ionicons name="warning-outline" size={11} color={colors.warn} />
                <Text style={s.aiFlagText} numberOfLines={1}>
                  {f}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </>
    );
  }

  return (
    <View style={s.aiBox}>
      <View style={s.aiHead}>
        <Ionicons name="sparkles" size={12} color={colors.accentGlow} />
        <Text style={s.aiHeadText}>AI brief{q.data?.cacheHit || q.data?.fromCache ? ' · cached' : ''}</Text>
      </View>
      {body}
    </View>
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

function LinkChip({ icon, url }: { icon: keyof typeof Ionicons.glyphMap; url: string }) {
  return (
    <Pressable onPress={() => Linking.openURL(url).catch(() => undefined)} hitSlop={6} style={s.linkChip}>
      <Ionicons name={icon} size={12} color={colors.fgMuted} />
    </Pressable>
  );
}

function TweetMarquee() {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!w) return;
    x.setValue(0);
    const anim = Animated.loop(
      Animated.timing(x, { toValue: -w, duration: Math.max(8000, w * 22), easing: Easing.linear, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [w, x]);

  const strip = (measure: boolean) => (
    <View style={s.marqueeStrip} onLayout={measure ? (e) => setW(e.nativeEvent.layout.width) : undefined}>
      {DEMO_TWEETS.map((t, i) => (
        <View key={`${measure ? 'a' : 'b'}-${i}`} style={s.tweetChip}>
          <View style={s.tweetAvatar}>
            <Text style={s.tweetInitial}>{t.handle.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={s.tweetHandle}>@{t.handle}</Text>
          <Text style={s.tweetText} numberOfLines={1}>
            {t.text}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={s.marqueeWrap}>
      <Animated.View style={[s.marqueeTrack, { transform: [{ translateX: x }] }]}>
        {strip(true)}
        {strip(false)}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  title: { color: colors.fg, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  demoTag: { color: colors.fgFaint, fontSize: 11, fontWeight: '600' },

  marqueeWrap: { height: 30, marginTop: 12, marginHorizontal: 16, borderRadius: radius.sm, backgroundColor: colors.bgRaised, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', justifyContent: 'center' },
  marqueeTrack: { flexDirection: 'row', paddingLeft: 12 },
  marqueeStrip: { flexDirection: 'row', alignItems: 'center' },
  tweetChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 22 },
  tweetAvatar: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  tweetInitial: { color: colors.accentGlow, fontSize: 9, fontWeight: '800' },
  tweetHandle: { color: colors.fgSecondary, fontSize: 11.5, fontWeight: '700' },
  tweetText: { color: colors.fgMuted, fontSize: 11.5 },

  glassTabs: { marginHorizontal: 16, marginTop: 12 },

  empty: { alignItems: 'center', gap: 9, paddingVertical: 70 },
  emptyText: { color: colors.fgFaint, fontSize: 14 },

  rowWrap: { backgroundColor: colors.bgRaised, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: 7, overflow: 'hidden' },
  rowUltra: { borderColor: colors.bull + '66', borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 10 },
  coinWrap: { width: 42, height: 42 },
  protoBadge: { position: 'absolute', bottom: -1, right: -1, borderWidth: 2, borderColor: colors.bgRaised },

  mid: { flex: 1, gap: 3 },
  midTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sym: { color: colors.fg, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  age: { color: colors.fgFaint, fontSize: 11, fontWeight: '600' },
  name: { color: colors.fgMuted, fontSize: 12 },
  metrics: { flexDirection: 'row', gap: 16, marginTop: 1 },
  metric: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  metricLabel: { color: colors.fgFaint, fontSize: 10, fontWeight: '700' },
  metricValue: { color: colors.fgSecondary, fontSize: 13, fontWeight: '700' },
  linkChip: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgRaised2 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ultraSide: { alignItems: 'flex-end', gap: 6 },
  ultraBuy: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ultraBuyText: { color: colors.bull, fontSize: 15, fontWeight: '800' },
  qbtn: { minWidth: 54, height: 32, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 11 },
  qbtnBig: { minWidth: 86, height: 40, borderRadius: 12, paddingHorizontal: 16, gap: 5 },
  qbtnBuy: { backgroundColor: colors.bull },
  qbtnBuyOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.bull },
  qbtnSell: { backgroundColor: colors.bearSoft, borderWidth: 1, borderColor: colors.bear + '55' },
  qbtnText: { fontSize: 14, fontWeight: '800', color: '#04050A' },
  qbtnTextBig: { fontSize: 16 },

  aiBox: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, gap: 6, backgroundColor: colors.bgSunken },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  aiHeadText: { color: colors.accentGlow, fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  aiSummary: { color: colors.fgSecondary, fontSize: 13, lineHeight: 18 },
  aiLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiMuted: { color: colors.fgMuted, fontSize: 12.5 },
  aiFlags: { gap: 4 },
  aiFlag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  aiFlagText: { color: colors.warn, fontSize: 11.5, flex: 1 },
});
