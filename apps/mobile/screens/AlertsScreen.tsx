import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { PressScale } from '../components/PressScale';
import { DragSheet } from '../components/DragSheet';
import { PickerSheet } from '../components/PickerSheet';
import { SolAmount } from '../components/SolAmount';
import { colors, radius } from '../src/theme';
import { shortMint } from '../src/format';
import {
  useNotifPrefs,
  setNotifPref,
  type NotifPrefs,
  useAutoRules,
  addRule,
  toggleRule,
  removeRule,
  useKillSwitch,
  setKillSwitch,
  type RuleTrigger,
} from '../src/local';
import {
  TRACKED_WALLETS,
  POPULAR_WALLETS,
  RECENT_TOKENS,
  POPULAR_TOKENS,
  POPULAR_HANDLES,
  isValidMint,
  isValidHandle,
  isValidKeyword,
  sanitizeText,
  normalizeHandle,
  type RuleOption,
} from '../src/rules/ruleData';

/**
 * ALERTS HUB — the Advanced-mode operator surface (the nav bell, replacing the
 * Social/leaderboard tab). Web parity: sniping + X-monitor + auto-buy automation
 * with cooldown / daily-cap, a kill switch, and per-type phone-push control.
 * Rule inputs are SMART + SAFE: dropdowns of your wallets / recent tokens /
 * popular @s, and validated paste — never free-text that could be injected.
 * Demo persistence + real UI/store; live firing wires to the trade path + alerts
 * stream with the dev build. (Image-match trigger is PC-only — omitted here.)
 */

type IconName = keyof typeof Ionicons.glyphMap;

const TRIGGERS: { key: RuleTrigger; icon: IconName; label: string; hint: string }[] = [
  { key: 'x_ca', icon: 'logo-twitter', label: 'X posts CA', hint: 'A tracked X account posts a contract address.' },
  { key: 'x_keyword', icon: 'chatbubble-ellipses-outline', label: 'X keyword', hint: 'A phrase appears in tracked accounts.' },
  { key: 'tracked_wallet', icon: 'wallet-outline', label: 'Wallet buys', hint: 'A wallet you track buys.' },
  { key: 'price', icon: 'trending-up-outline', label: 'Price', hint: 'A token hits a multiple of its current price.' },
  { key: 'image_match', icon: 'image-outline', label: 'Image', hint: 'pfp / CA image-hash match (desktop only).' },
];
// Image-match is desktop-only — keep it in TRIGGERS for label lookup, but don't offer it in the builder.
const BUILDER_TRIGGERS = TRIGGERS.filter((t) => t.key !== 'image_match');
const trig = (k: RuleTrigger) => TRIGGERS.find((t) => t.key === k) ?? TRIGGERS[0];

const BUY_PRESETS = [0, 0.05, 0.1, 0.5, 1];
const COOLDOWNS = [0, 15, 30, 60];
const CAPS = [1, 5, 10, 25];
const MULTS = [1.5, 2, 3, 5, 10];

const NOTIF_ROWS: { key: keyof NotifPrefs; icon: IconName; label: string; desc: string }[] = [
  { key: 'trackedWallets', icon: 'wallet-outline', label: 'Tracked wallet buys', desc: 'When a wallet you track buys or sells.' },
  { key: 'xMonitor', icon: 'logo-twitter', label: 'X monitor', desc: 'New CA / keyword from accounts you watch.' },
  { key: 'priceAlerts', icon: 'trending-up-outline', label: 'Price alerts', desc: 'Your limit triggers and price targets.' },
  { key: 'autoBuyFills', icon: 'flash-outline', label: 'Auto-buy fills', desc: 'When an automation rule fires a buy.' },
];

function dedupeOpts(opts: RuleOption[]): RuleOption[] {
  const seen = new Set<string>();
  const out: RuleOption[] = [];
  for (const o of opts) {
    if (seen.has(o.value)) continue;
    seen.add(o.value);
    out.push(o);
  }
  return out;
}

