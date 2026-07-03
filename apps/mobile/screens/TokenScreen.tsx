import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Linking, PanResponder, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { Screen } from '../components/Screen';
import { CoinIcon } from '../components/CoinIcon';
import { ChainIcon } from '../components/ChainIcon';
import { PressScale } from '../components/PressScale';
import { DepositFlow } from '../components/DepositFlow';
import { BuySheet } from '../components/BuySheet';
import { CrossmintBuySheet } from '../components/CrossmintBuySheet';
import { CROSSMINT_READY } from '../src/crossmint';
import { AiVerdictChip } from '../components/AiVerdictChip';
import { Accordion } from '../components/Accordion';
import { GlassFill } from '../components/GlassFill';
import { GlossButton } from '../components/GlossButton';
import { colors, radius } from '../src/theme';
import { getToken } from '../src/api/endpoints';
import { ageShort, compactUsd, priceUsd, shortMint } from '../src/format';
import { toggleWatch, useIsWatched, useChartTf, setChartTf, useChartAxis, setChartAxis, type OrderSide } from '../src/local';
import { copyText } from '../src/clipboard';
import { CopyButton } from '../components/CopyButton';
import { TwitterChip } from '../components/TwitterChip';
import { RecentTradesDrawer } from '../components/RecentTradesDrawer';
import { PnlShareCard } from '../components/PnlShareCard';
import { useAuth } from '../src/auth';
import { DEMO_HOLDERS } from '../src/demo';
import { getTradersOnToken, type TokenTrader } from '../src/demo/activity';
import { XBadge } from '../components/XBadge';
import type { PulseBundle } from '../src/types';

const TIMEFRAMES = ['1H', '4H', '1D', '7D', '1M', 'ALL'];
const TABS = ['Stats', 'About'];

/** Entry (+, green) / exit (–, red) markers plotted on the demo chart path —
 *  FOMO's "see where traders bought/sold" chart overlay. Coordinates sit on the
 *  fixed demo curve below. */
const CHART_MARKS = [
  { x: 78, y: 78, buy: true },
  { x: 158, y: 60, buy: true },
  { x: 236, y: 48, buy: false },
];

