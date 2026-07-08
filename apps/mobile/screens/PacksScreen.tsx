import React, { useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '../components/Screen';
import { Logo } from '../components/Logo';
import { PressScale } from '../components/PressScale';
import { GlassFill } from '../components/GlassFill';
import { CardShine } from '../components/CardShine';
import { colors, radius } from '../src/theme';
import { usd } from '../src/format';
import { showToast } from '../src/toast';
import { useCashBalance } from '../src/account';
import { usePacks, solToUsd, foilFor, RARITY, type Pack } from '../src/packs/api';
import { usePulls } from '../src/packs/collection';
import { PackOddsSheet } from '../components/PackOddsSheet';
import { PackRevealSheet } from '../components/PackRevealSheet';

const W = Dimensions.get('window').width;
const PACK_W = Math.min(300, W - 90); // leaves side peeks of neighbours

export function PacksScreen() {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'packs' | 'collection'>('packs');
  const q = usePacks();
  const cash = useCashBalance();
  const [idx, setIdx] = useState(0);
  const [oddsFor, setOddsFor] = useState<Pack | null>(null);
  const [openFor, setOpenFor] = useState<Pack | null>(null);

  const packs = (q.data?.packs ?? []).filter((p) => p.enabled !== false);
  const solUsd = q.data?.solUsd ?? 0;
  const active = packs[idx] ?? null;
  const cashUsd = cash.data ?? 0;

  return (
    <Screen>
      <View style={[s.headerWrap, { paddingTop: insets.top + 10 }]}>
        <View style={s.toggle}>
          {(['packs', 'collection'] as const).map((v) => (
            <PressScale key={v} to={0.97} onPress={() => setView(v)} style={s.toggleBtn}>
              <Ionicons name={v === 'packs' ? 'ticket-outline' : 'grid-outline'} size={16} color={view === v ? colors.fg : colors.fgMuted} />
              <Text style={[s.toggleText, view === v && s.toggleTextOn]}>{v === 'packs' ? 'Packs' : 'Collection'}</Text>
            </PressScale>
          ))}
        </View>
      </View>

      {q.isLoading ? (
        <View style={s.loading}><ActivityIndicator color={colors.accent} /></View>
      ) : view === 'collection' ? (
        <CollectionView bottomPad={insets.bottom + 110} />
      ) : packs.length === 0 ? (
        <View style={s.loading}><Text style={s.emptyText}>No packs available right now.</Text></View>
      ) : (
        <>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={PACK_W}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: (W - PACK_W) / 2 }}
            onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / PACK_W))}
            style={s.carousel}
          >
            {packs.map((p) => (
              <View key={p.type} style={{ width: PACK_W, alignItems: 'center', justifyContent: 'center' }}>
                <FoilPack pack={p} />
              </View>
            ))}
          </ScrollView>

          {active ? (
            <View style={[s.info, { paddingBottom: insets.bottom + 100 }]}>
              <Text style={s.kicker}>{active.tagline || 'Memecoin'}</Text>
              <Text style={s.name}>{active.label}</Text>

              <View style={s.stats}>
                <Stat label="Min" value={usd(solToUsd(active.minReturnSol, solUsd), 0)} />
                <View style={s.statDiv} />
                <Stat label="Max" value={usd(solToUsd(active.maxPayoutSol, solUsd), 0)} big />
                <View style={s.statDiv} />
                <Stat label="Rarities" value={String(active.odds.length)} />
              </View>

              <View style={s.chips}>
                <PressScale to={0.96} onPress={() => setOddsFor(active)} style={s.chip}>
                  <GlassFill />
                  <Ionicons name="sparkles-outline" size={15} color={colors.fgSecondary} />
                  <Text style={s.chipText}>What’s inside?</Text>
                </PressScale>
                <View style={s.chip}>
                  <GlassFill />
                  <Ionicons name="cash-outline" size={15} color={colors.fgSecondary} />
                  <Text style={s.chipText}>Cash: {usd(cashUsd)}</Text>
                </View>
              </View>

              <PressScale to={0.98} onPress={() => setOpenFor(active)} style={s.buy}>
                <LinearGradient colors={[colors.accentGlow, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
                <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.buySheen} pointerEvents="none" />
                <Text style={s.buyText}>Buy for {usd(solToUsd(active.packPriceSol, solUsd), 0)}</Text>
              </PressScale>

              <PressScale to={0.99} onPress={() => showToast('Official Rules & odds are on the web', { kind: 'info' })}>
                <Text style={s.rules}>No purchase necessary. See <Text style={s.rulesLink}>Official Rules</Text>.</Text>
              </PressScale>
            </View>
          ) : null}
        </>
      )}

      <PackOddsSheet pack={oddsFor} solUsd={solUsd} onClose={() => setOddsFor(null)} />
      <PackRevealSheet pack={openFor} onClose={() => setOpenFor(null)} />
    </Screen>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statVal, big && s.statValBig]}>{value}</Text>
    </View>
  );
}

