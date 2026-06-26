import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressScale } from '../components/PressScale';
import { Slide } from '../components/Slide';
import { colors, radius } from '../src/theme';
import { useAuth } from '../src/auth';
import { AccountScreen } from './AccountScreen';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type Section = 'Account' | 'Appearance' | 'Notifications' | 'Security' | 'Deposit & Withdraw' | 'Legal & Privacy' | 'Taxes' | 'Help & Support' | 'Perps FAQ';

const ROWS: Section[] = ['Account', 'Appearance', 'Notifications', 'Security', 'Deposit & Withdraw', 'Legal & Privacy', 'Taxes', 'Help & Support', 'Perps FAQ'];

export function SettingsScreen({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<Section | null>(null);

  return (
    <View style={s.root}>
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <PressScale onPress={section ? () => setSection(null) : onClose} to={0.85} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.fgSecondary} />
        </PressScale>
      </View>

      {section === null ? (
        <Slide key="list" dir={-1} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            <Text style={s.h1}>Settings</Text>
            {ROWS.map((r) => (
              <PressScale key={r} onPress={() => setSection(r)} to={0.99} style={s.row}>
                <Text style={s.rowLabel}>{r}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.fgMuted} />
              </PressScale>
            ))}
            <PressScale onPress={() => Linking.openURL('https://discord.com').catch(() => {})} to={0.99} style={s.row}>
              <View style={s.rowLeft}>
                <Ionicons name="logo-discord" size={20} color={colors.fg} />
                <Text style={s.rowLabel}>Discord</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.fgMuted} />
            </PressScale>
            <PressScale onPress={onLogout} to={0.99} style={s.row}>
              <View style={s.rowLeft}>
                <Ionicons name="log-out-outline" size={20} color={colors.danger} />
                <Text style={[s.rowLabel, { color: colors.danger }]}>Logout</Text>
              </View>
            </PressScale>
            <Text style={s.version}>Pointer v0.1.0 · demo</Text>
          </ScrollView>
        </Slide>
      ) : section === 'Account' ? (
        <Slide key="account" dir={1} style={{ flex: 1 }}>
          <AccountScreen />
        </Slide>
      ) : (
        <Slide key={section} dir={1} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            <Text style={s.h1}>{section}</Text>
            <Detail section={section} />
          </ScrollView>
        </Slide>
      )}
    </View>
  );
}

function Detail({ section }: { section: Section }) {
  const auth = useAuth();
  if (section === 'Appearance') {
    return (
      <>
        <Segmented label="Theme" options={['Dark', 'Light']} initial={0} />
        <Segmented label="Trade mode" options={['Simple', 'Advanced']} initial={0} />
        <Segmented label="Text size" options={['Default', 'Large']} initial={0} />
      </>
    );
  }
  if (section === 'Notifications') {
    return (
      <>
        <Toggle label="Price alerts" sub="Token moves on your watchlist" initial />
        <Toggle label="Friends' activity" sub="When people you follow trade" initial />
        <Toggle label="Top traders" sub="Large trades from top traders" initial />
        <Toggle label="Announcements" sub="New features and market news" />
      </>
    );
  }
  if (section === 'Security') {
    return (
      <>
        <Toggle label="Face ID" sub="Require Face ID to open the app" />
        <Toggle label="Confirm trades" sub="Face ID before every buy/sell" initial />
        <Toggle label="Confirm withdrawals" sub="Face ID before moving funds" initial />
      </>
    );
  }
  if (section === 'Account') {
    return (
      <>
        <Field label="Username" value="@pointer" />
        <Field label="Email" value="you@pointer.xyz" />
        <Field label="Solana address" value={auth.walletAddress ?? '—'} />
      </>
    );
  }
  if (section === 'Deposit & Withdraw') {
    return (
      <>
        <Field label="Deposit" value="Crypto · Apple Pay · Debit" />
        <Field label="Withdraw" value="Bank · Crypto wallet" />
        <Field label="Fee cashback" value="50% back on every trade" accent />
      </>
    );
  }
  return <Text style={s.placeholder}>{section} settings — full controls land with the production build.</Text>;
}

function Segmented({ label, options, initial }: { label: string; options: string[]; initial: number }) {
  const [i, setI] = useState(initial);
  return (
    <View style={s.block}>
      <Text style={s.blockLabel}>{label}</Text>
      <View style={s.seg}>
        {options.map((o, idx) => (
          <PressScale key={o} onPress={() => setI(idx)} to={0.96} style={[s.segItem, idx === i && s.segItemOn]}>
            <Text style={[s.segText, idx === i && s.segTextOn]}>{o}</Text>
          </PressScale>
        ))}
      </View>
    </View>
  );
}

function Toggle({ label, sub, initial }: { label: string; sub?: string; initial?: boolean }) {
  const [on, setOn] = useState(Boolean(initial));
  return (
    <PressScale onPress={() => setOn((v) => !v)} to={0.99} style={s.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {sub ? <Text style={s.toggleSub}>{sub}</Text> : null}
      </View>
      <View style={[s.track, on && s.trackOn]}>
        <View style={[s.knob, on && s.knobOn]} />
      </View>
    </PressScale>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={[s.fieldValue, accent && { color: colors.bull }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { paddingHorizontal: 18, paddingBottom: 4 },
  content: { paddingHorizontal: 18, paddingBottom: 60 },
  h1: { color: colors.fg, fontSize: 32, fontWeight: '700', letterSpacing: -0.5, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { color: colors.fg, fontSize: 18, fontWeight: '500' },
  version: { color: colors.fgFaint, fontSize: 13, marginTop: 24 },

  block: { marginTop: 18 },
  blockLabel: { color: colors.fg, fontSize: 16, fontWeight: '600', marginBottom: 10 },
  seg: { flexDirection: 'row', backgroundColor: colors.bgRaised, borderRadius: radius.md, padding: 4, gap: 4 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: radius.sm },
  segItemOn: { backgroundColor: colors.accent },
  segText: { color: colors.fgSecondary, fontSize: 15, fontWeight: '600' },
  segTextOn: { color: '#fff' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  toggleSub: { color: colors.fgMuted, fontSize: 13, marginTop: 3 },
  track: { width: 46, height: 28, borderRadius: 14, backgroundColor: colors.border, padding: 3, justifyContent: 'center' },
  trackOn: { backgroundColor: colors.accent },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: 'flex-start' },
  knobOn: { alignSelf: 'flex-end' },

  field: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  fieldLabel: { color: colors.fgMuted, fontSize: 13 },
  fieldValue: { color: colors.fg, fontSize: 16, fontWeight: '500', marginTop: 4 },
  placeholder: { color: colors.fgMuted, fontSize: 15, lineHeight: 22, marginTop: 8 },
});
