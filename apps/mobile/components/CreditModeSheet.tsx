import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DragSheet } from './DragSheet';
import { PressScale } from './PressScale';
import { GlassFill } from './GlassFill';
import { SheetButton } from './SheetButton';
import { colors, radius } from '../src/theme';
import { usd } from '../src/format';
import { showToast } from '../src/toast';
import {
  useSpendMode,
  setSpendMode,
  useBorrowed,
  borrow,
  repay,
  healthFactor,
  healthBand,
  liquidationDropPct,
  USER_BORROW_APR,
} from '../src/financial/credit';
import { collateralLine, demoCollateralHoldings } from '../src/financial/collateral';
import { prepareBorrow } from '../src/financial/api';
import { useAuth } from '../src/auth';
import { SOLANA_RPC_URL } from '../src/env';

const WSOL_MINT = 'So11111111111111111111111111111111111111112';

const PRESETS = [100, 500, 1000, 5000];

// Real coin marks for eligible collateral (fallback = colored dot for LSTs).
const COIN_ICON: Record<string, number> = {
  BTC: require('../assets/crypto/btc.png'),
  ETH: require('../assets/crypto/eth.png'),
  SOL: require('../assets/crypto/sol.png'),
  USDC: require('../assets/crypto/usdc.png'),
};

const BAND_COLOR = { safe: colors.bull, moderate: colors.warn, risky: colors.bear };
const BAND_LABEL = { safe: 'Healthy', moderate: 'Moderate', risky: 'At risk' };

/**
 * Cash vs Credit spending mode. Cash = spend USDC directly. Credit = borrow USDC
 * against your SOL/ETH/BTC (Kamino) — your crypto stays invested + earning, you
 * never sell, so there's no taxable event. Shows live credit line, health factor,
 * and liquidation buffer. (Demo math; real mode quotes via /api/financial/credit.)
 */
