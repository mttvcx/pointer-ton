import './src/polyfills';
import './src/fontPatch';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, StyleSheet, View } from 'react-native';
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
import { PerpScreen } from './screens/PerpScreen';
import { SearchScreen } from './screens/SearchScreen';
import { SocialScreen } from './screens/SocialScreen';
import { TraderProfileScreen } from './screens/TraderProfileScreen';
import { AlertsScreen } from './screens/AlertsScreen';
import { FinancialScreen } from './screens/FinancialScreen';
import { PacksScreen } from './screens/PacksScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { LoginScreen } from './screens/LoginScreen';
import { OnboardingFlow } from './screens/OnboardingFlow';
import { EducationScreen } from './screens/EducationScreen';
import { ReferralScreen } from './screens/ReferralScreen';
import { SettingsScreen, type Section } from './screens/SettingsScreen';
import { GlassNav, type NavTab } from './components/GlassNav';
import { useFinancialTakeover } from './src/financial/store';
import { ToastHost } from './components/Toast';
import { colors } from './src/theme';
import type { PulseBundle, PerpMarket } from './src/types';

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

const SCREEN_W = Dimensions.get('window').width;

/**
 * A pushed screen (token / perp / trader) that slides in from the right on mount
 * and slides back out on pop — the iOS push feel. The screen underneath stays
 * mounted, so sliding this one away reveals where you came from (no hard cut).
 */
function StackLayer({ closing, onClosed, children }: { closing: boolean; onClosed: () => void; children: React.ReactNode }) {
  const tx = useRef(new Animated.Value(SCREEN_W)).current;
  useEffect(() => {
    Animated.spring(tx, { toValue: 0, useNativeDriver: true, speed: 15, bounciness: 0 }).start();
  }, []);
  useEffect(() => {
    if (!closing) return;
    Animated.timing(tx, { toValue: SCREEN_W, duration: 230, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onClosed();
    });
  }, [closing]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.stackLayer, { transform: [{ translateX: tx }] }]}>{children}</Animated.View>
  );
}

/**
 * A tab pane that mounts lazily on first visit and then STAYS mounted, fading in/
 * out on activation. Revisiting a tab is instant (no remount, no refetch) — kills
 * the tab-switch lag from rebuilding Home/Financial every time.
 */
function TabPane({ active, children }: { active: boolean; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(active);
  const opacity = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    if (active && !mounted) setMounted(true);
  }, [active]);
  useEffect(() => {
    Animated.timing(opacity, { toValue: active ? 1 : 0, duration: 170, useNativeDriver: true }).start();
  }, [active, mounted]);
  if (!mounted) return null;
  return (
    <Animated.View pointerEvents={active ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { opacity }]}>
      {children}
    </Animated.View>
  );
}

type TraderRef = { handle: string; name?: string; color?: string; initial?: string };
type StackRoute =
  | { kind: 'token'; bundle: PulseBundle }
  | { kind: 'perp'; market: PerpMarket }
  | ({ kind: 'trader' } & TraderRef);

function Shell() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<NavTab>('home');
  // A real navigation stack so token → trader → token → … back-navigates one level
  // (revealing the screen you came from) instead of dumping you back on a tab.
  const [stack, setStack] = useState<StackRoute[]>([]);
  const [closing, setClosing] = useState(false); // top stack screen is animating out
  const [advanced, setAdvanced] = useState(false);
  const finTakeover = useFinancialTakeover();
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
  const pushPerp = (market: PerpMarket) => setStack((s) => [...s, { kind: 'perp', market }]);
  const pushTrader = (t: TraderRef) => setStack((s) => [...s, { kind: 'trader', ...t }]);
  // Pop = play the slide-out on the top screen, then actually remove it.
  const pop = () => { if (stack.length > 0) setClosing(true); };
  const go = (t: NavTab) => {
    setStack([]);
    setClosing(false);
    setTab(t);
  };

  return (
    <View style={s.root}>
      <Animated.View style={{ flex: 1, opacity: modeOpacity }}>
        {/* Base tab layer — every visited tab stays mounted and crossfades, so
            switching tabs is instant (no rebuild) instead of a laggy remount. */}
        <View style={{ flex: 1 }}>
          <TabPane active={tab === 'home'}>
            <HomeScreen onOpenToken={pushToken} onOpenPerp={pushPerp} onOpenTrader={pushTrader} advanced={adv} onOpenEducation={() => setEduOpen(true)} onOpenReferral={() => setRefOpen(true)} active={tab === 'home'} />
          </TabPane>
          <TabPane active={tab === 'search'}>
            <SearchScreen onOpenToken={pushToken} />
          </TabPane>
          <TabPane active={tab === 'financial'}>
            <FinancialScreen onOpenToken={pushToken} active={tab === 'financial'} />
          </TabPane>
          <TabPane active={tab === 'packs'}>
            <PacksScreen />
          </TabPane>
          <TabPane active={tab === 'social'}>
            {adv ? <AlertsScreen /> : <SocialScreen onOpenTrader={pushTrader} onOpenToken={pushToken} />}
          </TabPane>
          <TabPane active={tab === 'profile'}>
            <ProfileScreen onOpenSettings={() => openSettings()} onEditProfile={() => openSettings('Account', true)} />
          </TabPane>
        </View>

        {/* Overlay stack — each pushed screen slides in from the right on mount and
            slides back out on pop, revealing the screen underneath. */}
        {stack.map((route, i) => {
          const isTop = i === stack.length - 1;
          return (
            <StackLayer
              key={`${route.kind}-${route.kind === 'token' ? route.bundle.token.mint : route.kind === 'perp' ? route.market.id : route.handle}-${i}`}
              closing={isTop && closing}
              onClosed={() => { setClosing(false); setStack((s) => s.slice(0, -1)); }}
            >
              {route.kind === 'token' ? (
                <TokenScreen bundle={route.bundle} onBack={pop} advanced={adv} onOpenTrader={pushTrader} />
              ) : route.kind === 'perp' ? (
                <PerpScreen market={route.market} onBack={pop} />
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
            </StackLayer>
          );
        })}
      </Animated.View>

      {stack.length === 0 && !finTakeover ? (
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
  const [fontsLoaded] = useFonts({
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
    // Per-tier pack heading fonts (each tier has its own vibe).
    PackStarter: require('./assets/fonts/LuckiestGuy.ttf'), // playful
    PackDegen: require('./assets/fonts/Bungee.ttf'), // blocky
    PackWhale: require('./assets/fonts/Anton.ttf'), // heavy
    PackDiamond: require('./assets/fonts/Orbitron.ttf'), // techy
    PackOracle: require('./assets/fonts/Cinzel.ttf'), // royal
  });

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
  stackLayer: { backgroundColor: colors.bg, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: -6, height: 0 }, elevation: 16 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.bg },
});
