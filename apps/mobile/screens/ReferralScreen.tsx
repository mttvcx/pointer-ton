import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, LayoutChangeEvent, PanResponder, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Path, Stop } from 'react-native-svg';
import { Screen } from '../components/Screen';
import { PressScale } from '../components/PressScale';
import { GlassFill } from '../components/GlassFill';
import { GlossButton } from '../components/GlossButton';
import { colors, radius } from '../src/theme';
import { copyText } from '../src/clipboard';
import { shareText } from '../src/share';
import { showToast } from '../src/toast';
import { useReferralCode, setReferralCode } from '../src/local';

/**
 * Refer & earn. You earn 30% of your friends' trading fees, forever. Fee model
 * (adjust the two constants if the economics change):
 *   TAKE_FEE 0.5% of volume · REFERRAL_SHARE 30% of that fee  →  0.15% of referred
 *   volume flows to you. (The other 50% of the fee is the trader's cashback.)
 * The chart auto-cycles through referred-volume tiers, animating the commission.
 */
const TAKE_FEE = 0.005; // 0.5%
const REFERRAL_SHARE = 0.3; // 30%
const REFERRER_RATE = TAKE_FEE * REFERRAL_SHARE; // 0.0015 → 0.15% of referred volume

const TIERS = [
  { vol: 250_000, label: '$250K' },
  { vol: 1_000_000, label: '$1M' },
  { vol: 5_000_000, label: '$5M' },
  { vol: 20_000_000, label: '$20M' },
];
const TIER_T = [0.15, 0.4, 0.65, 0.9]; // x-position of each tier on the curve (0..1)
const commissionOf = (i: number) => Math.round(TIERS[i].vol * REFERRER_RATE); // 375 / 1500 / 7500 / 30000

const CH_W = 320;
const CH_H = 200;
const CH_TOP = 14;
const curveY = (t: number) => CH_H - (CH_H - CH_TOP) * Math.pow(t, 2.2);

const money = (n: number) => `$${n.toLocaleString()}`;
const compactVol = (n: number) => (n >= 1_000_000 ? `$${n / 1_000_000}M` : `$${n / 1000}K`);

