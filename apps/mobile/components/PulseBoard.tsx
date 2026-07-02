import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  type LayoutChangeEvent,
  Linking,
  Pressable,
  ScrollView,
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
import { GlassFill } from './GlassFill';
import { GlassTabs } from './GlassTabs';
import { DragSheet } from './DragSheet';
import { ChainIcon } from './ChainIcon';
import { TwitterChip } from './TwitterChip';
import { xAvatarUrl, DEMO_KOL_TWEETS } from '../src/social';
import { getPulseFeed, explainToken } from '../src/api/endpoints';
import { getDemoPulse, makeLiveDemoToken } from '../src/demo/pulseDemo';
import { useTradeSubmit } from '../src/trade/useTradeSubmit';
import { useQuickBuyPrefs, usePulseSound, type SecondButton } from '../src/local';
import { showToast } from '../src/toast';
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

type ChainDef = { id: string; label: string; color: string };
// Solana-first: only `sol`/`all` carry demo data; other chains render an honest
// "coming" state until the backend serves their feeds. USDC routes the buy on any
// chain (FOMO-style), so this only gates which tokens you VIEW.
const CHAINS: ChainDef[] = [
  { id: 'all', label: 'All', color: colors.fgSecondary },
  { id: 'sol', label: 'SOL', color: '#14F195' },
  { id: 'eth', label: 'ETH', color: '#627EEA' },
  { id: 'base', label: 'Base', color: '#0052FF' },
  { id: 'bnb', label: 'BNB', color: '#F0B90B' },
];

type Filters = { minVol: number; minMc: number; minHolders: number };
const NO_FILTERS: Filters = { minVol: 0, minMc: 0, minHolders: 0 };
const VOL_OPTS = [
  { label: 'Any', value: 0 },
  { label: '$10K', value: 10_000 },
  { label: '$50K', value: 50_000 },
  { label: '$250K', value: 250_000 },
  { label: '$1M', value: 1_000_000 },
];
const MC_OPTS = [
  { label: 'Any', value: 0 },
  { label: '$50K', value: 50_000 },
  { label: '$250K', value: 250_000 },
  { label: '$1M', value: 1_000_000 },
  { label: '$10M', value: 10_000_000 },
];
const HOLDER_OPTS = [
  { label: 'Any', value: 0 },
  { label: '50', value: 50 },
  { label: '250', value: 250 },
  { label: '1K', value: 1_000 },
  { label: '5K', value: 5_000 },
];

function passesFilters(b: PulseBundle, f: Filters): boolean {
  const snap = b.snapshot;
  if (f.minVol && (snap?.volume_24h_usd ?? 0) < f.minVol) return false;
  if (f.minMc && (snap?.market_cap_usd ?? 0) < f.minMc) return false;
  if (f.minHolders && (snap?.holder_count ?? 0) < f.minHolders) return false;
  return true;
}

// Demo tracked-tweets carousel — real Solana KOLs (handles from the web seed) so
// the avatars are their actual X pics. Wire to the real X-monitor feed later.

type MarqueeEntity = { kind: 'ticker' | 'handle' | 'ca'; value: string };
// Bounded alternation (no unbounded quantifiers) → safe against ReDoS; matched
// values are only ever displayed, never executed.
const ENTITY_RE = /(\$[A-Za-z][A-Za-z0-9._]{0,14}|@[A-Za-z0-9_]{1,15}|[1-9A-HJ-NP-Za-km-z]{32,44})/g;

