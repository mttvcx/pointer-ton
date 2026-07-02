import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../components/Screen';
import { CoinIcon } from '../components/CoinIcon';
import { PressScale } from '../components/PressScale';
import { GlassFill } from '../components/GlassFill';
import { colors, radius } from '../src/theme';
import { getLiveTokens } from '../src/api/endpoints';
import { priceUsd, pseudoChange } from '../src/format';
import type { PulseBundle } from '../src/types';

export function SearchScreen({ onOpenToken }: { onOpenToken: (b: PulseBundle) => void }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const q = useQuery({ queryKey: ['live-tokens'], queryFn: () => getLiveTokens(), staleTime: 30_000 });

  const results = useMemo(() => {
    const all = q.data ?? [];
    const t = query.trim().toLowerCase();
    if (!t) return all;
    return all.filter(
      (b) => (b.token.symbol ?? '').toLowerCase().includes(t) || (b.token.name ?? '').toLowerCase().includes(t),
    );
  }, [q.data, query]);

  return (
    <Screen>
      <View style={[s.head, { paddingTop: insets.top + 10 }]}>
        <Text style={s.title}>Search</Text>
        <View style={s.searchBar}>
          <GlassFill />
          <Ionicons name="search" size={18} color={colors.fgMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search tokens…"
            placeholderTextColor={colors.fgFaint}
            style={s.input}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query ? (
            <PressScale onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.fgMuted} />
            </PressScale>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={s.section}>{query ? `Results (${results.length})` : 'Trending tokens'}</Text>
        {results.map((b) => {
          const sym = (b.token.symbol ?? '?').replace(/^\$/, '');
          const ch = pseudoChange(b.token.mint);
          return (
            <PressScale key={b.token.mint} onPress={() => onOpenToken(b)} to={0.985} style={s.row}>
              <View style={s.rowLeft}>
                <CoinIcon uri={b.token.image_url} symbol={sym} verified={Boolean(b.token.launch_pad)} />
                <View style={s.rowText}>
                  <Text style={s.ticker} numberOfLines={1}>
                    {sym}
                  </Text>
                  <Text style={s.name} numberOfLines={1}>
                    {b.token.name ?? ''}
                  </Text>
                </View>
              </View>
              <View style={s.rowRight}>
                <Text style={s.price}>{priceUsd(b.snapshot?.price_usd)}</Text>
                <Text style={[s.chg, { color: ch.up ? colors.bull : colors.bear }]}>
                  {ch.up ? '▲' : '▼'} {ch.pct}
                </Text>
              </View>
            </PressScale>
          );
        })}
        {q.isLoading ? <Text style={s.none}>Loading…</Text> : null}
        {!q.isLoading && results.length === 0 ? <Text style={s.none}>No tokens match “{query}”.</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { paddingHorizontal: 18 },
  title: { color: colors.fg, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', paddingHorizontal: 14, paddingVertical: 12, marginTop: 14 },
  input: { flex: 1, color: colors.fg, fontSize: 16, padding: 0 },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 130 },
  section: { color: colors.fgMuted, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 13, flex: 1 },
  rowText: { flex: 1 },
  ticker: { color: colors.fg, fontSize: 18, fontWeight: '600' },
  name: { color: colors.fgMuted, fontSize: 14, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  price: { color: colors.fg, fontSize: 17, fontWeight: '600' },
  chg: { fontSize: 14, marginTop: 2 },
  none: { color: colors.fgMuted, fontSize: 14, marginTop: 24, textAlign: 'center' },
});
