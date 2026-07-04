import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DragSheet } from './DragSheet';
import { PressScale } from './PressScale';
import { GlassFill } from './GlassFill';
import { SheetButton } from './SheetButton';
import { Keypad, applyKey } from './Keypad';
import { colors, radius } from '../src/theme';
import { usd } from '../src/format';
import { showToast } from '../src/toast';
import { useCashBalance } from '../src/account';

export type SendRecipient = { name: string; handle: string; color?: string; initial?: string; avatarUrl?: string };

const PCTS: [string, number][] = [
  ['10%', 0.1],
  ['25%', 0.25],
  ['50%', 0.5],
  ['Max', 1],
];

/**
 * Send USDC to another user — FOMO's "send money" flow (the button beside Follow).
 * Pick an amount from your cash balance, slide to send. Peer-to-peer transfer
 * execution is the last mile (needs the recipient's on-chain wallet); until it
 * ships the UI is fully wired and the send is an honest "almost here" rather than
 * a faked transfer (never fake a money movement).
 */
export function SendMoneySheet({ visible, onClose, recipient }: { visible: boolean; onClose: () => void; recipient: SendRecipient }) {
  const [value, setValue] = useState('0');
  const cash = useCashBalance();
  const available = cash.data ?? 4.27; // demo fallback (real cash when signed in)
  const amt = Number(value) || 0;

  const close = () => {
    setValue('0');
    onClose();
  };

  const over = amt > available;
  const variant = amt <= 0 ? 'disabled' : over ? 'disabled' : 'primary';
  const label = amt <= 0 ? 'Enter an amount' : over ? 'Insufficient balance' : `Send ${usd(amt, amt % 1 === 0 ? 0 : 2)}`;

  const send = () => {
    if (amt <= 0 || over) return;
    showToast('Sending USDC is almost here', { sub: `${usd(amt, 2)} to @${recipient.handle.replace(/^@/, '')}`, kind: 'info' });
    close();
  };

  const handle = recipient.handle.replace(/^@/, '');

  return (
    <DragSheet visible={visible} onClose={close}>
      <View style={s.head}>
        {recipient.avatarUrl ? (
          <Image source={{ uri: recipient.avatarUrl }} style={s.avatarImg} />
        ) : (
          <View style={[s.avatar, { backgroundColor: recipient.color ?? colors.accent }]}>
            <Text style={s.avatarText}>{recipient.initial ?? handle.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        <View>
          <Text style={s.name}>{recipient.name}</Text>
          <Text style={s.handle}>@{handle}</Text>
        </View>
      </View>

      <Text style={s.amount}>{usd(amt, amt % 1 === 0 ? 0 : 2)}</Text>

      <View style={s.tokenChip}>
        <View style={s.tokenDot}>
          <Ionicons name="cash-outline" size={13} color={colors.fg} />
        </View>
        <Text style={s.tokenLabel}>Cash balance</Text>
        <Ionicons name="chevron-forward" size={15} color={colors.fgMuted} />
      </View>

      <View style={s.presets}>
        {PCTS.map(([label, pct]) => (
          <PressScale
            key={label}
            onPress={() => setValue(String(Math.round(available * pct * 100) / 100))}
            to={0.94}
            style={s.preset}
          >
            <GlassFill />
            <Text style={s.presetText}>{label}</Text>
          </PressScale>
        ))}
      </View>

      <Keypad onKey={(k) => setValue((v) => applyKey(v, k))} />

      <Text style={s.avail}>{usd(available, 2)} available</Text>
      <SheetButton label={label} variant={variant} chevron={amt <= 0} onPress={send} />
    </DragSheet>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 46, height: 46, borderRadius: 23 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  name: { color: colors.fg, fontSize: 19, fontWeight: '700' },
  handle: { color: colors.fgMuted, fontSize: 14, marginTop: 1 },

  amount: { color: colors.fg, fontSize: 60, fontWeight: '700', letterSpacing: -2, textAlign: 'center', marginTop: 30 },
  tokenChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 8, backgroundColor: colors.bgRaised, borderRadius: radius.pill, paddingLeft: 6, paddingRight: 12, paddingVertical: 6, marginTop: 16 },
  tokenDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.bgRaised2, alignItems: 'center', justifyContent: 'center' },
  tokenLabel: { color: colors.fg, fontSize: 15, fontWeight: '600' },

  presets: { flexDirection: 'row', gap: 10, marginTop: 26 },
  preset: { flex: 1, alignItems: 'center', borderRadius: radius.md, paddingVertical: 13, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  presetText: { color: colors.fg, fontSize: 16, fontWeight: '700' },

  avail: { color: colors.fgMuted, fontSize: 15, marginTop: 8, marginBottom: 12 },
});
