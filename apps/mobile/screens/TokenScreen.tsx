import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getToken } from '../src/api/endpoints';
import { AiVerdictChip } from '../components/AiVerdictChip';
import { TradeSheet } from '../components/TradeSheet';
import { colors, radius } from '../src/theme';
import { ageShort, compactUsd, priceUsd, shortMint } from '../src/format';

/**
 * The wedge screen. ONE screen, Simple view for Phase 1 (Advanced = same screen,
 * sections expanded — Phase 2). Critically: the chart and the AI verdict are NEVER
 * hidden, and the verdict sits right above the Buy/Sell bar.
 */
export function TokenScreen({ mint, onBack }: { mint: string; onBack: () => void }) {
  const q = useQuery({ queryKey: ['token', mint], queryFn: () => getToken(mint), staleTime: 15_000 });
  const [sheet, setSheet] = useState<null | 'buy' | 'sell'>(null);

  if (q.isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  const t = q.data?.token;
  const snap = q.data?.snapshot ?? null;
  if (!t) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>Token not found</Text>
        <Pressable onPress={onBack}>
          <Text style={s.link}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const symbol = (t.symbol ?? shortMint(t.mint)).replace(/^\$/, '');

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.content}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Text style={s.link}>‹ Back</Text>
        </Pressable>

        {/* Identity + price */}
        <View style={s.head}>
          {t.image_url ? (
            <Image source={{ uri: t.image_url }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarFallback]}>
              <Text style={s.avatarText}>{symbol.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.symbol}>{symbol}</Text>
            <Text style={s.name} numberOfLines={1}>
              {t.name ?? shortMint(t.mint)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.price}>{priceUsd(snap?.price_usd)}</Text>
            <Text style={s.mc}>MC {compactUsd(snap?.market_cap_usd)}</Text>
          </View>
        </View>

        {/* Chart placeholder — Skia/react-native-graph sparkline lands next */}
        <View style={s.chart}>
          <Text style={s.chartHint}>Chart</Text>
        </View>

        {/* THE verdict — always visible, above the buy bar */}
        <AiVerdictChip mint={t.mint} expandable />

        {/* Humanized signal rows (Simple). Advanced expands each — Phase 2. */}
        <View style={s.signals}>
          <Signal label="Liquidity" value={compactUsd(snap?.liquidity_usd)} />
          <Signal label="Holders" value={snap?.holder_count != null ? String(snap.holder_count) : '—'} />
          <Signal label="24h volume" value={compactUsd(snap?.volume_24h_usd)} />
          <Signal label="Age" value={ageShort(t.created_at) || '—'} />
          <Signal
            label="LP"
            value={t.is_lp_locked ? 'Locked' : 'Unlocked'}
            tone={t.is_lp_locked ? 'good' : 'warn'}
          />
          <Signal
            label="Mint authority"
            value={t.mint_authority ? 'Active' : 'Revoked'}
            tone={t.mint_authority ? 'warn' : 'good'}
          />
        </View>
        <Text style={s.smartHint}>Smart-money & KOL signal lands in the Tracker (Phase 2).</Text>
      </ScrollView>

      {/* Sticky trade bar */}
      <View style={s.tradeBar}>
        <Pressable style={[s.tradeBtn, { backgroundColor: colors.bull }]} onPress={() => setSheet('buy')}>
          <Text style={s.tradeText}>Buy</Text>
        </Pressable>
        <Pressable style={[s.tradeBtn, { backgroundColor: colors.bear }]} onPress={() => setSheet('sell')}>
          <Text style={s.tradeText}>Sell</Text>
        </Pressable>
      </View>

      {sheet ? (
        <TradeSheet mint={t.mint} symbol={symbol} side={sheet} visible onClose={() => setSheet(null)} />
      ) : null}
    </View>
  );
}

function Signal({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  const color = tone === 'good' ? colors.bull : tone === 'warn' ? colors.warn : colors.fg;
  return (
    <View style={s.signal}>
      <Text style={s.signalLabel}>{label}</Text>
      <Text style={[s.signalValue, { color }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 10 },
  content: { padding: 16, paddingTop: 56, paddingBottom: 120, gap: 14 },
  backBtn: { alignSelf: 'flex-start' },
  link: { color: colors.accent, fontWeight: '700' },
  muted: { color: colors.fgMuted },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.bgRaised },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.fgSecondary, fontWeight: '800' },
  symbol: { color: colors.fg, fontSize: 22, fontWeight: '800' },
  name: { color: colors.fgMuted, fontSize: 13 },
  price: { color: colors.fg, fontSize: 18, fontWeight: '700' },
  mc: { color: colors.fgMuted, fontSize: 12 },
  chart: {
    height: 180,
    borderRadius: radius.lg,
    backgroundColor: colors.bgRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartHint: { color: colors.fgMuted, fontSize: 12 },
  signals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  signal: {
    width: '48%',
    backgroundColor: colors.bgRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  signalLabel: { color: colors.fgMuted, fontSize: 11 },
  signalValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  smartHint: { color: colors.fgMuted, fontSize: 11, fontStyle: 'italic' },
  tradeBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  tradeBtn: { flex: 1, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  tradeText: { color: '#04110b', fontSize: 16, fontWeight: '800' },
});
