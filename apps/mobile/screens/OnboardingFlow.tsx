import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, KeyboardAvoidingView, PanResponder, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGrad, Path, Stop } from 'react-native-svg';
import { Screen } from '../components/Screen';
import { Logo } from '../components/Logo';
import { PressScale } from '../components/PressScale';
import { GlassFill } from '../components/GlassFill';
import { GlossButton } from '../components/GlossButton';
import { Slide } from '../components/Slide';
import { colors, radius } from '../src/theme';
import { ONBOARD_TRADERS } from '../src/demo';
import { useAuth } from '../src/auth';
import { updateProfile } from '../src/api/endpoints';
import { saveXUsername } from '../src/api/social';
import { showToast } from '../src/toast';

const X_LOGO = require('../assets/x-logo.png');

/** Demo portfolio gain used for the "Potential Earnings" projection. */
const PROJ_PCT = 1112.66;
// Hermes has no Intl — group thousands by hand (never toLocaleString).
const group = (int: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
function fmtUsd(n: number): string {
  const [i, f] = n.toFixed(2).split('.');
  return `$${group(i)}.${f}`;
}
function fmtPct(n: number): string {
  const [i, f] = n.toFixed(2).split('.');
  return `${group(i)}.${f}`;
}

export function OnboardingFlow({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [username, setUsername] = useState('');
  const [ref, setRef] = useState('');
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [invest, setInvest] = useState(481);
  const auth = useAuth();
  const [linking, setLinking] = useState(false);

  const saveUsername = async (uname: string) => {
    const clean = uname.trim();
    if (!auth.demo && clean) {
      try {
        await updateProfile({ username: clean });
      } catch {
        // non-blocking during onboarding
      }
    }
  };

  const next = async () => {
    if (step === 1) await saveUsername(username); // persist the manual username
    if (step >= 4) return onDone();
    setDir(1);
    setStep((s) => s + 1);
  };

  // Connect X → use the @handle AS the username and skip the manual step (FOMO-style).
  const connectX = async () => {
    if (auth.demo) return next(); // demo → manual username
    setLinking(true);
    try {
      const handle = await auth.linkTwitter();
      if (handle) {
        setUsername(handle);
        await saveUsername(handle);
        saveXUsername(handle).catch(() => {}); // persist the linked @handle to the Pointer identity
        setDir(1);
        setStep(2); // X gave us the username — skip "Create your username"
      } else {
        next(); // linked but no handle → fall back to manual
      }
    } catch {
      showToast('Couldn’t connect X', { sub: 'Set a username instead', kind: 'error' });
      next();
    } finally {
      setLinking(false);
    }
  };
  const back = () => {
    if (step === 0) return;
    setDir(-1);
    setStep((s) => s - 1);
  };

  return (
    <Screen>
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <Logo size={40} />
        <PressScale onPress={back} to={0.85} hitSlop={10} style={{ opacity: step === 0 ? 0.35 : 1 }}>
          <Ionicons name="arrow-undo-outline" size={24} color={colors.fgSecondary} />
        </PressScale>
      </View>

      <Slide key={step} dir={dir} style={s.body}>
        {step === 0 ? (
          <>
            <Text style={s.title}>Connect X</Text>
            <Text style={s.sub}>Claim your username and find friends</Text>
            <View style={s.xWrap}>
              <View style={s.glow} />
              <View style={s.connectRow}>
                <View style={s.xCard}>
                  <Image source={X_LOGO} style={s.xImg} />
                </View>
                <View style={s.linkPill}>
                  <GlassFill />
                  <Ionicons name="add" size={20} color={colors.accentGlow} />
                </View>
                <View style={s.pCard}>
                  <GlassFill />
                  <Logo size={60} />
                </View>
              </View>
            </View>
          </>
        ) : step === 1 ? (
          <>
            <Text style={s.title}>Create your username</Text>
            <Text style={s.sub}>You can always change this later.</Text>
            <View style={s.inputRow}>
              <GlassFill />
              <Text style={s.at}>@</Text>
              <TextInput value={username} onChangeText={setUsername} style={s.input} placeholder="" placeholderTextColor={colors.fgFaint} autoCapitalize="none" autoCorrect={false} />
            </View>
          </>
        ) : step === 2 ? (
          <>
            <Text style={s.title}>Follow top traders</Text>
            <Text style={s.sub}>Track top performing traders</Text>
            <ScrollView style={{ maxHeight: 440, marginTop: 18 }} showsVerticalScrollIndicator={false}>
              {ONBOARD_TRADERS.map((t) => {
                const on = following[t.handle];
                return (
                  <PressScale key={t.handle} onPress={() => setFollowing((f) => ({ ...f, [t.handle]: !f[t.handle] }))} to={0.99} style={[s.trader, on && s.traderOn]}>
                    <GlassFill active={on} />
                    <View style={[s.tAvatar, { backgroundColor: t.color }]}>
                      <Text style={s.tInitial}>{t.initial}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.tName}>{t.name}</Text>
                      <Text style={s.tHandle}>{t.handle}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.tPnl}>{t.pnl}</Text>
                      <Text style={s.tFollowers}>{t.followers} followers</Text>
                    </View>
                  </PressScale>
                );
              })}
            </ScrollView>
          </>
        ) : step === 3 ? (
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.title}>Your potential earnings</Text>
            <Text style={s.sub}>If you'd copied every move from these traders, this is what you'd have made.</Text>
            <View style={s.earnCard}>
              <GlassFill />
              <View style={s.earnHead}>
                <Text style={s.earnPortfolio}>Top Traders Portfolio</Text>
                <View style={s.earnPnlPill}>
                  <Ionicons name="trending-up" size={13} color={colors.accent} />
                  <Text style={s.earnPnlPillText}>{fmtPct(PROJ_PCT)}%</Text>
                </View>
              </View>
              <Text style={s.earnShared}>190 shared trades · Profit & Loss</Text>

              <View style={s.earnDivider} />

              <Text style={s.earnLabel}>Projected earnings</Text>
              <EarningsBig value={invest * (PROJ_PCT / 100)} />
              <View style={s.earnBadge}>
                <Text style={s.earnBadgeText}>+{fmtPct(PROJ_PCT)}%</Text>
              </View>

              <EarnCurve />

              <View style={s.investRow}>
                <Text style={s.earnLabel}>Initial investment</Text>
                <Text style={s.investVal}>${group(String(invest))}</Text>
              </View>
              <EarningsSlider value={invest} min={50} max={2000} onChange={setInvest} />
            </View>
          </ScrollView>
        ) : (
          <>
            <Text style={s.title}>Enter referral code</Text>
            <Text style={s.sub}>
              Get a <Text style={s.accent}>10% discount</Text> on trading fees for a limited time.
            </Text>
            <View style={s.codeBox}>
              <GlassFill />
              <TextInput value={ref} onChangeText={setRef} style={s.codeInput} autoCapitalize="characters" autoCorrect={false} />
            </View>
            <PressScale onPress={next} style={s.paste}>
              <GlassFill />
              <Ionicons name="clipboard-outline" size={16} color={colors.fgSecondary} />
              <Text style={s.pasteText}>Paste from clipboard</Text>
            </PressScale>
          </>
        )}
      </Slide>

      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <PressScale onPress={next} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 8 }}>
          <Text style={s.skip}>{step === 4 ? "I don't have a code" : "I'll do this later"}</Text>
        </PressScale>
        <GlossButton onPress={step === 0 ? connectX : next} radius={16}>
          {step === 0 ? <Image source={X_LOGO} style={s.ctaXImg} /> : null}
          <Text style={s.primaryText}>
            {step === 0
              ? linking
                ? 'Connecting…'
                : 'Connect X'
              : step === 3
                ? 'Start with these traders'
                : step === 4
                  ? 'Apply code'
                  : 'Continue'}
          </Text>
        </GlossButton>
      </View>
    </KeyboardAvoidingView>
    </Screen>
  );
}

