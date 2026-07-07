import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '../components/Screen';
import { Logo } from '../components/Logo';
import { GlassFill } from '../components/GlassFill';
import { GlossButton } from '../components/GlossButton';
import { MetalButton } from '../components/MetalButton';
import { PressScale } from '../components/PressScale';
import { Rise } from '../components/Rise';
import { Slide } from '../components/Slide';
import { VisaMark } from '../components/VisaMark';
import { CardShine } from '../components/CardShine';
import { colors, radius } from '../src/theme';
import { showToast } from '../src/toast';
import { usd } from '../src/format';
import { beginActivation, completeActivation } from '../src/financial/store';
import { addToApplePay } from '../src/financial/wallet';
import type { CardInfo } from '../src/financial/types';

/* ── Intro / empty state ─────────────────────────────────── */

const SLIDES = [
  { title: 'Spend without selling', sub: 'Borrow against your crypto — your assets keep growing while you spend.', visual: 'coins' as const },
  { title: 'Your Pointer Card', sub: 'Trade, borrow, spend and earn from one non-custodial account.', visual: 'card' as const },
  { title: 'No ID to start', sub: 'Get in and borrow instantly. Verify only when you order a card.', visual: 'usdc' as const },
];
const SLIDE_MS = 4600;

export function FinancialIntro({ onStart }: { onStart: () => void }) {
  const insets = useSafeAreaInsets();
  const [slide, setSlide] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: SLIDE_MS, easing: Easing.linear, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (finished) setSlide((x) => (x + 1) % SLIDES.length);
    });
    return () => anim.stop();
  }, [slide, progress]);

  const cur = SLIDES[slide];

  return (
    <Screen>
      <LinearGradient
        colors={['rgba(210,216,222,0.14)', 'rgba(150,158,168,0.04)', 'transparent']}
        start={{ x: 0.25, y: 0 }}
        end={{ x: 0.75, y: 1 }}
        style={s.metalGlow}
        pointerEvents="none"
      />
      {/* Keeps the tab bar (so the user can bail), so the CTA must clear the
          64px nav island sitting at insets.bottom + 8. */}
      <View style={[s.introRoot, { paddingTop: insets.top + 22, paddingBottom: insets.bottom + 86 }]}>
        {/* timed progress bars */}
        <View style={s.progressRow}>
          {SLIDES.map((_, i) => (
            <View key={i} style={s.seg}>
              <Animated.View
                style={[
                  s.segFill,
                  { width: i < slide ? '100%' : i === slide ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) : '0%' },
                ]}
              />
            </View>
          ))}
        </View>

        {/* tap zones: left = back, right = forward (story-style) */}
        <View style={s.tapZones} pointerEvents="box-none">
          <Pressable style={s.tapLeft} onPress={() => setSlide((x) => (x - 1 + SLIDES.length) % SLIDES.length)} />
          <Pressable style={s.tapRight} onPress={() => setSlide((x) => (x + 1) % SLIDES.length)} />
        </View>

        <Slide key={slide} style={s.slideBody}>
          <Text style={s.slideTitle}>{cur.title}</Text>
          <Text style={s.slideSub}>{cur.sub}</Text>
          <View style={s.visualWrap}>
            <IntroVisual kind={cur.visual} />
          </View>
        </Slide>

        {/* CTA pinned at the bottom */}
        <View style={s.introCta}>
          <MetalButton onPress={onStart}>
            <Text style={s.cta}>Get started</Text>
            <Ionicons name="arrow-forward" size={18} color="#0A0C10" />
          </MetalButton>
          <Text style={s.introFine}>No ID to start · non-custodial · your keys, your crypto.</Text>
        </View>
      </View>
    </Screen>
  );
}

