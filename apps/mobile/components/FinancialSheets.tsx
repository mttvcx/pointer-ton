import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Logo } from './Logo';
import { PressScale } from './PressScale';
import { GlassFill } from './GlassFill';
import { GlossButton } from './GlossButton';
import { Sparkline } from './Sparkline';
import { Rise } from './Rise';
import { colors, radius } from '../src/theme';
import { showToast } from '../src/toast';
import { group, usd } from '../src/format';
import { setCardFrozen, setCardInWallet } from '../src/financial/store';
import { addToApplePay } from '../src/financial/wallet';
import type { CardInfo } from '../src/financial/types';
import type { CapitalModel, CapitalStates, StateKey } from '../src/demo/capital';

// Presentational meta for the four states (label + accent), mirrors the screen.
const STATE_META: { key: StateKey; label: string; color: string }[] = [
  { key: 'trading', label: 'Trading', color: colors.accentGlow },
  { key: 'earning', label: 'Earning', color: colors.bull },
  { key: 'spendable', label: 'Spendable', color: colors.brand },
  { key: 'reserved', label: 'Reserved', color: colors.warn },
];

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

export function CardSheet({ m, card, onClose }: { m: CapitalModel; card?: CardInfo | null; onClose: () => void }) {
  const [frozen, setFrozen] = useState(card?.state === 'frozen');
  const [inWallet, setInWallet] = useState(!!card?.inWallet);
  const [adding, setAdding] = useState(false);
  const swipes = useMemo(() => m.activity.filter((a) => a.kind === 'swipe'), [m.activity]);
  const last4 = card?.last4 ?? m.cardLast4;
  const limit = card?.monthlyLimit ?? m.cardSpendLimit;

  const toggleFreeze = (v: boolean) => {
    setFrozen(v);
    setCardFrozen(v);
  };
  const addWallet = async () => {
    if (inWallet) return;
    setAdding(true);
    const r = await addToApplePay();
    setAdding(false);
    if (r.ok) {
      setInWallet(true);
      setCardInWallet(true);
      showToast(r.simulated ? 'Added to Apple Pay (demo)' : 'Added to Apple Pay', { kind: 'success' });
    } else {
      showToast('Apple Pay setup is coming soon', { kind: 'info' });
    }
  };

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
          <Text style={s.cardVirtual}>{frozen ? 'Frozen' : m.cardType}</Text>
        </View>
        <Text style={s.cardNum}>•••• •••• •••• {last4}</Text>
        <View style={s.cardBottom}>
          <Text style={s.cardSpend}>{usd(m.states.spendable)}</Text>
          <Text style={s.cardSpendLabel}>spendable</Text>
        </View>
      </View>
      {frozen ? <Text style={s.frozenTag}>❄  Card frozen — no new charges</Text> : null}

      <View style={s.pillRow}>
        <PressScale style={[s.pill, inWallet && { opacity: 0.6 }]} onPress={addWallet}>
          <Ionicons name={inWallet ? 'checkmark' : 'logo-apple'} size={16} color={colors.fg} />
          <Text style={s.pillText}>{adding ? 'Adding…' : inWallet ? 'In Apple Pay' : 'Add to Pay'}</Text>
        </PressScale>
        <PressScale style={s.pill} onPress={() => showToast('Card details are demo-only', { kind: 'info' })}>
          <Ionicons name="eye-outline" size={16} color={colors.fg} />
          <Text style={s.pillText}>Details</Text>
        </PressScale>
      </View>

      <View style={s.group}>
        <ToggleRow first label="Freeze card" sub="Instantly block new charges" value={frozen} onValueChange={toggleFreeze} />
        <Row label="Monthly limit" value={usd(limit, 0)} />
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

export function YieldSheet({ m, apyOverride, onClose }: { m: CapitalModel; apyOverride?: number | null; onClose: () => void }) {
  const [auto, setAuto] = useState(m.autoSweep);
  const apy = apyOverride ?? m.apy;
  const perMonth = (m.states.earning * (apy / 100)) / 12;
  const perYear = m.states.earning * (apy / 100);
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
        <Row first label="Current rate" value={`${apy.toFixed(1)}% APY`} tint={colors.bull} />
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

/* ── Capital co-pilot (AI) ───────────────────────────────── */

export function AiSheet({ m, onClose }: { m: CapitalModel; onClose: () => void }) {
  const covered = m.taxReserve >= m.taxLiability;
  const reads = [
    { icon: 'leaf' as const, tint: colors.bull, text: `${usd(m.states.earning, 0)} is earning ${m.apy.toFixed(1)}% — that’s ${usd((m.states.earning * (m.apy / 100)) / 12, 0)}/mo, fully liquid.` },
    { icon: covered ? ('shield-checkmark' as const) : ('alert-circle' as const), tint: colors.warn, text: covered ? `I’ve reserved ${usd(m.taxReserve, 0)} for taxes on your ${usd(m.realizedGainsYtd, 0)} of realized gains. You’re covered.` : `You’re under-reserved for taxes by ${usd(m.taxLiability - m.taxReserve, 0)}.` },
    { icon: 'card' as const, tint: colors.brand, text: `${usd(m.states.spendable, 0)} is spendable right now — the rest keeps working until you swipe.` },
  ];
  return (
    <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
      <SheetTitle icon="sparkles" tint={colors.accentGlow} kicker="POINTER AI" title="Your capital, read for you" />

      <Text style={s.aiLede}>Here’s what your money is doing right now — and what I’m handling so you don’t have to.</Text>

      <View style={{ marginTop: 8 }}>
        {reads.map((r, i) => (
          <Rise key={i} delay={120 + i * 130} from={10}>
            <View style={s.aiRead}>
              <View style={[s.aiReadIcon, { backgroundColor: r.tint + '22' }]}>
                <Ionicons name={r.icon} size={16} color={r.tint} />
              </View>
              <Text style={s.aiReadText}>{r.text}</Text>
            </View>
          </Rise>
        ))}
      </View>

      <PressScale style={s.askBar} onPress={() => showToast('Ask Pointer AI — coming soon', { kind: 'info' })}>
        <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.accentGlow} />
        <Text style={s.askText}>Ask about your capital…</Text>
        <Ionicons name="arrow-forward-circle" size={20} color={colors.accent} />
      </PressScale>

      <GlossButton onPress={onClose} style={{ marginTop: 14 }}>
        <Text style={s.cta}>Done</Text>
      </GlossButton>
    </ScrollView>
  );
}

/* ── Move capital between states ─────────────────────────── */

export function MoveSheet({ states, onMove, onClose }: { states: CapitalStates; onMove: (from: StateKey, to: StateKey, amount: number) => void; onClose: () => void }) {
  const [from, setFrom] = useState<StateKey>('spendable');
  const [to, setTo] = useState<StateKey>('earning');
  const [pct, setPct] = useState(0.5);

  const pickFrom = (k: StateKey) => {
    setFrom(k);
    if (k === to) setTo(STATE_META.find((x) => x.key !== k)!.key);
  };
  const pickTo = (k: StateKey) => {
    if (k === from) return;
    setTo(k);
  };

  const avail = states[from];
  const amount = Math.round(avail * pct);
  const toLabel = STATE_META.find((x) => x.key === to)!.label;
  const canMove = amount > 0 && from !== to;

  // Pulse the amount whenever the selection changes.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    pulse.setValue(1.07);
    Animated.spring(pulse, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 9 }).start();
  }, [pct, from, to]);

  return (
    <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
      <SheetTitle icon="swap-horizontal" tint={colors.accent} kicker="MOVE CAPITAL" title="Never idle" />

      <Text style={s.section}>From</Text>
      <View style={s.chipWrap}>
        {STATE_META.map((st) => (
          <PressScale key={st.key} to={0.95} onPress={() => pickFrom(st.key)} style={[s.stateChip, from === st.key && { borderColor: st.color, backgroundColor: st.color + '1A' }]}>
            <View style={[s.chipDot, { backgroundColor: st.color }]} />
            <Text style={s.chipLabel}>{st.label}</Text>
            <Text style={s.chipVal}>{usd(states[st.key], 0)}</Text>
          </PressScale>
        ))}
      </View>

      <View style={s.arrowRow}>
        <Ionicons name="arrow-down" size={18} color={colors.fgMuted} />
      </View>

      <Text style={s.section}>To</Text>
      <View style={s.chipWrap}>
        {STATE_META.map((st) => {
          const disabled = st.key === from;
          return (
            <PressScale key={st.key} to={0.95} onPress={() => pickTo(st.key)} style={[s.stateChip, disabled && { opacity: 0.35 }, to === st.key && { borderColor: st.color, backgroundColor: st.color + '1A' }]}>
              <View style={[s.chipDot, { backgroundColor: st.color }]} />
              <Text style={s.chipLabel}>{st.label}</Text>
              <Text style={s.chipVal}>{usd(states[st.key], 0)}</Text>
            </PressScale>
          );
        })}
      </View>

      <View style={s.amountBox}>
        <GlassFill />
        <Animated.Text style={[s.amountBig, { transform: [{ scale: pulse }] }]}>{usd(amount, 0)}</Animated.Text>
        <View style={s.pctRow}>
          {[0.25, 0.5, 0.75, 1].map((p) => (
            <PressScale key={p} to={0.93} onPress={() => setPct(p)} style={[s.pctChip, pct === p && s.pctChipOn]}>
              <Text style={[s.pctText, pct === p && s.pctTextOn]}>{p === 1 ? 'Max' : `${p * 100}%`}</Text>
            </PressScale>
          ))}
        </View>
      </View>

      <GlossButton onPress={() => { if (!canMove) return; onMove(from, to, amount); onClose(); showToast(`Moved ${usd(amount, 0)} to ${toLabel}`, { kind: 'success' }); }} style={{ marginTop: 18, opacity: canMove ? 1 : 0.5 }}>
        <Text style={s.cta}>{canMove ? `Move to ${toLabel}` : 'Choose an amount'}</Text>
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

  // Move capital
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  stateChip: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bgRaised2, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1.5, borderColor: colors.border },
  chipDot: { width: 9, height: 9, borderRadius: 5 },
  chipLabel: { color: colors.fg, fontSize: 13.5, fontWeight: '600', flex: 1 },
  chipVal: { color: colors.fgMuted, fontSize: 12.5, fontWeight: '600' },
  arrowRow: { alignItems: 'center', paddingVertical: 8 },
  amountBox: { borderRadius: radius.lg, overflow: 'hidden', padding: 18, marginTop: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  amountBig: { color: colors.fg, fontSize: 38, fontWeight: '800', letterSpacing: -1.2 },
  pctRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  pctChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  pctChipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  pctText: { color: colors.fgMuted, fontSize: 13.5, fontWeight: '700' },
  pctTextOn: { color: colors.accentGlow },

  // AI co-pilot
  aiLede: { color: colors.fgSecondary, fontSize: 14.5, lineHeight: 21, marginTop: -6, marginBottom: 4 },
  aiRead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 11 },
  aiReadIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  aiReadText: { color: colors.fg, fontSize: 14.5, lineHeight: 21, flex: 1 },
  askBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgRaised2, borderRadius: radius.pill, paddingVertical: 13, paddingHorizontal: 16, marginTop: 16, borderWidth: 1, borderColor: colors.accent + '3D' },
  askText: { color: colors.fgMuted, fontSize: 14.5, flex: 1 },
});
