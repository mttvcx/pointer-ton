import React, { useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DragSheet } from './DragSheet';
import { CoinIcon } from './CoinIcon';
import { PressScale } from './PressScale';
import { GlassFill } from './GlassFill';
import { SheetButton } from './SheetButton';
import { Keypad, applyKey } from './Keypad';
import { PerpCandles } from './PerpCandles';
import { PerpTransferSheet } from './PerpTransferSheet';
import { API_URL } from '../src/env';
import { colors, radius } from '../src/theme';
import { usd } from '../src/format';
import { showToast } from '../src/toast';
import { acceptGeo, useGeoAccepted, usePerpsCash } from '../src/local';
import type { PerpMarket } from '../src/types';

const PRESETS = [10, 50, 100, 300];
const WHEEL_ITEM = 72; // px per leverage tick

const iconUri = (m: PerpMarket) => (/\.png$/i.test(m.iconSrc) ? `${API_URL}${m.iconSrc}` : null);
const px = (n: number) => usd(n, n >= 1 ? 2 : 4);

/**
 * Perps order entry (FOMO-parity): margin keypad, a snapping leverage wheel,
 * live leveraged size + liquidation price, SL/TP entry, and a keypad⇄chart toggle.
 * Gated by a one-time "outside the U.S." jurisdiction check. Perps run on a
 * separate cash balance, so the CTA routes to "Transfer cash" when perps cash is
 * short. Order signing isn't shipped yet (matches web's Preview), so the final
 * Long/Short is an honest "coming soon" rather than a faked fill.
 */
