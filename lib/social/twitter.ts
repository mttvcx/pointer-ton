import 'server-only';

/**
 * Phase 1 stub: X/Twitter search + ingestion lands in a later phase.
 * Social panel reads `social_mentions` via {@link listRecentSocialForMint}.
 */
export async function fetchTwitterMentionsForMint(_mint: string): Promise<never[]> {
  void _mint;
  return [];
}
