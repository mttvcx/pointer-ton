import 'server-only';
/* eslint-disable @typescript-eslint/no-explicit-any -- follows/friendships not in generated types until the social-schema migration is applied */

import { createAdminSupabase } from '@/lib/supabase/server';

export function isMissingSocialTable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /missing_social_table|does not exist|schema cache|42P01|follows|friendships/i.test(err.message);
}

function throwIfMissing(error: { message: string }): never {
  if (/does not exist|schema cache|42P01/i.test(String(error.message))) {
    throw new Error('missing_social_table');
  }
  throw new Error(error.message);
}

// ─────────────────────────── FOLLOW (one-way) ───────────────────────────

export type FollowTargetType = 'user' | 'wallet' | 'twitter';

export type FollowEdge = {
  targetType: FollowTargetType;
  targetRef: string;
  createdAt: string;
  // Only populated for user targets, best-effort.
  username?: string | null;
  walletAddress?: string | null;
  twitterHandle?: string | null;
};

function normalizeRef(targetType: FollowTargetType, ref: string): string {
  const trimmed = ref.trim();
  // Handles are case-insensitive; wallets/user-ids kept verbatim.
  return targetType === 'twitter' ? trimmed.replace(/^@/, '').toLowerCase() : trimmed;
}

/** Follow a user / wallet / twitter handle. Idempotent (unique constraint → upsert). */
export async function followTarget(
  followerId: string,
  targetType: FollowTargetType,
  targetRef: string,
): Promise<void> {
  const db = createAdminSupabase() as any;
  const ref = normalizeRef(targetType, targetRef);
  if (!ref) throw new Error('invalid_target');
  const { error } = await db
    .from('follows')
    .upsert(
      { follower_id: followerId, target_type: targetType, target_ref: ref },
      { onConflict: 'follower_id,target_type,target_ref', ignoreDuplicates: true },
    );
  if (error) throwIfMissing(error);
}

export async function unfollowTarget(
  followerId: string,
  targetType: FollowTargetType,
  targetRef: string,
): Promise<void> {
  const db = createAdminSupabase() as any;
  const ref = normalizeRef(targetType, targetRef);
  const { error } = await db
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('target_type', targetType)
    .eq('target_ref', ref);
  if (error) throwIfMissing(error);
}

/** Who this user follows. */
export async function listFollowing(followerId: string): Promise<FollowEdge[]> {
  const db = createAdminSupabase() as any;
  const { data, error } = await db
    .from('follows')
    .select('target_type, target_ref, created_at')
    .eq('follower_id', followerId)
    .order('created_at', { ascending: false });
  if (error) throwIfMissing(error);
  return ((data ?? []) as any[]).map((r) => ({
    targetType: r.target_type as FollowTargetType,
    targetRef: String(r.target_ref),
    createdAt: String(r.created_at),
  }));
}

/** Followers of a given user (target_type='user'), joined to profile fields. */
export async function listFollowers(targetUserId: string): Promise<FollowEdge[]> {
  const db = createAdminSupabase() as any;
  const { data, error } = await db
    .from('follows')
    .select('follower_id, created_at, users:follower_id(username, wallet_address, twitter_handle)')
    .eq('target_type', 'user')
    .eq('target_ref', targetUserId)
    .order('created_at', { ascending: false });
  if (error) throwIfMissing(error);
  return ((data ?? []) as any[]).map((r) => ({
    targetType: 'user' as const,
    targetRef: String(r.follower_id),
    createdAt: String(r.created_at),
    username: r.users?.username ?? null,
    walletAddress: r.users?.wallet_address ?? null,
    twitterHandle: r.users?.twitter_handle ?? null,
  }));
}

/** User-ids that follow this user — the fan-out audience for push. */
export async function listFollowerUserIds(targetUserId: string): Promise<string[]> {
  const db = createAdminSupabase() as any;
  const { data, error } = await db
    .from('follows')
    .select('follower_id')
    .eq('target_type', 'user')
    .eq('target_ref', targetUserId);
  if (error) throwIfMissing(error);
  return ((data ?? []) as Array<{ follower_id: string }>).map((r) => r.follower_id);
}

