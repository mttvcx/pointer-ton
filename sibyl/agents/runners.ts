import 'server-only';

import type { AgentContext, AgentResult } from '@/sibyl/agents/types';
import type { SibylAnswer, SibylCard, SibylEntityRef } from '@/sibyl/types';
import { callModel, parseJson, tierForMode } from '@/sibyl/modelRouter';
import { AGENT_SYSTEM, scrubBanned, scrubModelLeak } from '@/sibyl/agents/prompts';
import { dexscreener, helius, grok, x, dune, pointer, birdeye } from '@/sibyl/data/providers';

function usd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toPrecision(3)}`;
}

let cardSeq = 0;
const cid = (t: string) => `${t}-${cardSeq++}`;

/* ------------------------------- specialists ------------------------------- */

export async function runMarketAgent(ctx: AgentContext): Promise<AgentResult> {
  if (!ctx.mint) return empty('market');
  const [m, candles] = await Promise.all([
    dexscreener.getMarketFacts(ctx.mint, ctx.chain),
    birdeye.getCandles(ctx.mint, '5m'),
  ]);
  const points = candles.map((c) => c.close).filter((n) => Number.isFinite(n));
  const cards: SibylCard[] = [
    { type: 'token', id: cid('token'), data: { mint: ctx.mint, symbol: m.symbol, name: m.name, imageUrl: m.imageUrl, priceUsd: m.priceUsd, marketCapUsd: m.marketCapUsd, liquidityUsd: m.liquidityUsd, volume24hUsd: m.volume24hUsd, change24hPct: m.change24hPct, ageLabel: m.ageLabel, protocol: m.protocol } },
    { type: 'chart', id: cid('chart'), data: { mint: ctx.mint, symbol: m.symbol, tf: '5m', source: birdeye.birdeyeStatus().configured ? 'birdeye' : 'birdeye/sample', points: points.length ? points : null } },
  ];
  const take = [
    `${m.symbol ?? 'Token'} sitting around ${usd(m.marketCapUsd)} MC.`,
    m.liquidityUsd != null && m.liquidityUsd < 30_000 ? `Liquidity is thin (${usd(m.liquidityUsd)}) — exits will slip.` : `Liquidity ${usd(m.liquidityUsd)}, 24h vol ${usd(m.volume24hUsd)}.`,
    m.ageLabel ? `${m.ageLabel} old — ${/[hd]/.test(m.ageLabel) ? 'past the first candle' : 'brand new, treat as a scalp'}.` : '',
  ].filter(Boolean);
  return { agent: 'market', take, cards, entities: [], confidence: m.priceUsd != null ? 80 : 40, caveats: m.priceUsd == null ? ['No live market data — DexScreener returned nothing.'] : [] };
}

export async function runWalletAgent(ctx: AgentContext): Promise<AgentResult> {
  if (!ctx.mint) return empty('wallet');
  const holders = await helius.getHolderFacts(ctx.mint);
  const holderAddrs = holders.holders.map((h) => h.address);
  // Label the ACTUAL holders against the real Pointer identity registry (~2,260 KOL /
  // smart-money wallets with connected Twitter handles), and ask whether Ansem is in.
  const [labels, ansem] = await Promise.all([
    pointer.labelWallets(holderAddrs),
    pointer.isPersonInTrade('ansem', holderAddrs),
  ]);
  const labelByAddr = new Map(labels.map((l) => [l.address, l]));
  const rows = holders.holders.map((h) => ({ ...h, label: labelByAddr.get(h.address)?.label ?? h.label ?? null, isKol: labelByAddr.get(h.address)?.kind === 'kol' || h.isKol }));
  const entities: SibylEntityRef[] = labels.filter((l) => l.handle).map((l) => ({ kind: 'wallet', id: l.address, label: l.label, handle: l.handle, address: l.address, href: l.handle ? `https://x.com/${l.handle}` : null }));
  const cards: SibylCard[] = [{ type: 'holders', id: cid('holders'), data: { mint: ctx.mint, top10Pct: holders.top10Pct, rows } }];
  const top = rows[0];
  const kols = labels.filter((l) => l.kind === 'kol');
  const lead = kols[0];
  const take = [
    top && top.pct >= 25 ? `Top holder controls ~${top.pct.toFixed(0)}%${top.label ? ` (${top.label})` : ''}. Whole trade is hostage to one wallet.` : `Top-10 hold ${holders.top10Pct?.toFixed(0) ?? '—'}%.`,
    lead ? `${kols.length} labeled KOL${kols.length > 1 ? 's' : ''} in holders${lead.handle ? ` (lead: @${lead.handle})` : ''}.` : `No labeled KOL wallet detected in holders.`,
    ansem.note,
  ].filter(Boolean);
  return { agent: 'wallet', take, cards, entities, confidence: holders.holders.length ? 78 : 45, caveats: holders.source.includes('mock') ? ['Holder concentration is sample (live holders unavailable — Helius usage cap); the KOL names/handles are real Pointer-registry matches.'] : [] };
}

