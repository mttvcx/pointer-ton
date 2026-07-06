import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { DragSheet } from './DragSheet';
import { PressScale } from './PressScale';
import { PnlShareCard } from './PnlShareCard';
import { GlassFill } from './GlassFill';
import { GlossButton } from './GlossButton';
import { DepositFlow } from './DepositFlow';
import { TraderAvatar } from './TraderAvatar';
import { colors, radius } from '../src/theme';
import { useIsFollowing, toggleFollow } from '../src/local';
import { showToast } from '../src/toast';
import type { WeeklyTrade } from '../src/demo';

/** "+$77,860.93" / "3,328.67%" / "$2,339.10" → number. */
const num = (v: string) => Number(String(v).replace(/[^0-9.-]/g, '')) || 0;

const ENTRIES = [
  { x: 18, y: 150 },
  { x: 70, y: 149 },
];
const EXITS = [
  { x: 205, y: 126 },
  { x: 250, y: 40 },
  { x: 264, y: 56 },
  { x: 278, y: 74 },
];

export function TraderSheet({
  trade,
  onClose,
  onOpenTrader,
}: {
  trade: WeeklyTrade | null;
  onClose: () => void;
  onOpenTrader?: (t: { handle: string; name?: string; color?: string; initial?: string }) => void;
}) {
  const [share, setShare] = useState(false);
  const [deposit, setDeposit] = useState(false);
  const following = useIsFollowing(trade?.name ?? '');
  const openProfile = () => {
    if (!trade) return;
    onOpenTrader?.({ handle: trade.handle, name: trade.name, color: trade.color, initial: trade.initial });
    onClose();
  };
  return (
    <DragSheet visible={!!trade} onClose={onClose}>
      {trade ? (
        <>
          <View style={s.traderRow}>
            <PressScale style={s.traderLeft} to={0.96} hitSlop={6} onPress={openProfile}>
              <TraderAvatar handle={trade.handle} color={trade.color} initial={trade.initial} name={trade.name} size={36} />
              <Text style={s.traderName}>{trade.name}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.fgMuted} />
            </PressScale>
            <View style={s.traderActions}>
              <PressScale style={s.iconBtn} onPress={() => setShare(true)} to={0.9}>
                <GlassFill />
                <Ionicons name="share-outline" size={18} color={colors.fg} />
              </PressScale>
              <PressScale
                style={[s.follow, following && s.followOn]}
                onPress={() => {
                  toggleFollow(trade.name);
                  showToast(following ? `Unfollowed ${trade.name}` : `Following ${trade.name}`, { kind: 'success' });
                }}
              >
                <GlassFill active={following} />
                <Text style={[s.followText, following && s.followTextOn]}>{following ? 'Following' : 'Follow'}</Text>
              </PressScale>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
            <View style={s.tokenRow}>
              <View style={s.tokenLeft}>
                <View style={[s.tokenIcon, { backgroundColor: trade.tokenColor }]}>
                  <Text style={s.tokenInitial}>{trade.tokenInitial}</Text>
                </View>
                <View>
                  <Text style={s.tokenSym}>{trade.token}</Text>
                  <View style={s.closed}>
                    <Text style={s.closedText}>Closed</Text>
                  </View>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.tokenPrice}>{trade.price}</Text>
                <Text style={s.tokenChange}>▲ {trade.changePct}</Text>
              </View>
            </View>

            <Svg width="100%" height={170} viewBox="0 0 360 180" style={{ marginTop: 6 }}>
              <Path
                d="M0 150 L40 148 L80 150 L120 146 L160 142 L195 132 L225 96 L250 40 L266 62 L288 92 L322 120 L360 132"
                fill="none"
                stroke={colors.bull}
                strokeWidth={2.4}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {ENTRIES.map((p, i) => (
                <React.Fragment key={`e${i}`}>
                  <Circle cx={p.x} cy={p.y} r={13} fill={colors.bull} />
                  <SvgText x={p.x} y={p.y + 5} fontSize={16} fontWeight="700" fill="#04140C" textAnchor="middle">
                    +
                  </SvgText>
                </React.Fragment>
              ))}
              {EXITS.map((p, i) => (
                <React.Fragment key={`x${i}`}>
                  <Circle cx={p.x} cy={p.y} r={13} fill={colors.bear} />
                  <SvgText x={p.x} y={p.y + 5} fontSize={16} fontWeight="700" fill="#1A0604" textAnchor="middle">
                    −
                  </SvgText>
                </React.Fragment>
              ))}
            </Svg>

            <View style={s.pnlCard}>
              <GlassFill />
              <View style={s.pnlTop}>
                <Text style={s.pnlAmt}>{trade.amt}</Text>
                <Text style={s.pnlPct}>▲ {trade.pnlPct.replace('+', '')}</Text>
              </View>
              <View style={s.pnlBottom}>
                <View>
                  <Text style={s.pnlLabel}>Avg. entry</Text>
                  <Text style={s.pnlValue}>{trade.avgEntry}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.pnlLabel}>Avg. exit</Text>
                  <Text style={s.pnlValue}>{trade.avgExit}</Text>
                </View>
              </View>
            </View>

            <View style={s.thesis}>
              <PressScale to={0.9} hitSlop={6} onPress={openProfile}>
                <TraderAvatar handle={trade.handle} color={trade.color} initial={trade.initial} name={trade.name} size={34} />
              </PressScale>
              <View style={{ flex: 1 }}>
                <View style={s.thesisHead}>
                  <PressScale to={0.96} hitSlop={6} onPress={openProfile}>
                    <Text style={s.thesisName}>{trade.name}</Text>
                  </PressScale>
                  <View style={s.thesisBadge}>
                    <Text style={s.thesisBadgeText}>Thesis</Text>
                  </View>
                  <Text style={s.thesisTime}>5d</Text>
                </View>
                <Text style={s.thesisText}>{trade.thesis}</Text>
              </View>
            </View>

            <View style={s.txnRow}>
              <Text style={s.txnCount}>{trade.txns} transactions</Text>
              <Text style={s.txnInvested}>{trade.invested} invested</Text>
            </View>
          </ScrollView>

          <GlossButton style={{ marginTop: 12 }} onPress={() => setDeposit(true)}>
            <Text style={s.buyText}>Deposit to buy</Text>
          </GlossButton>

          <DepositFlow visible={deposit} onClose={() => setDeposit(false)} />

          <PnlShareCard
            visible={share}
            onClose={() => setShare(false)}
            symbol={trade.token}
            name={trade.name}
            pnlUsd={num(trade.amt)}
            pnlPct={num(trade.pnlPct)}
            investedUsd={num(trade.invested)}
          />
        </>
      ) : null}
    </DragSheet>
  );
}

