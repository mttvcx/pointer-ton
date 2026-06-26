import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../src/auth';
import { Screen } from '../components/Screen';
import { Glass } from '../components/Glass';
import { api } from '../src/api/client';
import { colors, radius } from '../src/theme';

const PRESETS = [20, 50, 100, 200];

/**
 * Apple-Pay funding (FOMO-easy). Pre-fills the embedded wallet + USDC on Solana and
 * opens the Onramper widget (Apple Pay / card) in an in-app browser. Funds land as a
 * USDC balance the user spends from — no seed phrase, no bridging, no gas in view.
 */
export function FundScreen({ onBack }: { onBack: () => void }) {
  const auth = useAuth();
  const [amount, setAmount] = useState(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const addFunds = async () => {
    if (auth.demo) {
      Alert.alert('Demo', 'Apple Pay funding is live in the real build — this is a preview.');
      return;
    }
    if (!auth.walletAddress) {
      setErr('Wallet not ready');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const token = await auth.getToken();
      const { widgetUrl } = await api<{ widgetUrl: string }>('/api/onramper/signature', {
        token,
        method: 'POST',
        body: {
          activeChain: 'sol',
          walletAddress: auth.walletAddress,
          defaultFiat: 'usd',
          fiatAmount: amount,
        },
      });
      if (!widgetUrl) throw new Error('No funding URL');
      await WebBrowser.openBrowserAsync(widgetUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        dismissButtonStyle: 'close',
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start funding');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={s.content}>
        <Pressable onPress={onBack}>
          <Text style={s.link}>‹ Back</Text>
        </Pressable>
        <Text style={s.h1}>Add funds</Text>
        <Text style={s.sub}>Apple Pay or card → USDC balance. No seed phrase, no gas.</Text>

        <Glass style={s.card}>
          <View style={s.amountRow}>
            <Text style={s.currency}>$</Text>
            <Text style={s.amount}>{amount}</Text>
          </View>
          <View style={s.presets}>
            {PRESETS.map((p) => (
              <Pressable key={p} onPress={() => setAmount(p)} style={[s.preset, amount === p && s.presetOn]}>
                <Text style={[s.presetText, amount === p && s.presetTextOn]}>${p}</Text>
              </Pressable>
            ))}
          </View>
        </Glass>

        {err ? <Text style={s.err}>{err}</Text> : null}

        <Pressable style={[s.cta, busy && { opacity: 0.6 }]} disabled={busy} onPress={addFunds}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaText}>Continue with Apple Pay</Text>}
        </Pressable>
        <Text style={s.fine}>Powered by Onramper · funds delivered to your Pointer wallet.</Text>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { flex: 1, padding: 20, paddingTop: 64, gap: 14 },
  link: { color: colors.accent, fontWeight: '700' },
  h1: { color: colors.fg, fontSize: 30, fontWeight: '800' },
  sub: { color: colors.fgSecondary, fontSize: 14 },
  card: { padding: 22, gap: 18, marginTop: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 2 },
  currency: { color: colors.fgSecondary, fontSize: 26, fontWeight: '700', marginTop: 8 },
  amount: { color: colors.fg, fontSize: 56, fontWeight: '800', letterSpacing: -1 },
  presets: { flexDirection: 'row', gap: 8 },
  preset: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  presetOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  presetText: { color: colors.fgSecondary, fontWeight: '700' },
  presetTextOn: { color: colors.fg },
  err: { color: colors.bear, fontSize: 12 },
  cta: { backgroundColor: '#fff', borderRadius: radius.md, padding: 17, alignItems: 'center', marginTop: 4 },
  ctaText: { color: '#000', fontSize: 16, fontWeight: '800' },
  fine: { color: colors.fgMuted, fontSize: 11, textAlign: 'center' },
});
