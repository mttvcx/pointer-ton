import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DragSheet } from './DragSheet';
import { PressScale } from './PressScale';
import { GlassFill } from './GlassFill';
import { colors, radius } from '../src/theme';
import { usd } from '../src/format';
import { showToast } from '../src/toast';
import { copyText } from '../src/clipboard';
import { openPackSimulated, RARITY, type Pack, type PackOpenResult, type PackReward } from '../src/packs/api';
import { packArtFor } from '../src/packs/packArt';
import { addPulls } from '../src/packs/collection';

type Phase = 'opening' | 'revealed' | 'error';

/**
 * Open a pack and reveal what's inside. Anonymous opens are SIMULATED (no charge)
 * — shown honestly with a "Demo open" badge — and every open carries its provable-
 * fairness proof (server-seed hash + client seed + nonce). Real odds, real reveal.
 */
export function PackRevealSheet({ pack, onClose }: { pack: Pack | null; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('opening');
  const [res, setRes] = useState<PackOpenResult | null>(null);
  const [ledger, setLedger] = useState<'live' | 'simulated'>('simulated');
  const [showFair, setShowFair] = useState(false);

  // suspense → burst
  const shake = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!pack) return;
    setPhase('opening');
    setRes(null);
    setShowFair(false);
    // shake the pack while the roll resolves
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 90, useNativeDriver: true }),
      ]),
    );
    loop.start();

    let alive = true;
    const started = Date.now();
    openPackSimulated(pack.type)
      .then((r) => {
        if (!alive) return;
        // let the suspense breathe ~1.1s minimum
        const wait = Math.max(0, 1100 - (Date.now() - started));
        setTimeout(() => {
          if (!alive) return;
          loop.stop();
          setRes(r.result);
          setLedger(r.ledger);
          addPulls(r.result.rewards);
          setPhase('revealed');
          pop.setValue(0.6);
          Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 10 }).start();
        }, wait);
      })
      .catch(() => {
        if (!alive) return;
        loop.stop();
        setPhase('error');
      });
    return () => {
      alive = false;
      loop.stop();
    };
  }, [pack]);

  if (!pack) return null;

  const art = packArtFor(pack.type);
  const highlight = res ? RARITY[res.highlightRarity] : RARITY.rare;
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] });

  const close = () => {
    setShowFair(false);
    onClose();
  };

  return (
    <DragSheet visible={pack !== null} onClose={close} fullDrag>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {phase === 'opening' ? (
          <View style={s.center}>
            <Animated.View style={[s.miniPack, { transform: [{ translateX: shakeX }] }]}>
              <View style={s.miniPackInner}>
                <Image source={art.image} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
              </View>
            </Animated.View>
            <Text style={s.opening}>Opening {pack.label}…</Text>
            <ActivityIndicator color={colors.accent} style={{ marginTop: 14 }} />
          </View>
        ) : phase === 'error' ? (
          <View style={s.center}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.warn} />
            <Text style={s.opening}>Couldn’t open that pack</Text>
            <PressScale onPress={close} style={s.secondaryBtn}><Text style={s.secondaryText}>Close</Text></PressScale>
          </View>
        ) : res ? (
          <Animated.View style={{ transform: [{ scale: pop }] }}>
            {ledger === 'simulated' ? (
              <View style={s.demoBadge}>
                <Ionicons name="flask-outline" size={12} color={colors.fgSecondary} />
                <Text style={s.demoText}>Demo open · no charge</Text>
              </View>
            ) : null}

            {/* headline reward */}
            <View style={[s.hero, { borderColor: highlight.color + '55' }]}>
              <View style={[s.heroGlow, { backgroundColor: highlight.color + '18' }]} />
              <Text style={[s.heroRarity, { color: highlight.color }]}>{highlight.label.toUpperCase()}</Text>
              {res.isJackpotPull ? <Text style={s.jackpot}>JACKPOT 🚁</Text> : null}
              <Text style={s.heroValue}>{res.approximateUsd != null ? usd(res.approximateUsd) : usd((res.totalTokenValueSol ?? 0) * (res.solUsd ?? 0))}</Text>
              <Text style={s.heroSub}>total value pulled</Text>
            </View>

            {/* each reward */}
            <View style={s.rewards}>
              {res.rewards.map((r) => (
                <RewardRow key={r.id} r={r} />
              ))}
            </View>

            {/* provable fairness */}
            {res.fairness ? (
              <>
                <PressScale to={0.98} onPress={() => setShowFair((v) => !v)} style={s.fairRow}>
                  <Ionicons name="shield-checkmark-outline" size={15} color={colors.bull} />
                  <Text style={s.fairText}>Provably fair</Text>
                  <Ionicons name={showFair ? 'chevron-up' : 'chevron-down'} size={14} color={colors.fgMuted} />
                </PressScale>
                {showFair ? (
                  <View style={s.fairBox}>
                    <FairLine label="Server seed hash" value={res.fairness.serverSeedHash} />
                    <FairLine label="Client seed" value={res.fairness.clientSeed} />
                    <FairLine label="Nonce" value={res.fairness.nonce != null ? String(res.fairness.nonce) : undefined} />
                    {res.fairness.serverSeed ? <FairLine label="Server seed" value={res.fairness.serverSeed} /> : null}
                  </View>
                ) : null}
              </>
            ) : null}

            <PressScale onPress={close} style={s.doneBtn}>
              <GlassFill />
              <Text style={s.doneText}>Done</Text>
            </PressScale>
            <Text style={s.foot}>Values are estimates and can change at delivery. No purchase necessary. See Official Rules.</Text>
          </Animated.View>
        ) : null}
      </ScrollView>
    </DragSheet>
  );
}

