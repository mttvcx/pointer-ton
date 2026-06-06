/**
 * Pure pack-override policy. No server/DB imports so it is unit-testable and
 * shared by `lib/db/packs.ts` and the admin routes.
 */

export const FORCED_OUTCOMES = ['jackpot', 'legendary_elite', 'epic_surge'] as const;
export type ForcedOutcome = (typeof FORCED_OUTCOMES)[number];

/** High-value outcomes require a second admin to approve before they apply. */
export const HIGH_VALUE_OUTCOMES: ReadonlySet<ForcedOutcome> = new Set(['jackpot', 'legendary_elite']);

export function outcomeRequiresApproval(outcome: ForcedOutcome): boolean {
  return HIGH_VALUE_OUTCOMES.has(outcome);
}

export type OverrideClaimShape = {
  status: string;
  consumed_open_id: string | null;
  expires_at: string;
  pack_type: string | null;
};

/** Whether an override is currently claimable for a given pack type + time. */
export function isOverrideClaimable(
  o: OverrideClaimShape,
  packType: string,
  now: Date = new Date(),
): boolean {
  if (o.status !== 'approved') return false;
  if (o.consumed_open_id) return false;
  if (new Date(o.expires_at).getTime() <= now.getTime()) return false;
  if (o.pack_type !== null && o.pack_type !== packType) return false;
  return true;
}

/**
 * Four-eyes guard: the approver must be a real admin and must differ from the
 * override's creator. `null` creator (legacy/system) is allowed to be approved
 * by any non-system admin.
 */
export function canApproveOverride(input: {
  approverUserId: string;
  createdByUserId: string | null;
}): boolean {
  if (!input.approverUserId || input.approverUserId === 'system') return false;
  if (input.createdByUserId && input.createdByUserId === input.approverUserId) return false;
  return true;
}
