import { z } from 'zod';

/** Mirrors Ethos reputation tiers / our badge UI. */
export const EthosLevelSchema = z.enum([
  'exemplary',
  'reputable',
  'neutral',
  'questionable',
  'untrusted',
  'unknown',
]);
export type EthosLevel = z.infer<typeof EthosLevelSchema>;

/**
 * Slim, cache-friendly snapshot for Pointer UI.
 * Populated from Ethos API + normalized locally.
 */
export const EthosProfileSnapshotSchema = z
  .object({
    score: z.number(),
    level: EthosLevelSchema,
    displayName: z.string().optional(),
    /** Ethos app profile URL when available */
    profileUrl: z.string().url().optional(),
    /** Canonical userkey we resolved (for debugging / support). */
    resolvedUserkey: z.string().optional(),
  })
  .strict();

export type EthosProfileSnapshot = z.infer<typeof EthosProfileSnapshotSchema>;

export const EthosLookupKeyTypeSchema = z.enum([
  'profile_id',
  'ethereum',
  'x_username',
  'telegram_id',
  'discord_id',
  'farcaster_username',
]);

export type EthosLookupKeyType = z.infer<typeof EthosLookupKeyTypeSchema>;