export async function followCounts(userId: string): Promise<{ following: number; followers: number }> {
  const db = createAdminSupabase() as any;
  const [following, followers] = await Promise.all([
    db.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
    db
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('target_type', 'user')
      .eq('target_ref', userId),
  ]);
  if (following.error) throwIfMissing(following.error);
  return { following: following.count ?? 0, followers: followers.count ?? 0 };
}

// ─────────────────────────── FRIEND (mutual) ───────────────────────────

export type FriendStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export type FriendView = {
  userId: string;
  username: string | null;
  walletAddress: string | null;
  twitterHandle: string | null;
  since: string;
};

export type FriendRequestView = {
  requestId: string;
  fromUserId: string;
  username: string | null;
  walletAddress: string | null;
  twitterHandle: string | null;
  createdAt: string;
};

/** Send (or re-open) a friend request. Auto-accepts if the reverse request is already pending. */
export async function sendFriendRequest(
  requesterId: string,
  addresseeId: string,
): Promise<{ status: FriendStatus }> {
  if (requesterId === addresseeId) throw new Error('cannot_friend_self');
  const db = createAdminSupabase() as any;

  // If they already asked us, accept instead of creating a mirror row.
  const { data: reverse } = await db
    .from('friendships')
    .select('id, status')
    .eq('requester_id', addresseeId)
    .eq('addressee_id', requesterId)
    .maybeSingle();
  if (reverse && reverse.status === 'pending') {
    const { error } = await db
      .from('friendships')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', reverse.id);
    if (error) throwIfMissing(error);
    return { status: 'accepted' };
  }

  const { error } = await db
    .from('friendships')
    .upsert(
      { requester_id: requesterId, addressee_id: addresseeId, status: 'pending', responded_at: null },
      { onConflict: 'requester_id,addressee_id' },
    );
  if (error) throwIfMissing(error);
  return { status: 'pending' };
}

/** Accept or decline an incoming request. Only the addressee may respond. */
export async function respondToFriendRequest(
  addresseeId: string,
  requestId: string,
  accept: boolean,
): Promise<{ status: FriendStatus }> {
  const db = createAdminSupabase() as any;
  const status: FriendStatus = accept ? 'accepted' : 'declined';
  const { data, error } = await db
    .from('friendships')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('addressee_id', addresseeId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (error) throwIfMissing(error);
  if (!data) throw new Error('request_not_found');
  return { status };
}

/** Accepted friends (either direction). */
export async function listFriends(userId: string): Promise<FriendView[]> {
  const db = createAdminSupabase() as any;
  const { data, error } = await db
    .from('friendships')
    .select(
      'requester_id, addressee_id, responded_at, ' +
        'requester:requester_id(username, wallet_address, twitter_handle), ' +
        'addressee:addressee_id(username, wallet_address, twitter_handle)',
    )
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throwIfMissing(error);
  return ((data ?? []) as any[]).map((r) => {
    const iAmRequester = String(r.requester_id) === userId;
    const other = iAmRequester ? r.addressee : r.requester;
    return {
      userId: iAmRequester ? String(r.addressee_id) : String(r.requester_id),
      username: other?.username ?? null,
      walletAddress: other?.wallet_address ?? null,
      twitterHandle: other?.twitter_handle ?? null,
      since: String(r.responded_at ?? ''),
    };
  });
}

/** Incoming pending requests (this user is the addressee). */
export async function listPendingFriendRequests(userId: string): Promise<FriendRequestView[]> {
  const db = createAdminSupabase() as any;
  const { data, error } = await db
    .from('friendships')
    .select('id, requester_id, created_at, requester:requester_id(username, wallet_address, twitter_handle)')
    .eq('addressee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throwIfMissing(error);
  return ((data ?? []) as any[]).map((r) => ({
    requestId: String(r.id),
    fromUserId: String(r.requester_id),
    username: r.requester?.username ?? null,
    walletAddress: r.requester?.wallet_address ?? null,
    twitterHandle: r.requester?.twitter_handle ?? null,
    createdAt: String(r.created_at),
  }));
}