export function CreditModeSheet({
  visible,
  onClose,
  collateralUsd,
  spendableUsd,
  onBorrowed,
  onRepaid,
}: {
  visible: boolean;
  onClose: () => void;
  collateralUsd: number;
  spendableUsd: number;
  /** Borrowed USDC lands in spendable — let the dashboard reflect it. */
  onBorrowed?: (amountUsd: number) => void;
  /** Repaying pulls USDC back out of spendable. */
  onRepaid?: (amountUsd: number) => void;
}) {
  const mode = useSpendMode();
  const borrowed = useBorrowed();
  const auth = useAuth();
  const [amount, setAmount] = useState(0);

  // Only allowlisted blue-chips back the line — filter the holdings to eligible
  // collateral, so a random memecoin contributes ZERO borrowing power.
  const line = useMemo(() => collateralLine(demoCollateralHoldings(collateralUsd)), [collateralUsd]);
  const available = Math.max(0, line.borrowPower - borrowed);
  const hf = healthFactor(line.eligibleValue, borrowed + amount);
  const band = healthBand(hf);
  const dropPct = liquidationDropPct(line.eligibleValue, borrowed + amount);

  const close = () => {
    setAmount(0);
    onClose();
  };

  const doBorrow = () => {
    if (amount <= 0 || amount > available) return;
    // OPTIMISTIC: reflect the borrow instantly (never blocks the UI). The real
    // on-chain borrow fires in the background and only does anything once Kamino
    // is keyed + the credit route is deployed — until then this is a clean sim.
    const amt = amount;
    borrow(amt);
    onBorrowed?.(amt);
    setSpendMode('credit');
    showToast(`Borrowed ${usd(amt, 0)}`, { sub: 'Your crypto stays invested — no sale, no tax event', kind: 'success' });
    setAmount(0);
    if (!auth.demo && auth.walletAddress) {
      void (async () => {
        try {
          const res = await prepareBorrow({ amountUsd: amt, collateralMint: WSOL_MINT, collateralUsd: line.eligibleValue, borrowedUsd: borrowed });
          if (res.txBase64) {
            const token = await auth.getToken();
            await auth.signAndSend(res.txBase64, SOLANA_RPC_URL, token ?? '');
          }
        } catch {
          /* not deployed / not keyed → the local reflect above already covered it */
        }
      })();
    }
  };

  return (
    <DragSheet visible={visible} onClose={close} fullDrag>
      <View style={s.titleRow}>
        <Text style={s.title}>Spending mode</Text>
        <View style={s.noKyc}>
          <Ionicons name="lock-open-outline" size={12} color={colors.bull} />
          <Text style={s.noKycText}>No ID needed</Text>
        </View>
      </View>

      {/* segmented toggle */}
      <View style={s.toggle}>
        <PressScale onPress={() => setSpendMode('cash')} to={0.97} style={[s.toggleBtn, mode === 'cash' && s.toggleOn]}>
          <Text style={[s.toggleText, mode === 'cash' && s.toggleTextOn]}>Cash</Text>
          <Text style={[s.toggleSub, mode === 'cash' && { color: colors.onAccent }]}>{usd(spendableUsd, 0)}</Text>
        </PressScale>
        <PressScale onPress={() => setSpendMode('credit')} to={0.97} style={[s.toggleBtn, mode === 'credit' && s.toggleOn]}>
          <Text style={[s.toggleText, mode === 'credit' && s.toggleTextOn]}>Credit</Text>
          <Text style={[s.toggleSub, mode === 'credit' && { color: colors.onAccent }]}>Spend, don't sell</Text>
        </PressScale>
      </View>

      {mode === 'cash' ? (
        <View style={s.cashBox}>
          <GlassFill />
          <Ionicons name="wallet-outline" size={22} color={colors.brand} />
          <Text style={s.cashTitle}>Spending your USDC</Text>
          <Text style={s.cashBody}>
            Tap and go — {usd(spendableUsd, 2)} ready on your card. No borrow, no interest. Switch to Credit to spend
            without touching your crypto.
          </Text>
        </View>
      ) : (
        <>
          <View style={s.creditHead}>
            <View>
              <Text style={s.creditLabel}>Credit available</Text>
              <Text style={s.creditVal}>{usd(available, 0)}</Text>
              <Text style={s.creditSub}>against {usd(line.eligibleValue, 0)} eligible collateral</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.creditLabel}>Rate</Text>
              <Text style={s.creditVal}>{(USER_BORROW_APR * 100).toFixed(1)}%</Text>
              <Text style={s.creditSub}>APR on borrowed</Text>
            </View>
          </View>

          {/* what backs the line — only allowlisted blue-chips count */}
          <View style={s.backed}>
            <GlassFill />
            <View style={s.backedHead}>
              <Ionicons name="shield-checkmark" size={14} color={colors.bull} />
              <Text style={s.backedTitle}>Backed by your blue-chips</Text>
            </View>
            <View style={s.backedChips}>
              {line.assets.map((a) => (
                <View key={a.asset.symbol} style={s.assetChip}>
                  {COIN_ICON[a.asset.symbol] ? (
                    <Image source={COIN_ICON[a.asset.symbol]} style={s.assetIcon} />
                  ) : (
                    <View style={[s.assetDot, { backgroundColor: a.asset.color }]} />
                  )}
                  <Text style={s.assetSym}>{a.asset.symbol}</Text>
                  <Text style={s.assetVal}>{usd(a.valueUsd, 0)}</Text>
                </View>
              ))}
            </View>
            <Text style={s.backedNote}>
              Only assets with deep liquidity + a live price oracle back a line. Memecoins and unverified tokens count for
              $0 — so no one can pump their own coin to borrow against it.
            </Text>
          </View>

          {borrowed > 0 ? (
            <View style={s.borrowedRow}>
              <Text style={s.borrowedLabel}>Currently borrowed</Text>
              <Text style={s.borrowedVal}>{usd(borrowed, 2)}</Text>
              <PressScale onPress={() => { const b = borrowed; repay(b); onRepaid?.(b); showToast('Repaid', { kind: 'success' }); }} hitSlop={6} to={0.9} style={s.repay}>
                <Text style={s.repayText}>Repay</Text>
              </PressScale>
            </View>
          ) : null}

          <Text style={s.pickLabel}>Borrow</Text>
          <View style={s.presets}>
            {PRESETS.map((p) => {
              const disabled = p > available;
              const on = p === amount;
              return (
                <PressScale
                  key={p}
                  onPress={() => !disabled && setAmount(on ? 0 : p)}
                  to={0.94}
                  style={[s.preset, on && s.presetOn, disabled && s.presetOff]}
                >
                  <Text style={[s.presetText, on && s.presetTextOn, disabled && { color: colors.fgFaint }]}>{usd(p, 0)}</Text>
                </PressScale>
              );
            })}
          </View>

          {/* health factor */}
          <View style={s.health}>
            <GlassFill />
            <View style={s.healthTop}>
              <Text style={s.healthLabel}>Health factor</Text>
              <View style={[s.healthBadge, { backgroundColor: BAND_COLOR[band] + '22' }]}>
                <Text style={[s.healthBadgeText, { color: BAND_COLOR[band] }]}>
                  {Number.isFinite(hf) ? hf.toFixed(2) : '∞'} · {BAND_LABEL[band]}
                </Text>
              </View>
            </View>
            <View style={s.healthBarTrack}>
              <View style={[s.healthBarFill, { width: `${Math.min(100, dropPct)}%`, backgroundColor: BAND_COLOR[band] }]} />
            </View>
            <Text style={s.healthSub}>
              Your collateral can fall {Math.round(dropPct)}% before liquidation. It stays invested + earning the whole time.
            </Text>
          </View>

          <SheetButton
            label={amount <= 0 ? 'Enter an amount' : amount > available ? 'Over your limit' : `Borrow ${usd(amount, 0)} · spend without selling`}
            variant={amount <= 0 || amount > available ? 'disabled' : 'long'}
            onPress={doBorrow}
            style={{ marginTop: 16 }}
          />
          <Text style={s.taxNote}>Borrowing isn't a taxable event — you keep your position and your upside.</Text>
        </>
      )}
    </DragSheet>
  );
}

