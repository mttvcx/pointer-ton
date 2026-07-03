import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Logo } from './Logo';
import { PressScale } from './PressScale';
import { GlassFill } from './GlassFill';
import { GlossButton } from './GlossButton';
import { Sparkline } from './Sparkline';
import { colors, radius } from '../src/theme';
import { showToast } from '../src/toast';
import { group, usd } from '../src/format';
import type { CapitalModel } from '../src/demo/capital';

/* ── shared bits ─────────────────────────────────────────── */

function SheetTitle({ icon, tint, kicker, title }: { icon: React.ComponentProps<typeof Ionicons>['name']; tint: string; kicker: string; title: string }) {
  return (
    <View style={s.head}>
      <View style={[s.headIcon, { backgroundColor: tint + '22' }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.kicker}>{kicker}</Text>
        <Text style={s.title}>{title}</Text>
      </View>
    </View>
  );
}

function Row({ label, value, tint, first }: { label: string; value: string; tint?: string; first?: boolean }) {
  return (
    <View style={[s.row, !first && s.rowBorder]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, tint ? { color: tint } : null]}>{value}</Text>
    </View>
  );
}

function ToggleRow({ label, sub, value, onValueChange, first }: { label: string; sub: string; value: boolean; onValueChange: (v: boolean) => void; first?: boolean }) {
  return (
    <View style={[s.row, !first && s.rowBorder]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={s.rowLabel2}>{label}</Text>
        <Text style={s.rowSub}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.accent, false: colors.border }} thumbColor="#fff" ios_backgroundColor={colors.border} />
    </View>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.note}>
      <Ionicons name="information-circle-outline" size={15} color={colors.fgMuted} style={{ marginTop: 1 }} />
      <Text style={s.noteText}>{children}</Text>
    </View>
  );
}

/* ── Card ────────────────────────────────────────────────── */

