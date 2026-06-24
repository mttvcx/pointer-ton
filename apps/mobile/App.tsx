import './src/polyfills';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { usePrivy } from '@privy-io/expo';
import { AppProviders } from './src/providers/AppProviders';
import { Glass } from './components/Glass';
import { LoginScreen } from './screens/LoginScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PulseScreen } from './screens/PulseScreen';
import { TokenScreen } from './screens/TokenScreen';
import { FundScreen } from './screens/FundScreen';
import { colors } from './src/theme';

/**
 * Phase 1 shell. Login gate → Home (balance) / Pulse with a glass bottom bar;
 * Token + Fund push over them. (The 5-tab expo-router structure is the next step
 * once verified on-device.)
 */
type Route = { name: 'home' } | { name: 'pulse' } | { name: 'token'; mint: string } | { name: 'fund' };

function Shell() {
  const { user, isReady } = usePrivy();
  const [route, setRoute] = useState<Route>({ name: 'home' });

  if (!isReady) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!user) return <LoginScreen />;

  const showBar = route.name === 'home' || route.name === 'pulse';

  return (
    <View style={s.root}>
      {route.name === 'home' ? (
        <HomeScreen onFund={() => setRoute({ name: 'fund' })} onDiscover={() => setRoute({ name: 'pulse' })} />
      ) : route.name === 'pulse' ? (
        <PulseScreen onOpenToken={(mint) => setRoute({ name: 'token', mint })} />
      ) : route.name === 'token' ? (
        <TokenScreen mint={route.mint} onBack={() => setRoute({ name: 'pulse' })} />
      ) : (
        <FundScreen onBack={() => setRoute({ name: 'home' })} />
      )}

      {showBar ? (
        <Glass style={s.bar} intensity={40}>
          <Tab label="Home" active={route.name === 'home'} onPress={() => setRoute({ name: 'home' })} />
          <Pressable style={s.add} onPress={() => setRoute({ name: 'fund' })}>
            <Text style={s.addText}>＋</Text>
          </Pressable>
          <Tab label="Pulse" active={route.name === 'pulse'} onPress={() => setRoute({ name: 'pulse' })} />
        </Glass>
      ) : null}
    </View>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={s.tab} onPress={onPress}>
      <Text style={[s.tabText, active && s.tabActive]}>{label}</Text>
    </Pressable>
  );
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
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    height: 62,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    justifyContent: 'space-between',
  },
  tab: { flex: 1, alignItems: 'center' },
  tabText: { color: colors.fgMuted, fontSize: 14, fontWeight: '700' },
  tabActive: { color: colors.fg },
  add: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  addText: { color: '#fff', fontSize: 26, fontWeight: '700', marginTop: -2 },
});
