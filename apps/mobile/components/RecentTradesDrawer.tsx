import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors, radius, space, TOP_INSET } from '../src/theme';
import { ageShort } from '../src/format';
import { getTokenTrades, type TradeRow } from '../src/api/endpoints';

/**
 * "My recent trades" — a panel that slides in from the LEFT over the token page
 * (opened by the clock icon). It fetches the public token trades feed and, when a
 * wallet is supplied, narrows to the user's own fills. Honest UI: an explicit
 * empty state, never fake rows.
 *
 * DragSheet is a bottom pull-up, so this is a purpose-built left drawer:
 * RN Modal (transparent) + Animated translateX from -width → 0, sliding out
 * before unmount so the close animation is visible.
 */

const SCREEN_W = Dimensions.get('window').width;
const PANEL_W = Math.min(380, Math.round(SCREEN_W * 0.86));

export function RecentTradesDrawer({
  visible,
  onClose,
  mint,
  wallet,
}: {
  visible: boolean;
  onClose: () => void;
  mint: string;
  wallet?: string | null;
}) {
  const [mounted, setMounted] = useState(visible);
  const tx = useRef(new Animated.Value(-PANEL_W)).current;
  const fade = useRef(new Animated.Value(0)).current;

  // Slide in on open; slide out then unmount on close so the exit is seen.
  useEffect(() => {
    if (visible) {
      setMounted(true);
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(tx, { toValue: -PANEL_W, duration: 200, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, mounted, tx, fade]);

  useEffect(() => {
    if (mounted && visible) {
      tx.setValue(-PANEL_W);
      fade.setValue(0);
      Animated.parallel([
        Animated.spring(tx, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 2 }),
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
    // Run only when we transition into the mounted+visible state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, visible]);

  const q = useQuery({
    queryKey: ['token-trades', mint],
    queryFn: () => getTokenTrades(mint),
    enabled: mounted && !!mint,
    staleTime: 15_000,
  });

  const trades = useMemo(() => {
    const all = q.data ?? [];
    if (!wallet) return all;
    return all.filter((t) => t.wallet_address === wallet);
  }, [q.data, wallet]);

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[s.scrim, { opacity: fade }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[s.panel, { transform: [{ translateX: tx }] }]}>
          <View style={s.header}>
            <Text style={s.title}>My trades{trades.length ? ` (${trades.length})` : ''}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={s.closeBtn}>
              <Text style={s.closeX}>✕</Text>
            </Pressable>
          </View>

          {q.isLoading ? (
            <View style={s.center}>
              <ActivityIndicator color={colors.fgMuted} />
            </View>
          ) : q.isError ? (
            <View style={s.center}>
              <Text style={s.emptyIcon}>⚠</Text>
              <Text style={s.emptyText}>Couldn&apos;t load trades. Pull back and try again.</Text>
            </View>
          ) : trades.length === 0 ? (
            <View style={s.center}>
              <Text style={s.emptyIcon}>🕓</Text>
              <Text style={s.emptyText}>No trades yet — buy or sell this coin to see them here.</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={s.listContent}
              showsVerticalScrollIndicator={false}
            >
              {trades.map((t, i) => (
                <TradeRowItem key={`${t.tx_signature}-${i}`} trade={t} />
              ))}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function TradeRowItem({ trade }: { trade: TradeRow }) {
  const buy = trade.side === 'buy';
  const when = ageShort(trade.submitted_at);
  const pending = trade.status !== 'confirmed' && trade.status !== 'success' && trade.status !== 'filled';

  return (
    <View style={s.row}>
      <View style={[s.badge, buy ? s.badgeBuy : s.badgeSell]}>
        <Text style={[s.badgeText, buy ? s.badgeTextBuy : s.badgeTextSell]}>{buy ? 'BUY' : 'SELL'}</Text>
      </View>

      <View style={s.rowBody}>
        <Text style={s.rowMain} numberOfLines={1}>
          {formatToken(trade.amount_token)}
          {trade.price_usd_at_fill != null ? (
            <Text style={s.rowMainDim}> @ {formatFillPrice(trade.price_usd_at_fill)}</Text>
          ) : null}
        </Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {formatSol(trade.amount_sol)}
          {when ? <Text style={s.rowSubDim}>{`  •  ${when} ago`}</Text> : null}
          {pending ? <Text style={s.rowPending}>{'  •  pending'}</Text> : null}
        </Text>
      </View>
    </View>
  );
}

/* ---------- local number formatting (no monospace, clean) ---------- */

function formatToken(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (abs >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatSol(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '— SOL';
  const v = Math.abs(n);
  if (v < 0.001) return `${n.toPrecision(2)} SOL`;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 3 })} SOL`;
}

function formatFillPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(2)}`;
}

const s = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: PANEL_W,
    backgroundColor: colors.bgRaised,
    borderRightWidth: 1,
    borderColor: colors.border,
    paddingTop: TOP_INSET,
    paddingHorizontal: space(4),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: space(3),
    marginBottom: space(2),
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.fg, fontSize: 18, fontWeight: '700' },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgRaised2,
  },
  closeX: { color: colors.fgMuted, fontSize: 14, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(6), paddingBottom: space(12) },
  emptyIcon: { fontSize: 30, marginBottom: space(3) },
  emptyText: { color: colors.fgMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },

  listContent: { paddingBottom: space(8) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  badge: {
    width: 46,
    paddingVertical: space(1),
    borderRadius: radius.sm,
    alignItems: 'center',
    marginRight: space(3),
  },
  badgeBuy: { backgroundColor: colors.bullSoft },
  badgeSell: { backgroundColor: colors.bearSoft },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  badgeTextBuy: { color: colors.bull },
  badgeTextSell: { color: colors.bear },

  rowBody: { flex: 1, minWidth: 0 },
  rowMain: { color: colors.fg, fontSize: 15, fontWeight: '600' },
  rowMainDim: { color: colors.fgSecondary, fontWeight: '500' },
  rowSub: { color: colors.fgMuted, fontSize: 12, marginTop: 2 },
  rowSubDim: { color: colors.fgFaint },
  rowPending: { color: colors.warn },
});
