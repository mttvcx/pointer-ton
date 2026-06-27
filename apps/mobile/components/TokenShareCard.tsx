import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { DragSheet } from '../components/DragSheet';
import { CoinIcon } from '../components/CoinIcon';
import { PressScale } from '../components/PressScale';
import { colors, radius } from '../src/theme';
import { compactUsd, priceUsd, shortMint } from '../src/format';
import { shareText } from '../src/share';
import { api } from '../src/api/client';
import type { PulseBundle } from '../src/types';

/**
 * FOMO-style TOKEN share card. Where FOMO shows a personal PnL card, this is a
 * "you should buy this token" card: the token, its MC + 24h vol, and a strip of
 * its most recent trades — centered on a bold accent gradient. The share icon
 * opens it; "Share" hands off to the native share sheet (text + Solscan link).
 *
 * Full image-capture share needs react-native-view-shot (a dev-build dep) so it
 * is intentionally NOT wired here — text/link share works in Expo Go today.
 */

/** Subset of the /api/tokens/{mint}/trades row the strip renders. */
type TradeLite = {
  side?: string | null;
  amount_token?: number | null;
  price_usd_at_fill?: number | null;
};
type TradesResponse = { trades?: TradeLite[] };

function formatTokenAmount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(0);
  return n.toPrecision(2);
}

export function TokenShareCard({
  visible,
  onClose,
  bundle,
  wallet,
}: {
  visible: boolean;
  onClose: () => void;
  bundle: PulseBundle;
  wallet?: string | null;
}) {
  const { token, snapshot } = bundle;
  const mint = token.mint;
  const sym = (token.symbol ?? shortMint(mint)).replace(/^\$/, '');
  const mc = compactUsd(snapshot?.market_cap_usd);
  const vol = compactUsd(snapshot?.volume_24h_usd);

  // Fetch the token's most-recent trades for the strip. Only while the sheet is
  // open; failures fall through to "no strip" (handled below).
  const trades = useQuery({
    queryKey: ['token-share-trades', mint],
    queryFn: async () => {
      const res = await api<TradesResponse>(`/api/tokens/${mint}/trades?limit=3`);
      return res.trades ?? [];
    },
    enabled: visible,
    staleTime: 30_000,
    retry: 1,
  });

  const top = (trades.data ?? []).slice(0, 3);
  const link = `https://solscan.io/token/${mint}`;

  const onShare = () => {
    const message = `$${sym} — ${mc} MC, ${vol} 24h vol. Aping on Pointer.`;
    void shareText(message, link);
  };

  return (
    <DragSheet visible={visible} onClose={onClose}>
      <View style={s.wrap}>
        <View style={s.card}>
          <LinearGradient
            colors={['#5B6EF5', '#3B45C9', '#0E1117']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.cardInner}>
            <View style={s.brandRow}>
              <View style={s.dot} />
              <Text style={s.brand}>POINTER</Text>
            </View>

            <CoinIcon uri={token.image_url} symbol={sym} size={72} verified={Boolean(token.launch_pad)} />

            <Text style={s.symbol} numberOfLines={1}>
              ${sym}
            </Text>
            <Text style={s.name} numberOfLines={1}>
              {token.name ?? shortMint(mint)}
            </Text>

            <Text style={s.headline} numberOfLines={1}>
              Aping ${sym} on Pointer
            </Text>

            <View style={s.metrics}>
              <View style={s.metric}>
                <Text style={s.metricValue}>{mc}</Text>
                <Text style={s.metricLabel}>Market cap</Text>
              </View>
              <View style={s.metricDivider} />
              <View style={s.metric}>
                <Text style={s.metricValue}>{vol}</Text>
                <Text style={s.metricLabel}>24h volume</Text>
              </View>
            </View>

            {trades.isLoading ? (
              <ActivityIndicator color={colors.accentGlow} style={{ marginTop: 16 }} />
            ) : top.length ? (
              <View style={s.tradesStrip}>
                <Text style={s.tradesTitle}>Top trades</Text>
                <View style={s.tradesRows}>
                  {top.map((t, i) => {
                    const buy = (t.side ?? '').toLowerCase() === 'buy';
                    return (
                      <View key={i} style={s.tradeRow}>
                        <Text style={[s.tradeSide, { color: buy ? colors.bull : colors.bear }]}>
                          {buy ? 'Buy' : 'Sell'}
                        </Text>
                        <Text style={s.tradeAmt}>
                          {formatTokenAmount(t.amount_token)} {sym}
                        </Text>
                        <Text style={s.tradePrice}>{priceUsd(t.price_usd_at_fill)}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        </View>

        <PressScale style={s.shareBtn} onPress={onShare}>
          <Ionicons name="share-social-outline" size={19} color="#fff" />
          <Text style={s.shareText}>Share</Text>
        </PressScale>

        <Text style={s.devNote}>Image card coming with the dev build.</Text>

        <PressScale style={s.closeBtn} onPress={onClose} to={0.94}>
          <Text style={s.closeText}>Close</Text>
        </PressScale>
      </View>
    </DragSheet>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center' },
  card: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  cardInner: { alignItems: 'center', paddingVertical: 26, paddingHorizontal: 22 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentGlow },
  brand: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 2, opacity: 0.9 },
  symbol: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 14, letterSpacing: -0.5 },
  name: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 2 },
  headline: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  metrics: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  metric: { alignItems: 'center', paddingHorizontal: 18 },
  metricValue: { color: '#fff', fontSize: 20, fontWeight: '700' },
  metricLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 3 },
  metricDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.18)' },
  tradesStrip: { marginTop: 20, alignItems: 'center', width: '100%' },
  tradesTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  tradesRows: { gap: 5, alignItems: 'center' },
  tradeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tradeSide: { fontSize: 13, fontWeight: '700', width: 36, textAlign: 'right' },
  tradeAmt: { color: '#fff', fontSize: 13, fontWeight: '600', width: 110, textAlign: 'left' },
  tradePrice: { color: 'rgba(255,255,255,0.75)', fontSize: 13, width: 70, textAlign: 'right' },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    width: '100%',
    marginTop: 20,
  },
  shareText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  devNote: { color: colors.fgFaint, fontSize: 12, marginTop: 12, textAlign: 'center' },
  closeBtn: { paddingVertical: 14, marginTop: 4 },
  closeText: { color: colors.fgMuted, fontSize: 15, fontWeight: '600' },
});
