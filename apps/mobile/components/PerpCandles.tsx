import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../src/theme';
import { usd } from '../src/format';

/**
 * Candlestick chart for a perp market — FOMO-style green/red candles with a dotted
 * current-price line, a green price tag on the right, and a price axis. The bars
 * are deterministically generated from the coin seed around the live `mark`, so
 * they don't flicker between renders (there's no perp OHLC endpoint yet; this is
 * the demo-grade visual, mirroring the spot chart's fallback curve).
 */
function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export type Candle = { o: number; h: number; l: number; c: number };

export function buildCandles(coin: string, mark: number, n = 44): Candle[] {
  const rng = seeded(coin);
  const vol = mark * 0.006; // per-bar amplitude ~0.6%
  const out: Candle[] = [];
  let price = mark * (1 - (rng() * 0.014 + 0.004)); // start a touch below current
  for (let i = 0; i < n; i++) {
    const drift = (mark - price) * 0.06; // gently pull toward the live mark
    const o = price;
    const move = (rng() - 0.5) * 2 * vol + drift;
    let c = o + move;
    const wick = vol * (0.4 + rng());
    const h = Math.max(o, c) + wick * rng();
    const l = Math.min(o, c) - wick * rng();
    out.push({ o, h, l, c });
    price = c;
  }
  // Land the last close exactly on the live mark so the tag reads true.
  if (out.length) out[out.length - 1].c = mark;
  return out;
}

export function PerpCandles({
  coin,
  mark,
  height = 210,
  axis = true,
}: {
  coin: string;
  mark: number;
  height?: number;
  axis?: boolean;
}) {
  const W = 360;
  const H = height;
  const padR = axis ? 66 : 8;
  const plotW = W - padR - 4;
  const candles = React.useMemo(() => buildCandles(coin, mark), [coin, mark]);

  let hi = -Infinity;
  let lo = Infinity;
  for (const k of candles) {
    if (k.h > hi) hi = k.h;
    if (k.l < lo) lo = k.l;
  }
  const range = hi - lo || 1;
  const top = 10;
  const bot = H - 22;
  const y = (p: number) => bot - ((p - lo) / range) * (bot - top);

  const slot = plotW / candles.length;
  const bw = Math.max(2.5, slot * 0.62);

  // 5 price gridlines/labels
  const ticks = axis ? Array.from({ length: 5 }, (_, i) => lo + (range * (i + 0.5)) / 5) : [];
  const markY = y(mark);

  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {ticks.map((t, i) => (
          <Line key={`g${i}`} x1={4} y1={y(t)} x2={plotW} y2={y(t)} stroke={colors.border} strokeWidth={0.6} />
        ))}
        {candles.map((k, i) => {
          const cx = 4 + i * slot + slot / 2;
          const up = k.c >= k.o;
          const col = up ? colors.bull : colors.bear;
          const yO = y(k.o);
          const yC = y(k.c);
          const bodyTop = Math.min(yO, yC);
          const bodyH = Math.max(1.4, Math.abs(yC - yO));
          return (
            <React.Fragment key={i}>
              <Line x1={cx} y1={y(k.h)} x2={cx} y2={y(k.l)} stroke={col} strokeWidth={1} />
              <Rect x={cx - bw / 2} y={bodyTop} width={bw} height={bodyH} fill={col} rx={0.5} />
            </React.Fragment>
          );
        })}
        {/* dotted current-price line */}
        <Line x1={4} y1={markY} x2={plotW} y2={markY} stroke={colors.bull} strokeWidth={1} strokeDasharray="4 4" opacity={0.85} />
        {axis
          ? ticks.map((t, i) => (
              <SvgText key={`t${i}`} x={W - 6} y={y(t) + 3.5} fontSize={10.5} fill={colors.fgMuted} textAnchor="end">
                {usd(t, t >= 1000 ? 2 : 4)}
              </SvgText>
            ))
          : null}
        {/* live price tag */}
        {axis ? (
          <>
            <Rect x={W - padR + 2} y={markY - 9} width={padR - 6} height={18} rx={3} fill={colors.bull} />
            <SvgText x={W - 6} y={markY + 3.5} fontSize={10.5} fontWeight="bold" fill="#04120C" textAnchor="end">
              {usd(mark, mark >= 1000 ? 2 : 4)}
            </SvgText>
          </>
        ) : null}
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({});