export async function runNarrativeAgent(ctx: AgentContext): Promise<AgentResult> {
  const n = await grok.getNarrativeFacts(ctx.narrative ?? ctx.query);
  const cards: SibylCard[] = [{ type: 'narrative', id: cid('narrative'), data: { name: n.name, stage: n.stage, origin: n.origin, spread: n.spread, strengthening: n.strengthening, summary: n.summary } }];
  const take = [
    `Reads ${n.stage}${n.strengthening ? ' and strengthening' : n.strengthening === false ? ' and fading' : ''}.`,
    (n.spread.tiktok ?? 0) < 25 ? 'Attention is X-heavy, weak off-platform — CT/personality trade, not a mass runner yet.' : 'Spreading off-platform (TikTok/Reels) — retail leg forming.',
  ];
  return { agent: 'narrative', take, cards, entities: [], confidence: n.source.includes('mock') ? 55 : 70, caveats: n.source.includes('mock') ? ['Narrative is inferred — Grok live-search not yet connected.'] : [] };
}

export async function runSocialAgent(ctx: AgentContext): Promise<AgentResult> {
  const [s, groups] = await Promise.all([x.getSocialFacts(ctx.query), ctx.mint ? pointer.getGroupMentions(ctx.mint) : Promise.resolve([])]);
  const kols = s.mentions.map((m) => ({ handle: m.handle, name: m.name, note: m.note, inThisTrade: true }));
  const entities: SibylEntityRef[] = [...s.mentions, ...groups].map((m) => ({ kind: 'person', id: m.handle, label: m.name, handle: m.handle, href: `https://x.com/${m.handle}` }));
  const cards: SibylCard[] = [{ type: 'social', id: cid('social'), data: { handleCount: s.handleCount, velocity: s.velocity, window: s.window, kols } }];
  const take = [
    `Social velocity ${s.velocity} — ${s.handleCount} handles in ${s.window}.`,
    groups.length ? `Alpha groups mentioned it (${groups.map((g) => g.name).join(', ')}).` : 'No alpha-group mentions captured.',
  ];
  return { agent: 'social', take, cards, entities, confidence: s.source.includes('mock') ? 55 : 72, caveats: s.source.includes('mock') ? ['Social is sample data until the X plan is live.'] : [] };
}

