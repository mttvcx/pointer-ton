import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getToken } from '../src/api/endpoints';
import { Screen } from '../components/Screen';
import { Glass } from '../components/Glass';
import { AiVerdictChip } from '../components/AiVerdictChip';
import { TradeSheet } from '../components/TradeSheet';
import { colors, radius } from '../src/theme';
import { ageShort, compactUsd, priceUsd, shortMint } from '../src/format';

/**
 * The wedge screen. ONE screen, Simple view for Phase 1 (Advanced = same screen,
 * expanded — Phase 2). The chart and the AI verdict are NEVER hidden, and the
 * verdict sits right above the Buy/Sell bar.
 */
export function TokenScreen({ mint, onBack }: { mint: string; onBack: () => void }) {
  const q = useQuery({ queryKey: ['token', mint], queryFn: () => getToken(mint), staleTime: 15_000 });
  const [sheet, setSheet] = useState<null | 'buy' | 'sell'>(null);

  if (q.isLoading) {
    return (
      <Screen>
        <View style={s.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }
  const t = q.data?.token;
  const snap = q.data?.snapshot ?? null;
  if (!t) {
    return (
      <Screen>
        <View style={s.center}>
          <Text style={s.muted}>Token not found</Text>
          <Pressable onPress={onBack}>
            <Text style={s.link}>Back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const symbol = (t.symbol ?? shortMint(t.mint)).replace(/^\$/, '');

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.content}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Text style={s.link}>‹ Back</Text>
        </Pressable>

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

        <Glass style={s.chart}>
          <Text style={s.chartHint}>Chart</Text>
        </Glass>

        <AiVerdictChip mint={t.mint} expandable />

        <View style={s.signals}>
          <Signal label="Liquidity" value={compactUsd(snap?.liquidity_usd)} />
          <Signal label="Holders" value={snap?.holder_count != null ? String(snap.holder_count) : '—'} />
          <Signal label="24h volume" value={compactUsd(snap?.volume_24h_usd)} />
          <Signal label="Age" value={ageShort(t.created_at) || '—'} />
          <Signal label="LP" value={t.is_lp_locked ? 'Locked' : 'Unlocked'} tone={t.is_lp_locked ? 'good' : 'warn'} />
          <Signal
            label="Mint authority"
            value={t.mint_authority ? 'Active' : 'Revoked'}
            tone={t.mint_authority ? 'warn' : 'good'}
          />
        </View>
        <Text style={s.smartHint}>Smart-money & KOL signal lands in the Tracker (Phase 2).</Text>
      </ScrollView>

      <Glass style={s.tradeBar} intensity={40}>
        <Pressable style={[s.tradeBtn, { backgroundColor: colors.bull }]} onPress={() => setSheet('buy')}>
          <Text style={s.tradeText}>Buy</Text>
        </Pressable>
        <Pressable style={[s.tradeBtn, { backgroundColor: colors.bear }]} onPress={() => setSheet('sell')}>
          <Text style={s.tradeText}>Sell</Text>
        </Pressable>
      </Glass>

      {sheet ? (
        <TradeSheet mint={t.mint} symbol={symbol} side={sheet} visible onClose={() => setSheet(null)} />
      ) : null}
    </Screen>
  );
}

function Signal({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  const color = tone === 'good' ? colors.bull : tone === 'warn' ? colors.warn : colors.fg;
  return (
    <Glass style={s.signal}>
      <Text style={s.signalLabel}>{label}</Text>
      <Text style={[s.signalValue, { color }]}>{value}</Text>
    </Glass>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  content: { padding: 16, paddingTop: 56, paddingBottom: 130, gap: 14 },
  backBtn: { alignSelf: 'flex-start' },
  link: { color: colors.accent, fontWeight: '700' },
  muted: { color: colors.fgMuted },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.bgRaised },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.fgSecondary, fontWeight: '800' },
  symbol: { color: colors.fg, fontSize: 22, fontWeight: '800' },
  name: { color: colors.fgMuted, fontSize: 13 },
  price: { color: colors.fg, fontSize: 18, fontWeight: '700' },
  mc: { color: colors.fgMuted, fontSize: 12 },
  chart: { height: 190, alignItems: 'center', justifyContent: 'center' },
  chartHint: { color: colors.fgMuted, fontSize: 12 },
  signals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  signal: { width: '48%', padding: 12 },
  signalLabel: { color: colors.fgMuted, fontSize: 11 },
  signalValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  smartHint: { color: colors.fgMuted, fontSize: 11, fontStyle: 'italic' },
  tradeBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    borderRadius: 22,
  },
  tradeBtn: { flex: 1, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center' },
  tradeText: { color: '#04110b', fontSize: 16, fontWeight: '800' },
});
