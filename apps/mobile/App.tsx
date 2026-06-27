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
import { TraderProfileScreen } from './screens/TraderProfileScreen';
import { AlertsScreen } from './screens/AlertsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { LoginScreen } from './screens/LoginScreen';
import { OnboardingFlow } from './screens/OnboardingFlow';
import { SettingsScreen, type Section } from './screens/SettingsScreen';
import { GlassNav, type NavTab } from './components/GlassNav';
import { colors } from './src/theme';
import type { PulseBundle } from './src/types';

/**
 * Crossfades the whole shell when `target` flips (Simple ⇄ Advanced): fade out →
 * commit the new mode → fade back in. The committed value drives what renders, so
 * screens swap at the midpoint of the fade, not the instant the button is tapped.
 */
function useModeCrossfade(target: boolean) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [committed, setCommitted] = useState(target);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setCommitted(target);
      Animated.timing(opacity, { toValue: 1, duration: 230, useNativeDriver: true }).start();
    });
  }, [target]);
  return { opacity, committed };
}

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
  const [trader, setTrader] = useState<{ handle: string; name?: string; color?: string; initial?: string } | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const { opacity: modeOpacity, committed: adv } = useModeCrossfade(advanced);
  const [entered, setEntered] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<Section | null>(null);
  const [settingsFocusBio, setSettingsFocusBio] = useState(false);

  const openSettings = (section: Section | null = null, focusBio = false) => {
    setSettingsSection(section);
    setSettingsFocusBio(focusBio);
    setSettingsOpen(true);
  };

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
        initialSection={settingsSection}
        autoFocusBio={settingsFocusBio}
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
    setTrader(null);
    setTab(t);
  };

  return (
    <View style={s.root}>
      <Animated.View style={{ flex: 1, opacity: modeOpacity }}>
        <AnimatedMount routeKey={token ? `token-${token.token.mint}` : trader ? `trader-${trader.handle}` : tab}>
          {token ? (
            <TokenScreen bundle={token} onBack={() => setToken(null)} advanced={adv} />
          ) : trader ? (
            <TraderProfileScreen
              handle={trader.handle}
              name={trader.name}
              color={trader.color}
              initial={trader.initial}
              onBack={() => setTrader(null)}
            />
          ) : tab === 'home' ? (
            <HomeScreen onOpenToken={setToken} advanced={adv} />
          ) : tab === 'search' ? (
            <SearchScreen onOpenToken={setToken} />
          ) : tab === 'social' ? (
            adv ? <AlertsScreen /> : <SocialScreen onOpenTrader={setTrader} />
          ) : (
            <ProfileScreen onOpenSettings={() => openSettings()} onEditProfile={() => openSettings('Account', true)} />
          )}
        </AnimatedMount>
      </Animated.View>

      <View style={[s.topBar, { height: insets.top }]} pointerEvents="none" />

      {!token && !trader ? (
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
