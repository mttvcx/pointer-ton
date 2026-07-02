import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressScale } from './PressScale';
import { CoinIcon } from './CoinIcon';
import { XBadge } from './XBadge';
import { GlassFill } from './GlassFill';
import { colors, radius } from '../src/theme';
import { shortMint } from '../src/format';
import { useFollows } from '../src/local';
import { getActivityFeed, type TradeEvent } from '../src/demo/activity';
import type { PulseBundle } from '../src/types';

/* ---- formatters (no Intl — Hermes-safe) ---- */
const group = (int: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
function usd(n: number): string {
  return `$${group(String(Math.round(n)))}`;
}

type Filter = 'following' | 'all';

/**
 * Social feed — the live tape of "@trader bought/sold $TOKEN". This is FOMO's
 * social-first discovery: tap a trader to open their profile (where you Copy their
 * trades), or tap the token to open it. Copy-trade itself lives on the profile,
 * not here.
 */
export function ActivityFeed({
  onOpenToken,
  onOpenTrader,
}: {
  onOpenToken: (b: PulseBundle) => void;
  onOpenTrader: (t: { handle: string; name: string; color: string; initial: string }) => void;
}) {
  const follows = useFollows();
  const [filter, setFilter] = useState<Filter>('all');

  const all = useMemo(() => getActivityFeed(), []);
  const events = filter === 'following' ? all.filter((e) => follows.has(e.trader.handle)) : all;

  return (
    <View>
      <View style={s.filterRow}>
        {(['following', 'all'] as Filter[]).map((f) => (
          <PressScale key={f} onPress={() => setFilter(f)} to={0.95} style={[s.filter, filter === f && s.filterOn]}>
            <GlassFill active={filter === f} />
            <Text style={[s.filterText, filter === f && s.filterTextOn]}>
              {f === 'following' ? `Following${follows.size ? ` (${follows.size})` : ''}` : 'All traders'}
            </Text>
          </PressScale>
        ))}
      </View>

      {events.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="people-outline" size={30} color={colors.fgFaint} />
          <Text style={s.emptyTitle}>No activity from people you follow yet</Text>
          <Text style={s.emptySub}>Follow traders from the leaderboard, then their live trades show up here.</Text>
        </View>
      ) : (
        events.map((e) => (
          <ActivityRow
            key={e.id}
            e={e}
            onOpenToken={() => onOpenToken(e.bundle)}
            onOpenTrader={() =>
              onOpenTrader({ handle: e.trader.handle, name: e.trader.name, color: e.trader.color, initial: e.trader.initial })
            }
          />
        ))
      )}
    </View>
  );
}

function ActivityRow({
  e,
  onOpenToken,
  onOpenTrader,
}: {
  e: TradeEvent;
  onOpenToken: () => void;
  onOpenTrader: () => void;
}) {
  const sym = (e.bundle.token.symbol ?? shortMint(e.bundle.token.mint)).replace(/^\$/, '');
  const buy = e.side === 'buy';
  const sideColor = buy ? colors.bull : colors.bear;

  return (
    <PressScale onPress={onOpenTrader} to={0.99} style={s.row}>
      <View style={[s.avatar, { backgroundColor: e.trader.color }]}>
        <Text style={s.avatarText}>{e.trader.initial}</Text>
      </View>

      <View style={s.mid}>
        <View style={s.nameLine}>
          <Text style={s.name} numberOfLines={1}>
            {e.trader.name}
          </Text>
          {e.trader.xConnected ? <XBadge size={14} /> : null}
          <Text style={s.ago}>· {e.ago}</Text>
        </View>

        <PressScale onPress={onOpenToken} to={0.98} hitSlop={4}>
          <View style={s.tradeLine}>
            <CoinIcon uri={e.bundle.token.image_url} symbol={sym} size={18} />
            <Text style={s.tradeText} numberOfLines={1}>
              <Text style={[s.side, { color: sideColor }]}>{buy ? 'Bought' : 'Sold'}</Text>{' '}
              <Text style={s.tradeSym}>${sym}</Text>
              <Text style={s.tradeMuted}> · {usd(e.amountUsd)}</Text>
              {e.pnlPct != null ? (
                <Text style={[s.tradePnl, { color: e.pnlPct >= 0 ? colors.bull : colors.bear }]}>
                  {' '}
                  · {e.pnlPct >= 0 ? '+' : ''}
                  {e.pnlPct.toFixed(0)}%
                </Text>
              ) : null}
            </Text>
          </View>
        </PressScale>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.fgFaint} />
    </PressScale>
  );
}

const s = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 8 },
  filter: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  filterOn: { borderColor: 'rgba(255,255,255,0.28)' },
  filterText: { color: colors.fgMuted, fontSize: 13, fontWeight: '700' },
  filterTextOn: { color: colors.fg },

  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  mid: { flex: 1, gap: 3 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { color: colors.fg, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  ago: { color: colors.fgMuted, fontSize: 13 },
  tradeLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tradeText: { flex: 1, fontSize: 13.5 },
  side: { fontWeight: '700' },
  tradeSym: { color: colors.fg, fontWeight: '700' },
  tradeMuted: { color: colors.fgMuted },
  tradePnl: { fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { color: colors.fgSecondary, fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  emptySub: { color: colors.fgMuted, fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 24 },
});
