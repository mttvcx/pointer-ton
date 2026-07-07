import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DragSheet } from './DragSheet';
import { colors, radius } from '../src/theme';
import { usd } from '../src/format';
import { tierById, CATEGORY_META, type TierId } from '../src/financial/tiers';
import { useCapUsage, capStatus } from '../src/financial/cashback';

/**
 * Cashback — the honest ledger. Shows every boosted category's rate, its monthly
 * cap, and how much of that cap you've used, so nothing is over-promised: once a
 * cap is hit, that category drops to your base rate for the rest of the month.
 */
export function CashbackSheet({ visible, onClose, tierId }: { visible: boolean; onClose: () => void; tierId: TierId }) {
  useCapUsage(); // re-render as caps fill
  const tier = tierById(tierId);
  const rows = capStatus(tierId);

  return (
    <DragSheet visible={visible} onClose={onClose} fullDrag>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Cashback</Text>
        <Text style={s.sub}>
          <Text style={{ color: colors.fg, fontWeight: '700' }}>{tier.cashbackCredit}%</Text> on everything, boosted in these categories — up to a monthly cap.
        </Text>

        <View style={s.list}>
          {rows.map((r) => {
            const meta = CATEGORY_META[r.category];
            const rate = tier.boosts[r.category].rate;
            const full = r.pct >= 1;
            return (
              <View key={r.category} style={s.row}>
                <View style={s.rowTop}>
                  <View style={s.rowLeft}>
                    <View style={s.rowIcon}>
                      <Ionicons name={meta.icon as any} size={16} color={colors.fg} />
                    </View>
                    <View>
                      <Text style={s.rowLabel}>{meta.label}</Text>
                      <Text style={s.rowExamples}>{meta.examples}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.rowRate, full && { color: colors.fgMuted }]}>{rate}%</Text>
                    <Text style={s.rowCap}>up to {usd(r.cap, 0)}/mo</Text>
                  </View>
                </View>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${Math.round(r.pct * 100)}%`, backgroundColor: full ? colors.warn : colors.bull }]} />
                </View>
                <Text style={s.rowUsed}>
                  {full ? (
                    <Text style={{ color: colors.warn }}>Cap reached — now earning {tier.cashbackCredit}% base this month</Text>
                  ) : (
                    <>{usd(r.used)} of {usd(r.cap, 0)} used · {usd(r.remaining)} of boost left</>
                  )}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={s.note}>
          <Ionicons name="information-circle-outline" size={15} color={colors.fgMuted} style={{ marginTop: 1 }} />
          <Text style={s.noteText}>
            Boosted rates are partly merchant-funded (card-linked offers). Past each monthly cap, that category earns your{' '}
            {tier.cashbackCredit}% base rate — never zero. Category is detected from the merchant, not self-reported.
          </Text>
        </View>
      </ScrollView>
    </DragSheet>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { color: colors.fg, fontSize: 23, fontWeight: '800' },
  sub: { color: colors.fgSecondary, fontSize: 14, lineHeight: 20, marginTop: 8 },
  list: { marginTop: 18, gap: 14 },
  row: { borderRadius: radius.md, backgroundColor: colors.bgRaised2, padding: 14 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(199,204,209,0.12)', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  rowExamples: { color: colors.fgMuted, fontSize: 11.5, marginTop: 1 },
  rowRate: { color: colors.bull, fontSize: 18, fontWeight: '800' },
  rowCap: { color: colors.fgFaint, fontSize: 11, marginTop: 1 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.bg, overflow: 'hidden', marginTop: 12 },
  barFill: { height: 6, borderRadius: 3 },
  rowUsed: { color: colors.fgMuted, fontSize: 12, marginTop: 8 },
  note: { flexDirection: 'row', gap: 9, marginTop: 20, paddingHorizontal: 2 },
  noteText: { color: colors.fgMuted, fontSize: 12, lineHeight: 18, flex: 1 },
});
