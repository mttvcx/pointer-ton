import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DragSheet } from './DragSheet';
import { PressScale } from './PressScale';
import { colors, radius } from '../src/theme';
import { showToast } from '../src/toast';
import { copyText } from '../src/clipboard';
import { useAuth } from '../src/auth';

function short(addr: string | null | undefined): string {
  if (!addr) return '—';
  return addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-6)}` : addr;
}

/**
 * Account details — the "Details" quick action. Shows what we actually have:
 * the holder, the Pointer account reference, and the on-chain deposit address
 * (real when signed in). Fiat bank-transfer rails (account/routing) aren't live
 * until the banking partner is enabled, so that row is an honest "coming soon"
 * rather than an invented account number.
 */
export function AccountDetailsSheet({
  visible,
  onClose,
  tierName,
  cardLast4,
}: {
  visible: boolean;
  onClose: () => void;
  tierName: string;
  cardLast4: string;
}) {
  const auth = useAuth();
  const addr = auth.walletAddress ?? null;

  const copy = async (value: string | null | undefined, label: string) => {
    if (!value) return;
    const ok = await copyText(value);
    if (ok) showToast(`${label} copied`, { kind: 'success' });
  };

  return (
    <DragSheet visible={visible} onClose={onClose} fullDrag>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.head}>
          <View style={s.headIcon}>
            <Ionicons name="document-text-outline" size={20} color="#D2D8DE" />
          </View>
          <View>
            <Text style={s.kicker}>ACCOUNT DETAILS</Text>
            <Text style={s.title}>Pointer Financial</Text>
          </View>
        </View>

        <View style={s.group}>
          <Row label="Membership" value={tierName} />
          <Row label="Card" value={`Pointer •••• ${cardLast4}`} border />
          <Row label="Currency" value="USD · USDC" border />
        </View>

        <Text style={s.section}>Deposit address</Text>
        <PressScale to={0.99} onPress={() => copy(addr, 'Address')} style={s.addrCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.addrLabel}>Your Solana address</Text>
            <Text style={s.addr}>{short(addr)}</Text>
          </View>
          <View style={s.copyBtn}>
            <Ionicons name="copy-outline" size={16} color="#0A0C10" />
          </View>
        </PressScale>
        <Text style={s.hint}>Send USDC or SOL here to top up instantly. Only send on Solana.</Text>

        <View style={s.soon}>
          <Ionicons name="business-outline" size={16} color={colors.fgMuted} />
          <View style={{ flex: 1 }}>
            <Text style={s.soonTitle}>Bank transfer details</Text>
            <Text style={s.soonSub}>Account & routing numbers for wire / ACH top-ups are coming soon.</Text>
          </View>
        </View>
      </ScrollView>
    </DragSheet>
  );
}

function Row({ label, value, border }: { label: string; value: string; border?: boolean }) {
  return (
    <View style={[s.row, border && s.rowBorder]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 4, marginBottom: 4 },
  headIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(199,204,209,0.12)', alignItems: 'center', justifyContent: 'center' },
  kicker: { color: colors.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  title: { color: colors.fg, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 1 },
  group: { borderRadius: radius.md, backgroundColor: colors.bgRaised2, marginTop: 18, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLabel: { color: colors.fgMuted, fontSize: 14 },
  rowValue: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  section: { color: colors.fgSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 0.3, marginTop: 22, marginBottom: 10 },
  addrCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, backgroundColor: colors.bgRaised2, padding: 14, borderWidth: 1, borderColor: 'rgba(199,204,209,0.18)' },
  addrLabel: { color: colors.fgMuted, fontSize: 12.5 },
  addr: { color: colors.fg, fontSize: 17, fontWeight: '700', marginTop: 3, letterSpacing: 0.3 },
  copyBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#C7CCD1', alignItems: 'center', justifyContent: 'center' },
  hint: { color: colors.fgMuted, fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  soon: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: radius.md, backgroundColor: colors.bgRaised, padding: 14, marginTop: 20, borderWidth: 1, borderColor: colors.border },
  soonTitle: { color: colors.fgSecondary, fontSize: 14, fontWeight: '700' },
  soonSub: { color: colors.fgMuted, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
});
