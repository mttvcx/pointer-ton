import 'server-only';

/**
 * Phase 2: manual payout bookkeeping only. Transfer SOL from the org fee wallet off-platform.
 * // TODO Phase 3: automate via custom fee program
 */
export { markReferralEarningsPaid, listUnpaidReferralEarningIds } from '@/lib/referrals/earnings';
