import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DragSheet } from './DragSheet';
import { PressScale } from './PressScale';
import { GlassFill } from './GlassFill';
import { SheetButton } from './SheetButton';
import { colors, radius } from '../src/theme';
import { showToast } from '../src/toast';
import { useKycLevel, setKycLevel, KYC_UNLOCKS, type KycLevel } from '../src/financial/kyc';

/**
 * KYC verification — only needed to order a real card (the borrow/spend flow is
 * KYC-free). Lite = name + country → virtual card. Full = government ID → physical
 * card + premium tiers. Real verification runs through the card issuer's KYC
 * (Bridge/Persona) once keyed; here it's a scaffolded simulated approval so the
 * whole journey is clickable.
 */
export function KycSheet({ visible, onClose, requireLevel }: { visible: boolean; onClose: () => void; requireLevel: KycLevel }) {
  const level = useKycLevel();
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [busy, setBusy] = useState(false);

  // Which step we're on: lite (name/country) until level 1, then id for level 2.
  const step: 'lite' | 'id' = level < 1 ? 'lite' : 'id';

  const close = () => {
    setBusy(false);
    onClose();
  };

  const submitLite = () => {
    if (!name.trim() || !country.trim() || busy) return;
    setBusy(true);
    // Simulated approval (real: POST the applicant to the issuer's KYC).
    setTimeout(() => {
      setKycLevel(1);
      setBusy(false);
      showToast('Lite verification complete', { sub: 'Virtual card unlocked', kind: 'success' });
      if (requireLevel <= 1) close();
    }, 700);
  };

  const submitId = () => {
    if (busy) return;
    setBusy(true);
    setTimeout(() => {
      setKycLevel(2);
      setBusy(false);
      showToast('Identity verified', { sub: 'Physical card + premium tiers unlocked', kind: 'success' });
      close();
    }, 900);
  };

  return (
    <DragSheet visible={visible} onClose={close}>
      <View style={s.head}>
        <View style={s.badge}>
          <Ionicons name="shield-checkmark" size={20} color={colors.accentGlow} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{requireLevel >= 2 ? 'Verify your identity' : 'Quick verification'}</Text>
          <Text style={s.sub}>Only needed for the card — borrowing + spending in-app stays ID-free.</Text>
        </View>
      </View>

      {/* level ladder */}
      <View style={s.ladder}>
        {([0, 1, 2] as KycLevel[]).map((l) => {
          const done = level >= l;
          const active = l === (step === 'lite' ? 1 : 2) && level < l;
          return (
            <View key={l} style={s.rung}>
              <View style={[s.rungDot, done && s.rungDone, active && s.rungActive]}>
                {done ? <Ionicons name="checkmark" size={12} color={colors.bg} /> : <Text style={s.rungNum}>{l}</Text>}
              </View>
              <Text style={s.rungText}>{KYC_UNLOCKS[l]}</Text>
            </View>
          );
        })}
      </View>

      {step === 'lite' ? (
        <>
          <Text style={s.label}>Legal name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.fgFaint} style={s.input} autoCapitalize="words" />
          <Text style={s.label}>Country</Text>
          <TextInput value={country} onChangeText={setCountry} placeholder="Country of residence" placeholderTextColor={colors.fgFaint} style={s.input} autoCapitalize="words" />
          <SheetButton label={busy ? 'Verifying…' : 'Verify'} variant={name.trim() && country.trim() && !busy ? 'blue' : 'disabled'} onPress={submitLite} style={{ marginTop: 18 }} />
        </>
      ) : (
        <>
          <PressScale style={s.idBox} to={0.98} onPress={submitId}>
            <GlassFill />
            <Ionicons name="card-outline" size={26} color={colors.accentGlow} />
            <Text style={s.idTitle}>Scan your government ID</Text>
            <Text style={s.idBody}>Passport or driver's license. Encrypted and handled by our verification partner — we never store the image.</Text>
          </PressScale>
          <SheetButton label={busy ? 'Verifying…' : 'Verify identity'} variant={busy ? 'disabled' : 'blue'} onPress={submitId} style={{ marginTop: 16 }} />
        </>
      )}

      <Text style={s.foot}>Your crypto never leaves your wallet during verification.</Text>
    </DragSheet>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.fg, fontSize: 19, fontWeight: '800' },
  sub: { color: colors.fgMuted, fontSize: 13, marginTop: 3, lineHeight: 18 },

  ladder: { marginTop: 18, gap: 10 },
  rung: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  rungDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.bgRaised2, alignItems: 'center', justifyContent: 'center' },
  rungDone: { backgroundColor: colors.bull },
  rungActive: { borderWidth: 1.5, borderColor: colors.accent },
  rungNum: { color: colors.fgMuted, fontSize: 12, fontWeight: '700' },
  rungText: { color: colors.fgSecondary, fontSize: 13, flex: 1 },

  label: { color: colors.fgSecondary, fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: colors.bgRaised, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 13, color: colors.fg, fontSize: 15 },

  idBox: { alignItems: 'center', gap: 8, borderRadius: radius.lg, padding: 22, marginTop: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  idTitle: { color: colors.fg, fontSize: 16, fontWeight: '700' },
  idBody: { color: colors.fgMuted, fontSize: 13, lineHeight: 18, textAlign: 'center' },

  foot: { color: colors.fgFaint, fontSize: 12, textAlign: 'center', marginTop: 14 },
});
