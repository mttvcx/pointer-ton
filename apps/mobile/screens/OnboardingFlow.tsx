import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '../components/Logo';
import { PressScale } from '../components/PressScale';
import { Slide } from '../components/Slide';
import { colors, radius } from '../src/theme';
import { ONBOARD_TRADERS } from '../src/demo';

const X_LOGO = require('../assets/x-logo.png');

export function OnboardingFlow({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [username, setUsername] = useState('');
  const [ref, setRef] = useState('');
  const [following, setFollowing] = useState<Record<string, boolean>>({});

  const next = () => {
    if (step >= 3) return onDone();
    setDir(1);
    setStep((s) => s + 1);
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
              <Text style={s.showMore}>Show more</Text>
            </ScrollView>
          </>
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
          <Text style={s.skip}>{step === 3 ? "I don't have a code" : step === 0 ? "I'll do this later" : "I'll do this later"}</Text>
        </PressScale>
        <PressScale onPress={next} style={s.primary}>
          <Text style={s.primaryText}>{step === 0 ? 'Claim username' : step === 2 ? 'Continue' : step === 3 ? 'Apply code' : 'Continue'}</Text>
        </PressScale>
      </View>
    </KeyboardAvoidingView>
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

  footer: { paddingHorizontal: 22, gap: 6 },
  skip: { color: colors.fgSecondary, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  primary: { backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
