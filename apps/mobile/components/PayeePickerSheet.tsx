import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DragSheet } from './DragSheet';
import { PressScale } from './PressScale';
import { TraderAvatar } from './TraderAvatar';
import { colors, radius } from '../src/theme';
import { showToast } from '../src/toast';
import { LEADERBOARD } from '../src/demo';
import type { SendRecipient } from './SendMoneySheet';

// Suggested payees — real people you'd send to (real X pfps via TraderAvatar).
const SUGGESTED: SendRecipient[] = LEADERBOARD.slice(0, 6).map((p) => ({
  name: p.name,
  handle: p.handle,
  color: p.color,
  initial: p.initial,
}));

/**
 * Pick who to send USDC to (the "Send" quick action). Suggested contacts +
 * a search box; picking one hands off to SendMoneySheet. Pasting a raw address
 * is honest-gated ("almost here") since resolving an arbitrary on-chain address
 * is the last mile.
 */
export function PayeePickerSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (r: SendRecipient) => void;
}) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return SUGGESTED;
    return SUGGESTED.filter((r) => r.name.toLowerCase().includes(needle) || r.handle.toLowerCase().includes(needle));
  }, [q]);

  const close = () => {
    setQ('');
    onClose();
  };

  return (
    <DragSheet visible={visible} onClose={close}>
      <Text style={s.title}>Send USDC</Text>

      <View style={s.searchBox}>
        <Ionicons name="search" size={17} color={colors.fgMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search name or @handle"
          placeholderTextColor={colors.fgMuted}
          style={s.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <PressScale
        to={0.98}
        onPress={() => showToast('Sending to an address is almost here', { kind: 'info' })}
        style={s.pasteRow}
      >
        <View style={s.pasteIcon}>
          <Ionicons name="qr-code-outline" size={18} color="#D2D8DE" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.pasteLabel}>Send to an address</Text>
          <Text style={s.pasteSub}>Paste or scan a Solana address</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.fgMuted} />
      </PressScale>

      <Text style={s.section}>Suggested</Text>
      <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
        {list.map((r) => (
          <PressScale key={r.handle} to={0.98} onPress={() => onPick(r)} style={s.row}>
            <TraderAvatar handle={r.handle.replace(/^@/, '')} color={r.color} initial={r.initial} name={r.name} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{r.name}</Text>
              <Text style={s.handle}>{r.handle}</Text>
            </View>
            <Ionicons name="arrow-forward" size={17} color={colors.fgMuted} />
          </PressScale>
        ))}
        {list.length === 0 ? <Text style={s.empty}>No matches</Text> : null}
      </ScrollView>
    </DragSheet>
  );
}

const s = StyleSheet.create({
  title: { color: colors.fg, fontSize: 22, fontWeight: '800', marginBottom: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: colors.bgRaised2, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, marginTop: 14, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.fg, fontSize: 15.5, padding: 0 },
  pasteRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, backgroundColor: colors.bgRaised, padding: 13, marginTop: 12, borderWidth: 1, borderColor: 'rgba(199,204,209,0.16)' },
  pasteIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(199,204,209,0.10)', alignItems: 'center', justifyContent: 'center' },
  pasteLabel: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  pasteSub: { color: colors.fgMuted, fontSize: 12.5, marginTop: 1 },
  section: { color: colors.fgSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 0.3, marginTop: 20, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  name: { color: colors.fg, fontSize: 15.5, fontWeight: '700' },
  handle: { color: colors.fgMuted, fontSize: 13, marginTop: 1 },
  empty: { color: colors.fgMuted, fontSize: 14, textAlign: 'center', paddingVertical: 24 },
});
