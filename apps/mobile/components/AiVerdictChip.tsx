import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { explainToken, deriveVerdict } from '../src/api/endpoints';
import type { Verdict } from '../src/types';
import { colors, radius } from '../src/theme';

/**
 * THE WEDGE — a plain-English AI safety verdict that sits above the Buy button on
 * every token, with "Why?" expanding to the real bull/bear/risk bullets. This is
 * the "you're never trading blind" moment FOMO structurally can't match.
 *
 * `fast` mode is cached server-side (the endpoint returns cacheHit), so re-opening
 * a token is instant and cheap.
 */
const META: Record<Verdict, { label: string; fg: string; bg: string }> = {
  healthy: { label: 'Looks healthy', fg: colors.bull, bg: colors.bullSoft },
  caution: { label: 'Caution', fg: colors.warn, bg: colors.warnSoft },
  high_risk: { label: 'High rug risk', fg: colors.bear, bg: colors.bearSoft },
};

export function AiVerdictChip({ mint, expandable = true }: { mint: string; expandable?: boolean }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ['explain-token', mint],
    queryFn: () => explainToken(mint, 'fast'),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (q.isLoading) {
    return (
      <View style={[s.chip, { backgroundColor: colors.bgRaised }]}>
        <ActivityIndicator size="small" color={colors.fgMuted} />
        <Text style={[s.label, { color: colors.fgMuted }]}>Pointer AI is reading the chain…</Text>
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
      <Pressable
        disabled={!expandable}
        onPress={() => setOpen((v) => !v)}
        style={[s.chip, { backgroundColor: m.bg, borderColor: m.fg + '55' }]}
      >
        <View style={[s.dot, { backgroundColor: m.fg }]} />
        <Text style={[s.label, { color: m.fg }]}>{m.label}</Text>
        {expandable ? <Text style={[s.why, { color: m.fg }]}>{open ? 'Hide' : 'Why?'}</Text> : null}
      </Pressable>

      {open ? (
        <View style={s.detail}>
          <Text style={s.summary}>{d.summary}</Text>
          {d.riskFlags.length ? (
            <Section title="Risk flags" items={d.riskFlags} color={colors.bear} />
          ) : null}
          {d.bullCase.length ? <Section title="Bull case" items={d.bullCase} color={colors.bull} /> : null}
          {d.bearCase.length ? <Section title="Bear case" items={d.bearCase} color={colors.fgSecondary} /> : null}
          <Text style={s.disclaimer}>
            Pointer AI · confidence {d.confidence}. Not financial advice.
          </Text>
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
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 13, fontWeight: '700', flex: 1 },
  why: { fontSize: 12, fontWeight: '600' },
  detail: {
    marginTop: 8,
    gap: 10,
    backgroundColor: colors.bgRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  summary: { color: colors.fg, fontSize: 13, lineHeight: 19 },
  secTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  bullet: { color: colors.fgSecondary, fontSize: 12, lineHeight: 17 },
  disclaimer: { color: colors.fgMuted, fontSize: 10, marginTop: 2 },
});
