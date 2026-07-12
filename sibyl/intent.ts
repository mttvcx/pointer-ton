import type { AgentName, ScanMode, SibylIntent } from '@/sibyl/types';

/**
 * Classify a query → subject + scan mode + which agents to run. Deterministic
 * (regex/keywords) so it's free and instant; a cheap-model classifier is a drop-in
 * upgrade later. This decides how much compute the query is worth.
 */

const BASE58 = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;
const KNOWN_PEOPLE = ['ansem', 'tjr', 'luke belmar', 'andrew tate', 'brez', 'cobie', 'threadguy', 'cented', 'mitch'];
const TERMINALS = /\b(axiom|photon|trojan|gmgn|fomo|bullx|bloom)\b/i;
const NARRATIVE = /\b(70% meta|tiktok meta|ct meta|pumpfun airdrop|narrative|meta)\b/i;

function pickMode(q: string): ScanMode {
  const s = q.toLowerCase();
  if (/deep|full scan|research|report|everything|compare/.test(s)) return 'DEEP_SCAN';
  if (/quick|fast|tl;?dr/.test(s) || q.trim().length <= 8) return 'QUICK_SCAN';
  return 'STANDARD_SCAN';
}

const GREETING = /^(gm+|gn+|hey+|hi+|hello+|yo+|sup|wassup|wagwan|howdy|hola|greetings|good\s+(morning|evening|afternoon|night))\b/;
const SMALLTALK = /^(thanks?|thank\s+you|thx|ty|nice|cool|great|awesome|ok(ay)?|k|lol|lmao|lmfao|haha+|hehe|nvm|np|no\s+problem|wyd|test(ing)?|bye|cya|gg)\b/;
const META = /(who\s+are\s+you|what\s+are\s+you|what\s+can\s+you\s+do|what\s+do\s+you\s+do|how\s+do\s+you\s+work|what'?s?\s+your\s+name|are\s+you\s+(a\s+)?(bot|ai|real|human|there)|how\s+are\s+you|how'?s\s+it\s+going|how\s+you\s+doing|^help\b)/;

/**
 * A greeting, thanks, or meta-question about the assistant — NOT an analyzable
 * subject. These must never trigger a scan (which would fabricate handles/
 * verdicts); they get a conversational reply instead.
 */
function isChitchat(q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  if (META.test(s)) return true;
  const words = s.split(/\s+/).length;
  // Greetings/smalltalk only count when the message is short — so "gm what's the
  // CA for X" still routes to a real scan, but "hey man" does not.
  if ((GREETING.test(s) || SMALLTALK.test(s)) && words <= 4) return true;
  return false;
}

export function classifyIntent(query: string): SibylIntent {
  const q = query.trim();
  const lower = q.toLowerCase();
  const mode = pickMode(q);

  // Greeting / smalltalk / "who are you" → conversational, never a scan.
  if (isChitchat(q)) {
    return { query, subject: { kind: 'chitchat', ref: null }, mode: 'QUICK_SCAN', agents: [] };
  }

  // Market/company question ("Axiom fees today").
  if (TERMINALS.test(q) && /(fee|volume|made|market share|usage|today|yesterday)/i.test(q)) {
    return { query, subject: { kind: 'market_question', ref: TERMINALS.exec(q)![0].toLowerCase() }, mode, agents: ['dune', 'judge'] };
  }

  // Token by mint.
  const mint = BASE58.exec(q)?.[0] ?? null;
  if (mint) {
    return { query, subject: { kind: 'token', ref: mint, chain: 'sol' }, mode, agents: agentsForToken(mode) };
  }

  // Person / KOL.
  const person = KNOWN_PEOPLE.find((p) => lower.includes(p)) ?? (lower.match(/@([a-z0-9_]{2,20})/)?.[1] ?? null);
  if (person && /(who|did|make|made|do|is .* in|profile)/i.test(q)) {
    return { query, subject: { kind: 'person', ref: person }, mode, agents: ['social', 'wallet', 'judge'] };
  }

  // Narrative.
  if (NARRATIVE.test(q)) {
    return { query, subject: { kind: 'narrative', ref: NARRATIVE.exec(q)![0].toLowerCase() }, mode, agents: ['narrative', 'social', 'analog', 'judge'] };
  }

  // Bare ticker / token name (e.g. "COBRA?") — treat as a token scan, mint unresolved.
  if (/^\$?[A-Za-z0-9]{2,12}\??$/.test(q)) {
    return { query, subject: { kind: 'token', ref: null, chain: 'sol' }, mode, agents: agentsForToken(mode) };
  }

  // Unrecognized, non-crypto input — reply conversationally instead of fabricating
  // a narrative/social scan out of nothing.
  return { query, subject: { kind: 'chitchat', ref: null }, mode: 'QUICK_SCAN', agents: [] };
}

function agentsForToken(mode: ScanMode): AgentName[] {
  if (mode === 'QUICK_SCAN' || mode === 'HOVER_FAST') return ['market', 'risk', 'judge'];
  if (mode === 'DEEP_SCAN' || mode === 'RESEARCH_REPORT')
    return ['market', 'wallet', 'narrative', 'social', 'risk', 'analog', 'judge'];
  return ['market', 'wallet', 'social', 'risk', 'judge'];
}