export function TokenScreen({
  bundle,
  onBack,
  advanced,
  onOpenTrader,
}: {
  bundle: PulseBundle;
  onBack: () => void;
  advanced: boolean;
  onOpenTrader: (t: { handle: string; name?: string; color?: string; initial?: string }) => void;
}) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);
  const [deposit, setDeposit] = useState(false);
  const [buy, setBuy] = useState<{ open: boolean; side: OrderSide }>({ open: false, side: 'buy' });
  const watched = useIsWatched(bundle.token.mint);
  const tfActive = useChartTf();
  const axis = useChartAxis();
  const wallet = useAuth().walletAddress;
  const [tradesOpen, setTradesOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [cmBuy, setCmBuy] = useState(false);

  // Slide the whole token view in from the right when it opens (clean push, no hard cut),
  // and let the user swipe right to drag it back — follows the finger, springs back or dismisses.
  const W = Dimensions.get('window').width;
  const tx = useRef(new Animated.Value(W)).current;
  useEffect(() => {
    Animated.timing(tx, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [tx]);
  const back = useRef(onBack);
  back.current = onBack;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx > 12 && g.dx > Math.abs(g.dy) * 1.6,
      onPanResponderMove: (_, g) => {
        if (g.dx > 0) tx.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > 90 || g.vx > 0.4) {
          Animated.timing(tx, { toValue: W, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(
            ({ finished }) => finished && back.current(),
          );
        } else {
          Animated.spring(tx, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 3 }).start();
        }
      },
    }),
  ).current;

  const q = useQuery({ queryKey: ['token', bundle.token.mint], queryFn: () => getToken(bundle.token.mint), staleTime: 20_000 });

  const token = q.data?.token ?? bundle.token;
  const snap = q.data?.snapshot ?? bundle.snapshot;
  const live: PulseBundle = { token, snapshot: snap };
  const sym = (token.symbol ?? shortMint(token.mint)).replace(/^\$/, '');

  const open = (url?: string | null) => {
    if (url) Linking.openURL(url).catch(() => {});
  };

  // Demo "your position" numbers for the share card (deterministic per mint).
  const shareInvested = 800 + seed(token.mint, 11) * 30_000;
  const sharePnlPct = 40 + seed(token.mint, 12) * 2800;
  const sharePnlUsd = (shareInvested * sharePnlPct) / 100;

  // A holder's position on this token, shared from the Top holders list.
  const [holderShare, setHolderShare] = useState<
    { symbol: string; name?: string | null; image?: string | null; pnlUsd: number; pnlPct: number; investedUsd: number } | null
  >(null);
  const shareHolder = (h: (typeof DEMO_HOLDERS)[number]) => {
    const pct = parseAmt(h.chg) * (h.up ? 1 : -1);
    const value = parseAmt(h.value);
    const invested = value / (1 + pct / 100);
    setHolderShare({ symbol: sym, name: token.name, image: token.image_url, pnlUsd: value - invested, pnlPct: pct, investedUsd: invested });
  };

  // Share a "Traders here" position as a P&L card (tap their P&L pill).
  const shareTrader = (t: TokenTrader) => {
    const invested = t.holdingUsd / (1 + t.pnlPct / 100);
    setHolderShare({ symbol: sym, name: token.name, image: token.image_url, pnlUsd: t.holdingUsd - invested, pnlPct: t.pnlPct, investedUsd: invested });
  };

  return (
    <Screen>
      <Animated.View {...pan.panHandlers} style={{ flex: 1, transform: [{ translateX: tx }] }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={s.pad}>
          <View style={s.topBar}>
            <PressScale onPress={onBack} to={0.85} hitSlop={10}>
              <Ionicons name="chevron-back" size={26} color={colors.fgSecondary} />
            </PressScale>
            <View style={s.actions}>
              <PressScale onPress={() => setTradesOpen(true)} to={0.85} hitSlop={8}>
                <Ionicons name="time-outline" size={21} color={colors.fgSecondary} />
              </PressScale>
              <PressScale onPress={() => toggleWatch(bundle.token.mint)} to={0.85} hitSlop={8}>
                <Ionicons name={watched ? 'star' : 'star-outline'} size={21} color={watched ? colors.warn : colors.fgSecondary} />
              </PressScale>
              <PressScale onPress={() => setShareOpen(true)} to={0.85} hitSlop={8}>
                <Ionicons name="share-social-outline" size={21} color={colors.fgSecondary} />
              </PressScale>
            </View>
          </View>

          <View style={s.head}>
            <View style={s.coinWrap}>
              <CoinIcon uri={token.image_url} symbol={sym} size={46} verified={Boolean(token.launch_pad)} />
              {token.chain ? <ChainIcon id={token.chain} size={19} style={s.coinChain} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.symbol} numberOfLines={1}>{sym}</Text>
              <CopyButton value={token.mint} label={token.name ?? shortMint(token.mint)} size={13} color={colors.fgMuted} style={s.subRow} />
              {token.twitter_handle || token.website_url || token.telegram_url ? (
                <View style={s.socials}>
                  {token.twitter_handle ? <TwitterChip value={token.twitter_handle} size={22} /> : null}
                  {token.website_url ? (
                    <PressScale onPress={() => open(token.website_url)} style={s.socialDot} hitSlop={6}>
                      <Ionicons name="globe-outline" size={13} color={colors.fgMuted} />
                    </PressScale>
                  ) : null}
                  {token.telegram_url ? (
                    <PressScale onPress={() => open(token.telegram_url)} style={s.socialDot} hitSlop={6}>
                      <Ionicons name="paper-plane-outline" size={13} color={colors.fgMuted} />
                    </PressScale>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          <View style={s.priceRow}>
            <Text style={s.price}>{axis === 'mc' ? compactUsd(snap?.market_cap_usd) : priceUsd(snap?.price_usd)}</Text>
            <PressScale onPress={() => setChartAxis(axis === 'mc' ? 'price' : 'mc')} to={0.94} style={{ alignItems: 'flex-end' }} hitSlop={8}>
              <View style={s.mcTop}>
                <Ionicons name="swap-horizontal" size={14} color={colors.accentGlow} />
                <Text style={s.mcValue}>{axis === 'mc' ? priceUsd(snap?.price_usd) : compactUsd(snap?.market_cap_usd)}</Text>
              </View>
              <Text style={s.mcLabel}>{axis === 'mc' ? 'Price · tap to swap' : 'Market cap · tap to swap'}</Text>
            </PressScale>
          </View>
        </View>

        <Svg width="100%" height={150} viewBox="0 0 360 150" preserveAspectRatio="none" style={s.chart}>
          <Path d="M0 96 C34 92 50 70 78 78 C108 86 124 54 158 60 C190 66 202 40 236 48 C270 56 288 30 360 22 L360 150 L0 150 Z" fill={colors.accent} fillOpacity={0.06} />
          <Path d="M0 96 C34 92 50 70 78 78 C108 86 124 54 158 60 C190 66 202 40 236 48 C270 56 288 30 360 22" fill="none" stroke={colors.accentGlow} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={360} cy={22} r={10} fill={colors.accentGlow} fillOpacity={0.18} />
          <Circle cx={360} cy={22} r={4.5} fill={colors.accentGlow} />
          {CHART_MARKS.map((m, i) => (
            <G key={i}>
              <Circle cx={m.x} cy={m.y} r={7.5} fill={colors.bg} />
              <Circle cx={m.x} cy={m.y} r={6} fill={m.buy ? colors.bull : colors.bear} />
              <SvgText x={m.x} y={m.y + 3.4} fontSize={10} fontWeight="bold" fill={colors.bg} textAnchor="middle">
                {m.buy ? '+' : '–'}
              </SvgText>
            </G>
          ))}
        </Svg>

        <View style={s.pad}>
          <View style={s.tfRow}>
            {TIMEFRAMES.map((tf) => (
              <PressScale key={tf} onPress={() => setChartTf(tf)} to={0.9} hitSlop={6}>
                <Text style={[s.tf, tf === tfActive && s.tfActive]}>{tf}</Text>
              </PressScale>
            ))}
            <Ionicons name="stats-chart" size={18} color={colors.bull} style={{ marginLeft: 'auto' }} />
          </View>

          {/* THE WEDGE — AI safety verdict, both modes */}
          <View style={{ marginTop: 16 }}>
            <AiVerdictChip bundle={live} />
          </View>

          {/* Who's positioned here + how they're doing (profitability visibility).
              Copy-trade itself lives on a trader's profile, not here. */}
          <TradersHere mint={token.mint} price={snap?.price_usd ?? 0} onOpenTrader={onOpenTrader} onShare={shareTrader} />

          {advanced ? (
            <View style={s.console}>
              <Accordion title="Risk & authority" defaultOpen>
                <RiskRows token={token} snap={snap} />
              </Accordion>

              <Accordion title="Top holders" badge={snap?.holder_count != null ? snap.holder_count.toLocaleString() : undefined}>
                {DEMO_HOLDERS.map((h, i) => (
                  <View key={i} style={s.holder}>
                    <Text style={s.holderRank}>#{i + 1}</Text>
                    <View style={[s.holderAvatar, { backgroundColor: h.color }]}>
                      <Text style={s.holderInitial}>{h.initial}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.holderName}>{h.name}</Text>
                      <Text style={s.holderHold}>{h.hold}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.holderValue}>{h.value}</Text>
                      <Text style={[s.holderChg, { color: h.up ? colors.bull : colors.bear }]}>{h.up ? '▲' : '▼'} {h.chg}</Text>
                    </View>
                    <PressScale onPress={() => shareHolder(h)} hitSlop={8} to={0.85} style={s.holderShare}>
                      <Ionicons name="share-outline" size={16} color={colors.fgMuted} />
                    </PressScale>
                  </View>
                ))}
              </Accordion>

              <Accordion title="Live trades">
                {tradeTape(token.mint).map((t, i) => (
                  <View key={i} style={s.tape}>
                    <Text style={[s.tapeSide, { color: t.buy ? colors.bull : colors.bear }]}>{t.buy ? 'Buy' : 'Sell'}</Text>
                    <Text style={s.tapeAmt}>${t.usd.toLocaleString()}</Text>
                    <Text style={s.tapeWallet}>{t.wallet}</Text>
                    <Text style={s.tapeAgo}>{t.ago}</Text>
                  </View>
                ))}
              </Accordion>

              <Accordion title="Token stats">
                <Stat label="Market cap" value={compactUsd(snap?.market_cap_usd)} />
                <Stat label="Liquidity" value={compactUsd(snap?.liquidity_usd)} />
                <Stat label="24h volume" value={compactUsd(snap?.volume_24h_usd)} />
                <Stat label="Holders" value={snap?.holder_count != null ? snap.holder_count.toLocaleString() : '—'} />
                <Stat label="Age" value={ageShort(token.created_at) || '—'} />
              </Accordion>

              <Accordion title="About">
                <AboutBody token={token} open={open} />
              </Accordion>
            </View>
          ) : (
            <>
              <View style={s.tabs}>
                {TABS.map((t, i) => (
                  <PressScale key={t} onPress={() => setTab(i)} to={0.94} style={s.tabBtn}>
                    <Text style={[s.tabText, i === tab && s.tabTextActive]}>{t}</Text>
                    {i === tab ? <View style={s.tabUnderline} /> : null}
                  </PressScale>
                ))}
                <View style={s.modePill}>
                  <Text style={s.modePillText}>Simple</Text>
                </View>
              </View>

              {tab === 0 ? (
                <View style={s.panel}>
                  <Stat label="Market cap" value={compactUsd(snap?.market_cap_usd)} />
                  <Stat label="Liquidity" value={compactUsd(snap?.liquidity_usd)} />
                  <Stat label="24h volume" value={compactUsd(snap?.volume_24h_usd)} />
                  <Stat label="Holders" value={snap?.holder_count != null ? snap.holder_count.toLocaleString() : '—'} />
                  <Stat label="Age" value={ageShort(token.created_at) || '—'} />
                  <Text style={s.advHint}>Tap the center nav button for Advanced — full holder & risk breakdown.</Text>
                </View>
              ) : (
                <View style={s.panel}>
                  <AboutBody token={token} open={open} />
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <View style={[s.buyBar, { bottom: insets.bottom + 14 }]}>
        {advanced ? (
          <View style={s.buyRow}>
            <PressScale style={[s.tradeBtn, { backgroundColor: colors.bull }]} onPress={() => setBuy({ open: true, side: 'buy' })}>
              <Text style={s.tradeText}>Buy</Text>
            </PressScale>
            <PressScale style={[s.tradeBtn, { backgroundColor: colors.bear }]} onPress={() => setBuy({ open: true, side: 'sell' })}>
              <Text style={s.tradeText}>Sell</Text>
            </PressScale>
          </View>
        ) : (
          <GlossButton onPress={() => (CROSSMINT_READY ? setCmBuy(true) : setDeposit(true))}>
            <Text style={s.buyText}>{CROSSMINT_READY ? `Buy ${sym} with Apple Pay` : 'Deposit to buy'}</Text>
          </GlossButton>
        )}
      </View>
      </Animated.View>

      <DepositFlow visible={deposit} onClose={() => setDeposit(false)} />
      <CrossmintBuySheet visible={cmBuy} onClose={() => setCmBuy(false)} bundle={live} />
      <BuySheet
        key={buy.side}
        visible={buy.open}
        onClose={() => setBuy((b) => ({ ...b, open: false }))}
        bundle={live}
        advanced={advanced}
        initialSide={buy.side}
      />
      <RecentTradesDrawer visible={tradesOpen} onClose={() => setTradesOpen(false)} mint={token.mint} wallet={wallet} />
      <PnlShareCard
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        symbol={sym}
        name={token.name}
        image={token.image_url}
        pnlUsd={sharePnlUsd}
        pnlPct={sharePnlPct}
        investedUsd={shareInvested}
      />
      {holderShare ? (
        <PnlShareCard
          visible
          onClose={() => setHolderShare(null)}
          symbol={holderShare.symbol}
          name={holderShare.name}
          image={holderShare.image}
          pnlUsd={holderShare.pnlUsd}
          pnlPct={holderShare.pnlPct}
          investedUsd={holderShare.investedUsd}
        />
      ) : null}
    </Screen>
  );
}

// ---- operator console pieces ----

/** "$32,941.70" / "46.54%" → number. */
const parseAmt = (v: string) => Number(String(v).replace(/[^0-9.-]/g, '')) || 0;

function seed(mint: string, salt: number): number {
  let h = salt * 2654435761;
  for (let i = 0; i < mint.length; i++) h = (h * 31 + mint.charCodeAt(i)) >>> 0;
  return (h % 10000) / 10000;
}

function tradeTape(mint: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const r = seed(mint, 20 + i);
    return {
      buy: r > 0.42,
      usd: Math.round(40 + seed(mint, 50 + i) * 4800),
      wallet: `${mint.slice(0, 4)}…${mint.slice(6 + i, 10 + i) || mint.slice(-4)}`,
      ago: `${Math.round(3 + seed(mint, 70 + i) * 140)}s`,
    };
  });
}

function tone(v: number, good: number, warn: number): string {
  if (v <= good) return colors.bull;
  if (v <= warn) return colors.warn;
  return colors.bear;
}

function RiskRows({ token, snap }: { token: PulseBundle['token']; snap: PulseBundle['snapshot'] }) {
  const mint = token.mint;
  const top10 = pctNum(snap?.top10_holder_pct);
  const dev = pctNum(snap?.dev_holding_pct);
  const sniper = round1(2 + seed(mint, 1) * 16);
  const bundler = round1(seed(mint, 2) * 11);
  const insider = round1(seed(mint, 3) * 8);
  const lpLocked = token.is_lp_locked;
  const mintActive = Boolean(token.mint_authority);
  const freezeActive = Boolean(token.freeze_authority);

  return (
    <>
      <RiskRow label="Top 10 holders" value={top10 ? `${top10.toFixed(0)}%` : '—'} color={top10 ? tone(top10, 25, 40) : colors.fgMuted} />
      <RiskRow label="Dev holding" value={dev ? `${dev.toFixed(1)}%` : '—'} color={dev ? tone(dev, 3, 10) : colors.bull} />
      <RiskRow label="Snipers" value={`${sniper.toFixed(1)}%`} color={tone(sniper, 8, 18)} />
      <RiskRow label="Bundlers" value={`${bundler.toFixed(1)}%`} color={tone(bundler, 5, 12)} />
      <RiskRow label="Insiders" value={`${insider.toFixed(1)}%`} color={tone(insider, 4, 9)} />
      <RiskRow label="Liquidity" value={lpLocked ? 'Locked' : lpLocked === false ? 'Unlocked' : '—'} color={lpLocked ? colors.bull : lpLocked === false ? colors.bear : colors.fgMuted} />
      <RiskRow label="Mint authority" value={mintActive ? 'Active' : 'Revoked'} color={mintActive ? colors.bear : colors.bull} />
      <RiskRow label="Freeze authority" value={freezeActive ? 'Active' : 'Revoked'} color={freezeActive ? colors.bear : colors.bull} />
    </>
  );
}

function RiskRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={s.stat}>
      <View style={[s.riskDot, { backgroundColor: color }]} />
      <Text style={s.statLabel}>{label}</Text>
      <View style={s.leader} />
      <Text style={[s.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function AboutBody({ token, open }: { token: PulseBundle['token']; open: (u?: string | null) => void }) {
  return (
    <>
      <Text style={s.about}>{token.description ?? 'No description available for this token.'}</Text>
      <View style={s.linkRow}>
        <PressScale onPress={() => open(token.website_url)} style={[s.linkBtn, !token.website_url && s.linkOff]}>
          <Ionicons name="globe-outline" size={16} color={colors.fg} />
          <Text style={s.linkText}>Website</Text>
        </PressScale>
        <PressScale onPress={() => open(token.twitter_handle)} style={[s.linkBtn, !token.twitter_handle && s.linkOff]}>
          <Ionicons name="logo-twitter" size={16} color={colors.fg} />
          <Text style={s.linkText}>Twitter</Text>
        </PressScale>
      </View>
      <Stat label="Launchpad" value={token.launch_pad ?? '—'} />
      <Stat label="LP" value={token.is_lp_locked == null ? '—' : token.is_lp_locked ? 'Locked' : 'Unlocked'} />
      <Stat label="Mint authority" value={token.mint_authority ? 'Active' : 'Revoked'} />
      <PressScale onPress={async () => { await copyText(token.mint); Vibration.vibrate(8); }}>
        <Stat label="Contract · tap to copy" value={shortMint(token.mint)} accent />
      </PressScale>
    </>
  );
}

function pctNum(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n <= 1 ? n * 100 : n;
}
const round1 = (n: number) => Math.round(n * 10) / 10;

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <View style={s.leader} />
      <Text style={[s.statValue, accent && { color: colors.accentGlow }]}>{value}</Text>
    </View>
  );
}

/** "Traders here" — who's positioned in this token and how they're doing (avg
 *  entry, P&L, size). Read-only profitability visibility; copy-trade lives on a
 *  trader's profile. */
function TradersHere({
  mint,
  price,
  onOpenTrader,
  onShare,
}: {
  mint: string;
  price: number;
  onOpenTrader: (t: { handle: string; name?: string; color?: string; initial?: string }) => void;
  onShare: (t: TokenTrader) => void;
}) {
  const traders = React.useMemo(() => getTradersOnToken(mint, price), [mint, price]);
  if (!traders.length) return null;
  const openX = (handle: string) => Linking.openURL(`https://x.com/${handle}`).catch(() => {});
  return (
    <View style={s.thCard}>
      <GlassFill />
      <View style={s.thHead}>
        <Ionicons name="people-outline" size={15} color={colors.accentGlow} />
        <Text style={s.thTitle}>Traders here</Text>
        <Text style={s.thHint}>Tap P&L to share</Text>
      </View>
      {traders.map((t) => {
        const profile = { handle: t.handle, name: t.name, color: t.color, initial: t.initial };
        return (
          <View key={t.handle} style={s.thRow}>
            <PressScale onPress={() => onOpenTrader(profile)} to={0.9} hitSlop={4} style={[s.thAvatar, { backgroundColor: t.color }]}>
              <Text style={s.thAvatarText}>{t.initial}</Text>
            </PressScale>
            <View style={{ flex: 1 }}>
              <View style={s.thNameLine}>
                <PressScale onPress={() => onOpenTrader(profile)} to={0.94} hitSlop={4} style={{ flexShrink: 1 }}>
                  <Text style={s.thName} numberOfLines={1}>
                    {t.name}
                  </Text>
                </PressScale>
                {t.xConnected ? (
                  <PressScale onPress={() => openX(t.handle)} to={0.85} hitSlop={8}>
                    <XBadge size={13} />
                  </PressScale>
                ) : null}
              </View>
              <Text style={s.thMeta} numberOfLines={1}>
                avg {priceUsd(t.avgEntryUsd)}
                <Text style={s.thMuted}> · holds {compactUsd(t.holdingUsd)}</Text>
              </Text>
            </View>
            <PressScale onPress={() => onShare(t)} to={0.88} hitSlop={8} style={s.thPnlBtn}>
              <Text style={[s.thPnl, { color: t.pnlPct >= 0 ? colors.bull : colors.bear }]}>
                {t.pnlPct >= 0 ? '▲' : '▼'} {Math.abs(t.pnlPct).toFixed(0)}%
              </Text>
              <Ionicons name="share-outline" size={12} color={colors.fgMuted} />
            </PressScale>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  pad: { paddingHorizontal: 18 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: 18 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  coinWrap: { width: 46, height: 46 },
  coinChain: { position: 'absolute', top: -3, right: -3, borderWidth: 2, borderColor: colors.bg },
  symbol: { color: colors.fg, fontSize: 21, fontWeight: '600' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  name: { color: colors.fgMuted, fontSize: 13 },
  socials: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7 },
  socialDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.bgRaised2, alignItems: 'center', justifyContent: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14 },
  price: { color: colors.fg, fontSize: 34, fontWeight: '700', letterSpacing: -1 },
  mcTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  mcValue: { color: colors.fg, fontSize: 18, fontWeight: '600' },
  mcLabel: { color: colors.fgMuted, fontSize: 12 },
  chart: { marginTop: 16 },
  tfRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12, paddingHorizontal: 2 },
  tf: { color: colors.fgFaint, fontSize: 13 },
  tfActive: { color: colors.fg, fontWeight: '600', backgroundColor: colors.bgRaised2, paddingVertical: 6, paddingHorizontal: 11, borderRadius: radius.sm, overflow: 'hidden' },

  console: { marginTop: 18 },
  consoleHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  consoleTitle: { color: colors.fg, fontSize: 16, fontWeight: '700', flex: 1 },

  tabs: { flexDirection: 'row', gap: 30, marginTop: 18, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBtn: { paddingBottom: 12 },
  tabText: { color: colors.fgFaint, fontSize: 16 },
  tabTextActive: { color: colors.fg, fontWeight: '600' },
  tabUnderline: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, backgroundColor: colors.accent },
  modePill: { marginLeft: 'auto', alignSelf: 'center', marginBottom: 10, backgroundColor: colors.bgRaised2, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 4 },
  modePillOn: { backgroundColor: colors.accentSoft, marginBottom: 0 },
  modePillText: { color: colors.fgMuted, fontSize: 12, fontWeight: '600' },
  modePillTextOn: { color: colors.accentGlow },
  advHint: { color: colors.fgFaint, fontSize: 13, marginTop: 12, lineHeight: 18 },
  panel: { marginTop: 8 },
  about: { color: colors.fgSecondary, fontSize: 14, lineHeight: 20, marginVertical: 12 },
  linkRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  linkBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.bgRaised, borderRadius: radius.md, paddingVertical: 13 },
  linkOff: { opacity: 0.4 },
  linkText: { color: colors.fg, fontSize: 15, fontWeight: '600' },

  stat: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  riskDot: { width: 7, height: 7, borderRadius: 4, marginRight: 9 },
  statLabel: { color: colors.fgMuted, fontSize: 14 },
  leader: { flex: 1, height: 1, borderBottomWidth: 1, borderBottomColor: colors.border, borderStyle: 'dotted', marginHorizontal: 8, transform: [{ translateY: 3 }] },
  statValue: { color: colors.fg, fontSize: 14, fontWeight: '600' },

  holder: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9 },
  holderRank: { color: colors.fgMuted, fontSize: 13, fontWeight: '600', width: 22 },
  holderAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  holderInitial: { color: '#fff', fontSize: 14, fontWeight: '600' },
  holderName: { color: colors.fg, fontSize: 14, fontWeight: '600' },
  holderHold: { color: colors.fgMuted, fontSize: 12, marginTop: 1 },
  holderValue: { color: colors.fg, fontSize: 14, fontWeight: '600' },
  holderChg: { fontSize: 12, marginTop: 1 },
  holderShare: { paddingLeft: 10, paddingVertical: 4 },

  tape: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  tapeSide: { fontSize: 13, fontWeight: '700', width: 42 },
  tapeAmt: { color: colors.fg, fontSize: 14, fontWeight: '600', width: 84 },
  tapeWallet: { color: colors.fgSecondary, fontSize: 13, flex: 1 },
  tapeAgo: { color: colors.fgMuted, fontSize: 12 },

  thCard: { marginTop: 16, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', paddingHorizontal: 14, paddingBottom: 6, paddingTop: 12 },
  thHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  thTitle: { color: colors.fg, fontSize: 15, fontWeight: '700', flex: 1 },
  thHint: { color: colors.fgMuted, fontSize: 12 },
  thRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  thAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  thAvatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  thNameLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  thName: { color: colors.fg, fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  thMeta: { color: colors.fgSecondary, fontSize: 12.5, marginTop: 2 },
  thMuted: { color: colors.fgMuted },
  thPnlBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 8, paddingVertical: 2 },
  thPnl: { fontSize: 14, fontWeight: '700' },

  buyBar: { position: 'absolute', left: 16, right: 16 },
  buyBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  buyText: { color: colors.onAccent, fontSize: 17, fontWeight: '700' },
  buyRow: { flexDirection: 'row', gap: 10 },
  tradeBtn: { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  tradeText: { color: '#04050A', fontSize: 17, fontWeight: '700' },
});
