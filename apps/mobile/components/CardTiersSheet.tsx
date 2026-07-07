import React, { useState } from 'react';
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DragSheet } from './DragSheet';
import { PressScale } from './PressScale';
import { colors, radius } from '../src/theme';
import { usd, group, compactUsd } from '../src/format';
import { showToast } from '../src/toast';
import { TIERS, tierById, tierUnlocked, tierProgress, CATEGORY_META, CATEGORY_ORDER, type Tier } from '../src/financial/tiers';
import { useVolume30d, usePtrPoints } from '../src/financial/usage';
import { useTier, setTier } from '../src/financial/credit';
import { useKycLevel, kycLevelNow, tierKyc, type KycLevel } from '../src/financial/kyc';
import { KycSheet } from './KycSheet';
import { VisaMark } from './VisaMark';
import { CardShine } from './CardShine';

const W = Dimensions.get('window').width;
const CARD_W = W - 36; // full-bleed within the sheet's 18px padding

/**
 * Pointer Card membership tiers — Basic → Platinum, swipe sideways. Each shows the
 * annual fee, monthly limit, Credit-mode cashback, and perks (concierge / lounges /
 * fast-track). Free Basic on signup; upgrade for higher cashback + limits + perks.
 */
export function CardTiersSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const current = useTier();
  const kycLevel = useKycLevel();
  const volume = useVolume30d();
  const points = usePtrPoints();
  const currentIdx = Math.max(0, TIERS.findIndex((t) => t.id === current));
  const [idx, setIdx] = useState(currentIdx);
  const [kycNeed, setKycNeed] = useState<KycLevel | null>(null);
  const [pending, setPending] = useState<Tier | null>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / CARD_W);
    if (i !== idx) setIdx(i);
  };

  // A card needs KYC (lite/full); the borrow itself never does. If under-verified,
  // route through the KYC sheet first, then apply the tier.
  const upgrade = (tier: Tier) => {
    if (!tierUnlocked(tier, volume, points)) {
      const need = tier.volumeReq - volume;
      showToast(`Trade ${compactUsd(Math.max(0, need))} more to unlock ${tier.name}`, { sub: `or reach ${group(String(tier.pointsReq))} PTR Points`, kind: 'info' });
      return;
    }
    const need = tierKyc(tier.id);
    if (kycLevel < need) {
      setPending(tier);
      setKycNeed(need);
      return;
    }
    setTier(tier.id);
    showToast(`${tier.name} membership active`, { sub: `${tier.cashbackCredit}% cashback · no fee`, kind: 'success' });
  };
  const onKycClose = () => {
    setKycNeed(null);
    if (pending && kycLevelNow() >= tierKyc(pending.id)) {
      setTier(pending.id);
      showToast(`${pending.name} membership active`, { kind: 'success' });
    }
    setPending(null);
  };

  return (
    <DragSheet visible={visible} onClose={onClose}>
      {/* silver sheet-glow — the finance section's metallic identity */}
      <LinearGradient
        colors={['rgba(214,220,226,0.20)', 'rgba(150,158,168,0.05)', 'transparent']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={s.sheetGlow}
        pointerEvents="none"
      />
      <Text style={s.title}>Pointer Card</Text>
      <Text style={s.sub}>No annual fee — tiers are earned by how much you trade.</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingRight: 0 }}
        style={{ marginHorizontal: -18, marginTop: 16 }}
        contentOffset={{ x: currentIdx * CARD_W, y: 0 }}
      >
        {TIERS.map((t) => (
          <View key={t.id} style={{ width: CARD_W, paddingHorizontal: 18 }}>
            <TierCard tier={t} current={t.id === current} kycLevel={kycLevel} volume={volume} points={points} onUpgrade={() => upgrade(t)} />
          </View>
        ))}
      </ScrollView>

      <View style={s.dots}>
        {TIERS.map((t, i) => (
          <View key={t.id} style={[s.dot, i === idx && { backgroundColor: tierById(TIERS[idx].id).accent, width: 18 }]} />
        ))}
      </View>

      <Text style={s.foot}>
        Your trading volume (terminal + mobile) unlocks your tier and funds the perks — no subscription. Cashback comes from
        interchange + the Credit-mode borrow spread.
      </Text>

      <KycSheet visible={kycNeed !== null} onClose={onKycClose} requireLevel={kycNeed ?? 1} />
    </DragSheet>
  );
}

