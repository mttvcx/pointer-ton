import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { DragSheet } from './DragSheet';
import { CoinIcon } from './CoinIcon';
import { PressScale } from './PressScale';
import { GlassFill } from './GlassFill';
import { colors, radius } from '../src/theme';
import { compactUsd } from '../src/format';
import { shareText } from '../src/share';
import { copyText } from '../src/clipboard';
import { showToast } from '../src/toast';
import { randomPhrase } from '../src/sharePhrases';

/**
 * PnL "Share position" card — mint-framed, candlestick chart + entry markers,
 * mint footer banner (pointer.trade + the sharer's 50% referral code). Instead of
 * naming the trader it rotates a random celebration line. Works for any position
 * (token / trader / weekly / holder). Whole card is draggable (DragSheet fullDrag).
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

/** Deterministic candlestick series (green-leaning uptrend) with two entry markers. */
function CandleChart({ seed, up }: { seed: string; up: boolean }) {
  const W = 320;
  const H = 150;
  const N = 30;
  const slot = W / N;
  const { candles, marks } = useMemo(() => {
    let s = hash(seed);
    const rng = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    let v = up ? 0.3 + rng() * 0.1 : 0.62 + rng() * 0.1;
    const out: { x: number; o: number; c: number; hi: number; lo: number; up: boolean }[] = [];
    for (let i = 0; i < N; i++) {
      const o = v;
      const drift = up ? (rng() - 0.4) * 0.08 : (rng() - 0.6) * 0.08;
      v = Math.max(0.08, Math.min(0.92, v + drift));
      const c = v;
      const hi = Math.max(o, c) + rng() * 0.05;
      const lo = Math.min(o, c) - rng() * 0.05;
      const toY = (t: number) => H - t * (H - 16) - 8;
      out.push({ x: i * slot + slot / 2, o: toY(o), c: toY(c), hi: toY(hi), lo: toY(lo), up: c >= o });
    }
    const marks = [Math.floor(N * 0.28), Math.floor(N * 0.68)].map((i) => ({ x: out[i].x, y: Math.min(out[i].hi, out[i].c) - 13 }));
    return { candles: out, marks };
  }, [seed, up]);

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {candles.map((k, i) => {
        const col = k.up ? colors.bull : colors.bear;
        const bodyTop = Math.min(k.o, k.c);
        const bodyH = Math.max(2, Math.abs(k.c - k.o));
        return (
          <React.Fragment key={i}>
            <Line x1={k.x} y1={k.hi} x2={k.x} y2={k.lo} stroke={col} strokeWidth={1.3} />
            <Rect x={k.x - slot * 0.3} y={bodyTop} width={slot * 0.6} height={bodyH} rx={1} fill={col} />
          </React.Fragment>
        );
      })}
      {marks.map((m, i) => (
        <React.Fragment key={`m${i}`}>
          <Circle cx={m.x} cy={m.y} r={12} fill={colors.bull} />
          <SvgText x={m.x} y={m.y + 5} fontSize={16} fontWeight="bold" fill={colors.onAccent} textAnchor="middle">
            +
          </SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
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
    <DragSheet visible={visible} onClose={onClose} fullDrag>
      <Text style={s.title}>Share position</Text>

      <View style={s.card}>
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

        <CandleChart seed={sym} up={up} />

        <View style={s.panel}>
          <Text style={s.phrase} numberOfLines={2}>
            {phrase}
          </Text>
          <View style={s.pnlRow}>
            <Text style={[s.pnl, { color: tone }]}>{money(pnlUsd)}</Text>
            <Text style={[s.pct, { color: tone }]}>
              {' '}
              ({up ? '▲' : '▼'} {Math.abs(pnlPct).toFixed(2)}%)
            </Text>
          </View>
          <View style={s.stats}>
            <Stat label="Invested" value={compactUsd(investedUsd)} />
            <View style={s.statDivider} />
            <Stat label="Entry" value={entry} />
            <View style={s.statDivider} />
            <Stat label="Current" value={current} />
          </View>
        </View>

        <View style={s.footer}>
          <Text style={s.brand}>pointer.trade</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.offer}>50% off fees with code</Text>
            <Text style={s.code}>{refCode}</Text>
          </View>
        </View>
      </View>

      <View style={s.actions}>
        <PressScale style={s.action} onPress={onCopy} to={0.96}>
          <GlassFill />
          <Ionicons name="copy-outline" size={18} color={colors.fg} />
          <Text style={s.actionText}>Copy</Text>
        </PressScale>
        <PressScale style={s.action} onPress={onShare} to={0.96}>
          <GlassFill />
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

  card: { borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.accent, overflow: 'hidden', backgroundColor: colors.bgSunken },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  sym: { color: colors.fg, fontSize: 20, fontWeight: '800' },
  name: { color: colors.fgMuted, fontSize: 14, marginTop: 1 },

  panel: { backgroundColor: colors.bgRaised2, marginHorizontal: 12, borderRadius: radius.md, paddingVertical: 16, paddingHorizontal: 14, marginTop: 4 },
  phrase: { color: colors.fgSecondary, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  pnlRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' },
  pnl: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  pct: { fontSize: 15, fontWeight: '700' },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statLabel: { color: colors.fgMuted, fontSize: 12 },
  statValue: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  statDivider: { width: 1, height: 30, backgroundColor: colors.border },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 14, marginTop: 12 },
  brand: { color: colors.onAccent, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  offer: { color: colors.onAccent, fontSize: 12, opacity: 0.75 },
  code: { color: colors.onAccent, fontSize: 15, fontWeight: '800', marginTop: 1 },

  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 15, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  actionText: { color: colors.fg, fontSize: 16, fontWeight: '700' },
});
