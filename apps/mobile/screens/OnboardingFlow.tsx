import React, { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, PanResponder, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGrad, Path, Stop } from 'react-native-svg';
import { Logo } from '../components/Logo';
import { PressScale } from '../components/PressScale';
import { Slide } from '../components/Slide';
import { colors, radius } from '../src/theme';
import { ONBOARD_TRADERS } from '../src/demo';
import { useAuth } from '../src/auth';
import { updateProfile } from '../src/api/endpoints';
import { showToast } from '../src/toast';

const X_LOGO = require('../assets/x-logo.png');

/** Demo portfolio gain used for the "Potential Earnings" projection. */
const PROJ_PCT = 1112.66;
const group = (int: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
function fmtUsd(n: number): string {
  const [i, f] = n.toFixed(2).split('.');
  return `$${group(i)}.${f}`;
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
            <Text style={s.title}>Connect X (Twitter)</Text>
            <Text style={s.sub}>Claim your username and find friends</Text>
            <View style={s.xWrap}>
              <View style={s.glow} />
              <View style={[s.appCard, { backgroundColor: '#0A0A0A' }]}>
                <Image source={X_LOGO} style={s.xImg} />
              </View>
              <View style={[s.appCard, s.pointerCard]}>
                <Logo size={70} />
              </View>
            </View>
          </>
        ) : step === 1 ? (
          <>
            <Text style={s.title}>Create your username</Text>
            <Text style={s.sub}>You can always change this later.</Text>
            <View style={s.inputRow}>
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
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            <Text style={s.title}>Your potential earnings</Text>
            <Text style={s.sub}>If you'd copied every move from these traders, this is what you'd have made.</Text>
            <View style={s.earnCard}>
              <View style={s.earnHead}>
                <Text style={s.earnPortfolio}>Top Traders Portfolio</Text>
                <View style={s.earnPnlPill}>
                  <Ionicons name="trending-up" size={13} color={colors.accent} />
                  <Text style={s.earnPnlPillText}>{PROJ_PCT.toLocaleString()}%</Text>
                </View>
              </View>
              <Text style={s.earnShared}>190 shared trades · Profit & Loss</Text>

              <View style={s.earnDivider} />

              <Text style={s.earnLabel}>Projected earnings</Text>
              <Text style={s.earnBig}>{fmtUsd(invest * (PROJ_PCT / 100))}</Text>
              <View style={s.earnBadge}>
                <Text style={s.earnBadgeText}>+{PROJ_PCT.toLocaleString()}%</Text>
              </View>

              <EarnCurve />

              <View style={s.investRow}>
                <Text style={s.earnLabel}>Initial investment</Text>
                <Text style={s.investVal}>${invest.toLocaleString()}</Text>
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
              <TextInput value={ref} onChangeText={setRef} style={s.codeInput} autoCapitalize="characters" autoCorrect={false} />
            </View>
            <PressScale onPress={next} style={s.paste}>
              <Text style={s.pasteText}>Paste from clipboard</Text>
            </PressScale>
          </>
        )}
      </Slide>

      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <PressScale onPress={next} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 8 }}>
          <Text style={s.skip}>{step === 4 ? "I don't have a code" : "I'll do this later"}</Text>
        </PressScale>
        <PressScale onPress={step === 0 ? connectX : next} style={s.primary}>
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
        </PressScale>
      </View>
    </KeyboardAvoidingView>
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 8 },
  body: { flex: 1, paddingHorizontal: 22, paddingTop: 14 },
  title: { color: colors.fg, fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
  sub: { color: colors.fgMuted, fontSize: 17, lineHeight: 24, marginTop: 12 },
  accent: { color: colors.accentGlow, fontWeight: '600' },

  xWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 14 },
  glow: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: colors.accentSoft },
  appCard: { width: 116, height: 116, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  pointerCard: { backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: colors.border },
  xImg: { width: 52, height: 52, resizeMode: 'contain' },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bgRaised, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 16, marginTop: 24, borderWidth: 1, borderColor: colors.borderStrong },
  at: { color: colors.fgMuted, fontSize: 22, fontWeight: '600' },
  input: { flex: 1, color: colors.fg, fontSize: 22, fontWeight: '600', padding: 0 },

  trader: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bgRaised, borderRadius: radius.lg, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'transparent' },
  traderOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  tAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  tInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
  tName: { color: colors.fg, fontSize: 17, fontWeight: '700' },
  tHandle: { color: colors.fgMuted, fontSize: 14, marginTop: 1 },
  tPnl: { color: colors.bull, fontSize: 16, fontWeight: '700' },
  tFollowers: { color: colors.fgMuted, fontSize: 13, marginTop: 1 },
  showMore: { color: colors.fgSecondary, fontSize: 14, fontWeight: '600', textAlign: 'center', backgroundColor: colors.bgRaised, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 8, borderRadius: radius.pill, marginTop: 4 },

  codeBox: { backgroundColor: colors.bgRaised, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 18, marginTop: 24, borderWidth: 1, borderColor: colors.borderStrong },
  codeInput: { color: colors.fg, fontSize: 22, fontWeight: '600', padding: 0 },
  paste: { backgroundColor: colors.bgRaised, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  pasteText: { color: colors.fg, fontSize: 16, fontWeight: '700' },

  earnCard: { backgroundColor: colors.bgRaised, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 18, marginTop: 22 },
  earnHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  earnPortfolio: { color: colors.fg, fontSize: 19, fontWeight: '700' },
  earnPnlPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  earnPnlPillText: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  earnShared: { color: colors.fgMuted, fontSize: 13.5, marginTop: 4 },
  earnDivider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  earnLabel: { color: colors.fgMuted, fontSize: 14 },
  earnBig: { color: colors.fg, fontSize: 34, fontWeight: '800', letterSpacing: -1, marginTop: 4 },
  earnBadge: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: 9, paddingVertical: 4, marginTop: 10 },
  earnBadgeText: { color: colors.onAccent, fontSize: 13, fontWeight: '800' },
  investRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  investVal: { color: colors.fg, fontSize: 17, fontWeight: '700' },
  sliderTrack: { height: 12, borderRadius: 6, backgroundColor: colors.bgRaised2, marginTop: 12, justifyContent: 'center' },
  sliderFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6, backgroundColor: colors.accent },
  sliderThumb: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', marginLeft: -12, borderWidth: 2, borderColor: colors.accent },

  footer: { paddingHorizontal: 22, gap: 6 },
  skip: { color: colors.fgSecondary, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  primary: { backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
  primaryText: { color: colors.onAccent, fontSize: 17, fontWeight: '600' },
});
