import 'server-only';

import type { AgentContext, AgentResult } from '@/sibyl/agents/types';
import type { SibylAnswer, SibylCard, SibylEntityRef } from '@/sibyl/types';
import { callModel, parseJson, tierForMode } from '@/sibyl/modelRouter';
import { AGENT_SYSTEM, scrubBanned } from '@/sibyl/agents/prompts';
import { dexscreener, helius, grok, x, dune, pointer } from '@/sibyl/data/providers';

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
  const m = await dexscreener.getMarketFacts(ctx.mint, ctx.chain);
  const cards: SibylCard[] = [
    { type: 'token', id: cid('token'), data: { mint: ctx.mint, symbol: m.symbol, name: m.name, imageUrl: m.imageUrl, priceUsd: m.priceUsd, marketCapUsd: m.marketCapUsd, liquidityUsd: m.liquidityUsd, volume24hUsd: m.volume24hUsd, change24hPct: m.change24hPct, ageLabel: m.ageLabel, protocol: m.protocol } },
    { type: 'chart', id: cid('chart'), data: { mint: ctx.mint, symbol: m.symbol, tf: '5m', source: 'birdeye/mock' } },
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
  return { agent: 'wallet', take, cards, entities, confidence: holders.holders.length ? 78 : 45, caveats: holders.source.includes('mock') ? ['Holders are sample data (set HELIUS_API_KEY for live holders); labels shown are illustrative.'] : [] };
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

export async function runRiskAgent(ctx: AgentContext): Promise<AgentResult> {
  if (!ctx.mint) return empty('risk');
  const [holders, m] = await Promise.all([helius.getHolderFacts(ctx.mint), dexscreener.getMarketFacts(ctx.mint, ctx.chain)]);
  const flags: { label: string; severity: 'low' | 'med' | 'high' }[] = [];
  const top = holders.holders[0];
  if (top && top.pct >= 40) flags.push({ label: `Single wallet holds ${top.pct.toFixed(0)}%`, severity: 'high' });
  if ((holders.top10Pct ?? 0) >= 70) flags.push({ label: `Top-10 concentration ${holders.top10Pct?.toFixed(0)}%`, severity: 'high' });
  if (m.liquidityUsd != null && m.liquidityUsd < 30_000) flags.push({ label: `Thin liquidity ${usd(m.liquidityUsd)}`, severity: 'med' });
  flags.push({ label: 'Dev history unknown', severity: 'med' });
  const score = Math.min(100, 30 + flags.filter((f) => f.severity === 'high').length * 25 + flags.filter((f) => f.severity === 'med').length * 10);
  const cards: SibylCard[] = [{ type: 'risk', id: cid('risk'), data: { score, flags } }];
  const take = [
    top && top.pct >= 40 ? 'Top holders are ugly — one wallet can end this instantly.' : 'Concentration is manageable but not clean.',
    'Do not size this unless the main holder distributes gradually.',
  ];
  return { agent: 'risk', take, cards, entities: [], confidence: 75, caveats: [] };
}

export async function runDuneAgent(ctx: AgentContext): Promise<AgentResult> {
  const subject = /axiom|photon|trojan|gmgn|fomo|bullx/i.exec(ctx.query)?.[0]?.toLowerCase() ?? 'axiom';
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

  return {
    verdict: scrubBanned(j.verdict),
    confidence: clampConf(j.confidence, caveats.length),
    why: (j.why ?? []).map(scrubBanned).filter(Boolean).slice(0, 6),
    action: scrubBanned(j.action),
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
