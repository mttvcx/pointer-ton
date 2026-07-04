import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DragSheet } from './DragSheet';
import { PressScale } from './PressScale';
import { GlassFill } from './GlassFill';
import { SheetButton } from './SheetButton';
import { Keypad, applyKey } from './Keypad';
import { colors, radius } from '../src/theme';
import { usd } from '../src/format';
import { showToast } from '../src/toast';
import { transferToPerps, usePerpsCash, useTokensCash } from '../src/local';

const PRESETS = [10, 50, 100, 1000];
const MIN = 5;

/**
 * "Tokens to Perps" — move USD from spot (tokens) cash into the separate perps
 * cash balance. Perps and token balances are kept apart (FOMO model); you top up
 * perps cash before opening a leveraged trade. Enforces a $5 minimum and caps at
 * available tokens cash.
 */
export function PerpTransferSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [value, setValue] = useState('0');
  const perpsCash = usePerpsCash();
  const tokensCash = useTokensCash();
  const amt = Number(value) || 0;

  const close = () => {
    setValue('0');
    onClose();
  };

  const belowMin = amt < MIN;
  const overBalance = amt > tokensCash;
  const disabled = belowMin || overBalance;
  const label = belowMin ? `${usd(MIN, 2)} minimum` : overBalance ? 'Not enough tokens cash' : 'Transfer cash';

  const submit = () => {
    if (disabled) return;
    transferToPerps(amt);
    showToast(`Moved ${usd(amt, 2)} to perps cash`, { kind: 'success' });
    close();
  };

  return (
    <DragSheet visible={visible} onClose={close}>
      <Text style={s.title}>Tokens to Perps</Text>
      <Text style={s.sub}>Perps and token cash balances are separated. Top up your perps cash balance to open this trade.</Text>

      <Text style={s.amount}>{usd(amt, amt % 1 === 0 ? 0 : 2)}</Text>
      <Text style={s.tokensCash}>Tokens cash: {usd(tokensCash, 2)}</Text>

      <View style={s.card}>
        <GlassFill />
        <Text style={s.cardLabel}>Transfer to</Text>
        <View style={s.cardRow}>
          <Text style={s.cardName}>Perps cash</Text>
          <Text style={s.cardVal}>{usd(perpsCash, perpsCash % 1 === 0 ? 0 : 2)}</Text>
        </View>
      </View>

      <View style={s.presets}>
        {PRESETS.map((p) => (
          <PressScale key={p} onPress={() => setValue(String(p))} to={0.94} style={s.preset}>
            <GlassFill />
            <Text style={s.presetText}>{usd(p, 0)}</Text>
          </PressScale>
        ))}
      </View>

      <Keypad onKey={(k) => setValue((v) => applyKey(v, k))} />

      <View style={s.updatedRow}>
        <Text style={s.updatedLabel}>Updated perps cash</Text>
        <Text style={s.updatedVal}>{usd(perpsCash + (disabled ? 0 : amt), 2)}</Text>
      </View>

      <SheetButton label={label} variant={disabled ? 'disabled' : 'blue'} chevron={disabled} onPress={submit} />
    </DragSheet>
  );
}

const s = StyleSheet.create({
  title: { color: colors.fg, fontSize: 21, fontWeight: '700', textAlign: 'center' },
  sub: { color: colors.fgMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8, paddingHorizontal: 6 },
  amount: { color: colors.fg, fontSize: 60, fontWeight: '700', letterSpacing: -2, textAlign: 'center', marginTop: 26 },
  tokensCash: { color: colors.fgMuted, fontSize: 15, textAlign: 'center', marginTop: 6 },
  card: { borderRadius: radius.md, padding: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', marginTop: 26 },
  cardLabel: { color: colors.fgMuted, fontSize: 13 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  cardName: { color: colors.fg, fontSize: 20, fontWeight: '600' },
  cardVal: { color: colors.fg, fontSize: 20, fontWeight: '600' },
  presets: { flexDirection: 'row', gap: 10, marginTop: 18 },
  preset: { flex: 1, alignItems: 'center', borderRadius: radius.md, paddingVertical: 13, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  presetText: { color: colors.fg, fontSize: 16, fontWeight: '700' },
  updatedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 14 },
  updatedLabel: { color: colors.fgMuted, fontSize: 15 },
  updatedVal: { color: colors.fg, fontSize: 17, fontWeight: '700' },
});
