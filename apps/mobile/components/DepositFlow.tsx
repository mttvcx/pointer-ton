import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { DragSheet } from './DragSheet';
import { CoinIcon } from './CoinIcon';
import { ChainIcon } from './ChainIcon';
import { PressScale } from './PressScale';
import { GlassFill } from './GlassFill';
import { GlossButton } from './GlossButton';
import { Slide } from './Slide';
import { colors, radius } from '../src/theme';
import { getLiveTokens, getOnramperUrl } from '../src/api/endpoints';
import { showToast } from '../src/toast';
import { compactUsd, priceUsd, pseudoChange } from '../src/format';
import { useAuth } from '../src/auth';
import { CrossmintBuy, CROSSMINT_READY } from '../src/crossmint';
import type { PulseBundle } from '../src/types';

type Step = 'choose' | 'pickToken' | 'payToken' | 'depositCash' | 'cryptoNetwork' | 'cryptoAddress';

// USDC is pinned to the top of the buy list — it's the cash you put to work + spend,
// so it's the default. It still filters normally when you search.
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_BUNDLE = {
  token: {
    mint: USDC_MINT,
    symbol: 'USDC',
    name: 'USD Coin',
    image_url: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    launch_pad: null,
  },
  snapshot: { price_usd: 1, market_cap_usd: null },
} as unknown as PulseBundle;
const NETWORKS = ['Solana', 'Base', 'BNB Chain', 'Monad', 'Hyperliquid', 'Ethereum'];
// Chain icon per network name (Monad/Hyperliquid have no logo asset → letter).
const NET_ICON: Record<string, string> = { Solana: 'sol', Ethereum: 'eth', Base: 'base', 'BNB Chain': 'bnb' };
const KEY_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'del'],
];