function TierCard({ tier, current, kycLevel, volume, points, onUpgrade }: { tier: Tier; current: boolean; kycLevel: KycLevel; volume: number; points: number; onUpgrade: () => void }) {
  const needsKyc = kycLevel < tierKyc(tier.id);
  const { ink, sub } = faceInk(tier.gradient);
  const lightMetal = ink === '#0A0C10';
  const unlocked = tierUnlocked(tier, volume, points);
  const progress = tierProgress(tier, volume, points);
  const volNeeded = Math.max(0, tier.volumeReq - volume);

  return (
    <View style={s.card}>
      {/* metal card face — real brushed depth: base gradient + diagonal sheen +
          brushed streaks + a moving shine + a polished top edge + a darkened
          bottom edge so it reads like milled metal, not a flat swatch. */}
      <View style={s.face}>
        <LinearGradient colors={tier.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* brushed anisotropic streaks */}
        <LinearGradient
          colors={lightMetal
            ? ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.28)', 'rgba(0,0,0,0.06)']
            : ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.12)', 'rgba(0,0,0,0.10)']}
          locations={[0, 0.42, 0.66, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* top-down polish */}
        <LinearGradient
          colors={['rgba(255,255,255,0.4)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.14)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <CardShine intensity={lightMetal ? 0.5 : 0.32} />
        <View style={s.faceEdge} pointerEvents="none" />
        <View style={s.faceTop}>
          <Text style={[s.faceBrand, { color: ink }]}>pointer.</Text>
          <Text style={[s.faceTier, { color: sub }]}>{tier.name}</Text>
        </View>
        <View style={s.faceBottom}>
          <Text style={[s.faceMode, { color: ink }]}>CREDIT</Text>
          <VisaMark size={24} tint={ink} style={{ opacity: 0.92 }} />
        </View>
      </View>

      <View style={s.feeRow}>
        <View style={{ flex: 1 }}>
          {tier.volumeReq === 0 ? (
            <>
              <Text style={s.fee}>Included</Text>
              <Text style={s.feeUnit}>free for everyone</Text>
            </>
          ) : unlocked ? (
            <>
              <Text style={[s.fee, { color: colors.bull }]}>Unlocked</Text>
              <Text style={s.feeUnit}>earned by your volume</Text>
            </>
          ) : (
            <>
              <Text style={s.fee}>{compactUsd(tier.volumeReq)}</Text>
              <Text style={s.feeUnit}>30-day volume · or {group(String(tier.pointsReq))} pts</Text>
            </>
          )}
        </View>
        <View style={s.cashbackPill}>
          <Text style={[s.cashbackPct, { color: tier.accent }]}>{tier.cashbackCredit}%</Text>
          <Text style={s.cashbackLabel}>cashback</Text>
        </View>
      </View>

      {/* unlock progress — how close your usage is to earning this tier */}
      {tier.volumeReq > 0 && !unlocked ? (
        <View style={s.progressWrap}>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: tier.accent }]} />
          </View>
          <Text style={s.progressText}>{compactUsd(volume)} traded · {compactUsd(volNeeded)} to go</Text>
        </View>
      ) : null}

      <Text style={s.tagline}>{tier.tagline}</Text>

      {/* Boosted cashback by category — the eye-catching rates, on top of base */}
      <View style={s.boosts}>
        <Text style={s.boostTitle}>BOOSTED CASHBACK</Text>
        <View style={s.boostRow}>
          {CATEGORY_ORDER.map((c) => (
            <View key={c} style={s.boostChip}>
              <Ionicons name={CATEGORY_META[c].icon as any} size={15} color={tier.accent} />
              <Text style={[s.boostRate, { color: tier.accent }]}>{tier.boosts[c].rate}%</Text>
              <Text style={s.boostLabel}>{CATEGORY_META[c].label}</Text>
              <Text style={s.boostCap}>to ${tier.boosts[c].capMonthly}/mo</Text>
            </View>
          ))}
        </View>
        <Text style={s.boostBase}>{tier.cashbackCredit}% on everything else · caps apply</Text>
      </View>

      <View style={s.rows}>
        <Perk icon="card-outline" label="Monthly limit" value={`$${group(String(tier.monthlyLimit))}`} />
        <Perk icon="cash-outline" label="Credit-mode cashback" value={`${tier.cashbackCredit}%`} />
        <Perk icon="wallet-outline" label="Cash-mode cashback" value={`${tier.cashbackCash}%`} />
        <Perk icon="sparkles-outline" label="Concierge" value={tier.concierge ?? '—'} muted={!tier.concierge} />
        <Perk icon="airplane-outline" label="Airport lounges" value={tier.loungesLabel} muted={tier.loungeVisits === 0} />
        <Perk icon="flash-outline" label="Fast track" value={tier.fastTrack ? `${tier.fastTrack}/year` : '—'} muted={!tier.fastTrack} />
      </View>

      {current ? (
        <View style={[s.cta, s.ctaCurrent]}>
          <Ionicons name="checkmark-circle" size={17} color={colors.bull} />
          <Text style={s.ctaCurrentText}>Current plan</Text>
        </View>
      ) : !unlocked ? (
        <PressScale onPress={onUpgrade} to={0.98} style={[s.cta, s.ctaLocked]}>
          <Ionicons name="lock-closed" size={15} color={colors.fgMuted} />
          <Text style={s.ctaLockedText}>Keep trading to unlock</Text>
        </PressScale>
      ) : (
        <PressScale onPress={onUpgrade} to={0.97} style={[s.cta, s.ctaMetal, { backgroundColor: tier.accent }]}>
          <LinearGradient colors={tier.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <LinearGradient colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.ctaSheen} pointerEvents="none" />
          {needsKyc ? <Ionicons name="shield-checkmark" size={15} color={darkText(tier.accent) ? '#0A0C10' : '#fff'} /> : null}
          <Text style={[s.ctaText, { color: darkText(tier.accent) ? '#0A0C10' : '#fff' }]}>
            {needsKyc ? `Verify to get ${tier.name}` : `Get ${tier.name}`}
          </Text>
        </PressScale>
      )}
      {needsKyc && unlocked ? <Text style={s.kycHint}>ID needed for the card — borrowing + in-app spend stays ID-free.</Text> : null}
    </View>
  );
}