export function CardSheet({ m, onClose }: { m: CapitalModel; onClose: () => void }) {
  const [frozen, setFrozen] = useState(false);
  const swipes = useMemo(() => m.activity.filter((a) => a.kind === 'swipe'), [m.activity]);
  return (
    <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
      <SheetTitle icon="card" tint={colors.brand} kicker="POINTER CARD" title="Your card" />

      <View style={[s.card, frozen && { opacity: 0.5 }]}>
        <LinearGradient colors={['#12233A', '#0B1524', '#070E18']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={s.cardTop}>
          <View style={s.cardBrand}>
            <Logo size={20} style={{ tintColor: '#fff' }} />
            <Text style={s.cardBrandText}>Pointer</Text>
          </View>
          <Text style={s.cardVirtual}>{m.cardType}</Text>
        </View>
        <Text style={s.cardNum}>•••• •••• •••• {m.cardLast4}</Text>
        <View style={s.cardBottom}>
          <Text style={s.cardSpend}>{usd(m.states.spendable)}</Text>
          <Text style={s.cardSpendLabel}>spendable</Text>
        </View>
      </View>
      {frozen ? <Text style={s.frozenTag}>❄  Card frozen — no new charges</Text> : null}

      <View style={s.pillRow}>
        <PressScale style={s.pill} onPress={() => showToast('Added to Apple Pay', { kind: 'success' })}>
          <Ionicons name="logo-apple" size={16} color={colors.fg} />
          <Text style={s.pillText}>Add to Pay</Text>
        </PressScale>
        <PressScale style={s.pill} onPress={() => showToast('Card details are demo-only', { kind: 'info' })}>
          <Ionicons name="eye-outline" size={16} color={colors.fg} />
          <Text style={s.pillText}>Details</Text>
        </PressScale>
      </View>

      <View style={s.group}>
        <ToggleRow first label="Freeze card" sub="Instantly block new charges" value={frozen} onValueChange={setFrozen} />
        <Row label="Monthly limit" value={usd(m.cardSpendLimit, 0)} />
        <Row label="Funds from" value="Spendable balance" />
      </View>

      <Text style={s.section}>Recent card activity</Text>
      <View style={s.group}>
        {swipes.map((a, i) => (
          <Row key={a.id} first={i === 0} label={a.title} value={usd(a.amountUsd)} />
        ))}
      </View>

      <Note>Your card spends straight from your Spendable balance. The rest of your capital keeps earning until the moment you swipe.</Note>

      <GlossButton onPress={onClose} style={{ marginTop: 18 }}>
        <Text style={s.cta}>Done</Text>
      </GlossButton>
    </ScrollView>
  );
}

/* ── Smart Yield ─────────────────────────────────────────── */

export function YieldSheet({ m, onClose }: { m: CapitalModel; onClose: () => void }) {
  const [auto, setAuto] = useState(m.autoSweep);
  const perMonth = (m.states.earning * (m.apy / 100)) / 12;
  const perYear = m.states.earning * (m.apy / 100);
  return (
    <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
      <SheetTitle icon="leaf" tint={colors.bull} kicker="SMART YIELD" title="Your money at work" />

      <View style={s.hero}>
        <GlassFill />
        <Text style={s.heroBig}>{usd(m.earnedTotal)}</Text>
        <Text style={s.heroSub}>earned all-time · {usd(m.earnedToday)} today</Text>
        <View style={{ marginTop: 14 }}>
          <Sparkline data={m.yieldHistory} height={52} gradId="yieldsheet" />
        </View>
      </View>

      <View style={s.group}>
        <Row first label="Current rate" value={`${m.apy.toFixed(1)}% APY`} tint={colors.bull} />
        <Row label="Principal earning" value={usd(m.states.earning, 0)} />
        <Row label="Projected" value={`${usd(perMonth, 0)}/mo · ${usd(perYear, 0)}/yr`} />
      </View>

      <View style={s.group}>
        <ToggleRow first label="Auto-sweep idle cash" sub="Move spare USDC into yield automatically" value={auto} onValueChange={(v) => { setAuto(v); showToast(v ? 'Auto-sweep on' : 'Auto-sweep off', { kind: 'info' }); }} />
        <Row label="Keep liquid" value={usd(m.keepLiquid, 0)} />
        <Row label="Withdrawal" value="Instant · no lockup" />
      </View>

      <Note>Yield stays fully liquid. The instant you place a trade, Pointer pulls exactly what you need back out — so earning never costs you a fill.</Note>

      <GlossButton onPress={onClose} style={{ marginTop: 18 }}>
        <Text style={s.cta}>Done</Text>
      </GlossButton>
    </ScrollView>
  );
}

/* ── Tax Reserve ─────────────────────────────────────────── */

export function TaxSheet({ m, onClose }: { m: CapitalModel; onClose: () => void }) {
  const [autoReserve, setAutoReserve] = useState(true);
  const covered = m.taxReserve >= m.taxLiability;
  return (
    <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
      <SheetTitle icon="shield-checkmark" tint={colors.warn} kicker="TAX RESERVE" title="Set aside, automatically" />

      <View style={[s.banner, { borderColor: (covered ? colors.bull : colors.warn) + '55' }]}>
        <GlassFill />
        <Ionicons name={covered ? 'checkmark-circle' : 'alert-circle'} size={20} color={covered ? colors.bull : colors.warn} />
        <Text style={s.bannerText}>{covered ? 'You’re covered for estimated taxes on realized gains.' : `Under-reserved by ${usd(m.taxLiability - m.taxReserve, 0)}.`}</Text>
      </View>

      <View style={s.group}>
        <Row first label="Realized gains (YTD)" value={usd(m.realizedGainsYtd, 0)} />
        <Row label="Estimated liability" value={usd(m.taxLiability, 0)} />
        <Row label="Reserved" value={usd(m.taxReserve, 0)} tint={colors.warn} />
        <Row label="Jurisdiction" value={m.jurisdiction} />
      </View>

      <View style={s.group}>
        <ToggleRow first label="Auto-reserve on gains" sub="Hold back tax as you realize profit" value={autoReserve} onValueChange={(v) => { setAutoReserve(v); showToast(v ? 'Auto-reserve on' : 'Auto-reserve off', { kind: 'info' }); }} />
      </View>

      <Note>Pointer knows your cost basis and tax lots, so it reserves the right amount as you trade. When it’s time to file, export a clean report to Pointer Taxes.</Note>

      <PressScale style={s.exportBtn} onPress={() => showToast('Pointer Taxes coming soon', { kind: 'info' })}>
        <Ionicons name="document-text-outline" size={17} color={colors.fg} />
        <Text style={s.exportText}>Export for taxes</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.fgMuted} />
      </PressScale>

      <GlossButton onPress={onClose} style={{ marginTop: 12 }}>
        <Text style={s.cta}>Done</Text>
      </GlossButton>
    </ScrollView>
  );
}

/* ── PTR Points ──────────────────────────────────────────── */

