import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '../components/Screen';
import { Logo } from '../components/Logo';
import { PressScale } from '../components/PressScale';
import { GlassFill } from '../components/GlassFill';
import { GlossButton } from '../components/GlossButton';
import { DepositFlow } from '../components/DepositFlow';
import { DragSheet } from '../components/DragSheet';
import { Sparkline } from '../components/Sparkline';
import { Rise } from '../components/Rise';
import { AiSheet, CardSheet, MoveSheet, PointsSheet, TaxSheet, YieldSheet } from '../components/FinancialSheets';
import { FinancialActivation, FinancialIntro } from './FinancialOnboarding';
import { colors, radius } from '../src/theme';
import { showToast } from '../src/toast';
import { group, usd } from '../src/format';
import { getDemoCapital, type CapitalModel, type FinActivityKind, type StateKey as CapKey } from '../src/demo/capital';
import { loadFinancialStatus, useFinancial, useFinancialEntered, enterFinancial } from '../src/financial/store';
import { useYieldRate } from '../src/financial/hooks';
import { CardTiersSheet } from '../components/CardTiersSheet';
import { CreditModeSheet } from '../components/CreditModeSheet';
import { VisaMark } from '../components/VisaMark';
import { CardShine } from '../components/CardShine';
import { PasscodeSetup } from '../components/PasscodeSetup';
import { StepRing } from '../components/ProgressRing';
import { ConciergeSheet } from '../components/ConciergeSheet';
import { AccountDetailsSheet } from '../components/AccountDetailsSheet';
import { PayeePickerSheet } from '../components/PayeePickerSheet';
import { SendMoneySheet, type SendRecipient } from '../components/SendMoneySheet';
import { useSpendMode, useTier, useBorrowed, healthFactor, healthBand } from '../src/financial/credit';
import { collateralLine, demoCollateralHoldings } from '../src/financial/collateral';
import { tierById } from '../src/financial/tiers';
import type { PulseBundle } from '../src/types';

// The four states of capital — the product's spine.
const STATES = [
  { key: 'trading', label: 'Trading', color: colors.accentGlow, icon: 'trending-up' },
  { key: 'earning', label: 'Earning', color: colors.bull, icon: 'leaf' },
  { key: 'spendable', label: 'Spendable', color: colors.brand, icon: 'card' },
  { key: 'reserved', label: 'Reserved', color: colors.warn, icon: 'shield-checkmark' },
] as const;

type StateKey = (typeof STATES)[number]['key'];
type StateDetail = { blurb: string; rows: { label: string; value: string }[]; action: string };

// The "why" behind each state — what's in it, and what makes it different from a
// contextless bank balance. Values derive from the live model.
function stateDetail(key: StateKey, m: CapitalModel): StateDetail {
  const covered = m.taxReserve >= m.taxLiability;
  switch (key) {
    case 'trading':
      return {
        blurb: 'Capital deployed in open positions plus the balance staged to trade. This is the money doing the work you came here for.',
        rows: [
          { label: 'In open positions', value: usd(m.states.trading * 0.72, 0) },
          { label: 'Ready to trade', value: usd(m.states.trading * 0.28, 0) },
        ],
        action: 'View positions',
      };
    case 'earning':
      return {
        blurb: 'Idle USDC swept into Smart Yield automatically. It stays fully liquid, pulled back the instant you place a trade, so earning never costs you a fill.',
        rows: [
          { label: 'Principal earning', value: usd(m.states.earning, 0) },
          { label: 'Rate', value: `${m.apy.toFixed(1)}% APY` },
          { label: 'Earned today', value: usd(m.earnedToday) },
        ],
        action: 'Yield settings',
      };
    case 'spendable':
      return {
        blurb: 'Instantly ready to spend on your Pointer Card or send out. No unstaking, no waiting. This is your everyday balance.',
        rows: [
          { label: 'On your card', value: usd(m.states.spendable) },
          { label: 'Card', value: `•••• ${m.cardLast4}` },
        ],
        action: 'Manage card',
      };
    case 'reserved':
      return {
        blurb: 'Set aside to cover estimated taxes on realized gains. Pointer knows your cost basis and lots, so it reserves the right amount as you trade, quietly, in the background.',
        rows: [
          { label: 'Reserved', value: usd(m.taxReserve, 0) },
          { label: 'Estimated liability', value: usd(m.taxLiability, 0) },
          { label: 'Status', value: covered ? 'Covered' : 'Under-reserved' },
        ],
        action: 'Tax details',
      };
  }
}