/** The 3D visual for a slide — floating coins, the metal card, or a hero coin. */
function IntroVisual({ kind }: { kind: 'coins' | 'card' | 'usdc' }) {
  if (kind === 'card') {
    return (
      <View style={s.introCard}>
        <LinearGradient colors={['#12332A', '#0E241C', '#06100D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }} style={s.introCardSheen} pointerEvents="none" />
        <CardShine intensity={0.34} />
        <View style={s.introCardTop}>
          <View style={s.introCardBrand}>
            <Logo size={20} style={{ tintColor: '#fff' }} />
            <Text style={s.introCardBrandText}>pointer.</Text>
          </View>
          <Ionicons name="wifi" size={16} color="rgba(255,255,255,0.5)" style={{ transform: [{ rotate: '90deg' }] }} />
        </View>
        <View style={s.introCardNumRow}>
          <Text style={s.introCardNum}>4242  ••••  ••••  8817</Text>
          <VisaMark size={18} />
        </View>
      </View>
    );
  }
  if (kind === 'usdc') {
    return <Image source={require('../assets/crypto/usdc.png')} style={s.heroCoin} resizeMode="contain" />;
  }
  return (
    <View style={s.cluster}>
      <Image source={require('../assets/crypto/btc.png')} style={[s.coin, { top: 6, left: 28, transform: [{ rotate: '-8deg' }] }]} resizeMode="contain" />
      <Image source={require('../assets/crypto/eth.png')} style={[s.coin, { top: 62, right: 18, transform: [{ rotate: '9deg' }] }]} resizeMode="contain" />
      <Image source={require('../assets/crypto/sol.png')} style={[s.coin, { bottom: 0, left: 46, transform: [{ rotate: '5deg' }] }]} resizeMode="contain" />
      <Image source={require('../assets/crypto/usdc.png')} style={[s.coinSm, { top: 0, right: 54, transform: [{ rotate: '-6deg' }] }]} resizeMode="contain" />
    </View>
  );
}

/* ── Activation flow ─────────────────────────────────────── */

type Step = 'identity' | 'provisioning' | 'done';
const COUNTRIES = [
  { name: 'United States', flag: '🇺🇸' },
  { name: 'Canada', flag: '🇨🇦' },
  { name: 'United Kingdom', flag: '🇬🇧' },
  { name: 'Australia', flag: '🇦🇺' },
  { name: 'Other', flag: '🌍' },
];
const PROV_STEPS = ['Creating your account', 'Issuing your virtual card', 'Turning on Smart Yield'];

export function FinancialActivation({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('identity');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('United States');
  const [card, setCard] = useState<CardInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const canContinue = name.trim().length >= 2;

  const runProvision = async () => {
    beginActivation();
    setStep('provisioning');
    const issued = await completeActivation({ legalName: name.trim(), country, fullKyc: false });
    setCard(issued);
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
          {step === 'identity' ? (
            <PressScale onPress={onClose} style={s.close} to={0.9}>
              <Ionicons name="close" size={22} color={colors.fgSecondary} />
            </PressScale>
          ) : (
            <View style={s.close} />
          )}
          <Text style={s.topTitle}>Order your card</Text>
          <View style={s.close} />
        </View>

        <Slide key={step} style={{ flex: 1 }}>
        {step === 'identity' ? (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.stepKicker}>QUICK CHECK</Text>
            <Text style={s.stepTitle}>Who’s this for?</Text>
            <Text style={s.stepLede}>This is all we need to issue your virtual card right now. A fuller ID check later unlocks a physical card and higher limits.</Text>

            <Text style={s.label}>Legal name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Jane Trader"
              placeholderTextColor={colors.fgFaint}
              style={s.input}
              autoCapitalize="words"
              returnKeyType="done"
            />

            <Text style={s.label}>Country</Text>
            <View style={s.countryWrap}>
              {COUNTRIES.map((c) => (
                <PressScale key={c.name} to={0.95} onPress={() => setCountry(c.name)} style={[s.countryChip, country === c.name && s.countryChipOn]}>
                  <Text style={[s.countryText, country === c.name && s.countryTextOn]}>{c.flag}  {c.name}</Text>
                </PressScale>
              ))}
            </View>

            <View style={s.reassure}>
              <Ionicons name="lock-closed" size={14} color={colors.fgMuted} />
              <Text style={s.reassureText}>Encrypted and shared only with our card issuer to open your account. No credit check.</Text>
            </View>

            <MetalButton onPress={canContinue ? runProvision : () => {}} style={{ marginTop: 24, opacity: canContinue ? 1 : 0.5 }}>
              <Text style={s.cta}>Issue my card</Text>
            </MetalButton>
          </ScrollView>
        ) : step === 'provisioning' ? (
          <Provisioning done={card != null} onFinished={() => setStep('done')} />
        ) : (
          <Done card={card} busy={busy} setBusy={setBusy} onClose={onClose} />
        )}
        </Slide>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Provisioning({ done, onFinished }: { done: boolean; onFinished: () => void }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((a) => Math.min(a + 1, PROV_STEPS.length)), 620);
    return () => clearInterval(id);
  }, []);
  // Advance only when both the steps have played AND the card is issued.
  useEffect(() => {
    if (done && active >= PROV_STEPS.length) {
      const t = setTimeout(onFinished, 400);
      return () => clearTimeout(t);
    }
  }, [done, active]);

  return (
    <View style={s.provWrap}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={s.provTitle}>Setting things up…</Text>
      <View style={{ marginTop: 22, alignSelf: 'stretch', paddingHorizontal: 40 }}>
        {PROV_STEPS.map((label, i) => {
          const state = i < active ? 'done' : i === active ? 'busy' : 'wait';
          return (
            <View key={label} style={s.provStep}>
              <View style={[s.provDot, state === 'done' && { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                {state === 'done' ? <Ionicons name="checkmark" size={13} color={colors.accent} /> : state === 'busy' ? <ActivityIndicator color={colors.fgMuted} size="small" /> : null}
              </View>
              <Text style={[s.provLabel, state !== 'wait' && { color: colors.fg }]}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Done({ card, busy, setBusy, onClose }: { card: CardInfo | null; busy: boolean; setBusy: (b: boolean) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const pop = useRef(new Animated.Value(0.9)).current;
  const [inWallet, setInWallet] = useState(false);
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 8 }).start();
  }, []);

  const add = async () => {
    setBusy(true);
    const r = await addToApplePay();
    setBusy(false);
    if (r.ok) {
      setInWallet(true);
      showToast(r.simulated ? 'Added to Apple Pay (demo)' : 'Added to Apple Pay', { kind: 'success' });
    } else {
      showToast('Apple Pay setup is coming soon', { kind: 'info' });
    }
  };

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 24, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
      <View style={s.doneBadge}>
        <Ionicons name="checkmark-circle" size={26} color={colors.accent} />
      </View>
      <Text style={s.doneTitle}>Your Pointer Card is ready</Text>
      <Text style={s.doneSub}>Virtual and ready to spend. Add it to Apple Pay to tap anywhere.</Text>

      <Animated.View style={[s.doneCard, { transform: [{ scale: pop }] }]}>
        <LinearGradient colors={['#0E241C', '#0A1512', '#06100D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={s.introCardTop}>
          <View style={s.introCardBrand}>
            <Logo size={20} style={{ tintColor: '#fff' }} />
            <Text style={s.introCardBrandText}>pointer.</Text>
          </View>
          <Text style={s.doneVirtual}>Virtual</Text>
        </View>
        <Text style={s.introCardNum}>•••• •••• •••• {card?.last4 ?? '••••'}</Text>
        <Text style={s.doneLimit}>{usd(card?.monthlyLimit ?? 5000, 0)}/mo limit</Text>
      </Animated.View>

      <GlossButton onPress={inWallet ? onClose : add} style={{ marginTop: 26, alignSelf: 'stretch', opacity: busy ? 0.6 : 1 }}>
        {busy ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : inWallet ? (
          <Text style={s.cta}>Go to dashboard</Text>
        ) : (
          <>
            <Ionicons name="logo-apple" size={18} color={colors.onAccent} />
            <Text style={s.cta}>Add to Apple Pay</Text>
          </>
        )}
      </GlossButton>
      {!inWallet ? (
        <PressScale onPress={onClose} style={{ marginTop: 14 }} to={0.97}>
          <Text style={s.skip}>Maybe later</Text>
        </PressScale>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  cta: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },

  // intro
  metalGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 360 },
  introRoot: { flex: 1, paddingHorizontal: 24 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 26 },
  seg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  segFill: { height: 4, borderRadius: 2, backgroundColor: '#fff' },
  tapZones: { position: 'absolute', top: 60, left: 0, right: 0, bottom: 210, flexDirection: 'row' },
  tapLeft: { flex: 1 },
  tapRight: { flex: 2 },
  slideBody: { flex: 1, alignItems: 'center', paddingTop: 8 },
  slideTitle: { color: colors.fg, fontSize: 30, fontWeight: '800', letterSpacing: -0.8, textAlign: 'center' },
  slideSub: { color: colors.fgSecondary, fontSize: 15.5, lineHeight: 22, textAlign: 'center', marginTop: 12, paddingHorizontal: 8 },
  visualWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  cluster: { width: 280, height: 260 },
  coin: { position: 'absolute', width: 150, height: 150 },
  coinSm: { position: 'absolute', width: 92, height: 92 },
  heroCoin: { width: 210, height: 210 },
  introCardWrap: { alignItems: 'center', marginBottom: 6 },
  introCard: { width: 260, height: 158, borderRadius: 18, overflow: 'hidden', padding: 16, justifyContent: 'space-between', borderWidth: 1, borderColor: colors.accent + '33', transform: [{ perspective: 900 }, { rotateY: '-9deg' }, { rotateZ: '-3deg' }], shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 26, shadowOffset: { width: 0, height: 14 } },
  introCardSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '65%' },
  introCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  introCardBrand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  introCardBrandText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  introCardNumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  introCardNum: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: '600', letterSpacing: 2 },
  introTitle: { color: colors.fg, fontSize: 29, fontWeight: '800', letterSpacing: -0.8, marginTop: 24, textAlign: 'center' },
  introLede: { color: colors.fgSecondary, fontSize: 15, lineHeight: 21, marginTop: 9, textAlign: 'center' },
  perkList: { marginTop: 26 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 10 },
  perkIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  perkTitle: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  perkSub: { color: colors.fgMuted, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  introCta: { marginTop: 'auto' },
  introFine: { color: colors.fgFaint, fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 17 },

  // top bar
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10 },
  topTitle: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // identity step
  stepKicker: { color: colors.accentGlow, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: 8 },
  stepTitle: { color: colors.fg, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 6 },
  stepLede: { color: colors.fgSecondary, fontSize: 14.5, lineHeight: 21, marginTop: 10 },
  label: { color: colors.fgMuted, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.3, marginTop: 22, marginBottom: 8 },
  input: { backgroundColor: colors.bgRaised2, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 15, color: colors.fg, fontSize: 16, borderWidth: 1, borderColor: colors.border },
  countryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  countryChip: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.bgRaised2, borderWidth: 1, borderColor: colors.border },
  countryChipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  countryText: { color: colors.fgSecondary, fontSize: 13.5, fontWeight: '600' },
  countryTextOn: { color: colors.accentGlow },
  reassure: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginTop: 20 },
  reassureText: { color: colors.fgMuted, fontSize: 12.5, lineHeight: 18, flex: 1 },

  // provisioning
  provWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  provTitle: { color: colors.fg, fontSize: 19, fontWeight: '700', marginTop: 18 },
  provStep: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 9 },
  provDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  provLabel: { color: colors.fgMuted, fontSize: 15, fontWeight: '600' },

  // done
  doneBadge: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  doneTitle: { color: colors.fg, fontSize: 23, fontWeight: '800', letterSpacing: -0.4, marginTop: 16, textAlign: 'center' },
  doneSub: { color: colors.fgSecondary, fontSize: 14.5, lineHeight: 21, marginTop: 8, textAlign: 'center', paddingHorizontal: 10 },
  doneCard: { width: '100%', height: 190, borderRadius: radius.lg, overflow: 'hidden', padding: 18, justifyContent: 'space-between', marginTop: 26, borderWidth: 1, borderColor: colors.accent + '33' },
  doneVirtual: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' },
  doneLimit: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  skip: { color: colors.fgMuted, fontSize: 14.5, fontWeight: '600' },
});
