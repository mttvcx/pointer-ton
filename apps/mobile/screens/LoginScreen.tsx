import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLoginWithEmail } from '@privy-io/expo';
import { Screen } from '../components/Screen';
import { Glass } from '../components/Glass';
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
    <Screen>
      <View style={s.content}>
        <View style={{ flex: 1 }} />
        <Text style={s.brand}>pointer.</Text>
        <Text style={s.tag}>See what you're buying.{'\n'}Half your fees back.</Text>
        <Glass style={s.card}>
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
        </Glass>
        <View style={{ height: 40 }} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { flex: 1, padding: 24, gap: 10 },
  brand: { color: colors.fg, fontSize: 40, fontWeight: '800' },
  tag: { color: colors.fgSecondary, fontSize: 18, lineHeight: 24, marginBottom: 24 },
  card: { padding: 16, gap: 12 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: radius.md,
    padding: 14,
    color: colors.fg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  err: { color: colors.bear, fontSize: 12 },
  cta: { backgroundColor: colors.accent, borderRadius: radius.md, padding: 16, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
