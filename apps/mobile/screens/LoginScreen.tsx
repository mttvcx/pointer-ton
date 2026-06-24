import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLoginWithEmail } from '@privy-io/expo';
import { colors, radius } from '../src/theme';

/** Email-OTP login (Phase 1). Google/Apple/Phantom + FaceID land in onboarding polish. */
export function LoginScreen() {
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    setErr('');
    try {
      if (!sent) {
        await sendCode({ email });
        setSent(true);
      } else {
        await loginWithCode({ code, email });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.root}>
      <Text style={s.brand}>pointer.</Text>
      <Text style={s.tag}>See what you're buying. Half your fees back.</Text>
      <View style={s.card}>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@email.com"
          placeholderTextColor={colors.fgMuted}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {sent ? (
          <TextInput
            style={s.input}
            value={code}
            onChangeText={setCode}
            placeholder="6-digit code"
            placeholderTextColor={colors.fgMuted}
            keyboardType="number-pad"
          />
        ) : null}
        {err ? <Text style={s.err}>{err}</Text> : null}
        <Pressable style={[s.cta, busy && { opacity: 0.6 }]} disabled={busy} onPress={go}>
          <Text style={s.ctaText}>{busy ? '…' : sent ? 'Verify & enter' : 'Continue with email'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24, gap: 8 },
  brand: { color: colors.fg, fontSize: 34, fontWeight: '800' },
  tag: { color: colors.fgSecondary, fontSize: 15, marginBottom: 24 },
  card: { gap: 12 },
  input: {
    backgroundColor: colors.bgRaised,
    borderRadius: radius.md,
    padding: 14,
    color: colors.fg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  err: { color: colors.bear, fontSize: 12 },
  cta: { backgroundColor: colors.accent, borderRadius: radius.md, padding: 16, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