function Perk({ icon, label, value, muted }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string; muted?: boolean }) {
  return (
    <View style={s.perk}>
      <Ionicons name={icon} size={15} color={muted ? colors.fgFaint : colors.fgMuted} />
      <Text style={s.perkLabel}>{label}</Text>
      <Text style={[s.perkValue, muted && { color: colors.fgFaint }]}>{value}</Text>
    </View>
  );
}

/** Perceived luminance 0..255 of a hex color. */
function lum(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** True when the accent is light enough to need dark button text. */
function darkText(hex: string): boolean {
  return lum(hex) > 150;
}

/** Ink for the card face — dark on light metals (silver/chrome/gold), light on
 *  dark metals (gunmetal/obsidian). Uses the average of the gradient stops. */
function faceInk(gradient: [string, string]): { ink: string; sub: string } {
  const avg = (lum(gradient[0]) + lum(gradient[1])) / 2;
  return avg > 150 ? { ink: '#0A0C10', sub: 'rgba(10,12,16,0.60)' } : { ink: '#F4F6F8', sub: 'rgba(255,255,255,0.72)' };
}

const s = StyleSheet.create({
  sheetGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  title: { color: colors.fg, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  sub: { color: colors.fgMuted, fontSize: 13.5, textAlign: 'center', marginTop: 6 },

  card: { borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: 'rgba(214,220,226,0.18)', backgroundColor: colors.bgRaised },
  face: { height: 150, borderRadius: 16, overflow: 'hidden', padding: 16, justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  faceEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255,255,255,0.55)' },
  faceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faceBrand: { fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  faceTier: { fontSize: 13, fontWeight: '700' },
  faceBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  faceMode: { fontSize: 13, fontWeight: '700', letterSpacing: 1 },

  feeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  fee: { color: colors.fg, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  feeUnit: { color: colors.fgMuted, fontSize: 12.5, marginTop: 1 },
  cashbackPill: { alignItems: 'flex-end' },
  cashbackPct: { fontSize: 26, fontWeight: '800' },
  cashbackLabel: { color: colors.fgMuted, fontSize: 12 },
  progressWrap: { marginTop: 14 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.bgRaised2, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  progressText: { color: colors.fgMuted, fontSize: 12, fontWeight: '600', marginTop: 7 },
  tagline: { color: colors.fgSecondary, fontSize: 13.5, marginTop: 12 },
  boosts: { marginTop: 14, borderRadius: radius.md, backgroundColor: colors.bgRaised2, padding: 12 },
  boostTitle: { color: colors.fgMuted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 },
  boostRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  boostChip: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.bg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  boostRate: { fontSize: 16, fontWeight: '800' },
  boostLabel: { color: colors.fgMuted, fontSize: 10.5, fontWeight: '600' },
  boostCap: { color: colors.fgFaint, fontSize: 9.5, marginTop: 1 },
  boostBase: { color: colors.fgFaint, fontSize: 11.5, marginTop: 9 },

  rows: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 4 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9 },
  perkLabel: { color: colors.fgMuted, fontSize: 13.5, flex: 1 },
  perkValue: { color: colors.fg, fontSize: 13.5, fontWeight: '700' },

  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, paddingVertical: 14, marginTop: 14 },
  ctaMetal: { overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', shadowColor: '#C7CCD1', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  ctaSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
  ctaText: { fontSize: 16, fontWeight: '800' },
  ctaCurrent: { backgroundColor: colors.bullSoft },
  ctaCurrentText: { color: colors.bull, fontSize: 15, fontWeight: '700' },
  ctaLocked: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  ctaLockedText: { color: colors.fgMuted, fontSize: 15, fontWeight: '700' },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  foot: { color: colors.fgFaint, fontSize: 11.5, lineHeight: 16, textAlign: 'center', marginTop: 14 },
  kycHint: { color: colors.fgFaint, fontSize: 11.5, lineHeight: 16, textAlign: 'center', marginTop: 8 },
});