export function ReferralScreen({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const W = Dimensions.get('window').width;

  // slide-in + swipe-right-to-back (matches token/education/profile)
  const tx = useRef(new Animated.Value(W)).current;
  useEffect(() => {
    Animated.timing(tx, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [tx]);
  const close = useRef(onClose);
  close.current = onClose;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx > 12 && g.dx > Math.abs(g.dy) * 2.2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        if (g.dx > 0) tx.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > 90 || g.vx > 0.4) {
          Animated.timing(tx, { toValue: W, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(
            ({ finished }) => finished && close.current(),
          );
        } else {
          Animated.spring(tx, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 3 }).start();
        }
      },
    }),
  ).current;

  const code = useReferralCode();
  const [draft, setDraft] = useState('');
  const claim = () => {
    const clean = draft.replace(/[^A-Za-z0-9_]/g, '').slice(0, 20);
    if (clean.length < 3) {
      showToast('Pick at least 3 letters/numbers', { kind: 'error' });
      return;
    }
    setReferralCode(clean);
    showToast(`Your code is ${clean}`, { kind: 'success' });
  };

  const [tier, setTier] = useState(0);
  const [chartW, setChartW] = useState(0);
  const tipX = useRef(new Animated.Value(0)).current;
  const numFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => setTier((t) => (t + 1) % TIERS.length), 2400);
    return () => clearInterval(id);
  }, []);

  const dotX = (i: number) => TIER_T[i] * chartW;
  const dotY = (i: number) => curveY(TIER_T[i]);

  useEffect(() => {
    if (!chartW) return;
    Animated.spring(tipX, { toValue: dotX(tier), useNativeDriver: true, speed: 13, bounciness: 6 }).start();
    Animated.sequence([
      Animated.timing(numFade, { toValue: 0.25, duration: 120, useNativeDriver: true }),
      Animated.timing(numFade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, chartW]);

  const curvePath = useMemo(() => {
    const N = 30;
    const pts: string[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts.push(`${(t * CH_W).toFixed(1)} ${curveY(t).toFixed(1)}`);
    }
    return { line: `M${pts.join(' L')}`, area: `M${pts.join(' L')} L${CH_W} ${CH_H} L0 ${CH_H} Z` };
  }, []);

  const commission = commissionOf(tier);
  const tipTop = Math.max(4, dotY(tier) - 66);
  const lineTop = tipTop + 34;
  const lineHeight = Math.max(0, dotY(tier) - lineTop - 6);

  const onCopy = async () => {
    const ok = await copyText(code);
    showToast(ok ? 'Referral code copied' : 'Copy failed', { kind: ok ? 'success' : 'error' });
  };
  const onShare = () => void shareText(`Trade on Pointer with my code ${code} — 50% of your fees back, and I earn 30% of yours. Everybody wins.`);

  return (
    <Screen>
      <Animated.View {...pan.panHandlers} style={{ flex: 1, transform: [{ translateX: tx }] }}>
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <PressScale onPress={onClose} to={0.85} hitSlop={10} style={s.back}>
            <Ionicons name="chevron-back" size={26} color={colors.fgSecondary} />
          </PressScale>
          <Text style={s.title}>Refer & earn</Text>
          <View style={s.back} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          {code ? (
            <>
              <View style={s.codeCard}>
                <GlassFill />
                <Text style={s.codeLabel}>Your referral code</Text>
                <View style={s.codeRow}>
                  <Text style={s.code} numberOfLines={1}>
                    {code}
                  </Text>
                  <PressScale onPress={onCopy} to={0.9} hitSlop={8} style={s.copyChip}>
                    <Ionicons name="copy-outline" size={15} color={colors.accentGlow} />
                    <Text style={s.copyChipText}>Copy</Text>
                  </PressScale>
                </View>
              </View>

              <GlossButton onPress={onShare} style={{ marginTop: 14 }}>
                <Ionicons name="share-outline" size={18} color={colors.onAccent} />
                <Text style={s.shareText}>Share referral</Text>
              </GlossButton>
            </>
          ) : (
            <View style={s.codeCard}>
              <GlassFill />
              <Text style={s.codeLabel}>Claim your referral code</Text>
              <View style={s.claimRow}>
                <TextInput
                  value={draft}
                  onChangeText={(t) => setDraft(t.replace(/[^A-Za-z0-9_]/g, '').slice(0, 20))}
                  placeholder="yourcode"
                  placeholderTextColor={colors.fgFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={s.claimInput}
                  onSubmitEditing={claim}
                  returnKeyType="done"
                />
                <PressScale onPress={claim} to={0.92} style={s.claimBtn}>
                  <Text style={s.claimBtnText}>Claim</Text>
                </PressScale>
              </View>
              <Text style={s.claimHint}>Pick a code friends will use at signup. Letters & numbers, 3–20 chars.</Text>
            </View>
          )}

          <Text style={s.pitch}>Invite friends and earn commissions — get up to</Text>
          <View style={s.bigRow}>
            <Animated.Text style={[s.big, { opacity: numFade }]}>{money(commission)}</Animated.Text>
            <Text style={s.bigUnit}> /month</Text>
          </View>

          {/* Animated earnings chart */}
          <View style={s.chartWrap} onLayout={(e: LayoutChangeEvent) => setChartW(e.nativeEvent.layout.width)}>
            <Svg width="100%" height={CH_H} viewBox={`0 0 ${CH_W} ${CH_H}`} preserveAspectRatio="none">
              <Defs>
                <SvgGrad id="refFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.accent} stopOpacity={0.28} />
                  <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
                </SvgGrad>
              </Defs>
              <Path d={curvePath.area} fill="url(#refFill)" />
              <Path d={curvePath.line} fill="none" stroke={colors.accent} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              {TIER_T.map((t, i) => (
                <Circle key={i} cx={t * CH_W} cy={curveY(t)} r={i === tier ? 7 : 5} fill={i === tier ? colors.accentGlow : colors.bg} stroke={colors.accent} strokeWidth={2.4} />
              ))}
            </Svg>

            {chartW > 0 ? (
              <Animated.View pointerEvents="none" style={[s.tipWrap, { top: tipTop, transform: [{ translateX: tipX }] }]}>
                <View style={s.tip}>
                  <Text style={s.tipLabel}>Earn commission</Text>
                  <Text style={s.tipValue}>
                    {money(commission)}
                    <Text style={s.tipUnit}>/mo</Text>
                  </Text>
                </View>
                <View style={[s.tipLine, { top: 34, height: lineHeight }]} />
              </Animated.View>
            ) : null}
          </View>

          <View style={s.volRow}>
            {TIERS.map((t, i) => (
              <Text key={i} style={[s.volLabel, i === tier && s.volLabelOn]}>
                {compactVol(t.vol)} vol
              </Text>
            ))}
          </View>

          <Text style={s.foot}>
            You earn <Text style={s.footStrong}>30%</Text> of your friends' trading fees, forever. Figures are per month at that
            referred volume (30% of a 0.5% fee = 0.15% of volume).
          </Text>
        </ScrollView>
      </Animated.View>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10 },
  back: { width: 40, alignItems: 'flex-start' },
  title: { color: colors.fg, fontSize: 18, fontWeight: '700' },

  codeCard: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: 16, marginTop: 8 },
  codeLabel: { color: colors.fgMuted, fontSize: 13 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  code: { color: colors.fg, fontSize: 22, fontWeight: '800', letterSpacing: 0.3, flex: 1 },
  copyChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.accent + '55' },
  copyChipText: { color: colors.accentGlow, fontSize: 13, fontWeight: '700' },

  claimRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  claimInput: { flex: 1, color: colors.fg, fontSize: 18, fontWeight: '700', backgroundColor: colors.bgRaised2, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  claimBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 18, paddingVertical: 13 },
  claimBtnText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  claimHint: { color: colors.fgFaint, fontSize: 12, lineHeight: 17, marginTop: 10 },

  shareText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },

  pitch: { color: colors.fgSecondary, fontSize: 16, fontWeight: '600', marginTop: 30, lineHeight: 22 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6 },
  big: { color: colors.accent, fontSize: 52, fontWeight: '800', letterSpacing: -1.5 },
  bigUnit: { color: colors.fgMuted, fontSize: 18, fontWeight: '600' },

  chartWrap: { height: CH_H, marginTop: 18 },
  tipWrap: { position: 'absolute', left: 0, width: 150, marginLeft: -75, alignItems: 'center' },
  tip: { alignItems: 'center' },
  tipLabel: { color: colors.fgMuted, fontSize: 12 },
  tipValue: { color: colors.fg, fontSize: 18, fontWeight: '800', marginTop: 1 },
  tipUnit: { color: colors.fgMuted, fontSize: 13, fontWeight: '600' },
  tipLine: { position: 'absolute', left: '50%', marginLeft: -0.75, width: 1.5, backgroundColor: 'rgba(255,255,255,0.5)' },

  volRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 4 },
  volLabel: { color: colors.fgMuted, fontSize: 12.5, fontWeight: '600' },
  volLabelOn: { color: colors.accent, fontWeight: '800' },

  foot: { color: colors.fgFaint, fontSize: 12.5, lineHeight: 18, marginTop: 22 },
  footStrong: { color: colors.fgSecondary, fontWeight: '700' },
});
