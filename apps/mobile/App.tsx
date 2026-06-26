import './src/polyfills';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { AppAuthProvider, useAuth } from './src/auth';
import { HomeScreen } from './screens/HomeScreen';
import { TokenScreen } from './screens/TokenScreen';
import { SearchScreen } from './screens/SearchScreen';
import { SocialScreen } from './screens/SocialScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { LoginScreen } from './screens/LoginScreen';
import { OnboardingFlow } from './screens/OnboardingFlow';
import { SettingsScreen } from './screens/SettingsScreen';
import { GlassNav, type NavTab } from './components/GlassNav';
import { colors } from './src/theme';
import type { PulseBundle } from './src/types';

function AnimatedMount({ routeKey, children }: { routeKey: string; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    opacity.setValue(0);
    ty.setValue(12);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 190, useNativeDriver: true }),
      Animated.spring(ty, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 2 }),
    ]).start();
  }, [routeKey]);
  return <Animated.View style={{ flex: 1, opacity, transform: [{ translateY: ty }] }}>{children}</Animated.View>;
}

function Shell() {
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<NavTab>('home');
  const [token, setToken] = useState<PulseBundle | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [entered, setEntered] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!auth.ready) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!entered) return <LoginScreen onEnter={() => setEntered(true)} />;
  if (!onboarded) return <OnboardingFlow onDone={() => setOnboarded(true)} />;
  if (settingsOpen) {
    return (
      <SettingsScreen
        onClose={() => setSettingsOpen(false)}
        onLogout={() => {
          setSettingsOpen(false);
          setEntered(false);
        }}
      />
    );
  }

  const go = (t: NavTab) => {
    setToken(null);
    setTab(t);
  };

  return (
    <View style={s.root}>
      <AnimatedMount routeKey={token ? `token-${token.token.mint}` : tab}>
        {token ? (
          <TokenScreen bundle={token} onBack={() => setToken(null)} advanced={advanced} />
        ) : tab === 'home' ? (
          <HomeScreen onOpenToken={setToken} />
        ) : tab === 'search' ? (
          <SearchScreen onOpenToken={setToken} />
        ) : tab === 'social' ? (
          <SocialScreen />
        ) : (
          <ProfileScreen onOpenSettings={() => setSettingsOpen(true)} />
        )}
      </AnimatedMount>

      <View style={[s.topBar, { height: insets.top }]} pointerEvents="none" />

      {!token ? (
        <GlassNav
          active={tab}
          onSelect={go}
          bottom={insets.bottom + 8}
          advanced={advanced}
          onToggleAdvanced={() => setAdvanced((a) => !a)}
        />
      ) : null}
    </View>
  );
}

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppAuthProvider>
          <StatusBar style="light" />
          {fontsLoaded ? (
            <Shell />
          ) : (
            <View style={s.center}>
              <ActivityIndicator color={colors.accent} />
            </View>
          )}
        </AppAuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.bg },
});