const shortAddr = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export async function runRiskAgent(ctx: AgentContext): Promise<AgentResult> {
  if (!ctx.mint) return empty('risk');
  const [holders, m, auth] = await Promise.all([
    helius.getHolderFacts(ctx.mint),
    dexscreener.getMarketFacts(ctx.mint, ctx.chain),
    helius.getTokenAuthority(ctx.mint),
  ]);
  const flags: { label: string; severity: 'low' | 'med' | 'high' }[] = [];
  const top = holders.holders[0];
  if (top && top.pct >= 40) flags.push({ label: `Single wallet holds ${top.pct.toFixed(0)}%`, severity: 'high' });
  if ((holders.top10Pct ?? 0) >= 70) flags.push({ label: `Top-10 concentration ${holders.top10Pct?.toFixed(0)}%`, severity: 'high' });
  if (m.liquidityUsd != null && m.liquidityUsd < 30_000) flags.push({ label: `Thin liquidity ${usd(m.liquidityUsd)}`, severity: 'med' });

  // Fee-authority / control signals — real on-chain (mint & freeze authority, token-2022 fee).
  const authNotes: string[] = [];
  const authReal = auth && auth.source !== 'mock';
  if (authReal) {
    if (auth!.freezeAuthority) flags.push({ label: 'Freeze authority active — dev can freeze holders', severity: 'high' });
    if (auth!.mintAuthority) flags.push({ label: 'Mint authority not renounced — supply can inflate', severity: 'high' });
    if (auth!.transferFeeBps && auth!.transferFeeBps > 0) {
      flags.push({
        label: `Transfer fee ${(auth!.transferFeeBps / 100).toFixed(1)}%${auth!.transferFeeAuthority ? ` · fee authority ${shortAddr(auth!.transferFeeAuthority)}` : ''}`,
        severity: auth!.transferFeeBps >= 500 ? 'high' : 'med',
      });
    }
    if (!auth!.freezeAuthority && !auth!.mintAuthority) authNotes.push('Mint + freeze authority renounced — no dev supply or freeze control.');
    else if (auth!.freezeAuthority) authNotes.push('Freeze authority is live — the dev can lock your tokens. Handle with care.');
  } else {
    flags.push({ label: 'Authorities unverified (RPC unavailable)', severity: 'med' });
  }

  const score = Math.min(100, 25 + flags.filter((f) => f.severity === 'high').length * 22 + flags.filter((f) => f.severity === 'med').length * 9);
  const cards: SibylCard[] = [{ type: 'risk', id: cid('risk'), data: { score, flags } }];
  const take = [
    top && top.pct >= 40 ? 'Top holders are ugly — one wallet can end this instantly.' : 'Concentration is manageable but not clean.',
    ...authNotes,
    'Do not size this unless the main holder distributes gradually.',
  ].filter(Boolean);
  return { agent: 'risk', take, cards, entities: [], confidence: authReal ? 80 : 72, caveats: [] };
}

const TERMINAL_SAMPLE: Record<string, { fees: string; vol: string; traders: string; share: string }> = {
  axiom: { fees: '$412K', vol: '$78.4M', traders: '19,204', share: '31%' },
  photon: { fees: '$286K', vol: '$54.1M', traders: '14,880', share: '22%' },
  trojan: { fees: '$151K', vol: '$28.6M', traders: '8,140', share: '11%' },
  gmgn: { fees: '$205K', vol: '$39.2M', traders: '11,326', share: '16%' },
  bullx: { fees: '$168K', vol: '$31.0M', traders: '9,050', share: '13%' },
};

export async function runDuneAgent(ctx: AgentContext): Promise<AgentResult> {
  const mentioned = [...ctx.query.matchAll(/axiom|photon|trojan|gmgn|fomo|bullx/gi)].map((m) => m[0].toLowerCase());
  const comparative = /\bvs\b|versus|compare|against|market share|leaderboard/i.test(ctx.query) || mentioned.length >= 2;

  // Comparative → a real inline table across terminals.
  if (comparative) {
    const names = [...new Set(mentioned.length ? mentioned : ['axiom', 'photon', 'gmgn', 'bullx'])].filter((n) => TERMINAL_SAMPLE[n]);
    const rows = names.map((n) => {
      const s = TERMINAL_SAMPLE[n]!;
      return [n[0]!.toUpperCase() + n.slice(1), s.fees, s.vol, s.traders, s.share];
    });
    const cards: SibylCard[] = [
      { type: 'table', id: cid('table'), data: { title: 'Terminal fees — 24h', columns: ['Terminal', 'Fees', 'Volume', 'Traders', 'Share'], rows, note: 'sample — live figures wire in with Dune query ids' } },
    ];
    const leader = names[0] ? names[0][0]!.toUpperCase() + names[0].slice(1) : 'Axiom';
    return { agent: 'dune', take: [`${leader} leads on fees/share of the ones compared (24h).`], cards, entities: [], confidence: 55, caveats: ['Terminal metrics are sample data until Dune is keyed.'] };
  }

  const subject = mentioned[0] ?? 'axiom';
  const d = await dune.getTerminalFees(subject);
  const cards: SibylCard[] = [{ type: 'dune', id: cid('dune'), data: { title: d.title, rows: d.rows, queryUrl: d.queryUrl } }];
  return { agent: 'dune', take: [`${subject}: ${d.rows[0]?.value ?? '—'} fees, ${d.rows.find((r) => /share/i.test(r.label))?.value ?? '—'} market share (24h).`], cards, entities: [], confidence: d.source.includes('mock') ? 50 : 80, caveats: d.source.includes('mock') ? ['Terminal metrics are sample data until Dune is keyed.'] : [] };
}

