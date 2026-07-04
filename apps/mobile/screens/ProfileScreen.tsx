import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { Logo } from '../components/Logo';
import { PressScale } from '../components/PressScale';
import { DepositFlow } from '../components/DepositFlow';
import { GlassFill } from '../components/GlassFill';
import { GlossButton } from '../components/GlossButton';
import { colors, radius } from '../src/theme';
import { useBio, useFollowCount, useReferralCode } from '../src/local';
import { useMe, usePointerIdentity } from '../src/account';
import { useAuth } from '../src/auth';
import { shareReferral } from '../src/share';

/** "ABcd…WXyz" short form for a wallet address. */
function shortAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

const RANGES = ['24h', '7d', '30d', 'All'];

export function ProfileScreen({ onOpenSettings, onEditProfile }: { onOpenSettings: () => void; onEditProfile: () => void }) {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState(0);
  const [deposit, setDeposit] = useState(false);
  const bio = useBio();
  const following = useFollowCount();
  const refCode = useReferralCode();

  // Real identity once signed in (real build); demo keeps the "pointer" placeholder.
  const me = useMe();
  const auth = useAuth();
  const xHandle = usePointerIdentity().data?.xUsername?.replace(/^@/, '') || null;
  const avatarUrl = auth.avatarUrl;
  const displayName = me.data?.username?.trim() || me.data?.email?.split('@')[0] || 'pointer';
  const displayHandle = me.data?.username
    ? `@${me.data.username}`
    : me.data?.walletAddress
      ? shortAddr(me.data.walletAddress)
      : '@pointer';

  return (
    <Screen>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.topRow}>
          <View style={s.avatar}>
            {avatarUrl ? <Image source={{ uri: avatarUrl }} style={s.avatarImg} /> : <Logo size={30} />}
          </View>
          <View style={s.topIcons}>
            <PressScale onPress={() => shareReferral(refCode)} to={0.85} hitSlop={8}>
              <Ionicons name="share-outline" size={22} color={colors.fgSecondary} />
            </PressScale>
            <Ionicons name="gift-outline" size={22} color={colors.fgSecondary} />
            <PressScale onPress={onOpenSettings} to={0.85} hitSlop={8}>
              <Ionicons name="settings-outline" size={22} color={colors.fgSecondary} />
            </PressScale>
          </View>
        </View>

        <Text style={s.name}>{displayName}</Text>
        <View style={s.handleRow}>
          <Text style={s.handle}>{displayHandle}</Text>
          {xHandle ? (
            <View style={s.xBadge}>
              <Ionicons name="logo-twitter" size={11} color={colors.accentGlow} />
              <Text style={s.xBadgeText}>@{xHandle}</Text>
            </View>
          ) : null}
        </View>

        <PressScale onPress={onEditProfile} to={0.98} hitSlop={6}>
          <Text style={bio ? s.bioText : s.bio}>{bio || '+ Add a bio'}</Text>
        </PressScale>

        <View style={s.followRow}>
          <Text style={s.followNum}>
            {following} <Text style={s.followLabel}>Following</Text>
          </Text>
          <Text style={s.followNum}>
            0 <Text style={s.followLabel}>Followers</Text>
          </Text>
        </View>

        <View style={s.metaRow}>
          <Meta icon="time-outline" text="No hold time" />
          <Meta icon="swap-horizontal" text="0 trades" />
          <Meta icon="calendar-outline" text="Joined Jun 2026" />
        </View>

        <View style={s.pnlRow}>
          <View>
            <Text style={s.pnl}>
              $0<Text style={s.pnlCents}>.00</Text>
            </Text>
            <Text style={s.pnlSub}>--</Text>
          </View>
          <View style={s.ranges}>
            {RANGES.map((r, i) => (
              <PressScale key={r} onPress={() => setRange(i)} to={0.94} style={[s.range, i === range && s.rangeOn]}>
                <Text style={[s.rangeText, i === range && s.rangeTextOn]}>{r}</Text>
              </PressScale>
            ))}
          </View>
        </View>

        <View style={s.empty}>
          <Ionicons name="pulse-outline" size={26} color={colors.fgFaint} />
          <Text style={s.emptyText}>No positions yet</Text>
        </View>

        <View style={s.cashback}>
          <GlassFill />
          <View style={s.cashbackHead}>
            <Ionicons name="cash-outline" size={20} color={colors.bull} />
            <Text style={s.cashbackTitle}>Half your fees, back to you</Text>
          </View>
          <Text style={s.cashbackBody}>
            <Text style={s.cashbackPct}>50%</Text> cashback on every trade, plus <Text style={s.cashbackPct}>30%</Text> of your
            friends' fees when they join.
          </Text>
          <PressScale style={s.cashbackBtn} onPress={() => setDeposit(true)}>
            <Ionicons name="logo-apple" size={17} color="#fff" />
            <Text style={s.cashbackBtnText}>Get your first token with Apple Pay</Text>
          </PressScale>
        </View>

        <GlossButton onPress={() => setDeposit(true)} style={{ marginTop: 16 }}>
          <Text style={s.depositText}>Deposit</Text>
        </GlossButton>
      </ScrollView>

      <DepositFlow visible={deposit} onClose={() => setDeposit(false)} />
    </Screen>
  );
}

function Meta({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={s.meta}>
      <Ionicons name={icon} size={14} color={colors.fgMuted} />
      <Text style={s.metaText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 130 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E8732A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 64, height: 64, borderRadius: 32 },
  topIcons: { flexDirection: 'row', gap: 20 },
  name: { color: colors.fg, fontSize: 26, fontWeight: '700', marginTop: 14 },
  handleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  handle: { color: colors.fgMuted, fontSize: 15 },
  xBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  xBadgeText: { color: colors.accentGlow, fontSize: 12, fontWeight: '700' },
  bio: { color: colors.accentGlow, fontSize: 15, fontWeight: '500', marginTop: 12 },
  bioText: { color: colors.fgSecondary, fontSize: 15, lineHeight: 21, marginTop: 12 },
  followRow: { flexDirection: 'row', gap: 22, marginTop: 12 },
  followNum: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  followLabel: { color: colors.fgMuted, fontWeight: '400' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: colors.fgMuted, fontSize: 13 },
  pnlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 26 },
  pnl: { color: colors.fg, fontSize: 38, fontWeight: '700', letterSpacing: -1 },
  pnlCents: { color: colors.fgFaint },
  pnlSub: { color: colors.fgFaint, fontSize: 13, marginTop: 2 },
  ranges: { flexDirection: 'row', gap: 4, marginTop: 6 },
  range: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm },
  rangeOn: { backgroundColor: colors.bgRaised2 },
  rangeText: { color: colors.fgMuted, fontSize: 13 },
  rangeTextOn: { color: colors.fg, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyText: { color: colors.fgMuted, fontSize: 14 },
  cashback: { borderRadius: radius.lg, padding: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,224,160,0.30)' },
  cashbackHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cashbackTitle: { color: colors.fg, fontSize: 16, fontWeight: '600' },
  cashbackBody: { color: colors.fgSecondary, fontSize: 14, lineHeight: 20, marginTop: 8 },
  cashbackPct: { color: colors.bull, fontWeight: '700' },
  cashbackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#000', borderRadius: radius.md, paddingVertical: 13, marginTop: 14 },
  cashbackBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  deposit: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  depositText: { color: colors.onAccent, fontSize: 17, fontWeight: '600' },
});
