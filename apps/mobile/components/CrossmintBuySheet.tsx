import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DragSheet } from './DragSheet';
import { CoinIcon } from './CoinIcon';
import { ChainIcon } from './ChainIcon';
import { PressScale } from './PressScale';
import { GlassFill } from './GlassFill';
import { GlossButton } from './GlossButton';
import { colors, radius } from '../src/theme';
import { priceUsd, shortMint } from '../src/format';
import { useAuth } from '../src/auth';
import { CrossmintBuy, CROSSMINT_READY } from '../src/crossmint';
import type { PulseBundle } from '../src/types';

const PRESETS = ['5', '25', '50', '100'];

/**
 * Apple Pay → token, FOMO-style, via Crossmint. Pick a USD amount, tap Apple Pay,
 * the token is delivered to your wallet. The actual Apple Pay sheet is Crossmint's
 * native embedded checkout (real build only); in Expo Go / demo we show an honest
 * "runs in the dev build" note instead of faking a charge.
 */
export function CrossmintBuySheet({ visible, onClose, bundle }: { visible: boolean; onClose: () => void; bundle: PulseBundle }) {
  const auth = useAuth();
  const [amount, setAmount] = useState('5');
  const [done, setDone] = useState(false);

  const token = bundle.token;
  const chain = token.chain ?? 'sol';
  const sym = (token.symbol ?? shortMint(token.mint)).replace(/^\$/, '');
  const recipient = chain === 'sol' ? auth.walletAddress : auth.evmAddress;
  const canCheckout = CROSSMINT_READY && Boolean(recipient);

  const close = () => {
    setDone(false);
    onClose();
  };

  return (
    <DragSheet visible={visible} onClose={close}>
      {done ? (
        <View style={s.done}>
          <View style={s.doneIcon}>
            <Ionicons name="checkmark" size={34} color={colors.bull} />
          </View>
          <Text style={s.doneTitle}>You bought</Text>
          <Text style={s.doneAmt}>${amount}</Text>
          <Text style={s.doneSub}>of {sym} · delivered to your wallet</Text>
          <GlossButton onPress={close} style={{ marginTop: 22 }}>
            <Text style={s.payText}>Done</Text>
          </GlossButton>
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
                <PressScale key={p} onPress={() => setAmount(p)} to={0.94} style={[s.preset, on && s.presetOn]}>
                  <GlassFill active={on} />
                  <Text style={[s.presetText, on && s.presetTextOn]}>${p}</Text>
                </PressScale>
              );
            })}
          </View>

          {canCheckout ? (
            <View style={s.checkoutWrap}>
              {/* Crossmint's native embedded checkout renders the Apple Pay button. */}
              <CrossmintBuy
                chain={chain}
                mint={token.mint}
                amountUsd={amount}
                recipientWallet={recipient as string}
                onCompleted={() => setDone(true)}
              />
            </View>
          ) : (
            <View style={s.fallback}>
              <GlassFill />
              <Ionicons name="logo-apple" size={22} color={colors.fgSecondary} />
              <Text style={s.fallbackTitle}>Apple Pay checkout runs in the app build</Text>
              <Text style={s.fallbackBody}>
                Buying ${amount} of {sym} with Apple Pay is powered by Crossmint and needs the native build (and a
                signed-in wallet). In this preview it's simulated.
              </Text>
              <GlossButton onPress={() => setDone(true)} style={{ marginTop: 14 }}>
                <Text style={s.payText}>Simulate buy</Text>
              </GlossButton>
            </View>
          )}

          <Text style={s.terms}>Cross-chain buy delivered to your wallet · powered by Crossmint</Text>
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

  fallback: { marginTop: 20, borderRadius: radius.lg, padding: 18, alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  fallbackTitle: { color: colors.fg, fontSize: 15, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  fallbackBody: { color: colors.fgMuted, fontSize: 13, lineHeight: 18, marginTop: 6, textAlign: 'center' },

  terms: { color: colors.fgFaint, fontSize: 11.5, textAlign: 'center', marginTop: 16, lineHeight: 16 },

  payText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },

  done: { alignItems: 'center', paddingVertical: 24 },
  doneIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bullSoft },
  doneTitle: { color: colors.fgMuted, fontSize: 15, marginTop: 16 },
  doneAmt: { color: colors.fg, fontSize: 48, fontWeight: '800', letterSpacing: -1.5, marginTop: 2 },
  doneSub: { color: colors.fgMuted, fontSize: 14, marginTop: 4 },
});