export async function runAnalogAgent(ctx: AgentContext): Promise<AgentResult> {
  const items = [
    { symbol: 'previous personality-meta runner', note: 'same one-wallet-carries setup', outcome: 'ran 4x then round-tripped when the wallet sold' },
    { symbol: '70% meta copycat', note: 'earlier holder distribution', outcome: 'survived because more KOLs rotated in' },
  ];
  const cards: SibylCard[] = [{ type: 'similar', id: cid('similar'), data: { items } }];
  return { agent: 'analog', take: ['Closest analogs are one-wallet personality trades — they run, then die on the holder exit.'], cards, entities: [], confidence: 52, caveats: ['Analog matching is heuristic until the historical-token memory is populated.'] };
}

/* --------------------------------- judge ---------------------------------- */

export async function runJudge(query: string, mode: SibylAnswer['mode'], results: AgentResult[]): Promise<SibylAnswer> {
  const cards = results.flatMap((r) => r.cards);
  const entities = dedupeEntities(results.flatMap((r) => r.entities));
  const caveats = [...new Set(results.flatMap((r) => r.caveats))];
  const takes = results.flatMap((r) => r.take.map((t) => `[${r.agent}] ${t}`));
  const avgConf = results.length ? Math.round(results.reduce((s, r) => s + r.confidence, 0) / results.length) : 50;
  const sources = [{ label: 'DexScreener' }, { label: 'Helius' }, { label: 'Pointer registry' }, { label: 'X / Grok' }];

  // Real mode: let the judge model write the CT-native verdict from the takes.
  const raw = await callModel({
    tier: tierForMode(mode) === 'cheap' ? 'reason' : 'judge',
    system: AGENT_SYSTEM.judge,
    user: `Query: ${query}\n\nSpecialist findings:\n${takes.join('\n')}\n\nMissing/weak data: ${caveats.join('; ') || 'none'}\n\nReturn the JSON.`,
    json: true,
    maxTokens: 500,
    mock: JSON.stringify(mockJudge(query, results, avgConf, caveats)),
  });
  const j = parseJson(raw, mockJudge(query, results, avgConf, caveats));

  const clean = (s: string) => scrubModelLeak(scrubBanned(s));
  return {
    verdict: clean(j.verdict),
    confidence: clampConf(j.confidence, caveats.length),
    why: (j.why ?? []).map(clean).filter(Boolean).slice(0, 6),
    action: clean(j.action),
    body: null,
    cards,
    entities,
    sources,
    mode,
    agentsRun: results.map((r) => r.agent),
    caveats,
  };
}

/* -------------------------------- helpers --------------------------------- */

function empty(agent: AgentResult['agent']): AgentResult {
  return { agent, take: [], cards: [], entities: [], confidence: 0, caveats: ['No token subject resolved.'] };
}

function dedupeEntities(list: SibylEntityRef[]): SibylEntityRef[] {
  const seen = new Map<string, SibylEntityRef>();
  for (const e of list) seen.set(`${e.kind}:${e.id}`, e);
  return [...seen.values()];
}

/** Missing data caps confidence — the moat is honesty, not vibes. */
function clampConf(c: number, missing: number): number {
  const capped = Math.max(0, Math.min(100, Math.round(c)));
  return Math.max(20, capped - missing * 6);
}

function mockJudge(query: string, results: AgentResult[], avgConf: number, caveats: string[]) {
  const risk = results.find((r) => r.agent === 'risk');
  const highRisk = risk?.cards.some((c) => c.type === 'risk' && c.data.score >= 60);
  const why = results.flatMap((r) => r.take).slice(0, 6);
  return {
    verdict: highRisk ? 'Real attention, but holder risk is ugly.' : 'Watchable — attention is real, size carefully.',
    confidence: clampConf(avgConf, caveats.length),
    why,
    action: highRisk ? 'Scalp only unless the main holder distributes and more KOLs rotate in.' : 'Watch. Small size until holders and social confirm.',
    caveats,
  };
}
