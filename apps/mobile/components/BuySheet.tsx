import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DragSheet } from './DragSheet';
import { CoinIcon } from './CoinIcon';
import { PressScale } from './PressScale';
import { colors, radius } from '../src/theme';
import { priceUsd, shortMint } from '../src/format';
import { addOrder, cancelOrder, useOrders, type OrderSide } from '../src/local';
import type { PulseBundle } from '../src/types';

const KEY_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'del'],
];
const PRESETS = [25, 100, 500, 1000];
const LIMIT_MULTS = [0.8, 0.9, 1, 1.1, 1.25];
const EXPIRIES = ['1h', '4h', '24h', 'Never'];

export function BuySheet({
  visible,
  onClose,
  bundle,
  advanced,
  initialSide = 'buy',
}: {
  visible: boolean;
  onClose: () => void;
  bundle: PulseBundle;
  advanced: boolean;
  initialSide?: OrderSide;
}) {
  const sym = (bundle.token.symbol ?? shortMint(bundle.token.mint)).replace(/^\$/, '');
  const market = bundle.snapshot?.price_usd ?? 0;

  const [side, setSide] = useState<OrderSide>(initialSide);
  const [type, setType] = useState<'market' | 'limit'>('market');
  const [amount, setAmount] = useState('100');
  const [mult, setMult] = useState(1); // limit price as a multiple of market
  const [expiry, setExpiry] = useState('24h');
  const [placed, setPlaced] = useState(false);

  const allOrders = useOrders();
  const orders = useMemo(() => allOrders.filter((o) => o.mint === bundle.token.mint), [allOrders, bundle.token.mint]);
  const limitPrice = market * mult;

  const press = (k: string) => {
    if (k === 'del') setAmount((a) => (a.length <= 1 ? '0' : a.slice(0, -1)));
    else if (k === '.') setAmount((a) => (a.includes('.') ? a : `${a}.`));
    else setAmount((a) => (a === '0' ? k : a + k));
  };

  const reset = () => {
    setPlaced(false);
    setType('market');
    setAmount('100');
    setMult(1);
  };

  const place = () => {
    if (type === 'limit') {
      addOrder({ mint: bundle.token.mint, symbol: sym, side, amountUsd: Number(amount) || 0, limitPrice, expiry });
      setType('market');
      setAmount('100');
      setMult(1);
    } else {
      setPlaced(true);
    }
  };

  const accent = side === 'buy' ? colors.bull : colors.bear;

  return (
    <DragSheet visible={visible} onClose={onClose}>
      {placed ? (
        <View style={s.done}>
          <View style={[s.doneIcon, { backgroundColor: colors.bullSoft }]}>
            <Ionicons name="checkmark" size={34} color={colors.bull} />
          </View>
          <Text style={s.doneTitle}>Order placed</Text>
          <Text style={s.doneSub}>
            {side === 'buy' ? 'Bought' : 'Sold'} ${amount} of {sym} · demo
          </Text>
          <PressScale style={[s.place, { backgroundColor: colors.accent }]} onPress={reset}>
            <Text style={s.placeText}>Done</Text>
          </PressScale>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }}>
          <View style={s.header}>
            <View style={s.headLeft}>
              <CoinIcon uri={bundle.token.image_url} symbol={sym} size={40} verified={Boolean(bundle.token.launch_pad)} />
              <View>
                <Text style={s.sym}>{sym}</Text>
                <Text style={s.price}>{priceUsd(market)}</Text>
              </View>
            </View>
            {advanced ? <Text style={[s.mode, { color: accent }]}>Advanced</Text> : null}
          </View>

          {/* Buy / Sell */}
          <View style={s.seg}>
            {(['buy', 'sell'] as OrderSide[]).map((sd) => (
              <PressScale key={sd} onPress={() => setSide(sd)} to={0.97} style={[s.segBtn, side === sd && { backgroundColor: sd === 'buy' ? colors.bull : colors.bear }]}>
                <Text style={[s.segText, side === sd && { color: '#04050A' }]}>{sd === 'buy' ? 'Buy' : 'Sell'}</Text>
              </PressScale>
            ))}
          </View>

          {/* Market / Limit (advanced) */}
          {advanced ? (
            <View style={s.typeRow}>
              {(['market', 'limit'] as const).map((t) => (
                <PressScale key={t} onPress={() => setType(t)} to={0.96} style={[s.typeBtn, type === t && s.typeBtnOn]}>
                  <Text style={[s.typeText, type === t && s.typeTextOn]}>{t === 'market' ? 'Market' : 'Limit'}</Text>
                </PressScale>
              ))}
            </View>
          ) : null}

          <Text style={s.amount}>${amount}</Text>
          <View style={s.presets}>
            {PRESETS.map((p) => (
              <PressScale key={p} onPress={() => setAmount(String(p))} to={0.94} style={[s.preset, String(p) === amount && s.presetOn]}>
                <Text style={[s.presetText, String(p) === amount && s.presetTextOn]}>${p.toLocaleString()}</Text>
              </PressScale>
            ))}
          </View>

          {type === 'limit' ? (
            <View style={s.limitBox}>
              <View style={s.limitHead}>
                <Text style={s.limitLabel}>Limit price</Text>
                <Text style={s.limitVal}>{priceUsd(limitPrice)}</Text>
              </View>
              <Text style={s.limitRef}>Market {priceUsd(market)} · trigger {mult === 1 ? 'at market' : `${mult > 1 ? '+' : ''}${Math.round((mult - 1) * 100)}%`}</Text>
              <View style={s.chips}>
                {LIMIT_MULTS.map((m) => (
                  <PressScale key={m} onPress={() => setMult(m)} to={0.93} style={[s.chip, mult === m && s.chipOn]}>
                    <Text style={[s.chipText, mult === m && s.chipTextOn]}>{m === 1 ? 'Mkt' : `${m > 1 ? '+' : ''}${Math.round((m - 1) * 100)}%`}</Text>
                  </PressScale>
                ))}
              </View>
              <Text style={[s.limitLabel, { marginTop: 14 }]}>Expires</Text>
              <View style={s.chips}>
                {EXPIRIES.map((e) => (
                  <PressScale key={e} onPress={() => setExpiry(e)} to={0.93} style={[s.chip, expiry === e && s.chipOn]}>
                    <Text style={[s.chipText, expiry === e && s.chipTextOn]}>{e}</Text>
                  </PressScale>
                ))}
              </View>
            </View>
          ) : (
            <Keypad onPress={press} />
          )}

          {/* Slippage & MEV moved to Settings → Trading — keep the buy flow Apple-Pay simple */}

          <PressScale style={[s.place, { backgroundColor: type === 'limit' ? colors.accent : accent }]} onPress={place}>
            <Text style={[s.placeText, type !== 'limit' && { color: '#04050A' }]}>
              {type === 'limit' ? `Place limit ${side}` : `${side === 'buy' ? 'Buy' : 'Sell'} ${sym}`}
            </Text>
          </PressScale>

          {orders.length ? (
            <View style={s.orders}>
              <Text style={s.ordersTitle}>Open orders</Text>
              {orders.map((o) => (
                <View key={o.id} style={s.order}>
                  <View style={[s.orderDot, { backgroundColor: o.side === 'buy' ? colors.bull : colors.bear }]} />
                  <Text style={s.orderText}>
                    {o.side === 'buy' ? 'Buy' : 'Sell'} ${o.amountUsd.toLocaleString()} @ {priceUsd(o.limitPrice)}
                  </Text>
                  <Text style={s.orderExp}>{o.expiry}</Text>
                  <PressScale onPress={() => cancelOrder(o.id)} to={0.85} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={colors.fgMuted} />
                  </PressScale>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </DragSheet>
  );
}

function Keypad({ onPress }: { onPress: (k: string) => void }) {
  return (
    <View style={s.pad}>
      {KEY_ROWS.map((row, i) => (
        <View key={i} style={s.padRow}>
          {row.map((k) => (
            <Pressable key={k} onPress={() => onPress(k)} style={({ pressed }) => [s.key, pressed && s.keyPressed]}>
              {k === 'del' ? <Ionicons name="backspace-outline" size={26} color={colors.fg} /> : <Text style={s.keyText}>{k}</Text>}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sym: { color: colors.fg, fontSize: 18, fontWeight: '700' },
  price: { color: colors.fgMuted, fontSize: 14, marginTop: 1 },
  mode: { fontSize: 12, fontWeight: '700' },

  seg: { flexDirection: 'row', gap: 8, marginTop: 16 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.bgRaised },
  segText: { color: colors.fgSecondary, fontSize: 16, fontWeight: '700' },

  typeRow: { flexDirection: 'row', gap: 6, backgroundColor: colors.bgRaised, borderRadius: radius.md, padding: 4, marginTop: 12 },
  typeBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.sm },
  typeBtnOn: { backgroundColor: colors.bgRaised2 },
  typeText: { color: colors.fgMuted, fontSize: 14, fontWeight: '600' },
  typeTextOn: { color: colors.fg },

  amount: { color: colors.fg, fontSize: 56, fontWeight: '700', letterSpacing: -2, textAlign: 'center', marginTop: 18 },
  presets: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16 },
  preset: { backgroundColor: colors.bgRaised, borderRadius: radius.md, paddingHorizontal: 15, paddingVertical: 9 },
  presetOn: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  presetText: { color: colors.fg, fontSize: 15, fontWeight: '600' },
  presetTextOn: { color: colors.accentGlow },

  pad: { marginTop: 14 },
  padRow: { flexDirection: 'row' },
  key: { flex: 1, height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  keyPressed: { backgroundColor: colors.bgRaised },
  keyText: { color: colors.fg, fontSize: 27, fontWeight: '600' },

  limitBox: { marginTop: 18, backgroundColor: colors.bgRaised, borderRadius: radius.lg, padding: 14 },
  limitHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  limitLabel: { color: colors.fgSecondary, fontSize: 14, fontWeight: '600' },
  limitVal: { color: colors.fg, fontSize: 17, fontWeight: '700' },
  limitRef: { color: colors.fgMuted, fontSize: 12, marginTop: 3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  chip: { backgroundColor: colors.bgRaised2, borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 7 },
  miniChip: { backgroundColor: colors.bgRaised2, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  chipText: { color: colors.fgSecondary, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: colors.accentGlow },

  advRow: { flexDirection: 'row', gap: 18, marginTop: 18 },
  advCol: { flex: 1 },
  advLabel: { color: colors.fgMuted, fontSize: 12, fontWeight: '600', marginBottom: 2 },

  place: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  placeText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  orders: { marginTop: 20, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 },
  ordersTitle: { color: colors.fg, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  order: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  orderDot: { width: 8, height: 8, borderRadius: 4 },
  orderText: { color: colors.fgSecondary, fontSize: 14, flex: 1 },
  orderExp: { color: colors.fgMuted, fontSize: 12 },

  done: { alignItems: 'center', paddingVertical: 26 },
  doneIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { color: colors.fg, fontSize: 22, fontWeight: '700', marginTop: 16 },
  doneSub: { color: colors.fgMuted, fontSize: 14, marginTop: 6 },
});
