import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DragSheet } from './DragSheet';
import { CoinIcon } from './CoinIcon';
import { ChainIcon } from './ChainIcon';
import { PressScale } from './PressScale';
import { GlassFill } from './GlassFill';
import { colors, radius } from '../src/theme';
import { priceUsd, shortMint } from '../src/format';
import { showToast } from '../src/toast';
import { useAuth } from '../src/auth';
import { createCrossmintOrder } from '../src/api/endpoints';
import { CROSSMINT_READY, CrossmintBuy } from '../src/crossmint';
import type { PulseBundle, ChainId } from '../src/types';

const PRESETS = ['5', '25', '50', '100'];

type Phase = 'amount' | 'processing' | 'checkout' | 'done' | 'unavailable';

/**
 * Buy a token with Apple Pay, FOMO-style: pick an amount → tap → the native Apple
 * Pay sheet (Crossmint's embedded checkout, Apple-Pay-only) → delivered to your
 * wallet. The order is created SERVER-side, so there's no card form and no
 * provider chrome. If the server key isn't set yet, we show an honest
 * "almost here" state rather than faking a charge.
 */
export function CrossmintBuySheet({ visible, onClose, bundle }: { visible: boolean; onClose: () => void; bundle: PulseBundle }) {
  const [amount, setAmount] = useState('5');
  const [phase, setPhase] = useState<Phase>('amount');
  const [order, setOrder] = useState<{ orderId: string; clientSecret: string } | null>(null);
  const auth = useAuth();

  const token = bundle.token;
  const chain = (token.chain ?? 'sol') as ChainId;
  const sym = (token.symbol ?? shortMint(token.mint)).replace(/^\$/, '');
  const recipient = chain === 'sol' ? auth.walletAddress : auth.evmAddress;

  const close = () => {
    setPhase('amount');
    setOrder(null);
    onClose();
  };

  const startBuy = async () => {
    if (!CROSSMINT_READY || !recipient) {
      setPhase('unavailable');
      return;
    }
    setPhase('processing');
    try {
      const res = await createCrossmintOrder({ chain, mint: token.mint, amountUsd: amount, recipient });
      if (!res.configured || !res.orderId || !res.clientSecret) {
        setPhase('unavailable');
        return;
      }
      setOrder({ orderId: res.orderId, clientSecret: res.clientSecret });
      setPhase('checkout');
    } catch {
      showToast("Couldn't start the purchase", { sub: 'Please try again in a moment', kind: 'error' });
      setPhase('amount');
    }
  };

  return (
    <DragSheet visible={visible} onClose={close}>
      {phase === 'done' ? (
        <View style={s.done}>
          <View style={s.doneIcon}>
            <Ionicons name="checkmark" size={34} color={colors.bull} />
          </View>
          <Text style={s.doneTitle}>You bought</Text>
          <Text style={s.doneAmt}>${amount}</Text>
          <Text style={s.doneSub}>of {sym} · delivered to your wallet</Text>
          <PressScale style={s.doneBtn} onPress={close}>
            <Text style={s.doneBtnText}>Done</Text>
          </PressScale>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <View style={s.coinWrap}>
              <CoinIcon uri={token.image_url} symbol={sym} size={40} verified={Boolean(token.launch_pad)} />
              {token.chain ? <ChainIcon id={token.chain} size={16} style={s.coinChain} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sym}>{sym}</Text>
              <Text style={s.price}>{priceUsd(bundle.snapshot?.price_usd)}</Text>
            </View>
            <View style={s.applePill}>
              <Ionicons name="logo-apple" size={13} color={colors.fg} />
              <Text style={s.applePillText}>Pay</Text>
            </View>
          </View>

          <Text style={s.amount}>${amount}</Text>
          <View style={s.presets}>
            {PRESETS.map((p) => {
              const on = p === amount;
              return (
                <PressScale
                  key={p}
                  onPress={() => phase === 'amount' && setAmount(p)}
                  to={0.94}
                  style={[s.preset, on && s.presetOn]}
                >
                  <GlassFill active={on} />
                  <Text style={[s.presetText, on && s.presetTextOn]}>${p}</Text>
                </PressScale>
              );
            })}
          </View>

          {phase === 'checkout' && order ? (
            <View style={s.checkoutWrap}>
              <CrossmintBuy
                orderId={order.orderId}
                clientSecret={order.clientSecret}
                onCompleted={() => setPhase('done')}
                onFailed={() => {
                  showToast('Payment not completed', { kind: 'error' });
                  setPhase('amount');
                }}
              />
            </View>
          ) : phase === 'processing' ? (
            <View style={s.processing}>
              <ActivityIndicator color={colors.accent} />
              <Text style={s.processingText}>Setting up Apple Pay…</Text>
            </View>
          ) : phase === 'unavailable' ? (
            <View style={s.fallback}>
              <GlassFill />
              <View style={s.applePayBtn}>
                <Ionicons name="logo-apple" size={19} color="#000" />
                <Text style={s.applePayText}>Pay</Text>
              </View>
              <Text style={s.fallbackTitle}>One-tap buy is almost here</Text>
              <Text style={s.fallbackBody}>
                Buy ${amount} of {sym} with Apple Pay, delivered straight to your wallet. We’re finishing the last mile so it lands seamlessly.
              </Text>
            </View>
          ) : (
            <PressScale style={s.payBtn} onPress={startBuy}>
              <Ionicons name="logo-apple" size={19} color="#000" />
              <Text style={s.payBtnText}>Buy ${amount} with Apple Pay</Text>
            </PressScale>
          )}

          <Text style={s.terms}>Delivered straight to your wallet.</Text>
        </ScrollView>
      )}
    </DragSheet>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  coinWrap: { width: 40, height: 40 },
  coinChain: { position: 'absolute', top: -3, right: -3, borderWidth: 2, borderColor: colors.bg },
  sym: { color: colors.fg, fontSize: 18, fontWeight: '700' },
  price: { color: colors.fgMuted, fontSize: 14, marginTop: 1 },
  applePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.bgRaised2, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  applePillText: { color: colors.fg, fontSize: 12.5, fontWeight: '700' },

  amount: { color: colors.fg, fontSize: 56, fontWeight: '700', letterSpacing: -2, textAlign: 'center', marginTop: 18 },
  presets: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16 },
  preset: { borderRadius: radius.md, paddingHorizontal: 18, paddingVertical: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  presetOn: { borderColor: 'rgba(255,255,255,0.28)' },
  presetText: { color: colors.fgSecondary, fontSize: 15, fontWeight: '600' },
  presetTextOn: { color: colors.fg, fontWeight: '700' },

  checkoutWrap: { marginTop: 20, minHeight: 120 },

  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: radius.md, paddingVertical: 15, marginTop: 24 },
  payBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },

  processing: { alignItems: 'center', gap: 12, paddingVertical: 34, marginTop: 8 },
  processingText: { color: colors.fgMuted, fontSize: 14 },

  fallback: { marginTop: 20, borderRadius: radius.lg, padding: 20, alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  applePayBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 9 },
  applePayText: { color: '#000', fontSize: 15, fontWeight: '700' },
  fallbackTitle: { color: colors.fg, fontSize: 15, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  fallbackBody: { color: colors.fgMuted, fontSize: 13, lineHeight: 18, marginTop: 6, textAlign: 'center' },

  terms: { color: colors.fgFaint, fontSize: 11.5, textAlign: 'center', marginTop: 16, lineHeight: 16 },

  done: { alignItems: 'center', paddingVertical: 24 },
  doneIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bullSoft },
  doneTitle: { color: colors.fgMuted, fontSize: 15, marginTop: 16 },
  doneAmt: { color: colors.fg, fontSize: 48, fontWeight: '800', letterSpacing: -1.5, marginTop: 2 },
  doneSub: { color: colors.fgMuted, fontSize: 14, marginTop: 4 },
  doneBtn: { backgroundColor: colors.bgRaised2, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 60, marginTop: 22 },
  doneBtnText: { color: colors.fg, fontSize: 16, fontWeight: '700' },
});