export function DepositFlow({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const auth = useAuth();
  const [step, setStep] = useState<Step>('choose');
  const [amount, setAmount] = useState('0');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<PulseBundle | null>(null);
  const [network, setNetwork] = useState('Solana');
  const [dir, setDir] = useState(1);
  const go = (st: Step, d = 1) => {
    setDir(d);
    setStep(st);
  };

  const q = useQuery({ queryKey: ['live-tokens'], queryFn: () => getLiveTokens(), staleTime: 30_000, enabled: visible });

  useEffect(() => {
    if (visible) {
      setStep('choose');
      setAmount('0');
      setQuery('');
      setPicked(null);
    }
  }, [visible]);

  const tokens = useMemo(() => {
    const all = (q.data ?? []).filter((b) => b.token.mint !== USDC_MINT);
    const t = query.trim().toLowerCase();
    const list = t
      ? all.filter((b) => (b.token.symbol ?? '').toLowerCase().includes(t) || (b.token.name ?? '').toLowerCase().includes(t))
      : all;
    // Pin USDC first — always by default, and while searching if it matches.
    const usdcMatches = !t || 'usdc'.includes(t) || 'usd coin'.includes(t);
    return usdcMatches ? [USDC_BUNDLE, ...list] : list;
  }, [q.data, query]);

  const press = (k: string) => {
    if (k === 'del') setAmount((a) => (a.length <= 1 ? '0' : a.slice(0, -1)));
    else if (k === '.') setAmount((a) => (a.includes('.') ? a : `${a}.`));
    else setAmount((a) => (a === '0' ? k : a + k));
  };

  const [cashBusy, setCashBusy] = useState(false);
  const depositCash = async () => {
    const wallet = auth.walletAddress;
    if (auth.demo || !wallet) {
      showToast('Card deposits run in the app build', { sub: 'Sign in on the real build to deposit', kind: 'info' });
      onClose();
      return;
    }
    setCashBusy(true);
    try {
      const url = await getOnramperUrl(wallet, Number(amount) || undefined);
      onClose();
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Deposit unavailable', e instanceof Error ? e.message : 'Card deposits aren’t available right now.');
    } finally {
      setCashBusy(false);
    }
  };

  return (
    <DragSheet visible={visible} onClose={onClose}>
      <Slide key={step} dir={dir}>
      {step === 'choose' ? (
        <View style={s.pb}>
          <Text style={s.title}>Deposit with</Text>
          <Option icon="qr-code-outline" title="Crypto" sub="Receive USDC from a crypto wallet" onPress={() => go('cryptoNetwork')} />
          <Option icon="logo-apple" title="Apple Pay" badge="New" sub="Buy USDC, PENGU, WIF, and 20+ tokens" onPress={() => go('pickToken')} />
          <Option icon="card-outline" title="Debit" sub="Deposit cash with a debit card" onPress={() => { setAmount('0'); go('depositCash'); }} />
        </View>
      ) : step === 'pickToken' ? (
        <View style={s.pb}>
          <View style={s.payHead}>
            <View style={s.payHeadLeft}>
              <Text style={s.payHeadTitle}>Buy with</Text>
              <Ionicons name="logo-apple" size={17} color={colors.fg} />
              <Text style={s.payHeadTitle}>Pay</Text>
            </View>
            <Text style={s.firstFree}>$0 fee on first buy</Text>
          </View>
          <View style={s.searchBar}>
            <GlassFill />
            <Ionicons name="search" size={18} color={colors.fgMuted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search for a token" placeholderTextColor={colors.fgFaint} style={s.searchInput} autoCorrect={false} autoCapitalize="none" />
          </View>
          <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {tokens.map((b) => {
              const sym = (b.token.symbol ?? '?').replace(/^\$/, '');
              const isUsdc = b.token.mint === USDC_MINT;
              const ch = pseudoChange(b.token.mint);
              return (
                <PressScale key={b.token.mint} onPress={() => { setPicked(b); setAmount('50'); go('payToken'); }} to={0.985} style={s.row}>
                  <View style={s.rowLeft}>
                    <CoinIcon uri={b.token.image_url} symbol={sym} verified={isUsdc || Boolean(b.token.launch_pad)} />
                    <View style={s.rowText}>
                      <Text style={s.ticker} numberOfLines={1}>{sym}</Text>
                      <Text style={s.mc}>{isUsdc ? 'Cash to spend & earn' : `${compactUsd(b.snapshot?.market_cap_usd)} MC`}</Text>
                    </View>
                  </View>
                  <View style={s.rowRight}>
                    <Text style={s.price}>{isUsdc ? '$1.00' : priceUsd(b.snapshot?.price_usd)}</Text>
                    {isUsdc ? (
                      <Text style={[s.ch, { color: colors.fgMuted }]}>Stablecoin</Text>
                    ) : (
                      <Text style={[s.ch, { color: ch.up ? colors.bull : colors.bear }]}>{ch.up ? '▲' : '▼'} {ch.pct}</Text>
                    )}
                  </View>
                </PressScale>
              );
            })}
            {q.isLoading ? <Text style={s.dim}>Loading tokens…</Text> : null}
          </ScrollView>
        </View>
      ) : step === 'payToken' && picked ? (
        <View style={s.pb}>
          <View style={s.tokHead}>
            <View style={s.rowLeft}>
              <CoinIcon uri={picked.token.image_url} symbol={picked.token.symbol} size={42} verified={Boolean(picked.token.launch_pad)} />
              <View style={s.rowText}>
                <Text style={s.ticker}>{(picked.token.symbol ?? '?').replace(/^\$/, '')}</Text>
                <Text style={s.mc}>{compactUsd(picked.snapshot?.market_cap_usd)} MC</Text>
              </View>
            </View>
            <Text style={s.price}>{priceUsd(picked.snapshot?.price_usd)}</Text>
          </View>
          <Text style={s.amount}>${amount}</Text>
          <Text style={s.amountSub}>$0 fee on your first buy · delivered to your wallet</Text>
          <Presets values={[50, 100, 500, 1500]} amount={amount} onPick={setAmount} />
          {CROSSMINT_READY && (picked.token.chain === 'sol' || !picked.token.chain ? auth.walletAddress : auth.evmAddress) ? (
            // Real Apple Pay → token via Crossmint (delivered to the Privy wallet).
            <View style={{ marginTop: 16, minHeight: 110 }}>
              <CrossmintBuy
                chain={picked.token.chain ?? 'sol'}
                mint={picked.token.mint}
                amountUsd={amount}
                recipientWallet={((picked.token.chain === 'sol' || !picked.token.chain ? auth.walletAddress : auth.evmAddress) ?? '') as string}
                onCompleted={onClose}
              />
            </View>
          ) : (
            <>
              <Keypad onPress={press} />
              <PressScale style={s.payBtn} onPress={onClose}>
                <Ionicons name="logo-apple" size={20} color="#000" />
                <Text style={s.payText}>Pay (demo)</Text>
              </PressScale>
            </>
          )}
        </View>
      ) : step === 'depositCash' ? (
        <View style={s.pb}>
          <StepHeader title="Deposit cash" onBack={() => go('choose', -1)} />
          <Text style={[s.amount, { marginTop: 18 }]}>${amount}</Text>
          <Presets values={[20, 100, 250, 500]} amount={amount} onPick={setAmount} />
          <Keypad onPress={press} />
          <View style={s.noteRow}>
            <Ionicons name="information-circle-outline" size={15} color={colors.fgMuted} />
            <Text style={s.note}>Debit cards have higher success rates · funds arrive as USDC</Text>
          </View>
          <GlossButton onPress={depositCash} style={{ marginTop: 12 }}>
            <Text style={s.continueText}>{cashBusy ? 'Opening…' : 'Continue'}</Text>
          </GlossButton>
        </View>
      ) : step === 'cryptoNetwork' ? (
        <View style={s.pb}>
          <StepHeader title="Deposit crypto" onBack={() => go('choose', -1)} />
          <Text style={s.netSub}>Choose a network to deposit from.</Text>
          {NETWORKS.map((n) => (
            <PressScale key={n} onPress={() => { setNetwork(n); go('cryptoAddress'); }} to={0.98} style={s.netRow}>
              <GlassFill />
              <Text style={s.netName}>{n}</Text>
              {NET_ICON[n] ? (
                <ChainIcon id={NET_ICON[n]} size={26} />
              ) : (
                <View style={s.netBadge}>
                  <Text style={s.netBadgeText}>{n.slice(0, 1)}</Text>
                </View>
              )}
            </PressScale>
          ))}
        </View>
      ) : step === 'cryptoAddress' ? (
        <View style={s.pb}>
          <StepHeader title={`Deposit on ${network}`} onBack={() => go('cryptoNetwork', -1)} />
          <Text style={s.netSub}>Send USDC on {network} to your address below.</Text>
          <View style={s.addrCard}>
            <GlassFill />
            <Text style={s.addrLabel}>{network} address</Text>
            <Text style={s.addr}>{(network === 'Solana' ? auth.walletAddress : auth.evmAddress) ?? '—'}</Text>
          </View>
          <PressScale style={s.copyBtn}>
            <GlassFill />
            <Ionicons name="copy-outline" size={18} color={colors.fg} />
            <Text style={s.copyText}>Copy wallet address</Text>
          </PressScale>
        </View>
      ) : null}
      </Slide>
    </DragSheet>
  );
}

function StepHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={s.head}>
      <PressScale onPress={onBack} to={0.85} hitSlop={10}>
        <Ionicons name="chevron-back" size={24} color={colors.fgSecondary} />
      </PressScale>
      <Text style={s.headTitle}>{title}</Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

function Keypad({ onPress }: { onPress: (k: string) => void }) {
  return (
    <View style={s.pad}>
      {KEY_ROWS.map((row, i) => (
        <View key={i} style={s.padRow}>
          {row.map((k) => (
            <Pressable key={k} onPress={() => onPress(k)} style={({ pressed }) => [s.key, pressed && s.keyPressed]}>
              {k === 'del' ? <Ionicons name="backspace-outline" size={26} color={colors.fg} /> : <Text style={s.keyText}>{k}</Text>}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

function Presets({ values, amount, onPick }: { values: number[]; amount: string; onPick: (v: string) => void }) {
  return (
    <View style={s.presets}>
      {values.map((p) => {
        const on = String(p) === amount;
        return (
          <PressScale key={p} onPress={() => onPick(String(p))} to={0.94} style={[s.preset, on && s.presetOn]}>
            <GlassFill active={on} />
            <Text style={[s.presetText, on && s.presetTextOn]}>${p.toLocaleString()}</Text>
          </PressScale>
        );
      })}
    </View>
  );
}

function Option({
  icon,
  title,
  sub,
  badge,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  sub: string;
  badge?: string;
  onPress: () => void;
}) {
  return (
    <PressScale onPress={onPress} to={0.98} style={s.option}>
      <GlassFill />
      <View style={{ flex: 1 }}>
        <View style={s.optionTitleRow}>
          <Text style={s.optionTitle}>{title}</Text>
          {badge ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={s.optionSub}>{sub}</Text>
      </View>
      <Ionicons name={icon} size={24} color={colors.fgSecondary} />
    </PressScale>
  );
}

const s = StyleSheet.create({
  pb: { paddingBottom: 4 },
  title: { color: colors.fg, fontSize: 20, fontWeight: '600', textAlign: 'center', marginBottom: 18 },
  option: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: 18, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  optionTitle: { color: colors.fg, fontSize: 19, fontWeight: '600' },
  badge: { backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: colors.onAccent, fontSize: 12, fontWeight: '600' },
  optionSub: { color: colors.fgMuted, fontSize: 14, marginTop: 4 },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headTitle: { color: colors.fg, fontSize: 17, fontWeight: '600' },

  payHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  payHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  payHeadTitle: { color: colors.fg, fontSize: 18, fontWeight: '600' },
  firstFree: { color: colors.accentGlow, fontSize: 14, fontWeight: '500' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  searchInput: { flex: 1, color: colors.fg, fontSize: 16, padding: 0 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowText: { flex: 1 },
  ticker: { color: colors.fg, fontSize: 17, fontWeight: '600' },
  mc: { color: colors.fgMuted, fontSize: 13, marginTop: 1 },
  rowRight: { alignItems: 'flex-end' },
  price: { color: colors.fg, fontSize: 16, fontWeight: '600' },
  ch: { fontSize: 13, marginTop: 1 },
  dim: { color: colors.fgMuted, fontSize: 14, textAlign: 'center', marginTop: 16 },

  tokHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  amount: { color: colors.fg, fontSize: 60, fontWeight: '700', letterSpacing: -2, textAlign: 'center', marginTop: 22 },
  amountSub: { color: colors.accentGlow, fontSize: 14, textAlign: 'center', marginTop: 6 },
  presets: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 22 },
  preset: { borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  presetOn: { borderColor: 'rgba(255,255,255,0.28)' },
  presetText: { color: colors.fgSecondary, fontSize: 15, fontWeight: '600' },
  presetTextOn: { color: colors.fg, fontWeight: '700' },
  pad: { marginTop: 16 },
  padRow: { flexDirection: 'row' },
  key: { flex: 1, height: 58, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  keyPressed: { backgroundColor: colors.bgRaised },
  keyText: { color: colors.fg, fontSize: 28, fontWeight: '600' },

  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 16, marginTop: 14 },
  payText: { color: '#000', fontSize: 18, fontWeight: '600' },
  noteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
  note: { color: colors.fgMuted, fontSize: 13 },
  continueBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  continueText: { color: colors.onAccent, fontSize: 17, fontWeight: '600' },

  netSub: { color: colors.fgMuted, fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  netRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  netName: { color: colors.fg, fontSize: 17, fontWeight: '600' },
  netBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.bgRaised2, alignItems: 'center', justifyContent: 'center' },
  netBadgeText: { color: colors.fgSecondary, fontSize: 13, fontWeight: '700' },
  addrCard: { borderRadius: radius.lg, padding: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  addrLabel: { color: colors.fgMuted, fontSize: 13 },
  addr: { color: colors.fg, fontSize: 15, fontWeight: '500', marginTop: 6 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, paddingVertical: 14, marginTop: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  copyText: { color: colors.fg, fontSize: 15, fontWeight: '600' },
});