/** Rising projected-earnings curve (static, Invo-style). */
function EarnCurve() {
  return (
    <Svg width="100%" height={110} viewBox="0 0 320 110" preserveAspectRatio="none" style={{ marginTop: 10 }}>
      <Defs>
        <SvgGrad id="earn" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.accent} stopOpacity={0.22} />
          <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
        </SvgGrad>
      </Defs>
      <Path d="M0 104 C120 100 210 88 300 8 L300 110 L0 110 Z" fill="url(#earn)" />
      <Path d="M0 104 C120 100 210 88 300 8" fill="none" stroke={colors.accent} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

/** Lightweight draggable slider (no external dep) — drag the thumb to set the
 *  initial investment; the projection above updates live. */
function EarningsSlider({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const [w, setW] = useState(0);
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));

  const setFromX = (x: number) => {
    if (w <= 0) return;
    const clamped = Math.max(0, Math.min(w, x));
    onChange(Math.round(min + (clamped / w) * (max - min)));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Hold the gesture against the parent ScrollView so the thumb actually drags.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
    }),
  ).current;

  return (
    <View
      {...pan.panHandlers}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={s.sliderTrack}
      hitSlop={{ top: 14, bottom: 14 }}
    >
      <View style={[s.sliderFill, { width: `${pct * 100}%` }]} />
      <View style={[s.sliderThumb, { left: `${pct * 100}%` }]} />
    </View>
  );
}

