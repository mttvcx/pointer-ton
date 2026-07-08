import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { DragSheet } from './DragSheet';
import { PressScale } from './PressScale';
import { colors, radius } from '../src/theme';
import { usd } from '../src/format';
import { RARITY, solToUsd, type Pack, type PackRarity } from '../src/packs/api';

const ORDER: PackRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const SIZE = 220;
const STROKE = 26;

/**
 * "What's inside?" — the provable odds. A donut of the rarity distribution (from
 * the real pack config) + a tier list. Tap a tier to spotlight it in the center.
 * Odds are server-provided; we never fabricate them.
 */
export function PackOddsSheet({ pack, solUsd, onClose }: { pack: Pack | null; solUsd: number; onClose: () => void }) {
  const rows = pack ? [...pack.odds].sort((a, b) => ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity)) : [];
  const top = rows.length ? rows.reduce((a, b) => (b.probabilityBps > a.probabilityBps ? b : a)) : null;
  const [sel, setSel] = useState<PackRarity | null>(null);
  const active = sel ?? top?.rarity ?? null;
  const activeRow = rows.find((r) => r.rarity === active) ?? null;

  if (!pack) return null;

  const r = (SIZE - STROKE) / 2;
  const C = 2 * Math.PI * r;
  let offset = 0;

  return (
    <DragSheet visible={pack !== null} onClose={onClose} fullDrag>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>{pack.label}</Text>

        <View style={s.wheelWrap}>
          <Svg width={SIZE} height={SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke={colors.bgRaised2} strokeWidth={STROKE} fill="none" />
            {rows.map((row) => {
              const frac = row.probabilityBps / 10000;
              const len = frac * C;
              const gap = 3;
              const dash = `${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}`;
              const el = (
                <Circle
                  key={row.rarity}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={r}
                  stroke={RARITY[row.rarity].color}
                  strokeWidth={active === row.rarity ? STROKE + 4 : STROKE}
                  fill="none"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  opacity={active && active !== row.rarity ? 0.4 : 1}
                />
              );
              offset += len;
              return el;
            })}
          </Svg>
          <View style={s.wheelCenter}>
            {activeRow ? (
              <>
                <Text style={[s.centerRarity, { color: RARITY[activeRow.rarity].color }]}>{RARITY[activeRow.rarity].label}</Text>
                <Text style={s.centerPct}>{activeRow.probabilityPct}</Text>
              </>
            ) : null}
          </View>
        </View>

        <View style={s.tiers}>
          {rows.map((row) => (
            <PressScale key={row.rarity} to={0.98} onPress={() => setSel(row.rarity)} style={[s.tier, active === row.rarity && { backgroundColor: colors.bgRaised2 }]}>
              <View style={[s.tierBar, { backgroundColor: RARITY[row.rarity].color }]} />
              <Text style={[s.tierLabel, { color: RARITY[row.rarity].color }]}>{RARITY[row.rarity].label}</Text>
              <Text style={s.tierPct}>{row.probabilityPct}</Text>
            </PressScale>
          ))}
        </View>

        <View style={s.rangeRow}>
          <Text style={s.rangeLabel}>Payout range</Text>
          <Text style={s.rangeVal}>
            {usd(solToUsd(pack.minReturnSol, solUsd), 0)} – {usd(solToUsd(pack.maxPayoutSol, solUsd), 0)}
          </Text>
        </View>

        <Text style={s.note}>
          {pack.label} contains {pack.cardsPerOpen} collectible {pack.cardsPerOpen === 1 ? 'card' : 'cards'} + memecoin based on the
          rarities above. The value of the coins you get may change from the estimate at opening. No purchase necessary. See Official Rules.
        </Text>
      </ScrollView>
    </DragSheet>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 14, alignItems: 'center' },
  title: { color: colors.fg, fontSize: 20, fontWeight: '800' },
  wheelWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  wheelCenter: { position: 'absolute', alignItems: 'center' },
  centerRarity: { fontSize: 24, fontWeight: '800' },
  centerPct: { color: colors.fg, fontSize: 30, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  tiers: { alignSelf: 'stretch', marginTop: 22, gap: 2 },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 10, borderRadius: radius.md },
  tierBar: { width: 3, height: 20, borderRadius: 2 },
  tierLabel: { fontSize: 15, fontWeight: '700', flex: 1 },
  tierPct: { color: colors.fg, fontSize: 15, fontWeight: '800' },
  rangeRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  rangeLabel: { color: colors.fgMuted, fontSize: 14 },
  rangeVal: { color: colors.fg, fontSize: 15, fontWeight: '800' },
  note: { color: colors.fgMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 18 },
});
