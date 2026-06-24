import './src/polyfills';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { usePrivy } from '@privy-io/expo';
import { AppProviders } from './src/providers/AppProviders';
import { LoginScreen } from './screens/LoginScreen';
import { PulseScreen } from './screens/PulseScreen';
import { TokenScreen } from './screens/TokenScreen';
import { colors } from './src/theme';

/**
 * Phase 1 shell. Login gate → a minimal Pulse ⇄ Token navigator so the wedge
 * (feed → token → AI verdict → one-tap trade) is runnable end-to-end on a dev
 * build. The 5-tab expo-router structure (Home/Pulse/Trade/Tracker/Profile) is
 * the next step once this is verified on-device.
 */
type Route = { name: 'pulse' } | { name: 'token'; mint: string };

function Shell() {
  const { user, isReady } = usePrivy();
  const [route, setRoute] = useState<Route>({ name: 'pulse' });

  if (!isReady) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!user) return <LoginScreen />;

  if (route.name === 'token') {
    return <TokenScreen mint={route.mint} onBack={() => setRoute({ name: 'pulse' })} />;
  }
  return <PulseScreen onOpenToken={(mint) => setRoute({ name: 'token', mint })} />;
}

export default function App() {
  return (
    <AppProviders>
      <StatusBar style="light" />
      <Shell />
    </AppProviders>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
