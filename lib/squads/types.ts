import { z } from 'zod';

/**
 * Pointer Squads — shared domain types.
 *
 * Important separation:
 *  - "Pointer activity" = our own internal trader signal (lives in our DB).
 *  - "Ethos" = external. Optional. Never treated as absolute truth.
 *  - "Operator Signal" = the composite Pointer surfaces.
 *
 * This file is intentionally framework-free — used by both server routes
 * (typed validation) and the client UI.
 */

/* ----------------------------- enums ----------------------------- */

export const TradingStyleSchema = z.enum([
  'trenches',
  'perps',
  'ai',
  'new_pairs',
  'wallets',
  'alerts',
  'long_term',
]);
export type TradingStyle = z.infer<typeof TradingStyleSchema>;

export const ChainFocusSchema = z.enum([
  'sol',
  'ton',
  'base',
  'bnb',
  'hyperliquid',
  'multi',
]);
export type ChainFocus = z.infer<typeof ChainFocusSchema>;

export const SquadVisibilitySchema = z.enum([
  'private',
  'invite_only',
  'request_to_join',
  'public',
]);
export type SquadVisibility = z.infer<typeof SquadVisibilitySchema>;

export const SquadMemberRoleSchema = z.enum(['owner', 'admin', 'member']);
export type SquadMemberRole = z.infer<typeof SquadMemberRoleSchema>;

export const SquadMemberStatusSchema = z.enum(['active', 'invited', 'requested', 'left']);
export type SquadMemberStatus = z.infer<typeof SquadMemberStatusSchema>;

export const RiskFlagSchema = z.enum([
  'rug_history',
  'bundled_supply',
  'fresh_wallet',
  'low_diversity',
  'sybil_suspect',
  'multi_account_risk',
  'no_identity',
]);
export type RiskFlag = z.infer<typeof RiskFlagSchema>;

export const OperatorSignalLevelSchema = z.enum(['high', 'medium', 'low', 'unknown']);
export type OperatorSignalLevel = z.infer<typeof OperatorSignalLevelSchema>;

/* ----------------------------- identity ----------------------------- */

/**
 * What the user has *consented* to surface. Every field optional. We never
 * derive an X handle from an on-chain signature; the user types it in
 * `ReputationSettings` and we resolve it via Ethos read-only.
 */
export const PointerIdentitySchema = z
  .object({
    /** Pointer-internal display preference, distinct from Ethos `displayName`. */
    displayName: z.string().trim().max(48).nullable().optional(),
    bio: z.string().trim().max(280).nullable().optional(),
    tradingStyles: z.array(TradingStyleSchema).max(6).optional().default([]),
    chainsActive: z.array(ChainFocusSchema).max(6).optional().default([]),

    /* identity links (all optional) */
    xUsername: z.string().trim().max(64).nullable().optional(),
    telegramId: z.string().trim().max(64).nullable().optional(),
    telegramUsername: z.string().trim().max(64).nullable().optional(),
    discordId: z.string().trim().max(64).nullable().optional(),
    farcasterUsername: z.string().trim().max(64).nullable().optional(),
    /** EVM address (`0x…`). Solana / TON wallets stay separate. */
    ethereumAddress: z
      .string()
      .trim()
      .regex(/^0x[a-fA-F0-9]{40}$/, 'expected 0x-prefixed 20-byte address')
      .nullable()
      .optional(),

    /** Honor the user's intent to *not* surface their squad standing publicly. */
    privacy: z
      .object({
        showEthos: z.boolean().default(true),
        showActivity: z.boolean().default(true),
        showSquads: z.boolean().default(true),
        allowInvites: z.boolean().default(true),
        allowRequests: z.boolean().default(true),
        /** Compact reputation summary on profile / cards. */
        showReputationSummary: z.boolean().default(true),
        /** Appear in Looking for squad directory. */
        lookingForSquadVisible: z.boolean().default(true),
      })
      .default({
        showEthos: true,
        showActivity: true,
        showSquads: true,
        allowInvites: true,
        allowRequests: true,
        showReputationSummary: true,
        lookingForSquadVisible: true,
      }),

    updatedAt: z.number().optional(),
  })
  .strict();
export type PointerIdentity = z.infer<typeof PointerIdentitySchema>;

export const DEFAULT_POINTER_IDENTITY: PointerIdentity = {
  displayName: null,
  bio: null,
  tradingStyles: [],
  chainsActive: [],
  xUsername: null,
  telegramId: null,
  telegramUsername: null,
  discordId: null,
  farcasterUsername: null,
  ethereumAddress: null,
  privacy: {
    showEthos: true,
    showActivity: true,
    showSquads: true,
    allowInvites: true,
    allowRequests: true,
    showReputationSummary: true,
    lookingForSquadVisible: true,
  },
  updatedAt: undefined,
};

/* ----------------------------- squads ----------------------------- */

/**
 * Join requirements: evaluated server-side at request time *and* re-evaluated
 * at admin approval. Each predicate is intentionally narrow so the gating
 * logic is explainable in `joinRequirements.ts`.
 */
export const JoinRequirementsSchema = z
  .object({
    /** Minimum Ethos level needed. `null` = no Ethos requirement. */
    minEthosLevel: z
      .enum(['untrusted', 'questionable', 'neutral', 'reputable', 'exemplary'])
      .nullable()
      .optional(),
    /** Pointer-internal activity tier (computed by `operatorSignal.ts`). */
    minPointerActivity: z.enum(['light', 'active', 'heavy']).nullable().optional(),
    /** Days since first Pointer trade. */
    minActiveDays: z.number().int().min(0).max(3650).nullable().optional(),
    /** Require at least one linked off-chain identity. */
    requiresLinkedIdentity: z.boolean().default(false),
    /** Manual approval by squad owner/admin. */
    manualApproval: z.boolean().default(true),
    /** Auto-reject anyone with these risk flags. */
    rejectIfRiskFlags: z.array(RiskFlagSchema).default([]),
  })
  .strict();
export type JoinRequirements = z.infer<typeof JoinRequirementsSchema>;

export const SquadCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(48),
    description: z.string().trim().max(280).optional().default(''),
    chainFocus: z.array(ChainFocusSchema).min(1).max(6),
    tradingStyles: z.array(TradingStyleSchema).min(1).max(6),
    visibility: SquadVisibilitySchema,
    joinRequirements: JoinRequirementsSchema,
  })
  .strict();
export type SquadCreateInput = z.infer<typeof SquadCreateSchema>;

export type SquadSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  chainFocus: ChainFocus[];
  tradingStyles: TradingStyle[];
  visibility: SquadVisibility;
  memberCount: number;
  /** Whether the requesting user is a member. */
  isMember: boolean;
  /** Last server-computed Operator Signal *average* of active members. */
  avgOperatorSignal?: OperatorSignalLevel;
  createdAt: string;
};