const s = StyleSheet.create({
  traderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  traderLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  traderName: { color: colors.fg, fontSize: 18, fontWeight: '600' },
  traderActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 42, height: 38, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  follow: { borderRadius: 10, paddingHorizontal: 22, paddingVertical: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  followOn: { borderColor: colors.accent },
  followText: { color: colors.fg, fontSize: 15, fontWeight: '600' },
  followTextOn: { color: colors.accentGlow },
  tokenRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  tokenLeft: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  tokenIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tokenInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
  tokenSym: { color: colors.fg, fontSize: 18, fontWeight: '600' },
  closed: { alignSelf: 'flex-start', backgroundColor: colors.bgRaised2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 3 },
  closedText: { color: colors.fgMuted, fontSize: 12, fontWeight: '600' },
  tokenPrice: { color: colors.fg, fontSize: 18, fontWeight: '600' },
  tokenChange: { color: colors.bull, fontSize: 14, marginTop: 2 },
  pnlCard: { borderRadius: radius.lg, padding: 16, marginTop: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  pnlTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pnlAmt: { color: colors.bull, fontSize: 28, fontWeight: '700' },
  pnlPct: { color: colors.bull, fontSize: 22, fontWeight: '700' },
  pnlBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  pnlLabel: { color: colors.fgMuted, fontSize: 12 },
  pnlValue: { color: colors.fg, fontSize: 15, fontWeight: '600', marginTop: 2 },
  thesis: { flexDirection: 'row', gap: 10, marginTop: 18 },
  thesisAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  thesisInitial: { color: '#fff', fontSize: 14, fontWeight: '600' },
  thesisHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  thesisName: { color: colors.fg, fontSize: 15, fontWeight: '600' },
  thesisBadge: { backgroundColor: colors.accentSoft, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  thesisBadgeText: { color: colors.accentGlow, fontSize: 11, fontWeight: '600' },
  thesisTime: { color: colors.fgFaint, fontSize: 12 },
  thesisText: { color: colors.fgSecondary, fontSize: 15, marginTop: 4, lineHeight: 20 },
  txnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 },
  txnCount: { color: colors.fg, fontSize: 17, fontWeight: '600' },
  txnInvested: { color: colors.fgFaint, fontSize: 14 },
  buy: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  buyText: { color: colors.onAccent, fontSize: 17, fontWeight: '600' },
});