const ACT_ICON: Record<FinActivityKind, React.ComponentProps<typeof Ionicons>['name']> = {
  swipe: 'card-outline',
  yield: 'leaf-outline',
  deposit: 'add-circle-outline',
  reserve: 'shield-checkmark-outline',
  trade: 'swap-horizontal',
  receive: 'arrow-down-outline',
};

type Panel = 'card' | 'yield' | 'tax' | 'points' | 'ai' | 'move';
type Sheet = { kind: 'state'; key: StateKey } | { kind: 'panel'; panel: Panel };

// A state's action button routes to the matching deep panel (or, for trading,
// back to where positions actually live).
const STATE_ACTION: Record<StateKey, Panel | null> = { trading: null, earning: 'yield', spendable: 'card', reserved: 'tax' };

export function FinancialScreen({ onOpenToken: _onOpenToken }: { onOpenToken: (b: PulseBundle) => void }) {
  const insets = useSafeAreaInsets();
  const fin = useFinancial();
  const entered = useFinancialEntered();
  const liveApy = useYieldRate(); // real Lulo APY when the backend is keyed, else null
  const [activating, setActivating] = useState(false);
  const [settingPasscode, setSettingPasscode] = useState(false);
  useEffect(() => {
    loadFinancialStatus();
  }, []);

  // Mutable so moving capital between states visibly rebalances the bar.
  const [m, setM] = useState<CapitalModel>(() => getDemoCapital());
  const moveCapital = (from: CapKey, to: CapKey, amount: number) => {
    setM((prev) => {
      const amt = Math.min(amount, prev.states[from]);
      const states = { ...prev.states, [from]: prev.states[from] - amt, [to]: prev.states[to] + amt };
      return { ...prev, states };
    });
  };
  const [deposit, setDeposit] = useState(false);
  const [tiersOpen, setTiersOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [payeeOpen, setPayeeOpen] = useState(false);
  const [sendTo, setSendTo] = useState<SendRecipient | null>(null);
  const spendMode = useSpendMode();
  const tierId = useTier();
  const tier = tierById(tierId);
  const conciergeUnlocked = tier.concierge != null;
  const borrowed = useBorrowed();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const openState = (key: StateKey) => setSheet({ kind: 'state', key });
  const openPanel = (panel: Panel) => setSheet({ kind: 'panel', panel });
  const closeSheet = () => setSheet(null);

  // Live "earning" tick — the money-is-working heartbeat.
  const [earned, setEarned] = useState(m.earnedToday);
  const perSec = (m.total * (m.apy / 100)) / (365 * 24 * 60 * 60);
  useEffect(() => {
    const id = setInterval(() => setEarned((e) => e + perSec), 1000);
    return () => clearInterval(id);
  }, [perSec]);

  // Count-up on the flagship number when the page first mounts — a beat of
  // "here's everything you've got, working." Ease-out over ~850ms.
  const rise = useRef(new Animated.Value(0)).current;
  const [shownTotal, setShownTotal] = useState(m.total);
  useEffect(() => {
    rise.setValue(0);
    const id = rise.addListener(({ value }) => setShownTotal(value * m.total));
    Animated.timing(rise, { toValue: 1, duration: 850, useNativeDriver: false }).start();
    return () => rise.removeListener(id);
  }, [m.total]);

  const dollars = Math.floor(shownTotal);
  const cents = String(Math.round((shownTotal - dollars) * 100) % 100).padStart(2, '0');
  const covered = m.taxReserve >= m.taxLiability;
  const apy = liveApy ?? m.apy; // prefer the live rate
  const cardLast4 = fin.card?.last4 ?? m.cardLast4;
  const cardFrozen = fin.card?.state === 'frozen';

  // "Finalize setup" checklist — each step reflects a real signal, no fake
  // completions. Passcode is done (they set one to get in); yield is on by
  // default; capital shows done once there's a balance; ordering the card is the
  // real remaining step. The card hides itself once everything's done.
  const setupSteps = [
    { key: 'passcode', label: 'Secure with a passcode', sub: 'Done', icon: 'lock-closed' as const, done: true, onPress: () => {} },
    { key: 'capital', label: 'Add your capital', sub: 'Fund your account', icon: 'add-circle' as const, done: m.total > 0, onPress: () => setDeposit(true) },
    { key: 'yield', label: 'Turn on Smart Yield', sub: `${apy.toFixed(1)}% APY on idle cash`, icon: 'leaf' as const, done: m.states.earning > 0, onPress: () => openPanel('yield') },
    { key: 'card', label: 'Order your Pointer Card', sub: 'Spend anywhere', icon: 'card' as const, done: fin.status === 'active', onPress: () => setActivating(true) },
  ];
  const setupDone = setupSteps.filter((st) => st.done).length;
  const setupComplete = setupDone >= setupSteps.length;
  const nextStep = setupSteps.find((st) => !st.done);

  // First-run: a one-time PITCH (no ID) → the KYC-free dashboard. Borrowing +
  // spending in-app + sending need no verification; only ordering a card does, so
  // the name/ID flow (FinancialActivation) is triggered from the card, not here.
  if (activating) return <FinancialActivation onClose={() => setActivating(false)} />;
  if (settingPasscode)
    return <PasscodeSetup onDone={() => { setSettingPasscode(false); enterFinancial(); }} onClose={() => setSettingPasscode(false)} />;
  if (!entered) return <FinancialIntro onStart={() => setSettingPasscode(true)} />;

  return (
    <Screen>
      {/* Silver metallic top-glow — the premium finance identity, distinct from
          the app's green. Sits behind the header/hero, fades into the app bg. */}
      <LinearGradient
        colors={['rgba(210,216,222,0.16)', 'rgba(150,158,168,0.05)', 'transparent']}
        start={{ x: 0.25, y: 0 }}
        end={{ x: 0.75, y: 1 }}
        style={s.metalGlow}
        pointerEvents="none"
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.head}>
          <Text style={s.title}>Financial</Text>
        </View>

        {/* Total capital hero */}
        <Rise delay={40}>
          <Text style={s.capLabel}>TOTAL CAPITAL</Text>
          <Text style={s.cap}>
            {usd(dollars, 0)}
            <Text style={s.capCents}>.{cents}</Text>
          </Text>
          <Text style={s.capSub}>Every dollar working · none idle</Text>
        </Rise>

        {/* Four-state bar — each segment tappable to reveal what's inside it. */}
        <Rise delay={100}>
          <View style={s.bar}>
            {STATES.map((st) => {
              const val = m.states[st.key];
              const pct = m.total > 0 ? val / m.total : 0;
              return (
                <PressScale key={st.key} to={0.94} onPress={() => openState(st.key)} style={{ flex: pct }}>
                  <View style={{ height: 12, backgroundColor: st.color }} />
                </PressScale>
              );
            })}
          </View>
          <View style={s.legend}>
            {STATES.map((st) => (
              <View key={st.key} style={s.legendCell}>
                <PressScale to={0.97} onPress={() => openState(st.key)} style={s.legendItem}>
                  <View style={[s.dot, { backgroundColor: st.color }]} />
                  <Text style={s.legendLabel} numberOfLines={1}>{st.label}</Text>
                  <Text style={s.legendVal} numberOfLines={1}>{usd(m.states[st.key], 0)}</Text>
                </PressScale>
              </View>
            ))}
          </View>
          <PressScale to={0.97} onPress={() => openPanel('move')} style={s.moveBtn}>
            <Ionicons name="swap-horizontal" size={16} color="#D2D8DE" />
            <Text style={s.moveText}>Move capital</Text>
          </PressScale>
        </Rise>

        {/* Quick actions — Add / Send / Details (XPlace-style row) */}
        <Rise delay={130}>
          <View style={s.quickRow}>
            {[
              { key: 'add', label: 'Add', icon: 'add' as const, onPress: () => setDeposit(true) },
              { key: 'send', label: 'Send', icon: 'arrow-up' as const, onPress: () => setPayeeOpen(true) },
              { key: 'details', label: 'Details', icon: 'document-text-outline' as const, onPress: () => setDetailsOpen(true) },
            ].map((q) => (
              <View key={q.key} style={s.quick}>
                <PressScale to={0.9} onPress={q.onPress} style={s.quickBtn}>
                  <LinearGradient colors={['#EDF0F3', '#C4CBD2', '#9BA3AC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  <LinearGradient colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.quickSheen} pointerEvents="none" />
                  <Ionicons name={q.icon} size={22} color="#0A0C10" />
                </PressScale>
                <Text style={s.quickLabel}>{q.label}</Text>
              </View>
            ))}
          </View>
        </Rise>

        {/* Finalize setup — a progress-ring checklist that hides once complete */}
        {!setupComplete ? (
          <Rise delay={150}>
            <PressScale to={0.99} onPress={() => nextStep?.onPress()} style={s.setup}>
              <GlassFill />
              <View style={s.setupHead}>
                <StepRing done={setupDone} total={setupSteps.length} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={s.setupTitle}>Finish setting up</Text>
                  <Text style={s.setupSub}>
                    {nextStep ? `Next: ${nextStep.label.toLowerCase()}` : 'All set'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.fgMuted} />
              </View>
              <View style={s.setupSteps}>
                {setupSteps.map((st) => (
                  <PressScale key={st.key} to={0.98} onPress={() => { if (!st.done) st.onPress(); }} style={s.setupStep}>
                    <View style={[s.setupCheck, st.done ? s.setupCheckDone : s.setupCheckIdle]}>
                      <Ionicons name={st.done ? 'checkmark' : st.icon} size={13} color={st.done ? '#0A0C10' : '#D2D8DE'} />
                    </View>
                    <Text style={[s.setupStepLabel, st.done && s.setupStepLabelDone]} numberOfLines={1}>{st.label}</Text>
                    {!st.done ? <Ionicons name="arrow-forward" size={14} color={colors.fgMuted} /> : null}
                  </PressScale>
                ))}
              </View>
            </PressScale>
          </Rise>
        ) : null}

        {/* Pointer Card — no card until you order one (the only KYC step) */}
        <Rise delay={170}>
        <PressScale to={0.99} onPress={() => (fin.status === 'active' ? openPanel('card') : setActivating(true))} style={s.card}>
          <LinearGradient colors={['#123A2C', '#0E241C', '#06100D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.8 }} style={s.cardGloss} pointerEvents="none" />
          <CardShine />
          <View style={s.cardTop}>
            <View style={s.cardBrand}>
              <Logo size={22} style={{ tintColor: '#fff' }} />
              <Text style={s.cardBrandText}>pointer.</Text>
            </View>
            <View style={s.cardTierWrap}>
              <Text style={[s.cardTier, { color: tier.accent }]}>{tier.name}</Text>
              <Text style={s.cardVirtual}>{fin.status === 'active' ? (cardFrozen ? 'Frozen' : 'Virtual') : 'Not ordered'}</Text>
            </View>
          </View>
          <View style={s.cardNumRow}>
            <Text style={s.cardNum}>4242  ••••  ••••  {cardLast4}</Text>
            <VisaMark size={22} />
          </View>
          <View style={s.cardBottom}>
            <View>
              <Text style={s.cardSpendLabel}>Spendable</Text>
              <Text style={s.cardSpend}>{usd(m.states.spendable)}</Text>
            </View>
            <View style={s.applePay}>
              <Ionicons name={fin.status === 'active' ? 'logo-apple' : 'add'} size={15} color="#000" />
              <Text style={s.applePayText}>{fin.status === 'active' ? 'Add to Pay' : 'Order card'}</Text>
            </View>
          </View>
        </PressScale>
        </Rise>

        {/* Spending mode + Membership */}
        <Rise delay={200}>
          <View style={s.dualRow}>
            <PressScale to={0.97} onPress={() => setCreditOpen(true)} style={s.dualBtn}>
              <GlassFill />
              <Ionicons name={spendMode === 'credit' ? 'flash' : 'wallet-outline'} size={19} color={spendMode === 'credit' ? colors.bull : colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={s.dualTitle}>{spendMode === 'credit' ? 'Credit mode' : 'Cash mode'}</Text>
                <Text style={s.dualSub} numberOfLines={1}>{spendMode === 'credit' ? "Spend, don't sell" : 'Spend your USDC'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color={colors.fgMuted} />
            </PressScale>
            <PressScale to={0.97} onPress={() => setTiersOpen(true)} style={s.dualBtn}>
              <GlassFill />
              <Ionicons name="ribbon-outline" size={19} color={tier.accent} />
              <View style={{ flex: 1 }}>
                <Text style={s.dualTitle}>{tier.name}</Text>
                <Text style={s.dualSub} numberOfLines={1}>{tier.cashbackCredit}% cashback</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color={colors.fgMuted} />
            </PressScale>
          </View>
        </Rise>

        {/* Concierge — premium human support */}
        <Rise delay={210}>
          <PressScale to={0.98} onPress={() => setConciergeOpen(true)} style={s.concierge}>
            <GlassFill />
            <View style={s.conciergeAvatars}>
              {['#8A6FE8', '#3E9C7A', '#C6893F'].map((c, i) => (
                <View key={c} style={[s.conciergeAvatar, { backgroundColor: c, marginLeft: i === 0 ? 0 : -10 }]}>
                  <Text style={s.conciergeInitial}>{['M', 'R', 'K'][i]}</Text>
                </View>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.conciergeTitle}>Concierge</Text>
              <Text style={s.conciergeSub} numberOfLines={1}>
                {conciergeUnlocked ? '24/7 priority support' : 'Unlock with a membership'}
              </Text>
            </View>
            {conciergeUnlocked ? (
              <View style={s.conciergeOnline}>
                <View style={s.conciergeDot} />
                <Text style={s.conciergeOnlineText}>Online</Text>
              </View>
            ) : (
              <Ionicons name="lock-closed" size={14} color={colors.fgMuted} />
            )}
          </PressScale>
        </Rise>

        {/* Live credit line — only once you've borrowed */}
        {borrowed > 0 ? (() => {
          const line = collateralLine(demoCollateralHoldings(m.states.trading + m.states.earning));
          const available = Math.max(0, line.borrowPower - borrowed);
          const hf = healthFactor(line.eligibleValue, borrowed);
          const band = healthBand(hf);
          const bandColor = band === 'safe' ? colors.bull : band === 'moderate' ? colors.warn : colors.bear;
          return (
            <Rise delay={215}>
              <PressScale to={0.99} onPress={() => setCreditOpen(true)} style={s.creditStrip}>
                <GlassFill />
                <View style={s.creditStripTop}>
                  <View style={s.creditStripLabelRow}>
                    <Ionicons name="flash" size={15} color={colors.bull} />
                    <Text style={s.creditStripLabel}>Credit line</Text>
                  </View>
                  <View style={[s.creditStripBadge, { backgroundColor: bandColor + '22' }]}>
                    <Text style={[s.creditStripBadgeText, { color: bandColor }]}>
                      {Number.isFinite(hf) ? `Health ${hf.toFixed(2)}` : 'Healthy'}
                    </Text>
                  </View>
                </View>
                <View style={s.creditStripRow}>
                  <View>
                    <Text style={s.creditStripBig}>{usd(borrowed, 0)}</Text>
                    <Text style={s.creditStripSub}>borrowed</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.creditStripBig}>{usd(available, 0)}</Text>
                    <Text style={s.creditStripSub}>still available</Text>
                  </View>
                </View>
                <Text style={s.creditStripNote}>Your crypto stays invested — repay anytime, no sale.</Text>
              </PressScale>
            </Rise>
          );
        })() : null}

        {/* Smart Yield */}
        <Rise delay={230}>
        <PressScale to={0.99} onPress={() => openPanel('yield')} style={s.panel}>
          <GlassFill />
          <View style={s.panelHead}>
            <View style={s.panelTitleRow}>
              <Ionicons name="leaf" size={16} color={colors.bull} />
              <Text style={s.panelTitle}>Smart Yield</Text>
            </View>
            <View style={s.apyPill}>
              <Text style={s.apyText}>{apy.toFixed(1)}% APY</Text>
            </View>
          </View>
          <Text style={s.yieldEarned}>{usd(earned)}</Text>
          <Text style={s.yieldSub}>earned today · {usd(m.earnedTotal)} all-time</Text>
          <View style={{ marginTop: 12 }}>
            <Sparkline data={m.yieldHistory} />
          </View>
          <Text style={s.yieldProj}>Projected ~{usd((m.states.earning * (apy / 100)) / 12, 0)}/mo at today’s rate</Text>
        </PressScale>
        </Rise>

        {/* Tax reserve + Points — compact 2-up */}
        <Rise delay={290}>
        <View style={s.statRow}>
          <PressScale to={0.97} onPress={() => openPanel('tax')} style={s.statTile}>
            <GlassFill />
            <View style={[s.statIcon, { backgroundColor: covered ? colors.bullSoft : colors.warnSoft }]}>
              <Ionicons name="shield-checkmark" size={15} color={covered ? colors.bull : colors.warn} />
            </View>
            <Text style={s.statLabel}>Tax reserve</Text>
            <Text style={s.statVal}>{usd(m.taxReserve, 0)}</Text>
            <Text style={s.statSub} numberOfLines={1}>{covered ? 'Covered' : `Under ${usd(m.taxLiability - m.taxReserve, 0)}`}</Text>
          </PressScale>
          <PressScale to={0.97} onPress={() => openPanel('points')} style={s.statTile}>
            <GlassFill />
            <View style={[s.statIcon, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="diamond" size={15} color={colors.accentGlow} />
            </View>
            <Text style={s.statLabel}>PTR Points</Text>
            <Text style={[s.statVal, { color: colors.accentGlow }]}>{group(String(m.points))}</Text>
            <Text style={s.statSub} numberOfLines={1}>+{m.pointsThisWeek} this week</Text>
          </PressScale>
        </View>
        </Rise>

        {/* AI insight → opens the capital co-pilot */}
        <Rise delay={340}>
        <PressScale to={0.98} style={s.insight} onPress={() => openPanel('ai')}>
          <GlassFill active />
          <Ionicons name="cash-outline" size={16} color={colors.accentGlow} style={{ marginTop: 1 }} />
          <Text style={s.insightText}>{m.insights[0]}</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.accentGlow} style={{ marginTop: 2 }} />
        </PressScale>
        </Rise>

        {/* Activity */}
        <Rise delay={400}>
        <View style={s.sectionHead}>
          <View style={s.sectionBar} />
          <Text style={s.sectionTitle}>Activity</Text>
        </View>
        {m.activity.map((a) => {
          const pos = a.amountUsd >= 0;
          return (
            <View key={a.id} style={s.act}>
              <View style={s.actIcon}>
                <Ionicons name={ACT_ICON[a.kind]} size={17} color={colors.fgSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.actTitle} numberOfLines={1}>{a.title}</Text>
                <Text style={s.actSub} numberOfLines={1}>{a.sub}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.actAmt, { color: pos ? colors.bull : colors.fg }]}>{pos ? '+' : ''}{usd(a.amountUsd)}</Text>
                <Text style={s.actWhen}>{a.when}</Text>
              </View>
            </View>
          );
        })}

        <Text style={s.foot}>Trading · Earning · Spendable · Reserved. Never idle.</Text>
        </Rise>
      </ScrollView>

      <DepositFlow visible={deposit} onClose={() => setDeposit(false)} />
      <CardTiersSheet visible={tiersOpen} onClose={() => setTiersOpen(false)} />
      <ConciergeSheet
        visible={conciergeOpen}
        onClose={() => setConciergeOpen(false)}
        unlocked={conciergeUnlocked}
        onUpgrade={() => { setConciergeOpen(false); setTiersOpen(true); }}
      />
      <AccountDetailsSheet
        visible={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        tierName={tier.name}
        cardLast4={cardLast4}
      />
      <PayeePickerSheet
        visible={payeeOpen}
        onClose={() => setPayeeOpen(false)}
        onPick={(r) => { setPayeeOpen(false); setSendTo(r); }}
      />
      {sendTo ? (
        <SendMoneySheet visible={sendTo !== null} onClose={() => setSendTo(null)} recipient={sendTo} />
      ) : null}
      <CreditModeSheet
        visible={creditOpen}
        onClose={() => setCreditOpen(false)}
        collateralUsd={m.states.trading + m.states.earning}
        spendableUsd={m.states.spendable}
        onBorrowed={(amt) => setM((prev) => ({ ...prev, states: { ...prev.states, spendable: prev.states.spendable + amt } }))}
        onRepaid={(amt) => setM((prev) => ({ ...prev, states: { ...prev.states, spendable: Math.max(0, prev.states.spendable - amt) } }))}
      />

      <DragSheet visible={sheet !== null} onClose={closeSheet} fullDrag={sheet?.kind === 'state'}>
        {sheet?.kind === 'state' ? (
          <StateSheet
            state={STATES.find((x) => x.key === sheet.key)!}
            detail={stateDetail(sheet.key, m)}
            amount={m.states[sheet.key]}
            pct={m.total > 0 ? m.states[sheet.key] / m.total : 0}
            onAction={() => {
              const target = STATE_ACTION[sheet.key];
              if (target) openPanel(target);
              else {
                closeSheet();
                showToast('Your positions live in Portfolio', { kind: 'info' });
              }
            }}
          />
        ) : sheet?.panel === 'card' ? (
          <CardSheet m={m} card={fin.card} onClose={closeSheet} />
        ) : sheet?.panel === 'yield' ? (
          <YieldSheet m={m} apyOverride={liveApy} onClose={closeSheet} />
        ) : sheet?.panel === 'tax' ? (
          <TaxSheet m={m} onClose={closeSheet} />
        ) : sheet?.panel === 'points' ? (
          <PointsSheet m={m} onClose={closeSheet} />
        ) : sheet?.panel === 'ai' ? (
          <AiSheet m={m} onClose={closeSheet} />
        ) : sheet?.panel === 'move' ? (
          <MoveSheet states={m.states} onMove={moveCapital} onClose={closeSheet} />
        ) : null}
      </DragSheet>
    </Screen>
  );
}

function StateSheet({
  state,
  detail,
  amount,
  pct,
  onAction,
}: {
  state: (typeof STATES)[number];
  detail: StateDetail;
  amount: number;
  pct: number;
  onAction: () => void;
}) {
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
      <View style={s.sheetHead}>
        <View style={[s.sheetIcon, { backgroundColor: state.color + '22' }]}>
          <Ionicons name={state.icon} size={20} color={state.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.sheetKicker}>{state.label.toUpperCase()}</Text>
          <Text style={s.sheetAmt}>{usd(amount, 0)}</Text>
        </View>
        <Text style={s.sheetPct}>{Math.round(pct * 100)}%</Text>
      </View>

      <Text style={s.sheetBlurb}>{detail.blurb}</Text>

      <View style={s.sheetRows}>
        {detail.rows.map((r, i) => (
          <View key={r.label} style={[s.sheetRow, i > 0 && s.sheetRowBorder]}>
            <Text style={s.sheetRowLabel}>{r.label}</Text>
            <Text style={s.sheetRowValue}>{r.value}</Text>
          </View>
        ))}
      </View>

      <GlossButton onPress={onAction} style={{ marginTop: 18 }}>
        <Text style={s.addText}>{detail.action}</Text>
        <Ionicons name="chevron-forward" size={17} color={colors.onAccent} />
      </GlossButton>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.fg, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  aiPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  aiPillText: { color: colors.accentGlow, fontSize: 12, fontWeight: '800' },

  capLabel: { color: colors.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: 18 },
  cap: { color: colors.fg, fontSize: 46, fontWeight: '700', letterSpacing: -1.6, marginTop: 4 },
  capCents: { color: colors.fgFaint },
  capSub: { color: colors.accentGlow, fontSize: 13, fontWeight: '600', marginTop: 4 },

  bar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginTop: 18, gap: 2, backgroundColor: colors.bg },
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  legendCell: { width: '50%', paddingVertical: 6, paddingRight: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7, width: '100%' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { color: colors.fgMuted, fontSize: 13, flex: 1 },
  legendVal: { color: colors.fg, fontSize: 13.5, fontWeight: '700' },
  moveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 16, paddingVertical: 11, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(199,204,209,0.30)', backgroundColor: 'rgba(199,204,209,0.09)' },
  moveText: { color: '#D2D8DE', fontSize: 14, fontWeight: '700' },
  // Quick actions (Add / Send / Details)
  quickRow: { flexDirection: 'row', justifyContent: 'center', gap: 34, marginTop: 20 },
  quick: { alignItems: 'center', gap: 8 },
  quickBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: '#C7CCD1', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  quickSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
  quickLabel: { color: colors.fgSecondary, fontSize: 13, fontWeight: '600' },

  // Finalize setup
  setup: { borderRadius: radius.lg, padding: 16, marginTop: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(199,204,209,0.22)' },
  setupHead: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  setupTitle: { color: colors.fg, fontSize: 16.5, fontWeight: '800' },
  setupSub: { color: colors.fgMuted, fontSize: 13, marginTop: 2 },
  setupSteps: { marginTop: 14, gap: 2 },
  setupStep: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 8 },
  setupCheck: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  setupCheckDone: { backgroundColor: '#C7CCD1' },
  setupCheckIdle: { borderWidth: 1.5, borderColor: 'rgba(199,204,209,0.35)' },
  setupStepLabel: { color: colors.fg, fontSize: 14.5, fontWeight: '600', flex: 1 },
  setupStepLabelDone: { color: colors.fgMuted, textDecorationLine: 'line-through' },

  // Concierge strip
  concierge: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: 14, marginTop: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  conciergeAvatars: { flexDirection: 'row', alignItems: 'center' },
  conciergeAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.bg },
  conciergeInitial: { color: '#fff', fontSize: 13, fontWeight: '800' },
  conciergeTitle: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  conciergeSub: { color: colors.fgMuted, fontSize: 12.5, marginTop: 1 },
  conciergeOnline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  conciergeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.bull },
  conciergeOnlineText: { color: colors.bull, fontSize: 12, fontWeight: '700' },

  dualRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  dualBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 13, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  dualTitle: { color: colors.fg, fontSize: 14, fontWeight: '700' },
  dualSub: { color: colors.fgMuted, fontSize: 11.5, marginTop: 1 },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statTile: { flex: 1, borderRadius: radius.lg, padding: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  statIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statLabel: { color: colors.fgMuted, fontSize: 12.5 },
  statVal: { color: colors.fg, fontSize: 19, fontWeight: '800', marginTop: 2 },
  statSub: { color: colors.fgFaint, fontSize: 11.5, marginTop: 2 },
  creditStrip: { borderRadius: radius.lg, padding: 15, marginTop: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,224,160,0.22)' },
  creditStripTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  creditStripLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  creditStripLabel: { color: colors.fg, fontSize: 14, fontWeight: '700' },
  creditStripBadge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  creditStripBadgeText: { fontSize: 12, fontWeight: '700' },
  creditStripRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  creditStripBig: { color: colors.fg, fontSize: 22, fontWeight: '800' },
  creditStripSub: { color: colors.fgMuted, fontSize: 12, marginTop: 1 },
  creditStripNote: { color: colors.fgFaint, fontSize: 12, marginTop: 12 },

  card: { borderRadius: radius.lg, overflow: 'hidden', marginTop: 22, padding: 18, borderWidth: 1, borderColor: colors.accent + '33', height: 190, justifyContent: 'space-between' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardBrandText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  cardVirtual: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' },
  cardTierWrap: { alignItems: 'flex-end' },
  cardTier: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  metalGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 340 },
  cardGloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '65%' },
  cardNumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardNum: { color: 'rgba(255,255,255,0.9)', fontSize: 18, fontWeight: '600', letterSpacing: 2 },
  cardBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  cardSpendLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  cardSpend: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 2 },
  applePay: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  applePayText: { color: '#000', fontSize: 13.5, fontWeight: '700' },

  panel: { borderRadius: radius.lg, overflow: 'hidden', padding: 16, marginTop: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  panelTitle: { color: colors.fg, fontSize: 15.5, fontWeight: '700' },
  apyPill: { backgroundColor: colors.bullSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  apyText: { color: colors.bull, fontSize: 12.5, fontWeight: '800' },
  yieldEarned: { color: colors.fg, fontSize: 34, fontWeight: '800', letterSpacing: -1, marginTop: 12 },
  yieldSub: { color: colors.fgMuted, fontSize: 13, marginTop: 2 },
  yieldProj: { color: colors.fgFaint, fontSize: 12.5, marginTop: 10 },

  reserveRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, padding: 14, marginTop: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  reserveIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  reserveLabel: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  reserveSub: { color: colors.fgMuted, fontSize: 12.5, marginTop: 2 },
  reserveVal: { color: colors.fg, fontSize: 17, fontWeight: '800' },

  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, padding: 14, marginTop: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  pointsIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },

  insight: { flexDirection: 'row', gap: 10, borderRadius: radius.md, padding: 14, marginTop: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.accent + '3D' },
  insightText: { color: colors.fg, fontSize: 14, fontWeight: '600', lineHeight: 20, flex: 1 },

  addText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 28, marginBottom: 4 },
  sectionBar: { width: 3, height: 16, borderRadius: 2, backgroundColor: '#C7CCD1' },
  sectionTitle: { color: colors.fg, fontSize: 17, fontWeight: '700' },

  act: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  actIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.bgRaised2, alignItems: 'center', justifyContent: 'center' },
  actTitle: { color: colors.fg, fontSize: 15, fontWeight: '600' },
  actSub: { color: colors.fgMuted, fontSize: 12.5, marginTop: 1 },
  actAmt: { fontSize: 15, fontWeight: '700' },
  actWhen: { color: colors.fgFaint, fontSize: 12, marginTop: 1 },

  foot: { color: colors.fgFaint, fontSize: 12.5, textAlign: 'center', marginTop: 22 },

  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 6 },
  sheetIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  sheetKicker: { color: colors.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  sheetAmt: { color: colors.fg, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 1 },
  sheetPct: { color: colors.fgFaint, fontSize: 18, fontWeight: '700' },
  sheetBlurb: { color: colors.fgSecondary, fontSize: 14.5, lineHeight: 21, marginTop: 16 },
  sheetRows: { borderRadius: radius.md, backgroundColor: colors.bgRaised2, marginTop: 18, paddingHorizontal: 14 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  sheetRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  sheetRowLabel: { color: colors.fgMuted, fontSize: 14 },
  sheetRowValue: { color: colors.fg, fontSize: 15, fontWeight: '700' },
});
