import React, { useState } from 'react';
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DragSheet } from './DragSheet';
import { PressScale } from './PressScale';
import { colors, radius } from '../src/theme';
import { usd, group } from '../src/format';
import { showToast } from '../src/toast';
import { TIERS, tierById, type Tier } from '../src/financial/tiers';
import { useTier, setTier } from '../src/financial/credit';
import { useKycLevel, kycLevelNow, tierKyc, type KycLevel } from '../src/financial/kyc';
import { KycSheet } from './KycSheet';
import { VisaMark } from './VisaMark';

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
    const need = tierKyc(tier.id);
    if (kycLevel < need) {
      setPending(tier);
      setKycNeed(need);
      return;
    }
    setTier(tier.id);
    showToast(`${tier.name} membership active`, { sub: tier.annualFee > 0 ? `${usd(tier.annualFee, 0)}/yr` : 'Free', kind: 'success' });
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
      <Text style={s.title}>Pointer Card</Text>
      <Text style={s.sub}>Free to start. Upgrade when your lifestyle catches up.</Text>

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
            <TierCard tier={t} current={t.id === current} kycLevel={kycLevel} onUpgrade={() => upgrade(t)} />
          </View>
        ))}
      </ScrollView>

      <View style={s.dots}>
        {TIERS.map((t, i) => (
          <View key={t.id} style={[s.dot, i === idx && { backgroundColor: tierById(TIERS[idx].id).accent, width: 18 }]} />
        ))}
      </View>

      <Text style={s.foot}>
        Cashback is funded by card interchange + the Credit-mode borrow spread — not the fee. Rates apply to your account,
        use any card.
      </Text>

      <KycSheet visible={kycNeed !== null} onClose={onKycClose} requireLevel={kycNeed ?? 1} />
    </DragSheet>
  );
}

function TierCard({ tier, current, kycLevel, onUpgrade }: { tier: Tier; current: boolean; kycLevel: KycLevel; onUpgrade: () => void }) {
  const needsKyc = kycLevel < tierKyc(tier.id);

  return (
    <View style={s.card}>
      {/* metal card face */}
      <View style={s.face}>
        <LinearGradient colors={tier.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={s.faceSheen}
          pointerEvents="none"
        />
        <View style={s.faceTop}>
          <Text style={s.faceBrand}>pointer.</Text>
          <Text style={s.faceTier}>{tier.name}</Text>
        </View>
        <View style={s.faceBottom}>
          <Text style={s.faceMode}>CREDIT</Text>
          <VisaMark size={22} color="#0A0C10" />
        </View>
      </View>

      <View style={s.feeRow}>
        <View>
          <Text style={s.fee}>{tier.annualFee > 0 ? usd(tier.annualFee, 0) : 'Free'}</Text>
          {tier.annualFee > 0 ? <Text style={s.feeUnit}>per year</Text> : <Text style={s.feeUnit}>on signup</Text>}
        </View>
        <View style={s.cashbackPill}>
          <Text style={[s.cashbackPct, { color: tier.accent }]}>{tier.cashbackCredit}%</Text>
          <Text style={s.cashbackLabel}>cashback</Text>
        </View>
      </View>

      <Text style={s.tagline}>{tier.tagline}</Text>

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
      ) : (
        <PressScale onPress={onUpgrade} to={0.97} style={[s.cta, { backgroundColor: tier.accent }]}>
          {needsKyc ? <Ionicons name="shield-checkmark" size={15} color={darkText(tier.accent) ? '#0A0C10' : '#fff'} /> : null}
          <Text style={[s.ctaText, { color: darkText(tier.accent) ? '#0A0C10' : '#fff' }]}>
            {needsKyc ? `Verify to get ${tier.name}` : tier.annualFee > 0 ? `Get ${tier.name}` : `Switch to ${tier.name}`}
          </Text>
        </PressScale>
      )}
      {needsKyc ? <Text style={s.kycHint}>ID needed for the card — borrowing + in-app spend stays ID-free.</Text> : null}
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

/** True when the accent is light enough to need dark button text. */
function darkText(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

const s = StyleSheet.create({
  title: { color: colors.fg, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  sub: { color: colors.fgMuted, fontSize: 13.5, textAlign: 'center', marginTop: 6 },

  card: { borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: colors.bgRaised },
  face: { height: 150, borderRadius: 16, overflow: 'hidden', padding: 16, justifyContent: 'space-between' },
  faceSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '70%' },
  faceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faceBrand: { color: '#0A0C10', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  faceTier: { color: '#0A0C10', fontSize: 13, fontWeight: '700', opacity: 0.7 },
  faceBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  faceMode: { color: '#0A0C10', fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  faceVisa: { color: '#0A0C10', fontSize: 20, fontWeight: '800', fontStyle: 'italic', letterSpacing: 0.5 },

  feeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  fee: { color: colors.fg, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  feeUnit: { color: colors.fgMuted, fontSize: 12.5, marginTop: 1 },
  cashbackPill: { alignItems: 'flex-end' },
  cashbackPct: { fontSize: 26, fontWeight: '800' },
  cashbackLabel: { color: colors.fgMuted, fontSize: 12 },
  tagline: { color: colors.fgSecondary, fontSize: 13.5, marginTop: 10 },

  rows: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 4 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9 },
  perkLabel: { color: colors.fgMuted, fontSize: 13.5, flex: 1 },
  perkValue: { color: colors.fg, fontSize: 13.5, fontWeight: '700' },

  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, paddingVertical: 14, marginTop: 14 },
  ctaText: { fontSize: 16, fontWeight: '800' },
  ctaCurrent: { backgroundColor: colors.bullSoft },
  ctaCurrentText: { color: colors.bull, fontSize: 15, fontWeight: '700' },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  foot: { color: colors.fgFaint, fontSize: 11.5, lineHeight: 16, textAlign: 'center', marginTop: 14 },
  kycHint: { color: colors.fgFaint, fontSize: 11.5, lineHeight: 16, textAlign: 'center', marginTop: 8 },
});
