import React from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getPulseFeed } from '../src/api/endpoints';
import type { PulseBundle } from '../src/types';
import { Screen } from '../components/Screen';
import { Glass } from '../components/Glass';
import { colors } from '../src/theme';
import { ageShort, compactUsd, shortMint } from '../src/format';

/** Discovery feed (Pulse). Public + cached on the server (stale-while-revalidate). */
export function PulseScreen({ onOpenToken }: { onOpenToken: (mint: string) => void }) {
  const q = useQuery({
    queryKey: ['pulse', 'new', 'sol'],
    queryFn: () => getPulseFeed('new', 'sol'),
    refetchInterval: 15_000,
  });

  return (
    <Screen>
      <View style={s.content}>
        <Text style={s.h1}>Pulse</Text>
        {q.isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={q.data?.items ?? []}
            keyExtractor={(it) => it.token.mint}
            contentContainerStyle={{ paddingBottom: 120, gap: 8 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={s.empty}>No tokens yet — discovery is throttled while testing.</Text>
            }
            renderItem={({ item }) => <Row bundle={item} onPress={() => onOpenToken(item.token.mint)} />}
          />
        )}
      </View>
    </Screen>
  );
}

function Row({ bundle, onPress }: { bundle: PulseBundle; onPress: () => void }) {
  const t = bundle.token;
  const snap = bundle.snapshot;
  const symbol = (t.symbol ?? shortMint(t.mint)).replace(/^\$/, '');
  return (
    <Pressable onPress={onPress}>
      <Glass style={s.row}>
        {t.image_url ? (
          <Image source={{ uri: t.image_url }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.avatarText}>{symbol.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.symbol} numberOfLines={1}>
            {symbol}
          </Text>
          <Text style={s.sub} numberOfLines={1}>
            {ageShort(t.created_at)} · LP {t.is_lp_locked ? 'locked' : 'open'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.mc}>{compactUsd(snap?.market_cap_usd)}</Text>
          <Text style={s.sub}>{compactUsd(snap?.liquidity_usd)} liq</Text>
        </View>
      </Glass>
    </Pressable>
  );
}

const s = StyleSheet.create({
  content: { flex: 1, padding: 16, paddingTop: 56 },
  h1: { color: colors.fg, fontSize: 28, fontWeight: '800', marginBottom: 12 },
  empty: { color: colors.fgMuted, marginTop: 40, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.25)' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.fgSecondary, fontWeight: '800', fontSize: 12 },
  symbol: { color: colors.fg, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.fgMuted, fontSize: 11 },
  mc: { color: colors.fg, fontSize: 14, fontWeight: '700' },
});
