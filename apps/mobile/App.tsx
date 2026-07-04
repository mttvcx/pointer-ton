import './src/polyfills';
import './src/fontPatch';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  useFonts,
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
} from '@expo-google-fonts/sora';
import { AppAuthProvider, useAuth } from './src/auth';
import { isOnboarded, markOnboarded } from './src/onboarded';
import { registerForPush } from './src/push';
import { HomeScreen } from './screens/HomeScreen';
import { TokenScreen } from './screens/TokenScreen';
import { SearchScreen } from './screens/SearchScreen';
import { SocialScreen } from './screens/SocialScreen';
import { TraderProfileScreen } from './screens/TraderProfileScreen';
import { AlertsScreen } from './screens/AlertsScreen';
import { FinancialScreen } from './screens/FinancialScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { LoginScreen } from './screens/LoginScreen';
import { OnboardingFlow } from './screens/OnboardingFlow';
import { EducationScreen } from './screens/EducationScreen';
import { ReferralScreen } from './screens/ReferralScreen';
import { SettingsScreen, type Section } from './screens/SettingsScreen';
import { GlassNav, type NavTab } from './components/GlassNav';
import { ToastHost } from './components/Toast';
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

type TraderRef = { handle: string; name?: string; color?: string; initial?: string };
type StackRoute = { kind: 'token'; bundle: PulseBundle } | ({ kind: 'trader' } & TraderRef);

function Shell() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<NavTab>('home');
  // A real navigation stack so token → trader → token → … back-navigates one level
  // (revealing the screen you came from) instead of dumping you back on a tab.
  const [stack, setStack] = useState<StackRoute[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const { opacity: modeOpacity, committed: adv } = useModeCrossfade(advanced);
  const [entered, setEntered] = useState(false);
  // Onboarding is remembered per account, so returning users skip straight to the
  // app. `obReady` gates the render until we've read the stored flag (no flash).
  const [onboarded, setOnboarded] = useState(false);
  const [obReady, setObReady] = useState(false);
  useEffect(() => {
    if (!entered) {
      setObReady(false);
      return;
    }
    // In real mode wait for the embedded wallet so the flag is per-account; if it
    // never arrives, fall through to onboarding rather than hang.
    if (!auth.demo && !auth.walletAddress) {
      const t = setTimeout(() => setObReady(true), 2500);
      return () => clearTimeout(t);
    }
    const id = auth.demo ? 'demo' : auth.walletAddress!;
    let cancelled = false;
    isOnboarded(id).then((v) => {
      if (!cancelled) {
        setOnboarded(v);
        setObReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [entered, auth.demo, auth.walletAddress]);

  const finishOnboarding = () => {
    const id = auth.demo ? 'demo' : auth.walletAddress;
    if (id) markOnboarded(id);
    setTab('home'); // land on Home after onboarding, not wherever the tab last was
    setOnboarded(true);
  };

  // Register for push once signed in (real build only; no-op until a rebuild
  // includes expo-notifications).
  useEffect(() => {
    if (entered && auth.isLoggedIn && !auth.demo) registerForPush();
  }, [entered, auth.isLoggedIn, auth.demo]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<Section | null>(null);
  const [settingsFocusBio, setSettingsFocusBio] = useState(false);
  const [eduOpen, setEduOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(false);

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
  if (!obReady) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!onboarded) return <OnboardingFlow onDone={finishOnboarding} />;
  if (eduOpen) return <EducationScreen onClose={() => setEduOpen(false)} />;
  if (refOpen) return <ReferralScreen onClose={() => setRefOpen(false)} />;
  if (settingsOpen) {
    return (
      <SettingsScreen
        initialSection={settingsSection}
        autoFocusBio={settingsFocusBio}
        onClose={() => setSettingsOpen(false)}
        onLogout={() => {
          // AWAIT the Privy logout before showing login — otherwise LoginScreen
          // renders while isLoggedIn is briefly still true and auto-advances right
          // back in (the "had to click Log out twice" bug).
          setSettingsOpen(false);
          queryClient.clear(); // drop the old account's cached data (portfolio, me, identity…)
          void (async () => {
            try {
              await auth.logout();
            } catch {
              /* clear local state regardless */
            }
            setOnboarded(false);
            setObReady(false);
            setEntered(false);
          })();
        }}
      />
    );
  }

  const pushToken = (bundle: PulseBundle) => setStack((s) => [...s, { kind: 'token', bundle }]);
  const pushTrader = (t: TraderRef) => setStack((s) => [...s, { kind: 'trader', ...t }]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const go = (t: NavTab) => {
    setStack([]);
    setTab(t);
  };

  const tabScreen =
    tab === 'home' ? (
      <HomeScreen onOpenToken={pushToken} advanced={adv} onOpenEducation={() => setEduOpen(true)} onOpenReferral={() => setRefOpen(true)} />
    ) : tab === 'search' ? (
      <SearchScreen onOpenToken={pushToken} />
    ) : tab === 'financial' ? (
      <FinancialScreen onOpenToken={pushToken} />
    ) : tab === 'social' ? (
      adv ? <AlertsScreen /> : <SocialScreen onOpenTrader={pushTrader} onOpenToken={pushToken} />
    ) : (
      <ProfileScreen onOpenSettings={() => openSettings()} onEditProfile={() => openSettings('Account', true)} />
    );

  return (
    <View style={s.root}>
      <Animated.View style={{ flex: 1, opacity: modeOpacity }}>
        {/* Base tab layer — always mounted so a full swipe-back reveals it in place. */}
        <AnimatedMount routeKey={tab}>{tabScreen}</AnimatedMount>

        {/* Overlay stack — each pushed screen sits above the one it came from and
            slides itself in/out, so popping reveals the previous screen underneath. */}
        {stack.map((route, i) => (
          <View
            key={`${route.kind}-${route.kind === 'token' ? route.bundle.token.mint : route.handle}-${i}`}
            style={StyleSheet.absoluteFill}
          >
            {route.kind === 'token' ? (
              <TokenScreen bundle={route.bundle} onBack={pop} advanced={adv} onOpenTrader={pushTrader} />
            ) : (
              <TraderProfileScreen
                handle={route.handle}
                name={route.name}
                color={route.color}
                initial={route.initial}
                onBack={pop}
                onOpenToken={pushToken}
              />
            )}
          </View>
        ))}
      </Animated.View>

      {stack.length === 0 ? (
        <GlassNav
          active={tab}
          onSelect={go}
          bottom={insets.bottom + 8}
          advanced={advanced}
          onToggleAdvanced={() => setAdvanced((a) => !a)}
        />
      ) : null}

      <ToastHost />
    </View>
  );
}

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

export default function App() {
  const [fontsLoaded] = useFonts({ Sora_400Regular, Sora_500Medium, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold });

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