/** Split tweet text into plain runs + pressable $ticker / @handle / contract spans. */
function tweetTokens(text: string, onPress: (e: MarqueeEntity) => void): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  ENTITY_RE.lastIndex = 0;
  while ((m = ENTITY_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const raw = m[0];
    const kind: MarqueeEntity['kind'] = raw[0] === '$' ? 'ticker' : raw[0] === '@' ? 'handle' : 'ca';
    out.push(
      <Text key={`e${i}`} style={s.tweetEntity} onPress={() => onPress({ kind, value: raw })}>
        {raw}
      </Text>,
    );
    last = m.index + raw.length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Flash the row yellow briefly when a token's price ticks up. */
function useUptickFlash(price: number, flashOnMount = false) {
  const opacity = useRef(new Animated.Value(0)).current;
  const prev = useRef(price);
  const mounted = useRef(false);
  useEffect(() => {
    const doFlash = () =>
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 120, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]).start();
    if (!mounted.current) {
      mounted.current = true;
      if (flashOnMount) doFlash();
    } else if (price > prev.current && prev.current > 0) {
      doFlash();
    }
    prev.current = price;
  }, [price, opacity, flashOnMount]);
  return opacity;
}

export function PulseBoard({ onOpenToken }: { onOpenToken: (b: PulseBundle) => void }) {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(0);
  const [aiMint, setAiMint] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState<{ uri?: string | null; symbol: string } | null>(null);
  const [chain, setChain] = useState('sol');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [busy, setBusy] = useState<{ mint: string; side: 'buy' | 'sell' } | null>(null);
  const { submit, hasWallet } = useTradeSubmit();
  const qb = useQuickBuyPrefs();

  const q = useQuery({
    queryKey: ['pulse-board', chain],
    queryFn: async () => {
      // `all` uses Solana data for now (Solana-first); demo fallback only for the
      // chains we actually have demo tokens for.
      const fetchChain = chain === 'all' ? 'sol' : chain;
      const allowDemo = chain === 'sol' || chain === 'all';
      const fetchCol = (c: PulseColumn) =>
        getPulseFeed(c, fetchChain).catch(() => ({ items: [] } as unknown as PulseFeed));
      const [n, st, m] = await Promise.all(COLS.map((c) => fetchCol(c.key)));
      return [
        n.items?.length ? n.items : allowDemo ? getDemoPulse('new') : [],
        st.items?.length ? st.items : allowDemo ? getDemoPulse('stretch') : [],
        m.items?.length ? m.items : allowDemo ? getDemoPulse('migrated') : [],
      ] as PulseBundle[][];
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const data = q.data ?? [[], [], []];
  const items = data[active] ?? [];
  const accent = COLS[active].accent;
  const filtered = useMemo(() => items.filter((b) => passesFilters(b, filters)), [items, filters]);
  const activeFilters = (filters.minVol ? 1 : 0) + (filters.minMc ? 1 : 0) + (filters.minHolders ? 1 : 0);

  // Demo "live feed": fresh coins land in the New column so you SEE the yellow
  // flash + feel a haptic buzz. Demo-only (no real wallet), Solana view.
  const pulseSound = usePulseSound();
  const [injected, setInjected] = useState<PulseBundle[]>([]);
  useEffect(() => {
    setInjected([]);
    if (hasWallet || !(chain === 'sol' || chain === 'all')) return;
    const id = setInterval(() => {
      setInjected((prev) => [makeLiveDemoToken(), ...prev].slice(0, 6));
      if (pulseSound) Vibration.vibrate(20);
    }, 8000);
    return () => clearInterval(id);
  }, [hasWallet, chain, pulseSound]);
  const injectedMints = useMemo(() => new Set(injected.map((b) => b.token.mint)), [injected]);
  const display = useMemo(
    () => (active === 0 ? [...injected, ...filtered] : filtered),
    [active, injected, filtered],
  );

  const onQuick = useCallback(
    async (b: PulseBundle, side: 'buy' | 'sell', amountSol?: number) => {
      const sym = (b.token.symbol ?? '?').replace(/^\$/, '');
      const amt = amountSol ?? qb.sol;
      // No real wallet (demo / not signed in) → simulate the fill + drop into the token.
      if (!hasWallet) {
        Vibration.vibrate(12);
        showToast(`${side === 'buy' ? 'Bought' : 'Sold'} ${amt} SOL of ${sym}`, { sub: 'Demo order filled', kind: 'success' });
        onOpenToken(b);
        return;
      }
      try {
        setBusy({ mint: b.token.mint, side });
        Vibration.vibrate(8);
        await submit({ mint: b.token.mint, side, amountSol: amt });
        Vibration.vibrate(18);
        showToast(`${side === 'buy' ? 'Bought' : 'Sold'} ${amt} SOL of ${sym}`, { kind: 'success' });
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

  // Marquee taps: @handle → X, $ticker / CA → the referenced token's page.
  const onMarqueePress = useCallback(
    (e: MarqueeEntity) => {
      if (e.kind === 'handle') {
        Linking.openURL(`https://x.com/${e.value.replace(/^@/, '')}`).catch(() => undefined);
        return;
      }
      const needle = e.value.replace(/^\$/, '').toLowerCase();
      const all = data.flat();
      const hit =
        all.find((b) => (b.token.symbol ?? '').replace(/^\$/, '').toLowerCase() === needle) ??
        all.find((b) => (b.token.mint ?? '').toLowerCase() === e.value.toLowerCase());
      if (hit) onOpenToken(hit);
      else showToast(`${e.value} isn't on the board right now`, { kind: 'info' });
    },
    [data, onOpenToken],
  );

  return (
    <View style={[s.root, { paddingTop: insets.top + 6 }]}>
      <View style={s.header}>
        <Text style={s.title}>Pulse</Text>
      </View>

      <TweetMarquee onPressEntity={onMarqueePress} />

      {/* Chain selector + filters */}
      <View style={s.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chainScroll} contentContainerStyle={s.chainRow}>
          {CHAINS.map((c) => (
            <ChainPill
              key={c.id}
              chain={c}
              active={chain === c.id}
              onPress={() => {
                setChain(c.id);
                setAiMint(null);
              }}
            />
          ))}
        </ScrollView>
        <Pressable
          onPress={() => setFiltersOpen(true)}
          hitSlop={6}
          style={[s.filterBtn, activeFilters > 0 && s.filterBtnActive]}
        >
          <Ionicons name="options-outline" size={18} color={activeFilters > 0 ? colors.accentGlow : colors.fgSecondary} />
          {activeFilters > 0 ? (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeText}>{activeFilters}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Column tabs — glassy, matching the bottom nav island */}
      <GlassTabs
        style={s.glassTabs}
        tabs={COLS.map((c, i) => ({ key: c.key, label: c.label, count: data[i].filter((b) => passesFilters(b, filters)).length, accent: c.accent }))}
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
          data={display}
          keyExtractor={(it) => it.token.mint}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: insets.bottom + 96 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name={items.length ? 'options-outline' : 'pulse'} size={22} color={colors.fgFaint} />
              <Text style={s.emptyText}>
                {items.length
                  ? 'No tokens match your filters.'
                  : chain === 'sol' || chain === 'all'
                    ? `Quiet in ${COLS[active].label} right now.`
                    : `Solana-first for now — ${CHAINS.find((c) => c.id === chain)?.label ?? 'this chain'} feeds coming soon.`}
              </Text>
              {items.length ? (
                <Pressable onPress={() => setFilters(NO_FILTERS)} style={s.emptyClear}>
                  <Text style={s.emptyClearText}>Clear filters</Text>
                </Pressable>
              ) : null}
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
              onEnlarge={(b) => setEnlarged({ uri: b.token.image_url, symbol: (b.token.symbol ?? '?').replace(/^\$/, '') })}
              onEnlargeEnd={() => setEnlarged(null)}
              fresh={injectedMints.has(item.token.mint)}
            />
          )}
        />
      )}

      {filtersOpen ? (
        <DragSheet visible onClose={() => setFiltersOpen(false)}>
          <FilterSheet filters={filters} onChange={setFilters} onClose={() => setFiltersOpen(false)} />
        </DragSheet>
      ) : null}

      {enlarged ? (
        <View style={s.enlargeOverlay} pointerEvents="none">
          <View style={s.enlargeCard}>
            <CoinIcon uri={enlarged.uri} symbol={enlarged.symbol} size={208} />
            <Text style={s.enlargeSym}>{enlarged.symbol}</Text>
          </View>
        </View>
      ) : null}
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
  onEnlarge,
  onEnlargeEnd,
  fresh,
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
  onEnlarge: (b: PulseBundle) => void;
  onEnlargeEnd: () => void;
  fresh?: boolean;
}) {
  const { token, snapshot } = bundle;
  const sym = (token.symbol ?? '?').replace(/^\$/, '');
  const age = ageShort(token.created_at);
  const x = token.twitter_handle ? token.twitter_handle.replace(/^@/, '') : null;
  const flash = useUptickFlash(snapshot?.price_usd ?? 0, fresh);
  const busyBuy = busyMint === token.mint && busySide === 'buy';
  const busySell = busyMint === token.mint && busySide === 'sell';

  return (
    <View style={[s.rowWrap, aiOpen && { borderColor: accent + '88' }]}>
      <GlassFill />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.warn, opacity: flash }]}
      />
      <Pressable
        onPress={() => onOpen(bundle)}
        onLongPress={() => onLongPressAi(bundle)}
        delayLongPress={240}
        style={[s.row, ultra && s.rowUltraPad]}
      >
        {/* Tap opens the token; press-and-hold enlarges the avatar (web hover-zoom). */}
        <Pressable
          onPress={() => onOpen(bundle)}
          onLongPress={() => onEnlarge(bundle)}
          onPressOut={onEnlargeEnd}
          delayLongPress={260}
          hitSlop={4}
          style={s.coinWrap}
        >
          <CoinIcon uri={token.image_url} symbol={sym} size={42} />
          <ProtocolIcon launchPad={token.launch_pad} size={16} style={s.protoBadge} />
        </Pressable>

        <View style={s.mid}>
          <View style={s.midTop}>
            <Text style={s.sym} numberOfLines={1}>
              {sym}
            </Text>
            {age ? <Text style={s.age}>{age}</Text> : null}
            {x ? <TwitterChip value={x} size={22} /> : null}
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

        {ultra ? (
          <UltraDock
            secondButton={secondButton}
            secondSol={secondSol}
            primarySol={primarySol}
            busyBuy={busyBuy}
            busySell={busySell}
            onBuy={(amt) => onQuick(bundle, 'buy', amt)}
            onSell={() => onQuick(bundle, 'sell')}
          />
        ) : (
          <View style={s.actions}>
            {secondButton === 'sell' ? (
              <QuickBtn kind="sell" busy={busySell} onPress={() => onQuick(bundle, 'sell')} />
            ) : null}
            {secondButton === 'buy' ? (
              <QuickBtn kind="buy" label={String(secondSol)} busy={busyBuy} onPress={() => onQuick(bundle, 'buy', secondSol)} />
            ) : null}
            <QuickBtn kind="buy" big label={String(primarySol)} busy={busyBuy} onPress={() => onQuick(bundle, 'buy', primarySol)} />
          </View>
        )}
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

/**
 * Ultra mode: a tall outlined buy dock pinned to the right of the row, flush to
 * the row's top/bottom/right edges and stopping just past the MC (mirrors the web
 * Pulse Ultra outline). Tap to buy; an optional second buy/sell stacks above.
 */
function UltraDock({
  secondButton,
  secondSol,
  primarySol,
  busyBuy,
  busySell,
  onBuy,
  onSell,
}: {
  secondButton: SecondButton;
  secondSol: number;
  primarySol: number;
  busyBuy: boolean;
  busySell: boolean;
  onBuy: (amountSol: number) => void;
  onSell: () => void;
}) {
  return (
    <View style={s.ultraDock}>
      {secondButton === 'sell' ? (
        <Pressable style={[s.ultraCell, s.ultraCellSell]} onPress={onSell} disabled={busySell}>
          {busySell ? <ActivityIndicator size="small" color={colors.bear} /> : <Text style={s.ultraSellText}>Sell</Text>}
        </Pressable>
      ) : secondButton === 'buy' ? (
        <Pressable style={[s.ultraCell, s.ultraCellBuy]} onPress={() => onBuy(secondSol)} disabled={busyBuy}>
          {busyBuy ? (
            <ActivityIndicator size="small" color={colors.bull} />
          ) : (
            <>
              <Ionicons name="flash" size={13} color={colors.bull} />
              <Text style={s.ultraBuyText}>{secondSol}</Text>
            </>
          )}
        </Pressable>
      ) : null}
      <Pressable style={[s.ultraCell, s.ultraCellBuy, s.ultraCellPrimary]} onPress={() => onBuy(primarySol)} disabled={busyBuy}>
        {busyBuy ? (
          <ActivityIndicator color={colors.bull} />
        ) : (
          <>
            <Ionicons name="flash" size={16} color={colors.bull} />
            <Text style={s.ultraBuyTextBig}>{primarySol}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

function AiBrief({ mint }: { mint: string }) {
  const q = useQuery({
    queryKey: ['ai-explain', mint],
    queryFn: () => explainToken(mint, 'fast'),
    staleTime: 5 * 60_000,
    retry: 0,
  });

  // Strip the em/en dashes that scream "AI wrote this".
  const clean = (t: string) => t.replace(/\s*[—–]\s*/g, ', ').trim();

  let body: React.ReactNode;
  if (q.isLoading) {
    body = <Text style={s.aiText}>Pointer is reading the chain…</Text>;
  } else if (q.isError || !q.data?.data) {
    body = <Text style={s.aiText}>Sign in to get Pointer’s read on this token.</Text>;
  } else {
    const d = q.data.data;
    body = (
      <>
        <Text style={s.aiText}>{clean(d.summary)}</Text>
        {d.riskFlags?.length ? (
          <View style={s.aiFlags}>
            {d.riskFlags.slice(0, 3).map((f) => (
              <View key={f} style={s.aiFlag}>
                <Ionicons name="warning-outline" size={11} color={colors.warn} />
                <Text style={s.aiFlagText} numberOfLines={1}>
                  {clean(f)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </>
    );
  }

  return <View style={s.aiBox}>{body}</View>;
}

function ChainPill({ chain, active, onPress }: { chain: ChainDef; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chainPill, active && s.chainPillActive]}>
      <GlassFill active={active} />
      {chain.id === 'all' ? (
        <Ionicons name="apps" size={13} color={active ? colors.fg : colors.fgMuted} />
      ) : (
        <ChainIcon id={chain.id} size={17} />
      )}
      <Text style={[s.chainText, active && s.chainTextActive]}>{chain.label}</Text>
    </Pressable>
  );
}

function FilterSheet({
  filters,
  onChange,
  onClose,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onClose: () => void;
}) {
  return (
    <View style={s.filterSheet}>
      <Text style={s.filterTitle}>Filters</Text>
      <FilterGroup label="Min 24h volume" opts={VOL_OPTS} value={filters.minVol} onPick={(v) => onChange({ ...filters, minVol: v })} />
      <FilterGroup label="Min market cap" opts={MC_OPTS} value={filters.minMc} onPick={(v) => onChange({ ...filters, minMc: v })} />
      <FilterGroup label="Min holders" opts={HOLDER_OPTS} value={filters.minHolders} onPick={(v) => onChange({ ...filters, minHolders: v })} />
      <View style={s.filterActions}>
        <Pressable onPress={() => onChange(NO_FILTERS)} style={s.filterReset}>
          <GlassFill />
          <Text style={s.filterResetText}>Reset</Text>
        </Pressable>
        <Pressable onPress={onClose} style={s.filterDone}>
          <Text style={s.filterDoneText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FilterGroup({
  label,
  opts,
  value,
  onPick,
}: {
  label: string;
  opts: { label: string; value: number }[];
  value: number;
  onPick: (v: number) => void;
}) {
  return (
    <View style={s.filterGroup}>
      <Text style={s.filterGroupLabel}>{label}</Text>
      <View style={s.filterChips}>
        {opts.map((o) => (
          <Pressable key={o.label} onPress={() => onPick(o.value)} style={[s.filterChip, value === o.value && s.filterChipActive]}>
            <GlassFill active={value === o.value} />
            <Text style={[s.filterChipText, value === o.value && s.filterChipTextActive]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
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

function TweetMarquee({ onPressEntity }: { onPressEntity: (e: MarqueeEntity) => void }) {
  const [w, setW] = useState(0);
  const wRef = useRef(0);
  const x = useRef(new Animated.Value(0)).current;

  // Self-looping timing (vs Animated.loop) so a touch can pause it and resume from
  // the exact offset — otherwise tapping a moving entity is a coin toss.
  const run = useCallback(
    (from: number) => {
      const width = wRef.current;
      if (!width) return;
      const dur = Math.max(9000, width * 24);
      const firstLeg = Math.max(400, dur * ((width + from) / width));
      x.setValue(from);
      Animated.timing(x, { toValue: -width, duration: firstLeg, easing: Easing.linear, useNativeDriver: true }).start((res) => {
        if (res.finished) run(0);
      });
    },
    [x],
  );

  useEffect(() => {
    if (w) run(0);
    return () => x.stopAnimation();
  }, [w, run, x]);

  const measure = (e: LayoutChangeEvent) => {
    wRef.current = e.nativeEvent.layout.width;
    setW(e.nativeEvent.layout.width);
  };

  const strip = (first: boolean) => (
    <View style={s.marqueeStrip} onLayout={first ? measure : undefined}>
      {DEMO_KOL_TWEETS.map((t, i) => (
        <View key={`${first ? 'a' : 'b'}-${i}`} style={s.tweetChip}>
          <View style={s.tweetAvatar}>
            <Image source={{ uri: xAvatarUrl(t.handle) }} style={s.tweetAvatarImg} />
          </View>
          <Text style={s.tweetHandle} onPress={() => onPressEntity({ kind: 'handle', value: '@' + t.handle })}>
            @{t.handle}
          </Text>
          <Text style={s.tweetText} numberOfLines={1}>
            {tweetTokens(t.text, onPressEntity)}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <View
      style={s.marqueeWrap}
      onTouchStart={() => x.stopAnimation()}
      onTouchEnd={() => x.stopAnimation((v) => run(v))}
      onTouchCancel={() => x.stopAnimation((v) => run(v))}
    >
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

  enlargeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  enlargeCard: { alignItems: 'center', gap: 16 },
  enlargeSym: { color: colors.fg, fontSize: 22, fontWeight: '800' },

  marqueeWrap: { height: 30, marginTop: 12, marginHorizontal: 16, borderRadius: radius.sm, backgroundColor: colors.bgRaised, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', justifyContent: 'center' },
  marqueeTrack: { flexDirection: 'row', paddingLeft: 12 },
  marqueeStrip: { flexDirection: 'row', alignItems: 'center' },
  tweetChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 22 },
  tweetAvatar: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  tweetInitial: { color: colors.accentGlow, fontSize: 9, fontWeight: '800' },
  tweetHandle: { color: colors.accentGlow, fontSize: 11.5, fontWeight: '700', textDecorationLine: 'underline' },
  tweetText: { color: colors.fgMuted, fontSize: 11.5 },
  tweetAvatarImg: { width: 16, height: 16, borderRadius: 8 },
  tweetEntity: { color: colors.accentGlow, fontWeight: '700', textDecorationLine: 'underline' },

  mqSheet: { paddingHorizontal: 18, paddingTop: 2, paddingBottom: 14, gap: 10 },
  mqHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mqTitle: { color: colors.fg, fontSize: 20, fontWeight: '800', flexShrink: 1 },
  mqKind: { color: colors.fgFaint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  mqSummary: { color: colors.fgSecondary, fontSize: 14, lineHeight: 20 },
  mqMention: { backgroundColor: colors.bgRaised, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 3 },
  mqMentionHandle: { color: colors.accentGlow, fontSize: 12, fontWeight: '700' },
  mqMentionText: { color: colors.fgSecondary, fontSize: 13, lineHeight: 18 },
  mqFoot: { color: colors.fgFaint, fontSize: 11.5, marginTop: 2 },

  glassTabs: { marginHorizontal: 16, marginTop: 12 },

  controls: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, gap: 8 },
  chainScroll: { flex: 1 },
  chainRow: { gap: 7, alignItems: 'center', paddingRight: 4 },
  chainPill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 11, borderRadius: radius.pill, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  chainPillActive: { borderColor: 'rgba(255,255,255,0.28)' },
  chainDot: { width: 8, height: 8, borderRadius: 4 },
  chainText: { color: colors.fgMuted, fontSize: 12.5, fontWeight: '700' },
  chainTextActive: { color: colors.fg },
  filterBtn: { width: 38, height: 30, borderRadius: radius.sm, backgroundColor: colors.bgRaised, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { borderColor: colors.accent + '88', backgroundColor: colors.accentSoft },
  filterBadge: { position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterBadgeText: { color: '#04050A', fontSize: 10, fontWeight: '800' },

  emptyClear: { marginTop: 4, paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.bgRaised2, borderWidth: 1, borderColor: colors.border },
  emptyClearText: { color: colors.fgSecondary, fontSize: 12.5, fontWeight: '700' },

  filterSheet: { paddingHorizontal: 18, paddingTop: 2, paddingBottom: 14, gap: 16 },
  filterTitle: { color: colors.fg, fontSize: 20, fontWeight: '800' },
  filterGroup: { gap: 9 },
  filterGroupLabel: { color: colors.fgMuted, fontSize: 12.5, fontWeight: '700' },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { paddingHorizontal: 14, height: 34, borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { borderColor: 'rgba(255,255,255,0.28)' },
  filterChipText: { color: colors.fgSecondary, fontSize: 13.5, fontWeight: '700' },
  filterChipTextActive: { color: colors.fg },
  filterActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  filterReset: { flex: 1, height: 46, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  filterResetText: { color: colors.fgSecondary, fontSize: 15, fontWeight: '700' },
  filterDone: { flex: 1.4, height: 46, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  filterDoneText: { color: '#04050A', fontSize: 15, fontWeight: '800' },

  empty: { alignItems: 'center', gap: 9, paddingVertical: 70 },
  emptyText: { color: colors.fgFaint, fontSize: 14 },

  rowWrap: { borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', marginBottom: 7, overflow: 'hidden' },
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
  // Ultra: reserve the right column so token text stops just before the dock.
  rowUltraPad: { paddingRight: 124 },
  ultraDock: { position: 'absolute', top: 6, right: 6, bottom: 6, width: 108, flexDirection: 'column', gap: 6 },
  ultraCell: { flex: 1, borderRadius: 11, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  ultraCellBuy: { borderColor: colors.bull, backgroundColor: colors.bull + '12' },
  ultraCellSell: { borderColor: colors.bear + '99', backgroundColor: colors.bear + '10' },
  ultraCellPrimary: { flexGrow: 1.6 },
  ultraBuyText: { color: colors.bull, fontSize: 14, fontWeight: '800' },
  ultraBuyTextBig: { color: colors.bull, fontSize: 18, fontWeight: '800' },
  ultraSellText: { color: colors.bear, fontSize: 14, fontWeight: '800' },
  qbtn: { minWidth: 54, height: 32, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 11 },
  qbtnBig: { minWidth: 86, height: 40, borderRadius: 12, paddingHorizontal: 16, gap: 5 },
  qbtnBuy: { backgroundColor: colors.bull },
  qbtnBuyOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.bull },
  qbtnSell: { backgroundColor: colors.bearSoft, borderWidth: 1, borderColor: colors.bear + '55' },
  qbtnText: { fontSize: 14, fontWeight: '800', color: '#04050A' },
  qbtnTextBig: { fontSize: 16 },

  aiBox: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 18, paddingVertical: 14, gap: 9, backgroundColor: colors.bgSunken, alignItems: 'center' },
  aiText: { color: colors.fg, fontSize: 14.5, lineHeight: 21, textAlign: 'center', fontWeight: '500' },
  aiFlags: { gap: 4, alignItems: 'center' },
  aiFlag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  aiFlagText: { color: colors.warn, fontSize: 11.5 },
});