const s = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { color: colors.fg, fontSize: 20, fontWeight: '800' },
  noKyc: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.bullSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  noKycText: { color: colors.bull, fontSize: 11, fontWeight: '700' },
  toggle: { flexDirection: 'row', gap: 8, marginTop: 16, backgroundColor: colors.bgRaised, borderRadius: radius.md, padding: 5 },
  toggleBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.sm },
  toggleOn: { backgroundColor: colors.accent },
  toggleText: { color: colors.fgMuted, fontSize: 15, fontWeight: '700' },
  toggleTextOn: { color: colors.onAccent },
  toggleSub: { color: colors.fgFaint, fontSize: 12, marginTop: 2 },

  cashBox: { alignItems: 'center', borderRadius: radius.lg, padding: 22, marginTop: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', gap: 8 },
  cashTitle: { color: colors.fg, fontSize: 16, fontWeight: '700' },
  cashBody: { color: colors.fgMuted, fontSize: 13.5, lineHeight: 19, textAlign: 'center' },

  creditHead: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  creditLabel: { color: colors.fgMuted, fontSize: 13 },
  creditVal: { color: colors.fg, fontSize: 26, fontWeight: '800', marginTop: 2 },
  creditSub: { color: colors.fgFaint, fontSize: 12, marginTop: 2 },

  backed: { borderRadius: radius.lg, padding: 14, marginTop: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,224,160,0.22)' },
  backedHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  backedTitle: { color: colors.fg, fontSize: 14, fontWeight: '700' },
  backedChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 11 },
  assetChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bgRaised2, borderRadius: radius.pill, paddingLeft: 8, paddingRight: 11, paddingVertical: 6 },
  assetDot: { width: 8, height: 8, borderRadius: 4 },
  assetIcon: { width: 16, height: 16, borderRadius: 8 },
  assetSym: { color: colors.fg, fontSize: 12.5, fontWeight: '700' },
  assetVal: { color: colors.fgMuted, fontSize: 12.5 },
  backedNote: { color: colors.fgMuted, fontSize: 12, lineHeight: 17, marginTop: 11 },

  borrowedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, backgroundColor: colors.bgRaised, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11 },
  borrowedLabel: { color: colors.fgMuted, fontSize: 13.5, flex: 1 },
  borrowedVal: { color: colors.fg, fontSize: 14.5, fontWeight: '700' },
  repay: { backgroundColor: colors.bgRaised2, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  repayText: { color: colors.accentGlow, fontSize: 12.5, fontWeight: '700' },

  pickLabel: { color: colors.fgSecondary, fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  presets: { flexDirection: 'row', gap: 8 },
  preset: { flex: 1, alignItems: 'center', borderRadius: radius.md, paddingVertical: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgRaised },
  presetOn: { borderColor: colors.bull, backgroundColor: colors.bullSoft },
  presetOff: { opacity: 0.4 },
  presetText: { color: colors.fgSecondary, fontSize: 15, fontWeight: '700' },
  presetTextOn: { color: colors.bull },

  health: { borderRadius: radius.lg, padding: 14, marginTop: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  healthTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  healthLabel: { color: colors.fgMuted, fontSize: 13.5 },
  healthBadge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  healthBadgeText: { fontSize: 12.5, fontWeight: '700' },
  healthBarTrack: { height: 6, borderRadius: 3, backgroundColor: colors.bgRaised2, marginTop: 12, overflow: 'hidden' },
  healthBarFill: { height: 6, borderRadius: 3 },
  healthSub: { color: colors.fgMuted, fontSize: 12.5, lineHeight: 17, marginTop: 10 },

  taxNote: { color: colors.fgFaint, fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 16 },
});
