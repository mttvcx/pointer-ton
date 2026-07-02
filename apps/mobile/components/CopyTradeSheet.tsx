import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DragSheet } from './DragSheet';
import { PressScale } from './PressScale';
import { XBadge } from './XBadge';
import { GlassFill } from './GlassFill';
import { GlossButton } from './GlossButton';
import { colors, radius } from '../src/theme';
import { startCopy, stopCopy, useCopy } from '../src/local';

const KEY_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'del'],
];
const PRESETS = [25, 100, 500, 1000];

/**
 * COPY A TRADER — you allocate a size to spend each time you copy their trades.
 * This is about the TRADER, not a token: FOMO's copy model, where you set your own
 * position size. Demo persistence via the local store; live mirroring wires on the
 * dev build.
 */
export function CopyTradeSheet({
  visible,
  onClose,
  trader,
}: {
  visible: boolean;
  onClose: () => void;
  trader: { handle: string; name: string; color: string; initial: string; xConnected?: boolean };
}) {
  const existing = useCopy(trader.handle);
  const [amount, setAmount] = useState(existing ? String(existing.sizeUsd) : '100');
  const [done, setDone] = useState(false);

  const press = (k: string) => {
    if (k === 'del') setAmount((a) => (a.length <= 1 ? '0' : a.slice(0, -1)));
    else if (k === '.') setAmount((a) => (a.includes('.') ? a : `${a}.`));
    else setAmount((a) => (a === '0' ? k : a + k));
  };

  const size = Number(amount) || 0;
  const handle = trader.handle.replace(/^@/, '');

  const confirm = () => {
    if (size <= 0) return;
    startCopy({ handle: trader.handle, name: trader.name, color: trader.color, initial: trader.initial, sizeUsd: size });
    setDone(true);
  };

  const stop = () => {
    stopCopy(trader.handle);
    onClose();
  };

  return (
    <DragSheet visible={visible} onClose={onClose}>
      {done ? (
        <View style={s.doneWrap}>
          <View style={s.doneIcon}>
            <GlassFill />
            <Ionicons name="repeat" size={32} color={colors.accentGlow} />
          </View>
          <Text style={s.doneTitle}>Copying @{handle}</Text>
          <Text style={s.doneSub}>You'll copy their trades at ${size.toLocaleString()} each · demo</Text>
          <PressScale style={s.primary} onPress={onClose}>
            <Text style={s.primaryText}>Done</Text>
          </PressScale>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <View style={[s.avatar, { backgroundColor: trader.color }]}>
              <Text style={s.avatarText}>{trader.initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.nameLine}>
                <Text style={s.name} numberOfLines={1}>
                  Copy {trader.name}
                </Text>
                {trader.xConnected ? <XBadge size={15} /> : null}
              </View>
              <Text style={s.handle}>@{handle}</Text>
            </View>
          </View>

          <Text style={s.fieldLabel}>Size per copied trade</Text>
          <Text style={s.amount}>${amount}</Text>
          <View style={s.presets}>
            {PRESETS.map((p) => {
              const on = String(p) === amount;
              return (
                <PressScale key={p} onPress={() => setAmount(String(p))} to={0.94} style={[s.preset, on && s.presetOn]}>
                  <GlassFill active={on} />
                  <Text style={[s.presetText, on && s.presetTextOn]}>${p.toLocaleString()}</Text>
                </PressScale>
              );
            })}
          </View>

          <Keypad onPress={press} />

          <Text style={s.explain}>
            Every time @{handle} buys, you'll copy it at this size. You approve each one — nothing fires on its own.
          </Text>

          <GlossButton onPress={confirm} style={{ marginTop: 18, opacity: size <= 0 ? 0.5 : 1 }}>
            <Text style={s.primaryText}>{existing ? `Update copy · $${size.toLocaleString()}/trade` : `Copy @${handle} · $${size.toLocaleString()}/trade`}</Text>
          </GlossButton>

          {existing ? (
            <PressScale style={s.stopBtn} onPress={stop}>
              <Text style={s.stopText}>Stop copying @{handle}</Text>
            </PressScale>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.fg, fontSize: 19, fontWeight: '700', flexShrink: 1 },
  handle: { color: colors.fgMuted, fontSize: 14, marginTop: 1 },

  fieldLabel: { color: colors.fgSecondary, fontSize: 13, fontWeight: '700', marginTop: 20, textAlign: 'center' },
  amount: { color: colors.fg, fontSize: 56, fontWeight: '700', letterSpacing: -2, textAlign: 'center', marginTop: 6 },
  presets: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16 },
  preset: { borderRadius: radius.md, paddingHorizontal: 15, paddingVertical: 9, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  presetOn: { borderColor: 'rgba(255,255,255,0.28)' },
  presetText: { color: colors.fgSecondary, fontSize: 15, fontWeight: '600' },
  presetTextOn: { color: colors.fg, fontWeight: '700' },

  pad: { marginTop: 14 },
  padRow: { flexDirection: 'row' },
  key: { flex: 1, height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  keyPressed: { backgroundColor: colors.bgRaised },
  keyText: { color: colors.fg, fontSize: 27, fontWeight: '600' },

  explain: { color: colors.fgMuted, fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: 14, paddingHorizontal: 8 },

  primary: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  primaryText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },
  stopBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  stopText: { color: colors.bear, fontSize: 14, fontWeight: '600' },

  doneWrap: { alignItems: 'center', paddingVertical: 26 },
  doneIcon: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  doneTitle: { color: colors.fg, fontSize: 22, fontWeight: '700', marginTop: 16 },
  doneSub: { color: colors.fgMuted, fontSize: 14, marginTop: 6, textAlign: 'center', paddingHorizontal: 16 },
});