export function PerpTradeSheet({
  market,
  side,
  visible,
  onClose,
}: {
  market: PerpMarket | null;
  side: 'long' | 'short';
  visible: boolean;
  onClose: () => void;
}) {
  const geoAccepted = useGeoAccepted();
  const perpsCash = usePerpsCash();
  const [value, setValue] = useState('0');
  const [lev, setLev] = useState(20);
  const [mode, setMode] = useState<'keypad' | 'chart'>('keypad');
  const [sltp, setSltp] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [checked, setChecked] = useState(false);

  const maxLev = market?.maxLeverage ?? 40;
  const margin = Number(value) || 0;
  const size = margin * lev;
  const mark = market?.mark ?? 0;
  const liq = margin > 0 ? (side === 'long' ? mark * (1 - 1 / lev) : mark * (1 + 1 / lev)) : null;

  const close = () => {
    setValue('0');
    setSltp(false);
    setMode('keypad');
    onClose();
  };

  if (!market) return null;

  // --- jurisdiction gate (first perp trade only) ---
  if (!geoAccepted) {
    return (
      <DragSheet visible={visible} onClose={close}>
        <View style={s.geoIcon}>
          <Ionicons name="earth" size={30} color={colors.accentGlow} />
        </View>
        <Text style={s.geoTitle}>Are you outside the United States?</Text>
        <Text style={s.geoBody}>
          Leveraged perps aren’t available to U.S. persons. Confirm your eligibility to continue — this is asked once.
        </Text>
        <PressScale onPress={() => setChecked((c) => !c)} to={0.98} style={s.check}>
          <View style={[s.box, checked && s.boxOn]}>{checked ? <Ionicons name="checkmark" size={15} color={colors.onAccent} /> : null}</View>
          <Text style={s.checkText}>I am not a U.S. Person and I’m outside the United States.</Text>
        </PressScale>
        <SheetButton
          label="Continue"
          variant={checked ? 'blue' : 'disabled'}
          onPress={() => {
            if (checked) acceptGeo();
          }}
          style={{ marginTop: 18 }}
        />
      </DragSheet>
    );
  }

  const up = market.chg24 >= 0;
  const overCash = margin > perpsCash;
  const ctaVariant = margin <= 0 ? 'disabled' : overCash ? 'blue' : side === 'long' ? 'long' : 'short';
  const ctaLabel =
    margin <= 0 ? 'Enter an amount' : overCash ? 'Transfer cash' : side === 'long' ? 'Long' : 'Short';

  const onCta = () => {
    if (margin <= 0) return;
    if (overCash) {
      setTransfer(true);
      return;
    }
    showToast(`${side === 'long' ? 'Long' : 'Short'} ${market.coin} · ${usd(size, 0)} @ ${lev}x`, {
      sub: 'Live market data now; one-tap order signing lands next',
      kind: 'info',
    });
    close();
  };

  return (
    <>
      <DragSheet visible={visible} onClose={close}>
        <View style={s.head}>
          <View style={s.iconWrap}>
            <CoinIcon uri={iconUri(market)} symbol={market.coin} size={40} verified />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.coin}>{market.coin}</Text>
            <Text style={s.oi}>{compact(market.oiUsd)} OI</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.price}>{px(mark)}</Text>
            <Text style={[s.chg, { color: up ? colors.bull : colors.bear }]}>
              {up ? '▲' : '▼'} {Math.abs(market.chg24).toFixed(2)}%
            </Text>
          </View>
        </View>

        <Text style={s.sizeLine}>
          Leveraged size <Text style={s.sizeVal}>{usd(size, 0)}</Text>
        </Text>
        <Text style={s.amount}>{usd(margin, margin % 1 === 0 ? 0 : 2)}</Text>

        <LeverageWheel value={lev} max={maxLev} onChange={setLev} />

        <View style={s.metaRow}>
          <View>
            <View style={s.metaLabelRow}>
              <Text style={s.metaLabel}>Liquidation price</Text>
              <Ionicons name="information-circle-outline" size={13} color={colors.fgMuted} />
            </View>
            <Text style={s.metaVal}>{liq != null ? px(liq) : 'Enter amount'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.metaLabel}>Stop Loss / Take Profit</Text>
            <PressScale onPress={() => setSltp((v) => !v)} to={0.94} hitSlop={6}>
              <Text style={s.sltpLink}>{sltp ? 'Remove SL/TP' : 'Add SL/TP'}</Text>
            </PressScale>
          </View>
        </View>

        {sltp ? (
          <View style={s.sltpCard}>
            <GlassFill />
            <View style={s.sltpItem}>
              <Text style={s.sltpLabel}>Stop loss</Text>
              <Text style={s.sltpHint}>–25%</Text>
            </View>
            <View style={s.sltpDiv} />
            <View style={s.sltpItem}>
              <Text style={s.sltpLabel}>Take profit</Text>
              <Text style={[s.sltpHint, { color: colors.bull }]}>+100%</Text>
            </View>
          </View>
        ) : null}

        <View style={s.toggle}>
          <PressScale onPress={() => setMode('keypad')} to={0.9} style={[s.toggleBtn, mode === 'keypad' && s.toggleOn]}>
            <Ionicons name="keypad" size={16} color={mode === 'keypad' ? colors.fg : colors.fgMuted} />
          </PressScale>
          <PressScale onPress={() => setMode('chart')} to={0.9} style={[s.toggleBtn, mode === 'chart' && s.toggleOn]}>
            <Ionicons name="stats-chart" size={16} color={mode === 'chart' ? colors.bull : colors.fgMuted} />
          </PressScale>
        </View>

        {mode === 'keypad' ? (
          <>
            <View style={s.presets}>
              {PRESETS.map((p) => (
                <PressScale key={p} onPress={() => setValue(String(p))} to={0.94} style={s.preset}>
                  <GlassFill />
                  <Text style={s.presetText}>{usd(p, 0)}</Text>
                </PressScale>
              ))}
            </View>
            <Keypad onKey={(k) => setValue((v) => applyKey(v, k))} />
          </>
        ) : (
          <View style={s.chart}>
            <PerpCandles coin={market.coin} mark={mark} height={230} />
          </View>
        )}

        <PressScale onPress={() => setTransfer(true)} to={0.96} style={s.availRow} hitSlop={6}>
          <Text style={s.avail}>{usd(perpsCash, perpsCash % 1 === 0 ? 0 : 2)} available</Text>
          <Ionicons name="add-circle-outline" size={17} color={colors.fgMuted} />
        </PressScale>

        <SheetButton label={ctaLabel} variant={ctaVariant} chevron={margin <= 0} onPress={onCta} />
      </DragSheet>

      <PerpTransferSheet visible={transfer} onClose={() => setTransfer(false)} />
    </>
  );
}

