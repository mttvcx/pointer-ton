import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { CoinIcon } from './CoinIcon';
import { HlBadge } from './HlBadge';
import { PerpsExplainer } from './PerpsExplainer';
import { PerpDetailSheet } from './PerpDetailSheet';
import { PressScale } from './PressScale';
import { GlassFill } from './GlassFill';
import { getPerpMarkets } from '../src/api/endpoints';
import { API_URL } from '../src/env';
import { colors, radius } from '../src/theme';
import type { PerpMarket } from '../src/types';

// Vol-sorted server-side; cap the long tail (the tradeable markets live up top).
const MAX_ROWS = 50;

function perpPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  const dec = n >= 1 ? 2 : n >= 0.01 ? 4 : 6;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}

function perpVol(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/** Coin logo for a perp. The web only ships real icons for the majors; everything
 * else falls back to a colored initial (the HL badge tells you the venue). */
function iconUriFor(m: PerpMarket): string | null {
  return /\.png$/i.test(m.iconSrc) ? `${API_URL}${m.iconSrc}` : null;
}

/**
 * Hyperliquid perps board for mobile — consumes the existing `/api/perps/markets`
 * (real HL data), so it's never hand-faked. Read-only, matching web's Preview
 * state: order signing isn't shipped, so rows show market data, not a trade panel.
 */
export function PerpsList() {
  const [explain, setExplain] = useState(false);
  const [selected, setSelected] = useState<PerpMarket | null>(null);
  const q = useQuery({
    queryKey: ['perp-markets'],
    queryFn: getPerpMarkets,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const markets = (q.data ?? []).slice(0, MAX_ROWS);

  return (
    <View style={s.wrap}>
      <View style={s.banner}>
        <GlassFill />
        <Ionicons name="trending-up" size={22} color={colors.bull} />
        <View style={{ flex: 1 }}>
          <Text style={s.bannerTitle}>Go long or short</Text>
          <Text style={s.bannerSub}>Trade crypto, stocks, and commodities with up to 50x leverage.</Text>
        </View>
        <PressScale onPress={() => setExplain(true)} to={0.85} hitSlop={10}>
          <Ionicons name="information-circle-outline" size={22} color={colors.fgMuted} />
        </PressScale>
      </View>

      <PerpsExplainer visible={explain} onClose={() => setExplain(false)} />

      {q.isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : q.isError ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>Couldn't reach Hyperliquid.</Text>
          <Text style={s.emptySub}>Pull down to retry.</Text>
        </View>
      ) : markets.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>No perp markets right now.</Text>
        </View>
      ) : (
        markets.map((m) => <Row key={m.id} m={m} onOpen={() => setSelected(m)} />)
      )}

      <PerpDetailSheet market={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

function Row({ m, onOpen }: { m: PerpMarket; onOpen: () => void }) {
  const up = m.chg24 >= 0;
  return (
    <PressScale onPress={onOpen} to={0.985} style={s.row}>
      <View style={s.rowLeft}>
        <View style={s.iconWrap}>
          <CoinIcon uri={iconUriFor(m)} symbol={m.coin} size={40} />
          <View style={s.hlBadge}>
            <HlBadge size={15} />
          </View>
        </View>
        <View style={s.rowText}>
          <View style={s.coinLine}>
            <Text style={s.coin} numberOfLines={1}>
              {m.coin}
            </Text>
            <View style={s.lev}>
              <Text style={s.levText}>{m.maxLeverage}x</Text>
            </View>
          </View>
          <Text style={s.vol}>{perpVol(m.vol24Usd)} Vol</Text>
        </View>
      </View>
      <View style={s.rowRight}>
        <Text style={s.price}>{perpPrice(m.mark)}</Text>
        <Text style={[s.chg, { color: up ? colors.bull : colors.bear }]}>
          {up ? '▲' : '▼'} {Math.abs(m.chg24).toFixed(2)}%
        </Text>
      </View>
    </PressScale>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', marginBottom: 6 },
  bannerTitle: { color: colors.fg, fontSize: 17, fontWeight: '700' },
  bannerSub: { color: colors.fgSecondary, fontSize: 13.5, lineHeight: 19, marginTop: 3 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 13, flex: 1 },
  iconWrap: { width: 40, height: 40 },
  hlBadge: { position: 'absolute', right: -3, bottom: -3 },
  rowText: { flex: 1 },
  coinLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coin: { color: colors.fg, fontSize: 18, fontWeight: '700', flexShrink: 1 },
  lev: { backgroundColor: colors.accentSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  levText: { color: colors.accentGlow, fontSize: 11, fontWeight: '700' },
  vol: { color: colors.fgMuted, fontSize: 14, marginTop: 3 },
  rowRight: { alignItems: 'flex-end' },
  price: { color: colors.fg, fontSize: 17, fontWeight: '600' },
  chg: { fontSize: 14, marginTop: 3, fontWeight: '500' },

  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: colors.fgSecondary, fontSize: 15, fontWeight: '600' },
  emptySub: { color: colors.fgMuted, fontSize: 13, marginTop: 4 },
});
