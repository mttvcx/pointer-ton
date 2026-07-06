import type { AgentName, SibylCard, SibylEntityRef } from '@/sibyl/types';

export type AgentContext = {
  query: string;
  mint: string | null;
  chain: 'sol' | 'eth' | 'base' | 'bnb';
  /** Person handle when the query is about a KOL. */
  handle: string | null;
  /** Narrative / meta name when relevant. */
  narrative: string | null;
};

/** Strict-ish result each specialist returns. `take` = CT-native one-liners. */
export type AgentResult = {
  agent: AgentName;
  take: string[];
  cards: SibylCard[];
  entities: SibylEntityRef[];
  /** 0–100 self-assessed confidence; the judge can downgrade. */
  confidence: number;
  caveats: string[];
};