function compact(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/**
 * Snapping horizontal leverage wheel — the centered tick is the selection, bold
 * blue, neighbors faded. Scroll or fling to change; snaps to whole multipliers.
 */
function LeverageWheel({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  const ref = useRef<ScrollView>(null);
  const ticks = useMemo(() => Array.from({ length: max }, (_, i) => i + 1), [max]);
  const didInit = useRef(false);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / WHEEL_ITEM);
    const lev = Math.min(max, Math.max(1, idx + 1));
    if (lev !== value) onChange(lev);
  };

  return (
    <View style={w.wrap}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: (360 - WHEEL_ITEM) / 2 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={() => {
          if (!didInit.current) {
            didInit.current = true;
            ref.current?.scrollTo({ x: (value - 1) * WHEEL_ITEM, animated: false });
          }
        }}
      >
        {ticks.map((t) => {
          const on = t === value;
          return (
            <View key={t} style={w.item}>
              <Text style={[w.tick, on && w.tickOn]}>{t}x</Text>
            </View>
          );
        })}
      </ScrollView>
      <View pointerEvents="none" style={w.frame} />
      <Text style={w.caption}>Leverage</Text>
    </View>
  );
}

const w = StyleSheet.create({
  wrap: { marginTop: 14, alignItems: 'center' },
  item: { width: WHEEL_ITEM, alignItems: 'center', justifyContent: 'center', height: 54 },
  tick: { color: colors.fgFaint, fontSize: 21, fontWeight: '600' },
  tickOn: { color: colors.accentGlow, fontSize: 26, fontWeight: '800' },
  frame: { position: 'absolute', top: 0, alignSelf: 'center', width: WHEEL_ITEM, height: 54, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  caption: { color: colors.fgMuted, fontSize: 13, marginTop: 8 },
});

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 40, height: 40 },
  coin: { color: colors.fg, fontSize: 19, fontWeight: '800' },
  oi: { color: colors.fgMuted, fontSize: 13, marginTop: 2 },
  price: { color: colors.fg, fontSize: 18, fontWeight: '700' },
  chg: { fontSize: 13, fontWeight: '600', marginTop: 2 },

  sizeLine: { color: colors.fgMuted, fontSize: 14, textAlign: 'center', marginTop: 20 },
  sizeVal: { color: colors.fg, fontWeight: '700' },
  amount: { color: colors.fg, fontSize: 58, fontWeight: '700', letterSpacing: -2, textAlign: 'center', marginTop: 2 },

  metaRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 20 },
  metaLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaLabel: { color: colors.fgMuted, fontSize: 13 },
  metaVal: { color: colors.fg, fontSize: 16, fontWeight: '700', marginTop: 3 },
  sltpLink: { color: colors.accentGlow, fontSize: 15, fontWeight: '700', marginTop: 3 },

  sltpCard: { flexDirection: 'row', borderRadius: radius.md, marginTop: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  sltpItem: { flex: 1, padding: 12, alignItems: 'center' },
  sltpDiv: { width: 1, backgroundColor: colors.border },
  sltpLabel: { color: colors.fgMuted, fontSize: 12 },
  sltpHint: { color: colors.bear, fontSize: 15, fontWeight: '700', marginTop: 3 },

  toggle: { flexDirection: 'row', alignSelf: 'center', gap: 4, backgroundColor: colors.bgRaised, borderRadius: radius.pill, padding: 4, marginTop: 16 },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.pill },
  toggleOn: { backgroundColor: colors.bgRaised2 },

  presets: { flexDirection: 'row', gap: 10, marginTop: 14 },
  preset: { flex: 1, alignItems: 'center', borderRadius: radius.md, paddingVertical: 13, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  presetText: { color: colors.fg, fontSize: 16, fontWeight: '700' },
  chart: { marginTop: 14, marginBottom: 4 },

  availRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 12 },
  avail: { color: colors.fgMuted, fontSize: 15 },

  // geo gate
  geoIcon: { alignSelf: 'center', width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  geoTitle: { color: colors.fg, fontSize: 21, fontWeight: '700', textAlign: 'center', marginTop: 16 },
  geoBody: { color: colors.fgMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8, paddingHorizontal: 6 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 22, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkText: { color: colors.fgSecondary, fontSize: 14, flex: 1, lineHeight: 19 },
});