export function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const notif = useNotifPrefs();
  const rules = useAutoRules();
  const kill = useKillSwitch();
  const [builder, setBuilder] = useState(false);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.title}>Alerts</Text>
        <Text style={s.sub}>Sniping, X-monitor & auto-buy — and what pings your phone.</Text>

        {/* Kill switch */}
        <View style={[s.killRow, kill && s.killRowOn]}>
          <Ionicons name="power" size={18} color={kill ? colors.bear : colors.bull} />
          <View style={s.rowText}>
            <Text style={s.rowTitle}>{kill ? 'Automation paused' : 'Automation armed'}</Text>
            <Text style={s.rowDesc}>{kill ? 'No rules will fire until you re-arm.' : 'Enabled rules can fire.'}</Text>
          </View>
          <Switch
            value={!kill}
            onValueChange={(v) => setKillSwitch(!v)}
            trackColor={{ false: colors.bearSoft, true: colors.bull }}
            thumbColor="#fff"
          />
        </View>

        {/* Phone notifications */}
        <Text style={s.sectionLabel}>Push to my phone</Text>
        <View style={s.card}>
          {NOTIF_ROWS.map((r, i) => (
            <View key={r.key} style={[s.row, i > 0 && s.rowDivider]}>
              <View style={s.rowIcon}>
                <Ionicons name={r.icon} size={17} color={colors.fgSecondary} />
              </View>
              <View style={s.rowText}>
                <Text style={s.rowTitle}>{r.label}</Text>
                <Text style={s.rowDesc}>{r.desc}</Text>
              </View>
              <Switch
                value={notif[r.key]}
                onValueChange={(v) => setNotifPref(r.key, v)}
                trackColor={{ false: colors.bgRaised2, true: colors.accent }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        {/* Automation rules */}
        <View style={s.sectionHeadRow}>
          <Text style={s.sectionLabel}>Automation rules</Text>
          <PressScale style={s.addBtn} to={0.95} onPress={() => setBuilder(true)}>
            <Ionicons name="add" size={15} color={colors.accentGlow} />
            <Text style={s.addText}>New</Text>
          </PressScale>
        </View>
        <View style={s.card}>
          {rules.length === 0 ? (
            <Text style={s.emptyRules}>No rules yet — tap New to arm one.</Text>
          ) : (
            rules.map((r, i) => {
              const t = trig(r.trigger);
              return (
                <View key={r.id} style={[s.row, i > 0 && s.rowDivider, kill && { opacity: 0.5 }]}>
                  <View style={s.ruleIcon}>
                    <Ionicons name={t.icon} size={15} color={colors.accentGlow} />
                  </View>
                  <View style={s.rowText}>
                    <Text style={s.rowTitle} numberOfLines={1}>
                      {t.label} · {r.target}
                    </Text>
                    <Text style={s.rowDesc} numberOfLines={1}>
                      {r.buySol > 0 ? `Auto-buy ${r.buySol} SOL · ${r.cooldownSec}s · ${r.dailyCapSol}/day cap` : 'Notify only'}
                    </Text>
                  </View>
                  <Switch
                    value={r.enabled}
                    onValueChange={() => toggleRule(r.id)}
                    trackColor={{ false: colors.bgRaised2, true: colors.bull }}
                    thumbColor="#fff"
                  />
                  <PressScale onPress={() => removeRule(r.id)} hitSlop={8} to={0.85} style={s.del}>
                    <Ionicons name="trash-outline" size={16} color={colors.fgMuted} />
                  </PressScale>
                </View>
              );
            })
          )}
        </View>

        <Text style={s.note}>
          Rule config + push preferences are real. Live X-monitor + on-device push + auto-buy execution wire to the
          backend + real trade path with the dev build.
        </Text>
      </ScrollView>

      <RuleBuilder visible={builder} onClose={() => setBuilder(false)} />
    </Screen>
  );
}

function SelectButton({ label, set, onPress }: { label: string; set: boolean; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} to={0.98} style={s.select}>
      <Text style={[s.selectText, !set && { color: colors.fgMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-down" size={16} color={colors.fgMuted} />
    </PressScale>
  );
}

function RuleBuilder({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [trigger, setTrigger] = useState<RuleTrigger>('x_ca');
  const [target, setTarget] = useState(''); // value: mint / handle / keyword
  const [targetLabel, setTargetLabel] = useState(''); // display label
  const [priceMult, setPriceMult] = useState(2);
  const [picker, setPicker] = useState<null | 'token' | 'wallet' | 'handle'>(null);
  const [buySol, setBuySol] = useState(0.1);
  const [cooldown, setCooldown] = useState(30);
  const [cap, setCap] = useState(5);

  const reset = () => {
    setTrigger('x_ca');
    setTarget('');
    setTargetLabel('');
    setPriceMult(2);
    setBuySol(0.1);
    setCooldown(30);
    setCap(5);
    setPicker(null);
  };
  const onTrigger = (k: RuleTrigger) => {
    setTrigger(k);
    setTarget('');
    setTargetLabel('');
  };

  const t = target.trim();
  const valid =
    trigger === 'price' || trigger === 'tracked_wallet'
      ? isValidMint(t)
      : trigger === 'x_ca'
        ? isValidHandle(t)
        : isValidKeyword(t); // x_keyword

  const save = () => {
    if (!valid) return;
    let display: string;
    if (trigger === 'price') display = `${targetLabel || shortMint(t)} → ${priceMult}x`;
    else if (trigger === 'tracked_wallet') display = targetLabel || shortMint(t);
    else if (trigger === 'x_ca') display = '@' + normalizeHandle(t);
    else display = sanitizeText(t); // x_keyword
    addRule({ trigger, target: display, buySol, cooldownSec: cooldown, dailyCapSol: cap, enabled: true });
    reset();
    onClose();
  };

  const tokenOptions = dedupeOpts([...RECENT_TOKENS, ...POPULAR_TOKENS]);
  const walletOptions = dedupeOpts([...TRACKED_WALLETS, ...POPULAR_WALLETS]);

  return (
    <>
      <DragSheet visible={visible} onClose={onClose}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }}>
          <Text style={s.builderTitle}>New rule</Text>

          <Text style={s.fieldLabel}>Trigger</Text>
          <View style={s.trigGrid}>
            {BUILDER_TRIGGERS.map((tr) => {
              const on = tr.key === trigger;
              return (
                <PressScale key={tr.key} onPress={() => onTrigger(tr.key)} to={0.95} style={[s.trigChip, on && s.trigChipOn]}>
                  <Ionicons name={tr.icon} size={14} color={on ? colors.accentGlow : colors.fgMuted} />
                  <Text style={[s.trigText, on && { color: colors.fg }]}>{tr.label}</Text>
                </PressScale>
              );
            })}
          </View>
          <Text style={s.fieldHint}>{trig(trigger).hint}</Text>

          {/* Smart target input per trigger */}
          {trigger === 'x_keyword' ? (
            <>
              <Text style={s.fieldLabel}>Keyword</Text>
              <TextInput
                value={target}
                onChangeText={(v) => {
                  setTarget(v);
                  setTargetLabel(v);
                }}
                placeholder="keyword / $ticker"
                placeholderTextColor={colors.fgFaint}
                autoCapitalize="none"
                autoCorrect={false}
                style={s.input}
              />
              {t.length > 0 && !valid ? <Text style={s.errHint}>Letters, numbers, spaces and $ # _ - only (max 40).</Text> : null}
            </>
          ) : trigger === 'price' ? (
            <>
              <Text style={s.fieldLabel}>Token (CA)</Text>
              <SelectButton label={targetLabel || 'Choose token / paste CA'} set={Boolean(targetLabel)} onPress={() => setPicker('token')} />
              <Text style={s.fieldLabel}>Target</Text>
              <View style={s.chips}>
                {MULTS.map((m) => (
                  <PressScale key={m} onPress={() => setPriceMult(m)} to={0.94} style={[s.chip, priceMult === m && s.chipOn]}>
                    <Text style={[s.chipText, priceMult === m && s.chipTextOn]}>{m}x</Text>
                  </PressScale>
                ))}
              </View>
            </>
          ) : trigger === 'tracked_wallet' ? (
            <>
              <Text style={s.fieldLabel}>Wallet</Text>
              <SelectButton label={targetLabel || 'Choose wallet / paste address'} set={Boolean(targetLabel)} onPress={() => setPicker('wallet')} />
            </>
          ) : (
            <>
              <Text style={s.fieldLabel}>X account</Text>
              <SelectButton label={targetLabel || 'Choose @handle'} set={Boolean(targetLabel)} onPress={() => setPicker('handle')} />
            </>
          )}

          <Text style={s.fieldLabel}>Action</Text>
          <View style={s.chips}>
            {BUY_PRESETS.map((p) => {
              const on = buySol === p;
              return (
                <PressScale key={p} onPress={() => setBuySol(p)} to={0.94} style={[s.chip, on && s.chipOn]}>
                  {p === 0 ? (
                    <Text style={[s.chipText, on && s.chipTextOn]}>Notify only</Text>
                  ) : (
                    <SolAmount value={p} size={13} weight="600" color={on ? colors.accentGlow : colors.fgSecondary} />
                  )}
                </PressScale>
              );
            })}
          </View>

          {buySol > 0 ? (
            <>
              <Text style={s.fieldLabel}>Cooldown</Text>
              <View style={s.chips}>
                {COOLDOWNS.map((c) => (
                  <PressScale key={c} onPress={() => setCooldown(c)} to={0.94} style={[s.chip, cooldown === c && s.chipOn]}>
                    <Text style={[s.chipText, cooldown === c && s.chipTextOn]}>{c}s</Text>
                  </PressScale>
                ))}
              </View>
              <Text style={s.fieldLabel}>Daily cap</Text>
              <View style={s.chips}>
                {CAPS.map((c) => (
                  <PressScale key={c} onPress={() => setCap(c)} to={0.94} style={[s.chip, cap === c && s.chipOn]}>
                    <SolAmount value={c} size={13} weight="600" color={cap === c ? colors.accentGlow : colors.fgSecondary} />
                  </PressScale>
                ))}
              </View>
            </>
          ) : null}

          <PressScale style={[s.saveBtn, !valid && { opacity: 0.5 }]} onPress={save}>
            <Text style={s.saveText}>Add rule</Text>
          </PressScale>
        </ScrollView>
      </DragSheet>

      <PickerSheet
        visible={picker === 'token'}
        onClose={() => setPicker(null)}
        title="Token"
        options={tokenOptions}
        onSelect={(value, label) => {
          setTarget(value);
          setTargetLabel(label.startsWith('$') ? label : shortMint(value));
        }}
        allowManual
        validateManual={isValidMint}
        manualLabel="Paste contract address"
        manualPlaceholder="e.g. EKpQ…zcjm"
      />
      <PickerSheet
        visible={picker === 'wallet'}
        onClose={() => setPicker(null)}
        title="Wallet"
        options={walletOptions}
        onSelect={(value, label) => {
          setTarget(value);
          setTargetLabel(label.length > 24 ? shortMint(value) : label);
        }}
        allowManual
        validateManual={isValidMint}
        manualLabel="Paste wallet address"
        manualPlaceholder="wallet address"
      />
      <PickerSheet
        visible={picker === 'handle'}
        onClose={() => setPicker(null)}
        title="X account"
        options={POPULAR_HANDLES}
        onSelect={(value) => {
          const h = normalizeHandle(value);
          setTarget(h);
          setTargetLabel('@' + h);
        }}
        allowManual
        validateManual={isValidHandle}
        manualLabel="Enter @handle"
        manualPlaceholder="@handle"
      />
    </>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: { color: colors.fg, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  opBadge: { backgroundColor: colors.accentSoft, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: colors.accent + '55' },
  opBadgeText: { color: colors.accentGlow, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  sub: { color: colors.fgMuted, fontSize: 13, marginTop: 6 },

  killRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, backgroundColor: colors.bgRaised, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12 },
  killRowOn: { borderColor: colors.bear + '66', backgroundColor: colors.bearSoft },

  sectionLabel: { color: colors.fgSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 22, marginBottom: 9 },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6, marginTop: 16 },
  addText: { color: colors.accentGlow, fontSize: 12, fontWeight: '700' },

  card: { backgroundColor: colors.bgRaised, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowIcon: { width: 28, alignItems: 'center' },
  ruleIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { color: colors.fg, fontSize: 14.5, fontWeight: '600' },
  rowDesc: { color: colors.fgMuted, fontSize: 12, marginTop: 2 },
  del: { padding: 2 },
  emptyRules: { color: colors.fgMuted, fontSize: 13, paddingVertical: 16, textAlign: 'center' },

  note: { color: colors.fgFaint, fontSize: 12, lineHeight: 17, marginTop: 18 },

  builderTitle: { color: colors.fg, fontSize: 19, fontWeight: '700', marginBottom: 4 },
  fieldLabel: { color: colors.fgSecondary, fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  fieldHint: { color: colors.fgMuted, fontSize: 12, marginTop: 8 },
  errHint: { color: colors.bear, fontSize: 11.5, marginTop: 6 },
  trigGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  trigChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bgRaised, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: colors.border },
  trigChipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  trigText: { color: colors.fgMuted, fontSize: 13, fontWeight: '600' },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bgRaised, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 13 },
  selectText: { color: colors.fg, fontSize: 15, flex: 1, marginRight: 8 },
  input: { backgroundColor: colors.bgRaised, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, color: colors.fg, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.bgRaised, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { color: colors.fgSecondary, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: colors.accentGlow },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 22 },
  saveText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },
});