/** The pack itself — a foil wrapper (we have no pack art, so the foil IS the art). */
function FoilPack({ pack }: { pack: Pack }) {
  const foil = foilFor(pack.type);
  return (
    <View style={s.pack}>
      <LinearGradient colors={foil} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.28)', 'rgba(0,0,0,0.08)']}
        locations={[0, 0.4, 0.68, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <CardShine intensity={0.55} period={2600} />
      <View style={s.packEdge} pointerEvents="none" />
      <View style={s.packCrimp} pointerEvents="none" />
      <View style={s.packBody}>
        <Logo size={30} style={{ tintColor: 'rgba(10,12,16,0.85)' }} />
        <Text style={s.packLabel}>{pack.label}</Text>
        <Text style={s.packBrand}>pointer.</Text>
      </View>
    </View>
  );
}

function CollectionView({ bottomPad }: { bottomPad: number }) {
  const pulls = usePulls();
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: bottomPad, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
      <Text style={s.colHead}>Your pulls · {pulls.length}</Text>
      {pulls.length === 0 ? (
        <View style={s.colEmpty}>
          <Ionicons name="albums-outline" size={30} color={colors.fgMuted} />
          <Text style={s.colEmptyText}>No cards yet</Text>
          <Text style={s.colEmptySub}>Open a pack to start your collection.</Text>
        </View>
      ) : (
        pulls.map((r, i) => {
          const rar = RARITY[r.rarity];
          return (
            <View key={`${r.id}-${i}`} style={s.colRow}>
              <View style={[s.colBar, { backgroundColor: rar.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.colTitle} numberOfLines={1}>{r.title}</Text>
                <Text style={[s.colRar, { color: rar.color }]}>{rar.label}</Text>
              </View>
              <Text style={s.colVal}>{r.displayValue}</Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  headerWrap: { paddingHorizontal: 18, paddingBottom: 6, alignItems: 'center' },
  toggle: { flexDirection: 'row', gap: 6, backgroundColor: colors.bgRaised2, borderRadius: radius.pill, padding: 4 },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill },
  toggleText: { color: colors.fgMuted, fontSize: 14.5, fontWeight: '700' },
  toggleTextOn: { color: colors.fg },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.fgMuted, fontSize: 15 },

  carousel: { flexGrow: 0, marginTop: 10 },
  pack: { width: PACK_W - 26, aspectRatio: 0.72, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 22, shadowOffset: { width: 0, height: 14 } },
  packEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.65)' },
  packCrimp: { position: 'absolute', top: 16, left: 0, right: 0, height: 1, backgroundColor: 'rgba(0,0,0,0.12)' },
  packBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18 },
  packLabel: { color: '#0A0C10', fontSize: 24, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  packBrand: { color: 'rgba(10,12,16,0.6)', fontSize: 13, fontWeight: '800' },

  info: { paddingHorizontal: 24, alignItems: 'center', marginTop: 14 },
  kicker: { color: colors.fgMuted, fontSize: 14, fontWeight: '600' },
  name: { color: colors.fg, fontSize: 30, fontWeight: '800', letterSpacing: -0.6, marginTop: 4 },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 14 },
  stat: { alignItems: 'center' },
  statDiv: { width: 1, height: 34, backgroundColor: colors.border },
  statLabel: { color: colors.fgMuted, fontSize: 13 },
  statVal: { color: colors.fg, fontSize: 20, fontWeight: '800', marginTop: 3 },
  statValBig: { fontSize: 26 },
  chips: { flexDirection: 'row', gap: 12, marginTop: 22 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 11, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  chipText: { color: colors.fgSecondary, fontSize: 14, fontWeight: '600' },
  buy: { alignSelf: 'stretch', alignItems: 'center', borderRadius: 16, paddingVertical: 17, marginTop: 26, overflow: 'hidden', shadowColor: colors.accent, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  buySheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '60%' },
  buyText: { color: colors.onAccent, fontSize: 17, fontWeight: '800' },
  rules: { color: colors.fgFaint, fontSize: 12.5, textAlign: 'center', marginTop: 16 },
  rulesLink: { color: colors.fgMuted, textDecorationLine: 'underline' },

  colHead: { color: colors.fg, fontSize: 16, fontWeight: '800', marginBottom: 12 },
  colEmpty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  colEmptyText: { color: colors.fgSecondary, fontSize: 16, fontWeight: '700', marginTop: 6 },
  colEmptySub: { color: colors.fgMuted, fontSize: 13.5 },
  colRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, backgroundColor: colors.bgRaised2, padding: 13, marginBottom: 8, overflow: 'hidden' },
  colBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  colTitle: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  colRar: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  colVal: { color: colors.fg, fontSize: 15, fontWeight: '800' },
});
