import React, { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { getTokenChart } from '../src/api/endpoints';
import { colors } from '../src/theme';
import type { ChartBar } from '../src/types';

// Map the token screen's range chips to a bar interval the API accepts.
const UI_TO_INTERVAL: Record<string, string> = {
  '1H': '1m',
  '4H': '5m',
  '1D': '15m',
  '7D': '1h',
  '1M': '1d',
  ALL: '1d',
};
const H = 150;

/**
 * Real OHLC candlestick chart (`/api/tokens/:mint/chart`). Measures its own width
 * so candles aren't stretched. Shows `fallback` (the demo curve) while loading or
 * when the feed has no bars — e.g. the fake demo mints in Expo Go.
 */
export function TokenChart({ mint, tf, fallback, style }: { mint: string; tf: string; fallback: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const [w, setW] = useState(0);
  const interval = UI_TO_INTERVAL[tf] ?? '5m';
  const q = useQuery({
    queryKey: ['token-chart', mint, interval],
    queryFn: () => getTokenChart(mint, interval),
    staleTime: 15_000,
    refetchInterval: 25_000,
    retry: 1,
  });
  const bars = q.data ?? [];
  const ready = bars.length >= 2 && w >= 2;

  return (
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} style={[{ height: H }, style]}>
      {ready ? <Candles bars={bars} w={w} /> : <>{fallback}</>}
    </View>
  );
}

function Candles({ bars, w }: { bars: ChartBar[]; w: number }) {
  const lo = Math.min(...bars.map((b) => b.low));
  const hi = Math.max(...bars.map((b) => b.high));
  const span = hi - lo || 1;
  const pad = 6;
  const y = (p: number) => pad + (1 - (p - lo) / span) * (H - 2 * pad);
  const n = bars.length;
  const cw = w / n;
  const bw = Math.max(1.5, Math.min(cw * 0.62, 9));

  return (
    <Svg width={w} height={H}>
      {bars.map((b, i) => {
        const x = i * cw + cw / 2;
        const up = b.close >= b.open;
        const color = up ? colors.bull : colors.bear;
        const top = y(Math.max(b.open, b.close));
        const bot = y(Math.min(b.open, b.close));
        return (
          <React.Fragment key={i}>
            <Line x1={x} y1={y(b.high)} x2={x} y2={y(b.low)} stroke={color} strokeWidth={1} />
            <Rect x={x - bw / 2} y={top} width={bw} height={Math.max(1, bot - top)} rx={0.5} fill={color} />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
