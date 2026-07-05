/**
 * Sibyl memory — the compounding moat. Sibyl doesn't just answer, it remembers:
 * people, wallets, tokens, narratives, alpha groups, news, Dune metrics, historical
 * tokens, social posts — and how they relate. Every scan can enrich this graph.
 */
export type SibylEntityKind =
  | 'person'
  | 'wallet'
  | 'token'
  | 'narrative'
  | 'group'
  | 'news'
  | 'dune_metric'
  | 'historical_token'
  | 'social_post';

export type SibylEntity = {
  id: string;
  kind: SibylEntityKind;
  name: string;
  aliases: string[];
  linkedWallets: string[];
  linkedSocials: string[]; // handles
  description: string;
  /** 0–1 how sure we are this entity/claim is real. */
  confidence: number;
  source: string;
  firstSeen: string; // ISO
  lastSeen: string;
  relatedEntities: string[]; // entity ids
};

export type EntityUpsert = Partial<SibylEntity> & { id: string; kind: SibylEntityKind; name: string };
