import './src/polyfills';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { usePrivy, useLoginWithEmail, getAccessToken, useEmbeddedSolanaWallet } from '@privy-io/expo';
import { AppProviders } from './src/providers/AppProviders';
import { api } from './src/api/client';
import { API_URL } from './src/env';

/**
 * PHASE 0 SPIKE SCREEN — not the real app. It proves the load-bearing dependencies:
 *  1. Privy login on a real device (same App ID as web).
 *  2. The Privy access token authenticates against the EXISTING Pointer backend
 *     (GET /api/me) — i.e. mobile reuses the web API with zero backend changes.
 *  3. The embedded Solana wallet exists and exposes a SIGN-ONLY primitive (the
 *     hardened sign-only → server-broadcast money path depends on this).
 * Replace with the real navigation/screens once this is green.
 */
function Spike() {
  const { user, isReady, logout } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const solana = useEmbeddedSolanaWallet();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const push = (m: string) => setLog((l) => [m, ...l].slice(0, 12));

  const testApiMe = async () => {
    setBusy(true);
    try {
      const token = await getAccessToken();
      push(token ? `token ok (${token.slice(0, 10)}…)` : 'no token');
      const me = await api<{ id?: string }>('/api/me', { token });
      push(`/api/me → ${JSON.stringify(me).slice(0, 140)}`);
    } catch (e) {
      push(`/api/me FAILED: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const walletAddress = solana?.wallets?.[0]?.address ?? null;

  if (!isReady) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#5865F2" />
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.h1}>Pointer · Phase 0 spike</Text>
      <Text style={s.muted}>API: {API_URL}</Text>

      {!user ? (
        <View style={s.card}>
          <Text style={s.label}>Login (email OTP)</Text>
          <Field value={email} onChange={setEmail} placeholder="you@email.com" keyboard="email-address" />
          {sent ? <Field value={code} onChange={setCode} placeholder="6-digit code" keyboard="number-pad" /> : null}
          <Btn
            label={sent ? 'Verify code' : 'Send code'}
            onPress={async () => {
              try {
                if (!sent) {
                  await sendCode({ email });
                  setSent(true);
                  push('code sent');
                } else {
                  await loginWithCode({ code, email });
                  push('logged in');
                }
              } catch (e) {
                push(`login error: ${e instanceof Error ? e.message : String(e)}`);
              }
            }}
          />
        </View>
      ) : (
        <View style={s.card}>
          <Text style={s.label}>Signed in</Text>
          <Text style={s.mono}>user: {user.id}</Text>
          <Text style={s.mono}>SOL wallet: {walletAddress ?? '(none yet)'}</Text>
          <Btn label={busy ? 'Testing…' : 'Test /api/me (backend auth)'} onPress={testApiMe} />
          <Btn label="Logout" variant="ghost" onPress={() => void logout()} />
        </View>
      )}

      <View style={s.card}>
        <Text style={s.label}>Log</Text>
        {log.map((l, i) => (
          <Text key={i} style={s.logline}>
            • {l}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

export default function App() {
  return (
    <AppProviders>
      <StatusBar style="light" />
      <Spike />
    </AppProviders>
  );
}

function Field(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  keyboard?: 'email-address' | 'number-pad' | 'default';
}) {
  return (
    <TextInput
      style={s.input}
      value={props.value}
      onChangeText={props.onChange}
      placeholder={props.placeholder}
      placeholderTextColor="#5b6472"
      autoCapitalize="none"
      keyboardType={props.keyboard ?? 'default'}
    />
  );
}
function Btn({ label, onPress, variant }: { label: string; onPress: () => void; variant?: 'ghost' }) {
  return (
    <Pressable onPress={onPress} style={[s.btn, variant === 'ghost' && s.btnGhost]}>
      <Text style={[s.btnText, variant === 'ghost' && s.btnGhostText]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080D14' },
  content: { padding: 20, paddingTop: 64, gap: 16 },
  center: { flex: 1, backgroundColor: '#080D14', alignItems: 'center', justifyContent: 'center' },
  h1: { color: '#fff', fontSize: 22, fontWeight: '700' },
  muted: { color: '#7a8595', fontSize: 12 },
  card: { backgroundColor: '#0e151f', borderRadius: 14, padding: 16, gap: 10, borderWidth: 1, borderColor: '#1b2230' },
  label: { color: '#aab3c2', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  mono: { color: '#dfe6f0', fontSize: 12, fontFamily: 'Courier' },
  input: { backgroundColor: '#060a10', borderRadius: 10, padding: 12, color: '#fff', borderWidth: 1, borderColor: '#1b2230' },
  btn: { backgroundColor: '#5865F2', borderRadius: 10, padding: 13, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#1b2230' },
  btnGhostText: { color: '#aab3c2' },
  logline: { color: '#8b94a4', fontSize: 11, fontFamily: 'Courier' },
});
