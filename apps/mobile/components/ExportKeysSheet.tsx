import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DragSheet } from './DragSheet';
import { PressScale } from './PressScale';
import { colors, radius } from '../src/theme';

export function ExportKeysSheet({ visible, onClose, onAcknowledge }: { visible: boolean; onClose: () => void; onAcknowledge: () => void }) {
  const [a, setA] = useState(false);
  const [b, setB] = useState(false);
  const ready = a && b;

  return (
    <DragSheet visible={visible} onClose={onClose}>
      <Text style={s.title}>Export keys</Text>
      <Text style={s.body}>
        Your private key is a permanent password for your wallet. Anyone who gets it can take all of your funds.
      </Text>
      <Text style={s.danger}>DO NOT SHARE YOUR PRIVATE KEY WITH ANYONE.</Text>
      <Text style={s.warn}>
        Pointer can't track activity you make on other apps. Your portfolio and trades may become inaccurate and you could be
        removed from the leaderboard.
      </Text>

      <Check label="I understand there is a high level of risk in exporting my private key" on={a} onToggle={() => setA((v) => !v)} />
      <Check label="I understand that sharing my private key could mean permanent loss of funds" on={b} onToggle={() => setB((v) => !v)} />

      <PressScale style={[s.btn, !ready && s.btnOff]} onPress={ready ? onAcknowledge : undefined}>
        <Text style={[s.btnText, !ready && s.btnTextOff]}>Acknowledge</Text>
      </PressScale>
    </DragSheet>
  );
}

function Check({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <PressScale onPress={onToggle} to={0.99} style={s.checkRow}>
      <Text style={s.checkLabel}>{label}</Text>
      <View style={[s.box, on && s.boxOn]}>{on ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}</View>
    </PressScale>
  );
}

const s = StyleSheet.create({
  title: { color: colors.fg, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  body: { color: colors.fgSecondary, fontSize: 16, lineHeight: 23, marginTop: 14 },
  danger: { color: colors.bear, fontSize: 17, fontWeight: '700', marginTop: 18 },
  warn: { color: colors.warn, fontSize: 16, lineHeight: 23, marginTop: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 22 },
  checkLabel: { flex: 1, color: colors.fg, fontSize: 16, lineHeight: 22 },
  box: { width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  btn: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 26 },
  btnOff: { backgroundColor: colors.bgRaised },
  btnText: { color: colors.onAccent, fontSize: 17, fontWeight: '600' },
  btnTextOff: { color: colors.fgMuted },
});
