import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DragSheet } from './DragSheet';
import { CoinIcon } from './CoinIcon';
import { PressScale } from './PressScale';
import { Logo } from './Logo';
import { colors, radius } from '../src/theme';
import { compactUsd } from '../src/format';
import { shareText } from '../src/share';
import { copyText } from '../src/clipboard';
import { showToast } from '../src/toast';
import { randomPhrase } from '../src/sharePhrases';

/**
 * Pointer PnL "Share position" card. Custom (NOT a FOMO clone): the color comes
 * from the big mint number + a soft glow, not a hard accent frame or bottom banner.
 * Faint Pointer bird watermark, `pointer.trade` footer with the sharer's referral
 * code (our 50% offer). No chart, no date, no attribution — just a random
 * celebration line. Works for any position (token / trader / weekly / holder).
 */
const DEMO_REF_CODE = 'BullishBarnacle';

function money(n: number): string {
  const neg = n < 0;
  const [i, f] = Math.abs(n).toFixed(2).split('.');
  return `${neg ? '-' : '+'}$${i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${f}`;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function PnlShareCard({
  visible,
  onClose,
  symbol,
  name,
  image,
  pnlUsd,
  pnlPct,
  investedUsd,
  refCode = DEMO_REF_CODE,
}: {
  visible: boolean;
  onClose: () => void;
  symbol: string;
  name?: string | null;
  image?: string | null;
  pnlUsd: number;
  pnlPct: number;
  investedUsd: number;
  refCode?: string;
}) {
  const sym = symbol.replace(/^\$/, '');
  const { phrase, entry, current } = useMemo(() => {
    const s = hash(`${sym}-${pnlUsd | 0}`);
    const currentMc = 300_000 + (s % 1000) * 200_000;
    return {
      phrase: randomPhrase(),
      entry: compactUsd(currentMc / (1 + Math.max(0, pnlPct) / 100)),
      current: compactUsd(currentMc),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sym]);

  const up = pnlUsd >= 0;
  const tone = up ? colors.bull : colors.bear;
  const shareMsg = `${money(pnlUsd)} on $${sym} with Pointer. 50% off fees with my code ${refCode}.`;

  const onShare = () => void shareText(shareMsg);
  const onCopy = async () => {
    const ok = await copyText(shareMsg);
    showToast(ok ? 'Copied to clipboard' : 'Copy failed', { kind: ok ? 'success' : 'error' });
  };

  return (
    <DragSheet visible={visible} onClose={onClose}>
      <Text style={s.title}>Share position</Text>

      <View style={s.card}>
        <LinearGradient colors={['#0C0E12', '#000000']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* Faint Pointer bird watermark */}
        <Logo size={150} style={s.watermark} />

        <View style={s.head}>
          <CoinIcon uri={image} symbol={sym} size={46} />
          <View style={{ flex: 1 }}>
            <Text style={s.sym} numberOfLines={1}>
              ${sym}
            </Text>
            {name ? (
              <Text style={s.name} numberOfLines={1}>
                {name}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={s.hero}>
          <View style={[s.glow, { backgroundColor: tone }]} />
          <Text style={s.phrase} numberOfLines={2}>
            {phrase}
          </Text>
          <Text style={[s.pnl, { color: tone }]}>{money(pnlUsd)}</Text>
          <Text style={[s.pct, { color: tone }]}>
            {up ? '▲' : '▼'} {Math.abs(pnlPct).toFixed(2)}%
          </Text>
        </View>

        <View style={s.stats}>
          <Stat label="Invested" value={compactUsd(investedUsd)} />
          <View style={s.statDivider} />
          <Stat label="Entry" value={entry} />
          <View style={s.statDivider} />
          <Stat label="Current" value={current} />
        </View>

        <View style={s.cardFooter}>
          <View style={s.brandRow}>
            <Logo size={20} />
            <Text style={s.brand}>pointer.trade</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.offer}>50% off fees with code</Text>
            <Text style={s.code}>{refCode}</Text>
          </View>
        </View>
      </View>

      <View style={s.actions}>
        <PressScale style={s.action} onPress={onCopy} to={0.96}>
          <Ionicons name="copy-outline" size={18} color={colors.fg} />
          <Text style={s.actionText}>Copy</Text>
        </PressScale>
        <PressScale style={s.action} onPress={onShare} to={0.96}>
          <Ionicons name="share-outline" size={18} color={colors.fg} />
          <Text style={s.actionText}>Share</Text>
        </PressScale>
      </View>
    </DragSheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  title: { color: colors.fg, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 16 },

  card: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: '#000' },
  watermark: { position: 'absolute', right: -34, bottom: 46, opacity: 0.05, tintColor: '#fff' },

  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 18 },
  sym: { color: colors.fg, fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  name: { color: colors.fgMuted, fontSize: 14, marginTop: 1 },

  hero: { alignItems: 'center', paddingTop: 22, paddingBottom: 20, paddingHorizontal: 16 },
  glow: { position: 'absolute', top: 34, width: 300, height: 120, borderRadius: 150, opacity: 0.12 },
  phrase: { color: colors.fgSecondary, fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  pnl: { fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  pct: { fontSize: 16, fontWeight: '700', marginTop: 4 },

  stats: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 18, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, paddingBottom: 4 },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statLabel: { color: colors.fgMuted, fontSize: 12 },
  statValue: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { color: colors.fg, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  offer: { color: colors.fgMuted, fontSize: 11 },
  code: { color: colors.accentGlow, fontSize: 14, fontWeight: '800', marginTop: 1 },

  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.bgRaised, borderRadius: 14, paddingVertical: 15, borderWidth: 1, borderColor: colors.border },
  actionText: { color: colors.fg, fontSize: 16, fontWeight: '700' },
});
