import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';
import { Screen } from '../components/Screen';
import { Glass } from '../components/Glass';
import { getTokenBalance, USDC_MINT } from '../src/api/endpoints';
import { colors, radius } from '../src/theme';

/**
 * Home — the FOMO-style single-balance hero. One big USD number (USDC balance you
 * spend from), Add Funds (Apple Pay), and the actions. Glass over a gradient so it
 * reads premium, not flat.
 */
export function HomeScreen({
  onFund,
  onDiscover,
}: {
  onFund: () => void;
  onDiscover: () => void;
}) {
  const solana = useEmbeddedSolanaWallet();
  const wallet = solana?.wallets?.[0]?.address ?? null;

  const balance = useQuery({
    queryKey: ['usdc-balance', wallet],
    queryFn: () => getTokenBalance(USDC_MINT, wallet!),
    enabled: Boolean(wallet),
    refetchInterval: 20_000,
  });

  const usd = balance.data ? Number(balance.data.rawAmount) / 1e6 : 0;
  const [whole, cents] = usd.toFixed(2).split('.');

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.brand}>pointer.</Text>

        <Glass style={s.hero}>
          <Text style={s.heroLabel}>Balance</Text>
          <View style={s.balanceRow}>
            <Text style={s.dollar}>$</Text>
            <Text style={s.whole}>{whole}</Text>
            <Text style={s.cents}>.{cents}</Text>
          </View>
          <Text style={s.heroSub}>USDC · spend in one tap</Text>

          <View style={s.actions}>
            <Pressable style={[s.action, s.actionPrimary]} onPress={onFund}>
              <Text style={s.actionPrimaryText}>Add funds</Text>
            </Pressable>
            <Pressable style={s.action} onPress={onDiscover}>
              <Text style={s.actionText}>Trade</Text>
            </Pressable>
          </View>
        </Glass>

        <Glass style={s.promo}>
          <Text style={s.promoTitle}>Get half your fees back</Text>
          <Text style={s.promoSub}>
            50% cashback on every trade + 30% when friends join. It just shows up here.
          </Text>
        </Glass>

        <Text style={s.section}>Your tokens</Text>
        <Glass style={s.empty}>
          <Text style={s.emptyText}>
            {usd > 0 ? 'No positions yet — find one in Pulse.' : 'Add funds to start trading.'}
          </Text>
        </Glass>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, paddingTop: 64, gap: 16, paddingBottom: 40 },
  brand: { color: colors.fg, fontSize: 22, fontWeight: '800' },
  hero: { padding: 24, gap: 6 },
  heroLabel: { color: colors.fgSecondary, fontSize: 13, fontWeight: '600' },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-start' },
  dollar: { color: colors.fgSecondary, fontSize: 28, fontWeight: '700', marginTop: 8 },
  whole: { color: colors.fg, fontSize: 56, fontWeight: '800', letterSpacing: -1.5 },
  cents: { color: colors.fgMuted, fontSize: 32, fontWeight: '700', marginTop: 14 },
  heroSub: { color: colors.fgMuted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  action: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  actionText: { color: colors.fg, fontWeight: '700' },
  actionPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  actionPrimaryText: { color: '#fff', fontWeight: '800' },
  promo: { padding: 18, gap: 4 },
  promoTitle: { color: colors.bull, fontSize: 16, fontWeight: '800' },
  promoSub: { color: colors.fgSecondary, fontSize: 13, lineHeight: 18 },
  section: { color: colors.fgSecondary, fontSize: 13, fontWeight: '700', marginTop: 4 },
  empty: { padding: 20, alignItems: 'center' },
  emptyText: { color: colors.fgMuted, fontSize: 13 },
});