/**
 * The projected-earnings number: on mount (i.e. when step 3 slides in) it counts
 * up from $0 to the value over ~2.3s — the "boom, look at these numbers" beat.
 * While dragging the slider it just tracks quickly so it stays responsive.
 */
function EarningsBig({ value }: { value: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setShown(v));
    return () => anim.removeListener(id);
  }, []);
  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: first.current ? 2300 : 200, useNativeDriver: false }).start();
    first.current = false;
  }, [value]);
  return <Text style={s.earnBig}>{fmtUsd(shown)}</Text>;
}

const HAIR = 'rgba(255,255,255,0.10)';
const HAIR_STRONG = 'rgba(255,255,255,0.12)';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 8 },
  body: { flex: 1, paddingHorizontal: 22, paddingTop: 14 },
  title: { color: colors.fg, fontSize: 32, fontWeight: '700', letterSpacing: -0.6 },
  sub: { color: colors.fgMuted, fontSize: 17, lineHeight: 24, marginTop: 12 },
  accent: { color: colors.accentGlow, fontWeight: '600' },

  // Connect X — two glass tiles linked by a mint "+", over a soft aura.
  xWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: colors.accentSoft, opacity: 0.7 },
  connectRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  xCard: { width: 112, height: 112, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: HAIR_STRONG },
  linkPill: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: colors.accent + '55' },
  pCard: { width: 112, height: 112, borderRadius: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: colors.accent + '3D' },
  xImg: { width: 50, height: 50, resizeMode: 'contain' },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 16, marginTop: 24, overflow: 'hidden', borderWidth: 1, borderColor: HAIR_STRONG },
  at: { color: colors.fgMuted, fontSize: 22, fontWeight: '600' },
  input: { flex: 1, color: colors.fg, fontSize: 22, fontWeight: '600', padding: 0 },

  trader: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: 14, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: HAIR },
  traderOn: { borderColor: colors.accent },
  tAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  tInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
  tName: { color: colors.fg, fontSize: 17, fontWeight: '700' },
  tHandle: { color: colors.fgMuted, fontSize: 14, marginTop: 1 },
  tPnl: { color: colors.bull, fontSize: 16, fontWeight: '700' },
  tFollowers: { color: colors.fgMuted, fontSize: 13, marginTop: 1 },

  codeBox: { borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 18, marginTop: 24, overflow: 'hidden', borderWidth: 1, borderColor: HAIR_STRONG },
  codeInput: { color: colors.fg, fontSize: 22, fontWeight: '600', padding: 0, letterSpacing: 2 },
  paste: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, paddingVertical: 16, marginTop: 20, overflow: 'hidden', borderWidth: 1, borderColor: HAIR },
  pasteText: { color: colors.fg, fontSize: 16, fontWeight: '700' },

  earnCard: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: HAIR, padding: 18, marginTop: 22 },
  earnHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  earnPortfolio: { color: colors.fg, fontSize: 19, fontWeight: '700' },
  earnPnlPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  earnPnlPillText: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  earnShared: { color: colors.fgMuted, fontSize: 13.5, marginTop: 4 },
  earnDivider: { height: 1, backgroundColor: HAIR, marginVertical: 16 },
  earnLabel: { color: colors.fgMuted, fontSize: 14 },
  earnBig: { color: colors.fg, fontSize: 34, fontWeight: '800', letterSpacing: -1, marginTop: 4 },
  earnBadge: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: 9, paddingVertical: 4, marginTop: 10 },
  earnBadgeText: { color: colors.onAccent, fontSize: 13, fontWeight: '800' },
  investRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  investVal: { color: colors.fg, fontSize: 17, fontWeight: '700' },
  sliderTrack: { height: 12, borderRadius: 6, backgroundColor: colors.bg, marginTop: 12, justifyContent: 'center' },
  sliderFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6, backgroundColor: colors.accent },
  sliderThumb: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', marginLeft: -12, borderWidth: 2, borderColor: colors.accent },

  footer: { paddingHorizontal: 22, gap: 6 },
  skip: { color: colors.fgSecondary, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  primaryText: { color: colors.onAccent, fontSize: 17, fontWeight: '600' },
  ctaXImg: { width: 18, height: 18, resizeMode: 'contain', tintColor: colors.onAccent },
});
