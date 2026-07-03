import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DragSheet } from './DragSheet';
import { CoinIcon } from './CoinIcon';
import { HlBadge } from './HlBadge';
import { PressScale } from './PressScale';
import { GlassFill } from './GlassFill';
import { API_URL } from '../src/env';
import { colors, radius } from '../src/theme';
import { showToast } from '../src/toast';
import type { PerpMarket } from '../src/types';

function px(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  const dec = n >= 1 ? 2 : n >= 0.01 ? 4 : 6;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}
function vol(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
const iconUri = (m: PerpMarket) => (/\.png$/i.test(m.iconSrc) ? `${API_URL}${m.iconSrc}` : null);

/**
 * Read-only Hyperliquid market detail — real mark/oracle/funding/OI from
 * /api/perps/markets. Order signing isn't shipped yet (matches web's Preview
 * state), so Long/Short are honest "coming soon" rather than a fake fill.
 */
export function PerpDetailSheet({ market, onClose }: { market: PerpMarket | null; onClose: () => void }) {
  const soon = () => showToast('Perp trading is coming soon', { sub: 'Live market data now; order signing next', kind: 'info' });
  return (
    <DragSheet visible={Boolean(market)} onClose={onClose}>
      {market ? (
        <View>
          <View style={s.head}>
            <View style={s.iconWrap}>
              <CoinIcon uri={iconUri(market)} symbol={market.coin} size={44} />
              <View style={s.hlBadge}>
                <HlBadge size={16} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.titleLine}>
                <Text style={s.coin}>{market.coin}</Text>
                <View style={s.lev}>
                  <Text style={s.levText}>{market.maxLeverage}x</Text>
                </View>
              </View>
              <Text style={s.label} numberOfLines={1}>
                {market.label}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.price}>{px(market.mark)}</Text>
              <Text style={[s.chg, { color: market.chg24 >= 0 ? colors.bull : colors.bear }]}>
                {market.chg24 >= 0 ? '▲' : '▼'} {Math.abs(market.chg24).toFixed(2)}%
              </Text>
            </View>
          </View>

          <View style={s.grid}>
            <Stat label="Oracle" value={px(market.oraclePx)} />
            <Stat label="24h volume" value={vol(market.vol24Usd)} />
            <Stat label="Open interest" value={vol(market.oiUsd)} />
            <Stat label="Max leverage" value={`${market.maxLeverage}x`} />
            <Stat label="Funding / 1h" value={`${(market.fundingHourly * 100).toFixed(4)}%`} tone={market.fundingHourly >= 0 ? colors.bull : colors.bear} />
            <Stat label="Funding APR" value={`${(market.fundingApr * 100).toFixed(2)}%`} tone={market.fundingApr >= 0 ? colors.bull : colors.bear} />
          </View>

          <View style={s.fundingRow}>
            <Text style={s.fundingLabel}>Next funding</Text>
            <Text style={s.fundingVal}>{market.fundingCountdown || '—'}</Text>
          </View>

          <View style={s.actions}>
            <PressScale style={[s.side, s.long]} onPress={soon} to={0.97}>
              <Text style={[s.sideText, { color: colors.bull }]}>Long</Text>
            </PressScale>
            <PressScale style={[s.side, s.short]} onPress={soon} to={0.97}>
              <Text style={[s.sideText, { color: colors.bear }]}>Short</Text>
            </PressScale>
          </View>
          <Text style={s.note}>Live Hyperliquid data. One-tap long/short lands next.</Text>
        </View>
      ) : null}
    </DragSheet>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={s.stat}>
      <GlassFill />
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 44, height: 44 },
  hlBadge: { position: 'absolute', right: -3, bottom: -3 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coin: { color: colors.fg, fontSize: 20, fontWeight: '800' },
  lev: { backgroundColor: colors.accentSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  levText: { color: colors.accentGlow, fontSize: 11, fontWeight: '700' },
  label: { color: colors.fgMuted, fontSize: 13, marginTop: 2 },
  price: { color: colors.fg, fontSize: 18, fontWeight: '700' },
  chg: { fontSize: 13, fontWeight: '600', marginTop: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  stat: { width: '47.8%', flexGrow: 1, borderRadius: radius.md, padding: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  statLabel: { color: colors.fgMuted, fontSize: 12.5 },
  statValue: { color: colors.fg, fontSize: 16, fontWeight: '700', marginTop: 4 },

  fundingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingHorizontal: 2 },
  fundingLabel: { color: colors.fgMuted, fontSize: 13.5 },
  fundingVal: { color: colors.fg, fontSize: 14, fontWeight: '700' },

  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  side: { flex: 1, alignItems: 'center', paddingVertical: 15, borderRadius: 14, borderWidth: 1 },
  long: { backgroundColor: colors.bull + '18', borderColor: colors.bull + '66' },
  short: { backgroundColor: colors.bear + '14', borderColor: colors.bear + '55' },
  sideText: { fontSize: 16, fontWeight: '800' },
  note: { color: colors.fgFaint, fontSize: 12, textAlign: 'center', marginTop: 12 },
});