function RewardRow({ r }: { r: PackReward }) {
  const rar = RARITY[r.rarity];
  return (
    <View style={s.reward}>
      <View style={[s.rewardBar, { backgroundColor: rar.color }]} />
      <View style={{ flex: 1 }}>
        <View style={s.rewardTop}>
          <Text style={s.rewardTitle} numberOfLines={1}>{r.title}</Text>
          <Text style={[s.rewardRar, { color: rar.color }]}>{rar.label}</Text>
        </View>
        <Text style={s.rewardSub} numberOfLines={1}>{r.subtitle}</Text>
      </View>
      <Text style={s.rewardVal}>{r.displayValue}</Text>
    </View>
  );
}

function FairLine({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  const short = value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
  return (
    <PressScale to={0.99} onPress={() => copyText(value).then((ok) => ok && showToast(`${label} copied`, { kind: 'success' }))} style={s.fairLine}>
      <Text style={s.fairLabel}>{label}</Text>
      <Text style={s.fairValue}>{short}</Text>
    </PressScale>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 14, paddingTop: 4 },
  center: { alignItems: 'center', paddingVertical: 30 },
  miniPack: { width: 124, height: Math.round((124 * 1200) / 685) },
  miniPackInner: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  miniPackEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.6)' },
  opening: { color: colors.fg, fontSize: 17, fontWeight: '700', marginTop: 20 },

  demoBadge: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, backgroundColor: colors.bgRaised2, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5, marginBottom: 14 },
  demoText: { color: colors.fgSecondary, fontSize: 12, fontWeight: '600' },

  hero: { alignItems: 'center', borderRadius: radius.lg, borderWidth: 1.5, paddingVertical: 26, overflow: 'hidden' },
  heroGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroRarity: { fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },
  jackpot: { color: colors.warn, fontSize: 13, fontWeight: '800', marginTop: 4 },
  heroValue: { color: colors.fg, fontSize: 40, fontWeight: '800', letterSpacing: -1, marginTop: 8 },
  heroSub: { color: colors.fgMuted, fontSize: 13, marginTop: 2 },

  rewards: { marginTop: 16, gap: 8 },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: radius.md, backgroundColor: colors.bgRaised2, padding: 12, overflow: 'hidden' },
  rewardBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  rewardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rewardTitle: { color: colors.fg, fontSize: 14.5, fontWeight: '700', flex: 1 },
  rewardRar: { fontSize: 11, fontWeight: '800', marginLeft: 8 },
  rewardSub: { color: colors.fgMuted, fontSize: 12, marginTop: 1 },
  rewardVal: { color: colors.fg, fontSize: 14, fontWeight: '800' },

  fairRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 18 },
  fairText: { color: colors.fgSecondary, fontSize: 13, fontWeight: '700' },
  fairBox: { borderRadius: radius.md, backgroundColor: colors.bgRaised2, padding: 12, marginTop: 10 },
  fairLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 },
  fairLabel: { color: colors.fgMuted, fontSize: 12.5 },
  fairValue: { color: colors.fgSecondary, fontSize: 12.5, fontWeight: '600' },

  doneBtn: { alignItems: 'center', borderRadius: 14, paddingVertical: 15, marginTop: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  doneText: { color: colors.fg, fontSize: 16, fontWeight: '700' },
  secondaryBtn: { marginTop: 18, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  secondaryText: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  foot: { color: colors.fgFaint, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 14 },
});