export function PointsSheet({ m, onClose }: { m: CapitalModel; onClose: () => void }) {
  const src = m.pointsBySource;
  const srcMax = Math.max(src.spend, src.earn, src.hold, 1);
  const rows = [
    { key: 'spend', label: 'Spending on your card', val: src.spend, icon: 'card-outline' as const },
    { key: 'earn', label: 'Earning yield', val: src.earn, icon: 'leaf-outline' as const },
    { key: 'hold', label: 'Holding capital', val: src.hold, icon: 'time-outline' as const },
  ];
  return (
    <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
      <SheetTitle icon="diamond" tint={colors.accentGlow} kicker="PTR POINTS" title="One flywheel" />

      <View style={s.hero}>
        <GlassFill />
        <Text style={[s.heroBig, { color: colors.accentGlow }]}>{group(String(m.points))}</Text>
        <Text style={s.heroSub}>+{m.pointsThisWeek} this week</Text>
      </View>

      <View style={s.tierCard}>
        <GlassFill />
        <View style={s.tierTop}>
          <Text style={s.tierName}>{m.tier.name} · {m.tier.multiplier}</Text>
          {m.tier.nextName ? <Text style={s.tierNext}>{group(String(m.tier.toNext))} to {m.tier.nextName}</Text> : null}
        </View>
        <View style={s.tierTrack}>
          <View style={[s.tierFill, { width: `${Math.round(m.tier.progress * 100)}%` }]} />
        </View>
      </View>

      <Text style={s.section}>Where your points come from</Text>
      <View style={s.group}>
        {rows.map((r, i) => (
          <View key={r.key} style={[s.srcRow, i > 0 && s.rowBorder]}>
            <Ionicons name={r.icon} size={17} color={colors.fgSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel2}>{r.label}</Text>
              <View style={s.srcTrack}>
                <View style={[s.srcFill, { width: `${Math.round((r.val / srcMax) * 100)}%` }]} />
              </View>
            </View>
            <Text style={s.rowValue}>{group(String(r.val))}</Text>
          </View>
        ))}
      </View>

      <Note>Spending, earning, and holding all feed the same points balance — the more of your capital lives in Pointer, the faster it compounds.</Note>

      <GlossButton onPress={onClose} style={{ marginTop: 18 }}>
        <Text style={s.cta}>Done</Text>
      </GlossButton>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 12 },

  head: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 4, marginBottom: 16 },
  headIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: colors.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  title: { color: colors.fg, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 1 },

  group: { borderRadius: radius.md, backgroundColor: colors.bgRaised2, marginTop: 12, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLabel: { color: colors.fgMuted, fontSize: 14 },
  rowLabel2: { color: colors.fg, fontSize: 14.5, fontWeight: '600' },
  rowSub: { color: colors.fgMuted, fontSize: 12.5, marginTop: 2 },
  rowValue: { color: colors.fg, fontSize: 15, fontWeight: '700' },

  note: { flexDirection: 'row', gap: 9, marginTop: 16, paddingHorizontal: 2 },
  noteText: { color: colors.fgMuted, fontSize: 13, lineHeight: 19, flex: 1 },
  section: { color: colors.fgSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 0.3, marginTop: 20, marginBottom: -2 },
  cta: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },

  // card visual
  card: { borderRadius: radius.lg, overflow: 'hidden', padding: 18, height: 172, justifyContent: 'space-between', borderWidth: 1, borderColor: colors.brand + '33' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardBrandText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  cardVirtual: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' },
  cardNum: { color: 'rgba(255,255,255,0.9)', fontSize: 17, fontWeight: '600', letterSpacing: 2 },
  cardBottom: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  cardSpend: { color: '#fff', fontSize: 22, fontWeight: '800' },
  cardSpendLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12.5 },
  frozenTag: { color: colors.fgSecondary, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 10 },

  pillRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.bgRaised2, borderRadius: radius.md, paddingVertical: 13, borderWidth: 1, borderColor: colors.border },
  pillText: { color: colors.fg, fontSize: 14.5, fontWeight: '600' },

  // hero blocks
  hero: { borderRadius: radius.lg, overflow: 'hidden', padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  heroBig: { color: colors.fg, fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  heroSub: { color: colors.fgMuted, fontSize: 13, marginTop: 3 },

  // tax banner
  banner: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: radius.md, padding: 14, overflow: 'hidden', borderWidth: 1 },
  bannerText: { color: colors.fg, fontSize: 14, fontWeight: '600', lineHeight: 19, flex: 1 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgRaised2, borderRadius: radius.md, paddingVertical: 15, paddingHorizontal: 16, marginTop: 16, borderWidth: 1, borderColor: colors.border },
  exportText: { color: colors.fg, fontSize: 15, fontWeight: '600', flex: 1 },

  // points tier
  tierCard: { borderRadius: radius.md, overflow: 'hidden', padding: 15, marginTop: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  tierTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  tierName: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  tierNext: { color: colors.fgMuted, fontSize: 12.5 },
  tierTrack: { height: 8, borderRadius: 4, backgroundColor: colors.bg, overflow: 'hidden' },
  tierFill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },

  srcRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  srcTrack: { height: 5, borderRadius: 3, backgroundColor: colors.bg, overflow: 'hidden', marginTop: 7 },
  srcFill: { height: 5, borderRadius: 3, backgroundColor: colors.accentGlow },
});
