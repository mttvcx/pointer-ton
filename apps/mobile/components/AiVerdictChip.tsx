import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { explainToken, deriveVerdict } from '../src/api/endpoints';
import { DEMO } from '../src/auth';
import type { ExplainTokenResponse, PulseBundle, Verdict } from '../src/types';
import { colors, radius } from '../src/theme';
import { GlassFill } from './GlassFill';

/**
 * THE WEDGE — a plain-English AI safety verdict that sits above the Buy button on
 * every token, with "Why?" expanding to the real bull/bear/risk bullets. This is
 * the "you're never trading blind" moment FOMO structurally can't match.
 *
 * In DEMO mode the verdict is DERIVED from the token's real on-chain metrics
 * (dev %, top-10 %, LP lock, mint authority, holders) so each token reads
 * differently — clearly stubbed, but realistic. The real /api/ai/explain-token
 * endpoint drops in unchanged when auth is wired.
 */
const META: Record<Verdict, { label: string; fg: string; bg: string }> = {
  healthy: { label: 'Looks healthy', fg: colors.bull, bg: colors.bullSoft },
  caution: { label: 'Caution', fg: colors.warn, bg: colors.warnSoft },
  high_risk: { label: 'High rug risk', fg: colors.bear, bg: colors.bearSoft },
};

// deterministic 0..1 from the mint, so the "live" extras don't flicker per render
function seed(mint: string, salt: number): number {
  let h = salt * 2654435761;
  for (let i = 0; i < mint.length; i++) h = (h * 31 + mint.charCodeAt(i)) >>> 0;
  return (h % 10000) / 10000;
}
const normPct = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n <= 1 ? n * 100 : n;
};

export function demoVerdict(bundle: PulseBundle): ExplainTokenResponse {
  const { token, snapshot } = bundle;
  const mint = token.mint;
  const devPct = normPct(snapshot?.dev_holding_pct);
  const top10 = normPct(snapshot?.top10_holder_pct);
  const holders = snapshot?.holder_count ?? 0;
  const lpLocked = token.is_lp_locked;
  const mintActive = Boolean(token.mint_authority);
  const smartBuyers = Math.round(seed(mint, 7) * 5);
  const volTrend = Math.round((seed(mint, 9) - 0.5) * 64);

  const bull: string[] = [];
  const bear: string[] = [];
  const risk: string[] = [];

  if (lpLocked) bull.push('Liquidity is locked');
  else if (lpLocked === false) risk.push('LP is not locked');
  if (devPct > 0 && devPct < 5) bull.push(`Dev holds only ${devPct.toFixed(1)}%`);
  else if (devPct >= 10) risk.push(`Dev holds ${devPct.toFixed(1)}% of supply`);
  if (top10 >= 40) risk.push(`Top 10 wallets hold ${top10.toFixed(0)}%`);
  else if (top10 > 0) bull.push(`Supply is spread — top 10 hold ${top10.toFixed(0)}%`);
  if (mintActive) risk.push('Mint authority still active');
  if (holders > 1000) bull.push(`${holders.toLocaleString()} holders`);
  if (smartBuyers >= 2) bull.push(`${smartBuyers} smart-money wallets bought recently`);
  else bear.push('Little smart-money interest so far');
  if (volTrend <= -10) bear.push(`Volume down ~${Math.abs(volTrend)}% in the last hour`);
  else if (volTrend >= 10) bull.push(`Volume up ~${volTrend}% in the last hour`);

  const confidence: ExplainTokenResponse['data']['confidence'] = holders > 500 ? 'high' : holders > 80 ? 'medium' : 'low';
  const summary =
    risk.length >= 2
      ? 'Several red flags — concentrated supply and/or open authorities. Treat as high risk.'
      : risk.length === 1
        ? 'Mostly clean, with one flag worth watching. Reasonable to scout a small size.'
        : 'Liquidity and distribution look healthy. Momentum is the main variable here.';

  return { data: { summary, bullCase: bull, bearCase: bear, riskFlags: risk, confidence } };
}

export function AiVerdictChip({ bundle, expandable = true }: { bundle: PulseBundle; expandable?: boolean }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ['explain-token', bundle.token.mint],
    queryFn: () => explainToken(bundle.token.mint, 'fast'),
    staleTime: 5 * 60_000,
    retry: 1,
    enabled: !DEMO,
    initialData: DEMO ? demoVerdict(bundle) : undefined,
  });

  if (!DEMO && q.isLoading) {
    return (
      <View style={[s.chip, { backgroundColor: colors.bgRaised }]}>
        <ActivityIndicator size="small" color={colors.fgMuted} />
        <Text style={[s.label, { color: colors.fgMuted }]}>Reading the chain…</Text>
      </View>
    );
  }
  if (q.isError || !q.data) {
    return (
      <View style={[s.chip, { backgroundColor: colors.bgRaised }]}>
        <Text style={[s.label, { color: colors.fgMuted }]}>AI read unavailable</Text>
      </View>
    );
  }

  const d = q.data.data;
  const verdict = deriveVerdict(d.riskFlags, d.confidence);
  const m = META[verdict];

  return (
    <View>
      <Pressable disabled={!expandable} onPress={() => setOpen((v) => !v)} style={[s.chip, { backgroundColor: m.bg, borderColor: m.fg + '55' }]}>
        <View style={[s.dot, { backgroundColor: m.fg }]} />
        <Text style={[s.label, { color: m.fg }]}>{m.label}</Text>
        {expandable ? <Text style={[s.why, { color: m.fg }]}>{open ? 'Hide' : 'Why?'}</Text> : null}
      </Pressable>

      {open ? (
        <View style={s.detail}>
          <GlassFill />
          <Text style={s.summary}>{d.summary}</Text>
          {d.riskFlags.length ? <Section title="Risk flags" items={d.riskFlags} color={colors.bear} /> : null}
          {d.bullCase.length ? <Section title="Bull case" items={d.bullCase} color={colors.bull} /> : null}
          {d.bearCase.length ? <Section title="Bear case" items={d.bearCase} color={colors.fgSecondary} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function Section({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={[s.secTitle, { color }]}>{title}</Text>
      {items.map((it, i) => (
        <Text key={i} style={s.bullet}>
          • {it}
        </Text>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: 'transparent', paddingHorizontal: 12, paddingVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 13, fontWeight: '700', flex: 1 },
  why: { fontSize: 12, fontWeight: '600' },
  detail: { marginTop: 8, gap: 10, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: 12 },
  summary: { color: colors.fg, fontSize: 13, lineHeight: 19 },
  secTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  bullet: { color: colors.fgSecondary, fontSize: 12, lineHeight: 17 },
});
