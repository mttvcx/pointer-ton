import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTradeSubmit } from '../src/trade/useTradeSubmit';
import { AiVerdictChip } from './AiVerdictChip';
import { colors, radius } from '../src/theme';

const SOL_PRESETS = [0.1, 0.5, 1, 2];

/**
 * Trade sheet — preset amounts, the AI verdict REPEATED above the button (you
 * confirm with the safety read in view), and the ported sign-only → server-execute
 * flow. (USD-balance framing + slide-to-confirm/FaceID land with the single-balance
 * fast-follow; Phase 1 uses SOL amounts.)
 */
export function TradeSheet({
  mint,
  symbol,
  side,
  visible,
  onClose,
}: {
  mint: string;
  symbol: string;
  side: 'buy' | 'sell';
  visible: boolean;
  onClose: () => void;
}) {
  const { submit, hasWallet } = useTradeSubmit();
  const [amount, setAmount] = useState(SOL_PRESETS[0]);
  const [state, setState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const buy = side === 'buy';

  const onConfirm = async () => {
    setState('submitting');
    setMsg('');
    try {
      const { signature } = await submit({ mint, side, amountSol: amount });
      setState('done');
      setMsg(`Filled · ${signature.slice(0, 12)}…`);
    } catch (e) {
      setState('error');
      setMsg(e instanceof Error ? e.message : 'Trade failed');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <Text style={s.title}>
          {buy ? 'Buy' : 'Sell'} {symbol}
        </Text>

        <AiVerdictChip mint={mint} expandable />

        <Text style={s.label}>Amount (SOL)</Text>
        <View style={s.presets}>
          {SOL_PRESETS.map((p) => (
            <Pressable
              key={p}
              onPress={() => setAmount(p)}
              style={[s.preset, amount === p && s.presetActive]}
            >
              <Text style={[s.presetText, amount === p && s.presetTextActive]}>{p}</Text>
            </Pressable>
          ))}
        </View>

        {state === 'done' ? (
          <Text style={[s.result, { color: colors.bull }]}>{msg}</Text>
        ) : state === 'error' ? (
          <Text style={[s.result, { color: colors.bear }]}>{msg}</Text>
        ) : null}

        <Pressable
          disabled={!hasWallet || state === 'submitting'}
          onPress={onConfirm}
          style={[
            s.cta,
            { backgroundColor: buy ? colors.bull : colors.bear },
            (!hasWallet || state === 'submitting') && { opacity: 0.5 },
          ]}
        >
          {state === 'submitting' ? (
            <ActivityIndicator color="#04110b" />
          ) : (
            <Text style={s.ctaText}>
              {!hasWallet ? 'No wallet' : `${buy ? 'Buy' : 'Sell'} ${amount} SOL`}
            </Text>
          )}
        </Pressable>
        <Pressable onPress={onClose} style={s.cancel}>
          <Text style={s.cancelText}>{state === 'done' ? 'Done' : 'Cancel'}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.bgRaised,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 36,
    gap: 14,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong },
  title: { color: colors.fg, fontSize: 20, fontWeight: '800' },
  label: { color: colors.fgSecondary, fontSize: 12, fontWeight: '600' },
  presets: { flexDirection: 'row', gap: 8 },
  preset: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bgSunken,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  presetActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  presetText: { color: colors.fgSecondary, fontWeight: '700' },
  presetTextActive: { color: colors.fg },
  result: { fontSize: 12, fontFamily: 'Courier' },
  cta: { borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  ctaText: { color: '#04110b', fontSize: 16, fontWeight: '800' },
  cancel: { alignItems: 'center', paddingVertical: 6 },
  cancelText: { color: colors.fgMuted, fontWeight: '600' },
});
