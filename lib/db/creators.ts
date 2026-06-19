import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { CreatorPlatform, CreatorTier } from '@/lib/creators/config';
import { computeEarningsUsdCents } from '@/lib/creators/config';
import { fetchViewCountForUrl } from '@/lib/creators/viewCounts';

export type CreatorRow = {
  id: string;
  discord_id: string;
  discord_username: string;
  discord_avatar: string | null;
  discord_global_name: string | null;
  status: 'active' | 'suspended' | 'blacklisted';
  payout_method: 'crypto' | 'paypal' | 'none' | null;
  payout_address: string | null;
  created_at: string;
  updated_at: string;
};

export type CreatorSocialAccountRow = {
  id: string;
  creator_id: string;
  platform: CreatorPlatform;
  handle: string;
  profile_url: string | null;
  tier: CreatorTier | null;
  verification_status: 'pending' | 'needs_verification' | 'verified' | 'rejected';
  tier1_audience_pct: number | null;
  verified_at: string | null;
  rejected_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type CreatorAppealRow = {
  id: string;
  creator_id: string;
  target_type: 'video' | 'account' | 'ban';
  target_id: string | null;
  message: string;
  evidence_url: string | null;
  status: 'pending' | 'approved' | 'denied';
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type CreatorVideoRow = {
  id: string;
  creator_id: string;
  account_id: string;
  platform: CreatorPlatform;
  post_url: string;
  post_url_normalized: string;
  view_count: number;
  view_count_verified: boolean;
  earnings_verified_cents: number;
  earnings_unverified_cents: number;
  review_status: string;
  review_note: string | null;
  month_key: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

// Creator tables are not in generated Supabase types yet — use untyped client.
function from(table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (createAdminSupabase() as any).from(table);
}

export async function isDiscordBlacklisted(discordId: string): Promise<boolean> {
  const { data } = await from('creator_blacklist').select('discord_id').eq('discord_id', discordId).maybeSingle();
  return Boolean(data);
}

export async function upsertCreatorFromDiscord(input: {
  discordId: string;
  discordUsername: string;
  discordAvatar: string | null;
  discordGlobalName: string | null;
}): Promise<CreatorRow> {
  const blocked = await isDiscordBlacklisted(input.discordId);
  if (blocked) throw new Error('blacklisted');

  const { data, error } = await from('creators')
    .upsert(
      {
        discord_id: input.discordId,
        discord_username: input.discordUsername,
        discord_avatar: input.discordAvatar,
        discord_global_name: input.discordGlobalName,
        status: 'active',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'discord_id' },
    )
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as CreatorRow;
}

export async function getCreatorById(id: string): Promise<CreatorRow | null> {
  const { data, error } = await from('creators').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CreatorRow | null) ?? null;
}

export async function getCreatorByDiscordId(discordId: string): Promise<CreatorRow | null> {
  const { data, error } = await from('creators').select('*').eq('discord_id', discordId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CreatorRow | null) ?? null;
}

export async function listCreatorAccounts(creatorId: string): Promise<CreatorSocialAccountRow[]> {
  const { data, error } = await from('creator_social_accounts')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CreatorSocialAccountRow[];
}

export async function addCreatorSocialAccount(input: {
  creatorId: string;
  platform: CreatorPlatform;
  handle: string;
  profileUrl?: string | null;
}): Promise<CreatorSocialAccountRow> {
  const handle = input.handle.replace(/^@/, '').trim();
  const { data, error } = await from('creator_social_accounts')
    .insert({
      creator_id: input.creatorId,
      platform: input.platform,
      handle,
      profile_url: input.profileUrl ?? null,
      verification_status: 'needs_verification',
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as CreatorSocialAccountRow;
}

export async function getSocialAccountById(id: string): Promise<CreatorSocialAccountRow | null> {
  const { data, error } = await from('creator_social_accounts').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CreatorSocialAccountRow | null) ?? null;
}

export async function markCreatorAccountVerified(
  accountId: string,
  opts: { tier: CreatorTier; tier1AudiencePct: number },
): Promise<void> {
  const { error } = await from('creator_social_accounts')
    .update({
      verification_status: 'verified',
      tier: opts.tier,
      tier1_audience_pct: opts.tier1AudiencePct,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId);
  if (error) throw new Error(error.message);
}

export async function updateCreatorPayout(
  creatorId: string,
  payout: { method: 'crypto' | 'paypal'; address: string },
): Promise<void> {
  const { error } = await from('creators')
    .update({
      payout_method: payout.method,
      payout_address: payout.address,
      updated_at: new Date().toISOString(),
    })
    .eq('id', creatorId);
  if (error) throw new Error(error.message);
}

export async function insertVerificationSubmission(input: {
  accountId: string;
  creatorId: string;
  storagePath: string;
  fileSizeBytes: number;
  mimeType: string;
}): Promise<{ id: string }> {
  const { data, error } = await from('creator_verification_submissions')
    .insert({
      account_id: input.accountId,
      creator_id: input.creatorId,
      storage_path: input.storagePath,
      file_size_bytes: input.fileSizeBytes,
      mime_type: input.mimeType,
      review_status: 'pending',
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  await from('creator_social_accounts')
    .update({ verification_status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', input.accountId);

  return { id: data.id as string };
}

export async function submitCreatorVideo(input: {
  creatorId: string;
  accountId: string;
  platform: CreatorPlatform;
  postUrl: string;
  postUrlNormalized: string;
  monthKey: string;
  viewCount?: number;
}): Promise<CreatorVideoRow> {
  let viewCount = input.viewCount ?? 0;
  let earningsUnverifiedCents = 0;

  if (input.viewCount == null) {
    const fetched = await fetchViewCountForUrl(input.postUrl, input.platform);
    if (fetched.views != null) viewCount = fetched.views;
  }

  const account = await getSocialAccountById(input.accountId);
  if (account?.tier && viewCount > 0) {
    earningsUnverifiedCents = computeEarningsUsdCents(viewCount, account.tier);
  }

  const { data, error } = await from('creator_video_submissions')
    .insert({
      creator_id: input.creatorId,
      account_id: input.accountId,
      platform: input.platform,
      post_url: input.postUrl,
      post_url_normalized: input.postUrlNormalized,
      month_key: input.monthKey,
      view_count: viewCount,
      earnings_unverified_cents: earningsUnverifiedCents,
      review_status: 'pending',
    })
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('duplicate_url');
    throw new Error(error.message);
  }
  return data as CreatorVideoRow;
}

export async function listCreatorVideos(creatorId: string, monthKey?: string): Promise<CreatorVideoRow[]> {
  let q = from('creator_video_submissions').select('*').eq('creator_id', creatorId);
  if (monthKey) q = q.eq('month_key', monthKey);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CreatorVideoRow[];
}

export async function getCreatorDashboardStats(creatorId: string, monthKey: string) {
  const videos = await listCreatorVideos(creatorId, monthKey);
  let verifiedCents = 0;
  let unverifiedCents = 0;
  let views = 0;
  for (const v of videos) {
    views += Number(v.view_count);
    verifiedCents += Number(v.earnings_verified_cents);
    unverifiedCents += Number(v.earnings_unverified_cents);
  }
  return {
    posts: videos.length,
    views,
    verifiedEarningsUsd: verifiedCents / 100,
    unverifiedEarningsUsd: unverifiedCents / 100,
  };
}

export async function getLeaderboard(monthKey: string, verifiedOnly: boolean) {
  let q = from('creator_video_submissions')
    .select('creator_id, view_count, earnings_verified_cents, review_status')
    .eq('month_key', monthKey);

  if (verifiedOnly) {
    q = q.in('review_status', ['approved', 'reduced_pay']);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const byCreator = new Map<string, { views: number; earningsCents: number }>();
  for (const row of data ?? []) {
    const id = row.creator_id as string;
    const cur = byCreator.get(id) ?? { views: 0, earningsCents: 0 };
    cur.views += Number(row.view_count);
    cur.earningsCents += Number(row.earnings_verified_cents);
    byCreator.set(id, cur);
  }

  const creatorIds = [...byCreator.keys()];
  if (creatorIds.length === 0) return [];

  const { data: creators, error: cErr } = await from('creators')
    .select('id, discord_username, discord_avatar, discord_global_name')
    .in('id', creatorIds);
  if (cErr) throw new Error(cErr.message);

  const creatorMap = new Map(
    ((creators ?? []) as Array<{
      id: string;
      discord_username: string;
      discord_avatar: string | null;
      discord_global_name: string | null;
    }>).map((c) => [c.id, c]),
  );

  return [...byCreator.entries()]
    .map(([creatorId, stats]) => {
      const c = creatorMap.get(creatorId);
      return {
        creatorId,
        username: (c?.discord_global_name as string) || (c?.discord_username as string) || 'creator',
        avatar: (c?.discord_avatar as string) ?? null,
        views: stats.views,
        earningsUsd: stats.earningsCents / 100,
      };
    })
    .sort((a, b) => b.views - a.views)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

export async function getOrCreatePrizePool(monthKey: string) {
  const { data: existing } = await from('creator_prize_pools').select('*').eq('month_key', monthKey).maybeSingle();
  if (existing) return existing;

  const deadline = new Date();
  deadline.setUTCMonth(deadline.getUTCMonth() + 1, 0);
  deadline.setUTCHours(23, 59, 59, 999);

  const { data, error } = await from('creator_prize_pools')
    .insert({
      month_key: monthKey,
      total_usd_cents: 100_000,
      submission_deadline: deadline.toISOString(),
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function insertAppeal(input: {
  creatorId: string;
  targetType: 'video' | 'account' | 'ban';
  targetId?: string | null;
  message: string;
  evidenceUrl?: string | null;
}) {
  const { data, error } = await from('creator_appeals')
    .insert({
      creator_id: input.creatorId,
      target_type: input.targetType,
      target_id: input.targetId ?? null,
      message: input.message,
      evidence_url: input.evidenceUrl ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string };
}

export async function listPendingAppeals() {
  const { data, error } = await from('creator_appeals')
    .select('*, creators(discord_username, discord_global_name, discord_id)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function reviewAppeal(input: {
  appealId: string;
  approved: boolean;
  note?: string;
  adminDiscordId: string;
}) {
  const { data: appeal, error: fetchErr } = await from('creator_appeals')
    .select('*, creators(discord_id, status)')
    .eq('id', input.appealId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  const { error } = await from('creator_appeals')
    .update({
      status: input.approved ? 'approved' : 'denied',
      admin_note: input.note ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', input.appealId);
  if (error) throw new Error(error.message);

  if (input.approved && (appeal as { target_type?: string }).target_type === 'ban') {
    const creatorDiscordId = (appeal as { creators?: { discord_id?: string } }).creators?.discord_id;
    if (creatorDiscordId) {
      await from('creator_blacklist').delete().eq('discord_id', creatorDiscordId);
      await from('creators')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('discord_id', creatorDiscordId);
    }
  }

  await logAdminAction({
    adminDiscordId: input.adminDiscordId,
    action: input.approved ? 'appeal_approved' : 'appeal_denied',
    targetType: 'appeal',
    targetId: input.appealId,
    metadata: { note: input.note },
  });
}

/** Admin: pending verification queue */
export async function listPendingVerifications() {
  const { data, error } = await from('creator_verification_submissions')
    .select('*, creator_social_accounts(*), creators(*)')
    .eq('review_status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listPendingVideos() {
  const { data, error } = await from('creator_video_submissions')
    .select('*, creators(*), creator_social_accounts(*)')
    .eq('review_status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function reviewVerification(input: {
  submissionId: string;
  approved: boolean;
  tier?: CreatorTier;
  tier1Pct?: number;
  note?: string;
  adminDiscordId: string;
}) {
  const tier = input.approved ? input.tier : null;
  const { data: sub, error } = await from('creator_verification_submissions')
    .update({
      review_status: input.approved ? 'approved' : 'rejected',
      assigned_tier: tier,
      tier1_audience_pct: input.tier1Pct ?? null,
      reviewer_note: input.note ?? null,
      reviewed_at: new Date().toISOString(),
      reviewed_by_discord_id: input.adminDiscordId,
    })
    .eq('id', input.submissionId)
    .select('account_id, creator_id')
    .single();
  if (error) throw new Error(error.message);

  await from('creator_social_accounts')
    .update({
      verification_status: input.approved ? 'verified' : 'rejected',
      tier: tier,
      tier1_audience_pct: input.tier1Pct ?? null,
      verified_at: input.approved ? new Date().toISOString() : null,
      rejected_reason: input.approved ? null : input.note ?? 'Rejected',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.account_id as string);

  await logAdminAction({
    adminDiscordId: input.adminDiscordId,
    action: input.approved ? 'verification_approved' : 'verification_rejected',
    targetType: 'verification',
    targetId: input.submissionId,
    metadata: { tier, tier1Pct: input.tier1Pct },
  });
}

export async function reviewVideo(input: {
  videoId: string;
  status:
    | 'approved'
    | 'rejected'
    | 'rejected_stolen'
    | 'rejected_botting'
    | 'rejected_audience'
    | 'reduced_pay';
  viewCount?: number;
  note?: string;
  adminDiscordId: string;
}) {
  const { data: video, error: fetchErr } = await from('creator_video_submissions')
    .select('*, creator_social_accounts(tier)')
    .eq('id', input.videoId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  const tier = (video.creator_social_accounts as { tier?: CreatorTier | null })?.tier;
  let views = input.viewCount ?? Number(video.view_count);

  if (input.viewCount == null && (video as { post_url?: string; platform?: CreatorPlatform }).post_url) {
    const postUrl = (video as { post_url: string }).post_url;
    const platform = (video as { platform: CreatorPlatform }).platform;
    const fetched = await fetchViewCountForUrl(postUrl, platform);
    if (fetched.views != null) views = fetched.views;
  }

  let verifiedCents = 0;
  if (input.status === 'approved' || input.status === 'reduced_pay') {
    if (tier) {
      verifiedCents = computeEarningsUsdCents(views, tier);
      if (input.status === 'reduced_pay') verifiedCents = Math.floor(verifiedCents * 0.25);
    }
  }

  const { error } = await from('creator_video_submissions')
    .update({
      review_status: input.status,
      review_note: input.note ?? null,
      view_count: views,
      view_count_verified: input.status === 'approved' || input.status === 'reduced_pay',
      earnings_verified_cents: verifiedCents,
      reviewed_at: new Date().toISOString(),
      reviewed_by_discord_id: input.adminDiscordId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.videoId);
  if (error) throw new Error(error.message);

  await logAdminAction({
    adminDiscordId: input.adminDiscordId,
    action: `video_${input.status}`,
    targetType: 'video',
    targetId: input.videoId,
    metadata: { views, verifiedCents },
  });
}

export async function blacklistCreator(input: {
  discordId: string;
  reason: string;
  adminDiscordId: string;
}) {
  await from('creator_blacklist').upsert({
    discord_id: input.discordId,
    reason: input.reason,
    blacklisted_by_discord_id: input.adminDiscordId,
  });
  await from('creators').update({ status: 'blacklisted' }).eq('discord_id', input.discordId);
  await logAdminAction({
    adminDiscordId: input.adminDiscordId,
    action: 'blacklist',
    targetType: 'creator',
    metadata: { discordId: input.discordId, reason: input.reason },
  });
}

async function logAdminAction(input: {
  adminDiscordId: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  await from('creator_admin_audit').insert({
    admin_discord_id: input.adminDiscordId,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    metadata: input.metadata ?? {},
  });
}

export async function uploadVerificationToStorage(
  creatorId: string,
  accountId: string,
  file: Buffer,
  mimeType: string,
): Promise<string> {
  const supabase = createAdminSupabase();
  const ext = mimeType.includes('quicktime') ? 'mov' : 'mp4';
  const path = `${creatorId}/${accountId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('creator-verifications').upload(path, file, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}
